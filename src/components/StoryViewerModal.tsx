import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Story, StoryGroup, User } from '../types';
import { StoryViewersModal } from './StoryViewersModal';

interface StoryViewerModalProps {
  isOpen: boolean;
  storyGroup: StoryGroup | null;
  currentUser: User | null;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
  onStoryViewed?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  storyGroup,
  currentUser,
  onClose,
  onStoryDeleted,
  onStoryViewed,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<any>(null);

  const stories = storyGroup?.stories || [];
  const currentStory: Story | undefined = stories[currentIndex];
  const isAuthor = currentUser && currentStory && currentUser.id === currentStory.userId;

  // Registrar visualización única
  useEffect(() => {
    if (!currentStory || !isOpen) return;

    if (!currentStory.hasViewed && currentUser && currentUser.id !== currentStory.userId) {
      fetch(`/api/stories/${encodeURIComponent(currentStory.id)}/view`, {
        method: 'POST',
      }).then(() => {
        if (onStoryViewed) onStoryViewed(currentStory.id);
      }).catch(() => {});
    }
  }, [currentStory?.id, isOpen, currentUser, onStoryViewed]);

  // Manejar avance al siguiente story
  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Temporizador de barra de progreso
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || showViewersModal) return;

    const isVideo = currentStory.mediaType === 'video';
    const totalDurationMs = isVideo ? 15000 : 5000; // 5s para imagen, hasta 15s para vídeo por defecto
    const intervalMs = 50;
    const step = (intervalMs / totalDurationMs) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimerRef.current);
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isOpen, currentIndex, currentStory?.id, isPaused, showViewersModal, handleNext]);

  // Pausar reproducción cuando el documento pierde visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
        if (videoRef.current) videoRef.current.pause();
      } else {
        setIsPaused(false);
        if (videoRef.current) videoRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Borrado anticipado por el autor
  const handleDeleteStory = async () => {
    if (!currentStory || !confirm('¿Retirar esta story antes de que caduquen sus 24 horas?')) return;
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(currentStory.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (onStoryDeleted) onStoryDeleted(currentStory.id);
        if (stories.length <= 1) {
          onClose();
        } else {
          handleNext();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo retirar la story.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  if (!isOpen || !storyGroup || stories.length === 0 || !currentStory) return null;

  // Cálculo de tiempo restante relativo
  const hoursLeft = Math.max(0, Math.round((new Date(currentStory.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/95 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 select-none">
      <div 
        className="relative w-full max-w-sm h-[90vh] max-h-[780px] bg-black rounded-3xl overflow-hidden border-2 border-[#D4AF37]/50 shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Barras de progreso superiores */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {stories.map((story, idx) => (
            <div key={story.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] transition-all"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header con Creador, Tiempo y Opciones */}
        <div className="absolute top-7 left-3 right-3 z-30 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent p-2 rounded-2xl">
          <div className="flex items-center gap-2">
            <img
              src={storyGroup.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
              alt={storyGroup.userName}
              className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]"
            />
            <div>
              <p className="text-xs font-bold text-[#F7E7C1] leading-tight flex items-center gap-1">
                {storyGroup.userName}
              </p>
              <span className="text-[10px] text-[#D4AF37]/80">
                Caduca en {hoursLeft}h
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Si es autor: botón de visualizaciones */}
            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewersModal(true);
                }}
                className="p-1 px-2 rounded-full bg-black/60 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center gap-1 text-[11px] font-bold hover:scale-105 transition-transform"
                title="Ver quién vio tu story"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                {currentStory.viewsCount || 0}
              </button>
            )}

            {/* Si es autor: retirar story anticipadamente */}
            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStory();
                }}
                className="p-1.5 rounded-full bg-black/60 border border-red-500/40 text-red-400 hover:text-red-300"
                title="Retirar story"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            )}

            {/* Cerrar Visor */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 rounded-full bg-black/60 border border-white/20 text-[#F7E7C1] hover:text-[#D4AF37]"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Contenido Media (Foto o Vídeo) */}
        <div className="relative w-full h-full flex items-center justify-center bg-[#0B0911]">
          {currentStory.mediaType === 'image' ? (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleNext}
            />
          )}

          {/* Zonas táctiles para avanzar / retroceder */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute top-20 bottom-24 left-0 w-1/3 z-20 cursor-pointer"
            title="Anterior"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute top-20 bottom-24 right-0 w-1/3 z-20 cursor-pointer"
            title="Siguiente"
          />
        </div>

        {/* Caption Inferior */}
        {currentStory.caption && (
          <div className="absolute bottom-4 left-3 right-3 z-30 bg-black/70 backdrop-blur-md border border-[#D4AF37]/30 rounded-2xl p-3 text-center">
            <p className="text-xs text-[#F7E7C1] font-medium leading-relaxed">
              {currentStory.caption}
            </p>
          </div>
        )}
      </div>

      {/* Modal de Espectadores de la Story */}
      {showViewersModal && (
        <StoryViewersModal
          isOpen={showViewersModal}
          storyId={currentStory.id}
          onClose={() => setShowViewersModal(false)}
        />
      )}
    </div>
  );
};
