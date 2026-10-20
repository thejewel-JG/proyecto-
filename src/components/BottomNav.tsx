import React from 'react';

export type MainTab = 'feed' | 'explore' | 'live' | 'astra_ai' | 'profile';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasActiveLiveStream?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  hasActiveLiveStream = true,
}) => {
  const tabs: { id: MainTab; label: string; icon: string; badge?: boolean }[] = [
    { id: 'feed', label: 'Feed', icon: 'home' },
    { id: 'explore', label: 'Explorar', icon: 'explore' },
    { id: 'live', label: 'Directos', icon: 'live_tv', badge: hasActiveLiveStream },
    { id: 'astra_ai', label: 'Kabaly AI', icon: 'auto_awesome' },
    { id: 'profile', label: 'Perfil', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0911]/90 backdrop-blur-2xl border-t border-[#D4AF37]/20 px-2 py-2 flex justify-around items-center max-w-5xl mx-auto rounded-t-2xl">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
              isActive
                ? 'text-[#D4AF37] scale-105'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            <div className="relative">
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}>
                {tab.icon}
              </span>
              {tab.badge && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-wider uppercase mt-0.5">
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute -bottom-1 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_6px_#D4AF37]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
