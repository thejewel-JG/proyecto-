import React, { useState } from 'react';
import { Category, User } from '../types';

interface NavbarProps {
  activeCategory: Category;
  onSelectCategory: (cat: Category) => void;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onOpenWallet: () => void;
  onOpenSearch: () => void;
  onOpenAdmin: () => void;
  onOpenCreatePost?: () => void;
  onOpenMessages?: () => void;
  onOpenAstraAi?: () => void;
  onOpenNotifications?: () => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  themeMode?: 'night' | 'day';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeCategory,
  onSelectCategory,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenWallet,
  onOpenSearch,
  onOpenAdmin,
  onOpenCreatePost,
  onOpenMessages,
  onOpenAstraAi,
  onOpenNotifications,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  themeMode = 'night',
  onToggleTheme,
}) => {
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0911]/90 backdrop-blur-xl border-b border-white/5 px-3 sm:px-4 h-14 flex items-center justify-center">
        <div className="w-full max-w-5xl flex justify-between items-center">
          {/* Left: Menu Hamburguesa + Botón Crear '+' estilo Instagram */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowDrawerMenu(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#F7E7C1] hover:text-[#E5B54F] transition-colors"
              title="Menú KABALY"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            {onOpenCreatePost && (
              <button
                onClick={() => {
                  if (!currentUser) {
                    onOpenAuthModal();
                    return;
                  }
                  onOpenCreatePost();
                }}
                className="w-8 h-8 rounded-full bg-[#1C102E] border border-[#E5B54F]/30 flex items-center justify-center text-[#E5B54F] hover:bg-[#E5B54F] hover:text-[#0B0911] transition-all"
                title="Publicar Reel o Post"
              >
                <span className="material-symbols-outlined text-lg">add_box</span>
              </button>
            )}
          </div>

          {/* Center: Brand Wordmark (KABALY en dorado Cinzel) */}
          <div
            onClick={() => onSelectCategory('Para ti')}
            className="flex items-center gap-1.5 cursor-pointer group"
          >
            <span className="text-[#E5B54F] text-sm group-hover:rotate-45 transition-transform">✦</span>
            <h1 className="font-cinzel text-lg sm:text-xl font-bold tracking-[0.25em] text-[#F7E7C1] group-hover:text-[#E5B54F] transition-colors uppercase">
              KABALY
            </h1>
          </div>

          {/* Right: Theme Day/Night + Search + Activity Bell + DM Paper Plane + User Avatar */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Day / Night Mode Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-8 h-8 rounded-full bg-[#1C102E] border border-[#E5B54F]/35 flex items-center justify-center text-[#E5B54F] hover:bg-[#E5B54F] hover:text-[#0B0911] transition-all"
                title={themeMode === 'day' ? 'Cambiar a Modo Noche' : 'Cambiar a Modo Día'}
              >
                <span className="material-symbols-outlined text-lg">
                  {themeMode === 'day' ? 'dark_mode' : 'light_mode'}
                </span>
              </button>
            )}

            {/* Search Icon */}
            <button
              onClick={onOpenSearch}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F7E7C1] hover:text-[#E5B54F] transition-colors"
              title="Buscar en el cosmos"
            >
              <span className="material-symbols-outlined text-xl">search</span>
            </button>

            {/* Activity / Notifications (Heart/Bell style Instagram) */}
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuthModal();
                  return;
                }
                onOpenNotifications?.();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F7E7C1] hover:text-[#E5B54F] transition-colors relative"
              title="Actividad y Notificaciones"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]" />
              )}
            </button>

            {/* Direct Messages Icon (Instagram DM style) */}
            {onOpenMessages && (
              <button
                onClick={() => {
                  if (!currentUser) {
                    onOpenAuthModal();
                    return;
                  }
                  onOpenMessages();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#F7E7C1] hover:text-[#E5B54F] transition-colors relative"
                title="Mensajes Directos"
              >
                <span className="material-symbols-outlined text-xl -rotate-12">send</span>
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#E5B54F] text-[#0B0911] text-[9px] font-extrabold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </button>
            )}

            {/* User Avatar with Gold Ring & Coin Pill or Login Button */}
            {currentUser ? (
              <button
                onClick={onOpenWallet}
                className="flex items-center gap-1.5 bg-[#160B24] border border-[#E5B54F]/35 hover:border-[#E5B54F] rounded-full pl-2 pr-1 py-0.5 transition-all"
                title={`Monedero de ${currentUser.name} (${currentUser.coinsBalance} Monedas)`}
              >
                <span className="text-[10px] font-bold text-[#E5B54F] hidden sm:inline">
                  {currentUser.coinsBalance} 🪙
                </span>
                <div className="w-7 h-7 rounded-full story-ring p-[1.5px]">
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                    alt={currentUser.name}
                    className="w-full h-full object-cover rounded-full bg-[#1A1026]"
                  />
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="gold-gradient-btn px-3 py-1 rounded-full text-xs font-bold"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Side Drawer Menu */}
      {showDrawerMenu && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex">
          <div className="w-72 max-w-[85vw] bg-[#120B1D] border-r border-[#E5B54F]/25 h-full p-5 flex flex-col justify-between animate-fade-in shadow-2xl">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-[#E5B54F] text-base">✦</span>
                  <span className="font-cinzel text-base font-bold text-[#F7E7C1] tracking-widest">KABALY</span>
                </div>
                <button
                  onClick={() => setShowDrawerMenu(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[#A09BAE] hover:text-white"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                <button
                  onClick={() => { onSelectCategory('Para ti'); setShowDrawerMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F7E7C1] hover:bg-[#E5B54F]/10 hover:text-[#E5B54F] transition-colors"
                >
                  <span className="material-symbols-outlined text-lg text-[#E5B54F]">home</span>
                  <span>Inicio</span>
                </button>

                <button
                  onClick={() => { onOpenSearch(); setShowDrawerMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F7E7C1] hover:bg-[#E5B54F]/10 hover:text-[#E5B54F] transition-colors"
                >
                  <span className="material-symbols-outlined text-lg text-[#E5B54F]">explore</span>
                  <span>Explorar Oráculos</span>
                </button>

                <button
                  onClick={() => { onOpenAstraAi?.(); setShowDrawerMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F7E7C1] hover:bg-[#E5B54F]/10 hover:text-[#E5B54F] transition-colors"
                >
                  <span className="material-symbols-outlined text-lg text-[#E5B54F]">auto_awesome</span>
                  <span>Astra AI (Oráculo Inteligente)</span>
                </button>

                <button
                  onClick={() => { onOpenWallet(); setShowDrawerMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F7E7C1] hover:bg-[#E5B54F]/10 hover:text-[#E5B54F] transition-colors"
                >
                  <span className="material-symbols-outlined text-lg text-[#E5B54F]">account_balance_wallet</span>
                  <span>Billetera Astral & Monedas</span>
                </button>

                {onToggleTheme && (
                  <button
                    onClick={() => { onToggleTheme(); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F7E7C1] hover:bg-[#E5B54F]/10 hover:text-[#E5B54F] transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-lg text-[#E5B54F]">
                        {themeMode === 'day' ? 'dark_mode' : 'light_mode'}
                      </span>
                      <span>{themeMode === 'day' ? 'Activar Modo Noche' : 'Activar Modo Día'}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5B54F]/20 text-[#E5B54F] font-bold">
                      {themeMode === 'day' ? '☀️ Día' : '🌙 Noche'}
                    </span>
                  </button>
                )}

                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => { onOpenAdmin(); setShowDrawerMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#E5B54F] bg-[#E5B54F]/10 hover:bg-[#E5B54F]/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                    <span>Panel de Control KABALY</span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-white/10">
              {currentUser ? (
                <button
                  onClick={() => { onLogout(); setShowDrawerMenu(false); }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/40 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>Cerrar sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => { onOpenAuthModal(); setShowDrawerMenu(false); }}
                  className="gold-gradient-btn w-full py-2.5 rounded-xl text-xs font-bold"
                >
                  Entrar a KABALY
                </button>
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowDrawerMenu(false)} />
        </div>
      )}
    </>
  );
};
