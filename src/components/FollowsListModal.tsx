import React, { useState, useEffect } from 'react';
import { FollowUser, User } from '../types';

interface FollowsListModalProps {
  isOpen: boolean;
  userId: string;
  type: 'followers' | 'following';
  currentUser: User | null;
  onClose: () => void;
  onOpenAuthModal?: () => void;
}

export const FollowsListModal: React.FC<FollowsListModalProps> = ({
  isOpen,
  userId,
  type,
  currentUser,
  onClose,
  onOpenAuthModal,
}) => {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const endpoint = type === 'followers' ? `/api/users/${userId}/followers` : `/api/users/${userId}/following`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Error al consultar lista.');
        const data = await res.json();
        if (isMounted) {
          setUsers(type === 'followers' ? data.followers || [] : data.following || []);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error de conexión.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [isOpen, userId, type]);

  const handleToggleFollow = async (targetId: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    try {
      const res = await fetch(`/api/users/${targetId}/follow`, {
        method: isCurrentlyFollowing ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, isFollowing: !isCurrentlyFollowing } : u));
      }
    } catch {
      alert('Error al actualizar seguimiento.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full gold-glow text-left space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-lg">
              {type === 'followers' ? 'groups' : 'person_add'}
            </span>
            <h3 className="font-cinzel text-sm font-bold text-[#F7E7C1]">
              {type === 'followers' ? 'Seguidores Cósmicos' : 'Cuentas Seguidas'}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-[#A7A7A7] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[#D4AF37]">auto_awesome</span>
              Sintonizando constelaciones...
            </div>
          ) : error ? (
            <p className="py-4 text-center text-xs text-red-400">{error}</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#A7A7A7]">
              {type === 'followers' ? 'Aún no tiene seguidores.' : 'No sigue a ninguna cuenta todavía.'}
            </p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-[#0B0911]/50 border border-[#D4AF37]/15">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/40 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#F7E7C1] truncate">{user.name}</p>
                    <span className="text-[10px] text-[#A7A7A7] uppercase font-semibold block">{user.role}</span>
                  </div>
                </div>

                {currentUser && currentUser.id !== user.id && (
                  <button
                    onClick={() => handleToggleFollow(user.id, !!user.isFollowing)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
                      user.isFollowing
                        ? 'bg-[#2E1B47] text-[#D4AF37] border border-[#D4AF37]/40 hover:border-red-400 hover:text-red-300'
                        : 'bg-[#D4AF37] text-[#0B0911] gold-glow hover:scale-105'
                    }`}
                  >
                    {user.isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#2E1B47] text-[#A7A7A7] py-2.5 rounded-full text-xs font-bold hover:text-white transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
