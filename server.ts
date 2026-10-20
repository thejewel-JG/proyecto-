import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { 
  initialUsers, 
  initialTarotistaProfiles, 
  initialVideos, 
  initialLiveStreams, 
  initialConsultations, 
  initialReviews, 
  initialLedger, 
  initialReports, 
  initialWithdrawals,
  initialCoinPackages,
  initialGifts 
} from './src/data/initialData';
import { 
  User, 
  TarotistaProfile, 
  Video, 
  LiveStream, 
  Consultation, 
  LedgerTransaction, 
  Review, 
  Report, 
  WithdrawalRequest,
  ConsultationStatus
} from './src/types';

import { initDatabase, saveToDb } from './src/db/database';

// Initialize In-Memory & Database Store
let users: User[] = [...initialUsers];
let tarotistaProfiles: TarotistaProfile[] = [...initialTarotistaProfiles];
let videos: Video[] = [...initialVideos];
let liveStreams: LiveStream[] = [...initialLiveStreams];
let consultations: Consultation[] = [...initialConsultations];
let reviews: Review[] = [...initialReviews];
let ledger: LedgerTransaction[] = [...initialLedger];
let reports: Report[] = [...initialReports];
let withdrawals: WithdrawalRequest[] = [...initialWithdrawals];

let saveDebounceTimer: NodeJS.Timeout | null = null;
export function syncDbState() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    try {
      await Promise.all([
        saveToDb('users', users),
        saveToDb('tarotistaProfiles', tarotistaProfiles),
        saveToDb('videos', videos),
        saveToDb('liveStreams', liveStreams),
        saveToDb('consultations', consultations),
        saveToDb('reviews', reviews),
        saveToDb('ledger', ledger),
        saveToDb('reports', reports),
        saveToDb('withdrawals', withdrawals),
      ]);
    } catch (e) {
      console.error('[Database] Error sincronizando estado:', e);
    }
  }, 1000);
}

