export type UserRole = 'cliente' | 'tarotista' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  coinsBalance: number;
  coinsReserved?: number;
  purchasedCoinsBalance?: number;
  earningsCoinsBalance?: number;
  financialRestriction?: boolean;
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
  authorId?: string;
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
  hasUnlocked?: boolean;
  isExclusive?: boolean;
  unlockedByUserIds: string[];
  isLikedByCurrentUser?: boolean;
  isSavedByCurrentUser?: boolean;
  mediaType?: 'video' | 'image';
  createdAt?: string;
  description?: string;
  isWithdrawn?: boolean;
  withdrawnAt?: string;
  withdrawalReason?: string;
}

export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  parentId?: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
  replies?: Comment[];
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: string;
  hasViewed?: boolean;
  viewsCount?: number;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  userAvatar: string;
  hasUnseen: boolean;
  stories: Story[];
}

export interface StoryViewer {
  userId: string;
  userName: string;
  userAvatar: string;
  viewedAt: string;
}

export interface FollowUser {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  handle?: string;
  isFollowing?: boolean;
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
  | 'en_curso'
  | 'completada'
  | 'rechazada'
  | 'cancelada'
  | 'expirada'
  | 'no_show'
  | 'disputada'
  | 'reembolsada';

export interface Consultation {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  tarotistaId: string;
  tarotistaUserId?: string;
  tarotistaName: string;
  tarotistaAvatar: string;
  type: ConsultationType;
  modality?: ConsultationType;
  durationMinutes: number;
  status: ConsultationStatus;
  ratePerMinuteCoins?: number;
  totalCoins: number;
  priceCoins?: number;
  platformCommissionCoins?: number;
  tarotistaEarningsCoins?: number;
  commissionPercentage?: number;
  createdAt: string;
  requestedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  scheduledEndAt?: string;
  endedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  isSettled?: boolean;
  isRefunded?: boolean;
  roomToken?: string;
  idempotencyKey?: string;
  notes?: string;
  expiresAt?: string;
  disputeReason?: string;
}

export interface ConsultationMessage {
  id: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  cardData?: any;
  createdAt: string;
}

export interface ConsultationDispute {
  id: string;
  consultationId: string;
  clientId: string;
  tarotistaId: string;
  raisedById: string;
  reason: string;
  status: 'pending' | 'resolved_refund_full' | 'resolved_refund_partial' | 'resolved_rejected';
  refundAmountCoins: number;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ConsultationRoomCredentials {
  consultationId: string;
  roomToken: string;
  channelName: string;
  userId: string;
  userName: string;
  role: 'client' | 'tarotista';
  type: ConsultationType;
  expiresAt: string;
  iceServers?: any[];
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
  transactionId?: string;
  senderId?: string;
  senderName: string;
  senderAvatar: string;
  giftId?: string;
  giftName: string;
  giftIcon: string;
  giftCost: number;
  timestamp: string;
}

export interface PostUnlock {
  id: string;
  userId: string;
  postId: string;
  authorId: string;
  coinsPaid: number;
  priceCoins: number;
  platformFeeCoins: number;
  tarotistaEarningsCoins: number;
  unlockedAt: string;
  isRefunded?: boolean;
  refundedAt?: string;
  refundReason?: string;
  postTitle?: string;
  postThumbnail?: string;
  authorName?: string;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
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
    | 'consultation_reserve'
    | 'consultation_refund'
    | 'consultation_settlement'
    | 'gift_sent' 
    | 'gift_received' 
    | 'post_unlock_buy'
    | 'post_unlock_earn'
    | 'post_unlock_refund'
    | 'platform_fee'
    | 'refund' 
    | 'withdrawal' 
    | 'compensatory_adjustment'
    | 'unlock_premium_video';
  amountCoins: number;
  amountCents?: number;
  amountEur: number;
  balanceAfter?: number;
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
  priceCents?: number;
  currency?: string;
  badge?: string;
  icon: string;
  popular?: boolean;
  isActive?: boolean;
}

// ============================================================================
// FASE 5: MENSAJERÍA PRIVADA Y GESTIÓN DE CONTACTOS
// ============================================================================

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar: string;
  handle?: string;
  role: 'cliente' | 'tarotista' | 'admin';
  isVerified?: boolean;
}

export interface PrivateChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  clientMessageId?: string;
  attachmentId?: string;
  attachmentUrl?: string;
  attachmentType?: 'image';
  status: 'sending' | 'sent' | 'read' | 'error';
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherUser: ConversationParticipant;
  lastMessage?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    status: 'sending' | 'sent' | 'read' | 'error';
    hasAttachment?: boolean;
  };
  unreadCount: number;
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  handle?: string;
  role: string;
  blockedAt: string;
}

export interface MessageReport {
  id: string;
  reporterId: string;
  messageId: string;
  conversationId: string;
  reportedUserId: string;
  messageContent: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

// ============================================================================
// FASE 6: MONEDERO PERSISTENTE Y COMPRA DE MONEDAS VÍA STRIPE CHECKOUT
// ============================================================================

export type CoinOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';

export interface CoinOrder {
  id: string;
  orderNumber: string;
  userId: string;
  packageId: string;
  packageName: string;
  coins: number;
  amountCents: number;
  currency: string;
  status: CoinOrderStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  idempotencyKey?: string;
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  failedAt?: string;
  failureReason?: string;
}

export interface ReconciliationDiscrepancy {
  type: 'UNCREDITED_PAID_ORDER' | 'BALANCE_LEDGER_MISMATCH' | 'DUPLICATE_ORDER_CREDIT' | 'NEGATIVE_BALANCE';
  userId?: string;
  orderId?: string;
  details: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ReconciliationReport {
  timestamp: string;
  totalOrdersPaid: number;
  totalOrdersAmountCents: number;
  totalCoinsCredited: number;
  totalUsersAudited: number;
  discrepancies: ReconciliationDiscrepancy[];
  isBalanced: boolean;
}


