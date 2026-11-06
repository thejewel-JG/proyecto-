import React from 'react';
import { StoryGroup, TarotistaProfile, User } from '../types';

interface StoriesBarProps {
  storyGroups: StoryGroup[];
  currentUser: User | null;
  tarotistaProfiles?: TarotistaProfile[];
  onOpenCreateStory: () => void;
  onSelectStoryGroup: (group: StoryGroup) => void;
  onSelectProfile?: (userId: string) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  storyGroups,
  currentUser,
  tarotistaProfiles = [],
  onOpenCreateStory,
  onSelectStoryGroup,
  onSelectProfile,
}) => {
  const myStoryGroup = currentUser ? storyGroups.find(g => g.userId === currentUser.id) : null;
  const otherGroups = storyGroups.filter(g => !currentUser || g.userId !== currentUser.id);
  const storyUserIds = new Set(storyGroups.map(g => g.userId));
  const onlineTarotistasWithoutStory = tarotistaProfiles.filter(
    t => !storyUserIds.has(t.id) && !storyUserIds.has(t.userId)
  );

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-1.5 flex items-center gap-3.5 px-2 border-b border-white/5">
      {/* 1. Botón Tu Aura / Story (Crear o Ver) */}
      <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
        <div className="relative">
          <div
            onClick={() => {
              if (myStoryGroup && myStoryGroup.stories.length > 0) {
                onSelectStoryGroup(myStoryGroup);
              } else {
                onOpenCreateStory();
              }
            }}
            className={`w-13 h-13 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
              myStoryGroup && myStoryGroup.stories.length > 0
                ? myStoryGroup.hasUnseen
                  ? 'story-ring shadow-[0_0_12px_rgba(212,175,55,0.35)]'
                  : 'border border-[#D4AF37]/40'
                : 'border border-dashed border-[#D4AF37]/45'
            }`}
          >
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
              alt={currentUser?.name || 'Tu Aura'}
              className="w-12 h-12 object-cover rounded-full bg-[#1A1026] border border-[#0B0911]"
            />
          </div>

          {/* Sello '+' para añadir story */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCreateStory();
            }}
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#D4AF37] text-[#0B0911] border border-[#0B0911] flex items-center justify-center font-bold text-[10px] hover:scale-110 transition-transform shadow-md"
            title="Compartir Aura de 24h"
          >
            ✦
          </button>
        </div>
        <span className="text-[10px] text-[#F7E7C1]/80 mt-1 font-medium truncate max-w-[58px] text-center">
          {myStoryGroup && myStoryGroup.stories.length > 0 ? 'Tu Aura' : 'Tu Aura'}
        </span>
      </div>

      {/* 2. Lista de Stories de otros creadores / seguidos */}
      {otherGroups.map((group) => (
        <div
          key={group.userId}
          onClick={() => onSelectStoryGroup(group)}
          className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
        >
          <div
            className={`w-13 h-13 rounded-full transition-transform group-hover:scale-105 p-[2px] ${
              group.hasUnseen
                ? 'story-ring shadow-[0_0_12px_rgba(212,175,55,0.35)]'
                : 'border border-[#D4AF37]/25 opacity-65'
            }`}
          >
            <img
              src={group.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
              alt={group.userName}
              className="w-12 h-12 object-cover rounded-full bg-[#1A1026] border border-[#0B0911]"
            />
          </div>
          <span className="text-[10px] text-[#F7E7C1]/75 mt-1 font-medium truncate max-w-[60px] text-center group-hover:text-[#D4AF37] transition-colors">
            {group.userName}
          </span>
        </div>
      ))}

      {/* 3. Videntes Destacados en Línea (Acceso directo al Altar si no tienen Story de 24h) */}
      {onlineTarotistasWithoutStory.map((tar) => (
        <div
          key={tar.id}
          onClick={() => onSelectProfile && onSelectProfile(tar.id)}
          className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
        >
          <div className="relative w-13 h-13 rounded-full p-[2px] border border-[#D4AF37]/45 group-hover:scale-105 transition-transform">
            <img
              src={tar.avatar}
              alt={tar.name}
              className="w-12 h-12 object-cover rounded-full bg-[#1A1026] border border-[#0B0911]"
            />
            {tar.availability === 'online' && (
              <span
                className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0911] absolute bottom-0 right-0"
                title="En línea ahora"
              />
            )}
          </div>
          <span className="text-[10px] text-[#F7E7C1]/75 mt-1 font-medium truncate max-w-[60px] text-center group-hover:text-[#D4AF37] transition-colors">
            {tar.name}
          </span>
        </div>
      ))}
    </div>
  );
};
