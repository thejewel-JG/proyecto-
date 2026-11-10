import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, User, TarotistaProfile, Category, StoryGroup } from '../types';
import { StoriesBar } from './StoriesBar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import { StoryViewersModal } from './StoryViewersModal';
import { CommentsDrawer } from './CommentsDrawer';

interface FeedViewProps {
  videos?: Video[];
  currentUser: User | null;
  tarotistaProfiles: TarotistaProfile[];
  activeCategory?: Category;
  initialPostId?: string | null;
  onLikeVideo?: (videoId: string) => void;
  onUnlockVideo: (videoId: string) => void;
  onBookConsultation: (tarotistaId: string) => void;
  onViewTarotistaProfile: (tarotistaId: string) => void;
  onOpenWallet: () => void;
  onOpenAuthModal?: () => void;
  onOpenCreatePost?: () => void;
  onSelectHashtag?: (tag: string) => void;
}

const ZODIAC_CARDS = [
  { sign: 'Aries', glyph: '♈', element: 'Fuego', message: 'La Luna activa tu liderazgo. Momento perfecto para dar el primer paso en proyectos audaces.' },
  { sign: 'Tauro', glyph: '♉', element: 'Tierra', message: 'Venus bendice tus finanzas y estabilidad emocional. Confía en tu valor interior.' },
  { sign: 'Géminis', glyph: '♊', element: 'Aire', message: 'Mercurio abre portales de comunicación clara. Una conversación reveladora transformará tu día.' },
  { sign: 'Cáncer', glyph: '♋', element: 'Agua', message: 'Intuición en su punto más alto. Escucha los susurros de tus sueños y protege tu energía.' },
  { sign: 'Leo', glyph: '♌', element: 'Fuego', message: 'El Sol ilumina tu carisma natural. Atrae abundancia y reconocimiento en tu entorno.' },
  { sign: 'Virgo', glyph: '♍', element: 'Tierra', message: 'Orden y discernimiento espiritual. Encuentra armonía liberando cargas ajenas.' },
  { sign: 'Libra', glyph: '♎', element: 'Aire', message: 'Equilibrio cósmico en tus relaciones. Nuevas alianzas traen paz y crecimiento.' },
  { sign: 'Escorpio', glyph: '♏', element: 'Agua', message: 'Transformación profunda y renacimiento. Suelta lo viejo para recibir poder renovado.' },
  { sign: 'Sagitario', glyph: '♐', element: 'Fuego', message: 'Expansión de horizontes y viajes astrales. La fortuna favorece a los optimistas.' },
  { sign: 'Capricornio', glyph: '♑', element: 'Tierra', message: 'Construcción sólida de tus metas más elevadas. Tu esfuerzo rinde frutos duraderos.' },
  { sign: 'Acuario', glyph: '♒', element: 'Aire', message: 'Innovación y destellos de genialidad intuitiva. Conecta con tu tribu de almas afines.' },
  { sign: 'Piscis', glyph: '♓', element: 'Agua', message: 'Misticismo puro y conexión con los planos sutiles. La magia se manifiesta en cada detalle.' },
];

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  tarotistaProfiles,
  activeCategory = 'Para ti',
  initialPostId,
  onUnlockVideo,
  onBookConsultation,
  onViewTarotistaProfile,
  onOpenWallet,
  onOpenAuthModal,
  onOpenCreatePost,
}) => {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'inicio' | 'oraculos' | 'directos' | 'horoscopo' | 'explorar'>('inicio');

  // Feed posts state
  const [posts, setPosts] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [favoritesMap, setFavoritesMap] = useState<Record<string, boolean>>({});

  // Interactive Quick Modals
  const [activeModal, setActiveModal] = useState<'carta_dia' | 'rituales' | 'compatibilidad' | 'tirada_express' | 'horoscopo' | null>(null);
  const [selectedZodiac, setSelectedZodiac] = useState<typeof ZODIAC_CARDS[0] | null>(null);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [expressCards, setExpressCards] = useState<{ past: string; present: string; future: string } | null>(null);

  // Stories state
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<StoryGroup | null>(null);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [viewersStoryId, setViewersStoryId] = useState<string | null>(null);

  // Desbloqueo
  const [confirmingUnlockPost, setConfirmingUnlockPost] = useState<Video | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Cargar stories
  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories');
      if (res.ok) {
        const data = await res.json();
        setStoryGroups(data.groups || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Cargar publicaciones
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts?limit=15');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchStories();
    fetchPosts();
  }, [fetchStories, fetchPosts]);

  const toggleFavorite = (tarId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoritesMap(prev => ({ ...prev, [tarId]: !prev[tarId] }));
  };

  const handleInitiateUnlock = (post: Video) => {
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    const cost = post.priceCoins || 100;
    if (currentUser.coinsBalance < cost) {
      alert(`Saldo insuficiente. Tienes ${currentUser.coinsBalance} monedas y necesitas ${cost} monedas.`);
      onOpenWallet();
      return;
    }
    setConfirmingUnlockPost(post);
  };

  const handleConfirmUnlock = async () => {
    if (!confirmingUnlockPost || !currentUser || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(confirmingUnlockPost.id)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.newBalance !== undefined) {
        currentUser.coinsBalance = data.newBalance;
      }
      setPosts(prev => prev.map(p => p.id === confirmingUnlockPost.id ? { ...p, hasUnlocked: true } : p));
      onUnlockVideo(confirmingUnlockPost.id);
      setConfirmingUnlockPost(null);
    } catch (err: any) {
      alert(err.message || 'Error al desbloquear');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUser) {
      onOpenAuthModal?.();
      return;
    }
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(postId)}/like`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: data.likes, isLikedByCurrentUser: data.isLikedByCurrentUser } : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Featured Tarotistas (Ensure Luna Astral, El Caminante, Madame Sol appear with exact data)
  const featuredOracles = [
    {
      id: 'tar_1',
      userId: 'usr_tarotista_1',
      name: 'Luna Astral',
      specialty: 'Tarot · Astrología',
      rating: '5.0',
      reviews: 326,
      priceEur: 1.50,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
      online: true,
    },
    {
      id: 'tar_2',
      userId: 'usr_tarotista_2',
      name: 'El Caminante',
      specialty: 'Tarot · Runas',
      rating: '4.9',
      reviews: 212,
      priceEur: 1.20,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
      online: true,
    },
    {
      id: 'tar_3',
      userId: 'usr_tarotista_3',
      name: 'Madame Sol',
      specialty: 'Vidente · Numerología',
      rating: '5.0',
      reviews: 418,
      priceEur: 1.80,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
      online: true,
    },
  ];

  const currentVideo = posts[currentIndex] || null;

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-16">
      {/* 1. TOP HORIZONTAL CATEGORY PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
        {[
          { id: 'inicio', label: 'Inicio', icon: 'home' },
          { id: 'oraculos', label: 'Oráculos', icon: 'style' },
          { id: 'directos', label: 'Directos', icon: 'sensors' },
          { id: 'horoscopo', label: 'Horóscopo', icon: 'auto_awesome' },
          { id: 'explorar', label: 'Explorar', icon: 'explore' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#231338] text-[#F7E7C1] border border-[#E5B54F] shadow-[0_0_12px_rgba(229,181,79,0.35)] font-bold'
                  : 'bg-[#140B22]/70 text-[#A09BAE] border border-white/5 hover:border-white/20 hover:text-[#F7E7C1]'
              }`}
            >
              <span className={`material-symbols-outlined text-sm ${isActive ? 'text-[#E5B54F]' : 'text-[#A09BAE]'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. HERO BANNER: "Tu guía espiritual siempre contigo" */}
      <div className="relative rounded-3xl overflow-hidden border border-[#E5B54F]/30 shadow-2xl group">
        {/* Background Image: Celestial hands holding radiant cosmic orb with zodiac wheel */}
        <div className="h-44 sm:h-52 w-full relative overflow-hidden bg-[#160B24]">
          <img
            src="https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80"
            alt="Guía Espiritual"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-75"
          />
          {/* Celestial aura overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0C0616]/95 via-[#0C0616]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0616] via-transparent to-transparent" />
        </div>

        {/* Content on Banner */}
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="space-y-1 max-w-[280px] sm:max-w-xs">
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-[#F7E7C1] leading-tight text-gold-glow">
              Tu guía espiritual siempre contigo
            </h2>
            <p className="text-[11px] sm:text-xs text-[#D8CEF0]/90">
              Tarot · Astrología · Rituales · Predicciones
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setActiveSubTab('oraculos')}
              className="gold-gradient-btn px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
            >
              <span>Explorar oráculos</span>
              <span className="text-sm">→</span>
            </button>

            {/* Carousel Dots */}
            <div className="flex items-center gap-1.5 pr-2">
              <span className="w-2 h-2 rounded-full bg-[#E5B54F] shadow-[0_0_6px_#E5B54F]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION: "Oráculos destacados" (Ver todos →) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-cinzel text-sm sm:text-base font-bold text-[#F7E7C1] tracking-wide">
            Oráculos destacados
          </h3>
          <button
            onClick={() => setActiveSubTab('oraculos')}
            className="text-xs text-[#E5B54F] hover:text-[#F7E7C1] font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Ver todos</span>
            <span className="text-sm">→</span>
          </button>
        </div>

        {/* Horizontal Carousel of Tarotista Cards */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
          {featuredOracles.map((tar) => (
            <div
              key={tar.id}
              onClick={() => onViewTarotistaProfile(tar.userId)}
              className="w-40 sm:w-44 shrink-0 bg-[#160B24] border border-[#E5B54F]/25 hover:border-[#E5B54F] rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-lg cursor-pointer group"
            >
              {/* Photo with heart favorite button on top right */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-[#120B1D]">
                <img
                  src={tar.avatar}
                  alt={tar.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Heart Favorite Button */}
                <button
                  onClick={(e) => toggleFavorite(tar.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white hover:text-red-400 transition-colors"
                >
                  <span className={`text-xs ${favoritesMap[tar.id] ? 'text-red-500 font-bold' : ''}`}>
                    {favoritesMap[tar.id] ? '♥' : '♡'}
                  </span>
                </button>

                {/* Online Indicator Badge */}
                <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm border border-emerald-500/40 text-emerald-400 text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>En línea</span>
                </span>
              </div>

              {/* Tarotista Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#E5B54F] font-semibold">
                  <span>★</span>
                  <span className="text-[#F7E7C1] font-bold">{tar.rating}</span>
                  <span className="text-[#A09BAE] text-[10px]">({tar.reviews})</span>
                </div>
                <h4 className="font-cinzel text-xs font-bold text-[#F7E7C1] truncate">
                  {tar.name}
                </h4>
                <p className="text-[10px] text-[#A09BAE] truncate">
                  {tar.specialty}
                </p>

                {/* Golden Price CTA button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookConsultation(tar.id);
                  }}
                  className="w-full mt-1.5 py-1.5 rounded-full bg-[#E5B54F]/15 border border-[#E5B54F]/40 hover:bg-[#E5B54F] text-[#E5B54F] hover:text-[#120B1D] text-[10px] font-bold transition-all"
                >
                  Desde {tar.priceEur.toFixed(2)} €/min
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SECTION: MYSTIC QUICK ACTIONS (Grid 4) */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { id: 'carta_dia', label: 'Carta del día', icon: 'style' },
          { id: 'rituales', label: 'Rituales', icon: 'local_fire_department' },
          { id: 'compatibilidad', label: 'Compatibilidad', icon: 'favorite' },
          { id: 'tirada_express', label: 'Tirada express', icon: 'view_carousel' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'tirada_express') {
                setExpressCards({
                  past: 'II · La Sacerdotisa (Sabiduría Oculta)',
                  present: 'X · La Rueda de la Fortuna (Giro del Destino)',
                  future: 'XVII · La Estrella (Iluminación & Esperanza)'
                });
              }
              setActiveModal(item.id as any);
            }}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#160B24] border border-[#E5B54F]/25 hover:border-[#E5B54F] hover:bg-[#201032] transition-all duration-200 group shadow-md"
          >
            <div className="w-9 h-9 rounded-full bg-[#24133A] border border-[#E5B54F]/30 flex items-center justify-center text-[#E5B54F] group-hover:scale-110 transition-transform mb-1.5 shadow-sm">
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
            </div>
            <span className="text-[10px] font-medium text-[#F7E7C1]/90 text-center leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* 5. SECTION: "Tu horóscopo de hoy" (Ver todos →) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-cinzel text-sm sm:text-base font-bold text-[#F7E7C1] tracking-wide">
            Tu horóscopo de hoy
          </h3>
          <button
            onClick={() => setActiveSubTab('horoscopo')}
            className="text-xs text-[#E5B54F] hover:text-[#F7E7C1] font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Ver todos</span>
            <span className="text-sm">→</span>
          </button>
        </div>

        {/* Horizontal Zodiac Sign Cards */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {ZODIAC_CARDS.map((z) => (
            <button
              key={z.sign}
              onClick={() => {
                setSelectedZodiac(z);
                setActiveModal('horoscopo');
              }}
              className="w-20 sm:w-24 shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl bg-[#160B24] border border-[#E5B54F]/25 hover:border-[#E5B54F] hover:bg-[#241438] transition-all group shadow-sm"
            >
              <span className="text-2xl text-[#E5B54F] group-hover:scale-125 transition-transform duration-300">
                {z.glyph}
              </span>
              <span className="text-xs font-semibold text-[#F7E7C1] mt-1">
                {z.sign}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. COMMUNITY FEED: StoriesBar + Community Posts */}
      <div className="pt-2 space-y-4">
        {/* Stories Bar */}
        <StoriesBar
          storyGroups={storyGroups}
          currentUser={currentUser}
          onSelectGroup={(g) => setSelectedStoryGroup(g)}
          onCreateStory={() => {
            if (!currentUser) {
              onOpenAuthModal?.();
              return;
            }
            setShowCreateStoryModal(true);
          }}
        />

        {/* Publications Stream */}
        <div className="space-y-4">
          <h3 className="font-cinzel text-sm font-bold text-[#E5B54F] uppercase tracking-wider flex items-center gap-2">
            <span>✦</span>
            <span>Visiones & Transmisiones de la Comunidad</span>
          </h3>

          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-3xl overflow-hidden bg-[#140B22] border border-[#E5B54F]/20 shadow-xl space-y-3 p-4"
            >
              {/* Post Author Header */}
              <div className="flex items-center justify-between">
                <div
                  onClick={() => onViewTarotistaProfile(post.tarotistaId)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full story-ring p-[2px]">
                    <img
                      src={post.tarotistaAvatar}
                      alt={post.tarotistaName}
                      className="w-full h-full rounded-full object-cover bg-[#0B0911]"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F7E7C1] group-hover:text-[#E5B54F] transition-colors flex items-center gap-1">
                      <span>{post.tarotistaName}</span>
                      {post.isVerified && (
                        <span className="material-symbols-outlined text-[14px] text-[#E5B54F] filled">verified</span>
                      )}
                    </h4>
                    <span className="text-[10px] text-[#A09BAE]">✦ {post.category}</span>
                  </div>
                </div>

                <button
                  onClick={() => onViewTarotistaProfile(post.tarotistaId)}
                  className="text-[11px] text-[#E5B54F] border border-[#E5B54F]/40 hover:bg-[#E5B54F] hover:text-[#120B1D] font-bold px-3 py-1 rounded-full transition-all"
                >
                  Consultar
                </button>
              </div>

              {/* Media Container */}
              <div className="relative aspect-[9/12] w-full rounded-2xl overflow-hidden bg-black border border-white/5">
                {post.mediaType === 'video' ? (
                  <video
                    src={post.videoUrl}
                    poster={post.thumbnailUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={post.thumbnailUrl || post.videoUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Post Caption & Actions */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1 text-xs font-bold transition-transform active:scale-90 ${
                        post.isLikedByCurrentUser ? 'text-red-400' : 'text-[#F7E7C1] hover:text-[#E5B54F]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {post.isLikedByCurrentUser ? 'favorite' : 'favorite_border'}
                      </span>
                      <span>{post.likes}</span>
                    </button>

                    <button
                      onClick={() => setShowCommentsModal(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#F7E7C1] hover:text-[#E5B54F]"
                    >
                      <span className="material-symbols-outlined text-lg">chat_bubble_outline</span>
                      <span>{post.commentsCount}</span>
                    </button>
                  </div>

                  {post.isExclusive && !post.hasUnlocked && (
                    <button
                      onClick={() => handleInitiateUnlock(post)}
                      className="gold-gradient-btn px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"
                    >
                      <span>Desbloquear Arcano ({post.priceCoins || 100} 🪙)</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-[#D8CEF0] leading-relaxed">
                  <strong className="text-[#F7E7C1] mr-1.5">{post.title}:</strong>
                  {post.description || 'Canalización de luz y guía para este ciclo estelar.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== INTERACTIVE MODALS ==================== */}

      {/* MODAL 1: CARTA DEL DÍA */}
      {activeModal === 'carta_dia' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-sm w-full border border-[#E5B54F]/40 text-center space-y-4">
            <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">Carta Astral del Día</h3>
            <div
              onClick={() => setCardRevealed(true)}
              className="aspect-[2/3] w-48 mx-auto rounded-2xl bg-gradient-to-tr from-[#1E1032] via-[#2A1448] to-[#140A24] border-2 border-[#E5B54F] p-4 flex flex-col items-center justify-center cursor-pointer shadow-[0_0_25px_rgba(229,181,79,0.3)] transition-transform hover:scale-105"
            >
              {cardRevealed ? (
                <div className="space-y-2 animate-fade-in">
                  <span className="text-4xl text-[#E5B54F]">🎴</span>
                  <h4 className="font-cinzel text-sm font-bold text-[#F7E7C1]">XVII · La Estrella</h4>
                  <p className="text-[11px] text-[#D8CEF0] leading-relaxed">
                    Renovación espiritual, serenidad y confianza en el destino. Todo lo que intencionas hoy florecerá en armonía.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-3xl text-[#E5B54F] animate-pulse">✦</span>
                  <p className="text-xs text-[#E5B54F] font-bold uppercase tracking-wider">
                    Toca para Revelar tu Arcano
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => { setActiveModal(null); setCardRevealed(false); }}
              className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
            >
              Cerrar Templo
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: RITUALES */}
      {activeModal === 'rituales' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-sm w-full border border-[#E5B54F]/40 space-y-3">
            <div className="text-center">
              <span className="material-symbols-outlined text-3xl text-[#E5B54F]">local_fire_department</span>
              <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">Ritual de Purificación de Hoy</h3>
            </div>
            <div className="space-y-2 text-xs text-[#D8CEF0] leading-relaxed bg-[#160B24] p-3.5 rounded-2xl border border-white/5">
              <p><strong>1. Vela Blanca:</strong> Enciende una vela consagrada al arcángel Miguel para disolver ataduras.</p>
              <p><strong>2. Salvia o Palo Santo:</strong> Ahuma las cuatro esquinas de tu hogar en sentido horario.</p>
              <p><strong>3. Decreto Sagrado:</strong> "Que la luz divina habite en mí y disuelva toda discordia. Así es, hecho está."</p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
            >
              Entendido ✦
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPATIBILIDAD */}
      {activeModal === 'compatibilidad' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-sm w-full border border-[#E5B54F]/40 space-y-3 text-center">
            <span className="material-symbols-outlined text-3xl text-[#E5B54F]">favorite</span>
            <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">Sinastría Elemental</h3>
            <p className="text-xs text-[#A09BAE]">
              La afinidad astrológica se activa automáticamente con los perfiles de oráculos y buscadores según sus signos solares y ascendentes.
            </p>
            <div className="p-3 bg-[#160B24] rounded-2xl border border-[#E5B54F]/25 text-xs text-[#E5B54F] font-semibold">
              ✦ Tu afinidad cósmica con Luna Astral es del 96% (Fuego + Aire).
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: TIRADA EXPRESS */}
      {activeModal === 'tirada_express' && expressCards && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-md w-full border border-[#E5B54F]/40 space-y-3.5 text-center">
            <h3 className="font-cinzel text-base font-bold text-[#F7E7C1]">Tirada Express (3 Cartas)</h3>
            <div className="grid grid-cols-3 gap-2 text-left">
              <div className="p-2.5 rounded-xl bg-[#160B24] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#E5B54F] uppercase font-bold">Pasado</span>
                <p className="text-xs font-bold text-[#F7E7C1]">{expressCards.past}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#160B24] border border-[#E5B54F]/40 space-y-1">
                <span className="text-[10px] text-[#E5B54F] uppercase font-bold">Presente</span>
                <p className="text-xs font-bold text-[#F7E7C1]">{expressCards.present}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#160B24] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#E5B54F] uppercase font-bold">Futuro</span>
                <p className="text-xs font-bold text-[#F7E7C1]">{expressCards.future}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
            >
              Aceptar Mensaje Sagrado
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: HORÓSCOPO DEL SIGNO SELECCIONADO */}
      {activeModal === 'horoscopo' && selectedZodiac && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-sm w-full border border-[#E5B54F]/40 space-y-3 text-center">
            <span className="text-4xl text-[#E5B54F]">{selectedZodiac.glyph}</span>
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">
              Horóscopo para {selectedZodiac.sign}
            </h3>
            <span className="text-[10px] text-[#E5B54F] font-bold uppercase tracking-wider block">
              Elemento {selectedZodiac.element}
            </span>
            <p className="text-xs text-[#D8CEF0] leading-relaxed bg-[#160B24] p-3.5 rounded-2xl border border-white/10">
              "{selectedZodiac.message}"
            </p>
            <button
              onClick={() => setActiveModal(null)}
              className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
            >
              Sintonizar
            </button>
          </div>
        </div>
      )}

      {/* Comments Drawer */}
      {showCommentsModal && currentVideo && (
        <CommentsDrawer
          isOpen={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          videoId={currentVideo.id}
          currentUser={currentUser}
          onOpenAuthModal={onOpenAuthModal}
        />
      )}

      {/* Story Viewer Modal */}
      {selectedStoryGroup && (
        <StoryViewerModal
          storyGroup={selectedStoryGroup}
          currentUser={currentUser}
          onClose={() => setSelectedStoryGroup(null)}
          onViewProfile={(userId) => {
            setSelectedStoryGroup(null);
            onViewTarotistaProfile(userId);
          }}
          onOpenAuthModal={onOpenAuthModal}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStoryModal && (
        <CreateStoryModal
          isOpen={showCreateStoryModal}
          currentUser={currentUser}
          onClose={() => setShowCreateStoryModal(false)}
          onCreated={() => {
            setShowCreateStoryModal(false);
            fetchStories();
          }}
        />
      )}
    </div>
  );
};
