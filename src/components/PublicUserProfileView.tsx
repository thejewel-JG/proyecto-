import React, { useState, useEffect, useCallback } from 'react';
import { PublicUserProfile, Review, User, Video, ProfileHighlight } from '../types';
import { FollowsListModal } from './FollowsListModal';
import {
  AlchemicalSunIcon,
  SacredFlameIcon,
  CrystalBallIcon,
  TwinMoonsIcon,
  SolomonStarIcon,
} from './EsotericIcons';

interface PublicUserProfileViewProps {
  targetUserId: string;
  currentUser: User | null;
  reviews?: Review[];
  onBack: () => void;
  onOpenAuthModal: () => void;
  onStartConversation: (userId: string) => void;
  onBookConsultation: (tarotistaId: string) => void;
  onSelectUserProfile?: (userId: string) => void;
}

const ZODIAC_ELEMENTS: Record<string, 'Fuego' | 'Tierra' | 'Aire' | 'Agua'> = {
  Aries: 'Fuego',
  Leo: 'Fuego',
  Sagitario: 'Fuego',
  Tauro: 'Tierra',
  Virgo: 'Tierra',
  Capricornio: 'Tierra',
  Géminis: 'Aire',
  Libra: 'Aire',
  Acuario: 'Aire',
  Cáncer: 'Agua',
  Escorpio: 'Agua',
  Piscis: 'Agua',
};

function computeElementalAffinity(signA?: string, signB?: string): { percent: number; label: string } | null {
  if (!signA || !signB) return null;
  const elA = ZODIAC_ELEMENTS[signA];
  const elB = ZODIAC_ELEMENTS[signB];
  if (!elA || !elB) return { percent: 88, label: 'Armonía Cósmica' };
  if (elA === elB) return { percent: 96, label: `Resonancia Pura de ${elA}` };
  if (
    (elA === 'Fuego' && elB === 'Aire') ||
    (elA === 'Aire' && elB === 'Fuego') ||
    (elA === 'Agua' && elB === 'Tierra') ||
    (elA === 'Tierra' && elB === 'Agua')
  ) {
    return { percent: 92, label: `Alquimia Complementaria (${elA} + ${elB})` };
  }
  return { percent: 82, label: `Atracción Magnética (${elA} • ${elB})` };
}

