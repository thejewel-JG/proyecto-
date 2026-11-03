import crypto from 'crypto';
import { getDb } from '../db/database';
import { Consultation, ConsultationMessage, ConsultationDispute, ConsultationRoomCredentials, ConsultationStatus, ConsultationType } from '../types';

export const ACCEPT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos para aceptar solicitud
export const RECONNECT_GRACE_PERIOD_MS = 3 * 60 * 1000; // 3 minutos de periodo de reconexión

export function mapConsultationRow(row: any): Consultation {
  const mod = (row.type as ConsultationType) || 'chat';
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientAvatar: row.client_avatar,
    tarotistaId: row.tarotista_id,
    tarotistaUserId: row.tarotista_user_id || undefined,
    tarotistaName: row.tarotista_name,
    tarotistaAvatar: row.tarotista_avatar,
    type: mod,
    modality: mod,
    durationMinutes: row.duration_minutes,
    status: row.status as ConsultationStatus,
    ratePerMinuteCoins: row.rate_per_minute_coins || 0,
    totalCoins: row.total_coins,
    priceCoins: row.total_coins,
    platformCommissionCoins: row.platform_commission_coins || 0,
    tarotistaEarningsCoins: row.tarotista_earnings_coins || 0,
    commissionPercentage: row.commission_percentage || 20,
    createdAt: row.created_at,
    requestedAt: row.created_at,
    acceptedAt: row.accepted_at || undefined,
    startedAt: row.started_at || undefined,
    scheduledEndAt: row.scheduled_end_at || undefined,
    endedAt: row.ended_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    isSettled: !!row.is_settled,
    isRefunded: !!row.is_refunded,
    roomToken: row.room_token || undefined,
    idempotencyKey: row.idempotency_key || undefined,
    notes: row.notes || undefined,
    expiresAt: row.expires_at || undefined,
  };
}

