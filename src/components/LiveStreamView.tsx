import React, { useState, useEffect, useRef } from 'react';
import { LiveStream, User, Gift, GiftEvent, ChatMessage, TarotistaProfile } from '../types';

const LIVE_ARCANA_DECK = [
  { name: 'XVII · La Estrella', meaning: 'Renovación espiritual, fe, sanación y bendición astral en tu camino ✨' },
  { name: 'XIX · El Sol', meaning: 'Triunfo, plenitud, claridad absoluta y éxito iluminado por la luz solar ☀️' },
  { name: 'XVIII · La Luna', meaning: 'Intuición profunda, revelación de secretos ocultos y poder psíquico 🌙' },
  { name: 'X · La Rueda de la Fortuna', meaning: 'Giro favorable del destino, sincronicidad y apertura de ciclos 🎡' },
  { name: 'I · El Mago', meaning: 'Manifestación consciente, dominio de los elementos y nuevo inicio 🔮' },
  { name: 'II · La Sacerdotisa', meaning: 'Sabiduría interior, misterio sagrado y conexión con el velo astral 📜' },
  { name: 'VI · Los Enamorados', meaning: 'Alianza de almas, armonía afectiva y decisión guiada por el corazón 💜' },
  { name: 'XXI · El Mundo', meaning: 'Realización total, culminación gloriosa y plenitud cósmica 🌍' },
];

const AURA_FILTERS: { id: string; label: string; css: string }[] = [
  { id: 'natural', label: 'Natural', css: '' },
  { id: 'oro', label: 'Oro Solar', css: 'sepia(0.35) saturate(1.6) contrast(1.08) brightness(1.05)' },
  { id: 'amatista', label: 'Amatista', css: 'hue-rotate(25deg) saturate(1.4) contrast(1.1)' },
  { id: 'luna', label: 'Plenilunio', css: 'contrast(1.15) brightness(1.08) saturate(0.85)' },
];

interface LiveStreamViewProps {
  stream: LiveStream;
  liveStreams?: LiveStream[];
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  gifts: Gift[];
  autoOpenGoLive?: boolean;
  onClearAutoOpenGoLive?: () => void;
  onSendGift: (streamId: string, giftId: string) => void;
  onJoinQueue: (streamId: string, durationMinutes: number, type: 'chat' | 'audio' | 'video') => void;
  onBookConsultation?: (tarotistaId: string) => void;
  onOpenWallet: () => void;
  onOpenAuthModal?: () => void;
  onCallNextQueueUser?: (streamId: string) => void;
  onViewProfile?: (userId: string) => void;
  onStreamStarted?: (newStream: LiveStream) => void;
  onStreamEnded?: (streamId: string) => void;
}

