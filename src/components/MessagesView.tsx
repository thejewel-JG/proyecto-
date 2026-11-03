import React, { useState, useEffect, useCallback } from 'react';
import { Conversation, User } from '../types';
import { ChatWindow } from './ChatWindow';

interface MessagesViewProps {
  currentUser: User;
  initialTargetUserId?: string | null;
  onClearInitialTargetUser?: () => void;
  onOpenProfile?: (userId: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  initialTargetUserId,
  onClearInitialTargetUser,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Cargar lista de conversaciones
  const fetchConversations = useCallback(async (search?: string) => {
    try {
      const url = search
        ? `/api/conversations?search=${encodeURIComponent(search)}`
        : '/api/conversations';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        return data.conversations as Conversation[];
      }
    } catch (err) {
      console.error('Error al cargar conversaciones:', err);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, []);

  useEffect(() => {
    fetchConversations(searchQuery);
  }, [fetchConversations, searchQuery]);

  // Si se pasa un targetUserId inicial (ej: botón «Enviar mensaje» desde un perfil)
  useEffect(() => {
    if (!initialTargetUserId) return;

    const openTargetChat = async () => {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: initialTargetUserId }),
        });

        if (res.ok) {
          const data = await res.json();
          setActiveConversation(data.conversation);
          // Refrescar lista para que aparezca la conversación
          fetchConversations();
        }
      } catch (err) {
        console.error('Error al abrir conversación con target user:', err);
      } finally {
        if (onClearInitialTargetUser) onClearInitialTargetUser();
      }
    };

    openTargetChat();
  }, [initialTargetUserId, fetchConversations, onClearInitialTargetUser]);

  // Formato relativo de fecha
  const formatTimeSnippet = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleUpdateActiveConv = (updated: Partial<Conversation>) => {
    if (!activeConversation) return;
    const next = { ...activeConversation, ...updated };
    setActiveConversation(next);
    setConversations((prev) =>
      prev.map((c) => (c.id === next.id ? { ...c, ...updated } : c))
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-[calc(100vh-140px)] min-h-[520px] pb-12 flex gap-4">
      {/* Columna Izquierda: Bandeja de Conversaciones (Oculta en móvil si hay chat abierto) */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col bg-[#120E1C] border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.6)] ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Cabecera del buzón */}
        <div className="p-4 border-b border-[#D4AF37]/20 bg-[#0B0911]/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-cinzel text-lg font-bold text-[#F7E7C1] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">forum</span>
              Mensajes
            </h2>
            <span className="text-[10px] text-[#A09BAE] uppercase tracking-wider font-semibold">
              Privado & Seguro
            </span>
          </div>

          {/* Buscador de conversaciones */}
          <div className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-full px-3 py-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-sm">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/60 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#A09BAE] hover:text-white">
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de Conversaciones */}
        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[#D4AF37]/10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-[#A09BAE] text-xs gap-2">
              <span className="animate-spin material-symbols-outlined text-xl text-[#D4AF37]">
                progress_activity
              </span>
              <span>Cargando mensajes...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-[#A09BAE] space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#D4AF37]/40">chat</span>
              <p className="font-playfair text-sm text-[#F7E7C1]">Sin conversaciones</p>
              <p className="text-xs text-[#A09BAE]/80 leading-relaxed">
                {searchQuery
                  ? 'No se encontraron conversaciones con ese criterio.'
                  : 'Visita el perfil de un tarotista o usuario para iniciar una conversación privada.'}
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              const other = conv.otherUser;

              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors relative ${
                    isSelected
                      ? 'bg-[#2E1B47]/80 border-l-4 border-l-[#D4AF37]'
                      : 'hover:bg-[#1A1026]/70'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={other.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'}
                      alt={other.name}
                      className="w-12 h-12 rounded-full object-cover border border-[#D4AF37]/30"
                    />
                    {other.isVerified && (
                      <span className="material-symbols-outlined text-xs text-[#D4AF37] filled absolute -bottom-0.5 -right-0.5 bg-[#0B0911] rounded-full">
                        verified
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-playfair font-bold text-xs text-[#F7E7C1] truncate">
                        {other.name}
                      </h4>
                      <span className="text-[10px] text-[#A09BAE]/70 flex-shrink-0 ml-1">
                        {formatTimeSnippet(conv.lastMessage?.createdAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-[#A09BAE] truncate max-w-[180px]">
                        {conv.lastMessage?.content || 'Iniciar conversación'}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="bg-[#D4AF37] text-[#0B0911] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-[0_0_8px_#D4AF37]">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Columna Derecha: Ventana de Chat Activa */}
      <div
        className={`flex-1 ${
          activeConversation ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            currentUser={currentUser}
            onClose={() => setActiveConversation(null)}
            onConversationUpdated={handleUpdateActiveConv}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full w-full bg-[#120E1C]/60 border border-[#D4AF37]/20 rounded-2xl p-8 text-center text-[#A09BAE] space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#2E1B47]/60 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <span className="material-symbols-outlined text-3xl">chat_bubble</span>
            </div>
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">Tus Conversaciones Seguras</h3>
            <p className="text-xs max-w-sm text-[#A09BAE]/80 leading-relaxed">
              Selecciona una conversación de la lista para leer y enviar mensajes privados con adjuntos de forma gratuita.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
