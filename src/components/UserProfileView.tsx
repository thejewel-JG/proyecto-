import React, { useState } from 'react';
import { User, Video, TarotistaProfile, CoinPackage, LedgerTransaction, WithdrawalRequest, Category } from '../types';
import { WalletView } from './WalletView';

interface UserProfileViewProps {
  currentUser: User;
  videos: Video[];
  tarotistaProfiles: TarotistaProfile[];
  coinPackages: CoinPackage[];
  ledger: LedgerTransaction[];
  withdrawals: WithdrawalRequest[];
  onTopup: (packageId: string, paymentMethod: 'apple_pay' | 'stripe') => void;
  onRequestWithdrawal: (amountEur: number, vatNumber: string, bankIban: string) => void;
  onOpenSpendingLimits: () => void;
  onCreatePost: (postData: {
    title: string;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    category: Category;
    isPremium: boolean;
    priceCoins?: number;
    description: string;
  }) => Promise<void>;
  onUpdateProfile: (updatedData: { name: string; handle: string; bio: string; avatar: string; coverImage: string }) => Promise<void>;
  onSwitchUserRole: (role: 'cliente' | 'tarotista' | 'admin') => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  videos,
  tarotistaProfiles,
  coinPackages,
  ledger,
  withdrawals,
  onTopup,
  onRequestWithdrawal,
  onOpenSpendingLimits,
  onCreatePost,
  onUpdateProfile,
  onSwitchUserRole,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'publicaciones' | 'guardados' | 'monedero' | 'consultas'>('publicaciones');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState(currentUser.name);
  const [editHandle, setEditHandle] = useState(currentUser.handle || `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`);
  const [editBio, setEditBio] = useState(currentUser.bio || 'Explorador del cosmos y apasionado del Tarot y la Astrología en KABALY ✨');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editCover, setEditCover] = useState(currentUser.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200');

  // Create Post Form state
  const [postTitle, setPostTitle] = useState('');
  const [postMediaType, setPostMediaType] = useState<'video' | 'image'>('video');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postCategory, setPostCategory] = useState<Category>('Tarot');
  const [postDescription, setPostDescription] = useState('');
  const [postIsPremium, setPostIsPremium] = useState(false);
  const [postPriceCoins, setPostPriceCoins] = useState(25);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Filter user's uploaded videos/images
  const userTarotistaProfile = tarotistaProfiles.find(p => p.userId === currentUser.id);
  const myPosts = videos.filter(v => 
    v.tarotistaId === currentUser.id || 
    (userTarotistaProfile && v.tarotistaId === userTarotistaProfile.id)
  );

  const likedPosts = videos.filter(v => v.isLikedByCurrentUser);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      name: editName,
      handle: editHandle,
      bio: editBio,
      avatar: editAvatar,
      coverImage: editCover,
    });
    setShowEditProfileModal(false);
  };

  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postMediaUrl) {
      alert('Por favor añade un título y enlace de contenido.');
      return;
    }
    setIsSubmittingPost(true);
    try {
      await onCreatePost({
        title: postTitle,
        mediaUrl: postMediaUrl,
        mediaType: postMediaType,
        category: postCategory,
        isPremium: postIsPremium,
        priceCoins: postIsPremium ? postPriceCoins : 0,
        description: postDescription,
      });
      setShowCreateModal(false);
      setPostTitle('');
      setPostMediaUrl('');
      setPostDescription('');
      setPostIsPremium(false);
      setActiveSubTab('publicaciones');
    } catch (err) {
      console.error(err);
      alert('Error al publicar el contenido.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const categoriesList: Category[] = [
    'Tarot', 'Astrología', 'Horóscopo', 'Runas', 'Péndulo', 'Numerología', 'Reiki', 'Lunas', 'Rituales'
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
      {/* Profile Banner & Header Card */}
      <div className="glass-card rounded-3xl border border-[#D4AF37]/30 overflow-hidden relative shadow-2xl">
        {/* Banner Cover Image */}
        <div className="h-44 md:h-52 w-full relative bg-[#1A1026]">
          <img 
            src={currentUser.coverImage || editCover} 
            alt="Cover" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-black/30" />
          
          <button
            onClick={() => setShowEditProfileModal(true)}
            className="absolute top-3 right-3 bg-[#0B0911]/70 backdrop-blur-md border border-[#D4AF37]/40 text-[#D4AF37] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-[#5A2D82] transition-all"
          >
            <span className="material-symbols-outlined text-sm">photo_camera</span>
            <span className="hidden sm:inline">Editar Portada</span>
          </button>
        </div>

        {/* Profile Info Overlay */}
        <div className="px-6 pb-6 pt-0 relative -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#D4AF37] overflow-hidden bg-[#1A1026] p-0.5 gold-glow shadow-2xl">
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
              </div>
              <button 
                onClick={() => setShowEditProfileModal(true)}
                className="absolute bottom-1 right-1 bg-[#D4AF37] text-[#0B0911] rounded-full p-2 border-2 border-[#0B0911] hover:scale-110 transition-transform"
              >
                <span className="material-symbols-outlined text-xs font-bold">edit</span>
              </button>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold px-5 py-2.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Publicar Contenido</span>
              </button>

              <button
                onClick={() => setShowEditProfileModal(true)}
                className="bg-[#2E1B47] text-[#F7E7C1] border border-[#D4AF37]/40 px-4 py-2.5 rounded-full text-xs font-bold hover:border-[#D4AF37] transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                <span>Editar</span>
              </button>

              <button
                onClick={onOpenSpendingLimits}
                className="bg-[#1A1026] text-[#D4AF37] border border-[#D4AF37]/30 px-3.5 py-2.5 rounded-full text-xs font-bold hover:bg-[#5A2D82]/50 transition-all flex items-center gap-1"
                title="Ajustes de autorregulación y límites de gasto"
              >
                <span className="material-symbols-outlined text-sm">shield</span>
                <span className="hidden md:inline">Límites</span>
              </button>
            </div>
          </div>

          {/* User Bio Details */}
          <div className="mt-4 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-playfair text-2xl font-bold text-[#F7E7C1]">
                {currentUser.name}
              </h2>
              <span className="text-xs text-[#D4AF37] font-mono">
                {currentUser.handle || `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`}
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                currentUser.role === 'tarotista'
                  ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]'
                  : 'bg-[#2E1B47] text-[#A7A7A7]'
              }`}>
                {currentUser.role === 'tarotista' ? '🔮 Tarotista Verificado' : '✨ Cliente Kabaly'}
              </span>
            </div>

            <p className="text-xs text-[#A7A7A7] max-w-xl leading-relaxed">
              {currentUser.bio || 'Explorador del cosmos, lecturas de tarot, carta astral y revelaciones en KABALY.'}
            </p>

            {/* Role switch CTA */}
            {currentUser.role === 'cliente' && (
              <div className="pt-2">
                <button
                  onClick={() => onSwitchUserRole('tarotista')}
                  className="text-xs text-[#D4AF37] hover:underline font-bold flex items-center gap-1 justify-center sm:justify-start"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  ¿Eres profesional del Tarot? Solicita tu perfil verificado KYC aquí ➔
                </button>
              </div>
            )}
          </div>

          {/* Social Stats Row */}
          <div className="grid grid-cols-4 gap-2 pt-6 mt-6 border-t border-[#D4AF37]/20 text-center">
            <div className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20">
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block">
                {currentUser.followersCount || userTarotistaProfile?.followersCount || 128}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Seguidores</span>
            </div>

            <div className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20">
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block">
                {currentUser.followingCount || 24}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Siguiendo</span>
            </div>

            <div className="bg-[#0B0911]/60 p-2.5 rounded-2xl border border-[#D4AF37]/20">
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block">
                {myPosts.length}
              </span>
              <span className="text-[10px] text-[#A7A7A7] uppercase tracking-wider">Posts</span>
            </div>

            <div 
              onClick={() => setActiveSubTab('monedero')}
              className="bg-gradient-to-br from-[#2E1B47] to-[#5A2D82] p-2.5 rounded-2xl border border-[#D4AF37]/40 cursor-pointer hover:scale-105 transition-all gold-glow"
            >
              <span className="font-playfair text-lg font-bold text-[#D4AF37] block flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm filled text-[#D4AF37]">stars</span>
                {currentUser.coinsBalance}
              </span>
              <span className="text-[10px] text-[#F7E7C1] uppercase font-bold tracking-wider">Monedas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#D4AF37]/20 gap-2">
        <button
          onClick={() => setActiveSubTab('publicaciones')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'publicaciones'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">grid_on</span>
          <span>Mis Publicaciones ({myPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guardados')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'guardados'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">favorite</span>
          <span>Me Gusta ({likedPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('monedero')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'monedero'
              ? 'border-[#D4AF37] text-[#D4AF37] gold-glow'
              : 'border-transparent text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          <span className="material-symbols-outlined text-base">account_balance_wallet</span>
          <span>Monedero Astral</span>
        </button>
      </div>

      {/* SUB-VIEW 1: My Posts Grid */}
      {activeSubTab === 'publicaciones' && (
        <div>
          {myPosts.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#2E1B47] text-[#D4AF37] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
              </div>
              <h3 className="font-playfair text-lg text-[#F7E7C1] font-bold">Aún no has compartido publicaciones</h3>
              <p className="text-xs text-[#A7A7A7] max-w-sm mx-auto">
                Comparte tus tiradas de cartas, predicciones astrológicas o fotos místicas con la comunidad.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-6 py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
              >
                Crear Mi Primera Publicación
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {myPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-2xl overflow-hidden group hover:border-[#D4AF37] transition-all relative flex flex-col justify-between"
                >
                  <div className="relative aspect-[3/4] bg-black">
                    {post.mediaType === 'image' ? (
                      <img src={post.videoUrl || post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.videoUrl} poster={post.thumbnailUrl} className="w-full h-full object-cover" />
                    )}
                    
                    {/* Category Pill */}
                    <span className="absolute top-2 left-2 bg-[#0B0911]/80 backdrop-blur-md text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37]/30">
                      {post.category}
                    </span>

                    {/* Premium Lock Badge */}
                    {post.isPremium && (
                      <span className="absolute top-2 right-2 bg-[#5A2D82] text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#D4AF37] flex items-center gap-0.5 gold-glow">
                        <span className="material-symbols-outlined text-[10px]">lock</span>
                        {post.priceCoins} 🪙
                      </span>
                    )}

                    {/* Likes & Views Overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-red-500 filled">favorite</span>
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-[#A7A7A7]">
                        <span className="material-symbols-outlined text-xs">chat</span>
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-1">{post.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: Saved / Liked Posts */}
      {activeSubTab === 'guardados' && (
        <div>
          {likedPosts.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1026]/40 border border-dashed border-[#D4AF37]/30 rounded-3xl p-8 space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#D4AF37]">favorite_border</span>
              <p className="text-xs text-[#A7A7A7]">No tienes publicaciones guardadas. Dale Me Gusta a los vídeos en el feed para verlos aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {likedPosts.map((post) => (
                <div key={post.id} className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-2xl overflow-hidden">
                  <div className="relative aspect-[3/4] bg-black">
                    <video src={post.videoUrl} poster={post.thumbnailUrl} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 bg-[#0B0911]/80 text-[#D4AF37] text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {post.category}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <h4 className="font-playfair text-xs font-bold text-[#F7E7C1] line-clamp-1">{post.title}</h4>
                    <span className="text-[10px] text-[#D4AF37] block mt-0.5">{post.tarotistaName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: Embedded Wallet View */}
      {activeSubTab === 'monedero' && (
        <WalletView
          currentUser={currentUser}
          coinPackages={coinPackages}
          ledger={ledger}
          withdrawals={withdrawals}
          onTopup={onTopup}
          onRequestWithdrawal={onRequestWithdrawal}
          onOpenSpendingLimits={onOpenSpendingLimits}
        />
      )}

      {/* MODAL 1: Create / Upload Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-md w-full gold-glow text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-playfair text-lg font-bold text-[#F7E7C1] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">add_circle</span>
                Nueva Publicación Mística
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePostSubmit} className="space-y-4 text-xs text-[#F7E7C1]">
              {/* Media Type Selector */}
              <div>
                <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Tipo de Formato</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPostMediaType('video');
                      setPostMediaUrl('https://assets.mixkit.co/videos/preview/mixkit-hands-shuffling-a-deck-of-tarot-cards-43403-large.mp4');
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                      postMediaType === 'video' ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37]' : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">videocam</span>
                    <span>Vídeo Reel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPostMediaType('image');
                      setPostMediaUrl('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800');
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                      postMediaType === 'image' ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37]' : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">image</span>
                    <span>Imagen / Foto</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Título de la Publicación</label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Ej. Revelaciones del tarot para la Luna Nueva ✨"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Enlace / URL de Multimedia</label>
                <input
                  type="url"
                  required
                  value={postMediaUrl}
                  onChange={(e) => setPostMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
                />
                
                {/* Presets quick select */}
                <div className="flex gap-2 mt-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[9px] text-[#A7A7A7]">Muestras:</span>
                  <button
                    type="button"
                    onClick={() => setPostMediaUrl('https://assets.mixkit.co/videos/preview/mixkit-hands-shuffling-a-deck-of-tarot-cards-43403-large.mp4')}
                    className="text-[9px] text-[#D4AF37] underline"
                  >
                    Vídeo Tarot
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostMediaUrl('https://assets.mixkit.co/videos/preview/mixkit-starry-sky-at-night-4286-large.mp4')}
                    className="text-[9px] text-[#D4AF37] underline"
                  >
                    Vídeo Cosmos
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostMediaUrl('https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800')}
                    className="text-[9px] text-[#D4AF37] underline"
                  >
                    Imagen Mística
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Categoría</label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value as Category)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#A7A7A7] block mb-1">Descripción & Hashtags</label>
                <textarea
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="Escribe el mensaje o significado celestial..."
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37] h-20"
                />
              </div>

              {/* Premium Lock Toggle */}
              <div className="p-3 bg-[#2E1B47]/40 border border-[#D4AF37]/30 rounded-2xl space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-[#D4AF37] block">🔒 ¿Contenido Exclusivo Premium?</span>
                    <span className="text-[10px] text-[#A7A7A7]">Requiere que los usuarios paguen monedas para desbloquearlo</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={postIsPremium}
                    onChange={(e) => setPostIsPremium(e.target.checked)}
                    className="accent-[#D4AF37] w-4 h-4"
                  />
                </label>

                {postIsPremium && (
                  <div className="pt-2">
                    <label className="text-[10px] text-[#A7A7A7] block mb-1">Precio de Desbloqueo (Monedas)</label>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={postPriceCoins}
                      onChange={(e) => setPostPriceCoins(Number(e.target.value))}
                      className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingPost}
                className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all"
              >
                {isSubmittingPost ? 'Publicando...' : 'Publicar Ahora ✨'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0911]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 max-w-md w-full gold-glow text-left space-y-4">
            <div className="flex justify-between items-center border-b border-[#D4AF37]/20 pb-3">
              <h3 className="font-playfair text-lg font-bold text-[#F7E7C1]">Editar Perfil Social</h3>
              <button onClick={() => setShowEditProfileModal(false)} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs text-[#F7E7C1]">
              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre de Usuario (@handle)</label>
                <input
                  type="text"
                  required
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Biografía</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1] h-16"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">URL Avatar (Foto de Perfil)</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">URL Imagen de Portada</label>
                <input
                  type="url"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 bg-[#2E1B47] text-[#A7A7A7] font-bold py-3 rounded-full text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
