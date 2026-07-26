import React, { useState } from 'react';
import { User, CoinPackage, LedgerTransaction, WithdrawalRequest } from '../types';

interface WalletViewProps {
  currentUser: User;
  coinPackages: CoinPackage[];
  ledger: LedgerTransaction[];
  withdrawals: WithdrawalRequest[];
  onTopup: (packageId: string, paymentMethod: 'apple_pay' | 'stripe') => void;
  onRequestWithdrawal: (amountEur: number, vatNumber: string, bankIban: string) => void;
  onOpenSpendingLimits: () => void;
  onBack?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  coinPackages,
  ledger,
  withdrawals,
  onTopup,
  onRequestWithdrawal,
  onOpenSpendingLimits,
  onBack,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'apple_pay' | 'stripe'>('apple_pay');
  const [selectedPackId, setSelectedPackId] = useState<string>(coinPackages[1]?.id || 'pack_master');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'topup' | 'consultation' | 'gift' | 'withdrawal'>('all');

  // Withdrawal form state for tarotistas
  const [withdrawEur, setWithdrawEur] = useState(100);
  const [vatNumber, setVatNumber] = useState('ES12345678Z');
  const [bankIban, setBankIban] = useState('ES91 2100 0418 45 0200051332');

  const userLedger = ledger.filter(t => t.userId === currentUser.id);

  const filteredLedger = userLedger.filter(t => {
    if (ledgerFilter === 'all') return true;
    if (ledgerFilter === 'topup') return t.type === 'topup';
    if (ledgerFilter === 'consultation') return t.type.includes('consultation');
    if (ledgerFilter === 'gift') return t.type.includes('gift');
    if (ledgerFilter === 'withdrawal') return t.type === 'withdrawal';
    return true;
  });