export const PublicUserProfileView: React.FC<PublicUserProfileViewProps> = ({
  targetUserId,
  currentUser,
  reviews = [],
  onBack,
  onOpenAuthModal,
  onStartConversation,
  onBookConsultation,
}) => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'exclusive' | 'reviews'>('posts');
  const [followsModal, setFollowsModal] = useState<{ isOpen: boolean; type: 'followers' | 'following' }>({
    isOpen: false,
    type: 'followers',
  });
  const [activeHighlight, setActiveHighlight] = useState<ProfileHighlight | null>(null);
  const [activePostModal, setActivePostModal] = useState<Video | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(targetUserId)}/public`);
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
  }, [targetUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (!profile) return;

    const prevFollowing = profile.isFollowing;
    const prevCount = profile.followersCount;
    const nextFollowing = !prevFollowing;

    setProfile({
      ...profile,
      isFollowing: nextFollowing,
      followersCount: nextFollowing ? prevCount + 1 : Math.max(0, prevCount - 1),
    });

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(profile.id)}/follow`, {
        method: nextFollowing ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error();
      setProfile(prev =>
        prev
          ? {
              ...prev,
              isFollowing: !!data.isFollowing,
              followersCount: data.followersCount,
            }
          : null
      );
    } catch {
      setProfile(prev =>
        prev
          ? {
              ...prev,
              isFollowing: prevFollowing,
              followersCount: prevCount,
            }
          : null
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[#1A1026] border border-[#D4AF37]/40 flex items-center justify-center mx-auto text-[#D4AF37] animate-spin">
          <SolomonStarIcon className="w-6 h-6" />
        </div>
        <p className="font-cinzel text-sm text-[#F7E7C1]">Invocando altar astral...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <p className="font-cinzel text-lg text-[#F7E7C1]">Perfil no encontrado</p>
        <button
          onClick={onBack}
          className="px-5 py-2 rounded-full bg-[#D4AF37] text-[#0B0911] text-xs font-bold uppercase"
        >
          Volver
        </button>
      </div>
    );
  }

  const tar = profile.tarotistaProfile;
  const profileReviews = tar
    ? reviews.filter(r => r.tarotistaId === tar.id || r.tarotistaId === profile.id)
    : [];
  const exclusivePosts = profile.posts.filter(p => p.isPremium || p.isExclusive);
  const affinity = computeElementalAffinity(currentUser?.sunSign, profile.sunSign);

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen pb-24 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Back Floating Button */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#0B0911]/75 backdrop-blur-md border border-[#D4AF37]/35 text-[#F7E7C1] flex items-center justify-center hover:text-[#D4AF37] transition"
          title="Volver"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>
      </div>

      {/* Cover Banner */}
      <div className="relative h-44 sm:h-56 w-full bg-[#1A1026] overflow-hidden">
        <img
          src={profile.coverImage}
          alt={profile.name}
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-[#0B0911]/30 to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="px-5 -mt-14 relative z-10 flex flex-col items-center text-center">
        {/* Avatar with Aura Ring */}
        <div className="relative">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full story-ring p-[3px] shadow-[0_0_25px_rgba(212,175,55,0.35)]">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-full h-full object-cover rounded-full bg-[#1A1026] border-2 border-[#0B0911]"
            />
          </div>
          {tar?.isVerified && (
            <div className="absolute -bottom-1 right-0 bg-[#D4AF37] text-[#0B0911] px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider shadow-lg border border-[#0B0911]">
              <AlchemicalSunIcon className="w-3 h-3" />
              <span>Vidente</span>
            </div>
          )}
        </div>

        {/* Name & Handle */}
        <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[#F7E7C1] mt-3 flex items-center gap-1.5">
          <span>{tar ? tar.professionalName : profile.name}</span>
        </h2>
        <span className="text-xs text-[#D4AF37] font-mono">{profile.handle}</span>

        {/* Tríada Astral Esotérica (☉ Sol • ☽ Luna • ↑ Ascendente • Arcano) */}
        {(profile.sunSign || profile.moonSign || profile.risingSign || profile.rulingArcana || profile.spiritualGift) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {profile.sunSign && (
              <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[11px] text-[#F7E7C1] flex items-center gap-1">
                <span className="text-[#D4AF37]">☉</span> {profile.sunSign}
              </span>
            )}
            {profile.moonSign && (
              <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[11px] text-[#F7E7C1] flex items-center gap-1">
                <span className="text-[#D4AF37]">☽</span> {profile.moonSign}
              </span>
            )}
            {profile.risingSign && (
              <span className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-[11px] text-[#F7E7C1] flex items-center gap-1">
                <span className="text-[#D4AF37]">↑</span> {profile.risingSign}
              </span>
            )}
            {profile.rulingArcana && (
              <span className="px-2.5 py-1 rounded-full bg-[#2E1B47]/70 border border-[#D4AF37]/40 text-[11px] text-[#D4AF37] font-semibold">
                ✦ {profile.rulingArcana}
              </span>
            )}
            {profile.spiritualGift && (
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-[#F7E7C1]/80">
                🔮 {profile.spiritualGift}
              </span>
            )}
          </div>
        )}

        {/* Sinastría Rápida (Si el visitante también tiene signo solar) */}
        {affinity && currentUser?.id !== profile.id && (
          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#2E1B47] to-[#1A1026] border border-[#D4AF37]/40 text-[11px]">
            <span className="text-[#D4AF37] font-bold">✦ Sinastría {affinity.percent}%</span>
            <span className="text-[#F7E7C1]/80">• {affinity.label}</span>
          </div>
        )}

        {/* Bio */}
        <p className="text-xs text-[#F7E7C1]/85 max-w-md leading-relaxed mt-3">
          {profile.bio}
        </p>

        {/* Specialties if Tarotista */}
        {tar && tar.specialties.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {tar.specialties.map((s, idx) => (
              <span
                key={idx}
                className="px-2.5 py-0.5 rounded-full bg-[#2E1B47]/50 border border-[#D4AF37]/25 text-[#D4AF37] text-[10px] font-semibold uppercase tracking-wider"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Social Stats Bar (Instagram / TikTok Style) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 w-full max-w-md my-5 py-3 px-2 rounded-2xl bg-[#140D21]/90 border border-white/10 gap-2">
          <div
            onClick={() => setFollowsModal({ isOpen: true, type: 'followers' })}
            className="flex flex-col items-center cursor-pointer group"
          >
            <span className="font-cinzel text-base sm:text-lg font-bold text-[#D4AF37] group-hover:scale-105 transition">
              {profile.followersCount}
            </span>
            <span className="text-[10px] text-[#F7E7C1]/60 uppercase tracking-wider">Seguidores</span>
          </div>

          <div
            onClick={() => setFollowsModal({ isOpen: true, type: 'following' })}
            className="flex flex-col items-center cursor-pointer group border-x border-white/10"
          >
            <span className="font-cinzel text-base sm:text-lg font-bold text-[#F7E7C1] group-hover:text-[#D4AF37] transition">
              {profile.followingCount}
            </span>
            <span className="text-[10px] text-[#F7E7C1]/60 uppercase tracking-wider">Siguiendo</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-cinzel text-base sm:text-lg font-bold text-[#F7E7C1]">
              {profile.postsCount}
            </span>
            <span className="text-[10px] text-[#F7E7C1]/60 uppercase tracking-wider">Visiones</span>
          </div>

          {tar && (
            <div className="hidden sm:flex flex-col items-center border-l border-white/10">
              <span className="font-cinzel text-base sm:text-lg font-bold text-[#D4AF37]">
                ★ {tar.ratingAverage.toFixed(1)}
              </span>
              <span className="text-[10px] text-[#F7E7C1]/60 uppercase tracking-wider">
                {tar.totalReviews} Reseñas
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {currentUser?.id !== profile.id && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full max-w-md mb-4">
            {tar && (
              <button
                onClick={() => onBookConsultation(tar.id)}
                className="flex-1 min-w-[160px] bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-2.5 px-4 rounded-full flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] transition-all"
              >
                <SolomonStarIcon className="w-4 h-4" />
                <span>Consultar (€{tar.pricePerMinEur.toFixed(2)}/m)</span>
              </button>
            )}

            <button
              onClick={handleToggleFollow}
              className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                profile.isFollowing
                  ? 'bg-[#1A1026] text-[#F7E7C1]/80 border border-[#D4AF37]/30 hover:border-red-400 hover:text-red-300'
                  : 'bg-[#2E1B47] text-[#D4AF37] border border-[#D4AF37] gold-glow hover:scale-105'
              }`}
            >
              <span>{profile.isFollowing ? '✓ Siguiendo' : '✦ Seguir'}</span>
            </button>

            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuthModal();
                  return;
                }
                onStartConversation(profile.id);
              }}
              className="px-4 py-2.5 rounded-full bg-white/5 border border-white/15 text-[#F7E7C1] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Enviar Susurro Privado"
            >
              <TwinMoonsIcon className="w-4 h-4" />
              <span>Susurro</span>
            </button>
          </div>
        )}

        {/* Auras Destacadas (Instagram Highlights Row) */}
        {profile.highlights && profile.highlights.length > 0 && (
          <div className="w-full max-w-md overflow-x-auto no-scrollbar py-2 flex items-center gap-4 border-t border-white/5 mt-1">
            {profile.highlights.map(h => (
              <div
                key={h.id}
                onClick={() => setActiveHighlight(h)}
                className="flex flex-col items-center shrink-0 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-full story-ring p-[2px] group-hover:scale-105 transition-transform">
                  <img
                    src={h.coverUrl}
                    alt={h.title}
                    className="w-full h-full rounded-full object-cover bg-[#1A1026] border-2 border-[#0B0911]"
                  />
                </div>
                <span className="text-[10px] text-[#F7E7C1]/80 mt-1 truncate max-w-[64px]">
                  {h.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs: Visiones | Exclusivos | Reseñas */}
      <div className="flex border-b border-white/10 mt-4 px-4">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'posts'
              ? 'text-[#D4AF37] border-[#D4AF37]'
              : 'text-[#F7E7C1]/50 border-transparent hover:text-[#F7E7C1]'
          }`}
        >
          Visiones ({profile.posts.length})
        </button>

        {exclusivePosts.length > 0 && (
          <button
            onClick={() => setActiveTab('exclusive')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'exclusive'
                ? 'text-[#D4AF37] border-[#D4AF37]'
                : 'text-[#F7E7C1]/50 border-transparent hover:text-[#F7E7C1]'
            }`}
          >
            Arcanos ({exclusivePosts.length})
          </button>
        )}

        {tar && (
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'reviews'
                ? 'text-[#D4AF37] border-[#D4AF37]'
                : 'text-[#F7E7C1]/50 border-transparent hover:text-[#F7E7C1]'
            }`}
          >
            Oráculo ({profileReviews.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {(activeTab === 'posts' || activeTab === 'exclusive') && (
          <div className="grid grid-cols-3 gap-1.5">
            {(activeTab === 'posts' ? profile.posts : exclusivePosts).map(post => (
              <div
                key={post.id}
                onClick={() => setActivePostModal(post)}
                className="relative aspect-[9/14] rounded-xl overflow-hidden bg-[#1A1026] cursor-pointer group border border-white/5"
              >
                <img
                  src={post.thumbnailUrl || post.videoUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {post.isPinned && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#0B0911] text-[9px] font-bold uppercase">
                    ✦ Fijado
                  </span>
                )}

                {(post.isPremium || post.isExclusive) && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#2E1B47]/90 border border-[#D4AF37] text-[#D4AF37] text-[9px] font-bold">
                    ☼ {post.priceCoins}
                  </span>
                )}

                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-[#F7E7C1]">
                  <span className="flex items-center gap-0.5 font-bold">
                    <SacredFlameIcon className="w-3.5 h-3.5 text-[#D4AF37]" filled />
                    {post.likes}
                  </span>
                  <span className="flex items-center gap-0.5 opacity-80">
                    <CrystalBallIcon className="w-3.5 h-3.5" />
                    {post.commentsCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3 p-2">
            {profileReviews.length === 0 ? (
              <p className="text-center text-xs text-[#F7E7C1]/50 py-10">
                Aún no hay reseñas verificadas en este templo.
              </p>
            ) : (
              profileReviews.map(rev => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-[#140D21] border border-[#D4AF37]/25 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F7E7C1]">{rev.clientName}</span>
                    <span className="text-xs text-[#D4AF37]">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-xs text-[#F7E7C1]/80 italic">"{rev.comment}"</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal de Seguidores / Siguiendo */}
      <FollowsListModal
        isOpen={followsModal.isOpen}
        userId={profile.id}
        type={followsModal.type}
        currentUser={currentUser}
        onClose={() => {
          setFollowsModal(prev => ({ ...prev, isOpen: false }));
          fetchProfile();
        }}
      />

      {/* Modal Visor de Aura Destacada */}
      {activeHighlight && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setActiveHighlight(null)}
        >
          <div
            className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden bg-[#0B0911] border border-[#D4AF37]/40 flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={activeHighlight.mediaUrl}
              alt={activeHighlight.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <span className="font-cinzel text-sm font-bold text-[#D4AF37]">
                ✦ {activeHighlight.title}
              </span>
              <button
                onClick={() => setActiveHighlight(null)}
                className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reproductor de Publicación de Cuadrícula */}
      {activePostModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setActivePostModal(null)}
        >
          <div
            className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden bg-[#0B0911] border border-[#D4AF37]/40 flex flex-col justify-between"
            onClick={e => e.stopPropagation()}
          >
            {activePostModal.mediaType === 'image' || !activePostModal.videoUrl ? (
              <img
                src={activePostModal.videoUrl || activePostModal.thumbnailUrl}
                alt={activePostModal.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <video
                src={activePostModal.videoUrl}
                poster={activePostModal.thumbnailUrl}
                autoPlay
                loop
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <span className="text-xs font-bold text-[#D4AF37]">✦ {activePostModal.category}</span>
              <button
                onClick={() => setActivePostModal(null)}
                className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              <p className="text-xs font-bold text-[#F7E7C1]">{activePostModal.title}</p>
              {activePostModal.description && (
                <p className="text-[11px] text-[#F7E7C1]/75 mt-1">{activePostModal.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

