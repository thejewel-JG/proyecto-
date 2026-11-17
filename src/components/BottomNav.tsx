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
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0B0911]/95 backdrop-blur-2xl border-t border-[#E5B54F]/20 px-2 sm:px-6 flex justify-around items-center max-w-5xl mx-auto shadow-[0_-8px_30px_rgba(0,0,0,0.85)]">
      {/* 1. Inicio (Feed & Reels) */}
      <button
        onClick={() => onSelectTab('feed')}
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-all relative ${
          activeTab === 'feed'
            ? 'text-[#E5B54F] scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Inicio y Reels"
      >
        <MysticEyeIcon className="w-5 h-5" filled={activeTab === 'feed'} />
        <span className="text-[10px] font-semibold tracking-tight">Inicio</span>
      </button>

      {/* 2. Explorar / Descubrir (Instagram Search & TikTok Discover) */}
      <button
        onClick={() => onSelectTab('explore')}
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-all relative ${
          activeTab === 'explore'
            ? 'text-[#E5B54F] scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Explorar Cosmos"
      >
        <AstralCompassIcon className="w-5 h-5" filled={activeTab === 'explore'} />
        <span className="text-[10px] font-semibold tracking-tight">Explorar</span>
      </button>

      {/* 3. Botón Central '+' Estilo TikTok (Doble Aura Púrpura + Oro Sagrado) */}
      <button
        onClick={() => {
          if (onOpenCreatePost) {
            onOpenCreatePost();
          } else {
            onSelectTab('astra_ai');
          }
        }}
        className="relative group flex items-center justify-center mx-1 hover:scale-105 active:scale-95 transition-transform"
        title="Crear Reel, Publicación o Historia"
      >
        {/* TikTok-style offset dual aura layers in Kabaly colors */}
        <span className="absolute -left-1 w-11 h-8 rounded-xl bg-[#9D4EDD] opacity-90 group-hover:opacity-100 transition-opacity" />
        <span className="absolute -right-1 w-11 h-8 rounded-xl bg-[#E5B54F] opacity-95 group-hover:opacity-100 transition-opacity" />
        <div className="relative w-11 h-8 rounded-xl bg-gradient-to-b from-[#1E1035] to-[#0B0911] border border-[#F7E7C1]/40 text-[#F7E7C1] flex items-center justify-center shadow-[0_0_15px_rgba(229,181,79,0.4)]">
          <span className="material-symbols-outlined text-xl font-bold text-[#E5B54F]">add</span>
        </div>
      </button>

      {/* 4. Directos LIVE (TikTok LIVE) */}
      <button
        onClick={() => onSelectTab('live')}
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-all relative ${
          activeTab === 'live'
            ? 'text-[#E5B54F] scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Directos LIVE"
      >
        <div className="relative">
          <RitualLiveIcon className="w-5 h-5" filled={activeTab === 'live'} />
          {hasActiveLiveStream && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[7px] font-extrabold px-1 rounded-sm tracking-wider animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Directos</span>
      </button>

      {/* 5. Bandeja de Mensajes (Instagram DM / TikTok Inbox) */}
      <button
        onClick={() => onSelectTab('messages')}
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-all relative ${
          activeTab === 'messages'
            ? 'text-[#E5B54F] scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Mensajes Directos"
      >
        <div className="relative">
          <TwinMoonsIcon className="w-5 h-5" filled={activeTab === 'messages'} />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#E5B54F] text-[#0B0911] text-[9px] font-extrabold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-[0_0_8px_#E5B54F]">
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Mensajes</span>
      </button>

      {/* 6. Perfil (Instagram / TikTok Profile Avatar Ring) */}
      <button
        onClick={() => onSelectTab('profile')}
        className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 transition-all relative ${
          activeTab === 'profile'
            ? 'text-[#E5B54F] scale-105'
            : 'text-[#F7E7C1]/55 hover:text-[#F7E7C1]'
        }`}
        title="Mi Perfil"
      >
        {currentUserAvatar ? (
          <div
            className={`w-5 h-5 rounded-full overflow-hidden p-[1.5px] ${
              activeTab === 'profile' ? 'story-ring shadow-[0_0_8px_#E5B54F]' : 'border border-[#F7E7C1]/40'
            }`}
          >
            <img src={currentUserAvatar} alt="Perfil" className="w-full h-full rounded-full object-cover" />
          </div>
        ) : (
          <LunarCrownAltarIcon className="w-5 h-5" filled={activeTab === 'profile'} />
        )}
        <span className="text-[10px] font-semibold tracking-tight">Perfil</span>
      </button>
    </nav>
  );
};
