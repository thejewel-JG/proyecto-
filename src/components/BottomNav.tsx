import React from 'react';
import {
  MysticEyeIcon,
  AstralCompassIcon,
  RitualLiveIcon,
  SolomonStarIcon,
  TwinMoonsIcon,
  LunarCrownAltarIcon,
} from './EsotericIcons';

export type MainTab = 'feed' | 'explore' | 'live' | 'messages' | 'astra_ai' | 'profile';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasActiveLiveStream?: boolean;
  unreadMessagesCount?: number;
  onOpenCreatePost?: () => void;
  currentUserAvatar?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  hasActiveLiveStream = true,
  unreadMessagesCount = 0,
  onOpenCreatePost,
  currentUserAvatar,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#0B0911]/95 backdrop-blur-2xl border-t border-white/10 px-4 flex justify-around items-center max-w-5xl mx-auto">
      {/* 1. Visiones (Feed) — Ojo Místico */}
      <button
        onClick={() => onSelectTab('feed')}
        className={`flex flex-col items-center justify-center p-2 transition-all relative ${
          activeTab === 'feed'
            ? 'text-[#D4AF37] esoteric-glow scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Visiones (Feed)"
      >
        <MysticEyeIcon className="w-6 h-6" filled={activeTab === 'feed'} />
        {activeTab === 'feed' && (
          <span className="absolute bottom-0.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
        )}
      </button>

      {/* 2. Explorar Videntes — Rosa Astral */}
      <button
        onClick={() => onSelectTab('explore')}
        className={`flex flex-col items-center justify-center p-2 transition-all relative ${
          activeTab === 'explore'
            ? 'text-[#D4AF37] esoteric-glow scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Explorar Videntes"
      >
        <AstralCompassIcon className="w-6 h-6" filled={activeTab === 'explore'} />
        {activeTab === 'explore' && (
          <span className="absolute bottom-0.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
        )}
      </button>

      {/* 3. Botón Central Esotérico: Estrella Alquímica (Publicar / Canalizar) */}
      <button
        onClick={() => {
          if (onOpenCreatePost) {
            onOpenCreatePost();
          } else {
            onSelectTab('astra_ai');
          }
        }}
        className="w-11 h-8 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F7E7C1] to-[#D4AF37] text-[#0B0911] flex items-center justify-center shadow-[0_0_16px_rgba(212,175,55,0.45)] hover:scale-105 active:scale-95 transition-transform"
        title="Canalizar / Publicar Visión"
      >
        <SolomonStarIcon className="w-5 h-5" />
      </button>

      {/* 4. Rituales en Directo — Péndulo Radiante */}
      <button
        onClick={() => onSelectTab('live')}
        className={`flex flex-col items-center justify-center p-2 transition-all relative ${
          activeTab === 'live'
            ? 'text-[#D4AF37] esoteric-glow scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Rituales en Directo"
      >
        <div className="relative">
          <RitualLiveIcon className="w-6 h-6" filled={activeTab === 'live'} />
          {hasActiveLiveStream && (
            <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
            </span>
          )}
        </div>
        {activeTab === 'live' && (
          <span className="absolute bottom-0.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
        )}
      </button>

      {/* 5. Cámara Secreta (Mensajes) — Lunas Entrelazadas */}
      <button
        onClick={() => onSelectTab('messages')}
        className={`flex flex-col items-center justify-center p-2 transition-all relative ${
          activeTab === 'messages'
            ? 'text-[#D4AF37] esoteric-glow scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Susurros Privados (Mensajes)"
      >
        <div className="relative">
          <TwinMoonsIcon className="w-6 h-6" filled={activeTab === 'messages'} />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#D4AF37] text-[#0B0911] text-[9px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-[0_0_8px_#D4AF37]">
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </span>
          )}
        </div>
        {activeTab === 'messages' && (
          <span className="absolute bottom-0.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
        )}
      </button>

      {/* 6. Tu Altar (Perfil y Monedero) — Corona Lunar o Avatar con Aro Místico */}
      <button
        onClick={() => onSelectTab('profile')}
        className={`flex flex-col items-center justify-center p-2 transition-all relative ${
          activeTab === 'profile'
            ? 'text-[#D4AF37] esoteric-glow scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Tu Altar (Perfil y Monedero)"
      >
        {currentUserAvatar ? (
          <div
            className={`w-6 h-6 rounded-full overflow-hidden p-[1.5px] ${
              activeTab === 'profile' ? 'story-ring shadow-[0_0_8px_#D4AF37]' : 'border border-[#F7E7C1]/40'
            }`}
          >
            <img src={currentUserAvatar} alt="Perfil" className="w-full h-full rounded-full object-cover" />
          </div>
        ) : (
          <LunarCrownAltarIcon className="w-6 h-6" filled={activeTab === 'profile'} />
        )}
        {activeTab === 'profile' && (
          <span className="absolute bottom-0.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
        )}
      </button>
    </nav>
  );
};
