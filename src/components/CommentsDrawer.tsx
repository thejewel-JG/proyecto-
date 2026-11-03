import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Comment, User } from '../types';

interface CommentsDrawerProps {
  isOpen: boolean;
  videoId: string;
  currentUser: User | null;
  onClose: () => void;
  onOpenAuthModal: () => void;
  onCommentCountChange?: (newCount: number) => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  videoId,
  currentUser,
  onClose,
  onOpenAuthModal,
  onCommentCountChange,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
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

      // Limpiar texto solo tras éxito
      setText('');
      setReplyingTo(null);

      // Recargar comentarios completos
      await fetchComments();
    } catch (err: any) {
      setSubmitError(err.message || 'Error al enviar comentario. Conservamos tu texto.');
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="absolute inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-xl flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#1A1026] border-t-2 border-[#D4AF37]/40 rounded-t-3xl p-4 sm:p-6 h-[80%] max-h-[600px] flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-lg">chat</span>
            <span className="font-cinzel text-sm text-[#F7E7C1] font-bold">Comentarios Cósmicos</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#A7A7A7] hover:text-[#F7E7C1] hover:bg-[#5A2D82]/30 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
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
          ) : comments.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#5A2D82]/30 border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
                <span className="material-symbols-outlined text-2xl">forum</span>
              </div>
              <h4 className="font-cinzel text-xs font-bold text-[#F7E7C1]">Sé el primero en manifestarte</h4>
              <p className="text-[11px] text-[#A7A7A7] max-w-xs mx-auto">
                Comparte tu intuición, bendición o reflexión espiritual sobre esta publicación.
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                {/* Comentario Raíz */}
                <div className="flex items-start gap-2.5 group">
                  <img
                    src={comment.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                    alt={comment.authorName}
                    className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]/40 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#0B0911]/60 border border-[#D4AF37]/15 rounded-2xl p-2.5 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[#D4AF37] text-[11px] truncate">
                          {comment.authorName}
                        </span>
                        <span className="text-[9px] text-[#7A7280]">
                          {new Date(comment.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed break-words ${comment.isDeleted ? 'italic text-[#7A7280]' : 'text-[#F7E7C1]'}`}>
                        {comment.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mt-1 ml-2 text-[10px] text-[#A7A7A7]">
                      {!comment.isDeleted && (
                        <button
                          onClick={() => handleStartReply(comment)}
                          className="hover:text-[#D4AF37] font-semibold transition-colors flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">reply</span>
                          Responder
                        </button>
                      )}
                      {(currentUser?.id === comment.authorId || currentUser?.role === 'admin') && !comment.isDeleted && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="hover:text-red-400 transition-colors flex items-center gap-0.5 text-red-400/80"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                          Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Respuestas anidadas (1 nivel) */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-10 space-y-2 border-l-2 border-[#D4AF37]/20 pl-3">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2 group">
                        <img
                          src={reply.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                          alt={reply.authorName}
                          className="w-6 h-6 rounded-full object-cover border border-[#D4AF37]/30 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="bg-[#0B0911]/40 border border-[#D4AF37]/10 rounded-xl p-2 text-xs">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-bold text-[#D4AF37] text-[10px] truncate">
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

                          {(currentUser?.id === reply.authorId || currentUser?.role === 'admin') && (
                            <button
                              onClick={() => handleDelete(reply.id)}
                              className="hover:text-red-400 transition-colors flex items-center gap-0.5 text-[9px] text-red-400/70 ml-2 mt-0.5"
                            >
                              <span className="material-symbols-outlined text-[10px]">delete</span>
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
        <div className="pt-2 border-t border-[#D4AF37]/20">
          {replyingTo && (
            <div className="flex justify-between items-center bg-[#5A2D82]/40 border border-[#D4AF37]/30 px-3 py-1 rounded-full mb-2 text-[10px] text-[#D4AF37]">
              <span>Respondiendo a <strong>@{replyingTo.authorName}</strong></span>
              <button onClick={() => setReplyingTo(null)} className="hover:text-white">
                <span className="material-symbols-outlined text-xs">close</span>
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
                  placeholder={replyingTo ? `Escribe tu respuesta a @${replyingTo.authorName}...` : 'Escribe tu comentario sagrado...'}
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
                className="bg-[#D4AF37] text-[#0B0911] p-3 rounded-full hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 flex-shrink-0 gold-glow"
                title="Publicar comentario"
              >
                <span className="material-symbols-outlined text-base font-bold">send</span>
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
