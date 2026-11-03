import React, { useState, useEffect, useCallback } from 'react';
import { User, Video, TarotistaProfile, CoinPackage, LedgerTransaction, WithdrawalRequest, Category } from '../types';
import { WalletView } from './WalletView';
import { CreatePostModal } from './CreatePostModal';
import { EditPostModal } from './EditPostModal';
import { FollowsListModal } from './FollowsListModal';

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
  onUpdateProfile: (updatedData: { name: string; handle: string; bio: string; avatar: string; coverImage: string }) => Promise<void>;
  onSwitchUserRole?: (role: 'cliente' | 'tarotista' | 'admin') => void;
  onSelectVideo?: (videoId: string) => void;
  onSelectConsultation?: (consultationId: string) => void;
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
  const [activeSubTab, setActiveSubTab] = useState<'publicaciones' | 'guardados' | 'monedero' | 'consultas' | 'compras'>('publicaciones');
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

  // Edit profile state
  const [editName, setEditName] = useState(currentUser.name);
  const [editHandle, setEditHandle] = useState(currentUser.handle || `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`);
  const [editBio, setEditBio] = useState(currentUser.bio || 'Explorador del cosmos y apasionado del Tarot y la Astrología en KABALY ✨');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editCover, setEditCover] = useState(currentUser.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200');

  // Filter user's uploaded videos/images
  const userTarotistaProfile = tarotistaProfiles.find(p => p.userId === currentUser.id);
  const myPosts = userPosts.length > 0 ? userPosts : videos.filter(v => 
    v.tarotistaId === currentUser.id || 
    (userTarotistaProfile && v.tarotistaId === userTarotistaProfile.id)
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      name: editName,
      handle: editHandle,
      bio: editBio,
      avatar: editAvatar,
      coverImage: editCover,
    });
    setShowEditProfileModal(false);
  };

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
                onClick={onOpenSpendingLimits}
                className="bg-[#1A1026] text-[#D4AF37] border border-[#D4AF37]/30 px-3.5 py-2.5 rounded-full text-xs font-bold hover:bg-[#5A2D82]/50 transition-all flex items-center gap-1"
                title="Ajustes de autorregulación y límites de gasto"
              >
                <span className="material-symbols-outlined text-sm">shield</span>
                <span className="hidden md:inline">Límites</span>
              </button>
            </div>
          </div>

          {/* User Bio Details */}
          <div className="mt-4 text-center sm:text-left space-y-2">
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
                {currentUser.role === 'tarotista' ? '🔮 Tarotista Verificado' : '✨ Cliente Kabaly'}
              </span>
            </div>

            <p className="text-xs text-[#A7A7A7] max-w-xl leading-relaxed">
              {currentUser.bio || 'Explorador del cosmos, lecturas de tarot, carta astral y revelaciones en KABALY.'}
            </p>

            {/* Role switch CTA */}
            {currentUser.role === 'cliente' && (
              <div className="pt-2">
                <button
                  onClick={() => onSwitchUserRole('tarotista')}
                  className="text-xs text-[#D4AF37] hover:underline font-bold flex items-center gap-1 justify-center sm:justify-start"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  ¿Eres profesional del Tarot? Solicita tu perfil verificado KYC aquí ➔
                </button>
              </div>
            )}
          </div>

          {/* Social Stats Row */}
          <div className="grid grid-cols-4 gap-2 pt-6 mt-6 border-t border-[#D4AF37]/20 text-center">
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
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Posts</span>
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
      <div className="flex border-b border-[#D4AF37]/20 gap-2">
        <button
          onClick={() => setActiveSubTab('publicaciones')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'publicaciones'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">grid_on</span>
          <span>Mis Publicaciones ({myPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guardados')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'guardados'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">bookmark</span>
          <span>Colección Privada ({savedPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('monedero')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
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
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
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
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
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
                  className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-2xl overflow-hidden group hover:border-[#D4AF37] transition-all relative flex flex-col justify-between"
                >
                  <div className="relative aspect-[3/4] bg-black">
                    {post.mediaType === 'image' ? (
                      <img src={post.videoUrl || post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.videoUrl} poster={post.thumbnailUrl} className="w-full h-full object-cover" />
                    )}
                    
                    {/* Category Pill */}
                    <span className="absolute top-2 left-2 bg-[#0B0911]/80 backdrop-blur-md text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
                      {post.category}
                    </span>

                    {/* Premium Lock Badge */}
                    {post.isPremium && (
                      <span className="absolute top-2 right-2 bg-[#5A2D82] text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37] flex items-center gap-0.5 gold-glow">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                        {post.priceCoins} 🪙
                      </span>
                    )}

                    {/* Likes & Views Overlay */}
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

                  <div className="p-3 flex items-center justify-between border-t border-[#D4AF37]/10">
                    <div className="flex-1 pr-2">
                      <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-1">{post.title}</h4>
                      {post.description && <p className="text-[10px] text-[#A7A7A7] line-clamp-1 italic">{post.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
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

      {/* MODAL 2: Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-md w-full gold-glow text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-playfair text-lg font-bold text-[#F7E7C1]">Editar Perfil Social</h3>
              <button onClick={() => setShowEditProfileModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs text-[#F7E7C1]">
              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre de Usuario (@handle)</label>
                <input
                  type="text"
                  required
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Biografía</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1] h-16"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">URL Avatar (Foto de Perfil)</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">URL Imagen de Portada</label>
                <input
                  type="url"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div className="flex gap-2 pt-2">
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
    </div>
  );
};
