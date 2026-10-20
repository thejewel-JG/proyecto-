import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'test' && !process.env.TEST_RUN) {
  dotenv.config();
}

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import { initDatabase, getDb } from './src/db/database';
import {
  registerUser,
  loginUser,
  logoutUser,
  SESSION_COOKIE_NAME,
} from './src/auth/authService';
import {
  attachUserMiddleware,
  requireAuth,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
} from './src/auth/authMiddleware';
import {
  getPublicTarotistas,
  getPublicVideos,
  getPublicReviews,
  getUserConsultations,
  getUserLedger,
  getReports,
  getWithdrawals,
} from './src/db/repo';
import { initialCoinPackages, initialGifts, initialLiveStreams } from './src/data/initialData';

// Initialize Gemini Client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function createServerApp() {
  // Inicializar base de datos relacional y migraciones
  await initDatabase();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(attachUserMiddleware);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // 1. AUTENTICACIÓN REAL Y GESTIÓN DE SESIÓN
  // ---------------------------------------------------------------------------

  // Registro de usuario
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role, isAgeVerified } = req.body;
      const { user, sessionToken } = await registerUser({
        name,
        email,
        password,
        role,
        isAgeVerified: !!isAgeVerified,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setSessionCookie(res, sessionToken);
      res.status(201).json({ success: true, user });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error interno al registrar usuario.' });
    }
  });

  // Inicio de sesión
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const { user, sessionToken } = await loginUser({
        email,
        password,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setSessionCookie(res, sessionToken);
      res.json({ success: true, user });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al iniciar sesión.' });
    }
  });

  // Cierre de sesión
  app.post('/api/auth/logout', async (req, res) => {
    try {
      await logoutUser(req.sessionToken);
      clearSessionCookie(res);
      res.json({ success: true, message: 'Sesión finalizada correctamente.' });
    } catch (err: any) {
      clearSessionCookie(res);
      res.json({ success: true });
    }
  });

  // Consultar usuario actual autenticado
  app.get('/api/auth/me', (req, res) => {
    res.json({ success: true, user: req.user || null });
  });

  // ---------------------------------------------------------------------------
  // 2. ESTADO GLOBAL SEGURO (/api/state)
  // REQUISITO: No debe entregar correos, documentos, datos bancarios, reportes
  // ni movimientos privados de otros usuarios.
  // ---------------------------------------------------------------------------
  app.get('/api/state', async (req, res) => {
    try {
      const currentUser = req.user || null;
      const isAdmin = currentUser?.role === 'admin';
      const isTarotista = currentUser?.role === 'tarotista';

      const [publicTarotistas, publicVideos, publicReviews] = await Promise.all([
        getPublicTarotistas(),
        getPublicVideos(),
        getPublicReviews(),
      ]);

      // Consultar únicamente los datos privados pertenecientes al usuario en sesión
      let userConsultations: any[] = [];
      let userLedger: any[] = [];
      let userReports: any[] = [];
      let userWithdrawals: any[] = [];

      if (currentUser) {
        [userConsultations, userLedger, userReports, userWithdrawals] = await Promise.all([
          getUserConsultations(currentUser.id, isAdmin),
          getUserLedger(currentUser.id, isAdmin),
          getReports(currentUser.id, isAdmin),
          getWithdrawals(currentUser.id, isAdmin, isTarotista),
        ]);
      }

      res.json({
        currentUser,
        tarotistaProfiles: publicTarotistas,
        videos: publicVideos,
        liveStreams: initialLiveStreams,
        reviews: publicReviews,
        consultations: userConsultations,
        ledger: userLedger,
        reports: userReports,
        withdrawals: userWithdrawals,
        coinPackages: initialCoinPackages,
        gifts: initialGifts,
      });
    } catch (err: any) {
      console.error('[API State Error]:', err);
      res.status(500).json({ error: 'Error al recuperar el estado de la aplicación.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. EDICIÓN SEGURA DE PERFIL PROPIO
  // REQUISITO: Cada usuario solo puede editar su perfil; no puede autoasignarse admin
  // ---------------------------------------------------------------------------
  app.post('/api/users/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id; // Identidad obtenida estrictamente de la sesión
      const { name, handle, bio, avatar, coverImage } = req.body;
      const db = await getDb();

      // Validación
      const safeName = (name || '').trim();
      if (name !== undefined && safeName.length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
      }

      await db.run(`
        UPDATE users
        SET name = COALESCE(?, name),
            handle = COALESCE(?, handle),
            bio = COALESCE(?, bio),
            avatar = COALESCE(?, avatar),
            cover_image = COALESCE(?, cover_image),
            updated_at = ?
        WHERE id = ?
      `, [
        safeName || null,
        handle?.trim() || null,
        bio?.trim() || null,
        avatar?.trim() || null,
        coverImage?.trim() || null,
        new Date().toISOString(),
        userId
      ]);

      const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

      res.json({
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          avatar: updated.avatar,
          coverImage: updated.cover_image,
          handle: updated.handle,
          bio: updated.bio,
          coinsBalance: updated.coins_balance,
          isAgeVerified: !!updated.is_age_verified,
          spendingLimitDaily: updated.spending_limit_daily,
          spendingLimitWeekly: updated.spending_limit_weekly,
          spentToday: updated.spent_today,
          spentThisWeek: updated.spent_this_week,
          createdAt: updated.created_at,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar el perfil.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. RECARGA DE MONEDAS (BLOQUEADA HASTA INTEGRAR PASARELA REAL)
  // REQUISITO: /api/coins/topup no debe acreditar monedas por recibir petición del navegador.
  // ---------------------------------------------------------------------------
  app.post('/api/coins/topup', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'La pasarela de pago seguro aún no está disponible. No se ha modificado su saldo ni procesado ninguna transacción.',
      code: 'PAYMENT_GATEWAY_UNAVAILABLE'
    });
  });

  // ---------------------------------------------------------------------------
  // 5. RUTAS DE ADMINISTRACIÓN PROTEGIDAS (requireAdmin)
  // ---------------------------------------------------------------------------
  app.post('/api/admin/approve-tarotista', requireAdmin, async (req, res) => {
    try {
      const { profileId, approve } = req.body;
      const db = await getDb();
      const profile = await db.get('SELECT * FROM tarotista_profiles WHERE id = ?', [profileId]);
      if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });

      const newKyc = approve ? 'aprobado' : 'rechazado';
      const isVerified = approve ? 1 : 0;
      const stripeStatus = approve ? 'conectado' : 'pendiente';

      await db.run(`
        UPDATE tarotista_profiles
        SET kyc_status = ?, is_verified = ?, stripe_connect_status = ?
        WHERE id = ?
      `, [newKyc, isVerified, stripeStatus, profileId]);

      res.json({ success: true, profileId, status: newKyc });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al moderar perfil.' });
    }
  });

  app.post('/api/admin/resolve-dispute', requireAdmin, async (req, res) => {
    try {
      const { consultationId, refundClient } = req.body;
      const db = await getDb();
      const consultation = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [consultationId]);
      if (!consultation) return res.status(404).json({ error: 'Consulta no encontrada.' });

      const newStatus = refundClient ? 'reembolsada' : 'completada';
      await db.run('UPDATE consultations SET status = ? WHERE id = ?', [newStatus, consultationId]);

      if (refundClient) {
        await db.run('UPDATE users SET coins_balance = coins_balance + ? WHERE id = ?', [consultation.total_coins, consultation.client_id]);
      } else {
        await db.run('UPDATE users SET coins_balance = coins_balance + ? WHERE id = ?', [consultation.tarotista_earnings_coins, consultation.tarotista_id]);
      }

      res.json({ success: true, consultationId, status: newStatus });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al resolver disputa.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. RUTAS ANTIGUAS PROTEGIDAS CON SESIÓN
  // ---------------------------------------------------------------------------
  app.post('/api/tarotistas/withdraw', requireAuth, async (req, res) => {
    if (req.user!.role !== 'tarotista') {
      return res.status(403).json({ error: 'Solo los tarotistas verificados pueden solicitar retiros.' });
    }
    const { amountEur, vatNumber, bankIban } = req.body;
    const db = await getDb();
    const eur = Number(amountEur) || 50;
    const coins = eur * 10;

    if (eur < 50) {
      return res.status(400).json({ error: 'El umbral mínimo de retiro es de 50.00 € (500 monedas).' });
    }

    const userRow = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [req.user!.id]);
    if (!userRow || userRow.coins_balance < coins) {
      return res.status(400).json({ error: 'Saldo de monedas insuficiente para solicitar este retiro.' });
    }

    await db.run('UPDATE users SET coins_balance = coins_balance - ? WHERE id = ?', [coins, req.user!.id]);

    const reqId = `wdr_${Date.now()}`;
    await db.run(`
      INSERT INTO withdrawals (id, tarotista_id, tarotista_name, amount_eur, amount_coins, status, requested_at, vat_number, bank_iban)
      VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `, [reqId, req.user!.id, req.user!.name, eur, coins, new Date().toISOString(), vatNumber || '', bankIban || '']);

    res.json({ success: true, id: reqId, amountEur: eur });
  });

  // Crear reporte
  app.post('/api/reports/create', requireAuth, async (req, res) => {
    try {
      const { reportedUserId, reportedUserName, contentType, contentId, reason, description } = req.body;
      const db = await getDb();
      const reportId = `rep_${Date.now()}`;

      await db.run(`
        INSERT INTO reports (id, reporter_id, reporter_name, reported_user_id, reported_user_name, content_type, content_id, reason, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `, [
        reportId,
        req.user!.id,
        req.user!.name,
        reportedUserId || 'unknown',
        reportedUserName || 'Usuario reportado',
        contentType || 'chat',
        contentId || 'general',
        reason || 'acoso',
        description || '',
        new Date().toISOString()
      ]);

      res.json({ success: true, reportId });
    } catch (err) {
      res.status(500).json({ error: 'Error al enviar reporte.' });
    }
  });

  // AI Chat
  app.post('/api/ai/chat', async (req, res) => {
    const { prompt } = req.body;
    const lower = (prompt || '').toLowerCase();
    if (lower.includes('suicidio') || lower.includes('matarme') || lower.includes('morir') || lower.includes('autolesion')) {
      return res.json({
        response: 'Siento mucho que estés pasando por un momento de gran dolor. En KABALY nos preocupamos profundamente por tu bienestar. Te pedimos con urgencia que busques apoyo profesional y humano inmediato. Puedes comunicarte gratis y confidencialmente con el Teléfono de la Esperanza llamando al 717 003 717 o al 024 (Línea de atención a la conducta suicida en España). Tu vida tiene un valor incalculable y no estás solo/a. ❤️',
        isCrisis: true,
      });
    }

    try {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MOCK_KEY') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction: `Eres "Kabaly AI", la guía mística y asistente de sabiduría espiritual de KABALY.
Tu personalidad es serena, poética, elegante y reconfortante.
Ofreces interpretaciones sobre el Tarot, significado de las cartas, orientación astrológica y horóscopos.
REGLAS OBLIGATORIAS:
1. NUNCA prometes o garantizas resultados futuros en amor, salud o dinero.
2. NUNCA das asesoramiento médico, psicológico, legal ni financiero.
3. Si el usuario pregunta por predicciones trágicas o enfermedades, recuerda que el Tarot es una herramienta de autoconocimiento y reflexión personal.
4. Responde con un tono elevado pero accesible, con sutiles referencias cosmicas. Máximo 150 palabras.
5. Recomienda amablemente reservar una consulta 1:1 con un tarotista profesional verificado en la plataforma si el usuario desea una lectura personalizada profunda.`,
          },
        });

        return res.json({
          response: response.text,
          cardDrawn: {
            name: 'La Estrella (XVII)',
            meaning: 'Esperanza, fe, renovación e inspiración estelar.',
            imageUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300',
          },
        });
      }
    } catch (e) {
      // fallback
    }

    const fallbackResponses = [
      `El universo te recuerda que las sombras del presente son solo la antesala de una luz más radiante. Las alineaciones planetarias actuales favorecen la introspección y la sanación personal.`,
      `En el arcano de tu camino, la claridad surge cuando confías en tu propia intuición. Cada decisión guiada por la serenidad expande tu energía astral.`,
      `Los astros indican que estás en un ciclo de renovación profunda. Permítete soltar lo que ya no vibra con tu propósito sagrado.`
    ];

    res.json({
      response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
      cardDrawn: {
        name: 'La Estrella (XVII)',
        meaning: 'Esperanza, fe, renovación e inspiración celestial.',
        imageUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300',
      },
    });
  });

  return app;
}

export async function startServer() {
  const app = await createServerApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

  // Vite Middleware for Dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KABALY Server] Running on http://localhost:${PORT}`);
  });
}

// Iniciar solo si se ejecuta directamente como script principal (no al importarse en pruebas)
const isMainScript = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.js') || 
  process.argv[1].endsWith('server.cjs')
);

if (isMainScript) {
  startServer().catch(err => {
    console.error('[FATAL SERVER ERROR]:', err);
    process.exit(1);
  });
}
