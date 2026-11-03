import React, { useState } from 'react';

interface ReportMessageModalProps {
  isOpen: boolean;
  messageId: string;
  messageSnippet: string;
  onClose: () => void;
  onReportSubmitted: () => void;
}

export const ReportMessageModal: React.FC<ReportMessageModalProps> = ({
  isOpen,
  messageId,
  messageSnippet,
  onClose,
  onReportSubmitted,
}) => {
  const [reason, setReason] = useState('acoso');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar reporte.');
      }

      onReportSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al enviar el reporte. Por favor inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-md bg-[#120E1C] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(212,175,55,0.2)] text-[#F7E7C1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#D4AF37]/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400">report</span>
            <h3 className="font-playfair font-bold text-lg text-[#F7E7C1]">Reportar mensaje</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-[#A09BAE] hover:text-[#F7E7C1] hover:bg-[#2E1B47]/50"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="bg-[#1A1026] p-3 rounded-xl border border-[#D4AF37]/20">
            <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider block mb-1">
              Mensaje seleccionado
            </span>
            <p className="text-xs text-[#E5E0EB] italic line-clamp-3">
              "{messageSnippet || '[Contenido multimedia]'}"
            </p>
          </div>

          <div className="bg-[#2E1B47]/40 p-3 rounded-xl border border-yellow-500/20 text-[11px] text-[#A09BAE] leading-relaxed">
            <span className="material-symbols-outlined text-xs text-yellow-400 align-middle mr-1">info</span>
            Este reporte compartirá únicamente el mensaje seleccionado con el equipo de moderación para su revisión confidencial. No otorga acceso general al resto de tus conversaciones privadas.
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D4AF37] mb-1.5 uppercase tracking-wide">
              Motivo del reporte
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#1A1026] border border-[#D4AF37]/30 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="acoso">Acoso, insultos o amenazas</option>
              <option value="estafa">Estafa, fraude o solicitud de dinero fuera de la plataforma</option>
              <option value="contenido_inapropiado">Contenido explícito o inadecuado</option>
              <option value="spam">Spam o mensajes masivos no deseados</option>
              <option value="otro">Otro motivo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D4AF37] mb-1.5 uppercase tracking-wide">
              Detalles adicionales (opcional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              placeholder="Explica brevemente qué ocurre para ayudar al equipo de moderación..."
              rows={3}
              className="w-full bg-[#1A1026] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/50 focus:outline-none focus:border-[#D4AF37] resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-950/40 p-2.5 rounded-xl border border-red-500/30">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-full border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider text-[#A09BAE] hover:text-[#F7E7C1] hover:bg-[#2E1B47]/50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-full bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                  <span>Enviando...</span>
                </>
              ) : (
                <span>Enviar reporte</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
