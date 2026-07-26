import React, { useState } from 'react';
import { TarotistaProfile, User } from '../types';

interface BookConsultationModalProps {
  tarotista: TarotistaProfile;
  currentUser: User;
  onConfirmBooking: (type: 'chat' | 'audio' | 'video', durationMinutes: number) => void;
  onClose: () => void;
  onOpenWallet: () => void;
}

export const BookConsultationModal: React.FC<BookConsultationModalProps> = ({
  tarotista,
  currentUser,
  onConfirmBooking,
  onClose,
  onOpenWallet,
}) => {
  const [type, setType] = useState<'chat' | 'audio' | 'video'>('video');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);

  const totalCoins = durationMinutes * tarotista.pricePerMinCoins;
  const totalEur = totalCoins / 10;
  const hasEnoughCoins = currentUser.coinsBalance >= totalCoins;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#D4AF37]/20">
          <span className="font-playfair text-sm text-[#D4AF37] font-bold">Reservar Consulta 1:1</span>
          <button onClick={onClose} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tarotista Summary */}
        <div className="flex items-center gap-3 bg-[#0B0911] p-3 rounded-2xl border border-[#D4AF37]/20 mb-4">
          <img src={tarotista.avatar} alt={tarotista.professionalName} className="w-12 h-12 rounded-full object-cover border border-[#D4AF37]" />
          <div className="text-left">
            <h4 className="font-playfair text-sm font-bold text-[#F7E7C1] flex items-center gap-1">
              {tarotista.professionalName}
              <span className="material-symbols-outlined text-xs text-[#D4AF37] filled">verified</span>
            </h4>
            <span className="text-[10px] text-[#D4AF37] font-bold">
              Tarifa: {tarotista.pricePerMinCoins} Monedas / min (€{tarotista.pricePerMinEur.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Modality Picker */}
        <div className="text-left mb-4">
          <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Modalidad de Consulta</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'chat', label: 'Chat', icon: 'chat' },
              { id: 'audio', label: 'Voz', icon: 'call' },
              { id: 'video', label: 'Vídeo', icon: 'videocam' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setType(m.id as any)}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                  type === m.id
                    ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37] gold-glow'
                    : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration Picker */}
        <div className="text-left mb-6">
          <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Duración de la Sesión</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[10, 15, 20, 30].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDurationMinutes(mins)}
                className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                  durationMinutes === mins
                    ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37] gold-glow'
                    : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-[#2E1B47]/60 border border-[#D4AF37]/30 rounded-2xl p-4 mb-6 flex justify-between items-center text-xs">
          <span className="text-[#A7A7A7]">Total en Custodia (Escrow):</span>
          <div className="text-right">
            <span className="font-playfair text-lg font-bold text-[#D4AF37] block">
              {totalCoins} Monedas
            </span>
            <span className="text-[10px] text-[#A7A7A7]">
              (€{totalEur.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Confirm or Topup CTA */}
        {hasEnoughCoins ? (
          <button
            onClick={() => onConfirmBooking(type, durationMinutes)}
            className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all"
          >
            Confirmar Reserva ({totalCoins} Monedas)
          </button>
        ) : (
          <div className="space-y-2">
            <span className="text-[10px] text-red-400 font-bold block">
              Saldo insuficiente. Te faltan {totalCoins - currentUser.coinsBalance} Monedas.
            </span>
            <button
              onClick={() => {
                onClose();
                onOpenWallet();
              }}
              className="w-full bg-gradient-to-r from-[#5A2D82] to-[#2E1B47] border border-[#D4AF37] text-[#D4AF37] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow"
            >
              Recargar Monedas Ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
