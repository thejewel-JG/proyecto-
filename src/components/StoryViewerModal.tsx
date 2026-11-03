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
  onViewersRequested?: (storyId: string) => void;
}

const ORACLE_CARDS = [
  { id: 0, numeral: 'I', arcana: 'La Estrella (XVII)', msg: 'Un ciclo de sanación y claridad estelar se abre ante ti hoy.' },
  { id: 1, numeral: 'II', arcana: 'La Rueda de la Fortuna (X)', msg: 'Un giro inesperado a tu favor está en marcha. Confía en el sincronismo.' },
  { id: 2, numeral: 'III', arcana: 'La Sacerdotisa (II)', msg: 'Tu intuición ya conoce la respuesta. Escucha tus sueños esta noche.' },
];

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
  const [replyText, setReplyText] = useState('');
  const [replyToast, setReplyToast] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showOracleSticker, setShowOracleSticker] = useState(false);
  const [revealedCardIndex, setRevealedCardIndex] = useState<number | null>(null);

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

  // Fijar Story actual en las Auras Destacadas permanentes del autor
  const handleSaveToHighlights = async () => {
    if (!currentStory) return;
    const title = prompt('Título para fijar en tus Auras Destacadas permanentes:', currentStory.caption?.slice(0, 20) || 'Aura Astral');
    if (!title) return;
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          coverUrl: currentStory.mediaUrl,
          mediaUrl: currentStory.mediaUrl,
          mediaType: currentStory.mediaType,
        }),
      });
      if (res.ok) {
        setReplyToast('✦ Fijada en tus Auras Destacadas permanentes');
        setTimeout(() => setReplyToast(null), 2600);
      }
    } catch {
      alert('Error al fijar en Auras Destacadas');
    }
  };

  // Enviar reacción rápida o respuesta DM desde la Story
  const handleSendStoryReply = async (contentText: string) => {
    if (!currentUser || !currentStory || !contentText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const convRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: currentStory.userId }),
      });
      if (!convRes.ok) throw new Error('No se pudo abrir canal astral');
      const convData = await convRes.json();
      const convId = convData.conversation?.id;
      if (!convId) throw new Error('Conversación inválida');

      const msgContent = `✨ [Respuesta a tu Aura de 24h]: ${contentText.trim()}`;
      await fetch(`/api/conversations/${encodeURIComponent(convId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: msgContent,
          clientMessageId: `story_reply_${Date.now()}`,
        }),
      });

      setReplyText('');
      setReplyToast(`✦ Susurro enviado a ${storyGroup?.userName}`);
      setTimeout(() => setReplyToast(null), 2400);
    } catch {
      alert('No se pudo enviar el susurro a esta story.');
    } finally {
      setIsSendingReply(false);
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

          <div className="flex items-center gap-1.5">
            {/* Sticker interactivo: Oráculo de 3 Cartas */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(true);
                setShowOracleSticker(prev => !prev);
                setRevealedCardIndex(null);
              }}
              className="px-2.5 py-1 rounded-full bg-[#2E1B47]/90 border border-[#D4AF37]/50 text-[#D4AF37] text-[10px] font-bold hover:scale-105 transition-transform"
              title="Revelar tu carta del día en esta Story"
            >
              🎴 Elige tu Carta
            </button>

            {/* Si es autor: Fijar en Auras Destacadas permanentes */}
            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveToHighlights();
                }}
                className="p-1 px-2 rounded-full bg-black/60 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center gap-1 text-[10px] font-bold hover:scale-105 transition-transform"
                title="Fijar en mis Auras Destacadas permanentes"
              >
                ✦ Fijar Aura
              </button>
            )}

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

        {/* Toast de confirmación de reacción o fijado */}
        {replyToast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#1A1026]/95 border border-[#D4AF37] text-[#D4AF37] px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl whitespace-nowrap">
            {replyToast}
          </div>
        )}

        {/* Sticker Interactivo "Elige tu Carta" sobre la Story */}
        {showOracleSticker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-4 top-28 z-40 bg-[#120D1D]/95 backdrop-blur-2xl border-2 border-[#D4AF37] rounded-3xl p-4 text-center space-y-3 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">
                ✦ Oráculo Interactivo de {storyGroup.userName}
              </span>
              <button
                onClick={() => {
                  setShowOracleSticker(false);
                  setIsPaused(false);
                }}
                className="text-xs text-[#A09BAE] hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#F7E7C1]">
              Concéntrate en tu pregunta y toca una de las 3 cartas veladas:
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {ORACLE_CARDS.map((card, idx) => {
                const isRevealed = revealedCardIndex === idx;
                return (
                  <button
                    key={card.id}
                    onClick={() => setRevealedCardIndex(idx)}
                    className={`aspect-[2/3] rounded-2xl border-2 p-2 flex flex-col items-center justify-center transition-all ${
                      isRevealed
                        ? 'bg-gradient-to-b from-[#2E1B47] to-[#0B0911] border-[#D4AF37] scale-105 shadow-[0_0_16px_rgba(212,175,55,0.4)]'
                        : 'bg-[#1A1026] border-[#D4AF37]/40 hover:border-[#D4AF37] hover:scale-105'
                    }`}
                  >
                    <span className="font-cinzel text-base font-bold text-[#D4AF37]">{card.numeral}</span>
                    <span className="text-lg my-1">{isRevealed ? '🔮' : '✦'}</span>
                    <span className="text-[9px] text-[#F7E7C1] font-bold leading-tight">
                      {isRevealed ? card.arcana : 'Tocar para revelar'}
                    </span>
                  </button>
                );
              })}
            </div>
            {revealedCardIndex !== null && (
              <div className="p-3 rounded-2xl bg-[#0B0911]/90 border border-[#D4AF37]/40 text-xs text-[#F7E7C1] space-y-1">
                <p className="font-bold text-[#D4AF37]">{ORACLE_CARDS[revealedCardIndex].arcana}</p>
                <p className="text-[11px] text-[#F7E7C1]/90 leading-relaxed">{ORACLE_CARDS[revealedCardIndex].msg}</p>
              </div>
            )}
          </div>
        )}

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
            className="absolute top-20 bottom-32 left-0 w-1/3 z-20 cursor-pointer"
            title="Anterior"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute top-20 bottom-32 right-0 w-1/3 z-20 cursor-pointer"
            title="Siguiente"
          />
        </div>

        {/* Footer: Caption + Barra de Reacciones Esotéricas y Susurro Directo (DM) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsPaused(true);
          }}
          className="absolute bottom-3 left-3 right-3 z-30 space-y-2"
        >
          {currentStory.caption && (
            <div className="bg-black/70 backdrop-blur-md border border-[#D4AF37]/30 rounded-2xl p-2.5 text-center">
              <p className="text-xs text-[#F7E7C1] font-medium leading-relaxed">
                {currentStory.caption}
              </p>
            </div>
          )}

          {currentUser && !isAuthor && (
            <div className="bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl p-2 space-y-1.5">
              {/* Reacciones Esotéricas Instantáneas */}
              <div className="flex items-center justify-around px-2">
                {[
                  { icon: '✦', label: 'Luz Astral' },
                  { icon: '🔥', label: 'Llama Sagrada' },
                  { icon: '🌙', label: 'Bendición Lunar' },
                  { icon: '🔮', label: 'Visión Certera' },
                  { icon: '🧿', label: 'Protección' },
                ].map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => handleSendStoryReply(`${r.icon} ${r.label}`)}
                    className="px-2.5 py-1 rounded-full hover:bg-[#2E1B47] text-sm transition-transform hover:scale-125 active:scale-95"
                    title={`Enviar ${r.label}`}
                  >
                    {r.icon}
                  </button>
                ))}
              </div>

              {/* Input para responder por DM */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendStoryReply(replyText);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={replyText}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Enviar susurro a ${storyGroup.userName}...`}
                  className="flex-1 bg-[#140D21] border border-[#D4AF37]/30 rounded-full px-3.5 py-1.5 text-xs text-[#F7E7C1] placeholder-[#A09BAE] outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSendingReply}
                  className="px-3 py-1.5 rounded-full bg-[#D4AF37] text-[#0B0911] font-bold text-xs disabled:opacity-40"
                >
                  ✦
                </button>
              </form>
            </div>
          )}
        </div>
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
