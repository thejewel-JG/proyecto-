/**
 * KABALY Email Service & Templates
 * Gestiona todas las mecánicas de contacto, solicitudes, matrículas e información automática.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Estilos visuales comunes con la estética de KABALY (Dark & Gold Luxury)
const getEmailBaseLayout = (title: string, contentHtml: string): string => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0911;
      color: #F7E7C1;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .wrapper {
      width: 100%;
      background-color: #0B0911;
      padding: 30px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #150F22;
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
    }
    .header {
      background: linear-gradient(180deg, #2A1744 0%, #150F22 100%);
      padding: 35px 25px 25px 25px;
      text-align: center;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    .logo-symbol {
      font-size: 28px;
      color: #D4AF37;
      margin-bottom: 8px;
    }
    .logo-text {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #F7E7C1;
      margin: 0;
      text-transform: uppercase;
    }
    .logo-tagline {
      font-size: 11px;
      letter-spacing: 2px;
      color: #D4AF37;
      margin-top: 5px;
      text-transform: uppercase;
    }
    .content {
      padding: 35px 30px;
      line-height: 1.65;
      font-size: 14px;
      color: #DDD4C0;
    }
    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 50px;
      background-color: rgba(212, 175, 55, 0.15);
      border: 1px solid #D4AF37;
      color: #D4AF37;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    h1 {
      color: #F7E7C1;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .card-box {
      background-color: #0E0A16;
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 14px;
      padding: 18px;
      margin: 20px 0;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }
    .card-row:last-child {
      border-bottom: none;
    }
    .card-label {
      color: #A79FA8;
    }
    .card-value {
      color: #F7E7C1;
      font-weight: 600;
      text-align: right;
    }
    .cta-button {
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      background: linear-gradient(135deg, #E6CA65 0%, #D4AF37 50%, #AA820A 100%);
      color: #0B0911 !important;
      text-align: center;
      padding: 14px 24px;
      border-radius: 30px;
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      text-decoration: none;
      margin-top: 25px;
      margin-bottom: 10px;
    }
    .footer {
      background-color: #0B0911;
      padding: 25px;
      text-align: center;
      font-size: 11px;
      color: #7A7280;
      border-top: 1px solid rgba(212, 175, 55, 0.1);
    }
    .footer a {
      color: #D4AF37;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-symbol">✧ ☽ ✧</div>
        <h2 class="logo-text">KABALY</h2>
        <div class="logo-tagline">Tu Destino, Tu Magia</div>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p>Has recibido esta comunicación cósmica de parte de <strong>KABALY</strong>.</p>
        <p>Madrid, España • Plataforma de Tarot y Sabiduría Astral</p>
        <p>© ${new Date().getFullYear()} KABALY. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const EmailTemplates = {
  // 1. Bienvenida al Registrarse
  welcomeUser: (data: { name: string; email: string; role: string }) => ({
    subject: '✨ Bienvenido a KABALY — Tu Destino Cósmico Comienza Aquí',
    html: getEmailBaseLayout('Bienvenido a KABALY', `
      <div class="badge">Cuenta Registrada</div>
      <h1>¡Saludos, ${data.name}!</h1>
      <p>Nos alegra darte la bienvenida a <strong>KABALY</strong>, la comunidad sagrada que conecta a buscadores espirituales con los tarotistas, astrólogos y guías más reconocidos.</p>
      
      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Nombre de usuario:</span>
          <span class="card-value">${data.name}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Correo registrado:</span>
          <span class="card-value">${data.email}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Tipo de cuenta:</span>
          <span class="card-value">${data.role.toUpperCase()}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Monedero Inicial:</span>
          <span class="card-value">100 Monedas de Bienvenida</span>
        </div>
      </div>

      <p>Ya puedes explorar tiradas diarias, reels de predicción y reservar lecturas privadas 1:1 en un entorno seguro y confidencial.</p>
      
      <a href="http://localhost:3001" class="cta-button">Acceder a KABALY</a>
    `),
  }),

  // 2. Solicitud y Matrícula de Tarotista (Onboarding / KYC)
  tarotistaApplicationReceived: (data: { name: string; professionalName: string; specialties: string[] }) => ({
    subject: '📜 Hemos recibido tu solicitud de matrícula profesional en KABALY',
    html: getEmailBaseLayout('Solicitud Profesional Recibida', `
      <div class="badge">Matrícula y Acreditación</div>
      <h1>Recepción de Candidatura Profesional</h1>
      <p>Estimado/a <strong>${data.name}</strong> (${data.professionalName}):</p>
      <p>Hemos recibido correctamente tu solicitud de matrícula para incorporarte al panel de <strong>Tarotistas Verificados de KABALY</strong>.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Nombre Profesional:</span>
          <span class="card-value">${data.professionalName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Especialidades:</span>
          <span class="card-value">${data.specialties.join(', ')}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Estado de Validación:</span>
          <span class="card-value" style="color: #E6CA65;">En Revisión por Moderación</span>
        </div>
      </div>

      <p>Nuestro equipo de ética y acreditación revisará tu perfil en un plazo máximo de 24 a 48 horas hábiles. Te notificaremos en este mismo correo una vez validado.</p>
      <p style="font-size: 12px; color: #9A919E;">* Recuerda tener a mano tu documento de identidad y comprobante de experiencia si fuera requerido por nuestro equipo de compliance.</p>
    `),
  }),

  // 3. Aprobación Oficial de Tarotista
  tarotistaApproved: (data: { professionalName: string }) => ({
    subject: '🌟 ¡Felicidades! Tu perfil de Tarotista ha sido Verificado en KABALY',
    html: getEmailBaseLayout('Perfil Verificado', `
      <div class="badge" style="background-color: rgba(76, 175, 80, 0.15); border-color: #4CAF50; color: #81C784;">Aprobado y Activo</div>
      <h1>¡Tu Matrícula ha sido Aprobada!</h1>
      <p>Nos complace comunicarte que tu perfil profesional como <strong>${data.professionalName}</strong> ha superado la validación de KABALY.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Insignia:</span>
          <span class="card-value" style="color: #D4AF37;">✓ Tarotista Verificado</span>
        </div>
        <div class="card-row">
          <span class="card-label">Salas 1:1:</span>
          <span class="card-value">Habilitadas (Chat, Voz y Vídeo)</span>
        </div>
        <div class="card-row">
          <span class="card-label">Monedero Profesional:</span>
          <span class="card-value">Conectado para Retiros</span>
        </div>
      </div>

      <p>Ya puedes fijar tus tarifas por minuto, publicar tus reels y comenzar a atender a tus consultantes.</p>
      <a href="http://localhost:3001" class="cta-button">Entrar a mi Perfil Profesional</a>
    `),
  }),

  // 4. Notificación de Nueva Consulta Solicitada (Al Tarotista)
  consultationBookedForTarotista: (data: {
    tarotistaName: string;
    clientName: string;
    duration: number;
    type: string;
    coinsTotal: number;
    consultationId: string;
  }) => ({
    subject: `🔔 Nueva Consulta Reservada: Sesión de ${data.duration} min con ${data.clientName}`,
    html: getEmailBaseLayout('Nueva Consulta Reservada', `
      <div class="badge">Nueva Cita Programada</div>
      <h1>Hola ${data.tarotistaName},</h1>
      <p>El consultante <strong>${data.clientName}</strong> ha reservado una lectura personalizada contigo. Los fondos han quedado retenidos de forma segura en Escrow.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">ID de Consulta:</span>
          <span class="card-value">${data.consultationId}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Consultante:</span>
          <span class="card-value">${data.clientName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Modalidad:</span>
          <span class="card-value">${data.type.toUpperCase()}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Duración:</span>
          <span class="card-value">${data.duration} minutos</span>
        </div>
        <div class="card-row">
          <span class="card-label">Honorarios estimados:</span>
          <span class="card-value" style="color: #D4AF37;">${data.coinsTotal} Monedas</span>
        </div>
      </div>

      <a href="http://localhost:3001" class="cta-button">Ir a la Sala de Consulta</a>
    `),
  }),

  // 5. Confirmación de Cita / Acceso a Sala para el Consultante
  consultationConfirmedForClient: (data: {
    clientName: string;
    tarotistaName: string;
    duration: number;
    type: string;
    consultationId: string;
  }) => ({
    subject: `🌙 Confirmación de Consulta Cósmica con ${data.tarotistaName}`,
    html: getEmailBaseLayout('Confirmación de Consulta', `
      <div class="badge">Confirmación de Reserva</div>
      <h1>¡Tu cita astral está lista, ${data.clientName}!</h1>
      <p>Tu solicitud de lectura con <strong>${data.tarotistaName}</strong> ha sido confirmada correctamente.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Tarotista:</span>
          <span class="card-value">${data.tarotistaName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Tipo de Sesión:</span>
          <span class="card-value">${data.type.toUpperCase()}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Tiempo contratado:</span>
          <span class="card-value">${data.duration} minutos</span>
        </div>
        <div class="card-row">
          <span class="card-label">Garantía KABALY:</span>
          <span class="card-value">Protegida por Escrow</span>
        </div>
      </div>

      <p>Para mayor comodidad, conéctate unos minutos antes desde un lugar tranquilo y con buena conexión a internet.</p>
      <a href="http://localhost:3001" class="cta-button">Acceder a mi Sala Privada</a>
    `),
  }),

  // 6. Recordatorio Previo (15 minutos antes de la consulta)
  consultationReminder: (data: { recipientName: string; partnerName: string; minutesRemaining: number }) => ({
    subject: `⏳ En ${data.minutesRemaining} minutos: Tu consulta con ${data.partnerName} comenzará`,
    html: getEmailBaseLayout('Recordatorio de Consulta', `
      <div class="badge" style="background-color: rgba(255, 152, 0, 0.15); border-color: #FF9800; color: #FFA726;">Recordatorio Cósmico</div>
      <h1>Todo listo para tu conexión espiritual</h1>
      <p>Hola <strong>${data.recipientName}</strong>, te recordamos que tu sesión con <strong>${data.partnerName}</strong> dará comienzo en aproximadamente <strong>${data.minutesRemaining} minutos</strong>.</p>
      
      <div class="card-box">
        <p style="margin: 0; font-size: 13px; color: #DDD4C0;">
          Recomendaciones:
          <br>• Comprueba que tu micrófono y cámara estén permitidos en tu navegador.
          <br>• Ten a mano tus preguntas específicas o cartas si deseas compartirlas.
        </p>
      </div>

      <a href="http://localhost:3001" class="cta-button">Entrar a la Sala Ahora</a>
    `),
  }),

  // 7. Recibo y Resumen de Sesión Finalizada (con invitación a valorar)
  consultationCompletedReceipt: (data: {
    clientName: string;
    tarotistaName: string;
    duration: number;
    coinsSpent: number;
    consultationId: string;
  }) => ({
    subject: `🧾 Resumen de tu Consulta en KABALY (#${data.consultationId.slice(-6)})`,
    html: getEmailBaseLayout('Resumen de Consulta', `
      <div class="badge">Sesión Concluida</div>
      <h1>Gracias por consultar con KABALY</h1>
      <p>Esperamos que tu lectura con <strong>${data.tarotistaName}</strong> te haya aportado claridad, luz e inspiración en tu camino.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">ID de Sesión:</span>
          <span class="card-value">${data.consultationId}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Guía Espiritual:</span>
          <span class="card-value">${data.tarotistaName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Duración efectiva:</span>
          <span class="card-value">${data.duration} min</span>
        </div>
        <div class="card-row">
          <span class="card-label">Monedas Aplicadas:</span>
          <span class="card-value" style="color: #D4AF37;">${data.coinsSpent} Monedas</span>
        </div>
      </div>

      <p>Tu opinión es fundamental para la comunidad. Por favor, tómate un momento para dejar tu reseña verificada.</p>
      <a href="http://localhost:3001" class="cta-button">Valorar mi Consulta</a>
    `),
  }),

  // 8. Solicitud de Información General / Contacto
  contactInquiryNotification: (data: { senderName: string; senderEmail: string; topic: string; message: string }) => ({
    subject: `📩 Solicitud de Información KABALY: [${data.topic}] - ${data.senderName}`,
    html: getEmailBaseLayout('Solicitud de Información', `
      <div class="badge">Atención al Usuario</div>
      <h1>Nueva Solicitud de Información</h1>
      <p>Hemos recibido una consulta enviada a través de la plataforma:</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Remitente:</span>
          <span class="card-value">${data.senderName}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Correo de Contacto:</span>
          <span class="card-value">${data.senderEmail}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Tema / Motivo:</span>
          <span class="card-value">${data.topic}</span>
        </div>
      </div>

      <div style="background-color: #0E0A16; border-left: 3px solid #D4AF37; padding: 15px; border-radius: 4px; margin: 15px 0;">
        <p style="margin: 0; font-size: 13px; color: #F7E7C1; white-space: pre-wrap;">${data.message}</p>
      </div>

      <p style="font-size: 12px; color: #8F8796;">Para responder a esta solicitud, pulsa Responder directamente a este correo.</p>
    `),
  }),

  // 9. Solicitud de Retiro de Honorarios (Tarotistas)
  withdrawalConfirmation: (data: {
    professionalName: string;
    amountEur: number;
    amountCoins: number;
    bankIban: string;
    withdrawalId: string;
  }) => ({
    subject: `💳 Solicitud de Retiro Recibida (#${data.withdrawalId}) — KABALY`,
    html: getEmailBaseLayout('Retiro de Honorarios', `
      <div class="badge">Liquidación de Honorarios</div>
      <h1>Solicitud de Transferencia Registrada</h1>
      <p>Hola <strong>${data.professionalName}</strong>, hemos registrado tu solicitud de liquidación bancaria.</p>

      <div class="card-box">
        <div class="card-row">
          <span class="card-label">Nº Referencia:</span>
          <span class="card-value">${data.withdrawalId}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Importe en Euros:</span>
          <span class="card-value" style="color: #81C784; font-size: 15px;">${data.amountEur.toFixed(2)} €</span>
        </div>
        <div class="card-row">
          <span class="card-label">Monedas debitadas:</span>
          <span class="card-value">${data.amountCoins} Monedas</span>
        </div>
        <div class="card-row">
          <span class="card-label">IBAN de Destino:</span>
          <span class="card-value">${data.bankIban.slice(0, 4)} **** **** ${data.bankIban.slice(-4)}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Plazo estimado:</span>
          <span class="card-value">24-72 horas bancarias</span>
        </div>
      </div>

      <p style="font-size: 12px; color: #8F8796;">Recibirás un nuevo correo en cuanto el pago sea emitido por nuestra entidad financiera.</p>
    `),
  }),
};

/**
 * Función central de despacho de correos
 * Si no hay SMTP configurado en producción, genera un registro seguro de simulación
 */
export async function sendKabalyEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> {
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasSmtpConfig) {
    try {
      // @ts-ignore
      const nodemailerMod = await import('nodemailer');
      const nm = nodemailerMod.default || nodemailerMod;
      const transporter = nm.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'KABALY'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text || payload.subject,
      });

      console.log(`[Email Service] Correo enviado con éxito a ${payload.to} (ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[Email Service Error]:', err.message);
      return { success: false };
    }
  }

  // Modo simulación y registro de desarrollo
  console.log('------------------------------------------------------------');
  console.log(`[EMAIL SIMULADO]: Para: ${payload.to}`);
  console.log(`[ASUNTO]: ${payload.subject}`);
  console.log(`[FECHA]: ${new Date().toISOString()}`);
  console.log('------------------------------------------------------------');

  return { success: true, simulated: true, messageId: `sim_${Date.now()}` };
}
