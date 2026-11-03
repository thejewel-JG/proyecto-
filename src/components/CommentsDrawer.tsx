import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Comment, User } from '../types';
import { SacredFlameIcon, CrystalBallIcon } from './EsotericIcons';

interface CommentsDrawerProps {
  isOpen: boolean;
  videoId: string;
  postAuthorId?: string;
  currentUser: User | null;
  onClose: () => void;
  onOpenAuthModal: () => void;
  onCommentCountChange?: (newCount: number) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  videoId,
  postAuthorId,
  currentUser,
  onClose,
  onOpenAuthModal,
  onCommentCountChange,
  onOpenUserProfile,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [sortBy, setSortBy] = useState<'resonated' | 'recent'>('resonated');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    if (!videoId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(videoId)}/comments`);
      if (!res.ok) throw new Error('Error al cargar comentarios.');
      const data = await res.json();
      setComments(data.comments || []);
      if (onCommentCountChange && typeof data.total === 'number') {
        onCommentCountChange(data.total);
      }
    } catch (err: any) {
      setError(err.message || 'No se pudieron sincronizar los comentarios.');
    } finally {
      setIsLoading(false);
    }
  }, [videoId, onCommentCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }

    const clean = text.trim();
    if (!clean) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(videoId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: clean,
          parentId: replyingTo?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fallo al publicar comentario.');
      }

      setText('');
      setReplyingTo(null);
      await fetchComments();
    } catch (err: any) {
      setSubmitError(err.message || 'Error al enviar comentario. Conservamos tu texto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLikeComment = async (commentId: string) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev =>
          prev.map(c => {
            if (c.id === commentId) {
              return { ...c, likesCount: data.likesCount, isLikedByCurrentUser: data.isLiked };
            }
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map(r =>
                  r.id === commentId ? { ...r, likesCount: data.likesCount, isLikedByCurrentUser: data.isLiked } : r
                ),
              };
            }
            return c;
          })
        );
      }
    } catch {
      // Silencioso
    }
  };

  const handleTogglePinComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/pin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchComments();
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('Error al fijar comentario.');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('¿Deseas eliminar este comentario?')) return;
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchComments();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar el comentario.');
      }
    } catch (err) {
      alert('Error de conexión al eliminar.');
    }
  };

  const handleStartReply = (comment: Comment) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setReplyingTo({ id: comment.id, authorName: comment.authorName });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (!isOpen) return null;

  const isPostOwner = currentUser && (currentUser.id === postAuthorId || currentUser.role === 'admin');
  const sortedComments = [...comments].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return Number(!!b.isPinned) - Number(!!a.isPinned);
    if (sortBy === 'resonated') {
      return (b.likesCount || 0) - (a.likesCount || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="absolute inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-xl flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#140D21] border-t border-[#D4AF37]/35 rounded-t-3xl p-4 sm:p-5 h-[80%] max-h-[600px] flex flex-col justify-between shadow-2xl">
        {/* Header con selector de orden */}
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <CrystalBallIcon className="w-5 h-5" filled />
            <span className="font-cinzel text-sm text-[#F7E7C1] font-bold">Oráculo de Comentarios</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#0B0911] border border-white/10 rounded-full p-0.5 text-[10px]">
              <button
                onClick={() => setSortBy('resonated')}
                className={`px-2 py-0.5 rounded-full font-bold transition ${
                  sortBy === 'resonated' ? 'bg-[#D4AF37] text-[#0B0911]' : 'text-[#A09BAE] hover:text-white'
                }`}
              >
                🔥 Resonados
              </button>
              <button
                onClick={() => setSortBy('recent')}
                className={`px-2 py-0.5 rounded-full font-bold transition ${
                  sortBy === 'recent' ? 'bg-[#D4AF37] text-[#0B0911]' : 'text-[#A09BAE] hover:text-white'
                }`}
              >
                ⏳ Recientes
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full text-[#F7E7C1]/60 hover:text-[#F7E7C1] hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lista de comentarios */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#D4AF37]">
              <span className="material-symbols-outlined text-3xl animate-spin">auto_awesome</span>
              <span className="text-xs text-[#A7A7A7]">Leyendo el aura de los comentarios...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-xs text-red-400 space-y-2">
              <p>{error}</p>
              <button
                onClick={fetchComments}
                className="bg-[#5A2D82] text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold"
              >
                Reintentar
              </button>
            </div>
          ) : sortedComments.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#2E1B47]/40 border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
                <CrystalBallIcon className="w-6 h-6" />
              </div>
              <h4 className="font-cinzel text-xs font-bold text-[#F7E7C1]">Sé el primero en manifestarte</h4>
              <p className="text-[11px] text-[#A7A7A7] max-w-xs mx-auto">
                Comparte tu intuición, bendición o reflexión espiritual sobre esta visión.
              </p>
            </div>
          ) : (
            sortedComments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                {/* Comentario Raíz */}
                <div className="flex items-start gap-2.5 group">
                  <img
                    src={comment.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                    alt={comment.authorName}
                    onClick={() => {
                      if (onOpenUserProfile) {
                        onClose();
                        onOpenUserProfile(comment.authorId);
                      }
                    }}
                    className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]/40 flex-shrink-0 cursor-pointer hover:scale-105 transition"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`rounded-2xl p-2.5 text-xs flex items-start justify-between gap-2 ${
                        comment.isPinned
                          ? 'bg-[#2E1B47]/50 border border-[#D4AF37]/60'
                          : 'bg-[#0B0911]/70 border border-white/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span
                            onClick={() => {
                              if (onOpenUserProfile) {
                                onClose();
                                onOpenUserProfile(comment.authorId);
                              }
                            }}
                            className="font-bold text-[#D4AF37] text-[11px] truncate cursor-pointer hover:underline"
                          >
                            {comment.authorName}
                          </span>
                          {postAuthorId && comment.authorId === postAuthorId && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-[#0B0911] text-[8px] font-bold uppercase">
                              ✦ Creador
                            </span>
                          )}
                          {comment.isPinned && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#1A1026] border border-[#D4AF37]/50 text-[#D4AF37] text-[8px] font-bold">
                              ✦ Fijado
                            </span>
                          )}
                          <span className="text-[9px] text-[#7A7280]">
                            {new Date(comment.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed break-words ${comment.isDeleted ? 'italic text-[#7A7280]' : 'text-[#F7E7C1]'}`}>
                          {comment.content}
                        </p>
                      </div>

                      {!comment.isDeleted && (
                        <button
                          onClick={() => handleToggleLikeComment(comment.id)}
                          className={`flex flex-col items-center shrink-0 pt-0.5 transition ${
                            comment.isLikedByCurrentUser ? 'text-[#D4AF37] esoteric-glow' : 'text-[#F7E7C1]/45 hover:text-[#D4AF37]'
                          }`}
                          title="Resonar con este comentario"
                        >
                          <SacredFlameIcon className="w-4 h-4" filled={!!comment.isLikedByCurrentUser} />
                          {(comment.likesCount || 0) > 0 && (
                            <span className="text-[9px] font-bold">{comment.likesCount}</span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 ml-2 text-[10px] text-[#A7A7A7]">
                      {!comment.isDeleted && (
                        <button
                          onClick={() => handleStartReply(comment)}
                          className="hover:text-[#D4AF37] font-semibold transition-colors flex items-center gap-0.5"
                        >
                          <span>✦ Responder</span>
                        </button>
                      )}
                      {isPostOwner && !comment.isDeleted && (
                        <button
                          onClick={() => handleTogglePinComment(comment.id)}
                          className="hover:text-[#D4AF37] transition-colors text-[#D4AF37]/80 font-semibold"
                        >
                          {comment.isPinned ? 'Desfijar' : '✦ Fijar arriba'}
                        </button>
                      )}
                      {(currentUser?.id === comment.authorId || currentUser?.role === 'admin') && !comment.isDeleted && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="hover:text-red-400 transition-colors flex items-center gap-0.5 text-red-400/80"
                        >
                          <span>Borrar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Respuestas anidadas (1 nivel) */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-10 space-y-2 border-l border-[#D4AF37]/25 pl-3">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2 group">
                        <img
                          src={reply.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                          alt={reply.authorName}
                          onClick={() => {
                            if (onOpenUserProfile) {
                              onClose();
                              onOpenUserProfile(reply.authorId);
                            }
                          }}
                          className="w-6 h-6 rounded-full object-cover border border-[#D4AF37]/30 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="bg-[#0B0911]/50 border border-white/5 rounded-xl p-2 text-xs flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  onClick={() => {
                                    if (onOpenUserProfile) {
                                      onClose();
                                      onOpenUserProfile(reply.authorId);
                                    }
                                  }}
                                  className="font-bold text-[#D4AF37] text-[10px] truncate cursor-pointer hover:underline"
                                >
                                  {reply.authorName}
                                </span>
                                <span className="text-[8px] text-[#7A7280]">
                                  {new Date(reply.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#cec3d1] leading-relaxed break-words">
                                {reply.content}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleLikeComment(reply.id)}
                              className={`flex flex-col items-center shrink-0 transition ${
                                reply.isLikedByCurrentUser ? 'text-[#D4AF37]' : 'text-[#F7E7C1]/40 hover:text-[#D4AF37]'
                              }`}
                            >
                              <SacredFlameIcon className="w-3.5 h-3.5" filled={!!reply.isLikedByCurrentUser} />
                              {(reply.likesCount || 0) > 0 && (
                                <span className="text-[8px] font-bold">{reply.likesCount}</span>
                              )}
                            </button>
                          </div>

                          {(currentUser?.id === reply.authorId || currentUser?.role === 'admin') && (
                            <button
                              onClick={() => handleDelete(reply.id)}
                              className="hover:text-red-400 transition-colors flex items-center gap-0.5 text-[9px] text-red-400/70 ml-2 mt-0.5"
                            >
                              Borrar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input & Formulario inferior */}
        <div className="pt-2 border-t border-white/10">
          {replyingTo && (
            <div className="flex justify-between items-center bg-[#2E1B47]/60 border border-[#D4AF37]/30 px-3 py-1 rounded-full mb-2 text-[10px] text-[#D4AF37]">
              <span>Respondiendo a <strong>@{replyingTo.authorName}</strong></span>
              <button onClick={() => setReplyingTo(null)} className="hover:text-white">
                ✕
              </button>
            </div>
          )}

          {submitError && (
            <p className="text-[10px] text-red-400 mb-1.5 px-1">{submitError}</p>
          )}

          {currentUser ? (
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  placeholder={replyingTo ? `Escribe tu respuesta a @${replyingTo.authorName}...` : 'Deja tu visión en el oráculo...'}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-2xl px-3 py-2 text-xs text-[#F7E7C1] placeholder:text-[#7A7280] outline-none focus:border-[#D4AF37] transition-all resize-none"
                />
                <span className="absolute bottom-1 right-2 text-[9px] text-[#7A7280]">
                  {text.length}/500
                </span>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !text.trim()}
                className="bg-[#D4AF37] text-[#0B0911] px-4 py-3 rounded-2xl font-bold text-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 flex-shrink-0 gold-glow"
                title="Publicar comentario"
              >
                ✦
              </button>
            </form>
          ) : (
            <div className="text-center p-3 bg-[#0B0911]/60 rounded-2xl border border-[#D4AF37]/20">
              <p className="text-[11px] text-[#A7A7A7] mb-2">Inicia sesión para dejar tu comentario o responder a otros buscadores.</p>
              <button
                onClick={onOpenAuthModal}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider gold-glow"
              >
                Identifícate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