// ----------------------------------------------------------------------------
// 1. CONTRATAR UNA CONSULTA (Reserva interna no-escrow de monedas)
// ----------------------------------------------------------------------------
export async function createConsultationBooking(params: {
  clientId: string;
  clientName?: string;
  clientAvatar?: string;
  tarotistaId: string; // ID de tarotista_profiles o user_id
  durationMinutes: number;
  type?: ConsultationType;
  modality?: ConsultationType;
  idempotencyKey?: string;
  notes?: string;
}): Promise<any> {
  const db = await getDb();
  const { clientId, tarotistaId, durationMinutes, idempotencyKey, notes } = params;
  const modality = (params.type || params.modality || '') as ConsultationType;

  if (!['chat', 'audio', 'video'].includes(modality)) {
    throw { status: 400, message: 'Modalidad de consulta inválida. Las opciones disponibles son: chat, audio o video.' };
  }

  const validDurations = [10, 15, 20, 30, 45, 60];
  if (!validDurations.includes(durationMinutes)) {
    throw { status: 400, message: `Duración no permitida. Elija una de: ${validDurations.join(', ')} minutos.` };
  }

  // Idempotencia: Si ya se envió esta clave, devolver la consulta existente
  if (idempotencyKey) {
    const existing = await db.get<any>(
      'SELECT * FROM consultations WHERE client_id = ? AND idempotency_key = ?',
      [clientId, idempotencyKey]
    );
    if (existing) {
      const mapped = mapConsultationRow(existing);
      return { consultation: mapped, isDuplicate: true, ...mapped };
    }
  }

  // Obtener perfil profesional del tarotista
  const profile = await db.get<any>(
    'SELECT * FROM tarotista_profiles WHERE id = ? OR user_id = ?',
    [tarotistaId, tarotistaId]
  );
  if (!profile) {
    throw { status: 404, message: 'Perfil de tarotista no encontrado o inactivo.' };
  }

  const tarotistaUserId = profile.user_id;

  // REQUISITO: El cliente no puede contratar una consulta consigo mismo
  if (clientId === tarotistaUserId) {
    throw { status: 400, message: 'Un profesional no puede contratar una consulta consigo mismo.' };
  }

  // Obtener tarifa y comisión inmutables del servidor
  const ratePerMinute = profile.price_per_min_coins || 15;
  const commissionPercentage = profile.custom_commission_percentage ?? 20;
  const totalCoins = ratePerMinute * durationMinutes;

  // Comprobar saldo disponible del cliente
  const clientUser = await db.get<any>(
    'SELECT id, name, avatar, coins_balance, coins_reserved FROM users WHERE id = ?',
    [clientId]
  );
  if (!clientUser) {
    throw { status: 404, message: 'Usuario cliente no encontrado.' };
  }

  if (clientUser.coins_balance < totalCoins) {
    throw {
      status: 402,
      message: `Saldo insuficiente. Tu saldo disponible es de ${clientUser.coins_balance} monedas y la consulta requiere ${totalCoins} monedas.`,
    };
  }

  const clientName = params.clientName || clientUser.name || 'Cliente';
  const clientAvatar = params.clientAvatar || clientUser.avatar || '';

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCEPT_TIMEOUT_MS);
  const consultationId = `cons_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // REQUISITO: Transacción contable estricta para reserva interna de monedas
  await db.run('BEGIN TRANSACTION');
  try {
    // 1. Mover monedas del saldo disponible a la reserva interna
    const updateRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           coins_reserved = coins_reserved + ?,
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [totalCoins, totalCoins, now.toISOString(), clientId, totalCoins]
    );

    if (updateRes.changes === 0) {
      await db.run('ROLLBACK');
      throw { status: 400, message: 'No se pudo reservar el saldo requerido para la consulta.' };
    }

    // 2. Registrar movimiento en Libro Mayor (Ledger) con balance_after
    const updatedClient = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientId]);
    const ledgerId = `tx_hold_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_reserve', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        clientId,
        -totalCoins,
        updatedClient.coins_balance,
        `Retención para consulta 1:1 (${modality}, ${durationMinutes} min) con ${profile.professional_name}`,
        consultationId,
        now.toISOString(),
      ]
    );

    // 3. Crear registro de consulta en estado 'solicitada'
    await db.run(
      `INSERT INTO consultations (
        id, client_id, client_name, client_avatar,
        tarotista_id, tarotista_user_id, tarotista_name, tarotista_avatar,
        status, type, duration_minutes, rate_per_minute_coins,
        total_coins, platform_commission_coins, tarotista_earnings_coins,
        commission_percentage, scheduled_for, created_at, expires_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'solicitada', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      [
        consultationId,
        clientId,
        clientName,
        clientAvatar,
        profile.id,
        tarotistaUserId,
        profile.professional_name,
        profile.avatar,
        modality,
        durationMinutes,
        ratePerMinute,
        totalCoins,
        commissionPercentage,
        now.toISOString(),
        now.toISOString(),
        expiresAt.toISOString(),
        idempotencyKey || null,
      ]
    );

    await db.run('COMMIT');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }

  const created = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  const mapped = mapConsultationRow(created);
  return { consultation: mapped, isDuplicate: false, ...mapped };
}

// ----------------------------------------------------------------------------
// 2. ACEPTAR CONSULTA (Solo Tarotista Asignado)
// ----------------------------------------------------------------------------
export async function acceptConsultation(consultationId: string, tarotistaUserId: string): Promise<Consultation> {
  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  if (cons.tarotista_user_id !== tarotistaUserId) {
    throw { status: 403, message: 'Solo el profesional asignado puede aceptar esta consulta.' };
  }

  if (cons.status !== 'solicitada') {
    throw { status: 400, message: `La consulta se encuentra en estado '${cons.status}', no puede aceptarse.` };
  }

  // REQUISITO: Impedir solapamiento de horarios o consultas simultáneas activas
  const activeConcurrent = await db.get<any>(
    `SELECT id FROM consultations 
     WHERE tarotista_user_id = ? 
       AND status IN ('en_curso') 
       AND id != ?`,
    [tarotistaUserId, consultationId]
  );
  if (activeConcurrent) {
    throw { status: 409, message: 'Actualmente ya tienes una consulta en curso. Finaliza la sesión actual antes de aceptar otra.' };
  }

  const now = new Date().toISOString();
  await db.run(
    "UPDATE consultations SET status = 'aceptada', accepted_at = ? WHERE id = ?",
    [now, consultationId]
  );

  const updated = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  return mapConsultationRow(updated);
}

// ----------------------------------------------------------------------------
// 3. RECHAZAR O CANCELAR CONSULTA (Liberación única y exacta de la reserva)
// ----------------------------------------------------------------------------
export async function rejectConsultation(
  consultationIdOrParams: string | { consultationId: string; tarotistaUserId: string; reason?: string },
  tarotistaUserIdArg?: string,
  reasonArg: string = 'Rechazada por el profesional'
): Promise<Consultation> {
  const consultationId = typeof consultationIdOrParams === 'object' ? consultationIdOrParams.consultationId : consultationIdOrParams;
  const tarotistaUserId = typeof consultationIdOrParams === 'object' ? consultationIdOrParams.tarotistaUserId : (tarotistaUserIdArg || '');
  const reason = typeof consultationIdOrParams === 'object' ? (consultationIdOrParams.reason || reasonArg) : reasonArg;

  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  if (cons.tarotista_user_id !== tarotistaUserId) {
    throw { status: 403, message: 'Solo el profesional asignado puede rechazar esta consulta.' };
  }

  if (cons.status !== 'solicitada') {
    throw { status: 400, message: `No se puede rechazar una consulta en estado '${cons.status}'.` };
  }

  return releaseConsultationHold({
    consultationId,
    targetStatus: 'rechazada',
    cancelledBy: tarotistaUserId,
    reason,
  });
}

export async function cancelConsultation(
  consultationIdOrParams: string | { consultationId: string; userId: string; reason?: string },
  userIdArg?: string,
  reasonArg: string = 'Cancelada por el usuario'
): Promise<Consultation> {
  const consultationId = typeof consultationIdOrParams === 'object' ? consultationIdOrParams.consultationId : consultationIdOrParams;
  const userId = typeof consultationIdOrParams === 'object' ? consultationIdOrParams.userId : (userIdArg || '');
  const reason = typeof consultationIdOrParams === 'object' ? (consultationIdOrParams.reason || reasonArg) : reasonArg;

  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;

  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'No tienes autorización para cancelar esta consulta.' };
  }

  if (cons.status !== 'solicitada' && cons.status !== 'aceptada') {
    throw { status: 400, message: `No se puede cancelar una consulta en estado '${cons.status}'.` };
  }

  return releaseConsultationHold({
    consultationId,
    targetStatus: 'cancelada',
    cancelledBy: userId,
    reason,
  });
}

async function releaseConsultationHold(params: {
  consultationId: string;
  targetStatus: 'rechazada' | 'cancelada' | 'expirada';
  cancelledBy: string;
  reason: string;
}): Promise<Consultation> {
  const db = await getDb();
  const { consultationId, targetStatus, cancelledBy, reason } = params;

  await db.run('BEGIN TRANSACTION');
  try {
    const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
    if (!cons || cons.is_refunded === 1) {
      await db.run('COMMIT');
      return mapConsultationRow(cons);
    }

    const now = new Date().toISOString();
    const totalCoins = cons.total_coins;

    // 1. Liberar la reserva interna y devolver saldo al cliente
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           coins_reserved = MAX(0, coins_reserved - ?),
           updated_at = ?
       WHERE id = ?`,
      [totalCoins, totalCoins, now, cons.client_id]
    );

    // 2. Registrar movimiento compensatorio en Libro Mayor
    const updatedClient = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [cons.client_id]);
    const ledgerId = `tx_rel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        cons.client_id,
        totalCoins,
        updatedClient.coins_balance,
        `Liberación de reserva por consulta ${targetStatus} (${cons.tarotista_name}): ${reason}`,
        consultationId,
        now,
      ]
    );

    // 3. Actualizar estado de consulta
    await db.run(
      `UPDATE consultations 
       SET status = ?, 
           cancelled_at = ?, 
           cancelled_by = ?, 
           cancellation_reason = ?, 
           is_refunded = 1 
       WHERE id = ?`,
      [targetStatus, now, cancelledBy, reason, consultationId]
    );

    await db.run('COMMIT');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }

  const updated = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  return mapConsultationRow(updated);
}

// ----------------------------------------------------------------------------
// 4. INICIAR CONSULTA Y ACCESO A SALA PRIVADA
// ----------------------------------------------------------------------------
export async function startConsultation(consultationId: string, userId: string): Promise<Consultation> {
  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'Acceso denegado a esta sala de consulta.' };
  }

  // Idempotente si ya está en curso
  if (cons.status === 'en_curso') {
    return mapConsultationRow(cons);
  }

  if (cons.status !== 'aceptada') {
    throw { status: 400, message: `La consulta debe estar aceptada para iniciarla (estado actual: '${cons.status}').` };
  }

  // REQUISITO: Si el tarotista estaba en directo, exigir detener la emisión antes de entrar
  const activeStream = await db.get<any>(
    'SELECT id FROM live_streams WHERE (tarotista_id = ? OR tarotista_id = ?) AND is_live = 1',
    [cons.tarotista_id, cons.tarotista_user_id || cons.tarotista_id]
  );
  if (activeStream) {
    throw {
      status: 409,
      message: 'El profesional tiene una emisión pública en directo activa. Debe detener la emisión antes de activar la sala privada.',
    };
  }

  const now = new Date();
  const scheduledEndAt = new Date(now.getTime() + cons.duration_minutes * 60 * 1000);
  const roomToken = `room_${crypto.randomBytes(24).toString('hex')}`;

  await db.run(
    `UPDATE consultations 
     SET status = 'en_curso', 
         started_at = ?, 
         scheduled_end_at = ?, 
         room_token = ? 
     WHERE id = ?`,
    [now.toISOString(), scheduledEndAt.toISOString(), roomToken, consultationId]
  );

  const updated = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  return mapConsultationRow(updated);
}

// ----------------------------------------------------------------------------
// 5. COMPLETAR Y LIQUIDAR CONSULTA (Conserva suma exacta de enteros)
// ----------------------------------------------------------------------------
export async function completeConsultation(
  consultationId: string,
  _closedByUserId?: string,
  _reason: string = 'Tiempo completado'
): Promise<Consultation> {
  const db = await getDb();

  await db.run('BEGIN TRANSACTION');
  try {
    const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
    if (!cons) {
      await db.run('ROLLBACK');
      throw { status: 404, message: 'Consulta no encontrada.' };
    }

    if (cons.is_settled === 1) {
      await db.run('COMMIT');
      return mapConsultationRow(cons);
    }

    if (cons.status !== 'en_curso') {
      await db.run('ROLLBACK');
      throw { status: 400, message: `Solo se pueden liquidar consultas que estén 'en_curso' (actual: '${cons.status}').` };
    }

    const now = new Date().toISOString();
    const totalCoins = cons.total_coins;
    const commissionPct = cons.commission_percentage || 20;

    // REQUISITO: Regla explícita de redondeo que conserva la suma total de enteros
    const platformFeeCoins = Math.round(totalCoins * (commissionPct / 100));
    const tarotistaEarningsCoins = totalCoins - platformFeeCoins;

    if (platformFeeCoins + tarotistaEarningsCoins !== totalCoins) {
      throw new Error('Error en el balance de liquidación contable.');
    }

    // 1. Liberar la reserva del cliente
    await db.run(
      'UPDATE users SET coins_reserved = MAX(0, coins_reserved - ?), updated_at = ? WHERE id = ?',
      [totalCoins, now, cons.client_id]
    );

    // 2. Acreditar ganancias profesionales al tarotista (separadas en earnings_coins_balance)
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarningsCoins, tarotistaEarningsCoins, now, cons.tarotista_user_id]
    );

    // 3. Incrementar contador de lecturas en perfil
    await db.run(
      'UPDATE tarotista_profiles SET total_readings = total_readings + 1 WHERE id = ? OR user_id = ?',
      [cons.tarotista_id, cons.tarotista_user_id]
    );

    // 4. Asentar en Libro Mayor (Ledger)
    const tarotistaUser = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [cons.tarotista_user_id]);
    const ledgerTarotistaId = `tx_earn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ledgerFeeId = `tx_fee_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_settlement', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerTarotistaId,
        cons.tarotista_user_id,
        tarotistaEarningsCoins,
        tarotistaUser.coins_balance,
        `Liquidación de consulta 1:1 (${cons.duration_minutes} min) con ${cons.client_name}`,
        consultationId,
        now,
      ]
    );

    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
      [
        ledgerFeeId,
        platformFeeCoins,
        `Comisión de plataforma (${commissionPct}%) por consulta ${consultationId}`,
        consultationId,
        now,
      ]
    );

    // 5. Marcar como completada y liquidada
    await db.run(
      `UPDATE consultations 
       SET status = 'completada', 
           ended_at = ?, 
           platform_commission_coins = ?, 
           tarotista_earnings_coins = ?, 
           is_settled = 1 
       WHERE id = ?`,
      [now, platformFeeCoins, tarotistaEarningsCoins, consultationId]
    );

    await db.run('COMMIT');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }

  const updated = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  return mapConsultationRow(updated);
}

// ----------------------------------------------------------------------------
// 6. GESTIÓN DE DISPUTAS Y REEMBOLSOS COMPENSATORIOS
// ----------------------------------------------------------------------------
export async function createConsultationDispute(params: {
  consultationId: string;
  raisedById: string;
  reason: string;
}): Promise<ConsultationDispute> {
  const db = await getDb();
  const { consultationId, raisedById, reason } = params;

  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === raisedById;
  const isTarotista = cons.tarotista_user_id === raisedById;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'Solo los participantes de la consulta pueden abrir una disputa.' };
  }

  const disputeId = `disp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO consultation_disputes (
      id, consultation_id, client_id, tarotista_id, raised_by_id,
      reason, status, refund_amount_coins, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [disputeId, consultationId, cons.client_id, cons.tarotista_id, raisedById, reason, now]
  );

  await db.run(
    "UPDATE consultations SET status = 'disputada' WHERE id = ?",
    [consultationId]
  );

  return {
    id: disputeId,
    consultationId,
    clientId: cons.client_id,
    tarotistaId: cons.tarotista_id,
    raisedById,
    reason,
    status: 'pending',
    refundAmountCoins: 0,
    createdAt: now,
  };
}

