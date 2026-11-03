import React, { useState, useEffect } from 'react';
import { StoryViewer } from '../types';

interface StoryViewersModalProps {
  isOpen: boolean;
  storyId: string;
  onClose: () => void;
}

export const StoryViewersModal: React.FC<StoryViewersModalProps> = ({
  isOpen,
  storyId,
  onClose,
}) => {
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !storyId) return;

    let isMounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/views`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'No se pudieron consultar las visualizaciones.');
        }
        const data = await res.json();
        if (isMounted) {
          setViewers(data.viewers || []);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [isOpen, storyId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-5 max-w-xs w-full gold-glow text-left space-y-3.5">
        <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-2.5">
          <div className="flex items-center gap-1.5 text-[#D4AF37]">
            <span className="material-symbols-outlined text-base">visibility</span>
            <span className="font-cinzel text-xs font-bold text-[#F7E7C1]">
              Visto por {viewers.length} {viewers.length === 1 ? 'persona' : 'personas'}
            </span>
          </div>
          <button onClick={onClose} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <div className="py-6 text-center text-xs text-[#A7A7A7] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[#D4AF37] text-base">auto_awesome</span>
              Cargando espectadores...
            </div>
          ) : error ? (
            <p className="py-4 text-center text-xs text-red-400">{error}</p>
          ) : viewers.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#A7A7A7]">Aún no hay visualizaciones registradas.</p>
          ) : (
            viewers.map((viewer, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-[#5A2D82]/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={viewer.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80'}
                    alt={viewer.userName}
                    className="w-7 h-7 rounded-full object-cover border border-[#D4AF37]/40 flex-shrink-0"
                  />
                  <span className="text-xs font-semibold text-[#F7E7C1] truncate">{viewer.userName}</span>
                </div>
                <span className="text-[9px] text-[#7A7280] flex-shrink-0">
                  {new Date(viewer.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#2E1B47] text-[#D4AF37] border border-[#D4AF37]/30 py-2 rounded-full text-xs font-bold hover:brightness-110 transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