  const selectedPack = coinPackages.find(p => p.id === selectedPackId) || coinPackages[1];

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen p-4 pb-28 border-x border-[#D4AF37]/20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div>
            <h2 className="font-playfair text-xl font-bold text-[#D4AF37] text-gold-glow">Monedero Astral</h2>
            <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Gestión Transparente de Saldo & Libro Mayor</span>
          </div>
        </div>

        <button
          onClick={onOpenSpendingLimits}
          className="flex items-center gap-1 bg-[#2E1B47]/60 border border-[#D4AF37]/30 px-3 py-1.5 rounded-full text-[10px] font-bold text-[#D4AF37] hover:border-[#D4AF37]"
        >
          <span className="material-symbols-outlined text-xs">tune</span>
          <span>Límites de Gasto</span>
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-tr from-[#2E1B47] via-[#5A2D82] to-[#1A1026] border border-[#D4AF37]/50 rounded-3xl p-6 gold-glow shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-9xl text-[#D4AF37]">stars</span>
        </div>

        <span className="text-xs text-[#F7E7C1] uppercase tracking-widest font-semibold block mb-1">
          Saldo Disponible
        </span>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="font-playfair text-4xl md:text-5xl font-bold text-[#D4AF37]">
            {currentUser.coinsBalance}
          </span>
          <span className="text-sm font-bold text-[#F7E7C1]">Monedas Astrales</span>
          <span className="text-xs text-[#A7A7A7] ml-2">
            (~€{(currentUser.coinsBalance / 10).toFixed(2)})
          </span>
        </div>

        {/* Spent indicators for self-regulation */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#D4AF37]/20 text-[11px] text-[#A7A7A7]">
          <div>
            Gasto Hoy: <span className="text-[#F7E7C1] font-bold">€{currentUser.spentToday.toFixed(2)}</span>
            {currentUser.spendingLimitDaily && ` / €${currentUser.spendingLimitDaily}`}
          </div>
          <div>
            Gasto Semanal: <span className="text-[#F7E7C1] font-bold">€{currentUser.spentThisWeek.toFixed(2)}</span>
            {currentUser.spendingLimitWeekly && ` / €${currentUser.spendingLimitWeekly}`}
          </div>
        </div>
      </div>

      {/* Recargas de Monedas Section */}
      <section className="mb-8">
        <h3 className="font-playfair text-base font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
          Recargar Monedas Astrales
        </h3>

        {/* Payment Method Selector */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setPaymentMethod('apple_pay')}
            className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              paymentMethod === 'apple_pay'
                ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37] gold-glow'
                : 'bg-[#1A1026] border-[#D4AF37]/20 text-[#A7A7A7]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">phone_iphone</span>
            Apple Pay / In-App
          </button>
          <button
            onClick={() => setPaymentMethod('stripe')}
            className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              paymentMethod === 'stripe'
                ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37] gold-glow'
                : 'bg-[#1A1026] border-[#D4AF37]/20 text-[#A7A7A7]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">credit_card</span>
            Stripe (Tarjeta / Bizum)
          </button>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {coinPackages.map((pack) => {
            const isSelected = pack.id === selectedPackId;
            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPackId(pack.id)}
                className={`p-4 rounded-2xl border cursor-pointer relative transition-all ${
                  isSelected
                    ? 'bg-[#2E1B47] border-[#D4AF37] gold-glow scale-[1.02]'
                    : 'bg-[#1A1026] border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                }`}
              >
                {pack.badge && (
                  <span className="absolute -top-2.5 right-3 bg-[#D4AF37] text-[#0B0911] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {pack.badge}
                  </span>
                )}
                <span className="material-symbols-outlined text-3xl text-[#D4AF37] mb-1">
                  {pack.icon}
                </span>
                <h4 className="font-playfair text-sm text-[#F7E7C1] font-bold">{pack.name}</h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-playfair text-xl font-bold text-[#D4AF37]">{pack.coins}</span>
                  <span className="text-[10px] text-[#A7A7A7]">Monedas</span>
                </div>
                <span className="text-xs font-bold text-[#F7E7C1] block mt-2">
                  €{pack.priceEur.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Confirm Purchase CTA */}
        <button
          onClick={() => onTopup(selectedPack.id, paymentMethod)}
          className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">lock</span>
          Pagar €{selectedPack.priceEur.toFixed(2)} por {selectedPack.coins} Monedas ({paymentMethod === 'apple_pay' ? 'Apple Pay' : 'Stripe'})
        </button>
      </section>

      {/* Section Tarotistas: Solicitar Retiro de Ganancias & Factura VAT */}
      {currentUser.role === 'tarotista' && (
        <section className="mb-8 p-5 bg-[#1A1026] border border-[#D4AF37]/40 rounded-3xl">
          <h3 className="font-playfair text-base font-bold text-[#D4AF37] mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">account_balance</span>
            Solicitar Retiro de Ganancias Profesionales
          </h3>
          <p className="text-xs text-[#A7A7A7] mb-4">
            Umbral mínimo de retiro: <span className="text-[#D4AF37] font-bold">50.00 €</span>. Emisión automática de justificante fiscal / factura simplificada de servicios esotéricos.
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-[#A7A7A7] block mb-1">Importe a retirar (€)</label>
              <input
                type="number"
                value={withdrawEur}
                onChange={(e) => setWithdrawEur(Number(e.target.value))}
                min={50}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[#A7A7A7] block mb-1">NIF / CIF / VAT Number</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[#A7A7A7] block mb-1">Cuenta IBAN Bancaria</label>
              <input
                type="text"
                value={bankIban}
                onChange={(e) => setBankIban(e.target.value)}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
              />
            </div>
          </div>

          <button
            onClick={() => onRequestWithdrawal(withdrawEur, vatNumber, bankIban)}
            className="w-full bg-gradient-to-r from-[#5A2D82] to-[#2E1B47] border border-[#D4AF37] text-[#D4AF37] font-bold py-3 rounded-xl text-xs uppercase tracking-wider hover:brightness-110"
          >
            Solicitar Transferencia & Generar Factura
          </button>
        </section>
      )}

      {/* Append-Only Ledger Audit Trail */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-playfair text-base font-bold text-[#D4AF37] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            Libro Mayor Inmutable (Ledger)
          </h3>
          <span className="text-[9px] text-[#A7A7A7] uppercase">{filteredLedger.length} Transacciones</span>
        </div>

        {/* Ledger Category Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {(['all', 'topup', 'consultation', 'gift', 'withdrawal'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setLedgerFilter(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                ledgerFilter === cat
                  ? 'bg-[#D4AF37] text-[#0B0911]'
                  : 'bg-[#1A1026] text-[#A7A7A7] border border-[#D4AF37]/20 hover:text-[#F7E7C1]'
              }`}
            >
              {cat === 'all' ? 'Todas' : cat}
            </button>
          ))}
        </div>

        {/* Ledger Entries List */}
        <div className="space-y-2.5">
          {filteredLedger.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#A7A7A7] bg-[#1A1026] rounded-2xl border border-[#D4AF37]/10">
              No hay registros transaccionales en esta categoría.
            </div>
          ) : (
            filteredLedger.map((tx) => (
              <div key={tx.id} className="glass-card p-3 rounded-2xl border border-[#D4AF37]/20 flex justify-between items-center text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${tx.amountCoins > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    <span className="material-symbols-outlined text-lg">
                      {tx.amountCoins > 0 ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-[#F7E7C1] block leading-snug">{tx.description}</span>
                    <span className="text-[9px] text-[#A7A7A7]">{new Date(tx.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-playfair text-sm font-bold block ${tx.amountCoins > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amountCoins > 0 ? `+${tx.amountCoins}` : tx.amountCoins} Monedas
                  </span>
                  <span className="text-[10px] text-[#A7A7A7]">
                    (€{tx.amountEur.toFixed(2)})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