export async function resolveConsultationDispute(params: {
  disputeId: string;
  adminUserId: string;
  resolution: 'resolved_refund_full' | 'resolved_refund_partial' | 'resolved_rejected';
  refundAmountCoins?: number;
  adminNotes?: string;
}): Promise<ConsultationDispute> {
  const db = await getDb();
  const { disputeId, adminUserId, resolution, adminNotes } = params;

  const dispute = await db.get<any>('SELECT * FROM consultation_disputes WHERE id = ?', [disputeId]);
  if (!dispute) {
    throw { status: 404, message: 'Disputa no encontrada.' };
  }

  if (dispute.status !== 'pending') {
    throw { status: 400, message: 'Esta disputa ya ha sido resuelta con anterioridad.' };
  }

  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [dispute.consultation_id]);
  const now = new Date().toISOString();
  let coinsToRefund = 0;

  if (resolution === 'resolved_refund_full') {
    coinsToRefund = cons.total_coins;
  } else if (resolution === 'resolved_refund_partial') {
    coinsToRefund = Math.min(cons.total_coins, Math.max(0, params.refundAmountCoins || 0));
  }

  await db.run('BEGIN TRANSACTION');
  try {
    if (coinsToRefund > 0) {
      // Si la consulta ya fue liquidada al profesional, deducir compensatoriamente de su saldo
      if (cons.is_settled === 1) {
        const tarotistaUser = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [cons.tarotista_user_id]);
        const currentTarotistaBal = tarotistaUser ? tarotistaUser.coins_balance : 0;
        const deductFromTarotista = Math.min(currentTarotistaBal, coinsToRefund);

        await db.run(
          `UPDATE users 
           SET coins_balance = MAX(0, coins_balance - ?),
               earnings_coins_balance = MAX(0, earnings_coins_balance - ?),
               financial_restriction = CASE WHEN ? > coins_balance THEN 1 ELSE financial_restriction END,
               updated_at = ?
           WHERE id = ?`,
          [deductFromTarotista, deductFromTarotista, coinsToRefund, now, cons.tarotista_user_id]
        );
      } else {
        // Si no estaba liquidada, liberar de la reserva
        await db.run(
          'UPDATE users SET coins_reserved = MAX(0, coins_reserved - ?), updated_at = ? WHERE id = ?',
          [cons.total_coins, now, cons.client_id]
        );
      }

      // Devolver monedas al cliente
      await db.run(
        'UPDATE users SET coins_balance = coins_balance + ?, updated_at = ? WHERE id = ?',
        [coinsToRefund, now, cons.client_id]
      );

      // Asentar en Libro Mayor
      const updatedClient = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [cons.client_id]);
      const ledgerId = `tx_disp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'consultation_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
        [
          ledgerId,
          cons.client_id,
          coinsToRefund,
          updatedClient.coins_balance,
          `Resolución de disputa #${disputeId}: Reembolso de ${coinsToRefund} monedas`,
          cons.id,
          now,
        ]
      );
    }

    await db.run(
      `UPDATE consultation_disputes 
       SET status = ?, 
           refund_amount_coins = ?, 
           admin_notes = ?, 
           resolved_by = ?, 
           resolved_at = ? 
       WHERE id = ?`,
      [resolution, coinsToRefund, adminNotes || null, adminUserId, now, disputeId]
    );

    await db.run(
      "UPDATE consultations SET status = 'reembolsada' WHERE id = ?",
      [cons.id]
    );

    await db.run('COMMIT');
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }

  const updated = await db.get<any>('SELECT * FROM consultation_disputes WHERE id = ?', [disputeId]);
  return {
    id: updated.id,
    consultationId: updated.consultation_id,
    clientId: updated.client_id,
    tarotistaId: updated.tarotista_id,
    raisedById: updated.raised_by_id,
    reason: updated.reason,
    status: updated.status,
    refundAmountCoins: updated.refund_amount_coins,
    adminNotes: updated.admin_notes || undefined,
    resolvedBy: updated.resolved_by || undefined,
    resolvedAt: updated.resolved_at || undefined,
    createdAt: updated.created_at,
  };
}