export const LiveStreamView: React.FC<LiveStreamViewProps> = ({
  stream,
  liveStreams = [],
  currentUser,
  tarotistaProfiles,
  gifts,
  autoOpenGoLive,
  onClearAutoOpenGoLive,
  onSendGift,
  onJoinQueue,
  onBookConsultation,
  onOpenWallet,
  onOpenAuthModal,
  onCallNextQueueUser,
  onViewProfile,
  onStreamStarted,
  onStreamEnded,
}) => {
  const [activeStream, setActiveStream] = useState<LiveStream>(stream);
  const [allStreams, setAllStreams] = useState<LiveStream[]>(liveStreams.length > 0 ? liveStreams : stream ? [stream] : []);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [confirmingGift, setConfirmingGift] = useState<Gift | null>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState<Gift[]>(gifts || []);
  const [processedEvents] = useState<Set<string>>(() => new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [liveFlamesCount, setLiveFlamesCount] = useState(128);
  const [flameBurst, setFlameBurst] = useState(false);

  // TikTok LIVE Studio & Broadcaster States
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState('Tirada Abierta de Tarot & Respuestas en Vivo ✨');
  const [liveCategory, setLiveCategory] = useState('Tarot');
  const [useCameraMode, setUseCameraMode] = useState(true);
  const [auraFilter, setAuraFilter] = useState<string>('natural');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isStartingBroadcast, setIsStartingBroadcast] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [broadcastSeconds, setBroadcastSeconds] = useState(0);
  const [activeDrawnCard, setActiveDrawnCard] = useState<{
    cardName: string;
    cardMeaning: string;
    hostName: string;
  } | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (stream && !isBroadcasting) {
      setActiveStream(stream);
    }
  }, [stream, isBroadcasting]);

  useEffect(() => {
    if (liveStreams.length > 0) {
      setAllStreams(liveStreams);
    }
  }, [liveStreams]);

  useEffect(() => {
    if (autoOpenGoLive) {
      handleOpenGoLiveStudio();
      onClearAutoOpenGoLive?.();
    }
  }, [autoOpenGoLive]);

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

  const currentStream = activeStream || stream;

  // Cronómetro de emisión en directo
  useEffect(() => {
    if (!isBroadcasting) {
      setBroadcastSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setBroadcastSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isBroadcasting]);

  // Vincular stream de cámara WebRTC al elemento <video> activo
  useEffect(() => {
    if (showGoLiveModal && previewVideoRef.current && localStreamRef.current) {
      previewVideoRef.current.srcObject = localStreamRef.current;
    }
    if (isBroadcasting && liveVideoRef.current && localStreamRef.current) {
      liveVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [showGoLiveModal, isBroadcasting, useCameraMode, isCameraOff]);

  // Limpiar cámara al desmontar
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Escuchar chat en vivo y cartas reveladas vía SSE
  useEffect(() => {
    if (!currentStream?.id) return;
    const es = new EventSource('/api/realtime/stream');

    es.addEventListener('live_stream_chat', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.streamId === currentStream.id && data.message) {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch {}
    });

    es.addEventListener('live_stream_card', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.streamId === currentStream.id) {
          setActiveDrawnCard({
            cardName: data.cardName,
            cardMeaning: data.cardMeaning,
            hostName: data.hostName,
          });
          setChatMessages((prev) => [
            ...prev,
            {
              id: `card_${data.id || Date.now()}`,
              channelId: currentStream.id,
              senderId: data.hostId || 'host',
              senderName: data.hostName || currentStream.tarotistaName,
              senderAvatar: currentStream.tarotistaAvatar,
              senderRole: 'tarotista',
              text: `🎴 Ha revelado la carta: ${data.cardName} — "${data.cardMeaning}"`,
              timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isGift: true,
              giftIcon: 'style',
            },
          ]);
          setTimeout(() => setActiveDrawnCard(null), 8500);
        }
      } catch {}
    });

    return () => es.close();
  }, [currentStream?.id]);

  const startCameraPreview = async () => {
    setCameraError(null);
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      localStreamRef.current = media;
      setUseCameraMode(true);
      setIsCameraOff(false);
      setIsMicMuted(false);
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = media;
      }
    } catch (err: any) {
      setCameraError('Cámara web no detectada o permiso denegado. Se utilizará el Altar Místico en Vivo con audio/chat.');
      setUseCameraMode(false);
    }
  };

  const handleOpenGoLiveStudio = () => {
    if (!currentUser || currentUser.id === 'anon') {
      onOpenAuthModal?.();
      return;
    }
    setLiveTitle(`Directo de ${currentUser.name}: Tarot & Respuestas ✨`);
    setShowGoLiveModal(true);
    startCameraPreview();
  };

  const handleStartLiveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStartingBroadcast) return;
    setIsStartingBroadcast(true);
    try {
      const res = await fetch('/api/streams/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: liveTitle.trim() || `Directo Espiritual de ${currentUser.name} ✨`,
          category: liveCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo iniciar el directo.');
      }

      const createdStream: LiveStream = data.stream;
      setActiveStream(createdStream);
      setAllStreams((prev) => [createdStream, ...prev.filter((s) => s.id !== createdStream.id)]);
      setIsBroadcasting(true);
      setShowGoLiveModal(false);
      onStreamStarted?.(createdStream);

      setChatMessages([
        {
          id: `sys_${Date.now()}`,
          channelId: createdStream.id,
          senderId: currentUser.id,
          senderName: 'KABALY LIVE',
          senderAvatar: currentUser.avatar,
          senderRole: 'tarotista',
          text: `🔴 ¡Estás en directo! Tus seguidores y la comunidad pueden entrar, chatear y enviarte regalos en tiempo real.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isGift: true,
        },
      ]);
    } catch (err: any) {
      alert(err.message || 'Error al iniciar transmisión en directo.');
    } finally {
      setIsStartingBroadcast(false);
    }
  };

  const handleStopLiveBroadcast = async () => {
    if (!currentStream) return;
    try {
      await fetch(`/api/streams/${encodeURIComponent(currentStream.id)}/end`, {
        method: 'POST',
      });
    } catch {}
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setIsBroadcasting(false);
    onStreamEnded?.(currentStream.id);
    const remaining = allStreams.filter((s) => s.id !== currentStream.id);
    setAllStreams(remaining);
    if (remaining.length > 0) {
      setActiveStream(remaining[0]);
    }
  };

  const handleToggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMicMuted;
      });
    }
    setIsMicMuted(!isMicMuted);
  };

  const handleToggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = isCameraOff;
      });
    }
    setIsCameraOff(!isCameraOff);
  };

  const handleDrawLiveTarotCard = async () => {
    if (!currentStream) return;
    const randomCard = LIVE_ARCANA_DECK[Math.floor(Math.random() * LIVE_ARCANA_DECK.length)];
    setActiveDrawnCard({
      cardName: randomCard.name,
      cardMeaning: randomCard.meaning,
      hostName: currentUser.name,
    });
    setTimeout(() => setActiveDrawnCard(null), 8500);

    try {
      await fetch(`/api/streams/${encodeURIComponent(currentStream.id)}/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: randomCard.name,
          cardMeaning: randomCard.meaning,
        }),
      });
    } catch {}
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Polling recuperable de eventos de regalo con deduplicación por transactionId
  useEffect(() => {
    if (!currentStream?.id) return;
    let mounted = true;
    const fetchGiftEvents = async () => {
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(currentStream.id)}/gifts?limit=20`);
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

  if (!currentStream) {
    return (
      <div className="relative w-full h-[calc(100vh-110px)] max-w-md mx-auto bg-[#0B0911] overflow-hidden rounded-2xl border border-[#D4AF37]/30 shadow-2xl flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#D4AF37]">videocam_off</span>
          <p className="text-xs text-[#F7E7C1] font-playfair">No hay transmisiones en vivo activas</p>
          <button
            onClick={handleOpenGoLiveStudio}
            className="gold-gradient-btn px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 mt-2"
          >
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>Emitir en Directo Ahora</span>
          </button>
        </div>
      </div>
    );
  }

  const profile = tarotistaProfiles.find(p => p.id === currentStream.tarotistaId || p.userId === currentStream.tarotistaId);
  const queueUsers = currentStream.queueUsers || [];
  const isInQueue = queueUsers.some(q => q.id === currentUser.id);
  const userQueueIndex = queueUsers.findIndex(q => q.id === currentUser.id);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const textToSend = chatInput.trim();
    setChatInput('');

    const optimisticMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      channelId: currentStream.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, optimisticMsg]);

    if (currentUser && currentUser.id !== 'anon') {
      try {
        await fetch(`/api/streams/${encodeURIComponent(currentStream.id)}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSend }),
        });
      } catch {}
    }
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

  const isTarotistaOwner =
    isBroadcasting ||
    currentStream.tarotistaId === currentUser.id ||
    (currentUser.role === 'tarotista' && profile?.userId === currentUser.id);
  const activeAuraCss = AURA_FILTERS.find((a) => a.id === auraFilter)?.css || '';

  return (
    <div className="w-full max-w-md mx-auto space-y-2.5 pb-6">
      {/* Top Bar: Room Selector Pills + "🔴 Emitir en Directo" Button */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {allStreams.map((s) => {
            const isSel = s.id === currentStream.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStream(s)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
                  isSel
                    ? 'bg-[#24133A] border-[#E5B54F] text-[#F7E7C1] shadow-[0_0_12px_rgba(229,181,79,0.3)]'
                    : 'bg-[#140B22]/80 border-white/10 text-[#A09BAE] hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>{s.tarotistaName}</span>
              </button>
            );
          })}
        </div>

        {isBroadcasting ? (
          <button
            onClick={handleStopLiveBroadcast}
            className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-[0_0_15px_rgba(220,38,38,0.6)] transition-all"
          >
            <span className="material-symbols-outlined text-sm">stop_circle</span>
            <span>Finalizar ({formatTimer(broadcastSeconds)})</span>
          </button>
        ) : (
          <button
            onClick={handleOpenGoLiveStudio}
            className="gold-gradient-btn px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-lg hover:scale-105 transition-transform"
          >
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>Emitir en Directo</span>
          </button>
        )}
      </div>

      {/* Main 9:16 TikTok LIVE Canvas */}
      <div className="relative w-full h-[calc(100vh-165px)] min-h-[540px] bg-[#0B0911] overflow-hidden rounded-3xl border border-[#E5B54F]/35 shadow-2xl flex flex-col justify-between">
        {/* Background Video: Real WebRTC Camera if Broadcasting with Camera, otherwise Ambient Tarot Stream */}
        <div className="absolute inset-0 z-0 bg-[#08040E]">
          {isBroadcasting && useCameraMode && !isCameraOff ? (
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              style={{ filter: activeAuraCss }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <video
              src={currentStream.streamVideoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-hands-shuffling-a-deck-of-tarot-cards-43403-large.mp4'}
              autoPlay
              loop
              muted
              playsInline
              style={{ filter: activeAuraCss }}
              className="w-full h-full object-cover brightness-75"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-black/60 pointer-events-none" />
        </div>

        {/* Interactive Drawn Tarot Card Overlay in Center of Live Stream */}
        {activeDrawnCard && (
          <div className="absolute inset-x-6 top-1/4 z-30 bg-gradient-to-b from-[#23123B]/95 to-[#0E071A]/95 backdrop-blur-xl border-2 border-[#E5B54F] rounded-3xl p-5 text-center shadow-[0_0_45px_rgba(229,181,79,0.65)] animate-fade-in">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#E5B54F] block">
              ✦ Arcano Revelado en Directo por {activeDrawnCard.hostName} ✦
            </span>
            <div className="my-2 text-4xl">🎴</div>
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1] text-gold-glow">
              {activeDrawnCard.cardName}
            </h3>
            <p className="text-xs text-[#D8CEF0] mt-1.5 leading-relaxed">
              "{activeDrawnCard.cardMeaning}"
            </p>
          </div>
        )}

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
      {currentStream.inPrivateConsultation && (
        <div className="absolute top-20 inset-x-3 z-30 bg-[#1A1026]/90 backdrop-blur-xl border border-[#D4AF37] rounded-2xl p-4 text-center gold-glow animate-pulse-glow">
          <div className="flex items-center justify-center gap-2 text-[#D4AF37] mb-1">
            <span className="material-symbols-outlined text-xl">lock</span>
            <span className="font-playfair text-sm font-bold uppercase tracking-wider">Consulta Privada 1:1 en Curso</span>
          </div>
          <p className="text-xs text-[#F7E7C1]">
            {currentStream.pauseMessage || 'Luna está realizando una lectura de alma en privado.'}
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
          <div
            onClick={() => onViewProfile && onViewProfile(currentStream.tarotistaId)}
            className="relative cursor-pointer"
          >
            <img
              src={currentStream.tarotistaAvatar}
              alt={currentStream.tarotistaName}
              className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/40"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-black" />
          </div>
          <div
            onClick={() => onViewProfile && onViewProfile(currentStream.tarotistaId)}
            className="flex flex-col cursor-pointer"
          >
            <span className="text-xs font-bold text-[#F7E7C1] hover:text-[#D4AF37] flex items-center gap-1">
              {currentStream.tarotistaName}
              <span className="material-symbols-outlined text-[#D4AF37] text-xs filled">verified</span>
            </span>
            <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-widest">
              {isBroadcasting ? `EN VIVO • ${formatTimer(broadcastSeconds)}` : 'DIRECTO EN VIVO'}
            </span>
          </div>
          <button
            onClick={async () => {
              const targetId = profile?.userId || currentStream.tarotistaId;
              setIsFollowingHost(!isFollowingHost);
              await fetch(`/api/users/${encodeURIComponent(targetId)}/follow`, {
                method: isFollowingHost ? 'DELETE' : 'POST',
              }).catch(() => {});
            }}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${
              isFollowingHost
                ? 'bg-[#1A1026] text-[#F7E7C1]/80 border-[#D4AF37]/30'
                : 'bg-[#5A2D82] text-[#D4AF37] border-[#D4AF37]/30 hover:brightness-110'
            }`}
          >
            {isFollowingHost ? '✓ Siguiendo' : 'Seguir'}
          </button>
        </div>

        {/* Viewer count & Queue Badge */}
        <div className="flex items-center gap-2">
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1.5 text-xs text-[#F7E7C1]">
            <span className="material-symbols-outlined text-red-500 text-sm filled">visibility</span>
            <span className="font-bold">{currentStream.viewersCount || 1}</span>
          </div>

          {/* Queue Indicator Badge */}
          <div className="glass-card px-3 py-1 rounded-full flex items-center gap-1 text-xs text-[#D4AF37]">
            <span className="material-symbols-outlined text-sm">groups</span>
            <span className="font-bold">Cola: {queueUsers.length}</span>
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
        {/* Broadcaster Live Studio Controls Bar (Visible when YOU are broadcasting) */}
        {isTarotistaOwner && (
          <div className="flex items-center justify-between gap-1.5 bg-[#1A0E2E]/90 border border-[#E5B54F]/40 rounded-2xl p-2 mb-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`w-8 h-8 rounded-xl flex items-center justify-center border text-xs transition-all ${
                  isMicMuted
                    ? 'bg-red-950/80 border-red-500 text-red-300'
                    : 'bg-black/40 border-white/15 text-[#F7E7C1] hover:border-[#E5B54F]'
                }`}
                title={isMicMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
              >
                <span className="material-symbols-outlined text-base">
                  {isMicMuted ? 'mic_off' : 'mic'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleCamera}
                className={`w-8 h-8 rounded-xl flex items-center justify-center border text-xs transition-all ${
                  isCameraOff || !useCameraMode
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    : 'bg-black/40 border-white/15 text-[#F7E7C1] hover:border-[#E5B54F]'
                }`}
                title="Alternar Cámara / Altar Místico"
              >
                <span className="material-symbols-outlined text-base">
                  {isCameraOff || !useCameraMode ? 'auto_awesome' : 'videocam'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const idx = AURA_FILTERS.findIndex((a) => a.id === auraFilter);
                  const next = AURA_FILTERS[(idx + 1) % AURA_FILTERS.length];
                  setAuraFilter(next.id);
                }}
                className="px-2.5 h-8 rounded-xl bg-black/40 border border-white/15 text-[10px] font-bold text-[#E5B54F] hover:border-[#E5B54F] flex items-center gap-1"
                title="Cambiar Filtro de Aura"
              >
                <span className="material-symbols-outlined text-sm">flare</span>
                <span>Aura</span>
              </button>
            </div>

            {/* Interactive Draw Tarot Card on Live Screen Button */}
            <button
              type="button"
              onClick={handleDrawLiveTarotCard}
              className="gold-gradient-btn px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-md"
            >
              <span>🎴 Sacar Carta en Vivo</span>
            </button>
          </div>
        )}

        {/* Tarotista Call Next Queue User Button */}
        {isTarotistaOwner && queueUsers.length > 0 && (
          <button
            onClick={() => onCallNextQueueUser && onCallNextQueueUser(currentStream.id)}
            className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-2 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 gold-glow"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Siguiente Consulta en Cola ({queueUsers[0].name})
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
            onClick={() => onJoinQueue(currentStream.id, 10, 'video')}
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

          {/* Live Sacred Flame Tap Button */}
          <button
            type="button"
            onClick={() => {
              setLiveFlamesCount(c => c + 1);
              setFlameBurst(true);
              setTimeout(() => setFlameBurst(false), 450);
            }}
            className={`px-3 py-2 rounded-full bg-[#1A1026] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold flex items-center gap-1 transition-transform ${
              flameBurst ? 'scale-125 shadow-[0_0_16px_#D4AF37]' : 'hover:scale-105'
            }`}
            title="Enviar Llama Sagrada al Directo"
          >
            <span>🔥</span>
            <span className="text-[10px]">{liveFlamesCount}</span>
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
          onClick={() => onBookConsultation && onBookConsultation(currentStream.tarotistaId)}
          className="w-full bg-gradient-to-r from-[#5A2D82] to-[#2E1B47] border border-[#D4AF37]/50 text-[#F7E7C1] font-bold py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 gold-glow hover:brightness-110 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[#D4AF37] filled">bolt</span>
          Reservar Consulta Privada 1:1 (€{(profile?.pricePerMinEur ?? 1.50).toFixed(2)}/min)
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

      {/* Modal de Configuración "Emitir en Directo LIVE" (Estilo TikTok LIVE Studio) */}
      {showGoLiveModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#140B22] border-2 border-[#E5B54F] rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-[0_15px_55px_rgba(0,0,0,0.9)] space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                <h3 className="font-cinzel text-base sm:text-lg font-bold text-[#F7E7C1]">
                  Estudio de Directo KABALY LIVE
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowGoLiveModal(false);
                  if (!isBroadcasting && localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                  }
                }}
                className="w-8 h-8 rounded-full bg-white/5 text-[#A09BAE] hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Vista Previa de Cámara WebRTC o Altar Místico */}
            <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-black border border-[#E5B54F]/35">
              {useCameraMode ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ filter: activeAuraCss }}
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <video
                  src="https://assets.mixkit.co/videos/preview/mixkit-hands-shuffling-a-deck-of-tarot-cards-43403-large.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ filter: activeAuraCss }}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

              <div className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>VISTA PREVIA LIVE</span>
              </div>

              {/* Selector Cámara WebRTC vs Altar Místico */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!useCameraMode) startCameraPreview();
                    else setUseCameraMode(false);
                  }}
                  className="bg-black/70 backdrop-blur-md border border-[#E5B54F]/40 text-[#F7E7C1] px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 hover:border-[#E5B54F]"
                >
                  <span className="material-symbols-outlined text-sm text-[#E5B54F]">
                    {useCameraMode ? 'videocam' : 'auto_awesome'}
                  </span>
                  <span>{useCameraMode ? 'Cámara Web Activa' : 'Modo Altar Místico'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {AURA_FILTERS.map((af) => (
                    <button
                      key={af.id}
                      type="button"
                      onClick={() => setAuraFilter(af.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                        auraFilter === af.id
                          ? 'bg-[#E5B54F] text-[#0B0911] border-[#E5B54F]'
                          : 'bg-black/60 text-[#D8CEF0] border-white/15'
                      }`}
                    >
                      {af.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {cameraError && (
              <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px]">
                {cameraError}
              </div>
            )}

            <form onSubmit={handleStartLiveBroadcast} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#E5B54F] font-bold block mb-1">
                  Título de tu Directo
                </label>
                <input
                  type="text"
                  required
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Ej. Lectura de Tarot en Vivo & Preguntas Gratis ✨"
                  className="w-full bg-[#0B0911] border border-[#E5B54F]/35 rounded-xl px-3.5 py-2.5 text-xs text-[#F7E7C1] outline-none focus:border-[#E5B54F]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#E5B54F] font-bold block mb-1">
                  Categoría Espiritual
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Tarot', 'Astrología', 'Rituales', 'Runas', 'Numerología', 'Videncia'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        liveCategory === cat
                          ? 'bg-[#231338] border-[#E5B54F] text-[#E5B54F] font-bold'
                          : 'bg-[#0B0911] border-white/10 text-[#A09BAE] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoLiveModal(false)}
                  className="px-4 py-3 rounded-full border border-white/15 text-xs font-bold text-[#A09BAE] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isStartingBroadcast}
                  className="flex-1 gold-gradient-btn py-3 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                  <span>{isStartingBroadcast ? 'Iniciando Sala LIVE...' : '🔴 Emitir en Directo Ahora'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
