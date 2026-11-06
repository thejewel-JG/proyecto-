import React, { useState, useRef } from 'react';
import { Story } from '../types';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (newStory: Story) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [saveAsHighlight, setSaveAsHighlight] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState('Mi Aura');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      setErrorMessage('Formato no válido. Sube una foto (JPG, PNG, WEBP) o un vídeo (MP4, WEBM).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('El archivo no debe superar 50MB.');
      return;
    }

    setErrorMessage('');
    setSelectedFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Selecciona una foto o vídeo para tu story.');
      return;
    }

    setErrorMessage('');
    setStatus('uploading');

    try {
      // 1. Subida del archivo multimedia al servidor
      const formData = new FormData();
      formData.append('file', selectedFile);

      const upRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const upData = await upRes.json();
      if (!upRes.ok) {
        throw new Error(upData.error || 'Fallo al subir el archivo multimedia.');
      }

      setStatus('saving');

      // 2. Creación de la story con caducidad en servidor (24 horas)
      const storyRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: upData.url,
          mediaType: upData.mediaType || mediaType,
          caption: caption.trim(),
        }),
      });

      const storyData = await storyRes.json();
      if (!storyRes.ok) {
        throw new Error(storyData.error || 'Error al registrar la story.');
      }

      // Éxito: Si también marcó guardar como Aura Destacada permanente, la fijamos
      if (saveAsHighlight && highlightTitle.trim()) {
        await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: highlightTitle.trim(),
            coverUrl: upData.url,
            mediaUrl: upData.url,
            mediaType: upData.mediaType || mediaType,
          }),
        }).catch(() => {});
      }

      onStoryCreated(storyData.story);
      handleRemoveMedia();
      setCaption('');
      setSaveAsHighlight(false);
      setStatus('idle');
      onClose();
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Error al publicar story. Tus datos han sido preservados.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-sm w-full gold-glow text-left space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-xl">auto_stories</span>
            <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">Nueva Story Cósmica</h3>
          </div>
          <button
            onClick={() => {
              if (status !== 'uploading' && status !== 'saving') onClose();
            }}
            className="text-[#A7A7A7] hover:text-[#F7E7C1]"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Aviso 24h */}
          <div className="bg-[#2E1B47]/60 border border-[#D4AF37]/30 rounded-xl p-2.5 flex items-center gap-2 text-[#D4AF37]">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span className="text-[10px] leading-tight">
              Tu story estará disponible para tus seguidores y la comunidad durante exactamente <strong>24 horas</strong>.
            </span>
          </div>

          {/* Selector y Previsualizador */}
          <div>
            <label className="text-[10px] text-[#A7A7A7] block mb-1 font-semibold uppercase tracking-wider">
              Contenido Multimedia *
            </label>

            {previewUrl ? (
              <div className="relative aspect-[9/16] max-h-64 mx-auto rounded-2xl overflow-hidden border-2 border-[#D4AF37]/40 bg-black flex items-center justify-center">
                {mediaType === 'image' ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <video src={previewUrl} controls className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  className="absolute top-2 right-2 p-1 bg-[#0B0911]/80 rounded-full text-red-400 hover:text-red-300 border border-red-500/40"
                  title="Cambiar archivo"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D4AF37]/40 rounded-2xl p-6 text-center cursor-pointer hover:border-[#D4AF37] transition-all bg-[#0B0911]/40 group flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-[#5A2D82]/40 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl">upload</span>
                </div>
                <p className="text-xs text-[#F7E7C1] font-semibold">Toca para seleccionar foto o vídeo</p>
                <span className="text-[10px] text-[#A7A7A7]">JPG, PNG, WEBP, MP4 (máx. 50MB)</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Texto / Mensaje opcional */}
          <div>
            <label className="text-[10px] text-[#A7A7A7] block mb-1 font-semibold uppercase tracking-wider">
              Mensaje o Interpretación (Opcional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 120))}
              placeholder="Ej: Carta del día: El Mago 🔮"
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] placeholder:text-[#7A7280] outline-none focus:border-[#D4AF37]"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[
                '🎴 Elige tu Carta en el Oráculo Superior',
                '🌙 Energía Lunar de Hoy',
                '✦ Susúrrame tu signo para una lectura',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCaption(preset)}
                  className="px-2 py-0.5 rounded-full bg-[#0B0911] border border-[#D4AF37]/25 hover:border-[#D4AF37] text-[9px] text-[#D4AF37]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Opción de fijar directamente en Auras Destacadas del Perfil */}
          <div className="p-2.5 rounded-xl bg-[#0B0911]/80 border border-[#D4AF37]/25 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] font-bold text-[#F7E7C1]">
                ✦ Fijar también en mis Auras Destacadas
              </span>
              <input
                type="checkbox"
                checked={saveAsHighlight}
                onChange={(e) => setSaveAsHighlight(e.target.checked)}
                className="accent-[#D4AF37]"
              />
            </label>
            {saveAsHighlight && (
              <input
                type="text"
                maxLength={24}
                value={highlightTitle}
                onChange={(e) => setHighlightTitle(e.target.value)}
                placeholder="Título del Aura (ej. Rituales, Tiradas)"
                className="w-full bg-[#1A1026] border border-[#D4AF37]/30 rounded-lg px-2.5 py-1.5 text-[11px] text-[#F7E7C1]"
              />
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300 text-[11px]">
              {errorMessage}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={status === 'uploading' || status === 'saving'}
              onClick={onClose}
              className="flex-1 bg-[#2E1B47] text-[#A7A7A7] font-bold py-2.5 rounded-full text-xs hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedFile || status === 'uploading' || status === 'saving'}
              className="flex-1 bg-[#D4AF37] text-[#0B0911] font-bold py-2.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
            >
              {status === 'uploading' ? 'Subiendo...' : status === 'saving' ? 'Publicando...' : 'Publicar Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
