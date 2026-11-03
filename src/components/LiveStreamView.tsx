import React, { useState, useEffect } from 'react';
import { LiveStream, User, Gift, GiftEvent, ChatMessage, TarotistaProfile } from '../types';

interface LiveStreamViewProps {
  stream: LiveStream;
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  gifts: Gift[];
  onSendGift: (streamId: string, giftId: string) => void;
  onJoinQueue: (streamId: string, durationMinutes: number, type: 'chat' | 'audio' | 'video') => void;
  onBookConsultation: (tarotistaId: string) => void;
  onOpenWallet: () => void;
  onCallNextQueueUser?: (streamId: string) => void;
}

export const LiveStreamView: React.FC<LiveStreamViewProps> = ({
  stream,
  currentUser,
  tarotistaProfiles,
  gifts,
  onSendGift,
  onJoinQueue,
  onBookConsultation,
  onOpenWallet,
  onCallNextQueueUser,
}) => {
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [confirmingGift, setConfirmingGift] = useState<Gift | null>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState<Gift[]>(gifts || []);
  const [processedEvents] = useState<Set<string>>(() => new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      channelId: stream.id,
      senderId: 'usr_2',
      senderName: 'Ariel Star',
      senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      senderRole: 'cliente',
      text: '¡La resonancia de esta lectura de cartas es increíble! Gracias Luna ✨',
      timestamp: '22:14',
    },
    {
      id: 'msg_2',
      channelId: stream.id,
      senderId: 'usr_3',
      senderName: 'Sophia V.',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      senderRole: 'cliente',
      text: '¿Podrías sacar una carta para orientación de trabajo?',
      timestamp: '22:15',
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [activeGiftAnim, setActiveGiftAnim] = useState<GiftEvent | null>(null);

  // Detectar preferencia de movimiento reducido
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Cargar catálogo de regalos oficial desde el servidor
  useEffect(() => {
    fetch('/api/gifts')
      .then(res => res.json())
      .then(data => {
        if (data.gifts && Array.isArray(data.gifts)) {
          setGiftCatalog(data.gifts);
        }
      })
      .catch(() => {});
  }, []);

  // Polling recuperable de eventos de regalo con deduplicación por transactionId
  useEffect(() => {
    let mounted = true;
    const fetchGiftEvents = async () => {
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(stream.id)}/gifts?limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        const events = data.events || [];

        if (!mounted) return;

        events.forEach((evt: any) => {
          const key = evt.transactionId || evt.id;
          if (!processedEvents.has(key)) {
            processedEvents.add(key);

            // Registro visible y permanente en el feed del chat
            setChatMessages(prev => {
              if (prev.some(m => m.id === `gift_${key}`)) return prev;
              return [
                ...prev,
                {
                  id: `gift_${key}`,
                  channelId: stream.id,
                  senderId: evt.senderId || 'anon',
                  senderName: evt.senderName,
                  senderAvatar: evt.senderAvatar,
                  senderRole: 'cliente',
                  text: `ha enviado un regalo: ${evt.giftName} (${evt.giftCost} 🪙)`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isGift: true,
                  giftIcon: evt.giftIcon,
                }
              ];
            });

            // Reproducir animación flotante solo para eventos recientes (< 15 segundos)
            const eventAgeSec = (Date.now() - new Date(evt.timestamp || Date.now()).getTime()) / 1000;
            if (eventAgeSec < 15) {
              setActiveGiftAnim({
                id: evt.id,
                streamId: stream.id,
                senderId: evt.senderId,
                senderName: evt.senderName,
                senderAvatar: evt.senderAvatar,
                giftId: evt.giftId,
                giftName: evt.giftName,
                giftIcon: evt.giftIcon,
                giftCost: evt.giftCost,
                transactionId: evt.transactionId,
                timestamp: evt.timestamp,
              });
              setTimeout(() => {
                if (mounted) setActiveGiftAnim(null);
              }, prefersReducedMotion ? 1500 : 3500);
            }
          }
        });
      } catch (e) {
        // mecanismo recuperable: reintenta en el siguiente ciclo sin perder eventos ya cobrados
      }
    };

    fetchGiftEvents();
    const interval = setInterval(fetchGiftEvents, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [stream.id, processedEvents, prefersReducedMotion]);

  if (!stream) {
    return (
      <div className="relative w-full h-[calc(100vh-110px)] max-w-md mx-auto bg-[#0B0911] overflow-hidden rounded-2xl border border-[#D4AF37]/30 shadow-2xl flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#D4AF37]">videocam_off</span>
          <p className="text-xs text-[#F7E7C1] font-playfair">No hay transmisiones en vivo activas</p>
          <span className="text-[10px] text-[#A7A7A7]">Vuelve más tarde para el próximo directo celestial</span>
        </div>
      </div>
    );
  }

  const profile = tarotistaProfiles.find(p => p.id === stream.tarotistaId);
  const isInQueue = stream.queueUsers ? stream.queueUsers.some(q => q.id === currentUser.id) : false;
  const userQueueIndex = stream.queueUsers ? stream.queueUsers.findIndex(q => q.id === currentUser.id) : -1;

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setChatMessages(prev => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        channelId: stream.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderRole: currentUser.role,
        text: chatInput.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    setChatInput('');
  };

  // Solicitar confirmación explícita con coste y acción antes de enviar
  const handleInitiateGift = (gift: Gift) => {
    if (currentUser.role === 'tarotista' && profile?.userId === currentUser.id) {
      alert('No es posible enviarte regalos a ti mismo.');
      return;
    }

    if (currentUser.coinsBalance < gift.costCoins) {
      alert(`Saldo insuficiente. Necesitas ${gift.costCoins} monedas para enviar ${gift.name}.`);
      onOpenWallet();
      return;
    }

    setConfirmingGift(gift);
  };

  const handleConfirmSendGift = async () => {
    if (!confirmingGift || isSendingGift) return;

    setIsSendingGift(true);
    const idempotencyKey = `gift_send_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch(`/api/streams/${encodeURIComponent(stream.id)}/gift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          giftId: confirmingGift.id,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el envío del regalo.');
      }

      onSendGift(stream.id, confirmingGift.id);
      setShowGiftDrawer(false);
      setConfirmingGift(null);

      // Descontar monedas en UI local inmediatamente
      currentUser.coinsBalance = data.newBalance !== undefined ? data.newBalance : Math.max(0, currentUser.coinsBalance - confirmingGift.costCoins);

      // Registrar evento en procesados para no duplicar
      if (data.transactionId) {
        processedEvents.add(data.transactionId);
      }

      const giftEvt: GiftEvent = {
        id: `evt_${Date.now()}`,
        streamId: stream.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        giftId: confirmingGift.id,
        giftName: confirmingGift.name,
        giftIcon: confirmingGift.icon,
        giftCost: confirmingGift.costCoins,
        transactionId: data.transactionId,
        timestamp: new Date().toLocaleTimeString(),
      };

      setActiveGiftAnim(giftEvt);

      // Conservar un registro visible en el chat
      setChatMessages(prev => [
        ...prev,
        {
          id: `msg_gift_${data.transactionId || Date.now()}`,
          channelId: stream.id,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderRole: currentUser.role,
          text: `ha enviado un regalo: ${confirmingGift.name} (${confirmingGift.costCoins} 🪙)`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isGift: true,
          giftIcon: confirmingGift.icon,
        }
      ]);

      setTimeout(() => {
        setActiveGiftAnim(null);
      }, prefersReducedMotion ? 1500 : 3500);
    } catch (err: any) {
      alert(err.message || 'Error al enviar el regalo celestial.');
    } finally {
      setIsSendingGift(false);
    }
  };

  const isTarotistaOwner = currentUser.role === 'tarotista' && profile?.userId === currentUser.id;

  return (
    <div className="relative w-full h-[calc(100vh-110px)] max-w-md mx-auto bg-[#0B0911] overflow-hidden rounded-2xl border border-[#D4AF37]/30 shadow-2xl flex flex-col justify-between">
      {/* Background Stream Video simulation */}
      <div className="absolute inset-0 z-0">
        <video
          src={stream.streamVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-black/60" />
      </div>

      {/* Floating Animated Gift Banner Event */}
      {activeGiftAnim && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-[#5A2D82]/90 backdrop-blur-md border-2 border-[#D4AF37] text-[#F7E7C1] px-5 py-2.5 rounded-full flex items-center gap-3 gold-glow animate-bounce">
          <span className="material-symbols-outlined text-3xl text-[#D4AF37] filled">
            {activeGiftAnim.giftIcon}
          </span>
          <div>
            <span className="text-xs font-bold text-[#D4AF37] block">{activeGiftAnim.senderName}</span>
            <span className="text-[10px] text-[#F7E7C1]">¡Envió {activeGiftAnim.giftName}!</span>
          </div>
        </div>
      )}

      {/* Modo Pausa / Private Consultation Overlay Banner */}
      {stream.inPrivateConsultation && (
        <div className="absolute top-20 inset-x-3 z-30 bg-[#1A1026]/90 backdrop-blur-xl border border-[#D4AF37] rounded-2xl p-4 text-center gold-glow animate-pulse-glow">
          <div className="flex items-center justify-center gap-2 text-[#D4AF37] mb-1">
            <span className="material-symbols-outlined text-xl">lock</span>
            <span className="font-playfair text-sm font-bold uppercase tracking-wider">Consulta Privada 1:1 en Curso</span>
          </div>
          <p className="text-xs text-[#F7E7C1]">
            {stream.pauseMessage || 'Luna está realizando una lectura de alma en privado.'}
          </p>
          <div className="mt-2 text-[10px] text-[#A7A7A7]">
            El chat en vivo sigue abierto. Apúntate a la cola para tu turno.
          </div>
        </div>
      )}

      {/* Top Header Controls */}
      <header className="relative z-20 flex justify-between items-center px-4 py-3">
        {/* Profile Mini Card */}
        <div className="glass-card rounded-full pl-1.5 pr-4 py-1 flex items-center gap-2.5">
          <div className="relative">
            <img
              src={stream.tarotistaAvatar}
              alt={stream.tarotistaName}
              className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/40"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F7E7C1] flex items-center gap-1">
              {stream.tarotistaName}
              <span className="material-symbols-outlined text-[#D4AF37] text-xs filled">verified</span>
            </span>
            <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-widest">
              DIRECTO EN VIVO
            </span>
          </div>
          <button className="bg-[#5A2D82] text-[#D4AF37] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#D4AF37]/30 hover:brightness-110">
            Seguir
          </button>
        </div>

        {/* Viewer count & Queue Badge */}
        <div className="flex items-center gap-2">
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1.5 text-xs text-[#F7E7C1]">
            <span className="material-symbols-outlined text-red-500 text-sm filled">visibility</span>
            <span className="font-bold">{stream.viewersCount}</span>
          </div>

          {/* Queue Indicator Badge */}
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1 text-xs text-[#D4AF37]">
            <span className="material-symbols-outlined text-sm">groups</span>
            <span className="font-bold">Cola: {stream.queueUsers.length}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area: Floating Live Chat */}
      <main className="relative z-10 flex-1 flex flex-col justify-end px-4 pb-20 overflow-hidden">
        {/* Floating Chat Box */}
        <div className="max-w-[300px] max-h-[220px] overflow-y-auto no-scrollbar space-y-2 mb-2">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 p-2 rounded-2xl text-xs backdrop-blur-md border ${
                msg.isGift
                  ? 'bg-[#5A2D82]/60 border-[#D4AF37]/50 text-[#D4AF37]'
                  : 'bg-black/40 border-white/10 text-[#F7E7C1]'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-[#5A2D82] flex-shrink-0 overflow-hidden">
                <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-[#D4AF37] block">
                  {msg.senderName}
                </span>
                <p className="text-xs leading-snug">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Queue Position Status Box for current user */}
        {isInQueue && (
          <div className="bg-[#5A2D82]/90 border border-[#D4AF37] rounded-xl p-2.5 mb-2 flex justify-between items-center text-xs text-[#F7E7C1]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">hourglass_top</span>
              <div>
                <span className="font-bold text-[#D4AF37] block">Estás en la cola de esperas</span>
                <span className="text-[10px] text-[#A7A7A7]">Tu posición actual: #{userQueueIndex + 1}</span>
              </div>
            </div>
            <button
              onClick={() => onJoinQueue(stream.id, 10, 'chat')}
              className="text-[10px] text-red-400 font-bold hover:underline"
            >
              Salir de cola
            </button>
          </div>
        )}
      </main>

      {/* Bottom Floating Interaction Bar */}
      <footer className="relative z-20 p-3 pb-4 bg-[#0B0911]/90 backdrop-blur-xl border-t border-[#D4AF37]/20 flex flex-col gap-2">
        {/* Tarotista Call Next Queue User Button */}
        {isTarotistaOwner && stream.queueUsers.length > 0 && (
          <button
            onClick={() => onCallNextQueueUser && onCallNextQueueUser(stream.id)}
            className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-2 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 gold-glow"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Siguiente Consulta en Cola ({stream.queueUsers[0].name})
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Chat input */}
          <form onSubmit={handleSendChatMessage} className="flex-1 flex items-center relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Envía un mensaje místico..."
              className="w-full bg-black/50 border border-[#D4AF37]/30 rounded-full pl-4 pr-9 py-2.5 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              className="absolute right-2 text-[#D4AF37] hover:scale-110 transition-transform"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </form>

          {/* Join Queue Toggle */}
          <button
            onClick={() => onJoinQueue(stream.id, 10, 'video')}
            className={`px-3 py-2.5 rounded-full border text-xs font-bold transition-all flex items-center gap-1 ${
              isInQueue
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-[#2E1B47] border-[#D4AF37]/40 text-[#D4AF37] hover:border-[#D4AF37]'
            }`}
            title="Unirse a la cola para consultar durante el directo"
          >
            <span className="material-symbols-outlined text-sm">confirmation_number</span>
            <span>{isInQueue ? 'En Cola' : '+ Cola'}</span>
          </button>

          {/* Gift Drawer Trigger */}
          <button
            onClick={() => setShowGiftDrawer(true)}
            className="p-2.5 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] text-[#0B0911] font-bold gold-glow hover:scale-110 active:scale-95 transition-all"
            title="Enviar regalo animado"
          >
            <span className="material-symbols-outlined text-lg filled">card_giftcard</span>
          </button>
        </div>

        {/* Main CTA: Book Private Reading */}
        <button
          onClick={() => onBookConsultation(stream.tarotistaId)}
          className="w-full bg-gradient-to-r from-[#5A2D82] to-[#2E1B47] border border-[#D4AF37]/50 text-[#F7E7C1] font-bold py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 gold-glow hover:brightness-110 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[#D4AF37] filled">bolt</span>
          Reservar Consulta Privada 1:1 (€{profile?.pricePerMinEur.toFixed(2)}/min)
        </button>
      </footer>

      {/* Gift Drawer Modal */}
      {showGiftDrawer && (
        <div className="absolute inset-0 z-50 bg-[#0B0911]/80 backdrop-blur-xl flex flex-col justify-end animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#1A1026] border-t border-[#D4AF37]/30 rounded-t-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <div>
                <span className="font-playfair text-sm text-[#D4AF37] font-bold block">Enviar Regalo Celestial</span>
                <span className="text-[10px] text-[#A7A7A7]">Tu saldo disponible: {currentUser.coinsBalance} 🪙</span>
              </div>
              <button onClick={() => setShowGiftDrawer(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto no-scrollbar">
              {(giftCatalog.length > 0 ? giftCatalog : gifts).map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleInitiateGift(g)}
                  className="bg-[#2E1B47]/50 border border-[#D4AF37]/20 hover:border-[#D4AF37] p-3 rounded-2xl flex flex-col items-center text-center transition-all hover:scale-105 active:scale-95 group"
                >
                  <span className="material-symbols-outlined text-3xl text-[#D4AF37] mb-1 group-hover:scale-110 transition-transform">
                    {g.icon}
                  </span>
                  <span className="text-xs font-bold text-[#F7E7C1]">{g.name}</span>
                  <span className="text-[10px] text-[#A7A7A7] mb-2">{g.description}</span>
                  <div className="bg-[#5A2D82] text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs filled">stars</span>
                    {g.costCoins}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Explícita de Envío de Regalo */}
      {confirmingGift && (
        <div className="absolute inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] p-0.5 mx-auto gold-glow">
              <div className="w-full h-full bg-[#1A1026] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#D4AF37] filled">
                  {confirmingGift.icon}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">
                ¿Confirmar envío de {confirmingGift.name}?
              </h3>
              <p className="text-xs text-[#A7A7A7] mt-1">
                Destinatario: <strong className="text-[#D4AF37]">{stream.tarotistaName}</strong>
              </p>
            </div>

            <div className="bg-[#0B0911]/60 rounded-xl p-3 border border-[#D4AF37]/30 text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-[#F7E7C1]">
                <span>Coste del regalo:</span>
                <span className="font-bold text-[#D4AF37]">{confirmingGift.costCoins} Monedas</span>
              </div>
              <div className="flex justify-between text-[#A7A7A7]">
                <span>Tu saldo actual:</span>
                <span>{currentUser.coinsBalance} Monedas</span>
              </div>
              <div className="flex justify-between text-[#A7A7A7] pt-1 border-t border-white/10">
                <span>Saldo resultante:</span>
                <span className="text-[#F7E7C1]">{currentUser.coinsBalance - confirmingGift.costCoins} Monedas</span>
              </div>
            </div>

            <p className="text-[10px] text-[#A7A7A7] italic">
              Esta operación descuenta las monedas inmediatamente y es definitiva. El profesional recibirá sus ganancias correspondientes.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingGift(null)}
                disabled={isSendingGift}
                className="flex-1 py-2.5 rounded-xl border border-[#D4AF37]/40 text-xs font-bold text-[#A7A7A7] hover:text-[#F7E7C1]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSendGift}
                disabled={isSendingGift}
                className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSendingGift ? 'Enviando...' : `Confirmar (${confirmingGift.costCoins} 🪙)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