// Initialize Gemini Client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  // Inicializar y cargar datos desde MySQL (o fallback si no hay conexión)
  const dbState = await initDatabase();
  users = dbState.users;
  tarotistaProfiles = dbState.tarotistaProfiles;
  videos = dbState.videos;
  liveStreams = dbState.liveStreams;
  consultations = dbState.consultations;
  reviews = dbState.reviews;
  ledger = dbState.ledger;
  reports = dbState.reports;
  withdrawals = dbState.withdrawals;

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

  app.use(express.json());

  // Middleware de persistencia automática en base de datos para todas las mutaciones
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          syncDbState();
        }
      });
    }
    next();
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // GET full app state
  app.get('/api/state', (req, res) => {
    res.json({
      users,
      tarotistaProfiles,
      videos,
      liveStreams,
      consultations,
      reviews,
      ledger,
      reports,
      withdrawals,
      coinPackages: initialCoinPackages,
      gifts: initialGifts,
    });
  });

  // Register / Update Profile & Age Verification
  app.post('/api/auth/register', (req, res) => {
    const { name, email, role, isAgeVerified, tarotistaData } = req.body;
    
    let user = users.find(u => u.email === email);
    if (!user) {
      user = {
        id: `usr_${Date.now()}`,
        name: name || 'Usuario Kabaly',
        email,
        role: role || 'cliente',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        coinsBalance: 100, // Welcome gift of 100 coins
        isAgeVerified: !!isAgeVerified,
        spentToday: 0,
        spentThisWeek: 0,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
    } else {
      user.role = role || user.role;
      user.isAgeVerified = isAgeVerified !== undefined ? isAgeVerified : user.isAgeVerified;
    }

    if (role === 'tarotista' && tarotistaData) {
      let profile = tarotistaProfiles.find(p => p.userId === user!.id);
      if (!profile) {
        profile = {
          id: `tar_${Date.now()}`,
          userId: user.id,
          professionalName: tarotistaData.professionalName || user.name,
          avatar: tarotistaData.avatar || user.avatar,
          banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
          specialties: tarotistaData.specialties || ['Tarot', 'Astrología'],
          bio: tarotistaData.bio || 'Guía espiritual apasionado por brindar claridad y luz.',
          experienceYears: Number(tarotistaData.experienceYears) || 1,
          pricePerMinCoins: Number(tarotistaData.pricePerMinCoins) || 15,
          pricePerMinEur: (Number(tarotistaData.pricePerMinCoins) || 15) / 10,
          languages: tarotistaData.languages || ['Español'],
          country: tarotistaData.country || 'España',
          isVerified: false,
          kycStatus: 'pendiente',
          stripeConnectStatus: 'pendiente',
          ratingAverage: 5.0,
          totalReviews: 0,
          totalReadings: 0,
          followersCount: 1,
          videoCount: 0,
          availabilityStatus: 'offline',
          docIdentityUrl: tarotistaData.docIdentityUrl || 'documento_identidad_subido.pdf',
          customCommissionPercentage: 20,
        };
        tarotistaProfiles.push(profile);
      }
    }

    res.json({ success: true, user, profile: tarotistaProfiles.find(p => p.userId === user!.id) });
  });

  // Like video
  app.post('/api/videos/:id/like', (req, res) => {
    const { id } = req.params;
    const video = videos.find(v => v.id === id);
    if (video) {
      if (video.isLikedByCurrentUser) {
        video.likes -= 1;
        video.isLikedByCurrentUser = false;
      } else {
        video.likes += 1;
        video.isLikedByCurrentUser = true;
      }
      return res.json({ success: true, likes: video.likes, isLikedByCurrentUser: video.isLikedByCurrentUser });
    }
    res.status(404).json({ error: 'Vídeo no encontrado' });
  });

  // Unlock Premium Video
  app.post('/api/videos/:id/unlock', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const video = videos.find(v => v.id === id);
    const user = users.find(u => u.id === userId);

    if (!video || !user) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }

    const cost = video.priceCoins || 30;
    if (user.coinsBalance < cost) {
      return res.status(400).json({ error: 'Saldo de monedas insuficiente. Recarga tu monedero.' });
    }

    user.coinsBalance -= cost;
    video.unlockedByUserIds.push(userId);

    // Ledger entry
    const tx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      userId: user.id,
      type: 'unlock_premium_video',
      amountCoins: -cost,
      amountEur: -(cost / 10),
      description: `Desbloqueo de contenido exclusivo: "${video.title.substring(0, 30)}..."`,
      referenceId: video.id,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    ledger.unshift(tx);

    res.json({ success: true, user, video });
  });

  // Create new Post / Video / Image
  app.post('/api/posts/create', (req, res) => {
    const { userId, title, mediaUrl, mediaType, category, isPremium, priceCoins, description } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const tarotistaProfile = tarotistaProfiles.find(p => p.userId === userId);

    const newPost: Video = {
      id: `vid_${Date.now()}`,
      tarotistaId: tarotistaProfile ? tarotistaProfile.id : user.id,
      tarotistaName: tarotistaProfile ? tarotistaProfile.professionalName : user.name,
      tarotistaAvatar: tarotistaProfile ? tarotistaProfile.avatar : user.avatar,
      isVerified: tarotistaProfile ? tarotistaProfile.isVerified : false,
      title: title || 'Publicación en KABALY ✨',
      videoUrl: mediaUrl,
      thumbnailUrl: mediaType === 'image' ? mediaUrl : (user.avatar || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=600'),
      category: category || 'Tarot',
      likes: 1,
      commentsCount: 0,
      sharesCount: 0,
      soundTitle: `Audio original - ${user.name}`,
      isPremium: !!isPremium,
      priceCoins: isPremium ? (priceCoins || 25) : undefined,
      unlockedByUserIds: [user.id],
      isLikedByCurrentUser: false,
      mediaType: mediaType || 'video',
      createdAt: new Date().toISOString(),
      description,
    };

    videos.unshift(newPost);
    if (tarotistaProfile) {
      tarotistaProfile.videoCount += 1;
    }

    res.json({ success: true, post: newPost });
  });

  // Update User Profile
  app.post('/api/users/update', (req, res) => {
    const { userId, name, handle, bio, avatar, coverImage } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.name = name || user.name;
    user.handle = handle || user.handle;
    user.bio = bio || user.bio;
    user.avatar = avatar || user.avatar;
    user.coverImage = coverImage || user.coverImage;

    const tarotistaProfile = tarotistaProfiles.find(p => p.userId === userId);
    if (tarotistaProfile) {
      tarotistaProfile.professionalName = user.name;
      tarotistaProfile.avatar = user.avatar;
      tarotistaProfile.bio = user.bio || tarotistaProfile.bio;
      tarotistaProfile.banner = user.coverImage || tarotistaProfile.banner;
    }

    res.json({ success: true, user });
  });

  // Join Stream Queue
  app.post('/api/streams/:id/queue', (req, res) => {
    const { id } = req.params;
    const { userId, durationMinutes, consultationType } = req.body;
    const stream = liveStreams.find(s => s.id === id);
    const user = users.find(u => u.id === userId);

    if (!stream || !user) {
      return res.status(404).json({ error: 'Stream o usuario no encontrado' });
    }

    const existingIndex = stream.queueUsers.findIndex(q => q.id === userId);
    if (existingIndex >= 0) {
      stream.queueUsers.splice(existingIndex, 1);
      return res.json({ success: true, inQueue: false, queue: stream.queueUsers });
    } else {
      stream.queueUsers.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        joinedAt: new Date().toISOString(),
        durationMinutes: durationMinutes || 10,
        consultationType: consultationType || 'chat',
      });
      return res.json({ success: true, inQueue: true, position: stream.queueUsers.length, queue: stream.queueUsers });
    }
  });

  // Send Gift in Live Stream
  app.post('/api/streams/:id/gift', (req, res) => {
    const { id } = req.params;
    const { userId, giftId } = req.body;
    const stream = liveStreams.find(s => s.id === id);
    const user = users.find(u => u.id === userId);
    const gift = initialGifts.find(g => g.id === giftId);

    if (!stream || !user || !gift) {
      return res.status(404).json({ error: 'Regalo, directo o usuario no encontrado' });
    }

    if (user.coinsBalance < gift.costCoins) {
      return res.status(400).json({ error: 'Saldo de monedas insuficiente' });
    }

    user.coinsBalance -= gift.costCoins;

    // Send gift to tarotista
    const tarotistaProfile = tarotistaProfiles.find(p => p.id === stream.tarotistaId);
    if (tarotistaProfile) {
      const tarotistaUser = users.find(u => u.id === tarotistaProfile.userId);
      if (tarotistaUser) {
        tarotistaUser.coinsBalance += gift.costCoins;
      }
    }

    // Ledger entry client
    ledger.unshift({
      id: `tx_${Date.now()}_client`,
      userId: user.id,
      type: 'gift_sent',
      amountCoins: -gift.costCoins,
      amountEur: -(gift.costCoins / 10),
      description: `Regalo ${gift.name} enviado en directo a ${stream.tarotistaName}`,
      referenceId: stream.id,
      timestamp: new Date().toISOString(),
      status: 'completed',
    });

    res.json({ success: true, user, gift, stream });
  });

  // Book 1:1 Consultation (Escrow Hold)
  app.post('/api/consultations/create', (req, res) => {
    const { clientId, tarotistaId, type, durationMinutes } = req.body;
    const client = users.find(u => u.id === clientId);
    const tarotista = tarotistaProfiles.find(p => p.id === tarotistaId);

    if (!client || !tarotista) {
      return res.status(404).json({ error: 'Cliente o Tarotista no encontrado' });
    }

    const duration = Number(durationMinutes) || 10;
    const totalCoins = duration * tarotista.pricePerMinCoins;

    if (client.coinsBalance < totalCoins) {
      return res.status(400).json({ error: `Saldo insuficiente. Esta consulta de ${duration} min requiere ${totalCoins} monedas.` });
    }

    // Check client spending limits
    if (client.spendingLimitDaily && (client.spentToday + totalCoins / 10) > client.spendingLimitDaily) {
      return res.status(400).json({ error: `Atención: Esta compra supera tu límite diario configurado de €${client.spendingLimitDaily}.` });
    }

    // Deduct coins from client to Escrow
    client.coinsBalance -= totalCoins;
    client.spentToday += totalCoins / 10;
    client.spentThisWeek += totalCoins / 10;

    const commissionPercent = tarotista.customCommissionPercentage || 20;
    const platformCommissionCoins = Math.round(totalCoins * (commissionPercent / 100));
    const tarotistaEarningsCoins = totalCoins - platformCommissionCoins;

    const consultation: Consultation = {
      id: `cons_${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      clientAvatar: client.avatar,
      tarotistaId: tarotista.id,
      tarotistaName: tarotista.professionalName,
      tarotistaAvatar: tarotista.avatar,
      type: type || 'chat',
      durationMinutes: duration,
      status: 'solicitada',
      totalCoins,
      platformCommissionCoins,
      tarotistaEarningsCoins,
      createdAt: new Date().toISOString(),
      notes: `Reserva de consulta 1:1 de ${duration} min (${type})`,
    };

    consultations.unshift(consultation);

    // Ledger escrow entry
    ledger.unshift({
      id: `tx_${Date.now()}_escrow`,
      userId: client.id,
      type: 'consultation_escrow',
      amountCoins: -totalCoins,
      amountEur: -(totalCoins / 10),
      description: `Retención en Escrow para consulta de ${duration} min con ${tarotista.professionalName}`,
      referenceId: consultation.id,
      timestamp: new Date().toISOString(),
      status: 'held_in_escrow',
    });

    res.json({ success: true, consultation, client });
  });

  // State Machine Transition for Consultation
  app.post('/api/consultations/:id/transition', (req, res) => {
    const { id } = req.params;
    const { targetStatus, reason } = req.body; // e.g. 'aceptada', 'en_curso', 'completada', 'cancelada', 'reembolsada', 'disputada'
    const consultation = consultations.find(c => c.id === id);

    if (!consultation) {
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    const previousStatus = consultation.status;
    consultation.status = targetStatus as ConsultationStatus;

    if (targetStatus === 'aceptada') {
      consultation.acceptedAt = new Date().toISOString();
      // If tarotista has an active stream, set stream mode to "Modo Pausa / Consulta Privada"
      const stream = liveStreams.find(s => s.tarotistaId === consultation.tarotistaId);
      if (stream) {
        stream.inPrivateConsultation = true;
        stream.pauseMessage = `Consulta privada 1:1 en curso. Tiempo estimado: ~${consultation.durationMinutes} min.`;
        stream.currentConsultationTimeRemainingSec = consultation.durationMinutes * 60;
      }
    } else if (targetStatus === 'completada') {
      consultation.endedAt = new Date().toISOString();
      
      // Release escrow funds to Tarotista
      const tarotista = tarotistaProfiles.find(p => p.id === consultation.tarotistaId);
      if (tarotista) {
        tarotista.totalReadings += 1;
        const tarotistaUser = users.find(u => u.id === tarotista.userId);
        if (tarotistaUser) {
          tarotistaUser.coinsBalance += consultation.tarotistaEarningsCoins;
        }
      }

      // Restore stream from pause mode if applicable
      const stream = liveStreams.find(s => s.tarotistaId === consultation.tarotistaId);
      if (stream) {
        stream.inPrivateConsultation = false;
        stream.pauseMessage = undefined;
      }

      // Update escrow ledger status
      const escrowTx = ledger.find(t => t.referenceId === consultation.id && t.type === 'consultation_escrow');
      if (escrowTx) escrowTx.status = 'completed';

      // Add payout ledger entry
      const tarotistaProfile = tarotistaProfiles.find(p => p.id === consultation.tarotistaId);
      if (tarotistaProfile) {
        ledger.unshift({
          id: `tx_${Date.now()}_payout`,
          userId: tarotistaProfile.userId,
          type: 'consultation_payout',
          amountCoins: consultation.tarotistaEarningsCoins,
          amountEur: consultation.tarotistaEarningsCoins / 10,
          description: `Ingreso por consulta completada con ${consultation.clientName} (Comisión KABALY ${tarotistaProfile.customCommissionPercentage}% descontada)`,
          referenceId: consultation.id,
          timestamp: new Date().toISOString(),
          status: 'completed',
        });
      }
    } else if (targetStatus === 'cancelada' || targetStatus === 'rechazada' || targetStatus === 'reembolsada') {
      // Refund coins to client
      const client = users.find(u => u.id === consultation.clientId);
      if (client) {
        client.coinsBalance += consultation.totalCoins;
      }

      const escrowTx = ledger.find(t => t.referenceId === consultation.id && t.type === 'consultation_escrow');
      if (escrowTx) escrowTx.status = 'reversed';

      ledger.unshift({
        id: `tx_${Date.now()}_refund`,
        userId: consultation.clientId,
        type: 'refund',
        amountCoins: consultation.totalCoins,
        amountEur: consultation.totalCoins / 10,
        description: `Reembolso íntegro por consulta ${targetStatus} (${reason || 'Tiempo expirado o cancelación'})`,
        referenceId: consultation.id,
        timestamp: new Date().toISOString(),
        status: 'completed',
      });

      // Restore stream if active
      const stream = liveStreams.find(s => s.tarotistaId === consultation.tarotistaId);
      if (stream) {
        stream.inPrivateConsultation = false;
        stream.pauseMessage = undefined;
      }
    } else if (targetStatus === 'disputada') {
      consultation.disputeReason = reason || 'Cliente reporta interrupción técnica o desacuerdo.';
    }

    res.json({ success: true, consultation, previousStatus, targetStatus });
  });

  // Topup Coin Wallet
  app.post('/api/coins/topup', (req, res) => {
    const { userId, packageId, paymentMethod } = req.body;
    const user = users.find(u => u.id === userId);
    const pack = initialCoinPackages.find(p => p.id === packageId) || initialCoinPackages[1];

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.coinsBalance += pack.coins;

    const tx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      userId: user.id,
      type: 'topup',
      amountCoins: pack.coins,
      amountEur: pack.priceEur,
      description: `Recarga de ${pack.coins} Monedas Astrales (${pack.name} vía ${paymentMethod === 'apple_pay' ? 'Apple Pay (In-App Purchase)' : 'Stripe Pasarela Directa'})`,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    ledger.unshift(tx);

    res.json({ success: true, user, package: pack, transaction: tx });
  });

  // Submit Review
  app.post('/api/reviews/create', (req, res) => {
    const { consultationId, rating, comment } = req.body;
    const consultation = consultations.find(c => c.id === consultationId);

    if (!consultation || consultation.status !== 'completada') {
      return res.status(400).json({ error: 'Solo se pueden valorar consultas completadas y verificadas.' });
    }

    const review: Review = {
      id: `rev_${Date.now()}`,
      consultationId: consultation.id,
      tarotistaId: consultation.tarotistaId,
      clientId: consultation.clientId,
      clientName: consultation.clientName,
      clientAvatar: consultation.clientAvatar,
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      comment: comment || 'Excelente atención y guía espiritual.',
      createdAt: new Date().toISOString(),
      isVerifiedPurchase: true,
    };

    reviews.unshift(review);

    // Recalculate average rating
    const tarotistaReviews = reviews.filter(r => r.tarotistaId === consultation.tarotistaId);
    const avg = tarotistaReviews.reduce((sum, r) => sum + r.rating, 0) / tarotistaReviews.length;
    const profile = tarotistaProfiles.find(p => p.id === consultation.tarotistaId);
    if (profile) {
      profile.ratingAverage = Number(avg.toFixed(1));
      profile.totalReviews = tarotistaReviews.length;
    }

    res.json({ success: true, review, profile });
  });

  // Request Withdrawal (Tarotista)
  app.post('/api/tarotistas/withdraw', (req, res) => {
    const { tarotistaProfileId, amountEur, vatNumber, bankIban } = req.body;
    const profile = tarotistaProfiles.find(p => p.id === tarotistaProfileId);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    const tarotistaUser = users.find(u => u.id === profile.userId);
    if (!tarotistaUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const eur = Number(amountEur) || 50;
    const coins = eur * 10;

    if (eur < 50) {
      return res.status(400).json({ error: 'El umbral mínimo de retiro es de 50.00 € (500 monedas).' });
    }

    if (tarotistaUser.coinsBalance < coins) {
      return res.status(400).json({ error: 'Saldo en monedas insuficiente para solicitar este retiro.' });
    }

    tarotistaUser.coinsBalance -= coins;

    const request: WithdrawalRequest = {
      id: `wdr_${Date.now()}`,
      tarotistaId: profile.id,
      tarotistaName: profile.professionalName,
      amountEur: eur,
      amountCoins: coins,
      status: 'pendiente',
      requestedAt: new Date().toISOString(),
      vatNumber: vatNumber || 'ES12345678X',
      bankIban: bankIban || 'ES91 0000 0000 0000 0000',
    };

    withdrawals.unshift(request);

    ledger.unshift({
      id: `tx_${Date.now()}_wdr`,
      userId: tarotistaUser.id,
      type: 'withdrawal',
      amountCoins: -coins,
      amountEur: -eur,
      description: `Solicitud de retiro de ganancias a cuenta bancaria (Factura/Justificante fiscal emitido)`,
      referenceId: request.id,
      timestamp: new Date().toISOString(),
      status: 'completed',
    });

    res.json({ success: true, request, tarotistaUser });
  });

  // Admin: Approve / Reject Tarotista KYC
  app.post('/api/admin/approve-tarotista', (req, res) => {
    const { profileId, approve } = req.body;
    const profile = tarotistaProfiles.find(p => p.id === profileId);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    profile.kycStatus = approve ? 'aprobado' : 'rechazado';
    profile.isVerified = approve;
    if (approve) {
      profile.stripeConnectStatus = 'conectado';
    }

    res.json({ success: true, profile });
  });

  // Admin: Resolve Dispute
  app.post('/api/admin/resolve-dispute', (req, res) => {
    const { consultationId, refundClient } = req.body;
    const consultation = consultations.find(c => c.id === consultationId);
    if (!consultation) return res.status(404).json({ error: 'Consulta no encontrada' });

    if (refundClient) {
      consultation.status = 'reembolsada';
      const client = users.find(u => u.id === consultation.clientId);
      if (client) client.coinsBalance += consultation.totalCoins;

      ledger.unshift({
        id: `tx_${Date.now()}_dispute_refund`,
        userId: consultation.clientId,
        type: 'refund',
        amountCoins: consultation.totalCoins,
        amountEur: consultation.totalCoins / 10,
        description: `Resolución de disputa por administración: Reembolso completo otorgado al cliente`,
        referenceId: consultation.id,
        timestamp: new Date().toISOString(),
        status: 'completed',
      });
    } else {
      consultation.status = 'completada';
      const tarotista = tarotistaProfiles.find(p => p.id === consultation.tarotistaId);
      if (tarotista) {
        const tarotistaUser = users.find(u => u.id === tarotista.userId);
        if (tarotistaUser) tarotistaUser.coinsBalance += consultation.tarotistaEarningsCoins;
      }
    }

    res.json({ success: true, consultation });
  });

  // Create Report
  app.post('/api/reports/create', (req, res) => {
    const { reporterId, reportedUserId, contentType, contentId, reason, description } = req.body;
    const reporter = users.find(u => u.id === reporterId);
    const reported = users.find(u => u.id === reportedUserId);

    const report: Report = {
      id: `rep_${Date.now()}`,
      reporterId: reporterId || 'anon',
      reporterName: reporter ? reporter.name : 'Usuario',
      reportedUserId: reportedUserId || 'unknown',
      reportedUserName: reported ? reported.name : 'Usuario reportado',
      contentType: contentType || 'chat',
      contentId: contentId || 'content',
      reason: reason || 'acoso',
      description: description || 'Reporte enviado desde la aplicación.',
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };

    reports.unshift(report);
    res.json({ success: true, report });
  });

  // AI Spiritual Assistant Chat (Server-side Gemini API)
  app.post('/api/ai/chat', async (req, res) => {
    const { prompt, userSign } = req.body;

    // Safety checks for crisis detection
    const lower = (prompt || '').toLowerCase();
    if (lower.includes('suicidio') || lower.includes('matarme') || lower.includes('morir') || lower.includes('autolesion')) {
      return res.json({
        response: 'Siento mucho que estés pasando por un momento de gran dolor. En KABALY nos preocupamos profundamente por tu bienestar. Te pedimos con urgencia que busques apoyo profesional y humano inmediato. Puedes comunicarte gratis y confidencialmente con el Teléfono de la Esperanza llamando al 717 003 717 o al 024 (Línea de atención a la conducta suicida en España). Tu vida tiene un valor incalculable y no estás solo/a. ❤️',
        isCrisis: true,
      });
    }

    try {
      if (process.env.GEMINI_API_KEY) {
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

        // Chance to draw a tarot card
        let cardDrawn = undefined;
        if (lower.includes('carta') || lower.includes('tirada') || lower.includes('mensaje')) {
          const cards = [
            { name: 'La Estrella (XVII)', meaning: 'Esperanza, fe, renovación e inspiración estelar.', imageUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300' },
            { name: 'El Sol (XIX)', meaning: 'Éxito, vitalidad, alegría y claridad absoluta.', imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=300' },
            { name: 'La Sacerdotisa (II)', meaning: 'Intuición profunda, misterio y conocimiento interior.', imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=300' },
            { name: 'El Mago (I)', meaning: 'Poder de manifestación, habilidades y nuevos comienzos.', imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=300' }
          ];
          cardDrawn = cards[Math.floor(Math.random() * cards.length)];
        }

        return res.json({
          response: response.text || 'Las estrellas envuelven tu inquietud en serenidad. Escucha el susurro de tu intuición.',
          cardDrawn,
        });
      }
    } catch (err) {
      console.error('Error calling Gemini API:', err);
    }

    // Fallback response if GEMINI_API_KEY is not configured or fails
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

startServer();
