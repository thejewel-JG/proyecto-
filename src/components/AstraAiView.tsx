import React, { useState } from 'react';
import { User, TarotistaProfile } from '../types';

interface AstraAiViewProps {
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  onBookConsultation: (tarotistaId: string) => void;
  onBack?: () => void;
}

export const AstraAiView: React.FC<AstraAiViewProps> = ({
  currentUser,
  tarotistaProfiles,
  onBookConsultation,
  onBack,
}) => {
  const [messages, setMessages] = useState<
    { id: string; sender: 'user' | 'ai'; text: string; cardDrawn?: { name: string; meaning: string; imageUrl: string }; isCrisis?: boolean }[]
  >([
    {
      id: '1',
      sender: 'ai',
      text: 'Saludos estelares. Soy Kabaly AI, tu guía mística de iluminación y autoconocimiento. ¿Qué inquietud o velo del futuro deseas explorar hoy?',
    }
  ]);
  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dailyAiQueries, setDailyAiQueries] = useState(1); // 5 queries limit per day free

  const handleSendPrompt = async (textToSend?: string) => {
    const finalPrompt = textToSend || promptInput;
    if (!finalPrompt.trim() || isLoading) return;

    if (dailyAiQueries >= 5) {
      alert('Has alcanzado el límite gratuito de 5 consultas diarias con Kabaly AI. Para profundizaciones personalizadas, te recomendamos reservar una lectura 1:1 con nuestros profesionales verificados.');
      return;
    }

    const userMsgId = `usr_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: finalPrompt.trim() }
    ]);
    setPromptInput('');
    setIsLoading(true);
    setDailyAiQueries(prev => prev + 1);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: data.response || 'Las estrellas te invitan a confiar en tu voz interior.',
          cardDrawn: data.cardDrawn,
          isCrisis: data.isCrisis,
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'ai',
          text: 'Las corrientes energéticas han sufrido una leve turbulencia. Por favor, intenta formular tu pregunta de nuevo.',
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const recommendedTarotista = tarotistaProfiles[0];

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen flex flex-col justify-between border-x border-[#D4AF37]/20 p-4 pb-28">
      {/* Header */}
      <header className="flex justify-between items-center mb-4 pb-3 border-b border-[#D4AF37]/20">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] p-0.5 gold-glow flex items-center justify-center">
            <span className="material-symbols-outlined text-xl text-[#0B0911] filled">auto_awesome</span>
          </div>
          <div>
            <h2 className="font-playfair text-lg font-bold text-[#D4AF37] text-gold-glow">Kabaly AI • Guía Mística</h2>
            <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Servidor IA Gemini 3.6 Flash</span>
          </div>
        </div>

        {/* Query usage counter badge */}
        <div className="bg-[#2E1B47]/80 border border-[#D4AF37]/30 px-3 py-1 rounded-full text-[10px] text-[#D4AF37] font-bold">
          Consultas hoy: {dailyAiQueries} / 5
        </div>
      </header>

      {/* Suggested Quick Prompts */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {[
          '🔮 Extraer carta del día',
          '✨ Horóscopo de hoy',
          '🌙 Significado de la Luna en Piscis',
          '🧘 Sanación y paz interior'
        ].map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendPrompt(p)}
            className="px-3 py-1.5 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 text-xs text-[#F7E7C1] hover:border-[#D4AF37] whitespace-nowrap transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <main className="flex-1 overflow-y-auto space-y-4 no-scrollbar mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-lg ${
                m.sender === 'user'
                  ? 'bg-[#5A2D82] text-[#F7E7C1] rounded-tr-none border border-[#D4AF37]/30'
                  : 'bg-[#1A1026] text-[#F7E7C1] rounded-tl-none border border-[#D4AF37]/20'
              } ${m.isCrisis ? 'border-2 border-red-500 bg-red-950/40' : ''}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#D4AF37] mb-1">
                <span className="material-symbols-outlined text-xs">
                  {m.sender === 'user' ? 'person' : 'auto_awesome'}
                </span>
                <span>{m.sender === 'user' ? currentUser.name : 'Kabaly AI'}</span>
              </div>

              <p className="whitespace-pre-wrap">{m.text}</p>

              {/* Drawn Tarot Card Visual Box if present */}
              {m.cardDrawn && (
                <div className="mt-3 p-3 bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl flex items-center gap-3">
                  <img
                    src={m.cardDrawn.imageUrl}
                    alt={m.cardDrawn.name}
                    className="w-16 h-24 object-cover rounded-lg border border-[#D4AF37]"
                  />
                  <div>
                    <span className="font-playfair text-sm text-[#D4AF37] font-bold block">{m.cardDrawn.name}</span>
                    <p className="text-[11px] text-[#A7A7A7] italic">{m.cardDrawn.meaning}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#D4AF37] animate-pulse">
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            <span>Consultando los registros oraculares del cosmos...</span>
          </div>
        )}
      </main>

      {/* Recommended Verified Tarotista Card Banner */}
      {recommendedTarotista && (
        <div className="mb-3 bg-gradient-to-r from-[#2E1B47] to-[#1A1026] border border-[#D4AF37]/40 rounded-2xl p-3 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2.5">
            <img src={recommendedTarotista.avatar} alt={recommendedTarotista.professionalName} className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]" />
            <div>
              <span className="font-bold text-[#F7E7C1] flex items-center gap-1">
                {recommendedTarotista.professionalName}
                <span className="material-symbols-outlined text-xs text-[#D4AF37] filled">verified</span>
              </span>
              <span className="text-[10px] text-[#A7A7A7]">Lecturas 1:1 en vivo disponibles</span>
            </div>
          </div>
          <button
            onClick={() => onBookConsultation(recommendedTarotista.id)}
            className="bg-[#D4AF37] text-[#0B0911] font-bold px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider gold-glow hover:scale-105"
          >
            Reservar 1:1
          </button>
        </div>
      )}

      {/* Input Field */}
      <form onSubmit={(e) => { e.preventDefault(); handleSendPrompt(); }} className="flex gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Formula tu pregunta al oráculo..."
          className="flex-1 bg-[#1A1026] border border-[#D4AF37]/30 rounded-full px-5 py-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] text-[#0B0911] font-bold px-5 py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 transition-all disabled:opacity-50"
        >
          Preguntar
        </button>
      </form>
    </div>
  );
};
