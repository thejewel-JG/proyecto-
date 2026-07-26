import React from 'react';
import { Category, User } from '../types';

interface NavbarProps {
  activeCategory: Category;
  onSelectCategory: (cat: Category) => void;
  currentUser: User;
  onSwitchUserRole: (role: 'cliente' | 'tarotista' | 'admin') => void;
  onOpenWallet: () => void;
  onOpenSearch: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeCategory,
  onSelectCategory,
  currentUser,
  onSwitchUserRole,
  onOpenWallet,
  onOpenSearch,
  onOpenAdmin,
}) => {
  const categories: Category[] = [
    'Para ti',
    'Siguiendo',
    'Tarot',
    'Astrología',
    'Horóscopo',
    'Runas',
    'Péndulo',
    'Numerología',
    'Reiki',
    'Lunas',
    'Rituales'
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0911]/85 backdrop-blur-xl border-b border-[#D4AF37]/20 px-4 py-2 flex flex-col items-center">
      <div className="w-full max-w-5xl flex justify-between items-center gap-2">
        {/* Left Side: Role switcher & Admin shortcut */}
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2E1B47]/60 border border-[#D4AF37]/30 text-xs text-[#F7E7C1] font-bold uppercase tracking-wider hover:border-[#D4AF37] transition-all">
              <span className="material-symbols-outlined text-sm text-[#D4AF37]">
                {currentUser.role === 'admin' ? 'admin_panel_settings' : currentUser.role === 'tarotista' ? 'auto_awesome' : 'person'}
              </span>
              <span>{currentUser.role}</span>
              <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-44 bg-[#1A1026] border border-[#D4AF37]/30 rounded-xl shadow-2xl p-1 hidden group-hover:block z-50">
              <div className="text-[10px] text-[#A7A7A7] px-3 py-1 font-semibold uppercase tracking-wider">Cambiar Perfil</div>
              <button
                onClick={() => onSwitchUserRole('cliente')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                  currentUser.role === 'cliente' ? 'bg-[#5A2D82] text-[#D4AF37] font-bold' : 'text-[#F7E7C1] hover:bg-[#2E1B47]'
                }`}
              >
                <span>Cliente</span>
                {currentUser.role === 'cliente' && <span className="material-symbols-outlined text-xs">check</span>}
              </button>
              <button
                onClick={() => onSwitchUserRole('tarotista')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                  currentUser.role === 'tarotista' ? 'bg-[#5A2D82] text-[#D4AF37] font-bold' : 'text-[#F7E7C1] hover:bg-[#2E1B47]'
                }`}
              >
                <span>Tarotista</span>
                {currentUser.role === 'tarotista' && <span className="material-symbols-outlined text-xs">check</span>}
              </button>
              <button
                onClick={() => onSwitchUserRole('admin')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                  currentUser.role === 'admin' ? 'bg-[#5A2D82] text-[#D4AF37] font-bold' : 'text-[#F7E7C1] hover:bg-[#2E1B47]'
                }`}
              >
                <span>Panel Admin</span>
                {currentUser.role === 'admin' && <span className="material-symbols-outlined text-xs">check</span>}
              </button>
            </div>
          </div>

          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              className="px-2.5 py-1 rounded-full bg-[#D4AF37] text-[#0B0911] font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">dashboard</span>
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
        </div>

        {/* Center: Brand Logo */}
        <div className="flex flex-col items-center cursor-pointer">
          <h1 className="font-cinzel text-xl md:text-2xl font-bold tracking-[0.25em] text-[#F7E7C1] text-gold-glow uppercase leading-none">
            ASTRALIS
          </h1>
          <span className="text-[9px] font-manrope text-[#D4AF37] tracking-[0.3em] uppercase opacity-90 mt-0.5">
            TU DESTINO • TU MAGIA
          </span>
        </div>

        {/* Right Side: Wallet Coins & Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="p-1.5 rounded-full hover:bg-[#2E1B47] text-[#F7E7C1] transition-colors"
            title="Buscar tarotistas o temas"
          >
            <span className="material-symbols-outlined text-xl">search</span>
          </button>

          <button
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#2E1B47] to-[#5A2D82] border border-[#D4AF37]/40 px-3 py-1 rounded-full text-xs font-bold text-[#D4AF37] hover:scale-105 transition-all gold-glow"
          >
            <span className="material-symbols-outlined text-sm filled text-[#D4AF37]">stars</span>
            <span>{currentUser.coinsBalance}</span>
            <span className="material-symbols-outlined text-xs text-[#F7E7C1]">add_circle</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Category scrollable tabs */}
      <nav className="w-full max-w-5xl overflow-x-auto no-scrollbar flex items-center gap-5 mt-2 pb-1 justify-start md:justify-center">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`whitespace-nowrap text-xs font-semibold tracking-wider transition-all relative pb-1 ${
                isActive
                  ? 'text-[#D4AF37] font-bold'
                  : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
              }`}
            >
              {cat}
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#D4AF37] rounded-full shadow-[0_0_8px_#D4AF37]" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
