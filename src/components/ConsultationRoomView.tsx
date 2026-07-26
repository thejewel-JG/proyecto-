import React, { useState, useEffect } from 'react';
import { Consultation, User, TarotistaProfile } from '../types';

interface ConsultationRoomViewProps {
  consultation: Consultation;
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  onTransitionStatus: (consultationId: string, targetStatus: string, reason?: string) => void;
  onSubmitReview: (consultationId: string, rating: number, comment: string) => void;
  onBack: () => void;
}

export const ConsultationRoomView: React.FC<ConsultationRoomViewProps> = ({
  consultation,
  currentUser,
  tarotistaProfiles,
  onTransitionStatus,
  onSubmitReview,
  onBack,
}) => {
  const [messages, setMessages] = useState<{ id: string; senderName: string; text: string; time: string; card?: string }[]>([
    {
      id: '1',
      senderName: consultation.tarotistaName,
      text: `¡Bienvenido/a a tu consulta privada 1:1 de ${consultation.durationMinutes} minutos! Estoy conectando con tu energía. ¿Qué aspecto de tu vida deseas explorar hoy?`,
      time: '10:00',
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [timeLeftSec, setTimeLeftSec] = useState(consultation.durationMinutes * 60);
  const [drawnCards, setDrawnCards] = useState<{ name: string; meaning: string; image: string }[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const isClient = currentUser.id === consultation.clientId;
  const isTarotista = !isClient;

  // Countdown timer when session is active
  useEffect(() => {
    if (consultation.status !== 'en_curso') return;

    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTransitionStatus(consultation.id, 'completada', 'Tiempo finalizado');
          setShowReviewModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [consultation.status]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        senderName: currentUser.name,
        text: inputMsg.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    setInputMsg('');
  };

  // Tarot Card Draw tool for Tarotista
  const handleDrawTarotCard = () => {
    const cardDeck = [
      { name: 'El Sol (XIX)', meaning: 'Éxito brillante, alegría y claridad en tus proyectos.', image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=300' },
      { name: 'La Estrella (XVII)', meaning: 'Esperanza renovada, fe en el futuro y sanación.', image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300' },
      { name: 'Los Enamorados (VI)', meaning: 'Elecciones de corazón, armonía y unión profunda.', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=300' },
      { name: 'La Sacerdotisa (II)', meaning: 'Intuición femenina, misterio y verdades ocultas.', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=300' }
    ];

    const card = cardDeck[Math.floor(Math.random() * cardDeck.length)];
    setDrawnCards((prev) => [...prev, card]);

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_card_${Date.now()}`,
        senderName: consultation.tarotistaName,
        text: `🔮 Carta extraída: ${card.name} — "${card.meaning}"`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        card: card.name,
      }
    ]);
  };

  const handleFinishConsultation = () => {
    if (confirm('¿Deseas finalizar la consulta privada ahora?')) {
      onTransitionStatus(consultation.id, 'completada', 'Finalizado por el usuario');
      if (isClient) {
        setShowReviewModal(true);
      }
    }
  };

  const handleReportDispute = () => {
    const reason = prompt('Indica el motivo del reporte o problema técnico durante la consulta:');
    if (reason) {
      onTransitionStatus(consultation.id, 'disputada', reason);
      alert('Tu caso ha sido enviado al equipo de Resolución de Disputas de ASTRALIS. Un administrador revisará la sesión.');
    }
  };

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen flex flex-col justify-between border-x border-[#D4AF37]/30">
      {/* Header Bar */}
      <header className="p-4 bg-[#1A1026] border-b border-[#D4AF37]/30 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="w-10 h-10 rounded-full border border-[#D4AF37] overflow-hidden">
            <img src={consultation.tarotistaAvatar} alt={consultation.tarotistaName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-playfair text-sm font-bold text-[#D4AF37] flex items-center gap-1">
              {consultation.tarotistaName}
              <span className="material-symbols-outlined text-xs filled">verified</span>
            </h3>
            <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider block">
              Consulta {consultation.type} • {consultation.durationMinutes} min
            </span>
          </div>
        </div>

        {/* Status Badge & Timer Countdown */}
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

          {consultation.status === 'completada' && (
            <span className="bg-green-500/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
              Completada
            </span>
          )}

          <button onClick={handleReportDispute} className="text-[#A7A7A7] hover:text-red-400 p-1" title="Reportar problema">
            <span className="material-symbols-outlined text-lg">flag</span>
          </button>
        </div>
      </header>

      {/* State Actions Bar if Pending Acceptance */}
      {consultation.status === 'solicitada' && (
        <div className="bg-[#2E1B47]/80 p-4 border-b border-[#D4AF37]/30 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-[#F7E7C1]">
            Esta consulta de {consultation.durationMinutes} min ({consultation.totalCoins} monedas) está esperando confirmación.
          </p>
          {isTarotista ? (
            <div className="flex gap-3">
              <button
                onClick={() => onTransitionStatus(consultation.id, 'en_curso')}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-6 py-2 rounded-full text-xs uppercase"
              >
                Aceptar y Comenzar
              </button>
              <button
                onClick={() => onTransitionStatus(consultation.id, 'rechazada', 'Rechazada por el profesional')}
                className="bg-red-500/20 text-red-300 border border-red-500 px-4 py-2 rounded-full text-xs font-bold"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <button
              onClick={() => onTransitionStatus(consultation.id, 'cancelada', 'Cancelada por el cliente')}
              className="text-xs text-red-400 underline font-bold"
            >
              Cancelar solicitud y devolver monedas
            </button>
          )}
        </div>
      )}

      {/* Main Call / Video Feed or Chat Area */}
      <main className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar">
        {/* Video Call Simulation Box if type is video */}
        {consultation.type === 'video' && (
          <div className="w-full h-48 bg-[#1A1026] rounded-2xl border border-[#D4AF37]/30 relative overflow-hidden flex items-center justify-center shadow-2xl mb-4">
            <img
              src={consultation.tarotistaAvatar}
              alt={consultation.tarotistaName}
              className="w-full h-full object-cover brightness-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            {/* Self PIP View */}
            <div className="absolute bottom-3 right-3 w-20 h-28 rounded-xl border-2 border-[#D4AF37] overflow-hidden bg-black shadow-lg">
              <img src={currentUser.avatar} alt="Yo" className="w-full h-full object-cover" />
            </div>

            <div className="absolute top-3 left-3 bg-[#0B0911]/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-[#D4AF37] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Videollamada en Vivo Cifrada
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

        {/* Messages List */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.senderName === currentUser.name ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.senderName === currentUser.name
                  ? 'bg-[#5A2D82] text-[#F7E7C1] rounded-tr-none border border-[#D4AF37]/30'
                  : 'bg-[#1A1026] text-[#F7E7C1] rounded-tl-none border border-[#D4AF37]/20'
              }`}
            >
              <span className="text-[10px] font-bold text-[#D4AF37] block mb-0.5">{m.senderName}</span>
              <p>{m.text}</p>
            </div>
            <span className="text-[9px] text-[#A7A7A7] mt-1">{m.time}</span>
          </div>
        ))}
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
            placeholder={consultation.status === 'en_curso' ? 'Escribe un mensaje...' : 'Consulta no activa'}
            className="flex-1 bg-[#0B0911] border border-[#D4AF37]/30 rounded-full px-4 py-2.5 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={consultation.status !== 'en_curso'}
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

      {/* Review Modal upon Completion */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow">
            <div className="w-16 h-16 rounded-full bg-[#5A2D82] text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl filled">star</span>
            </div>
            <h3 className="font-playfair text-xl text-[#F7E7C1] font-bold mb-1">Valorar Consulta</h3>
            <p className="text-xs text-[#A7A7A7] mb-4">
              Tu reseña ayuda a la comunidad de ASTRALIS a encontrar guías espirituales auténticos.
            </p>

            {/* Star Rating Picker */}
            <div className="flex justify-center gap-2 text-[#D4AF37] mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
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
              placeholder="Escribe tu experiencia (opcional)..."
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37] mb-4 h-24"
            />

            <button
              onClick={() => {
                onSubmitReview(consultation.id, reviewRating, reviewComment);
                setShowReviewModal(false);
                onBack();
              }}
              className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
            >
              Publicar Reseña Verificada
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
