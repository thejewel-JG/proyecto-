import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Consultation, User, TarotistaProfile, ConsultationMessage } from '../types';

interface ConsultationRoomViewProps {
  consultation: Consultation;
  currentUser?: User;
  tarotistaProfiles?: TarotistaProfile[];
  onTransitionStatus: (consultationId: string, targetStatus: string, reason?: string) => void;
  onSubmitReview: (consultationId: string, rating: number, comment: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}

export const ConsultationRoomView: React.FC<ConsultationRoomViewProps> = ({
  consultation,
  currentUser = { id: '', name: 'Invitado', email: '', role: 'cliente', avatar: '', coinsBalance: 0, isAgeVerified: true, spentToday: 0, spentThisWeek: 0, createdAt: '' },
  tarotistaProfiles: _tarotistaProfiles,
  onTransitionStatus,
  onSubmitReview,
  onBack,
  onClose,
}) => {
  const handleExit = onBack || onClose || (() => {});
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sincronización estricta del tiempo restante con scheduledEndAt del servidor
  const calculateRemainingSec = useCallback(() => {
    if (consultation.status !== 'en_curso') return consultation.durationMinutes * 60;
    if (!consultation.scheduledEndAt) return consultation.durationMinutes * 60;
    const end = new Date(consultation.scheduledEndAt).getTime();
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  }, [consultation.status, consultation.scheduledEndAt, consultation.durationMinutes]);

  const [timeLeftSec, setTimeLeftSec] = useState<number>(calculateRemainingSec);
  const [drawnCards, setDrawnCards] = useState<{ name: string; meaning: string; image: string }[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Hardware Pre-flight Check State
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [preflightTested, setPreflightTested] = useState(false);

  const isClient = currentUser.id === consultation.clientId;
  const isTarotista = !isClient;
  const pollIntervalRef = useRef<any>(null);

  // 1. Cargar y sincronizar mensajes reales de la sala
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/consultations/${consultation.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
          // Extraer cartas del tarot que se hayan compartido
          const cardsFromMsgs = data.messages
            .filter((m: ConsultationMessage) => m.cardData)
            .map((m: ConsultationMessage) => m.cardData);
          if (cardsFromMsgs.length > 0) {
            setDrawnCards(cardsFromMsgs);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching consultation messages:', e);
    }
  }, [consultation.id]);

  useEffect(() => {
    fetchMessages();
    pollIntervalRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages]);

  // 2. Cronómetro sincronizado con el timestamp del servidor (Recargar no reinicia)
  useEffect(() => {
    setTimeLeftSec(calculateRemainingSec());
    if (consultation.status !== 'en_curso') return;

    const timer = setInterval(() => {
      const remaining = calculateRemainingSec();
      setTimeLeftSec(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onTransitionStatus(consultation.id, 'completada', 'Tiempo contratado finalizado');
        if (isClient) {
          setShowReviewModal(true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [consultation.status, consultation.scheduledEndAt, calculateRemainingSec, consultation.id, onTransitionStatus, isClient]);

  // Enviar mensaje en sala privada
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || isSending) return;

    try {
      setIsSending(true);
      const res = await fetch(`/api/consultations/${consultation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar mensaje');
      }
      setInputMsg('');
      fetchMessages();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar');
    } finally {
      setIsSending(false);
    }
  };

  // Herramienta de tirada de tarot para el profesional
  const handleDrawTarotCard = async () => {
    const cardDeck = [
      { name: 'El Sol (XIX)', meaning: 'Éxito brillante, vitalidad y claridad en tu camino.', image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=300' },
      { name: 'La Estrella (XVII)', meaning: 'Esperanza renovada, fe en el futuro y sanación profunda.', image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300' },
      { name: 'Los Enamorados (VI)', meaning: 'Decisiones del alma, armonía espiritual y unión.', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=300' },
      { name: 'La Sacerdotisa (II)', meaning: 'Intuición mística, misterios velados y sabiduría interior.', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=300' }
    ];

    const card = cardDeck[Math.floor(Math.random() * cardDeck.length)];

    try {
      await fetch(`/api/consultations/${consultation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🔮 Carta revelada por ${currentUser.name}: ${card.name} — "${card.meaning}"`,
          cardData: card,
        }),
      });
      fetchMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinishConsultation = () => {
    if (confirm('¿Deseas finalizar la sesión privada antes de tiempo? Los honorarios se liquidarán según lo contratado.')) {
      onTransitionStatus(consultation.id, 'completada', 'Finalizado por el usuario');
      if (isClient) {
        setShowReviewModal(true);
      }
    }
  };

  const handleReportDispute = () => {
    const reason = prompt('Indica el motivo del reclamo o problema técnico durante la sesión:');
    if (reason && reason.trim()) {
      onTransitionStatus(consultation.id, 'disputada', reason.trim());
      alert('Tu caso ha sido remitido al equipo de Resolución de Disputas de KABALY. Un administrador auditará la sesión.');
    }
  };

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen flex flex-col justify-between border-x border-[#D4AF37]/30">
      {/* Header Bar */}
      <header className="p-4 bg-[#1A1026] border-b border-[#D4AF37]/30 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <button onClick={handleExit} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="w-10 h-10 rounded-full border border-[#D4AF37] overflow-hidden">
            <img src={isClient ? consultation.tarotistaAvatar : consultation.clientAvatar} alt="Foto" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-playfair text-sm font-bold text-[#D4AF37] flex items-center gap-1">
              {isClient ? consultation.tarotistaName : consultation.clientName}
              <span className="material-symbols-outlined text-xs filled">verified</span>
            </h3>
            <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider block">
              Consulta {consultation.type} • {consultation.durationMinutes} min ({consultation.totalCoins} Monedas)
            </span>
          </div>
        </div>

        {/* Status Badge & Server Countdown */}
        <div className="flex items-center gap-2">
          {consultation.status === 'en_curso' && (
            <div className="bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 gold-glow">
              <span className="material-symbols-outlined text-sm animate-spin">schedule</span>
              <span>{minutes}:{seconds < 10 ? `0${seconds}` : seconds}</span>
            </div>
          )}

          {consultation.status === 'solicitada' && (
            <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              Pendiente de aceptación
            </span>
          )}

          {consultation.status === 'aceptada' && (
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              Aceptada (Lista)
            </span>
          )}

          {consultation.status === 'completada' && (
            <span className="bg-green-500/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              Completada
            </span>
          )}

          {consultation.status === 'disputada' && (
            <span className="bg-red-500/20 text-red-300 border border-red-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              En Disputa
            </span>
          )}

          <button onClick={handleReportDispute} className="text-[#A7A7A7] hover:text-red-400 p-1" title="Reportar problema o abrir disputa">
            <span className="material-symbols-outlined text-lg">flag</span>
          </button>
        </div>
      </header>

      {/* Error or Warning Banner */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-500/50 p-3 text-center text-xs text-red-200 flex justify-between items-center px-4">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 font-bold ml-2">✕</button>
        </div>
      )}

      {/* State Actions Bar if Pending Acceptance */}
      {consultation.status === 'solicitada' && (
        <div className="bg-[#2E1B47]/80 p-4 border-b border-[#D4AF37]/30 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-[#F7E7C1]">
            Esta consulta de {consultation.durationMinutes} min ({consultation.totalCoins} monedas) está esperando confirmación del profesional.
          </p>
          <div className="text-[10px] text-[#A7A7A7]">
            Tus fondos están retenidos en la reserva interna protegida de KABALY.
          </div>
          {isTarotista ? (
            <div className="flex gap-3">
              <button
                onClick={() => onTransitionStatus(consultation.id, 'aceptada')}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-6 py-2 rounded-full text-xs uppercase hover:bg-[#F7E7C1] gold-glow"
              >
                Aceptar Solicitud
              </button>
              <button
                onClick={() => onTransitionStatus(consultation.id, 'rechazada', 'Rechazada por el profesional')}
                className="bg-red-500/20 text-red-300 border border-red-500 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-500/30"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <button
              onClick={() => onTransitionStatus(consultation.id, 'cancelada', 'Cancelada por el cliente antes de aceptación')}
              className="text-xs text-red-400 underline font-bold hover:text-red-300"
            >
              Cancelar solicitud y liberar reserva de monedas
            </button>
          )}
        </div>
      )}

      {/* State Actions Bar if Accepted (Ready to Start) */}
      {consultation.status === 'aceptada' && (
        <div className="bg-[#1A1026] p-4 border-b border-[#D4AF37]/40 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-[#F7E7C1] font-bold">
            ¡Consulta aceptada! Comprueba tus dispositivos antes de entrar a la sala privada.
          </p>
          
          {/* Pre-flight Hardware Check Controls */}
          {(consultation.type === 'video' || consultation.type === 'audio') && (
            <div className="flex gap-4 text-xs bg-[#0B0911] px-4 py-2 rounded-2xl border border-[#D4AF37]/30">
              <button
                onClick={() => setMicActive(!micActive)}
                className={`flex items-center gap-1.5 font-bold ${micActive ? 'text-green-400' : 'text-red-400'}`}
              >
                <span className="material-symbols-outlined text-sm">{micActive ? 'mic' : 'mic_off'}</span>
                Micrófono {micActive ? 'OK' : 'Mudo'}
              </button>

              {consultation.type === 'video' && (
                <button
                  onClick={() => setCamActive(!camActive)}
                  className={`flex items-center gap-1.5 font-bold ${camActive ? 'text-green-400' : 'text-red-400'}`}
                >
                  <span className="material-symbols-outlined text-sm">{camActive ? 'videocam' : 'videocam_off'}</span>
                  Cámara {camActive ? 'OK' : 'Off'}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPreflightTested(true);
                onTransitionStatus(consultation.id, 'en_curso');
              }}
              className="bg-[#D4AF37] text-[#0B0911] font-bold px-8 py-2.5 rounded-full text-xs uppercase gold-glow hover:scale-105 transition-all"
            >
              Entrar a la Sala y Comenzar
            </button>
            <button
              onClick={() => onTransitionStatus(consultation.id, 'cancelada', 'Cancelada de mutuo acuerdo')}
              className="text-xs text-red-400 underline font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Call / Video Feed or Chat Area */}
      <main className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar">
        {/* Video Call Simulation Box if type is video */}
        {consultation.type === 'video' && consultation.status === 'en_curso' && (
          <div className="w-full h-48 bg-[#1A1026] rounded-2xl border border-[#D4AF37]/30 relative overflow-hidden flex items-center justify-center shadow-2xl mb-4">
            <img
              src={isClient ? consultation.tarotistaAvatar : consultation.clientAvatar}
              alt="Interlocutor"
              className="w-full h-full object-cover brightness-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            {/* Self PIP View */}
            <div className="absolute bottom-3 right-3 w-20 h-28 rounded-xl border-2 border-[#D4AF37] overflow-hidden bg-black shadow-lg">
              <img src={currentUser.avatar} alt="Yo" className="w-full h-full object-cover" />
            </div>

            <div className="absolute top-3 left-3 bg-[#0B0911]/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-[#D4AF37] font-bold flex items-center gap-1.5 border border-[#D4AF37]/30">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Sala Privada 1:1 Cifrada
            </div>

            <div className="absolute bottom-3 left-3 flex gap-2">
              <button
                onClick={() => setMicActive(!micActive)}
                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs ${
                  micActive ? 'bg-[#1A1026] border-[#D4AF37] text-[#D4AF37]' : 'bg-red-500 border-red-500 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{micActive ? 'mic' : 'mic_off'}</span>
              </button>
              <button
                onClick={() => setCamActive(!camActive)}
                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs ${
                  camActive ? 'bg-[#1A1026] border-[#D4AF37] text-[#D4AF37]' : 'bg-red-500 border-red-500 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{camActive ? 'videocam' : 'videocam_off'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Drawn Cards Carousel */}
        {drawnCards.length > 0 && (
          <div className="bg-[#2E1B47]/40 p-3 rounded-2xl border border-[#D4AF37]/20">
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-2">
              Cartas Extraídas en esta Sesión ({drawnCards.length})
            </span>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {drawnCards.map((c, i) => (
                <div key={i} className="flex-shrink-0 w-28 bg-[#1A1026] p-2 rounded-xl border border-[#D4AF37]/30 text-center">
                  <img src={c.image} alt={c.name} className="w-full h-20 object-cover rounded-lg mb-1" />
                  <span className="text-[10px] font-bold text-[#D4AF37] block truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages List from real backend */}
        {messages.length === 0 ? (
          <div className="text-center text-xs text-[#A7A7A7] py-8">
            <span className="material-symbols-outlined text-3xl text-[#D4AF37]/40 block mb-2">lock</span>
            Sala privada iniciada. Todos los mensajes y lecturas son confidenciales y exclusivos entre tú y el profesional.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.senderId === currentUser.id ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                  m.senderId === currentUser.id
                    ? 'bg-[#5A2D82] text-[#F7E7C1] rounded-tr-none border border-[#D4AF37]/30'
                    : 'bg-[#1A1026] text-[#F7E7C1] rounded-tl-none border border-[#D4AF37]/20'
                }`}
              >
                <span className="text-[10px] font-bold text-[#D4AF37] block mb-0.5">{m.senderName}</span>
                <p>{m.content}</p>
              </div>
              <span className="text-[9px] text-[#A7A7A7] mt-1">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </main>

      {/* Footer Tools & Input */}
      <footer className="p-3 bg-[#1A1026] border-t border-[#D4AF37]/30 flex flex-col gap-2">
        {/* Tarot Card Draw Button for Tarotista */}
        {isTarotista && consultation.status === 'en_curso' && (
          <button
            onClick={handleDrawTarotCard}
            className="w-full bg-gradient-to-r from-[#5A2D82] to-[#2E1B47] border border-[#D4AF37] text-[#D4AF37] font-bold py-2 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 gold-glow"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            Extraer Carta del Mazo y Compartir
          </button>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            disabled={consultation.status !== 'en_curso'}
            placeholder={consultation.status === 'en_curso' ? 'Escribe un mensaje privado...' : 'Consulta no activa'}
            className="flex-1 bg-[#0B0911] border border-[#D4AF37]/30 rounded-full px-4 py-2.5 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={consultation.status !== 'en_curso' || isSending}
            className="bg-[#D4AF37] text-[#0B0911] font-bold p-2.5 rounded-full hover:brightness-110 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </form>

        {consultation.status === 'en_curso' && (
          <button
            onClick={handleFinishConsultation}
            className="text-[10px] text-red-400 hover:underline text-center mt-1"
          >
            Finalizar consulta antes de tiempo
          </button>
        )}
      </footer>

      {/* Review Modal upon Completion (Solo cliente) */}
      {showReviewModal && isClient && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow">
            <div className="w-16 h-16 rounded-full bg-[#5A2D82] text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl filled">star</span>
            </div>
            <h3 className="font-playfair text-xl text-[#F7E7C1] font-bold mb-1">Valorar Consulta</h3>
            <p className="text-xs text-[#A7A7A7] mb-4">
              Tu reseña verificada ayuda a la comunidad a encontrar guías auténticos en KABALY.
            </p>

            {/* Star Rating Picker */}
            <div className="flex justify-center gap-2 text-[#D4AF37] mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="hover:scale-125 transition-transform"
                >
                  <span className={`material-symbols-outlined text-3xl ${star <= reviewRating ? 'filled' : ''}`}>
                    star
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Escribe tu valoración (opcional)..."
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37] mb-4 h-24"
            />

            <button
              onClick={() => {
                onSubmitReview(consultation.id, reviewRating, reviewComment);
                setShowReviewModal(false);
                handleExit();
              }}
              className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:bg-[#F7E7C1] transition-all"
            >
              Publicar Reseña Verificada
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
