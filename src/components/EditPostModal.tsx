import React, { useState } from 'react';
import { Category, Video } from '../types';

interface EditPostModalProps {
  post: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdated: (updatedPost: Video) => void;
  onPostDeleted: (postId: string) => void;
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

export const EditPostModal: React.FC<EditPostModalProps> = ({
  post,
  isOpen,
  onClose,
  onPostUpdated,
  onPostDeleted,
}) => {
  const [title, setTitle] = useState(post?.title || '');
  const [description, setDescription] = useState(post?.description || '');
  const [category, setCategory] = useState<Category>(post?.category || 'Tarot');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    if (post) {
      setTitle(post.title);
      setDescription(post.description || '');
      setCategory(post.category);
      setConfirmDelete(false);
      setErrorMessage('');
    }
  }, [post]);

  if (!isOpen || !post) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setErrorMessage('El título debe tener al menos 3 caracteres.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar la publicación.');
      }

      onPostUpdated(data.post);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al retirar la publicación.');
      }

      onPostDeleted(post.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 md:p-8 max-w-md w-full gold-glow my-auto relative">
        <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3 mb-4">
          <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37]">edit</span>
            Editar Publicación
          </h3>
          <button onClick={onClose} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
            {errorMessage}
          </div>
        )}

        {!confirmDelete ? (
          <form onSubmit={handleSave} className="space-y-4 text-xs text-[#F7E7C1]">
            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
                Título
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:outline-none focus:border-[#D4AF37]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1A1026] text-[#F7E7C1]">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1">
                Descripción
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:outline-none focus:border-[#D4AF37] resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Guardando cambios...' : 'Guardar Cambios'}
              </button>

              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-full text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-500/20 transition-all font-semibold flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Retirar esta publicación</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-red-950/70 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h4 className="font-bold text-sm text-[#F7E7C1]">¿Confirmas el retiro de esta publicación?</h4>
            <p className="text-xs text-[#A7A7A7] leading-relaxed">
              La publicación dejará de ser visible en el feed y en tu perfil público de forma permanente mediante borrado lógico seguro.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="py-2.5 rounded-full text-xs font-bold bg-[#0B0911] border border-[#D4AF37]/30 text-[#A7A7A7] hover:text-[#F7E7C1]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-full text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Retirando...' : 'Sí, Retirar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
