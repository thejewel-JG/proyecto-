import React, { useState, useEffect, useCallback } from 'react';
import { PublicUserProfile, Review, User, Video, ProfileHighlight } from '../types';
import { FollowsListModal } from './FollowsListModal';

interface PublicUserProfileViewProps {
  userId?: string;
  targetUserId?: string;
  currentUser: User | null;
  reviews?: Review[];
  onBack: () => void;
  onOpenAuthModal: () => void;
  onStartConversation: (userId: string) => void;
  onBookConsultation: (tarotistaId: string) => void;
  onSelectUserProfile?: (userId: string) => void;
  onLikeVideo?: (videoId: string) => void;
  onUnlockVideo?: (videoId: string) => void;
}

export const PublicUserProfileView: React.FC<PublicUserProfileViewProps> = ({
  userId,
  targetUserId,
  currentUser,
  reviews = [],
  onBack,
  onOpenAuthModal,
  onStartConversation,
  onBookConsultation,
}) => {
  const initialId = userId || targetUserId || '';
  const [viewedUserId, setViewedUserId] = useState<string>(initialId);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'publicaciones' | 'videos' | 'directos' | 'opiniones' | 'sobre_mi'>('publicaciones');
  const [followsModal, setFollowsModal] = useState<{ isOpen: boolean; type: 'followers' | 'following' }>({
    isOpen: false,
    type: 'followers',
  });
  const [activePostModal, setActivePostModal] = useState<Video | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const nextId = userId || targetUserId || '';
    if (nextId) setViewedUserId(nextId);
  }, [userId, targetUserId]);

  const fetchProfile = useCallback(async () => {
    if (!viewedUserId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(viewedUserId)}/public`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [viewedUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (!profile) return;

    const nextFollowing = !profile.isFollowing;
    const nextCount = nextFollowing ? profile.followersCount + 1 : Math.max(0, profile.followersCount - 1);

    setProfile({
      ...profile,
      isFollowing: nextFollowing,
      followersCount: nextCount,
    });

    try {
      await fetch(`/api/users/${encodeURIComponent(profile.id)}/follow`, {
        method: 'POST',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <span className="text-3xl text-[#E5B54F] animate-spin">✦</span>
        <p className="text-xs text-[#A09BAE] uppercase tracking-wider">Sintonizando templo celestial...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 space-y-4">
        <span className="material-symbols-outlined text-5xl text-[#E5B54F]">nightlight</span>
        <h2 className="font-cinzel text-xl text-[#F7E7C1]">Oráculo no encontrado</h2>
        <button
          onClick={onBack}
          className="gold-gradient-btn px-6 py-2.5 rounded-full text-xs font-bold"
        >
          Regresar al Cosmos
        </button>
      </div>
    );
  }

  const tar = profile.tarotistaProfile;
  const profileReviews = reviews.length > 0 ? reviews : (tar?.reviews || []);

  return (
    <div className="relative max-w-2xl mx-auto bg-[#0E071A] rounded-3xl overflow-hidden border border-[#E5B54F]/25 shadow-2xl mb-16">
      {/* Copied Toast */}
      {copiedLink && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#160B24] border border-[#E5B54F] text-[#E5B54F] px-4 py-2 rounded-full text-xs font-bold shadow-2xl animate-fade-in flex items-center gap-2">
          <span>✦</span>
          <span>Enlace de {profile.name} copiado</span>
        </div>
      )}

      {/* Top Header Navigation Overlay */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[#F7E7C1] flex items-center justify-center hover:text-[#E5B54F] hover:border-[#E5B54F] transition-all"
          title="Volver"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>

        {/* Right action buttons: Share & Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[#F7E7C1] flex items-center justify-center hover:text-[#E5B54F] hover:border-[#E5B54F] transition-all"
            title="Compartir perfil"
          >
            <span className="material-symbols-outlined text-base">share</span>
          </button>
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[#F7E7C1] flex items-center justify-center hover:text-[#E5B54F] hover:border-[#E5B54F] transition-all"
            title="Opciones"
          >
            <span className="material-symbols-outlined text-base">more_horiz</span>
          </button>
        </div>
      </div>

      {/* Cover Banner (Mystic ambient scene: candles, ancient tarot grimoires, crystals) */}
      <div className="relative h-44 sm:h-52 w-full bg-[#1A1026] overflow-hidden">
        <img
          src={profile.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200'}
          alt={profile.name}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E071A] via-[#0E071A]/40 to-transparent" />
      </div>

      {/* Profile Header Info */}
      <div className="px-5 -mt-16 relative z-10 flex flex-col items-center text-center">
        {/* Large Avatar with Gold Ring */}
        <div className="relative mb-2.5">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[2.5px] bg-gradient-to-tr from-[#E5B54F] via-[#FFF4D0] to-[#E5B54F] shadow-[0_0_25px_rgba(229,181,79,0.4)]">
            <img
              src={profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
              alt={profile.name}
              className="w-full h-full object-cover rounded-full bg-[#120B1D] border-2 border-[#0E071A]"
            />
          </div>
        </div>

        {/* Name with Verified Badge */}
        <div className="flex items-center gap-1.5">
          <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[#F7E7C1]">
            {tar ? tar.professionalName : profile.name}
          </h2>
          {profile.isVerified && (
            <span className="material-symbols-outlined text-[#E5B54F] text-lg filled" title="Verificado">
              verified
            </span>
          )}
        </div>

        {/* Handle & Online Status Pill */}
        <div className="flex items-center gap-2.5 mt-1">
          <span className="text-xs text-[#A09BAE] font-medium">{profile.handle || '@luna_astral'}</span>
          <span className="bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>En línea</span>
          </span>
        </div>

        {/* Rating and Social Stats Row */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs mt-3 text-[#F7E7C1]">
          <div className="flex items-center gap-1 text-[#E5B54F] font-semibold">
            <span>★</span>
            <span className="text-[#F7E7C1] font-bold">{tar ? tar.ratingAverage.toFixed(1) : '5.0'}</span>
            <span className="text-[#A09BAE] text-[11px]">({tar ? tar.totalReviews : '326'} reseñas)</span>
          </div>
          <span className="text-white/20">•</span>
          <button
            onClick={() => setFollowsModal({ isOpen: true, type: 'followers' })}
            className="hover:text-[#E5B54F] transition-colors"
          >
            <span className="font-bold text-[#F7E7C1]">3,4K</span>{' '}
            <span className="text-[#A09BAE]">Seguidores</span>
          </button>
          <span className="text-white/20">•</span>
          <button
            onClick={() => setFollowsModal({ isOpen: true, type: 'following' })}
            className="hover:text-[#E5B54F] transition-colors"
          >
            <span className="font-bold text-[#F7E7C1]">128</span>{' '}
            <span className="text-[#A09BAE]">Siguiendo</span>
          </button>
        </div>

        {/* Specialties Tags (Pills with purple background and subtle border) */}
        <div className="flex flex-wrap justify-center gap-2 mt-3.5">
          {((tar && tar.specialties.length > 0) ? tar.specialties : ['Tarot', 'Astrología', 'Limpiezas energéticas']).map((s, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-full bg-[#24133A]/80 border border-[#E5B54F]/25 text-[#E2D9F3] text-xs font-medium"
            >
              {s}
            </span>
          ))}
        </div>

        {/* Bio */}
        <p className="text-xs sm:text-[13px] text-[#D8CEF0]/90 max-w-md leading-relaxed mt-3 px-2">
          {profile.bio || 'Guía espiritual y tarotista con más de 10 años de experiencia. Te ayudo a encontrar claridad, equilibrio y respuestas en tu camino. ✨'}
        </p>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-center gap-2.5 w-full max-w-md mt-5">
          {/* Main Gold CTA: Consultar ahora · Desde 1,50 €/min */}
          {tar && (
            <button
              onClick={() => onBookConsultation(tar.id)}
              className="gold-gradient-btn flex-1 py-3 px-4 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-base">call</span>
              <span>Consultar ahora</span>
              <span className="opacity-75 font-normal">· Desde {tar.pricePerMinEur.toFixed(2)} €/min</span>
            </button>
          )}

          {/* Follow Button */}
          <button
            onClick={handleToggleFollow}
            className={`px-4 py-3 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 ${
              profile.isFollowing
                ? 'bg-[#1F1030] text-[#E5B54F] border-[#E5B54F]'
                : 'bg-[#1A0F2B]/80 text-[#F7E7C1] border-white/20 hover:border-[#E5B54F]'
            }`}
          >
            <span>{profile.isFollowing ? 'Siguiendo ✓' : 'Seguir ♡'}</span>
          </button>

          {/* Chat Icon Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuthModal();
                return;
              }
              onStartConversation(profile.id);
            }}
            className="w-11 h-11 rounded-full bg-[#1A0F2B]/80 border border-white/20 text-[#F7E7C1] hover:border-[#E5B54F] hover:text-[#E5B54F] flex items-center justify-center shrink-0 transition-all"
            title="Enviar mensaje directo"
          >
            <span className="material-symbols-outlined text-lg">chat_bubble</span>
          </button>
        </div>
      </div>

      {/* Navigation Content Tabs (Publicaciones, Vídeos, Directos, Opiniones, Sobre mí) */}
      <div className="flex border-b border-white/10 mt-6 px-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'publicaciones', label: 'Publicaciones' },
          { id: 'videos', label: 'Vídeos' },
          { id: 'directos', label: 'Directos' },
          { id: 'opiniones', label: 'Opiniones' },
          { id: 'sobre_mi', label: 'Sobre mí' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-all relative ${
              activeTab === t.id
                ? 'text-[#F7E7C1] font-bold'
                : 'text-[#A09BAE] hover:text-[#F7E7C1]'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#E5B54F] to-transparent shadow-[0_0_8px_#E5B54F]" />
            )}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="p-3">
        {/* PUBLICACIONES & VÍDEOS: 3-column Grid with play icon overlays */}
        {(activeTab === 'publicaciones' || activeTab === 'videos') && (
          <div className="grid grid-cols-3 gap-2">
            {profile.posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setActivePostModal(post)}
                className="relative aspect-[9/13] rounded-2xl overflow-hidden bg-[#180E28] cursor-pointer group border border-white/5 shadow-md"
              >
                <img
                  src={post.thumbnailUrl || post.videoUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Play Button Icon on Bottom Right */}
                <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-[10px]">
                  <span>▶</span>
                </div>

                {/* Likes indicator on bottom left */}
                <div className="absolute bottom-2 left-2 text-[10px] text-white/90 font-semibold flex items-center gap-1">
                  <span>♥</span>
                  <span>{post.likes}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DIRECTOS */}
        {activeTab === 'directos' && (
          <div className="p-6 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-[#E5B54F]">sensors</span>
            <h3 className="font-cinzel text-sm font-bold text-[#F7E7C1]">Próximos Rituales en Vivo</h3>
            <p className="text-xs text-[#A09BAE] max-w-xs mx-auto">
              Luna Astral transmitirá en directo el próximo plenilunio con tiradas interactivas y canalización grupal.
            </p>
          </div>
        )}

        {/* OPINIONES */}
        {activeTab === 'opiniones' && (
          <div className="space-y-2.5 p-1">
            {profileReviews.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#A09BAE]">
                Aún no hay opiniones públicas registradas en este templo.
              </div>
            ) : (
              profileReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-2xl bg-[#160B24] border border-[#E5B54F]/20 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F7E7C1]">{rev.clientName}</span>
                    <span className="text-xs text-[#E5B54F]">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-xs text-[#D8CEF0]/80 italic">"{rev.comment}"</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* SOBRE MÍ */}
        {activeTab === 'sobre_mi' && (
          <div className="p-4 space-y-4 text-xs text-[#D8CEF0] leading-relaxed">
            <div className="bg-[#160B24] border border-[#E5B54F]/20 rounded-2xl p-4 space-y-2">
              <h4 className="font-cinzel text-sm font-bold text-[#E5B54F]">Trayectoria Espiritual</h4>
              <p>
                Más de una década consagrada a la lectura del Tarot Marsellés y Egipcio, astrología evolutiva y limpiezas energéticas de espacios y auras. Formada en escuelas esotéricas de España e Iberoamérica.
              </p>
            </div>
            <div className="bg-[#160B24] border border-[#E5B54F]/20 rounded-2xl p-4 space-y-2">
              <h4 className="font-cinzel text-sm font-bold text-[#E5B54F]">Metodología de Consulta</h4>
              <p>
                Sesiones cálidas, directas y confidenciales. No juzgo ni sentencio: entrego las llaves y revelaciones que el universo te envía para tomar decisiones en sintonía con tu propósito álmico.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Post Modal Viewer if clicked */}
      {activePostModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-sm w-full bg-[#120B1D] rounded-3xl overflow-hidden border border-[#E5B54F]/40 shadow-2xl">
            <button
              onClick={() => setActivePostModal(null)}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              ✕
            </button>
            <div className="aspect-[9/13] w-full bg-black">
              {activePostModal.mediaType === 'video' ? (
                <video
                  src={activePostModal.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={activePostModal.thumbnailUrl || activePostModal.videoUrl}
                  alt={activePostModal.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-4 space-y-1">
              <h4 className="font-cinzel text-sm font-bold text-[#F7E7C1]">{activePostModal.title}</h4>
              <p className="text-xs text-[#A09BAE]">{activePostModal.description || 'Visión canalizada en KABALY.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Follows Modal */}
      <FollowsListModal
        isOpen={followsModal.isOpen}
        onClose={() => setFollowsModal({ ...followsModal, isOpen: false })}
        userId={profile.id}
        userName={profile.name}
        type={followsModal.type}
      />
    </div>
  );
};
