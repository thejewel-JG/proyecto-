import React, { useState } from 'react';
import { User } from '../types';

interface SpendingLimitsModalProps {
  currentUser: User;
  onSaveLimits: (dailyEur: number, weeklyEur: number) => void;
  onClose: () => void;
}

export const SpendingLimitsModal: React.FC<SpendingLimitsModalProps> = ({
  currentUser,
  onSaveLimits,
  onClose,
}) => {
  const [dailyEur, setDailyEur] = useState(currentUser.spendingLimitDaily || 100);
  const [weeklyEur, setWeeklyEur] = useState(currentUser.spendingLimitWeekly || 300);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveLimits(dailyEur, weeklyEur);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full text-center gold-glow">
        <div className="w-14 h-14 rounded-full bg-[#5A2D82] text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">shield</span>
        </div>

        <h3 className="font-playfair text-xl text-[#F7E7C1] font-bold mb-1">Autorregulación & Límites de Gasto</h3>
        <p className="text-xs text-[#A7A7A7] mb-4">
          Configura topes máximos de compra diaria y semanal en Euros para un consumo responsable e informado.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left text-xs text-[#F7E7C1]">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#A7A7A7] block mb-1">
              Límite Diario Máximo (€)
            </label>
            <input
              type="number"
              value={dailyEur}
              onChange={(e) => setDailyEur(Number(e.target.value))}
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#A7A7A7] block mb-1">
              Límite Semanal Máximo (€)
            </label>
            <input
              type="number"
              value={weeklyEur}
              onChange={(e) => setWeeklyEur(Number(e.target.value))}
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2E1B47] text-[#A7A7A7] font-bold py-3 rounded-full text-xs hover:text-[#F7E7C1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
            >
              Guardar Límites
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
