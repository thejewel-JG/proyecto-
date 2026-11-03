import React, { useState, useRef } from 'react';
import { Category, Video } from '../types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: Video) => void;
}

const CATEGORIES: Category[] = [
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

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Tarot');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('video');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  
  // Opciones de publicación exclusiva (Fase 9)
  const [isExclusive, setIsExclusive] = useState(false);
  const [priceCoins, setPriceCoins] = useState(100);
  const [coverUrl, setCoverUrl] = useState('');

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detectar tipo
    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      setErrorMessage('Formato no admitido. Formatos válidos: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('El archivo supera el tamaño máximo permitido de 50MB.');
      return;
    }

    setErrorMessage('');
    setSelectedFile(file);
    setMediaType(isVideo ? 'video' : 'image');

    // Generar previsualización local
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Por favor, selecciona una foto o vídeo desde tu dispositivo.');
      return;
    }

    if (title.trim().length < 3) {
      setErrorMessage('El título debe tener al menos 3 caracteres.');
      return;
    }

    setErrorMessage('');
    setUploadStatus('uploading');

    try {
      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Fallo al subir el archivo multimedia.');
      }

      setUploadStatus('saving');

      // 2. Guardar publicación en base de datos con clave de idempotencia
      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          videoUrl: uploadData.url,
          thumbnailUrl: isExclusive ? (coverUrl.trim() || uploadData.thumbnailUrl || uploadData.url) : (uploadData.thumbnailUrl || ''),
          mediaType: uploadData.mediaType,
          idempotencyKey,
          isPremium: isExclusive,
          priceCoins: isExclusive ? Math.max(1, priceCoins) : null,
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postData.error || 'Error al guardar la publicación.');
      }

      // Éxito confirmado tras persistir
      onPostCreated(postData.post);

      // Limpiar formulario
      setTitle('');
      setDescription('');
      setCategory('Tarot');
      setIsExclusive(false);
      setPriceCoins(100);
      setCoverUrl('');
      handleClearFile();
      setUploadStatus('idle');
      setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      onClose();
    } catch (err: any) {
      // REQUISITO: "Conserva los datos del formulario cuando ocurra un error."
      setErrorMessage(err.message || 'Error de conexión al procesar la publicación.');
      setUploadStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 md:p-8 max-w-lg w-full gold-glow my-auto relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-2xl">auto_awesome</span>
            <h2 className="font-cinzel text-lg md:text-xl font-bold text-[#F7E7C1]">
              Nueva Publicación Sagrada
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
            className="text-[#A7A7A7] hover:text-[#F7E7C1] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-red-400 text-base flex-shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* File Picker & Preview */}
          <div>
            <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
              Foto o Vídeo Reel desde tu dispositivo
            </label>

            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#0B0911]/50 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-[#5A2D82]/50 border border-[#D4AF37]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-2xl text-[#D4AF37]">upload_file</span>
                </div>
                <p className="text-xs text-[#F7E7C1] font-bold">Toca para seleccionar foto o vídeo</p>
                <span className="text-[10px] text-[#A7A7A7] max-w-xs leading-relaxed">
                  Formatos válidos: MP4, WEBM, MOV, JPG, PNG, WEBP (máx. 50MB).
                </span>
                <span className="text-[9px] text-[#D4AF37]/70 italic mt-1">
                  Sin transcodificación: se reproducirá en su formato original.
                </span>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-[#D4AF37]/40 bg-black aspect-[9/12] max-h-64 mx-auto flex items-center justify-center">
                {mediaType === 'image' ? (
                  <img src={previewUrl} alt="Vista previa" className="w-full h-full object-contain" />
                ) : (
                  <video src={previewUrl} controls muted playsInline className="w-full h-full object-contain" />
                )}
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="absolute top-2 right-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-white rounded-full p-1.5 transition-colors shadow-lg"
                  title="Cambiar archivo"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-[#0B0911]/80 border border-[#D4AF37]/40 text-[9px] uppercase font-bold text-[#D4AF37]">
                  {mediaType === 'image' ? 'Foto' : 'Vídeo'} seleccionado
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
              Título de la Publicación *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Mensaje del Arcángel Miguel para esta Luna Llena ✨"
              maxLength={150}
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:outline-none focus:border-[#D4AF37] transition-colors"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1A1026] text-[#F7E7C1]">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
              Descripción o Interpretación (Opcional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Escribe la interpretación de la tirada, consejos astrológicos o reflexión..."
              maxLength={1000}
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors resize-none"
            />
          </div>

          {/* Configuración de Publicación Exclusiva (Fase 9) */}
          <div className="p-3.5 rounded-xl bg-[#0B0911]/80 border border-[#D4AF37]/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#D4AF37]">lock</span>
                <div>
                  <span className="text-xs font-bold text-[#F7E7C1] block">Publicación Exclusiva de Pago</span>
                  <span className="text-[10px] text-[#A7A7A7]">Desbloqueable mediante monedas por seguidores</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExclusive}
                  onChange={(e) => setIsExclusive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2E1B47] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]"></div>
              </label>
            </div>

            {isExclusive && (
              <div className="space-y-3 pt-2 border-t border-[#D4AF37]/20 animate-in fade-in duration-200">
                <div>
                  <label className="block text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
                    Precio en Monedas (Entero) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    value={priceCoins}
                    onChange={(e) => setPriceCoins(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#1A1026] border border-[#D4AF37]/40 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
                  />
                  <span className="text-[9px] text-[#A7A7A7] mt-0.5 block">
                    El autor y tarotista recibirá el reparto contable directo tras la comisión de la plataforma.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
                    Portada o Vista Previa Separada (Opcional)
                  </label>
                  <input
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://... (URL pública de imagen de portada o teaser)"
                    className="w-full bg-[#1A1026] border border-[#D4AF37]/40 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
                  />
                  <span className="text-[9px] text-[#A7A7A7] mt-0.5 block">
                    Esta imagen se muestra públicamente en el feed mientras el contenido original permanece en almacenamiento privado.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={uploadStatus === 'uploading' || uploadStatus === 'saving' || !selectedFile}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-widest gold-glow hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {uploadStatus === 'uploading' && (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                  <span>Subiendo multimedia a KABALY...</span>
                </>
              )}
              {uploadStatus === 'saving' && (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">auto_awesome</span>
                  <span>Guardando en el cosmos...</span>
                </>
              )}
              {uploadStatus !== 'uploading' && uploadStatus !== 'saving' && (
                <>
                  <span className="material-symbols-outlined text-base">publish</span>
                  <span>Publicar en KABALY</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
