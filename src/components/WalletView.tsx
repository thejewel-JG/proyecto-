import React, { useState, useEffect, useCallback } from 'react';
import { User, CoinPackage, LedgerTransaction, CoinOrder } from '../types';

interface WalletViewProps {
  currentUser: User;
  onOpenSpendingLimits: () => void;
  onBack?: () => void;
  onRefreshUser?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  onOpenSpendingLimits,
  onBack,
  onRefreshUser,
}) => {
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isInitiatingCheckout, setIsInitiatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Historial de movimientos (Ledger) con paginación
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'topup' | 'refund'>('all');
  const [ledgerPage, setLedgerPage] = useState(0);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const PAGE_SIZE = 10;

  // Estado del pedido al volver de Stripe Checkout
  const [activeOrder, setActiveOrder] = useState<CoinOrder | null>(null);
  const [isVerifyingOrder, setIsVerifyingOrder] = useState(false);

  // 1. Cargar catálogo oficial de paquetes de monedas del servidor
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch('/api/coins/packages');
        if (res.ok) {
          const data = await res.json();
          const pkgs: CoinPackage[] = data.packages || [];
          setPackages(pkgs);
          if (pkgs.length > 0) {
            const popular = pkgs.find(p => p.badge === 'Popular') || pkgs[0];
            setSelectedPackId(popular.id);
          }
        }
      } catch (err) {
        console.error('Error al cargar paquetes de monedas:', err);
      } finally {
        setIsLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  // 2. Cargar movimientos del libro mayor paginados
  const fetchLedger = useCallback(async (page: number) => {
    setIsLoadingLedger(true);
    try {
      const res = await fetch(`/api/wallet/ledger?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerTransactions(data.transactions || []);
        setLedgerTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error al cargar transacciones:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger(ledgerPage);
  }, [fetchLedger, ledgerPage]);

  // 3. Comprobar parámetros de retorno de Stripe Checkout (?order_id=...&session_id=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const sessionId = urlParams.get('session_id');

    if (orderId) {
      setIsVerifyingOrder(true);
      let pollCount = 0;
      const maxPolls = 15;

      const checkOrderStatus = async () => {
        try {
          const res = await fetch(`/api/coins/orders/${encodeURIComponent(orderId)}`);
          if (res.ok) {
            const data = await res.json();
            const order: CoinOrder = data.order;
            setActiveOrder(order);

            // Si ya está pagado o ha finalizado, detener polling y refrescar saldo
            if (order.status === 'paid' || order.status === 'failed' || order.status === 'cancelled' || order.status === 'expired') {
              setIsVerifyingOrder(false);
              if (order.status === 'paid' && onRefreshUser) {
                onRefreshUser();
                fetchLedger(0);
              }
              return true;
            }
          }
        } catch {
          // Silencioso
        }
        return false;
      };

      // Poll inicial y recurrente hasta que el webhook confirme
      checkOrderStatus().then((finished) => {
        if (finished) return;

        const interval = setInterval(async () => {
          pollCount++;
          const isDone = await checkOrderStatus();
          if (isDone || pollCount >= maxPolls) {
            clearInterval(interval);
            setIsVerifyingOrder(false);
          }
        }, 2000);
      });
    }
  }, [onRefreshUser, fetchLedger]);

  // 4. Iniciar compra en Stripe Checkout
  const handleInitiateCheckout = async () => {
    if (!selectedPackId) return;
    setIsInitiatingCheckout(true);
    setCheckoutError(null);

    const idempotencyKey = `idemp_chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch('/api/coins/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackId,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar la sesión de pago.');
      }

      if (data.checkoutUrl) {
        // Redirigir a la URL segura de Stripe Checkout
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Error de conexión con la pasarela.');
      setIsInitiatingCheckout(false);
    }
  };

  const selectedPack = packages.find(p => p.id === selectedPackId);

  // Filtrado en memoria de la página actual del libro mayor
  const displayedLedger = ledgerTransactions.filter(t => {
    if (ledgerFilter === 'all') return true;
    if (ledgerFilter === 'topup') return t.type === 'topup';
    if (ledgerFilter === 'refund') return t.type === 'refund';
    return true;
  });

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen p-4 pb-28 border-x border-[#D4AF37]/20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-[#A7A7A7] hover:text-[#F7E7C1] p-1.5 rounded-full hover:bg-[#2E1B47]/50">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div>
            <h2 className="font-playfair text-xl font-bold text-[#D4AF37] text-gold-glow">Monedero Astral</h2>
            <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider font-semibold">
              Libro Mayor & Recargas Seguras
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSpendingLimits}
          className="flex items-center gap-1 bg-[#2E1B47]/60 border border-[#D4AF37]/30 px-3 py-1.5 rounded-full text-[10px] font-bold text-[#D4AF37] hover:border-[#D4AF37] transition-all"
        >
          <span className="material-symbols-outlined text-xs">tune</span>
          <span>Límites de Gasto</span>
        </button>
      </div>

      {/* Banner de Modo de Pruebas / Sandbox */}
      <div className="mb-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-amber-400">science</span>
          <span>
            <strong>Modo de Pruebas (Stripe Testnet)</strong> — Sin cargos bancarios reales.
          </span>
        </div>
        <span className="text-[9px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
          Sandbox
        </span>
      </div>

      {/* Banner de Estado del Pedido Reciente si existe en la URL */}
      {activeOrder && (
        <div className={`mb-6 p-4 rounded-2xl border text-xs leading-relaxed ${
          activeOrder.status === 'paid'
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
            : activeOrder.status === 'pending'
            ? 'bg-blue-950/60 border-blue-500/50 text-blue-200'
            : 'bg-red-950/60 border-red-500/50 text-red-200'
        }`}>
          <div className="flex items-center justify-between font-bold text-sm mb-1">
            <span className="flex items-center gap-1.5">
              {activeOrder.status === 'paid' && <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>}
              {activeOrder.status === 'pending' && <span className="material-symbols-outlined text-blue-400 text-lg animate-spin">progress_activity</span>}
              {(activeOrder.status === 'cancelled' || activeOrder.status === 'failed' || activeOrder.status === 'expired') && (
                <span className="material-symbols-outlined text-red-400 text-lg">info</span>
              )}
              {activeOrder.status === 'paid' && '¡Pago Confirmado con Éxito!'}
              {activeOrder.status === 'pending' && 'Estamos confirmando tu pago con Stripe...'}
              {activeOrder.status === 'cancelled' && 'Compra Cancelada'}
              {activeOrder.status === 'failed' && 'El Pago no pudo Completarse'}
              {activeOrder.status === 'expired' && 'La Sesión de Compra ha Caducado'}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-mono opacity-80">
              #{activeOrder.orderNumber}
            </span>
          </div>

          <p className="mt-1 text-xs">
            {activeOrder.status === 'paid' && (
              <>Se han acreditado <strong>{activeOrder.coins} Monedas Astrales</strong> a tu saldo mediante verificación de webhook oficial.</>
            )}
            {activeOrder.status === 'pending' && (
              <>Esperando confirmación final del webhook de Stripe. El saldo se actualizará automáticamente tan pronto se complete la verificación.</>
            )}
            {activeOrder.status === 'cancelled' && (
              <>Has cerrado o cancelado la sesión en Checkout. No se ha realizado ningún cobro ni alteración de saldo.</>
            )}
            {activeOrder.status === 'failed' && (
              <>El cobro no pudo procesarse: {activeOrder.failureReason || 'Verifique su tarjeta o intente de nuevo.'}</>
            )}
            {activeOrder.status === 'expired' && (
              <>El tiempo de espera de 30 minutos expiró. La reserva de límite de gasto ha sido liberada.</>
            )}
          </p>
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-tr from-[#2E1B47] via-[#5A2D82] to-[#1A1026] border border-[#D4AF37]/50 rounded-3xl p-6 gold-glow shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-9xl text-[#D4AF37]">stars</span>
        </div>

        <span className="text-xs text-[#F7E7C1] uppercase tracking-widest font-semibold block mb-1">
          Saldo Disponible Total
        </span>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-playfair text-4xl md:text-5xl font-bold text-[#D4AF37]">
            {currentUser.coinsBalance}
          </span>
          <span className="text-sm font-bold text-[#F7E7C1]">Monedas Astrales</span>
          <span className="text-xs text-[#A7A7A7] ml-2">
            (~€{(currentUser.coinsBalance / 10).toFixed(2)})
          </span>
        </div>

        {/* Separación estricta de Monedas Compradas vs Ganancias Profesionales */}
        <div className="bg-[#0B0911]/40 border border-[#D4AF37]/20 rounded-xl p-3 mb-3 text-[11px] grid grid-cols-2 gap-2">
          <div>
            <span className="text-[#A7A7A7] block text-[10px] uppercase font-semibold">Monedas Compradas:</span>
            <span className="text-[#F7E7C1] font-bold">{currentUser.purchasedCoinsBalance || 0}</span>
            <span className="text-[9px] text-[#A7A7A7] block mt-0.5">(Uso interno en plataforma, no retirable)</span>
          </div>
          <div className="border-l border-[#D4AF37]/20 pl-3">
            <span className="text-[#A7A7A7] block text-[10px] uppercase font-semibold">Ganancias Tarotista:</span>
            <span className="text-[#D4AF37] font-bold">{currentUser.earningsCoinsBalance || 0}</span>
            <span className="text-[9px] text-[#A7A7A7] block mt-0.5">(Liquidables en fases posteriores)</span>
          </div>
        </div>

        {/* Spent indicators for self-regulation */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#D4AF37]/20 text-[11px] text-[#A7A7A7]">
          <div>
            Gasto Hoy: <span className="text-[#F7E7C1] font-bold">€{currentUser.spentToday.toFixed(2)}</span>
            {currentUser.spendingLimitDaily && ` / €${currentUser.spendingLimitDaily.toFixed(2)}`}
          </div>
          <div>
            Gasto Semanal: <span className="text-[#F7E7C1] font-bold">€{currentUser.spentThisWeek.toFixed(2)}</span>
            {currentUser.spendingLimitWeekly && ` / €${currentUser.spendingLimitWeekly.toFixed(2)}`}
          </div>
        </div>
      </div>

      {/* Recargas de Monedas Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-playfair text-base font-bold text-[#D4AF37] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            Recargar Monedas Astrales (Stripe Checkout)
          </h3>
          <span className="text-[10px] text-[#A09BAE]">Precios fijados por el servidor</span>
        </div>

        {/* Packages Grid */}
        {isLoadingPackages ? (
          <div className="flex justify-center py-8">
            <span className="animate-spin material-symbols-outlined text-2xl text-[#D4AF37]">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {packages.map((pack) => {
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
                    <span className="absolute -top-2.5 right-3 bg-[#D4AF37] text-[#0B0911] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_6px_#D4AF37]">
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
        )}

        {/* Mensaje de error al iniciar checkout */}
        {checkoutError && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
            {checkoutError}
          </div>
        )}

        {/* Confirm Purchase CTA */}
        {selectedPack && (
          <button
            onClick={handleInitiateCheckout}
            disabled={isInitiatingCheckout}
            className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isInitiatingCheckout ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Conectando con Stripe Checkout...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>
                  Comprar con Stripe Checkout • €{selectedPack.priceEur.toFixed(2)} por {selectedPack.coins} Monedas
                </span>
              </>
            )}
          </button>
        )}

        <p className="text-center text-[10px] text-[#A09BAE] mt-2">
          Stripe Checkout presentará los métodos disponibles para tu dispositivo (Tarjeta, Google Pay, Apple Pay, etc.).
        </p>
      </section>

      {/* Retiradas a Cuentas Bancarias (Deshabilitadas en Fase de Pruebas) */}
      {currentUser.role === 'tarotista' && (
        <section className="mb-8 p-5 bg-[#1A1026] border border-[#D4AF37]/20 rounded-3xl opacity-80">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg text-[#D4AF37]">account_balance</span>
            <h3 className="font-playfair text-base font-bold text-[#D4AF37]">
              Retiros a Cuenta Bancaria (En Desarrollo)
            </h3>
          </div>
          <p className="text-xs text-[#A7A7A7] leading-relaxed">
            Las retiradas directas a cuentas bancarias están deshabilitadas en esta fase de pruebas contables. Los saldos de ganancias se liquidarán una vez verificados los contratos y pasarelas de cobro correspondientes.
          </p>
        </section>
      )}

      {/* Historial de Movimientos Auditable (Libro Mayor / Ledger) */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-playfair text-base font-bold text-[#D4AF37] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">history</span>
            Libro Mayor de Movimientos
          </h3>

          <div className="flex gap-1">
            {(['all', 'topup', 'refund'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setLedgerFilter(filter)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                  ledgerFilter === filter
                    ? 'bg-[#D4AF37] text-[#0B0911]'
                    : 'bg-[#1A1026] text-[#A7A7A7] hover:text-[#F7E7C1]'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter === 'topup' ? 'Recargas' : 'Reembolsos'}
              </button>
            ))}
          </div>
        </div>

        {isLoadingLedger ? (
          <div className="flex justify-center py-6">
            <span className="animate-spin material-symbols-outlined text-xl text-[#D4AF37]">progress_activity</span>
          </div>
        ) : displayedLedger.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#1A1026] border border-[#D4AF37]/20 text-center text-xs text-[#A09BAE]">
            No hay movimientos registrados en el libro mayor.
          </div>
        ) : (
          <div className="space-y-2">
            {displayedLedger.map((tx) => {
              const isPositive = tx.amountCoins > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-2xl bg-[#1A1026] border border-[#D4AF37]/20 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isPositive ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-red-950/60 text-red-400 border border-red-500/30'
                    }`}>
                      <span className="material-symbols-outlined text-base">
                        {isPositive ? 'arrow_downward' : 'arrow_upward'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#F7E7C1] block">{tx.description}</span>
                      <span className="text-[10px] text-[#A09BAE]">
                        {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-bold font-playfair text-sm block ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? `+${tx.amountCoins}` : tx.amountCoins}
                    </span>
                    {tx.balanceAfter !== undefined && (
                      <span className="text-[10px] text-[#A09BAE]">
                        Saldo: {tx.balanceAfter}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Paginación del Libro Mayor */}
            {ledgerTotal > PAGE_SIZE && (
              <div className="flex justify-between items-center pt-3 text-xs text-[#A09BAE]">
                <button
                  onClick={() => setLedgerPage(p => Math.max(0, p - 1))}
                  disabled={ledgerPage === 0}
                  className="px-3 py-1.5 rounded-full bg-[#1A1026] border border-[#D4AF37]/20 disabled:opacity-40"
                >
                  Anteriores
                </button>
                <span>
                  Página {ledgerPage + 1} de {Math.ceil(ledgerTotal / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setLedgerPage(p => p + 1)}
                  disabled={(ledgerPage + 1) * PAGE_SIZE >= ledgerTotal}
                  className="px-3 py-1.5 rounded-full bg-[#1A1026] border border-[#D4AF37]/20 disabled:opacity-40"
                >
                  Siguientes
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
