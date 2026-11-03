import React, { useState, useEffect } from 'react';
import { CosmicNotification } from '../types';
import { SacredFlameIcon, CrystalBallIcon, TwinMoonsIcon, SolomonStarIcon } from './EsotericIcons';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserProfile: (userId: string) => void;
  onNotificationsRead?: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onOpenUserProfile,
  onNotificationsRead,
}) => {
  const [notifications, setNotifications] = useState<CosmicNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'like' | 'comment' | 'follow'>('all');

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      onNotificationsRead?.();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'comment') return n.type === 'comment' || n.type === 'reply';
    return n.type === filter;
  });

  const renderBadgeIcon = (type: CosmicNotification['type']) => {
    switch (type) {
      case 'like':
        return <SacredFlameIcon className="w-4 h-4 text-[#D4AF37]" filled />;
      case 'comment':
      case 'reply':
        return <CrystalBallIcon className="w-4 h-4 text-purple-300" filled />;
      case 'follow':
        return <TwinMoonsIcon className="w-4 h-4 text-emerald-300" filled />;
      default:
        return <SolomonStarIcon className="w-4 h-4 text-[#D4AF37]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0E0A17] border-l border-[#D4AF37]/25 h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#D4AF37]">✦</span>
            <h3 className="font-cinzel text-base font-bold text-[#F7E7C1] tracking-wider uppercase">
              Ecos del Cosmos
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {notifications.some(n => !n.isRead) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#D4AF37] hover:underline font-semibold"
              >
                Marcar leídas
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#F7E7C1]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'like', label: 'Resonancias' },
            { id: 'comment', label: 'Oráculo' },
            { id: 'follow', label: 'Círculo' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-[#D4AF37] text-[#0B0911] font-bold shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                  : 'bg-[#1A1026] text-[#F7E7C1]/70 border border-white/10 hover:text-[#F7E7C1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#F7E7C1]/60">
              Consultando los ecos astrales...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center px-6 space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#1A1026] border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
                <SolomonStarIcon className="w-6 h-6" />
              </div>
              <p className="font-cinzel text-sm text-[#F7E7C1] font-bold">Silencio estelar</p>
              <p className="text-xs text-[#F7E7C1]/60">
                Aquí aparecerán quienes resuenen con tus visiones, comenten en tu oráculo o entren en tu círculo.
              </p>
            </div>
          ) : (
            filtered.map(n => (
              <div
                key={n.id}
                onClick={async () => {
                  if (!n.isRead) {
                    fetch('/api/notifications/read', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notificationId: n.id }),
                    }).catch(() => {});
                    onNotificationsRead?.();
                  }
                  onOpenUserProfile(n.actorId);
                  onClose();
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  n.isRead
                    ? 'bg-[#140D21]/60 border-white/5 hover:border-[#D4AF37]/30'
                    : 'bg-[#2E1B47]/45 border-[#D4AF37]/40 shadow-[0_0_15px_rgba(212,175,55,0.12)]'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={n.actorAvatar}
                    alt={n.actorName}
                    className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]/40 bg-[#1A1026]"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0B0911] border border-[#D4AF37]/40 flex items-center justify-center">
                    {renderBadgeIcon(n.type)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F7E7C1] leading-snug">
                    <strong className="font-bold text-[#D4AF37] hover:underline">{n.actorName}</strong>{' '}
                    <span className="text-[#F7E7C1]/90">{n.message}</span>
                  </p>
                  <span className="text-[10px] text-[#F7E7C1]/50 block mt-1">
                    {new Date(n.createdAt).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0 mt-2 shadow-[0_0_6px_#D4AF37]" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