// ----------------------------------------------------------------------------
// 7. MENSAJERÍA PRIVADA DE LA SALA & CREDENCIALES
// ----------------------------------------------------------------------------
export async function getConsultationMessages(consultationId: string, userId: string): Promise<ConsultationMessage[]> {
  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'No tienes permiso para acceder a los mensajes de esta consulta.' };
  }

  const rows = await db.query<any>(
    'SELECT * FROM consultation_messages WHERE consultation_id = ? ORDER BY created_at ASC',
    [consultationId]
  );

  return rows.map((r) => ({
    id: r.id,
    consultationId: r.consultation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatar: r.sender_avatar || undefined,
    content: r.content,
    cardData: r.card_data ? JSON.parse(r.card_data) : undefined,
    createdAt: r.created_at,
  }));
}

export async function sendConsultationMessage(params: {
  consultationId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content?: string;
  text?: string;
  cardData?: any;
  cardShared?: any;
}): Promise<any> {
  const db = await getDb();
  const { consultationId, senderId } = params;
  const content = params.content || params.text || '';
  const cardData = params.cardData || params.cardShared;

  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === senderId;
  const isTarotista = cons.tarotista_user_id === senderId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'No tienes permiso para enviar mensajes en esta sala.' };
  }

  if (cons.status !== 'en_curso' && cons.status !== 'aceptada') {
    throw { status: 400, message: `No se pueden enviar mensajes en una consulta en estado '${cons.status}'.` };
  }

  const senderUser = await db.get<any>('SELECT name, avatar FROM users WHERE id = ?', [senderId]);
  const senderName = params.senderName || (senderUser ? senderUser.name : (isClient ? cons.client_name : cons.tarotista_name));
  const senderAvatar = params.senderAvatar || (senderUser ? senderUser.avatar : '');

  if (!content.trim() && !cardData) {
    throw { status: 400, message: 'El mensaje no puede estar vacío.' };
  }

  const id = `cmsg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO consultation_messages (
      id, consultation_id, sender_id, sender_name, sender_avatar, content, card_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, consultationId, senderId, senderName, senderAvatar || null, content, cardData ? JSON.stringify(cardData) : null, now]
  );

  return {
    id,
    consultationId,
    senderId,
    senderName,
    senderAvatar,
    content,
    text: content,
    cardData,
    cardShared: cardData,
    createdAt: now,
  };
}

export async function getConsultationRoomCredentials(consultationId: string, userId: string): Promise<any> {
  const db = await getDb();
  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: 'Acceso denegado a las credenciales de la sala.' };
  }

  const now = new Date();
  const expiresAt = cons.scheduled_end_at || new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const roomToken = cons.room_token || `token_${crypto.randomBytes(16).toString('hex')}`;

  const role = isClient ? 'client' : 'tarotista';
  return {
    consultationId,
    roomToken,
    channelName: `kabaly_room_${consultationId}`,
    userId,
    userName: isClient ? cons.client_name : cons.tarotista_name,
    role,
    participantRole: role,
    isReady: true,
    type: cons.type,
    expiresAt,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };
}

// ----------------------------------------------------------------------------
// 8. RESEÑAS VERIFICADAS (Solo clientes de consultas completadas, máx 1)
// ----------------------------------------------------------------------------
export async function createConsultationReview(params: {
  consultationId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  rating: number;
  comment: string;
}): Promise<any> {
  const db = await getDb();
  const { consultationId, clientId, clientName, clientAvatar, rating, comment } = params;

  if (rating < 1 || rating > 5) {
    throw { status: 400, message: 'La valoración debe ser un número entero entre 1 y 5 estrellas.' };
  }

  const cons = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
  if (!cons) {
    throw { status: 404, message: 'Consulta no encontrada.' };
  }

  if (cons.client_id !== clientId) {
    throw { status: 403, message: 'Solo el cliente que recibió la consulta puede dejar una reseña.' };
  }

  if (cons.status !== 'completada') {
    throw { status: 400, message: 'Solo se pueden valorar consultas que hayan sido completadas satisfactoriamente.' };
  }

  // REQUISITO: Máximo una reseña por consulta
  const existingReview = await db.get<any>('SELECT id FROM reviews WHERE consultation_id = ?', [consultationId]);
  if (existingReview) {
    throw { status: 400, message: 'Ya has publicado una reseña para esta consulta.' };
  }

  const reviewId = `rev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO reviews (
      id, consultation_id, tarotista_id, client_id, client_name, client_avatar, rating, comment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reviewId, consultationId, cons.tarotista_id, clientId, clientName, clientAvatar, Math.round(rating), comment, now]
  );

  // Recalcular media real de valoraciones del tarotista
  const stats = await db.get<any>(
    'SELECT COUNT(*) as count, AVG(rating) as avgRating FROM reviews WHERE tarotista_id = ?',
    [cons.tarotista_id]
  );

  if (stats) {
    const avg = parseFloat(Number(stats.avgRating || 5.0).toFixed(1));
    await db.run(
      'UPDATE tarotista_profiles SET rating_average = ?, total_reviews = ? WHERE id = ? OR user_id = ?',
      [avg, stats.count, cons.tarotista_id, cons.tarotista_user_id]
    );
  }

  return {
    id: reviewId,
    consultationId,
    tarotistaId: cons.tarotista_id,
    rating: Math.round(rating),
    comment,
    createdAt: now,
  };
}

