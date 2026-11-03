import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Video, TarotistaProfile, CoinPackage, LedgerTransaction, WithdrawalRequest, Category, ProfileHighlight } from '../types';
import { WalletView } from './WalletView';
import { CreatePostModal } from './CreatePostModal';
import { EditPostModal } from './EditPostModal';
import { FollowsListModal } from './FollowsListModal';
import { SacredFlameIcon, CrystalBallIcon, ArcanaGrimoireIcon, SolomonStarIcon } from './EsotericIcons';

const ZODIAC_SIGNS = [
  'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
  'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
];

const MAJOR_ARCANA = [
  '0 - El Loco', 'I - El Mago', 'II - La Sacerdotisa', 'III - La Emperatriz',
  'IV - El Emperador', 'V - El Hierofante', 'VI - Los Enamorados', 'VII - El Carro',
  'VIII - La Fuerza', 'IX - El Ermitaño', 'X - La Rueda de la Fortuna', 'XI - La Justicia',
  'XII - El Colgado', 'XIII - La Muerte', 'XIV - La Templanza', 'XV - El Diablo',
  'XVI - La Torre', 'XVII - La Estrella', 'XVIII - La Luna', 'XIX - El Sol',
  'XX - El Juicio', 'XXI - El Mundo'
];

interface UserProfileViewProps {
  currentUser: User;
  videos: Video[];
  tarotistaProfiles: TarotistaProfile[];
  consultations?: any[];
  coinPackages?: CoinPackage[];
  ledger?: LedgerTransaction[];
  withdrawals?: WithdrawalRequest[];
  onTopup?: (packageId: string, paymentMethod: 'apple_pay' | 'stripe') => void;
  onRequestWithdrawal?: (amountEur: number, vatNumber: string, bankIban: string) => void;
  onOpenSpendingLimits?: () => void;
  onOpenLimitsModal?: () => void;
  onOpenAdmin?: () => void;
  onOpenWallet?: () => void;
  onRefreshUser?: () => void;
  onCreatePost?: (postData: {
    title: string;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    category: Category;
    isPremium: boolean;
    priceCoins?: number;
    description: string;
  }) => Promise<void>;
  onUpdateProfile: (updatedData: {
    name: string;
    handle: string;
    bio: string;
    avatar: string;
    coverImage: string;
    sunSign?: string;
    moonSign?: string;
    risingSign?: string;
    rulingArcana?: string;
    spiritualGift?: string;
    isPrivate?: boolean;
  }) => Promise<void>;
  onSwitchUserRole?: (role: 'cliente' | 'tarotista' | 'admin') => void;
  onSelectVideo?: (videoId: string) => void;
  onSelectConsultation?: (consultationId: string) => void;
  onViewPublicProfile?: (userId: string) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  videos,
  tarotistaProfiles,
  consultations = [],
  coinPackages = [],
  ledger = [],
  withdrawals = [],
  onTopup,
  onRequestWithdrawal,
  onOpenSpendingLimits,
  onOpenLimitsModal,
  onOpenAdmin,
  onOpenWallet,
  onRefreshUser,
  onCreatePost,
  onUpdateProfile,
  onSwitchUserRole,
  onSelectVideo,
  onSelectConsultation,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'publicaciones' | 'guardados' | 'estadisticas' | 'monedero' | 'consultas' | 'compras'>('publicaciones');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Video | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userPosts, setUserPosts] = useState<Video[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Guardados privados
  const [savedPosts, setSavedPosts] = useState<Video[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // Mis Compras de Contenido Desbloqueado (Fase 9)
  const [purchases, setPurchases] = useState<any[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [viewingMediaPurchase, setViewingMediaPurchase] = useState<any | null>(null);
  const [privateMediaUrl, setPrivateMediaUrl] = useState<string | null>(null);
  const [isLoadingPrivateMedia, setIsLoadingPrivateMedia] = useState(false);

  // Seguidores y Seguidos
  const [followsModal, setFollowsModal] = useState<{ isOpen: boolean; type: 'followers' | 'following' }>({
    isOpen: false,
    type: 'followers',
  });
  const [relationshipStats, setRelationshipStats] = useState<{ followersCount: number; followingCount: number }>({
    followersCount: currentUser.followersCount || 0,
    followingCount: currentUser.followingCount || 0,
  });

  // Cargar estadísticas de seguidores/seguidos del servidor
  const fetchRelationshipStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/relationship`);
      if (res.ok) {
        const data = await res.json();
        setRelationshipStats({
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchRelationshipStats();
  }, [fetchRelationshipStats]);

  // Cargar compras de contenido desbloqueado
  const fetchPurchases = useCallback(async () => {
    setIsLoadingPurchases(true);
    try {
      const res = await fetch('/api/users/me/purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.purchases || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPurchases(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    if (activeSubTab === 'compras') {
      fetchPurchases();
    }
  }, [activeSubTab, fetchPurchases]);

  // Cargar publicaciones guardadas privadas del usuario
  const fetchSavedPosts = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const res = await fetch('/api/posts/saved');
      if (res.ok) {
        const data = await res.json();
        setSavedPosts(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'guardados') {
      fetchSavedPosts();
    }
  }, [activeSubTab, fetchSavedPosts]);

  // Abrir reproductor de medio privado con verificación de acceso
  const handleOpenPrivateMedia = async (purchase: any) => {
    setViewingMediaPurchase(purchase);
    setIsLoadingPrivateMedia(true);
    setPrivateMediaUrl(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(purchase.postId)}/media`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No tienes acceso autorizado a este archivo privado.');
        setViewingMediaPurchase(null);
        return;
      }
      setPrivateMediaUrl(data.mediaUrl);
    } catch (e: any) {
      alert('Error de conexión al cargar medio privado');
      setViewingMediaPurchase(null);
    } finally {
      setIsLoadingPrivateMedia(false);
    }
  };

  // Quitar de guardados
  const handleUnsavePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/save`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSavedPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (err) {
      alert('Error al quitar de la colección');
    }
  };

  // Cargar publicaciones reales del usuario desde la base de datos
  const fetchUserPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const res = await fetch(`/api/posts?authorId=${currentUser.id}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setUserPosts(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

  // Consultas 1:1 (Fase 8)
  const [userConsultations, setUserConsultations] = useState<any[]>(consultations || []);
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(false);
  const [disputeModal, setDisputeModal] = useState<{ isOpen: boolean; consultationId: string }>({ isOpen: false, consultationId: '' });
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  const fetchConsultations = useCallback(async () => {
    setIsLoadingConsultations(true);
    try {
      const res = await fetch('/api/consultations');
      if (res.ok) {
        const data = await res.json();
        setUserConsultations(data.consultations || []);
      }
    } catch (e) {
      console.error('Error fetching consultations:', e);
    } finally {
      setIsLoadingConsultations(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'consultas') {
      fetchConsultations();
    }
  }, [activeSubTab, fetchConsultations]);

  const handleCancelConsultation = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta consulta? Se liberarán el 100% de las monedas retenidas.')) return;
    try {
      const res = await fetch(`/api/consultations/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelada por el cliente desde su perfil' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar');
      alert('Consulta cancelada exitosamente. Se ha devuelto la retención a tu saldo.');
      fetchConsultations();
      onRefreshUser?.();
    } catch (e: any) {
      alert(e.message || 'Error al cancelar la consulta');
    }
  };

  const handleAcceptConsultation = async (id: string) => {
    try {
      const res = await fetch(`/api/consultations/${id}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aceptar');
      alert('Consulta aceptada. Ya puedes acceder a la sala privada.');
      fetchConsultations();
    } catch (e: any) {
      alert(e.message || 'Error al aceptar la consulta');
    }
  };

  const handleRejectConsultation = async (id: string) => {
    const reason = prompt('Motivo del rechazo (se reembolsarán las monedas al cliente):', 'Horario incompatible');
    if (!reason) return;
    try {
      const res = await fetch(`/api/consultations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar');
      alert('Consulta rechazada y monedas reembolsadas al cliente.');
      fetchConsultations();
    } catch (e: any) {
      alert(e.message || 'Error al rechazar la consulta');
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim()) return;
    setIsSubmittingDispute(true);
    try {
      const res = await fetch(`/api/consultations/${disputeModal.consultationId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al abrir disputa');
      alert('Disputa registrada para revisión administrativa.');
      setDisputeModal({ isOpen: false, consultationId: '' });
      setDisputeReason('');
      fetchConsultations();
    } catch (e: any) {
      alert(e.message || 'Error al enviar disputa');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  // Edit profile state + Esoteric Triad
  const [editName, setEditName] = useState(currentUser.name);
  const [editHandle, setEditHandle] = useState(currentUser.handle || `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`);
  const [editBio, setEditBio] = useState(currentUser.bio || 'Explorador del cosmos y apasionado del Tarot y la Astrología en KABALY ✨');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editCover, setEditCover] = useState(currentUser.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200');
  const [editSunSign, setEditSunSign] = useState(currentUser.sunSign || '');
  const [editMoonSign, setEditMoonSign] = useState(currentUser.moonSign || '');
  const [editRisingSign, setEditRisingSign] = useState(currentUser.risingSign || '');
  const [editRulingArcana, setEditRulingArcana] = useState(currentUser.rulingArcana || '');
  const [editSpiritualGift, setEditSpiritualGift] = useState(currentUser.spiritualGift || '');
  const [editIsPrivate, setEditIsPrivate] = useState(!!currentUser.isPrivate);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Auras Destacadas (Highlights)
  const [highlights, setHighlights] = useState<ProfileHighlight[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<ProfileHighlight | null>(null);
  const [showCreateHighlightModal, setShowCreateHighlightModal] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState('');
  const [highlightMediaUrl, setHighlightMediaUrl] = useState('');
  const [highlightMediaType, setHighlightMediaType] = useState<'image' | 'video'>('image');
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const highlightFileRef = useRef<HTMLInputElement>(null);

  // Solicitud KYC para ser Tarotista Verificado
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycName, setKycName] = useState(currentUser.name);
  const [kycBio, setKycBio] = useState(currentUser.bio || '');
  const [kycPrice, setKycPrice] = useState(35);
  const [kycSpecialties, setKycSpecialties] = useState<Category[]>(['Tarot', 'Astrología']);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/highlights`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(data.highlights || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  // Subir archivo desde el dispositivo para Avatar, Portada o Aura Destacada
  const uploadDeviceFile = async (file: File): Promise<{ url: string; mediaType: 'image' | 'video' } | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al subir archivo');
        return null;
      }
      return { url: data.url, mediaType: data.mediaType || 'image' };
    } catch {
      alert('Error de conexión al subir el archivo');
      return null;
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    const uploaded = await uploadDeviceFile(file);
    if (uploaded) setEditAvatar(uploaded.url);
    setIsUploadingAvatar(false);
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    const uploaded = await uploadDeviceFile(file);
    if (uploaded) setEditCover(uploaded.url);
    setIsUploadingCover(false);
  };

  const handleHighlightFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHighlight(true);
    const uploaded = await uploadDeviceFile(file);
    if (uploaded) {
      setHighlightMediaUrl(uploaded.url);
      setHighlightMediaType(uploaded.mediaType);
    }
    setIsUploadingHighlight(false);
  };

  const handleCreateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightTitle.trim() || !highlightMediaUrl.trim()) return;
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: highlightTitle.trim(),
          coverUrl: highlightMediaUrl.trim(),
          mediaUrl: highlightMediaUrl.trim(),
          mediaType: highlightMediaType,
        }),
      });
      if (res.ok) {
        setHighlightTitle('');
        setHighlightMediaUrl('');
        setShowCreateHighlightModal(false);
        fetchHighlights();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHighlight = async (id: string) => {
    try {
      const res = await fetch(`/api/highlights/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setHighlights(prev => prev.filter(h => h.id !== id));
        setActiveHighlight(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePinPost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/pin`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserPosts(prev =>
          prev
            .map(p => (p.id === postId ? { ...p, isPinned: data.isPinned } : p))
            .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned))
        );
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingKyc(true);
    try {
      const res = await fetch('/api/tarotistas/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalName: kycName,
          specialties: kycSpecialties,
          bio: kycBio,
          pricePerMinCoins: kycPrice,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Solicitud KYC enviada correctamente.');
        setShowKycModal(false);
        onRefreshUser?.();
      } else {
        alert(data.error || 'No se pudo enviar la solicitud');
      }
    } catch {
      alert('Error de conexión al enviar solicitud KYC');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Filter user's uploaded videos/images
  const userTarotistaProfile = tarotistaProfiles.find(p => p.userId === currentUser.id);
  const rawPosts = userPosts.length > 0 ? userPosts : videos.filter(v => 
    v.tarotistaId === currentUser.id || 
    (userTarotistaProfile && v.tarotistaId === userTarotistaProfile.id)
  );
  const myPosts = [...rawPosts].sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      name: editName,
      handle: editHandle,
      bio: editBio,
      avatar: editAvatar,
      coverImage: editCover,
      sunSign: editSunSign,
      moonSign: editMoonSign,
      risingSign: editRisingSign,
      rulingArcana: editRulingArcana,
      spiritualGift: editSpiritualGift,
      isPrivate: editIsPrivate,
    });
    setShowEditProfileModal(false);
  };

  // Estadísticas del Creador ("Visión del Oráculo")
  const totalLikesReceived = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalCommentsReceived = myPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const estimatedReach = totalLikesReceived * 14 + totalCommentsReceived * 28 + relationshipStats.followersCount * 12 + myPosts.length * 45;
  const topPerformingPosts = [...myPosts].sort((a, b) => (b.likes + b.commentsCount * 2) - (a.likes + a.commentsCount * 2)).slice(0, 3);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
      {/* Profile Banner & Header Card */}
      <div className="glass-card rounded-3xl border border-[#D4AF37]/30 overflow-hidden relative shadow-2xl">
        {/* Banner Cover Image */}
        <div className="h-44 md:h-52 w-full relative bg-[#1A1026]">
          <img 
            src={currentUser.coverImage || editCover} 
            alt="Cover" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-black/30" />
          
          <button
            onClick={() => setShowEditProfileModal(true)}
            className="absolute top-3 right-3 bg-[#0B0911]/70 backdrop-blur-md border border-[#D4AF37]/40 text-[#D4AF37] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-[#5A2D82] transition-all"
          >
            <span className="material-symbols-outlined text-sm">photo_camera</span>
            <span className="hidden sm:inline">Editar Portada</span>
          </button>
        </div>

        {/* Profile Info Overlay */}
        <div className="px-6 pb-6 pt-0 relative -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#D4AF37] overflow-hidden bg-[#1A1026] p-0.5 gold-glow shadow-2xl">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
              </div>
              <button 
                onClick={() => setShowEditProfileModal(true)}
                className="absolute bottom-1 right-1 bg-[#D4AF37] text-[#0B0911] rounded-full p-2 border-2 border-[#0B0911] hover:scale-110 transition-transform"
              >
                <span className="material-symbols-outlined text-xs font-bold">edit</span>
              </button>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Publicar Contenido</span>
              </button>

              <button
                onClick={() => setShowEditProfileModal(true)}
                className="bg-[#2E1B47] text-[#F7E7C1] border border-[#D4AF37]/40 px-4 py-2.5 rounded-full text-xs font-bold hover:border-[#D4AF37] transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                <span>Editar</span>
              </button>

              <button
                onClick={onOpenSpendingLimits || onOpenLimitsModal}
                className="bg-[#1A1026] text-[#D4AF37] border border-[#D4AF37]/30 px-3.5 py-2.5 rounded-full text-xs font-bold hover:bg-[#5A2D82]/50 transition-all flex items-center gap-1"
                title="Ajustes de autorregulación y límites de gasto"
              >
                <span className="material-symbols-outlined text-sm">shield</span>
                <span className="hidden md:inline">Límites</span>
              </button>
            </div>
          </div>

          {/* User Bio Details */}
          <div className="mt-4 text-center sm:text-left space-y-2.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-playfair text-2xl font-bold text-[#F7E7C1]">
                {currentUser.name}
              </h2>
              <span className="text-xs text-[#D4AF37] font-mono">
                {currentUser.handle || `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`}
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                currentUser.role === 'tarotista'
                  ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]'
                  : 'bg-[#2E1B47] text-[#A7A7A7]'
              }`}>
                {currentUser.role === 'tarotista' ? '🔮 Vidente Verificado' : '✨ Buscador Astral'}
              </span>
            </div>

            <p className="text-xs text-[#A7A7A7] max-w-xl leading-relaxed">
              {currentUser.bio || 'Explorador del cosmos, lecturas de tarot, carta astral y revelaciones en KABALY.'}
            </p>

            {/* Tríada Astral e Identidad Esotérica */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
              {currentUser.sunSign && (
                <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[10px] text-[#F7E7C1] flex items-center gap-1">
                  <span className="text-[#D4AF37]">☉</span> Sol en <strong>{currentUser.sunSign}</strong>
                </span>
              )}
              {currentUser.moonSign && (
                <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[10px] text-[#F7E7C1] flex items-center gap-1">
                  <span className="text-[#D4AF37]">☽</span> Luna en <strong>{currentUser.moonSign}</strong>
                </span>
              )}
              {currentUser.risingSign && (
                <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[10px] text-[#F7E7C1] flex items-center gap-1">
                  <span className="text-[#D4AF37]">↑</span> Ascendente <strong>{currentUser.risingSign}</strong>
                </span>
              )}
              {currentUser.rulingArcana && (
                <span className="px-2.5 py-1 rounded-full bg-[#2E1B47]/60 border border-[#D4AF37]/40 text-[10px] text-[#D4AF37] font-bold">
                  🎴 {currentUser.rulingArcana}
                </span>
              )}
              {currentUser.spiritualGift && (
                <span className="px-2.5 py-1 rounded-full bg-[#0B0911]/80 border border-white/10 text-[10px] text-[#A09BAE]">
                  ✦ {currentUser.spiritualGift}
                </span>
              )}
              {!currentUser.sunSign && !currentUser.rulingArcana && (
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  className="px-3 py-1 rounded-full bg-[#1A1026] border border-dashed border-[#D4AF37]/40 text-[10px] text-[#D4AF37] hover:border-[#D4AF37] transition-all"
                >
                  + Configurar mi Tríada Astral (☉ ☽ ↑) y Arcano Regente
                </button>
              )}
            </div>

            {/* Role switch CTA -> Real KYC Application */}
            {currentUser.role === 'cliente' && (
              <div className="pt-2">
                <button
                  onClick={() => setShowKycModal(true)}
                  className="text-xs text-[#D4AF37] hover:underline font-bold flex items-center gap-1 justify-center sm:justify-start"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  ¿Eres profesional del Tarot? Solicita tu perfil verificado KYC aquí ➔
                </button>
              </div>
            )}
          </div>

          {/* Auras Destacadas (Instagram-style Highlights Row) */}
          <div className="pt-5 mt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/80">
                ✦ Auras Destacadas Permanentes
              </span>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
              {/* Botón + Nueva Aura */}
              <button
                onClick={() => setShowCreateHighlightModal(true)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#D4AF37]/50 bg-[#1A1026]/80 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37] group-hover:scale-105 transition-all">
                  <span className="material-symbols-outlined text-xl">add</span>
                </div>
                <span className="text-[10px] text-[#D4AF37] font-semibold">Nueva Aura</span>
              </button>

              {highlights.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveHighlight(h)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group"
                >
                  <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#D4AF37] via-[#9D4EDD] to-[#F7E7C1] group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#0B0911] p-[1.5px]">
                      <img src={h.coverUrl} alt={h.title} className="w-full h-full object-cover rounded-full" />
                    </div>
                  </div>
                  <span className="text-[10px] text-[#F7E7C1]/85 font-medium max-w-[68px] truncate group-hover:text-[#D4AF37]">
                    {h.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Social Stats Row */}
          <div className="grid grid-cols-4 gap-2 pt-5 mt-4 border-t border-[#D4AF37]/20 text-center">
            <div 
              onClick={() => setFollowsModal({ isOpen: true, type: 'followers' })}
              className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20 cursor-pointer hover:border-[#D4AF37] transition-all group"
            >
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block group-hover:scale-105 transition-transform">
                {relationshipStats.followersCount}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider group-hover:text-[#F7E7C1]">Seguidores</span>
            </div>

            <div 
              onClick={() => setFollowsModal({ isOpen: true, type: 'following' })}
              className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20 cursor-pointer hover:border-[#D4AF37] transition-all group"
            >
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block group-hover:scale-105 transition-transform">
                {relationshipStats.followingCount}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider group-hover:text-[#F7E7C1]">Siguiendo</span>
            </div>

            <div 
              onClick={() => setActiveSubTab('publicaciones')}
              className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20 cursor-pointer hover:border-[#D4AF37] transition-all"
            >
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block">
                {myPosts.length}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Visiones</span>
            </div>

            <div 
              onClick={() => setActiveSubTab('monedero')}
              className="bg-gradient-to-br from-[#2E1B47] to-[#5A2D82] p-2.5 rounded-2xl border border-[#D4AF37]/40 cursor-pointer hover:scale-105 transition-all gold-glow"
            >
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm filled text-[#D4AF37]">stars</span>
                {currentUser.coinsBalance}
              </span>
              <span className="text-[10px] text-[#F7E7C1] uppercase font-bold tracking-wider">Monedas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#D4AF37]/20 gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('publicaciones')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'publicaciones'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <SolomonStarIcon className="w-4 h-4" />
          <span>Mis Publicaciones ({myPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guardados')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'guardados'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <ArcanaGrimoireIcon className="w-4 h-4" filled={activeSubTab === 'guardados'} />
          <span>Grimorio Guardado ({savedPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('estadisticas')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'estadisticas'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <CrystalBallIcon className="w-4 h-4" />
          <span>Visión del Oráculo</span>
        </button>

        <button
          onClick={() => setActiveSubTab('monedero')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'monedero'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">account_balance_wallet</span>
          <span>Monedero Astral</span>
        </button>

        <button
          onClick={() => setActiveSubTab('consultas')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'consultas'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">video_camera_front</span>
          <span>Consultas 1:1 ({userConsultations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('compras')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
            activeSubTab === 'compras'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">shopping_bag</span>
          <span>Mis Compras ({purchases.length})</span>
        </button>
      </div>

      {/* SUB-VIEW 1: My Posts Grid */}
      {activeSubTab === 'publicaciones' && (
        <div>
          {myPosts.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#2E1B47] text-[#D4AF37] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
              </div>
              <h3 className="font-playfair text-lg text-[#F7E7C1] font-bold">Aún no has compartido publicaciones</h3>
              <p className="text-xs text-[#A7A7A7] max-w-sm mx-auto">
                Comparte tus tiradas de cartas, predicciones astrológicas o fotos místicas con la comunidad.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-6 py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
              >
                Crear Mi Primera Publicación
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {myPosts.map((post) => (
                <div 
                  key={post.id} 
                  className={`bg-[#1A1026] border rounded-2xl overflow-hidden group transition-all relative flex flex-col justify-between ${
                    post.isPinned ? 'border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.25)]' : 'border-[#D4AF37]/30 hover:border-[#D4AF37]'
                  }`}
                >
                  <div className="relative aspect-[3/4] bg-black">
                    {post.mediaType === 'image' ? (
                      <img src={post.videoUrl || post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.videoUrl} poster={post.thumbnailUrl} className="w-full h-full object-cover" />
                    )}
                    
                    {/* Pinned or Category Pill */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {post.isPinned && (
                        <span className="bg-[#D4AF37] text-[#0B0911] text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                          ✦ FIJADO
                        </span>
                      )}
                      <span className="bg-[#0B0911]/80 backdrop-blur-md text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37]/30 w-fit">
                        {post.category}
                      </span>
                    </div>

                    {/* Premium Lock Badge */}
                    {post.isPremium && (
                      <span className="absolute top-2 right-2 bg-[#5A2D82] text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37] flex items-center gap-0.5 gold-glow">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                        {post.priceCoins} 🪙
                      </span>
                    )}

                    {/* Likes & Views Overlay with Esoteric Icons */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="flex items-center gap-1 text-[#D4AF37]">
                        <SacredFlameIcon className="w-3.5 h-3.5" filled />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-[#F7E7C1]/80">
                        <CrystalBallIcon className="w-3.5 h-3.5" />
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex items-center justify-between border-t border-[#D4AF37]/10">
                    <div className="flex-1 pr-2 min-w-0">
                      <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-1">{post.title}</h4>
                      {post.description && <p className="text-[10px] text-[#A7A7A7] line-clamp-1 italic">{post.description}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => handleTogglePinPost(e, post.id)}
                        className={`p-1 rounded-full transition-colors ${
                          post.isPinned
                            ? 'bg-[#D4AF37] text-[#0B0911]'
                            : 'hover:bg-[#5A2D82] text-[#A7A7A7] hover:text-[#D4AF37]'
                        }`}
                        title={post.isPinned ? 'Desfijar del altar' : 'Fijar en mi perfil (máx. 3)'}
                      >
                        <span className="text-xs font-bold leading-none px-0.5">✦</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPost(post);
                        }}
                        className="p-1 rounded-full hover:bg-[#5A2D82] text-[#D4AF37] transition-colors"
                        title="Editar o retirar publicación"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/?post=${post.id}`;
                          navigator.clipboard?.writeText(url);
                          alert('Enlace copiado al portapapeles');
                        }}
                        className="p-1 rounded-full hover:bg-[#5A2D82] text-[#A7A7A7] hover:text-[#F7E7C1] transition-colors"
                        title="Compartir enlace"
                      >
                        <span className="material-symbols-outlined text-sm">share</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: Real Private Saved Posts (Guardados) */}
      {activeSubTab === 'guardados' && (
        <div>
          {isLoadingSaved ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#D4AF37]">
              <span className="material-symbols-outlined text-3xl animate-spin">auto_awesome</span>
              <p className="text-xs text-[#A7A7A7]">Recuperando tu santuario de publicaciones guardadas...</p>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#D4AF37]">bookmark_border</span>
              <h4 className="font-cinzel text-sm font-bold text-[#F7E7C1]">Tu colección sagrada está vacía</h4>
              <p className="text-xs text-[#A7A7A7] max-w-sm mx-auto">
                Guarda publicaciones en el feed tocando el icono de marcapáginas. Solo tú puedes ver las publicaciones que guardes aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {savedPosts.map((post) => (
                <div 
                  key={post.id} 
                  onClick={() => onSelectVideo?.(post.id)}
                  className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-2xl overflow-hidden group hover:border-[#D4AF37] transition-all relative flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative aspect-[3/4] bg-black">
                    {post.mediaType === 'image' ? (
                      <img src={post.videoUrl || post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.videoUrl} poster={post.thumbnailUrl} className="w-full h-full object-cover" />
                    )}

                    <span className="absolute top-2 left-2 bg-[#0B0911]/80 backdrop-blur-md text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
                      {post.category}
                    </span>

                    {/* Botón rápido para desguardar */}
                    <button
                      onClick={(e) => handleUnsavePost(e, post.id)}
                      className="absolute top-2 right-2 bg-[#0B0911]/80 hover:bg-red-900/80 text-[#D4AF37] hover:text-red-300 p-1.5 rounded-full border border-[#D4AF37]/30 transition-all shadow-md"
                      title="Quitar de mi colección guardada"
                    >
                      <span className="material-symbols-outlined text-xs">bookmark_remove</span>
                    </button>

                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-red-500 filled">favorite</span>
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-[#A7A7A7]">
                        <span className="material-symbols-outlined text-xs">chat</span>
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-1">{post.title}</h4>
                    <span className="text-[10px] text-[#D4AF37] block mt-0.5 truncate">{post.tarotistaName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Lista de Seguidores y Seguidos */}
      <FollowsListModal
        isOpen={followsModal.isOpen}
        userId={currentUser.id}
        type={followsModal.type}
        currentUser={currentUser}
        onClose={() => {
          setFollowsModal(prev => ({ ...prev, isOpen: false }));
          fetchRelationshipStats();
        }}
      />

      {/* SUB-VIEW 2.5: Visión del Oráculo (Creator Studio & Estadísticas) */}
      {activeSubTab === 'estadisticas' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-[#1A1026] via-[#120D1D] to-[#2E1B47]/40 border border-[#D4AF37]/35 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  ✦ Creator Studio Esotérico
                </span>
                <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">
                  Visión del Oráculo · Rendimiento de tu Altar
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#0B0911]/80 border border-[#D4AF37]/30 text-[10px] text-[#D4AF37] font-bold">
                {currentUser.isPrivate ? '🔒 Santuario Privado' : '🌍 Altar Público'}
              </span>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0B0911]/70 border border-[#D4AF37]/25 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-[#D4AF37]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#A09BAE]">Alcance Cósmico</span>
                  <CrystalBallIcon className="w-4 h-4" />
                </div>
                <p className="font-cinzel text-2xl font-bold text-[#F7E7C1]">{estimatedReach.toLocaleString()}</p>
                <span className="text-[10px] text-emerald-400 block">✦ Almas impactadas</span>
              </div>

              <div className="bg-[#0B0911]/70 border border-[#D4AF37]/25 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-[#D4AF37]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#A09BAE]">Llamas Sagradas</span>
                  <SacredFlameIcon className="w-4 h-4" filled />
                </div>
                <p className="font-cinzel text-2xl font-bold text-[#D4AF37]">{totalLikesReceived.toLocaleString()}</p>
                <span className="text-[10px] text-[#A09BAE] block">En {myPosts.length} visiones</span>
              </div>

              <div className="bg-[#0B0911]/70 border border-[#D4AF37]/25 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-[#D4AF37]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#A09BAE]">Voces del Oráculo</span>
                  <SolomonStarIcon className="w-4 h-4" />
                </div>
                <p className="font-cinzel text-2xl font-bold text-[#F7E7C1]">{totalCommentsReceived.toLocaleString()}</p>
                <span className="text-[10px] text-[#A09BAE] block">Comentarios recibidos</span>
              </div>

              <div className="bg-[#0B0911]/70 border border-[#D4AF37]/25 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-[#D4AF37]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#A09BAE]">Comunidad</span>
                  <ArcanaGrimoireIcon className="w-4 h-4" filled />
                </div>
                <p className="font-cinzel text-2xl font-bold text-[#D4AF37]">{relationshipStats.followersCount}</p>
                <span className="text-[10px] text-[#A09BAE] block">Seguidores astrales</span>
              </div>
            </div>

            {/* Top Performing Posts */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                🔥 Visiones con Mayor Resonancia Energética
              </h4>
              {topPerformingPosts.length === 0 ? (
                <p className="text-xs text-[#A09BAE] italic">
                  Publica tu primera visión en el feed para comenzar a medir la resonancia de tu comunidad.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {topPerformingPosts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="bg-[#0B0911]/80 border border-white/10 rounded-2xl p-3 flex items-center gap-3"
                    >
                      <div className="w-12 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-[#D4AF37]/30 relative">
                        <img
                          src={post.thumbnailUrl || post.videoUrl}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-0.5 left-0.5 bg-[#D4AF37] text-[#0B0911] text-[8px] font-bold px-1 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#F7E7C1] truncate">{post.title}</p>
                        <span className="text-[10px] text-[#D4AF37] block">{post.category}</span>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-[#A09BAE]">
                          <span className="flex items-center gap-0.5 text-[#D4AF37]">
                            ✦ {post.likes}
                          </span>
                          <span>🔮 {post.commentsCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: Embedded Wallet View */}
      {activeSubTab === 'monedero' && (
        <WalletView
          currentUser={currentUser}
          onOpenSpendingLimits={onOpenSpendingLimits || onOpenLimitsModal || (() => {})}
          onRefreshUser={onRefreshUser}
        />
      )}

      {/* SUB-VIEW 4: Consultas 1:1 (Fase 8) */}
      {activeSubTab === 'consultas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">history_edu</span>
              Historial y Sesiones Privadas
            </h3>
            <button
              onClick={fetchConsultations}
              disabled={isLoadingConsultations}
              className="text-xs text-[#D4AF37] hover:text-[#F7E7C1] flex items-center gap-1 p-1"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingConsultations ? 'animate-spin' : ''}`}>sync</span>
              Actualizar
            </button>
          </div>

          {isLoadingConsultations ? (
            <div className="text-center py-12 text-[#A7A7A7]">Cargando tus consultas privadas...</div>
          ) : userConsultations.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-3">
              <span className="material-symbols-outlined text-4xl text-[#D4AF37]/60">event_busy</span>
              <h4 className="font-playfair text-base text-[#F7E7C1]">No tienes consultas registradas</h4>
              <p className="text-xs text-[#A7A7A7] max-w-sm mx-auto">
                Puedes contratar una consulta privada (chat, audio o vídeo) visitando el perfil de un tarotista verificado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userConsultations.map((c) => {
                const isClient = c.clientId === currentUser.id;
                const isTarotista = c.tarotistaUserId === currentUser.id || c.tarotistaId === currentUser.id;
                const otherPartyName = isClient ? (c.tarotistaName || 'Tarotista') : (c.clientName || 'Cliente');
                
                const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
                  solicitada: { label: 'Solicitud Pendiente', color: 'bg-amber-950/60 text-amber-300 border-amber-600/40', icon: 'schedule' },
                  aceptada: { label: 'Aceptada (Lista)', color: 'bg-blue-950/60 text-blue-300 border-blue-600/40', icon: 'check_circle' },
                  en_curso: { label: '¡En Curso!', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500 animate-pulse', icon: 'sensors' },
                  completada: { label: 'Completada', color: 'bg-purple-950/60 text-purple-300 border-[#D4AF37]/50', icon: 'task_alt' },
                  rechazada: { label: 'Rechazada (Reembolsada)', color: 'bg-red-950/50 text-red-300 border-red-700/40', icon: 'cancel' },
                  cancelada: { label: 'Cancelada (Reembolsada)', color: 'bg-neutral-900 text-neutral-400 border-neutral-700', icon: 'close' },
                  expirada: { label: 'Expirada (Reembolsada)', color: 'bg-neutral-900 text-neutral-400 border-neutral-700', icon: 'timer_off' },
                  disputada: { label: 'En Disputa', color: 'bg-orange-950/60 text-orange-300 border-orange-600', icon: 'gavel' },
                  reembolsada: { label: 'Reembolsada', color: 'bg-teal-950/60 text-teal-300 border-teal-500', icon: 'currency_exchange' },
                };

                const cfg = statusConfig[c.status] || { label: c.status, color: 'bg-black text-gray-400 border-gray-700', icon: 'info' };

                return (
                  <div
                    key={c.id}
                    className="bg-[#1A1026]/80 border border-[#D4AF37]/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-[#D4AF37]/70 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                          <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-[#D4AF37] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs filled text-[#D4AF37]">stars</span>
                          {c.priceCoins} monedas
                        </span>
                      </div>

                      <div>
                        <h4 className="font-cinzel text-sm font-bold text-[#F7E7C1] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#D4AF37]">
                            {c.modality === 'video' ? 'videocam' : c.modality === 'audio' ? 'call' : 'chat'}
                          </span>
                          Consulta de {c.modality.toUpperCase()} con {otherPartyName}
                        </h4>
                        <p className="text-[11px] text-[#A7A7A7] mt-0.5">
                          Duración contratada: <strong className="text-white">{c.durationMinutes} minutos</strong>
                        </p>
                        <p className="text-[10px] text-[#A7A7A7]">
                          Fecha: {new Date(c.createdAt || c.requestedAt || Date.now()).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons based on status & role */}
                    <div className="pt-2 border-t border-[#D4AF37]/15 flex flex-wrap gap-2 items-center justify-between">
                      {/* En curso / Aceptada / Completada -> Entrar a la Sala */}
                      {(c.status === 'en_curso' || c.status === 'aceptada' || c.status === 'completada') && onSelectConsultation && (
                        <button
                          onClick={() => onSelectConsultation(c.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            c.status === 'en_curso'
                              ? 'bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] gold-glow animate-pulse'
                              : 'bg-[#5A2D82] hover:bg-[#6f38a0] text-[#F7E7C1] border border-[#D4AF37]/40'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">meeting_room</span>
                          {c.status === 'en_curso' ? 'Entrar a la Sala' : 'Ver Sala y Mensajes'}
                        </button>
                      )}

                      {/* Tarotista actions on solicitada */}
                      {c.status === 'solicitada' && isTarotista && (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => handleAcceptConsultation(c.id)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">check</span> Aceptar
                          </button>
                          <button
                            onClick={() => handleRejectConsultation(c.id)}
                            className="flex-1 bg-red-800 hover:bg-red-700 text-white font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">close</span> Rechazar
                          </button>
                        </div>
                      )}

                      {/* Client cancel on solicitada */}
                      {c.status === 'solicitada' && isClient && (
                        <button
                          onClick={() => handleCancelConsultation(c.id)}
                          className="w-full bg-[#1A1026] hover:bg-red-950/60 text-red-300 border border-red-700/50 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">cancel</span> Cancelar y liberar monedas
                        </button>
                      )}

                      {/* Open dispute on completada */}
                      {c.status === 'completada' && !c.isRefunded && (
                        <button
                          onClick={() => setDisputeModal({ isOpen: true, consultationId: c.id })}
                          className="text-[10px] text-[#A7A7A7] hover:text-orange-300 underline flex items-center gap-0.5 ml-auto"
                        >
                          <span className="material-symbols-outlined text-xs">flag</span> Abrir Disputa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal de Disputa */}
          {disputeModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1A1026] border border-orange-500/50 max-w-md w-full rounded-2xl p-6 space-y-4">
                <h4 className="font-cinzel text-base font-bold text-orange-300 flex items-center gap-2">
                  <span className="material-symbols-outlined">gavel</span>
                  Abrir Disputa de Consulta
                </h4>
                <p className="text-xs text-[#A7A7A7]">
                  Describe detalladamente el motivo de la reclamación (ej. problemas técnicos de conexión, ausencia del profesional o interrupción anticipada).
                </p>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Detalles de la incidencia..."
                  rows={4}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-orange-400 focus:outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setDisputeModal({ isOpen: false, consultationId: '' });
                      setDisputeReason('');
                    }}
                    className="px-4 py-2 text-xs text-[#A7A7A7] hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitDispute}
                    disabled={isSubmittingDispute || !disputeReason.trim()}
                    className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                  >
                    {isSubmittingDispute ? 'Enviando...' : 'Enviar a Revisión'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 5: Mis Compras Privadas (Fase 9) */}
      {activeSubTab === 'compras' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Banner de Política de Retirada y Garantía de Acceso */}
          <div className="bg-[#1A1026]/90 border border-[#D4AF37]/30 rounded-2xl p-4 text-xs gold-glow space-y-2">
            <div className="flex items-center gap-2 text-[#D4AF37] font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">verified_user</span>
              <span>Garantía de Acceso y Política de Retiradas (Pendiente de aprobación en producción)</span>
            </div>
            <p className="text-[#A7A7A7] leading-relaxed">
              Las publicaciones desbloqueadas quedan vinculadas de forma permanente a tu cuenta. Si el autor retira una publicación o moderación la suspende, los compradores autorizados conservan el derecho de visualización privada o pueden solicitar un reembolso compensatorio vinculado a la operación contable original.
            </p>
          </div>

          {isLoadingPurchases ? (
            <div className="text-center py-12 text-[#D4AF37] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span className="text-xs">Cargando tus compras celestiales...</span>
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-14 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#2E1B47] text-[#D4AF37] flex items-center justify-center mx-auto gold-glow">
                <span className="material-symbols-outlined text-3xl">lock_open</span>
              </div>
              <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">No tienes publicaciones compradas</h3>
              <p className="text-xs text-[#A7A7A7] max-w-sm mx-auto">
                Cuando desbloquees publicaciones exclusivas de tarotistas mediante monedas, aparecerán aquí con acceso permanente para verlas en cualquier momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {purchases.map((item) => (
                <div
                  key={item.id}
                  className="glass-card rounded-2xl border border-[#D4AF37]/30 p-4 flex flex-col justify-between gap-3 hover:border-[#D4AF37] transition-all group"
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-24 rounded-xl overflow-hidden bg-black/60 flex-shrink-0 relative border border-[#D4AF37]/20">
                      <img
                        src={item.postThumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=200'}
                        alt={item.postTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[8px] font-bold text-[#D4AF37]">
                        {item.postMediaType === 'image' ? 'FOTO' : 'VÍDEO'}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            item.isRefunded
                              ? 'bg-red-950/60 border-red-500/40 text-red-300'
                              : item.isWithdrawn
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          }`}>
                            {item.isRefunded ? 'Reembolsado' : item.isWithdrawn ? 'Retirado por Autor' : 'Desbloqueado'}
                          </span>
                          <span className="text-[10px] text-[#A7A7A7]">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-2">
                          {item.postTitle}
                        </h4>
                        <span className="text-[10px] text-[#A7A7A7] block mt-0.5">
                          Por {item.tarotistaName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-[10px] text-[#A7A7A7]">Pagado:</span>
                        <span className="font-bold text-[#D4AF37] flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs filled">stars</span>
                          {item.priceCoins} 🪙
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.isWithdrawn && item.withdrawalReason && (
                    <p className="text-[10px] text-amber-300/80 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20 italic">
                      Motivo de retirada: {item.withdrawalReason}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenPrivateMedia(item)}
                    className="w-full bg-[#5A2D82] hover:bg-[#6f38a0] text-[#F7E7C1] border border-[#D4AF37]/40 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all gold-glow"
                  >
                    <span className="material-symbols-outlined text-sm">play_circle</span>
                    <span>Ver Contenido Sagrado</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Reproductor de Medio Privado Seguro */}
      {viewingMediaPurchase && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-5 max-w-lg w-full gold-glow text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                  Contenido Privado Desbloqueado
                </span>
                <h3 className="font-cinzel text-sm font-bold text-[#F7E7C1]">
                  {viewingMediaPurchase.postTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingMediaPurchase(null);
                  setPrivateMediaUrl(null);
                }}
                className="text-[#A7A7A7] hover:text-[#F7E7C1]"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="w-full rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center relative border border-[#D4AF37]/30">
              {isLoadingPrivateMedia ? (
                <div className="flex flex-col items-center gap-2 text-[#D4AF37]">
                  <span className="material-symbols-outlined text-3xl animate-spin">refresh</span>
                  <span className="text-xs">Verificando permisos y cargando archivo privado...</span>
                </div>
              ) : privateMediaUrl ? (
                viewingMediaPurchase.postMediaType === 'image' ? (
                  <img
                    src={privateMediaUrl}
                    alt={viewingMediaPurchase.postTitle}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={privateMediaUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="text-center p-4 text-xs text-red-400">
                  No se pudo cargar el archivo privado.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-[#A7A7A7] pt-1">
              <span>Autor: <strong className="text-[#F7E7C1]">{viewingMediaPurchase.tarotistaName}</strong></span>
              <span>Protegido con control de acceso por sesión</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Crear Publicación con subida multimedia validada */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={(newPost) => {
          setUserPosts(prev => [newPost, ...prev]);
          setShowCreateModal(false);
          setActiveSubTab('publicaciones');
        }}
      />

      {/* MODAL: Editar / Retirar Publicación */}
      <EditPostModal
        post={editingPost}
        isOpen={!!editingPost}
        onClose={() => setEditingPost(null)}
        onPostUpdated={(updated) => {
          setUserPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
        }}
        onPostDeleted={(deletedId) => {
          setUserPosts(prev => prev.filter(p => p.id !== deletedId));
        }}
      />

      {/* MODAL 2: Edit Profile Modal with Real Device Upload & Esoteric Triad */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-lg w-full gold-glow text-left space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-playfair text-lg font-bold text-[#F7E7C1] flex items-center gap-2">
                <SolomonStarIcon className="w-5 h-5 text-[#D4AF37]" />
                <span>Editar Perfil e Identidad Astral</span>
              </h3>
              <button onClick={() => setShowEditProfileModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs text-[#F7E7C1]">
              {/* Avatar & Portada con Subida Real desde Dispositivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0B0911]/70 p-3 rounded-2xl border border-[#D4AF37]/20">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider block">
                    Foto de Perfil (Avatar)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <img
                      src={editAvatar}
                      alt="Preview"
                      className="w-12 h-12 rounded-full object-cover border border-[#D4AF37] shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="w-full bg-[#2E1B47] hover:bg-[#5A2D82] border border-[#D4AF37]/40 text-[#F7E7C1] py-1.5 px-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">upload</span>
                        {isUploadingAvatar ? 'Subiendo...' : 'Subir desde dispositivo'}
                      </button>
                      <input
                        type="text"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value)}
                        placeholder="o pega una URL..."
                        className="w-full bg-[#1A1026] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-[#A09BAE]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider block">
                    Imagen de Portada
                  </label>
                  <div className="flex items-center gap-2.5">
                    <img
                      src={editCover}
                      alt="Cover Preview"
                      className="w-16 h-12 rounded-xl object-cover border border-[#D4AF37]/40 shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={isUploadingCover}
                        className="w-full bg-[#2E1B47] hover:bg-[#5A2D82] border border-[#D4AF37]/40 text-[#F7E7C1] py-1.5 px-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">panorama</span>
                        {isUploadingCover ? 'Subiendo...' : 'Subir Portada'}
                      </button>
                      <input
                        type="text"
                        value={editCover}
                        onChange={(e) => setEditCover(e.target.value)}
                        placeholder="o pega una URL..."
                        className="w-full bg-[#1A1026] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-[#A09BAE]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre Visible</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#A7A7A7] block mb-1">Usuario (@handle)</label>
                  <input
                    type="text"
                    required
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value)}
                    className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Biografía Mística</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1] h-16"
                />
              </div>

              {/* Tríada Astral (Sol, Luna, Ascendente) */}
              <div className="pt-1 border-t border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  ✦ Tríada Astral & Arcano Regente (Activa la Sinastría con otros perfiles)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-[#A09BAE] block mb-1">☉ Signo Solar</label>
                    <select
                      value={editSunSign}
                      onChange={(e) => setEditSunSign(e.target.value)}
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2 text-xs text-[#F7E7C1]"
                    >
                      <option value="">Seleccionar</option>
                      {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#A09BAE] block mb-1">☽ Signo Lunar</label>
                    <select
                      value={editMoonSign}
                      onChange={(e) => setEditMoonSign(e.target.value)}
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2 text-xs text-[#F7E7C1]"
                    >
                      <option value="">Seleccionar</option>
                      {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#A09BAE] block mb-1">↑ Ascendente</label>
                    <select
                      value={editRisingSign}
                      onChange={(e) => setEditRisingSign(e.target.value)}
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2 text-xs text-[#F7E7C1]"
                    >
                      <option value="">Seleccionar</option>
                      {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#A09BAE] block mb-1">🎴 Arcano Mayor Regente</label>
                    <select
                      value={editRulingArcana}
                      onChange={(e) => setEditRulingArcana(e.target.value)}
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2 text-xs text-[#F7E7C1]"
                    >
                      <option value="">Seleccionar Arcano</option>
                      {MAJOR_ARCANA.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#A09BAE] block mb-1">✨ Don o Afinidad Espiritual</label>
                    <input
                      type="text"
                      value={editSpiritualGift}
                      onChange={(e) => setEditSpiritualGift(e.target.value)}
                      placeholder="Ej. Intuición Lunar, Tarot Marsella..."
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2 text-xs text-[#F7E7C1]"
                    />
                  </div>
                </div>

                {/* Privacidad del Altar */}
                <label className="flex items-center justify-between p-3 rounded-2xl bg-[#0B0911]/80 border border-[#D4AF37]/25 cursor-pointer hover:border-[#D4AF37]/50 transition-all mt-2">
                  <div>
                    <span className="text-xs font-bold text-[#F7E7C1] block">🔒 Modo Santuario Privado</span>
                    <span className="text-[10px] text-[#A09BAE]">
                      Muestra insignia de privacidad en tu altar y protege tu energía frente a visitantes externos
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsPrivate}
                    onChange={(e) => setEditIsPrivate(e.target.checked)}
                    className="w-4 h-4 accent-[#D4AF37]"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-[#2E1B47] text-[#A7A7A7] font-bold py-3 rounded-full text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Crear Nueva Aura Destacada (Highlight) */}
      {showCreateHighlightModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full gold-glow text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">✦ Nueva Aura Destacada</h3>
              <button onClick={() => setShowCreateHighlightModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateHighlight} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Título del Aura (Ej. Rituales, Mi Altar, Testimonios)</label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={highlightTitle}
                  onChange={(e) => setHighlightTitle(e.target.value)}
                  placeholder="Ej. Tiradas Lunares"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-[#A7A7A7] block">Imagen o Vídeo del Aura</label>
                <input
                  ref={highlightFileRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleHighlightFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => highlightFileRef.current?.click()}
                  disabled={isUploadingHighlight}
                  className="w-full bg-[#2E1B47] hover:bg-[#5A2D82] border border-[#D4AF37]/40 text-[#F7E7C1] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
                  {isUploadingHighlight ? 'Subiendo archivo...' : 'Elegir Foto o Vídeo del Dispositivo'}
                </button>
                <input
                  type="text"
                  value={highlightMediaUrl}
                  onChange={(e) => setHighlightMediaUrl(e.target.value)}
                  placeholder="o pega una URL directa..."
                  className="w-full bg-[#0B0911] border border-white/10 rounded-xl p-2 text-[11px] text-[#A09BAE]"
                />
              </div>

              {highlightMediaUrl && (
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-[#D4AF37]">
                  <img src={highlightMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <button
                type="submit"
                disabled={!highlightTitle.trim() || !highlightMediaUrl.trim() || isUploadingHighlight}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-2.5 rounded-full text-xs uppercase tracking-wider disabled:opacity-40"
              >
                Fijar Aura en mi Perfil
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Visor de Aura Destacada */}
      {activeHighlight && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setActiveHighlight(null)}
        >
          <div
            className="relative max-w-sm w-full aspect-[9/16] max-h-[82vh] rounded-3xl overflow-hidden border-2 border-[#D4AF37] bg-[#0B0911] shadow-2xl flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            {activeHighlight.mediaType === 'video' ? (
              <video src={activeHighlight.mediaUrl} autoPlay controls playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <img src={activeHighlight.mediaUrl} alt={activeHighlight.title} className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]" />
                <div>
                  <p className="text-xs font-bold text-[#F7E7C1]">{activeHighlight.title}</p>
                  <p className="text-[10px] text-[#D4AF37]">{currentUser.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDeleteHighlight(activeHighlight.id)}
                  className="w-8 h-8 rounded-full bg-red-950/80 text-red-300 flex items-center justify-center hover:bg-red-800"
                  title="Eliminar Aura Destacada"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
                <button
                  onClick={() => setActiveHighlight(null)}
                  className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Solicitud KYC para convertirse en Tarotista Verificado */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-md w-full gold-glow text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-cinzel text-base font-bold text-[#D4AF37] flex items-center gap-2">
                <SolomonStarIcon className="w-5 h-5" />
                <span>Solicitud de Vidente Verificado (KYC)</span>
              </h3>
              <button onClick={() => setShowKycModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitKyc} className="space-y-3 text-xs text-[#F7E7C1]">
              <p className="text-[11px] text-[#A09BAE] leading-relaxed">
                Al activar tu perfil profesional podrás ofrecer consultas 1:1 por chat, audio y vídeo con pagos protegidos en Escrow y publicar contenido exclusivo desbloqueable.
              </p>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre Artístico / Profesional</label>
                <input
                  type="text"
                  required
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Tarifa por Minuto (Monedas Kabaly)</label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  required
                  value={kycPrice}
                  onChange={(e) => setKycPrice(Number(e.target.value))}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#D4AF37] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Presentación y Experiencia Esotérica</label>
                <textarea
                  required
                  value={kycBio}
                  onChange={(e) => setKycBio(e.target.value)}
                  placeholder="Describe tus oráculos, años de experiencia y enfoque espiritual..."
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1] h-20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKycModal(false)}
                  className="flex-1 bg-[#2E1B47] text-[#A7A7A7] font-bold py-2.5 rounded-full text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingKyc}
                  className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-2.5 rounded-full text-xs uppercase tracking-wider gold-glow"
                >
                  {isSubmittingKyc ? 'Enviando...' : 'Enviar Solicitud KYC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
