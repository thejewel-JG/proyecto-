import React, { useState, useRef, useEffect } from 'react';
import { Category, User } from '../types';
import { AlchemicalSunIcon, AstralCompassIcon, SolomonStarIcon } from './EsotericIcons';

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
  unreadMessagesCount?: number;
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
  onOpenAstraAi,
}) => {
  const [showOraclesMenu, setShowOraclesMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const specialtyCategories: Category[] = [
    'Tarot',
    'Astrología',
    'Horóscopo',
    'Runas',
    'Péndulo',
    'Numerología',
    'Reiki',
    'Lunas',
    'Rituales',
  ];

  const isSpecialtySelected = specialtyCategories.includes(activeCategory);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOraclesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0911]/80 backdrop-blur-xl border-b border-white/5 px-3 sm:px-5 h-14 flex items-center justify-center">
      <div className="w-full max-w-5xl flex justify-between items-center gap-2">
        {/* Left: Minimal Brand Wordmark (Instagram style) */}
        <div
          onClick={() => onSelectCategory('Para ti')}
          className="flex items-center gap-1.5 cursor-pointer group shrink-0"
        >
          <span className="text-[#D4AF37] text-xs group-hover:rotate-45 transition-transform">✦</span>
          <h1 className="font-cinzel text-base sm:text-lg font-bold tracking-[0.22em] text-[#F7E7C1] group-hover:text-[#D4AF37] transition-colors uppercase">
            KABALY
          </h1>
        </div>

        {/* Center: Clean TikTok-style Feed Switcher (Siguiendo | Para ti | Oráculos ▾) */}
        <div className="flex items-center gap-3 sm:gap-6 relative" ref={menuRef}>
          <button
            onClick={() => onSelectCategory('Siguiendo')}
            className={`relative py-1 text-xs sm:text-sm transition-all ${
              activeCategory === 'Siguiendo'
                ? 'font-bold text-[#F7E7C1]'
                : 'font-medium text-[#F7E7C1]/55 hover:text-[#F7E7C1]/90'
            }`}
          >
            Siguiendo
            {activeCategory === 'Siguiendo' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_8px_#D4AF37]" />
            )}
          </button>

          <button
            onClick={() => onSelectCategory('Para ti')}
            className={`relative py-1 text-xs sm:text-sm transition-all ${
              activeCategory === 'Para ti'
                ? 'font-bold text-[#F7E7C1]'
                : 'font-medium text-[#F7E7C1]/55 hover:text-[#F7E7C1]/90'
            }`}
          >
            Para ti
            {activeCategory === 'Para ti' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_8px_#D4AF37]" />
            )}
          </button>

          {/* Compact Dropdown for the 9 Esoteric Specialties */}
          <div className="relative">
            <button
              onClick={() => setShowOraclesMenu(prev => !prev)}
              className={`relative py-1 text-xs sm:text-sm flex items-center gap-1 transition-all ${
                isSpecialtySelected
                  ? 'font-bold text-[#D4AF37]'
                  : 'font-medium text-[#F7E7C1]/55 hover:text-[#F7E7C1]/90'
              }`}
            >
              <span>{isSpecialtySelected ? activeCategory : 'Oráculos'}</span>
              <span className="text-[10px] opacity-80">▾</span>
              {isSpecialtySelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_8px_#D4AF37]" />
              )}
            </button>

            {showOraclesMenu && (
              <div className="absolute top-9 left-1/2 -translate-x-1/2 w-48 bg-[#120D1D]/95 backdrop-blur-2xl border border-[#D4AF37]/30 rounded-2xl p-2 shadow-2xl grid grid-cols-1 gap-0.5 z-50">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/70 border-b border-white/5 mb-1">
                  Artes Esotéricas
                </div>
                {specialtyCategories.map((cat) => {
                  const selected = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        onSelectCategory(cat);
                        setShowOraclesMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        selected
                          ? 'bg-[#D4AF37] text-[#0B0911] font-bold'
                          : 'text-[#F7E7C1]/80 hover:bg-[#2E1B47]/60 hover:text-[#D4AF37]'
                      }`}
                    >
                      <span>{cat}</span>
                      {selected && <span>✦</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Minimal Esoteric Actions (Coins, AI Oracle, Search, Auth) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenAstraAi && (
            <button
              onClick={onOpenAstraAi}
              className="w-8 h-8 rounded-full bg-[#1A1026]/80 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] hover:border-[#D4AF37] hover:scale-105 transition-all"
              title="Oráculo Kabaly IA"
            >
              <SolomonStarIcon className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#2E1B47]/70 flex items-center justify-center text-[#F7E7C1] hover:text-[#D4AF37] transition-colors"
            title="Explorar tarotistas o artes"
          >
            <AstralCompassIcon className="w-4 h-4" />
          </button>

          {currentUser ? (
            <>
              <button
                onClick={onOpenWallet}
                className="flex items-center gap-1 bg-[#1A1026] border border-[#D4AF37]/35 px-2.5 py-1 rounded-full text-xs font-bold text-[#D4AF37] hover:border-[#D4AF37] transition-all"
                title="Tu Altar y Monedero"
              >
                <AlchemicalSunIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{currentUser.coinsBalance}</span>
              </button>

              {currentUser.role === 'admin' && (
                <button
                  onClick={onOpenAdmin}
                  className="px-2 py-1 rounded-full bg-[#D4AF37] text-[#0B0911] font-bold text-[10px] uppercase tracking-wider hover:brightness-110 transition-all"
                  title="Panel de Administración"
                >
                  Admin
                </button>
              )}

              <button
                onClick={onLogout}
                className="w-7 h-7 rounded-full hover:bg-red-950/50 text-[#F7E7C1]/50 hover:text-red-300 flex items-center justify-center transition-colors"
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] text-xs font-bold hover:scale-105 transition-all shadow-[0_0_12px_rgba(212,175,55,0.3)]"
            >
              <span>✦</span>
              <span>Iniciar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
