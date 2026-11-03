import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, PrivateChatMessage, User } from '../types';
import { ReportMessageModal } from './ReportMessageModal';

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User;
  onClose: () => void;
  onConversationUpdated?: (updated: Partial<Conversation>) => void;
  onOpenProfile?: (userId: string) => void;
  onBookConsultation?: (tarotistaId: string) => void;
  onOpenPost?: (postId: string) => void;
}

interface LocalChatMessage extends PrivateChatMessage {
  isOptimistic?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  onClose,
  onConversationUpdated,
  onOpenProfile,
  onBookConsultation,
  onOpenPost,
}) => {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blocking state
  const [isBlockedByMe, setIsBlockedByMe] = useState(conversation.isBlockedByMe);
  const [hasBlockedMe, setHasBlockedMe] = useState(conversation.hasBlockedMe);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Reporting state
  const [reportingMessage, setReportingMessage] = useState<PrivateChatMessage | null>(null);

  // Scroll ref
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const otherUser = conversation.otherUser;

  // Actualizar estado de scroll antes de mutar
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;

    // Cargar historial anterior si llega arriba del todo
    if (el.scrollTop === 0 && hasMoreOlder && !isLoadingMore) {
      loadOlderMessages();
    }
  };

  // Marcar como leídos
  const markAsRead = useCallback(async () => {
    if (document.hidden) return;
    try {
      await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/read`, {
        method: 'POST',
      });
      if (onConversationUpdated) {
        onConversationUpdated({ unreadCount: 0 });
      }
    } catch (e) {
      // silencioso
    }
  }, [conversation.id, onConversationUpdated]);

  // Carga inicial de mensajes
  const loadInitialMessages = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/messages?limit=40`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setHasMoreOlder(!!data.hasMore);
        setOldestCursor(data.nextCursor);

        // Auto-scroll al final en la carga inicial
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 50);

        markAsRead();
      }
    } catch (err) {
      console.error('Error al cargar mensajes iniciales:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversation.id, markAsRead]);

  // Cargar mensajes más antiguos preservando posición de scroll
  const loadOlderMessages = async () => {
    if (!oldestCursor || isLoadingMore) return;
    setIsLoadingMore(true);

    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversation.id)}/messages?limit=30&cursor=${encodeURIComponent(oldestCursor)}`
      );
      if (res.ok) {
        const data = await res.json();
        const older = data.messages || [];
        setHasMoreOlder(!!data.hasMore);
        setOldestCursor(data.nextCursor);

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const filtered = older.filter((m: PrivateChatMessage) => !existingIds.has(m.id));
          return [...filtered, ...prev];
        });

        // Restaurar posición de scroll relativa
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (err) {
      console.error('Error al cargar historial anterior:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  // Smart Polling cada 2.5s mientras la pestaña esté activa
  useEffect(() => {
    let timer: any = null;

    const pollNewMessages = async () => {
      if (document.hidden) return;

      const latestMsg = messages[messages.length - 1];
      const sinceTimestamp = latestMsg ? latestMsg.createdAt : undefined;
      const url = sinceTimestamp
        ? `/api/conversations/${encodeURIComponent(conversation.id)}/messages?sinceTimestamp=${encodeURIComponent(sinceTimestamp)}`
        : `/api/conversations/${encodeURIComponent(conversation.id)}/messages?limit=20`;

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const newMsgs: PrivateChatMessage[] = data.messages || [];

          if (newMsgs.length > 0) {
            setMessages((prev) => {
              const prevIds = new Set(prev.map((m) => m.id));
              const prevClientIds = new Set(prev.map((m) => m.clientMessageId).filter(Boolean));

              // Reemplazar mensajes optimistas coincidentes o añadir nuevos
              const next = [...prev];
              for (const nm of newMsgs) {
                if (nm.clientMessageId && prevClientIds.has(nm.clientMessageId)) {
                  const idx = next.findIndex((m) => m.clientMessageId === nm.clientMessageId);
                  if (idx !== -1) {
                    next[idx] = nm;
                    continue;
                  }
                }
                if (!prevIds.has(nm.id)) {
                  next.push(nm);
                }
              }
              return next;
            });

            // Si el usuario estaba leyendo abajo, hacer auto-scroll suave
            if (isNearBottomRef.current) {
              setTimeout(() => {
                if (messagesContainerRef.current) {
                  messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
              }, 50);
            }

            markAsRead();
          }
        }
      } catch (e) {
        // Silencioso en caso de pérdida momentánea de conexión
      }
    };

    timer = setInterval(pollNewMessages, 2500);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        pollNewMessages();
        markAsRead();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversation.id, messages, markAsRead]);

  // Selección de archivo adjunto
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se pueden adjuntar imágenes (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen no puede exceder 10MB.');
      return;
    }

    setAttachmentFile(file);
    setAttachmentPreview(URL.createObjectURL(file));
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Enviar mensaje con soporte de idempotencia y reintento
  const handleSendMessage = async (retryMessage?: LocalChatMessage) => {
    const textToSend = retryMessage ? retryMessage.content : inputText.trim();
    const clientMessageId = retryMessage?.clientMessageId || `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!textToSend && !attachmentFile && !retryMessage?.attachmentId) {
      return;
    }

    // Comprobar bloqueo
    if (isBlockedByMe || hasBlockedMe) {
      alert('No es posible enviar mensajes debido a un bloqueo activo.');
      return;
    }

    let uploadedAttachmentId = retryMessage?.attachmentId;
    let localPreviewUrl = retryMessage?.attachmentUrl || attachmentPreview;

    // Subir adjunto si hay uno nuevo seleccionado
    if (!retryMessage && attachmentFile) {
      setIsUploadingAttachment(true);
      try {
        const formData = new FormData();
        formData.append('file', attachmentFile);

        const uploadRes = await fetch('/api/chat/attachments', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir la imagen.');
        }

        const uploadData = await uploadRes.json();
        uploadedAttachmentId = uploadData.id;
      } catch (err: any) {
        alert(err.message || 'Error al procesar el archivo adjunto.');
        setIsUploadingAttachment(false);
        return;
      }
      setIsUploadingAttachment(false);
    }

    // Mensaje optimista
    const tempId = retryMessage?.id || `temp_${clientMessageId}`;
    const optimisticMsg: LocalChatMessage = {
      id: tempId,
      conversationId: conversation.id,
      senderId: currentUser.id,
      recipientId: otherUser.id,
      content: textToSend,
      clientMessageId,
      attachmentId: uploadedAttachmentId,
      attachmentUrl: localPreviewUrl || undefined,
      attachmentType: uploadedAttachmentId ? 'image' : undefined,
      status: 'sending',
      createdAt: retryMessage ? retryMessage.createdAt : new Date().toISOString(),
      isOptimistic: true,
    };

    if (retryMessage) {
      setMessages((prev) => prev.map((m) => (m.clientMessageId === clientMessageId ? optimisticMsg : m)));
    } else {
      setMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');
      handleRemoveAttachment();
    }

    // Scroll al final
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 20);

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToSend,
          clientMessageId,
          attachmentId: uploadedAttachmentId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 && errData.error?.includes('bloqueo')) {
          setHasBlockedMe(true);
        }
        throw new Error(errData.error || 'Error al enviar el mensaje.');
      }

      const data = await res.json();
      const serverMsg: PrivateChatMessage = data.message;

      // Actualizar con datos del servidor
      setMessages((prev) =>
        prev.map((m) => (m.clientMessageId === clientMessageId || m.id === tempId ? serverMsg : m))
      );

      if (onConversationUpdated) {
        onConversationUpdated({
          lastMessage: {
            id: serverMsg.id,
            senderId: currentUser.id,
            content: serverMsg.content,
            createdAt: serverMsg.createdAt,
            status: 'sent',
            hasAttachment: !!serverMsg.attachmentUrl,
          },
        });
      }
    } catch (err: any) {
      // Marcar como error en la interfaz sin perder el texto para permitir reintento
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId || m.id === tempId
            ? { ...m, status: 'error' }
            : m
        )
      );
    }
  };

  // Bloquear / Desbloquear usuario
  const handleToggleBlock = async () => {
    setIsTogglingBlock(true);
    setShowMenu(false);
    try {
      if (isBlockedByMe) {
        // Desbloquear
        const res = await fetch(`/api/users/${encodeURIComponent(otherUser.id)}/block`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setIsBlockedByMe(false);
          if (onConversationUpdated) onConversationUpdated({ isBlockedByMe: false });
        }
      } else {
        // Bloquear
        if (!confirm(`¿Deseas bloquear a ${otherUser.name}? Ya no podréis enviaros mensajes.`)) {
          setIsTogglingBlock(false);
          return;
        }
        const res = await fetch(`/api/users/${encodeURIComponent(otherUser.id)}/block`, {
          method: 'POST',
        });
        if (res.ok) {
          setIsBlockedByMe(true);
          if (onConversationUpdated) onConversationUpdated({ isBlockedByMe: true });
        }
      }
    } catch (err) {
      alert('Error al gestionar el bloqueo.');
    } finally {
      setIsTogglingBlock(false);
    }
  };

  // Formato de hora legible
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.8)] relative">
      {/* Header */}
      <div className="px-4 py-3 bg-[#120E1C] border-b border-[#D4AF37]/20 flex items-center justify-between z-10">
        <div
          onClick={() => onOpenProfile && onOpenProfile(otherUser.id)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <img
              src={otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
              alt={otherUser.name}
              className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]/40 group-hover:border-[#D4AF37] transition-all"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0911] absolute top-0 right-0" title="En sintonía astral" />
            {otherUser.isVerified && (
              <span className="material-symbols-outlined text-xs text-[#D4AF37] filled absolute -bottom-1 -right-1 bg-[#0B0911] rounded-full">
                verified
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-playfair font-bold text-sm text-[#F7E7C1] leading-tight group-hover:text-[#D4AF37] transition-colors">
                {otherUser.name}
              </h3>
              <span className="text-[9px] uppercase font-bold text-[#D4AF37] bg-[#5A2D82]/60 px-1.5 py-0.5 rounded-full border border-[#D4AF37]/20">
                {otherUser.role === 'tarotista' ? '🔮 Vidente' : '✨ Buscador'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {otherUser.handle && (
                <span className="text-[11px] text-[#A09BAE]">{otherUser.handle}</span>
              )}
              <span className="text-[9px] text-emerald-400 font-semibold">• En sintonía</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 relative">
          {otherUser.role === 'tarotista' && onBookConsultation && (
            <button
              onClick={() => onBookConsultation(otherUser.id)}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] text-[10px] font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(212,175,55,0.3)] hover:scale-105 transition"
            >
              <span>🔮 Solicitar Consulta</span>
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-full text-[#A09BAE] hover:text-[#F7E7C1] hover:bg-[#2E1B47]/50 transition-colors"
              title="Opciones de conversación"
            >
              <span className="material-symbols-outlined text-xl">more_vert</span>
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-1 w-48 bg-[#1A1026] border border-[#D4AF37]/30 rounded-xl py-1.5 shadow-[0_5px_20px_rgba(0,0,0,0.7)] z-50 text-xs"
                onClick={() => setShowMenu(false)}
              >
                <button
                  onClick={handleToggleBlock}
                  disabled={isTogglingBlock}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-300 hover:bg-red-950/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isBlockedByMe ? 'lock_open' : 'block'}
                  </span>
                  <span>{isBlockedByMe ? 'Desbloquear usuario' : 'Bloquear usuario'}</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#A09BAE] hover:text-[#F7E7C1] hover:bg-[#2E1B47]/50 transition-colors"
            title="Cerrar chat"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* Banner de Bloqueo si aplica */}
      {(isBlockedByMe || hasBlockedMe) && (
        <div className="bg-red-950/70 border-b border-red-500/40 px-4 py-2 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-red-400">block</span>
            <span>
              {isBlockedByMe
                ? 'Has bloqueado a este usuario.'
                : 'No es posible enviar mensajes debido a las preferencias de privacidad.'}
            </span>
          </div>
          {isBlockedByMe && (
            <button
              onClick={handleToggleBlock}
              disabled={isTogglingBlock}
              className="text-xs text-[#D4AF37] underline font-bold hover:text-white"
            >
              Desbloquear
            </button>
          )}
        </div>
      )}

      {/* Lista de Mensajes */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar relative"
      >
        {/* Indicador de carga de historial anterior */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <span className="animate-spin material-symbols-outlined text-sm text-[#D4AF37]">
              progress_activity
            </span>
          </div>
        )}

        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-[#A09BAE] text-xs gap-2">
            <span className="animate-spin material-symbols-outlined text-2xl text-[#D4AF37]">
              progress_activity
            </span>
            <span>Cargando conversación segura...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#A09BAE] p-6 space-y-2">
            <span className="material-symbols-outlined text-4xl text-[#D4AF37]/60">chat</span>
            <p className="font-playfair text-sm text-[#F7E7C1]">Conversación iniciada</p>
            <p className="text-xs max-w-xs text-[#A09BAE]/80">
              Envía el primer mensaje para conectar con {otherUser.name}. La mensajería es gratuita y confidencial.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed relative ${
                    isMe
                      ? 'bg-gradient-to-r from-[#2E1B47] to-[#5A2D82] border border-[#D4AF37]/40 text-[#F7E7C1] rounded-br-none shadow-[0_2px_10px_rgba(46,27,71,0.5)]'
                      : 'bg-[#1A1026] border border-[#D4AF37]/20 text-[#E5E0EB] rounded-bl-none'
                  }`}
                >
                  {/* Adjunto de imagen privado */}
                  {msg.attachmentUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-[#D4AF37]/20 max-w-xs">
                      <img
                        src={msg.attachmentUrl}
                        alt="Adjunto privado"
                        className="w-full max-h-60 object-cover cursor-pointer hover:scale-102 transition-transform"
                        onClick={() => window.open(msg.attachmentUrl, '_blank')}
                      />
                    </div>
                  )}

                  {/* Texto seguro y Tarjeta Interactiva si es una Visión Compartida */}
                  {msg.content && msg.content !== '[Imagen adjunta]' && (() => {
                    const postMatch = msg.content.match(/[?&]post=([a-zA-Z0-9_-]+)/);
                    const sharedPostId = postMatch ? postMatch[1] : null;
                    return (
                      <div className="space-y-2">
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        {sharedPostId && (
                          <div className="p-2.5 rounded-xl bg-[#0B0911]/90 border border-[#D4AF37]/40 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">🔮</span>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                                  Visión de KABALY
                                </span>
                                <span className="text-[10px] text-[#A09BAE] truncate block">
                                  Publicación compartida en el chat
                                </span>
                              </div>
                            </div>
                            {onOpenPost && (
                              <button
                                type="button"
                                onClick={() => onOpenPost(sharedPostId)}
                                className="px-2.5 py-1 rounded-full bg-[#D4AF37] text-[#0B0911] font-bold text-[10px] shrink-0 hover:scale-105 transition"
                              >
                                Abrir ➔
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Pie del mensaje: Hora, estado y reporte */}
                  <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] opacity-75">
                    <span>{formatTime(msg.createdAt)}</span>

                    {/* Estados de envío para mis mensajes */}
                    {isMe && (
                      <span className="flex items-center">
                        {msg.status === 'sending' && (
                          <span className="material-symbols-outlined text-[11px] animate-spin">
                            progress_activity
                          </span>
                        )}
                        {msg.status === 'sent' && (
                          <span className="text-[10px] text-gray-300" title="Enviado al servidor">
                            ✓
                          </span>
                        )}
                        {msg.status === 'read' && (
                          <span className="text-[10px] text-[#D4AF37] font-bold" title="Leído">
                            ✦ Visto
                          </span>
                        )}
                        {msg.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-400">
                            <span className="material-symbols-outlined text-[13px]">error</span>
                            <button
                              onClick={() => handleSendMessage(msg)}
                              className="underline font-bold hover:text-white"
                            >
                              Reintentar
                            </button>
                          </div>
                        )}
                      </span>
                    )}

                    {/* Botón de reporte para mensajes recibidos */}
                    {!isMe && (
                      <button
                        onClick={() => setReportingMessage(msg)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
                        title="Reportar mensaje"
                      >
                        <span className="material-symbols-outlined text-[12px]">flag</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Previsualización de adjunto antes de enviar */}
      {attachmentPreview && (
        <div className="px-4 py-2 bg-[#120E1C] border-t border-[#D4AF37]/20 flex items-center gap-3">
          <div className="relative">
            <img
              src={attachmentPreview}
              alt="Previsualización"
              className="w-14 h-14 rounded-lg object-cover border border-[#D4AF37]"
            />
            <button
              onClick={handleRemoveAttachment}
              className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full text-white p-0.5 hover:bg-red-500"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
          <div className="text-xs text-[#A09BAE] flex-1">
            <span className="font-semibold text-[#F7E7C1] block truncate">
              {attachmentFile?.name}
            </span>
            <span>{((attachmentFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB • Listo para enviar</span>
          </div>
        </div>
      )}

      {/* Footer / Input Bar */}
      <div className="p-3 bg-[#120E1C] border-t border-[#D4AF37]/20 flex flex-col gap-2">
        {/* Susurros Rápidos Esotéricos */}
        {!isBlockedByMe && !hasBlockedMe && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              '✦ Te envío luz y buena energía astral',
              '🔮 ¿Tienes disponibilidad para una lectura?',
              '🌙 ¿Qué arcano rige hoy mi energía?',
            ].map((quickText) => (
              <button
                key={quickText}
                type="button"
                onClick={() => setInputText(quickText)}
                className="px-2.5 py-1 rounded-full bg-[#1A1026] border border-[#D4AF37]/25 hover:border-[#D4AF37] text-[10px] text-[#F7E7C1]/85 shrink-0 transition"
              >
                {quickText}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* File Picker input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleSelectFile}
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBlockedByMe || hasBlockedMe || isUploadingAttachment}
            className="p-2 rounded-full text-[#D4AF37] hover:bg-[#2E1B47] transition-colors disabled:opacity-30"
            title="Adjuntar imagen"
          >
            <span className="material-symbols-outlined text-xl">image</span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isBlockedByMe || hasBlockedMe}
            maxLength={2000}
            placeholder={
              isBlockedByMe || hasBlockedMe
                ? 'Conversación bloqueada'
                : 'Escribe un mensaje privado...'
            }
            className="flex-1 bg-[#1A1026] border border-[#D4AF37]/30 rounded-full px-4 py-2.5 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/50 focus:outline-none focus:border-[#D4AF37] disabled:opacity-40"
          />

          <button
            type="submit"
            disabled={
              (!inputText.trim() && !attachmentFile) ||
              isBlockedByMe ||
              hasBlockedMe ||
              isUploadingAttachment
            }
            className="p-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0911] font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.3)]"
            title="Enviar mensaje"
          >
            {isUploadingAttachment ? (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-base filled">send</span>
            )}
          </button>
        </form>

        <div className="flex justify-between items-center text-[10px] text-[#A09BAE]/70 px-2">
          <span>Mensajería privada y gratuita • No descuenta saldo</span>
          {inputText.length > 1500 && (
            <span className={inputText.length >= 2000 ? 'text-red-400 font-bold' : ''}>
              {inputText.length}/2000
            </span>
          )}
        </div>
      </div>

      {/* Modal de Reporte de Mensaje */}
      {reportingMessage && (
        <ReportMessageModal
          isOpen={!!reportingMessage}
          messageId={reportingMessage.id}
          messageSnippet={reportingMessage.content}
          onClose={() => setReportingMessage(null)}
          onReportSubmitted={() => {
            alert('El reporte ha sido enviado confidencialmente al equipo de moderación.');
            setReportingMessage(null);
          }}
        />
      )}
    </div>
  );
};
