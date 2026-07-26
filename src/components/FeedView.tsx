import React, { useState } from 'react';
import { Video, User, TarotistaProfile, Category } from '../types';

interface FeedViewProps {
  videos: Video[];
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  activeCategory?: Category;
  onLikeVideo: (videoId: string) => void;
  onUnlockVideo: (videoId: string) => void;
  onBookConsultation: (tarotistaId: string) => void;
  onViewTarotistaProfile: (tarotistaId: string) => void;
  onOpenWallet: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  videos,
  currentUser,
  tarotistaProfiles,
  activeCategory = 'Para ti',
  onLikeVideo,
  onUnlockVideo,
  onBookConsultation,
  onViewTarotistaProfile,
  onOpenWallet,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter videos according to active category
  const filteredVideos = React.useMemo(() => {
    if (!activeCategory || activeCategory === 'Para ti') {
      return videos;
    }
    if (activeCategory === 'Siguiendo') {
      // Show verified featured creators or videos from followed creators
      return videos.filter(v => v.isVerified || (currentUser.followingIds && currentUser.followingIds.includes(v.tarotistaId)));
    }
    const matches = videos.filter(v => v.category === activeCategory);
    return matches.length > 0 ? matches : videos;
  }, [videos, activeCategory, currentUser]);

  // Reset current index when category changes
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [activeCategory]);

  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<{ name: string; text: string; time: string }[]>([
    { name: 'Sofia V.', text: 'Esta lectura resuena muchísimo conmigo. Gracias Luna! ✨', time: 'Hace 5m' },
    { name: 'Carlos R.', text: 'Justo lo que necesitaba escuchar en este momento.', time: 'Hace 12m' },
    { name: 'Elena P.', text: 'Recomiendo 100% sus consultas privadas por videollamada, es mágica.', time: 'Hace 30m' },
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [heartAnim, setHeartAnim] = useState<{ x: number; y: number; id: number } | null>(null);

  const currentVideo = filteredVideos[currentIndex] || filteredVideos[0];

  if (!currentVideo) {
    return (
      <div className="relative w-full h-[calc(100vh-110px)] max-w-md mx-auto bg-[#0B0911] overflow-hidden rounded-2xl shadow-2xl border border-[#D4AF37]/20 flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#D4AF37] animate-spin">auto_awesome</span>
          <p className="text-xs text-[#F7E7C1] font-playfair">Conectando con el cosmos...</p>
          <span className="text-[10px] text-[#A7A7A7]">No hay publicaciones en la categoría {activeCategory}</span>
        </div>
      </div>
    );
  }

  const handleNextVideo = () => {
    if (currentIndex < filteredVideos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0); // loop back
    }
  };

  const handlePrevVideo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHeartAnim({ x, y, id: Date.now() });
    if (!currentVideo.isLikedByCurrentUser) {
      onLikeVideo(currentVideo.id);
    }

    setTimeout(() => {
      setHeartAnim(null);
    }, 900);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setComments([
      { name: currentUser.name, text: newCommentText.trim(), time: 'Ahora' },
      ...comments,
    ]);
    setNewCommentText('');
  };

  const isUnlocked = !currentVideo.isPremium || (currentVideo.unlockedByUserIds && currentVideo.unlockedByUserIds.includes(currentUser.id));

  const profile = tarotistaProfiles.find(p => p.id === currentVideo?.tarotistaId);

  return (
    <div className="relative w-full h-[calc(100vh-110px)] max-w-md mx-auto bg-[#0B0911] overflow-hidden rounded-2xl shadow-2xl border border-[#D4AF37]/20 flex flex-col justify-between select-none">
      {/* Video Canvas Container */}
      <div 
        className="relative w-full h-full cursor-pointer flex items-center justify-center bg-black"
        onClick={handleDoubleTap}
      >
        {/* Background Video element */}
        <video
          key={currentVideo.id}
          src={currentVideo.videoUrl}
          poster={currentVideo.thumbnailUrl}
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-all duration-300 ${!isUnlocked ? 'blur-xl scale-105 opacity-40' : ''}`}
        />

        <div className="absolute inset-0 video-overlay-gradient pointer-events-none" />

        {/* Double-tap heart particle animation */}
        {heartAnim && (
          <div
            className="absolute pointer-events-none z-30 animate-ping text-[#D4AF37]"
            style={{ left: heartAnim.x - 24, top: heartAnim.y - 24 }}
          >
            <span className="material-symbols-outlined text-5xl filled">favorite</span>
          </div>
        )}

        {/* Premium Locked Video Blur & Gold Lock Overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#0B0911]/70 backdrop-blur-md">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] p-0.5 mb-4 gold-glow">
              <div className="w-full h-full bg-[#1A1026] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-[#D4AF37]">lock</span>
              </div>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] mb-1">
              Contenido Exclusivo Premium
            </span>
            <h3 className="font-playfair text-xl text-[#F7E7C1] font-semibold mb-2">
              {currentVideo.title}
            </h3>
            <p className="text-xs text-[#A7A7A7] max-w-xs mb-6">
              Desbloquea esta revelación del destino por sólo <span className="text-[#D4AF37] font-bold">{currentVideo.priceCoins || 30} Monedas</span>
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentUser.coinsBalance < (currentVideo.priceCoins || 30)) {
                  onOpenWallet();
                } else {
                  onUnlockVideo(currentVideo.id);
                }
              }}
              className="w-full max-w-xs bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-3.5 rounded-full flex items-center justify-center gap-2 gold-glow hover:scale-105 active:scale-95 transition-all text-xs tracking-wider uppercase"
            >
              <span className="material-symbols-outlined text-sm">lock_open</span>
              Desbloquear con {currentVideo.priceCoins || 30} Monedas
            </button>
          </div>
        )}

        {/* Vertical Navigation Indicator (Up / Down Controls for preview) */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#0B0911]/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/20">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrevVideo(); }}
            className="hover:text-[#D4AF37] transition-colors"
            title="Anterior vídeo"
          >
            <span className="material-symbols-outlined text-sm">expand_less</span>
          </button>
          <span className="text-[10px] text-[#D4AF37] font-bold">
            {currentIndex + 1} / {filteredVideos.length}
          </span>
          <button 
            onClick={(e) => { e.stopPropagation(); handleNextVideo(); }}
            className="hover:text-[#D4AF37] transition-colors"
            title="Siguiente vídeo"
          >
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        </div>

        {/* Right Action Side Bar */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-5">
          {/* Tarotista Avatar */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onViewTarotistaProfile(currentVideo.tarotistaId);
            }}
            className="group relative cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37] overflow-hidden p-0.5 bg-[#1A1026] gold-glow">
              <img
                src={currentVideo.tarotistaAvatar}
                alt={currentVideo.tarotistaName}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="absolute -bottom-1.5 right-1/2 translate-x-1/2 bg-[#D4AF37] text-[#0B0911] rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#0B0911]">
              <span className="material-symbols-outlined text-[10px] font-bold">add</span>
            </div>
          </div>

          {/* Like Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLikeVideo(currentVideo.id);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className={`p-2.5 rounded-full glass-card transition-all group-active:scale-90 ${currentVideo.isLikedByCurrentUser ? 'text-red-500 border-red-500/50' : 'text-[#F7E7C1]'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentVideo.isLikedByCurrentUser ? 'filled' : ''}`}>
                favorite
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#F7E7C1]">{currentVideo.likes}</span>
          </button>

          {/* Comments Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCommentsModal(true);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className="p-2.5 rounded-full glass-card text-[#F7E7C1] transition-all group-active:scale-90">
              <span className="material-symbols-outlined text-2xl">chat_bubble</span>
            </div>
            <span className="text-[10px] font-bold text-[#F7E7C1]">{currentVideo.commentsCount + comments.length - 3}</span>
          </button>

          {/* Quick Book Consultation Action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookConsultation(currentVideo.tarotistaId);
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className="p-2.5 rounded-full bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]/50 gold-glow transition-all group-hover:scale-110 group-active:scale-90">
              <span className="material-symbols-outlined text-2xl">event_available</span>
            </div>
            <span className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-wider">Reservar</span>
          </button>

          {/* Share Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert('Enlace copiado al portapapeles. ¡Compartiendo energía mística!');
            }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className="p-2.5 rounded-full glass-card text-[#F7E7C1] transition-all group-active:scale-90">
              <span className="material-symbols-outlined text-2xl">share</span>
            </div>
            <span className="text-[10px] font-bold text-[#F7E7C1]">{currentVideo.sharesCount}</span>
          </button>
        </div>

        {/* Bottom Metadata Info */}
        <div className="absolute bottom-4 left-4 right-20 z-20 flex flex-col gap-2 pointer-events-auto">
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onViewTarotistaProfile(currentVideo.tarotistaId);
            }}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <span className="font-playfair text-base font-bold text-[#F7E7C1] hover:text-[#D4AF37] transition-colors">
              {currentVideo.tarotistaName}
            </span>
            {currentVideo.isVerified && (
              <span className="material-symbols-outlined text-[#D4AF37] text-sm filled" title="Profesional Verificado">
                verified
              </span>
            )}
            {profile && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5A2D82]/80 border border-[#D4AF37]/30 text-[#D4AF37] font-semibold">
                €{profile.pricePerMinEur.toFixed(2)}/min
              </span>
            )}
          </div>

          <p className="text-xs text-[#cec3d1] line-clamp-2 leading-relaxed">
            {currentVideo.title}
          </p>

          <div className="flex items-center gap-2 bg-[#0B0911]/60 backdrop-blur-md rounded-full px-3 py-1 w-fit border border-[#D4AF37]/20">
            <span className="material-symbols-outlined text-xs text-[#D4AF37]">music_note</span>
            <span className="text-[10px] text-[#A7A7A7] truncate max-w-[140px]">
              {currentVideo.soundTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Comments Drawer Modal */}
      {showCommentsModal && (
        <div className="absolute inset-0 z-50 bg-[#0B0911]/80 backdrop-blur-xl flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#1A1026] border-t border-[#D4AF37]/30 rounded-t-3xl p-4 h-3/4 flex flex-col justify-between">
            <div className="flex justify-between items-center pb-3 border-b border-[#D4AF37]/20">
              <span className="font-playfair text-sm text-[#D4AF37] font-bold">Comentarios ({comments.length})</span>
              <button
                onClick={() => setShowCommentsModal(false)}
                className="text-[#A7A7A7] hover:text-[#F7E7C1]"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto no-scrollbar my-3 space-y-3">
              {comments.map((c, i) => (
                <div key={i} className="flex gap-2.5 items-start bg-[#2E1B47]/30 p-2.5 rounded-xl border border-[#D4AF37]/10">
                  <div className="w-7 h-7 rounded-full bg-[#5A2D82] flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#D4AF37]">{c.name}</span>
                      <span className="text-[9px] text-[#A7A7A7]">{c.time}</span>
                    </div>
                    <p className="text-xs text-[#F7E7C1] mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-[#D4AF37]/20">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Añade un comentario místico..."
                className="flex-1 bg-[#0B0911] border border-[#D4AF37]/30 rounded-full px-4 py-2 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="bg-[#5A2D82] text-[#D4AF37] px-4 py-2 rounded-full text-xs font-bold hover:brightness-110"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
