import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, User, TarotistaProfile, Category, StoryGroup } from '../types';
import { StoriesBar } from './StoriesBar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import { StoryViewersModal } from './StoryViewersModal';
import { CommentsDrawer } from './CommentsDrawer';
import {
  SacredFlameIcon,
  CrystalBallIcon,
  ArcanaGrimoireIcon,
  ShootingStarIcon,
  SolomonStarIcon,
  AlchemicalSunIcon,
} from './EsotericIcons';

interface FeedViewProps {
  currentUser: User | null;
  tarotistaProfiles: TarotistaProfile[];
  activeCategory?: Category;
  initialPostId?: string | null;
  onLikeVideo?: (videoId: string) => void;
  onUnlockVideo: (videoId: string) => void;
  onBookConsultation: (tarotistaId: string) => void;
  onViewTarotistaProfile: (tarotistaId: string) => void;
  onOpenWallet: () => void;
  onOpenAuthModal?: () => void;
  onOpenCreatePost?: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  tarotistaProfiles,
  activeCategory = 'Para ti',
  initialPostId,
  onUnlockVideo,
  onBookConsultation,
  onViewTarotistaProfile,
  onOpenWallet,
  onOpenAuthModal,
  onOpenCreatePost,
}) => {
  // Feed posts state with cursor pagination
  const [posts, setPosts] = useState<Video[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [heartAnim, setHeartAnim] = useState<{ x: number; y: number; id: number } | null>(null);

  // Stories state
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<StoryGroup | null>(null);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [viewersStoryId, setViewersStoryId] = useState<string | null>(null);

  // Relationship state (Follow/Unfollow map)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Desbloqueo de publicaciones exclusivas (Fase 9)
  const [confirmingUnlockPost, setConfirmingUnlockPost] = useState<Video | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef<number>(0);

  const handleInitiateUnlock = (post: Video) => {
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    const cost = post.priceCoins || 100;
    if (currentUser.coinsBalance < cost) {
      alert(`Saldo insuficiente. Tienes ${currentUser.coinsBalance} monedas y necesitas ${cost} monedas para desbloquear este contenido.`);
      onOpenWallet();
      return;
    }
    setUnlockError(null);
    setConfirmingUnlockPost(post);
  };

  const handleConfirmUnlock = async () => {
    if (!confirmingUnlockPost || !currentUser || isUnlocking) return;

    setIsUnlocking(true);
    setUnlockError(null);
    const idempotencyKey = `unlock_${confirmingUnlockPost.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(confirmingUnlockPost.id)}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ idempotencyKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fallo al desbloquear la publicación.');
      }

      // Actualizar saldo de usuario en la UI
      if (data.newBalance !== undefined) {
        currentUser.coinsBalance = data.newBalance;
      } else if (confirmingUnlockPost.priceCoins) {
        currentUser.coinsBalance = Math.max(0, currentUser.coinsBalance - confirmingUnlockPost.priceCoins);
      }

      // Actualizar la publicación en el feed para mostrar el contenido completo
      setPosts(prev => prev.map(p => {
        if (p.id === confirmingUnlockPost.id) {
          return {
            ...p,
            hasUnlocked: true,
            videoUrl: data.mediaUrl || p.videoUrl,
          };
        }
        return p;
      }));

      onUnlockVideo(confirmingUnlockPost.id);
      setConfirmingUnlockPost(null);
    } catch (err: any) {
      setUnlockError(err.message || 'Error al procesar el desbloqueo.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Cargar stories activas (24 horas)
  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories');
      if (res.ok) {
        const data = await res.json();
        setStoryGroups(data.groups || []);
      }
    } catch (e) {
      console.error('Error al cargar stories:', e);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Cargar publicaciones con paginación por cursor y filtro real
  const fetchPosts = useCallback(async (category: Category, cursor?: string, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setFetchError(null);
    }

    try {
      let url = `/api/posts?limit=10`;
      if (category && category !== 'Para ti') {
        url += `&category=${encodeURIComponent(category)}`;
      }
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Error al conectar con el servidor.');
      }

      const data = await res.json();
      const newItems: Video[] = data.items || [];

      if (append) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filtered = newItems.filter(item => !existingIds.has(item.id));
          return [...prev, ...filtered];
        });
      } else {
        setPosts(newItems);
        setCurrentIndex(0);
      }

      setNextCursor(data.nextCursor || null);
      setHasMore(!!data.hasMore);
    } catch (err: any) {
      setFetchError(err.message || 'Fallo de conexión');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Cargar al montar o al cambiar de categoría
  useEffect(() => {
    fetchPosts(activeCategory);
  }, [activeCategory, fetchPosts]);

  const [directPostNotFound, setDirectPostNotFound] = useState<boolean>(false);

  // Si se solicita un post específico por enlace directo
  useEffect(() => {
    if (!initialPostId) return;

    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(initialPostId)}`);
        if (!res.ok) {
          if (isMounted) setDirectPostNotFound(true);
          return;
        }
        const data = await res.json();
        if (data.post && isMounted) {
          setDirectPostNotFound(false);
          setPosts(prev => {
            const exists = prev.some(p => p.id === data.post.id);
            if (exists) {
              const idx = prev.findIndex(p => p.id === data.post.id);
              setCurrentIndex(idx);
              return prev;
            }
            setCurrentIndex(0);
            return [data.post, ...prev];
          });
        } else if (isMounted) {
          setDirectPostNotFound(true);
        }
      } catch (e) {
        if (isMounted) setDirectPostNotFound(true);
      }
    })();

    return () => { isMounted = false; };
  }, [initialPostId]);

  const currentVideo = posts[currentIndex];

  // Comprobar estado de seguimiento para el creador actual
  const checkRelationship = useCallback(async (targetUserId: string) => {
    if (!currentUser || currentUser.id === targetUserId) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(targetUserId)}/relationship`);
      if (res.ok) {
        const data = await res.json();
        setFollowingMap(prev => ({ ...prev, [targetUserId]: !!data.isFollowing }));
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentVideo?.tarotistaId) {
      checkRelationship(currentVideo.tarotistaId);
    }
  }, [currentVideo?.tarotistaId, checkRelationship]);

  // Control de reproducción de vídeo
  useEffect(() => {
    setMediaError(null);
    setIsPlaying(true);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [currentIndex, currentVideo?.id]);

  // Pausar al cambiar de pestaña del navegador
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleNextVideo = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      if (currentIndex >= posts.length - 3 && hasMore && nextCursor && !isLoadingMore) {
        fetchPosts(activeCategory, nextCursor, true);
      }
    } else if (hasMore && nextCursor && !isLoadingMore) {
      fetchPosts(activeCategory, nextCursor, true).then(() => {
        setCurrentIndex(prev => prev + 1);
      });
    }
  };

  const handlePrevVideo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Gestos táctiles verticales en móvil
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextVideo();
      } else {
        handlePrevVideo();
      }
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentVideo?.mediaType === 'image') return;
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Like persistente explícito con actualización optimista y rollback ante error
  const handleToggleLike = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    if (!currentVideo) return;

    const previousLiked = !!currentVideo.isLikedByCurrentUser;
    const previousLikes = currentVideo.likes;
    const willBeLiked = !previousLiked;
    const nextLikes = willBeLiked ? previousLikes + 1 : Math.max(0, previousLikes - 1);

    // Actualización optimista
    setPosts(prev => prev.map(p => p.id === currentVideo.id ? {
      ...p,
      isLikedByCurrentUser: willBeLiked,
      likes: nextLikes,
    } : p));

    try {
      const endpoint = `/api/posts/${encodeURIComponent(currentVideo.id)}/like`;
      const res = await fetch(endpoint, {
        method: willBeLiked ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fallo al procesar el Me gusta');
      }

      // Reconciliar con el contador real de la base de datos
      setPosts(prev => prev.map(p => p.id === currentVideo.id ? {
        ...p,
        isLikedByCurrentUser: data.isLikedByCurrentUser,
        likes: data.likes,
      } : p));
    } catch (err: any) {
      // Revertir ante error
      setPosts(prev => prev.map(p => p.id === currentVideo.id ? {
        ...p,
        isLikedByCurrentUser: previousLiked,
        likes: previousLikes,
      } : p));
      alert(err.message || 'Error de conexión al dar Me gusta');
    }
  };

  // Guardar / Quitar publicación de colección personal
  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    if (!currentVideo) return;

    const previousSaved = !!currentVideo.isSavedByCurrentUser;
    const willBeSaved = !previousSaved;

    // Actualización optimista
    setPosts(prev => prev.map(p => p.id === currentVideo.id ? {
      ...p,
      isSavedByCurrentUser: willBeSaved,
    } : p));

    try {
      const endpoint = `/api/posts/${encodeURIComponent(currentVideo.id)}/save`;
      const res = await fetch(endpoint, {
        method: willBeSaved ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar publicación');
      }
    } catch (err: any) {
      // Revertir
      setPosts(prev => prev.map(p => p.id === currentVideo.id ? {
        ...p,
        isSavedByCurrentUser: previousSaved,
      } : p));
      alert(err.message || 'Error al actualizar guardados');
    }
  };

  // Seguir / Dejar de seguir al creador de la publicación
  const handleToggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    const isCurrentlyFollowing = !!followingMap[targetUserId];
    const willFollow = !isCurrentlyFollowing;

    // Actualización optimista
    setFollowingMap(prev => ({ ...prev, [targetUserId]: willFollow }));

    try {
      const endpoint = `/api/users/${encodeURIComponent(targetUserId)}/follow`;
      const res = await fetch(endpoint, {
        method: willFollow ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar seguimiento');
      }
      setFollowingMap(prev => ({ ...prev, [targetUserId]: !!data.isFollowing }));
    } catch (err: any) {
      setFollowingMap(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }));
      alert(err.message || 'Error de conexión');
    }
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHeartAnim({ x, y, id: Date.now() });
    if (!currentVideo.isLikedByCurrentUser) {
      handleToggleLike();
    }

    setTimeout(() => {
      setHeartAnim(null);
    }, 900);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentVideo) return;
    const shareUrl = `${window.location.origin}/?post=${currentVideo.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2500);
      }).catch(() => {
        prompt('Copia el enlace de esta publicación:', shareUrl);
      });
    } else {
      prompt('Copia el enlace de esta publicación:', shareUrl);
    }
  };

  // 0. Estado de Publicación no encontrada o retirada (Enlace Directo)
  if (directPostNotFound) {
    return (
      <div className="relative w-full h-[calc(100vh-140px)] max-w-md mx-auto bg-[#0B0911] rounded-3xl shadow-2xl border border-[#D4AF37]/30 flex items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center gap-4 max-w-xs">
          <div className="w-16 h-16 rounded-full bg-[#1A1026] border border-[#D4AF37]/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-[#D4AF37]">visibility_off</span>
          </div>
          <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">Publicación no disponible</h3>
          <p className="text-xs text-[#A7A7A7] leading-relaxed">
            Esta publicación ha sido retirada por su autor o el enlace directo ya no existe en KABALY.
          </p>
          <button
            onClick={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setDirectPostNotFound(false);
              fetchPosts(activeCategory);
            }}
            className="bg-[#D4AF37] text-[#0B0911] px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 transition-all"
          >
            Ir al Feed General
          </button>
        </div>
      </div>
    );
  }

  // 1. Estado de Carga Inicial
  if (isLoading) {
    return (
      <div className="relative w-full h-[calc(100vh-140px)] max-w-md mx-auto bg-[#0B0911] rounded-3xl shadow-2xl border border-[#D4AF37]/20 flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#D4AF37] animate-spin">auto_awesome</span>
          <p className="text-sm text-[#F7E7C1] font-cinzel">Sincronizando con el cosmos...</p>
          <span className="text-[11px] text-[#A7A7A7]">Cargando publicaciones reales de KABALY</span>
        </div>
      </div>
    );
  }

  // 2. Estado de Fallo de Conexión
  if (fetchError) {
    return (
      <div className="relative w-full h-[calc(100vh-140px)] max-w-md mx-auto bg-[#0B0911] rounded-3xl shadow-2xl border border-red-500/30 flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3 max-w-xs">
          <span className="material-symbols-outlined text-4xl text-red-400">cloud_off</span>
          <h3 className="text-base text-[#F7E7C1] font-cinzel font-bold">Error de Conexión</h3>
          <p className="text-xs text-[#A7A7A7]">{fetchError}</p>
          <button
            onClick={() => fetchPosts(activeCategory)}
            className="mt-2 bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37] px-5 py-2 rounded-full text-xs font-bold hover:brightness-110 transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // 3. Estado Vacío (Sin Publicaciones en la categoría)
  if (!currentVideo || posts.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col gap-2">
        {/* Stories Bar en cabecera */}
        <StoriesBar
          storyGroups={storyGroups}
          currentUser={currentUser}
          onOpenCreateStory={() => {
            if (!currentUser) onOpenAuthModal?.();
            else setShowCreateStoryModal(true);
          }}
          onSelectStoryGroup={(group) => setSelectedStoryGroup(group)}
        />

        <div className="relative w-full h-[calc(100vh-210px)] bg-[#0B0911] rounded-3xl shadow-2xl border border-[#D4AF37]/20 flex items-center justify-center p-8 text-center">
          <div className="flex flex-col items-center gap-4 max-w-xs">
            <div className="w-16 h-16 rounded-full bg-[#1A1026] border border-[#D4AF37]/40 flex items-center justify-center gold-glow">
              <span className="material-symbols-outlined text-3xl text-[#D4AF37]">auto_awesome_motion</span>
            </div>
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">
              {activeCategory === 'Siguiendo' ? 'Aún no sigues a nadie' : `No hay publicaciones en ${activeCategory}`}
            </h3>
            <p className="text-xs text-[#A7A7A7] leading-relaxed">
              {activeCategory === 'Siguiendo'
                ? 'Explora las categorías para descubrir tarotistas y creadores que resuenen contigo y síguelos para ver aquí sus publicaciones.'
                : 'El cosmos aún no registra revelaciones en esta categoría. ¡Sé el primero en compartir tu luz!'}
            </p>
            {onOpenCreatePost && currentUser && (
              <button
                onClick={onOpenCreatePost}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold px-6 py-2.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 transition-all"
              >
                + Publicar Ahora
              </button>
            )}
          </div>
        </div>

        {/* Modales de Stories */}
        <CreateStoryModal
          isOpen={showCreateStoryModal}
          onClose={() => setShowCreateStoryModal(false)}
          onStoryCreated={() => {
            setShowCreateStoryModal(false);
            fetchStories();
          }}
        />

        <StoryViewerModal
          isOpen={!!selectedStoryGroup}
          storyGroup={selectedStoryGroup}
          currentUser={currentUser}
          onClose={() => setSelectedStoryGroup(null)}
          onStoryDeleted={() => {
            setSelectedStoryGroup(null);
            fetchStories();
          }}
          onViewersRequested={(storyId) => setViewersStoryId(storyId)}
        />

        <StoryViewersModal
          isOpen={!!viewersStoryId}
          storyId={viewersStoryId || ''}
          onClose={() => setViewersStoryId(null)}
        />
      </div>
    );
  }

  const isUnlocked = currentVideo.hasUnlocked ?? (!currentVideo.isPremium && !currentVideo.isExclusive);
  const profile = tarotistaProfiles.find(p => p.userId === currentVideo?.tarotistaId || p.id === currentVideo?.tarotistaId);
  const isFollowingAuthor = !!followingMap[currentVideo.tarotistaId];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-1.5">
      {/* 1. Barra de Auras / Stories Activas de 24 Horas (Estilo Instagram Esotérico) */}
      <StoriesBar
        storyGroups={storyGroups}
        currentUser={currentUser}
        onOpenCreateStory={() => {
          if (!currentUser) onOpenAuthModal?.();
          else setShowCreateStoryModal(true);
        }}
        onSelectStoryGroup={(group) => setSelectedStoryGroup(group)}
      />

      {/* 2. Canvas Inmersivo Estilo TikTok / Reels con Iconografía Esotérica */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[calc(100vh-190px)] min-h-[510px] bg-[#0B0911] overflow-hidden rounded-2xl shadow-2xl border border-white/10 flex flex-col justify-between select-none"
      >
        {/* Toast de enlace copiado */}
        {copyToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#1A1026]/95 backdrop-blur-xl border border-[#D4AF37] text-[#D4AF37] px-4 py-2 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 gold-glow animate-in fade-in zoom-in duration-200">
            <span>✦</span>
            <span>Vínculo astral copiado al portapapeles</span>
          </div>
        )}

        {/* Canvas Multimedia */}
        <div
          className="relative w-full h-full cursor-pointer flex items-center justify-center bg-black overflow-hidden"
          onClick={handleDoubleTap}
        >
          {/* REQUISITO FASE 9: Si no está desbloqueado, NO renderizar el archivo privado original. */}
          {!isUnlocked ? (
            <div className="relative w-full h-full flex items-center justify-center bg-[#0B0911]">
              <img
                src={currentVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800'}
                alt={currentVideo.title}
                className="w-full h-full object-cover opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-[#0B0911]/80 to-transparent" />
            </div>
          ) : currentVideo.mediaType === 'image' ? (
            <img
              key={currentVideo.id}
              src={currentVideo.videoUrl}
              alt={currentVideo.title}
              className="w-full h-full object-cover transition-all duration-300"
            />
          ) : (
            <video
              ref={videoRef}
              key={currentVideo.id}
              src={currentVideo.videoUrl}
              poster={currentVideo.thumbnailUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="metadata"
              onError={() => {
                setMediaError('Este formato no puede reproducirse en este dispositivo. Formatos admitidos: MP4 H.264, WebM.');
              }}
              className="w-full h-full object-cover transition-all duration-300"
            />
          )}

          {/* Mensaje de Error Multimedia si no se reproduce */}
          {mediaError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#0B0911]/90 backdrop-blur-md">
              <span className="material-symbols-outlined text-4xl text-amber-400 mb-2">warning</span>
              <p className="text-xs text-[#F7E7C1] max-w-xs">{mediaError}</p>
            </div>
          )}

          {/* Gradiente de overlay limpio */}
          <div className="absolute inset-0 video-overlay-gradient pointer-events-none" />

          {/* Doble toque: Destello de Estrella Alquímica Dorada (Reemplaza al corazón típico) */}
          {heartAnim && (
            <div
              className="absolute pointer-events-none z-30 animate-ping text-[#D4AF37] esoteric-glow"
              style={{ left: heartAnim.x - 32, top: heartAnim.y - 32 }}
            >
              <SolomonStarIcon className="w-16 h-16" />
            </div>
          )}

          {/* Botón Play/Pause sobre el video */}
          {isUnlocked && currentVideo.mediaType === 'video' && !isPlaying && !mediaError && (
            <button
              onClick={togglePlayPause}
              className="absolute z-20 w-16 h-16 rounded-full bg-[#0B0911]/55 backdrop-blur-md border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] hover:scale-110 transition-transform"
            >
              <span className="material-symbols-outlined text-3xl">play_arrow</span>
            </button>
          )}

          {/* Contenido Exclusivo Bloqueado: CTA de Desbloqueo Real */}
          {!isUnlocked && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#0B0911]/85 backdrop-blur-md">
              <div className="w-16 h-16 rounded-full story-ring p-0.5 mb-3 gold-glow">
                <div className="w-full h-full bg-[#1A1026] rounded-full flex items-center justify-center text-[#D4AF37]">
                  <ArcanaGrimoireIcon className="w-8 h-8" filled />
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] mb-1">
                Arcano Exclusivo Celestial
              </span>
              <h3 className="font-cinzel text-lg text-[#F7E7C1] font-semibold mb-2 max-w-xs">
                {currentVideo.title}
              </h3>
              <p className="text-xs text-[#A7A7A7] max-w-xs mb-4 line-clamp-2">
                {currentVideo.description || 'Contenido reservado para iniciados y seguidores devotos.'}
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleInitiateUnlock(currentVideo);
                }}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold px-6 py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <SolomonStarIcon className="w-4 h-4" />
                <span>Desbloquear por {currentVideo.priceCoins || 100} Monedas</span>
              </button>
            </div>
          )}

          {/* Controles Superiores Flotantes Minimalistas (Navegación y Sonido) */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <div className="flex items-center gap-1 bg-black/35 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrevVideo(); }}
                  disabled={currentIndex === 0}
                  className="hover:text-[#D4AF37] transition-colors disabled:opacity-30"
                  title="Visión anterior"
                >
                  <span className="material-symbols-outlined text-xs">expand_less</span>
                </button>
                <span className="text-[10px] text-[#F7E7C1]/80 font-semibold">
                  {currentIndex + 1}/{posts.length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNextVideo(); }}
                  className="hover:text-[#D4AF37] transition-colors"
                  title="Siguiente visión"
                >
                  <span className="material-symbols-outlined text-xs">expand_more</span>
                </button>
              </div>

              <span className="text-[10px] font-medium text-[#D4AF37] bg-black/35 backdrop-blur-md border border-[#D4AF37]/25 px-2.5 py-0.5 rounded-full">
                ✦ {currentVideo.category}
              </span>
            </div>

            {currentVideo.mediaType === 'video' && (
              <button
                onClick={toggleMute}
                className="pointer-events-auto w-8 h-8 rounded-full bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center text-[#F7E7C1] hover:text-[#D4AF37] transition-transform"
                title={isMuted ? 'Activar sonido' : 'Silenciar'}
              >
                <span className="material-symbols-outlined text-sm">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>
            )}
          </div>

          {/* ==================== BARRA LATERAL DERECHA ESOTÉRICA (ESTILO TIKTOK LIMPIO) ==================== */}
          <div className="absolute right-3 bottom-16 z-20 flex flex-col items-center gap-4">
            {/* Avatar del Creador con Aro Místico + Botón '+' de Vínculo */}
            <div className="relative mb-1">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onViewTarotistaProfile(currentVideo.tarotistaId);
                }}
                className="w-12 h-12 rounded-full story-ring p-[2px] cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform"
              >
                <img
                  src={currentVideo.tarotistaAvatar}
                  alt={currentVideo.tarotistaName}
                  className="w-full h-full object-cover rounded-full bg-[#1A1026] border border-[#0B0911]"
                />
              </div>
              {currentUser && currentUser.id !== currentVideo.tarotistaId ? (
                <button
                  onClick={(e) => handleToggleFollow(e, currentVideo.tarotistaId)}
                  className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-[#0B0911] shadow-md transition-transform hover:scale-110 ${
                    isFollowingAuthor
                      ? 'bg-[#2E1B47] text-[#D4AF37]'
                      : 'bg-[#D4AF37] text-[#0B0911]'
                  }`}
                  title={isFollowingAuthor ? 'Siguiendo' : 'Seguir'}
                >
                  {isFollowingAuthor ? '✓' : '✦'}
                </button>
              ) : currentVideo.isVerified ? (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-[#0B0911] rounded-full w-4 h-4 flex items-center justify-center border border-[#0B0911] text-[9px] font-bold">
                  ☼
                </div>
              ) : null}
            </div>

            {/* 1. RESONAR (Llama Sagrada — reemplaza al corazón típico) */}
            <button
              onClick={handleToggleLike}
              className="flex flex-col items-center gap-0.5 group"
              title={currentVideo.isLikedByCurrentUser ? 'Retirar resonancia' : 'Resonar con esta visión'}
            >
              <div
                className={`p-1.5 transition-all group-active:scale-75 ${
                  currentVideo.isLikedByCurrentUser
                    ? 'text-[#D4AF37] esoteric-glow scale-110'
                    : 'text-[#F7E7C1] icon-drop-shadow group-hover:text-[#D4AF37]'
                }`}
              >
                <SacredFlameIcon className="w-8 h-8" filled={!!currentVideo.isLikedByCurrentUser} />
              </div>
              <span
                className={`text-xs font-bold icon-drop-shadow ${
                  currentVideo.isLikedByCurrentUser ? 'text-[#D4AF37]' : 'text-[#F7E7C1]'
                }`}
              >
                {currentVideo.likes}
              </span>
            </button>

            {/* 2. ORÁCULO / SUSURROS (Bola de Cristal — reemplaza al bocadillo de comentarios) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCommentsModal(true);
              }}
              className="flex flex-col items-center gap-0.5 group"
              title="Abrir Oráculo de Comentarios"
            >
              <div className="p-1.5 text-[#F7E7C1] icon-drop-shadow transition-all group-hover:text-[#D4AF37] group-active:scale-90">
                <CrystalBallIcon className="w-8 h-8" />
              </div>
              <span className="text-xs font-bold text-[#F7E7C1] icon-drop-shadow">
                {currentVideo.commentsCount}
              </span>
            </button>

            {/* 3. GRIMORIO (Carta Arcano — reemplaza al marcador típico) */}
            <button
              onClick={handleToggleSave}
              className="flex flex-col items-center gap-0.5 group"
              title={currentVideo.isSavedByCurrentUser ? 'Quitar de tu Grimorio' : 'Guardar en tu Grimorio'}
            >
              <div
                className={`p-1.5 transition-all group-active:scale-90 ${
                  currentVideo.isSavedByCurrentUser
                    ? 'text-[#D4AF37] esoteric-glow scale-105'
                    : 'text-[#F7E7C1] icon-drop-shadow group-hover:text-[#D4AF37]'
                }`}
              >
                <ArcanaGrimoireIcon className="w-8 h-8" filled={!!currentVideo.isSavedByCurrentUser} />
              </div>
              <span
                className={`text-[10px] font-semibold icon-drop-shadow ${
                  currentVideo.isSavedByCurrentUser ? 'text-[#D4AF37]' : 'text-[#F7E7C1]/90'
                }`}
              >
                {currentVideo.isSavedByCurrentUser ? 'En Grimorio' : 'Grimorio'}
              </span>
            </button>

            {/* 4. EXPANDIR (Estrella Fugaz — reemplaza a la flecha de compartir) */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-0.5 group"
              title="Expandir visión (Copiar enlace)"
            >
              <div className="p-1.5 text-[#F7E7C1] icon-drop-shadow transition-all group-hover:text-[#D4AF37] group-active:scale-90">
                <ShootingStarIcon className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-semibold text-[#F7E7C1]/90 icon-drop-shadow">
                Expandir
              </span>
            </button>
          </div>

          {/* ==================== METADATOS INFERIORES LIMPIOS (ESTILO TIKTOK / REELS) ==================== */}
          <div className="absolute bottom-4 left-4 right-16 z-20 flex flex-col gap-1.5 pointer-events-auto">
            {/* Píldora Sutil de Consulta Privada si es Tarotista Verificado */}
            {currentVideo.isVerified && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBookConsultation(currentVideo.tarotistaId);
                }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E1B47]/85 backdrop-blur-md border border-[#D4AF37]/45 text-xs w-fit shadow-lg hover:border-[#D4AF37] hover:scale-[1.02] transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                <span className="font-semibold text-[#F7E7C1]">Oráculo abierto</span>
                <span className="text-[#D4AF37] font-bold">
                  • Consultar {profile ? `(€${profile.pricePerMinEur.toFixed(2)}/m)` : ''} ✦
                </span>
              </button>
            )}

            <div className="flex items-center flex-wrap gap-2">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onViewTarotistaProfile(currentVideo.tarotistaId);
                }}
                className="flex items-center gap-1.5 cursor-pointer group"
              >
                <span className="font-cinzel text-sm sm:text-base font-bold text-[#F7E7C1] group-hover:text-[#D4AF37] transition-colors drop-shadow">
                  @{currentVideo.tarotistaName.toLowerCase().replace(/\s+/g, '_')}
                </span>
                {currentVideo.isVerified && (
                  <span
                    className="inline-flex items-center justify-center text-[#D4AF37] esoteric-glow"
                    title="Vidente Consagrada Verificada"
                  >
                    <AlchemicalSunIcon className="w-4 h-4" />
                  </span>
                )}
              </div>

              {currentUser && currentUser.id !== currentVideo.tarotistaId && !isFollowingAuthor && (
                <button
                  onClick={(e) => handleToggleFollow(e, currentVideo.tarotistaId)}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 backdrop-blur-md text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37] hover:text-[#0B0911] transition-all"
                >
                  + Seguir
                </button>
              )}
            </div>

            <p className="text-xs text-[#F7E7C1]/95 line-clamp-2 leading-relaxed drop-shadow">
              {currentVideo.title}
            </p>

            {currentVideo.description && (
              <p className="text-[11px] text-[#F7E7C1]/70 line-clamp-1 italic">
                {currentVideo.description}
              </p>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-[#D4AF37]/90 pt-0.5">
              <span>✦</span>
              <span className="truncate max-w-[200px]">
                {currentVideo.soundTitle || 'Frecuencia Astral KABALY'}
              </span>
            </div>
          </div>
        </div>

        {/* Drawer de Comentarios Reales con hilos de 1 nivel */}
        <CommentsDrawer
          isOpen={showCommentsModal}
          videoId={currentVideo?.id || ''}
          currentUser={currentUser}
          onClose={() => setShowCommentsModal(false)}
          onOpenAuthModal={() => {
            setShowCommentsModal(false);
            onOpenAuthModal?.();
          }}
          onCommentCountChange={(newCount) => {
            if (currentVideo) {
              setPosts(prev => prev.map(p => p.id === currentVideo.id ? { ...p, commentsCount: newCount } : p));
            }
          }}
        />
      </div>

      {/* Modales de Stories */}
      <CreateStoryModal
        isOpen={showCreateStoryModal}
        onClose={() => setShowCreateStoryModal(false)}
        onStoryCreated={() => {
          setShowCreateStoryModal(false);
          fetchStories();
        }}
      />

      <StoryViewerModal
        isOpen={!!selectedStoryGroup}
        storyGroup={selectedStoryGroup}
        currentUser={currentUser}
        onClose={() => setSelectedStoryGroup(null)}
        onStoryDeleted={() => {
          setSelectedStoryGroup(null);
          fetchStories();
        }}
        onViewersRequested={(storyId) => setViewersStoryId(storyId)}
      />

      <StoryViewersModal
        isOpen={!!viewersStoryId}
        storyId={viewersStoryId || ''}
        onClose={() => setViewersStoryId(null)}
      />

      {/* Modal de Confirmación de Desbloqueo de Publicación Exclusiva */}
      {confirmingUnlockPost && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] p-0.5 mx-auto gold-glow">
              <div className="w-full h-full bg-[#1A1026] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#D4AF37]">lock_open</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-widest block mb-1">
                Confirmar Desbloqueo de Contenido
              </span>
              <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">
                {confirmingUnlockPost.title}
              </h3>
              <p className="text-xs text-[#A7A7A7] mt-1">
                Autor: <strong className="text-[#D4AF37]">{confirmingUnlockPost.tarotistaName}</strong>
              </p>
            </div>

            <div className="bg-[#0B0911]/60 rounded-xl p-3 border border-[#D4AF37]/30 text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-[#F7E7C1]">
                <span>Precio en monedas:</span>
                <span className="font-bold text-[#D4AF37]">{confirmingUnlockPost.priceCoins || 100} Monedas</span>
              </div>
              <div className="flex justify-between text-[#A7A7A7]">
                <span>Tu saldo actual:</span>
                <span>{currentUser?.coinsBalance || 0} Monedas</span>
              </div>
              <div className="flex justify-between text-[#A7A7A7] pt-1 border-t border-white/10">
                <span>Saldo tras desbloqueo:</span>
                <span className="text-[#F7E7C1] font-bold">
                  {(currentUser?.coinsBalance || 0) - (confirmingUnlockPost.priceCoins || 100)} Monedas
                </span>
              </div>
            </div>

            {unlockError && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                {unlockError}
              </p>
            )}

            <p className="text-[10px] text-[#A7A7A7] italic">
              Esta compra es única y te concede acceso permanente a esta publicación desde tu sección privada «Mis compras».
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingUnlockPost(null)}
                disabled={isUnlocking}
                className="flex-1 py-2.5 rounded-xl border border-[#D4AF37]/40 text-xs font-bold text-[#A7A7A7] hover:text-[#F7E7C1]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                disabled={isUnlocking}
                className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isUnlocking ? 'Desbloqueando...' : `Desbloquear (${confirmingUnlockPost.priceCoins || 100} 🪙)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

