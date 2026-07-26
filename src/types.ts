export type UserRole = 'cliente' | 'tarotista' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  coinsBalance: number;
  isAgeVerified: boolean;
  spendingLimitDaily?: number;
  spendingLimitWeekly?: number;
  spentToday: number;
  spentThisWeek: number;
  createdAt: string;
  handle?: string;
  bio?: string;
  coverImage?: string;
  followersCount?: number;
  followingCount?: number;
  followingIds?: string[];
  savedVideoIds?: string[];
}

export type KycStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type AvailabilityStatus = 'online' | 'en_consulta' | 'vacaciones' | 'offline';

export interface TarotistaProfile {
  id: string;
  userId: string;
  professionalName: string;
  avatar: string;
  banner: string;
  specialties: string[];
  bio: string;
  experienceYears: number;
  pricePerMinCoins: number; // e.g. 20 coins = ~2.00 € / min
  pricePerMinEur: number;
  languages: string[];
  country: string;
  isVerified: boolean;
  kycStatus: KycStatus;
  stripeConnectStatus: 'conectado' | 'pendiente' | 'no_configurado';
  ratingAverage: number;
  totalReviews: number;
  totalReadings: number;
  followersCount: number;
  videoCount: number;
  availabilityStatus: AvailabilityStatus;
  docIdentityUrl?: string;
  customCommissionPercentage?: number; // e.g. 20%
}

export type Category = 
  | 'Para ti'
  | 'Siguiendo'
  | 'Tarot'
  | 'Astrología'
  | 'Horóscopo'
  | 'Runas'
  | 'Péndulo'
  | 'Numerología'
  | 'Reiki'
  | 'Lunas'
  | 'Rituales';

export interface Video {
  id: string;
  tarotistaId: string;
  tarotistaName: string;
  tarotistaAvatar: string;
  isVerified: boolean;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  category: Category;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  soundTitle: string;
  isPremium: boolean;
  priceCoins?: number;
  unlockedByUserIds: string[];
  isLikedByCurrentUser?: boolean;
  mediaType?: 'video' | 'image';
  createdAt?: string;
  description?: string;
}

export interface QueueUser {
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
  durationMinutes: number;
  consultationType: 'chat' | 'audio' | 'video';
}

export interface LiveStream {
  id: string;
  tarotistaId: string;
  tarotistaName: string;
  tarotistaAvatar: string;
  title: string;
  category: Category;
  viewersCount: number;
  isLive: boolean;
  inPrivateConsultation: boolean;
  pauseMessage?: string;
  currentConsultationTimeRemainingSec?: number;
  streamVideoUrl: string;
  queueUsers: QueueUser[];
}

export type ConsultationType = 'chat' | 'audio' | 'video';

export type ConsultationStatus = 
  | 'solicitada'
  | 'aceptada'
  | 'rechazada'
  | 'en_curso'
  | 'completada'
  | 'cancelada'
  | 'no_show'
  | 'disputada'
  | 'reembolsada';

export interface Consultation {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  tarotistaId: string;
  tarotistaName: string;
  tarotistaAvatar: string;
  type: ConsultationType;
  durationMinutes: number;
  status: ConsultationStatus;
  totalCoins: number;
  platformCommissionCoins: number;
  tarotistaEarningsCoins: number;
  createdAt: string;
  acceptedAt?: string;
  endedAt?: string;
  notes?: string;
  autoCancelTimeoutMs?: number;
  disputeReason?: string;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  costCoins: number;
  description: string;
}

export interface GiftEvent {
  id: string;
  streamId: string;
  senderName: string;
  senderAvatar: string;
  giftName: string;
  giftIcon: string;
  giftCost: number;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  channelId: string; // streamId or consultationId
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  isGift?: boolean;
  giftIcon?: string;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  type: 
    | 'topup' 
    | 'consultation_escrow' 
    | 'consultation_payout' 
    | 'gift_sent' 
    | 'gift_received' 
    | 'refund' 
    | 'withdrawal' 
    | 'unlock_premium_video';
  amountCoins: number;
  amountEur: number;
  description: string;
  referenceId?: string;
  timestamp: string;
  status: 'completed' | 'held_in_escrow' | 'reversed';
}

export interface Review {
  id: string;
  consultationId: string;
  tarotistaId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  isVerifiedPurchase: boolean;
}

export type ReportReason = 
  | 'acoso'
  | 'maldiciones_miedo'
  | 'estafa_dinero'
  | 'consejo_medico'
  | 'contenido_inapropiado'
  | 'otro';

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  contentType: 'chat' | 'video' | 'stream' | 'profile';
  contentId: string;
  reason: ReportReason;
  description: string;
  status: 'pendiente' | 'en_revision' | 'resuelto' | 'desestimado';
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  tarotistaId: string;
  tarotistaName: string;
  amountEur: number;
  amountCoins: number;
  status: 'pendiente' | 'procesado' | 'rechazado';
  requestedAt: string;
  processedAt?: string;
  vatNumber?: string;
  bankIban?: string;
}

export interface AstraAiMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  cardDrawn?: {
    name: string;
    meaning: string;
    imageUrl: string;
  };
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  priceEur: number;
  badge?: string;
  icon: string;
  popular?: boolean;
}
