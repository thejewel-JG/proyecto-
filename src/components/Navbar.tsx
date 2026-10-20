import React from 'react';
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
        {/* Left Side: Authenticated User Info or Access CTA */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2E1B47]/60 border border-[#D4AF37]/30 text-xs text-[#F7E7C1]">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-full object-cover border border-[#D4AF37]"
                />
                <span className="font-bold max-w-[90px] truncate hidden sm:inline">{currentUser.name}</span>
                <span className="text-[9px] uppercase font-bold text-[#D4AF37] bg-[#5A2D82]/80 px-1.5 py-0.5 rounded-full">
                  {currentUser.role}
                </span>
              </div>

              {currentUser.role === 'admin' && (
                <button
                  onClick={onOpenAdmin}
                  className="px-2.5 py-1 rounded-full bg-[#D4AF37] text-[#0B0911] font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1"
                  title="Panel de Administración"
                >
                  <span className="material-symbols-outlined text-xs">dashboard</span>
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="p-1.5 rounded-full hover:bg-red-950/60 text-red-300/80 hover:text-red-200 transition-colors"
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-base">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#2E1B47] to-[#5A2D82] border border-[#D4AF37] text-xs font-bold text-[#D4AF37] hover:scale-105 transition-all gold-glow"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Acceder</span>
            </button>
          )}
        </div>

        {/* Center: Brand Logo */}
        <div className="flex flex-col items-center cursor-pointer">
          <h1 className="font-cinzel text-xl md:text-2xl font-bold tracking-[0.25em] text-[#F7E7C1] text-gold-glow uppercase leading-none">
            KABALY
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

          {currentUser ? (
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#2E1B47] to-[#5A2D82] border border-[#D4AF37]/40 px-3 py-1 rounded-full text-xs font-bold text-[#D4AF37] hover:scale-105 transition-all gold-glow"
              title="Ver Monedero"
            >
              <span className="material-symbols-outlined text-sm filled text-[#D4AF37]">toll</span>
              <span>{currentUser.coinsBalance}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
            >
              <span>+ Info</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Categories Filter */}
      <div className="w-full max-w-5xl overflow-x-auto no-scrollbar py-2">
        <div className="flex items-center gap-2 min-w-max px-2">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#D4AF37] text-[#0B0911] shadow-[0_0_12px_rgba(212,175,55,0.4)] font-bold'
                    : 'bg-[#1A1026] text-[#A7A7A7] hover:text-[#F7E7C1] border border-[#D4AF37]/20 hover:border-[#D4AF37]/50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