// ----------------------------------------------------------------------------
// 9. JANITOR / TAREAS EN SEGUNDO PLANO (Recuperación tras reinicios)
// ----------------------------------------------------------------------------
export async function autoExpireConsultations(): Promise<{ expiredCount: number; completedCount: number }> {
  const db = await getDb();
  const now = new Date().toISOString();
  let expiredCount = 0;
  let completedCount = 0;

  // 1. Expirar solicitudes 'solicitada' vencidas (más de 15 min sin respuesta del tarotista)
  const expiredRequested = await db.query<any>(
    "SELECT id FROM consultations WHERE status = 'solicitada' AND expires_at <= ?",
    [now]
  );

  for (const c of expiredRequested) {
    try {
      await releaseConsultationHold({
        consultationId: c.id,
        targetStatus: 'expirada',
        cancelledBy: 'system_timeout',
        reason: 'Plazo de aceptación expirado sin respuesta del profesional',
      });
      expiredCount++;
    } catch (e) {
      console.error(`[Janitor Error] Expirando consulta ${c.id}:`, e);
    }
  }

  // 2. Finalizar y liquidar consultas 'en_curso' cuyo tiempo programado haya vencido
  const expiredInProgress = await db.query<any>(
    "SELECT id FROM consultations WHERE status = 'en_curso' AND scheduled_end_at <= ? AND is_settled = 0",
    [now]
  );

  for (const c of expiredInProgress) {
    try {
      await completeConsultation(c.id, 'system_timeout', 'Tiempo contratado finalizado');
      completedCount++;
    } catch (e) {
      console.error(`[Janitor Error] Completando consulta ${c.id}:`, e);
    }
  }

  return { expiredCount, completedCount };
}
