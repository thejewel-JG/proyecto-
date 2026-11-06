import React, { useState, useEffect } from 'react';
import { 
  User, 
  TarotistaProfile, 
  Video, 
  LiveStream, 
  Consultation, 
  LedgerTransaction, 
  Review, 
  Report, 
  WithdrawalRequest, 
  CoinPackage, 
  Gift, 
  Category 
} from './types';

// Components
import { Navbar } from './components/Navbar';
import { BottomNav, MainTab } from './components/BottomNav';
import { FeedView } from './components/FeedView';
import { LiveStreamView } from './components/LiveStreamView';
import { TarotistaProfileView } from './components/TarotistaProfileView';
import { ConsultationRoomView } from './components/ConsultationRoomView';
import { WalletView } from './components/WalletView';
import { UserProfileView } from './components/UserProfileView';
import { AstraAiView } from './components/AstraAiView';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { AuthView } from './components/AuthView';
import { SpendingLimitsModal } from './components/SpendingLimitsModal';
import { BookConsultationModal } from './components/BookConsultationModal';
import { CreatePostModal } from './components/CreatePostModal';
import { MessagesView } from './components/MessagesView';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { PublicUserProfileView } from './components/PublicUserProfileView';
import { SacredFlameIcon, CrystalBallIcon, AstralCompassIcon, SolomonStarIcon } from './components/EsotericIcons';

export const App: React.FC = () => {
  // App state
  const [tarotistaProfiles, setTarotistaProfiles] = useState<TarotistaProfile[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<MainTab>('feed');
  const [activeCategory, setActiveCategory] = useState<Category>('Para ti');
  const [selectedTarotistaId, setSelectedTarotistaId] = useState<string | null>(null);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);

  // Authenticated User State (Elimina la selección automática de usuarios demo)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuestExploring, setIsGuestExploring] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSpendingLimits, setShowSpendingLimits] = useState<boolean>(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState<boolean>(false);
  const [bookingTarotista, setBookingTarotista] = useState<TarotistaProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exploreSubTab, setExploreSubTab] = useState<'todo' | 'videntes' | 'buscadores' | 'visiones' | 'hashtags'>('todo');
  const [socialSearchResults, setSocialSearchResults] = useState<{
    users: any[];
    tarotistas: TarotistaProfile[];
    posts: Video[];
    hashtags: { tag: string; count: number }[];
  }>({ users: [], tarotistas: [], posts: [], hashtags: [] });
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [initialChatUserId, setInitialChatUserId] = useState<string | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [dailyCardRevealed, setDailyCardRevealed] = useState<boolean>(false);
  const [initialPostId, setInitialPostId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('post');
    }
    return null;
  });

  // Load state from backend server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.currentUser !== undefined) {
        setCurrentUser(data.currentUser);
      }
      setTarotistaProfiles(data.tarotistaProfiles || []);
      setVideos(data.videos || []);
      setLiveStreams(data.liveStreams || []);
      setConsultations(data.consultations || []);
      setReviews(data.reviews || []);
      setLedger(data.ledger || []);
      setReports(data.reports || []);
      setWithdrawals(data.withdrawals || []);
      setCoinPackages(data.coinPackages || []);
      setGifts(data.gifts || []);
    } catch (err) {
      console.error('Error fetching state:', err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    fetchState();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setActiveTab('feed');
      await fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  // Video Actions
  const handleLikeVideo = async (videoId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, likes: data.likes, isLikedByCurrentUser: data.isLikedByCurrentUser } : v));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnlockVideo = async (videoId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/videos/${videoId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Stream Actions
  const handleSendGift = async (streamId: string, giftId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/streams/${streamId}/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinQueue = async (streamId: string, durationMinutes: number, type: 'chat' | 'audio' | 'video') => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/streams/${streamId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes, consultationType: type }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        alert(`¡Añadido a la cola celestial en posición #${data.position}!`);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Consultation Actions
  const handleBookConsultation = async (tarotistaId: string, duration: number, type: 'chat' | 'audio' | 'video') => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarotistaId, duration, type }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        setBookingTarotista(null);
        alert(`¡Consulta solicitada con éxito! Estado: ${data.consultation.status}. Fondos retenidos de forma segura en Escrow.`);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransitionStatus = async (consultationId: string, targetStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/consultations/${consultationId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus, reason }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReview = async (consultationId: string, rating: number, comment: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId, rating, comment }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        alert('¡Gracias por tu reseña verificada!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Wallet Actions (Recarga de monedas bloqueada y protegida)
  const handleTopupCoins = async (packageId: string, paymentMethod: 'apple_pay' | 'stripe') => {
    try {
      const res = await fetch('/api/coins/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'La pasarela de pago seguro aún no está disponible.');
      }
    } catch (err) {
      alert('La pasarela de pago seguro aún no está disponible.');
    }
  };

  const handleRequestWithdrawal = async (amountEur: number, vatNumber: string, bankIban: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/tarotistas/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountEur, vatNumber, bankIban }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        alert('Solicitud de retiro procesada correctamente.');
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (updatedData: {
    name: string;
    handle: string;
    bio: string;
    avatar: string;
    coverImage: string;
    sunSign?: string;
    moonSign?: string;
    risingSign?: string;
    rulingArcana?: string;
    spiritualGift?: string;
    isPrivate?: boolean;
  }) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        await fetchState();
        alert('Perfil e identidad astral actualizados correctamente.');
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Actions
  const handleApproveTarotista = async (profileId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/admin/approve-tarotista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, approve }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveDispute = async (consultationId: string, refundClient: boolean) => {
    try {
      const res = await fetch('/api/admin/resolve-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId, refundClient }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Búsqueda Global en Red Social (Usuarios, Videntes, Visiones y #Hashtags)
  useEffect(() => {
    if (activeTab !== 'explore') return;
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSocialSearchResults({
              users: data.users || [],
              tarotistas: data.tarotistas || [],
              posts: data.posts || [],
              hashtags: data.hashtags || [],
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery]);

  const activeStream = liveStreams[0] || null;

  // Contador de mensajes y notificaciones sin leer (Polling cada 10s cuando está autenticado)
  const fetchUnreadCount = async () => {
    if (!currentUser) {
      setUnreadMessagesCount(0);
      setUnreadNotificationsCount(0);
      return;
    }
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetch('/api/unread-count'),
        fetch('/api/notifications'),
      ]);
      if (msgRes.ok) {
        const data = await msgRes.json();
        setUnreadMessagesCount(data.unreadCount || 0);
      }
      if (notifRes.ok) {
        const nData = await notifRes.json();
        setUnreadNotificationsCount(nData.unreadCount || 0);
      }
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      if (!document.hidden && currentUser) {
        fetchUnreadCount();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Conectar inicio de conversación desde perfiles
  const handleStartConversation = (targetUserId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    setInitialChatUserId(targetUserId);
    setSelectedTarotistaId(null);
    setActiveTab('messages');
  };
  const activeConsultation = consultations.find(c => c.id === activeConsultationId);

  return (
    <div className="min-h-screen bg-[#0B0911] text-[#F7E7C1] font-manrope selection:bg-[#D4AF37] selection:text-[#0B0911] relative overflow-x-hidden">
      {/* Top Navigation */}
      <Navbar
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setActiveTab('feed');
          setSelectedTarotistaId(null);
        }}
        currentUser={currentUser}
        onOpenAuthModal={() => {
          setIsGuestExploring(false);
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        onOpenWallet={() => {
          if (!currentUser) {
            setShowAuthModal(true);
            return;
          }
          setActiveTab('profile');
          setSelectedTarotistaId(null);
        }}
        onOpenSearch={() => {
          setSelectedTarotistaId(null);
          setActiveTab('explore');
        }}
        onOpenAdmin={() => {
          if (currentUser?.role === 'admin') {
            setActiveTab('profile');
            setSelectedTarotistaId(null);
          }
        }}
        onOpenCreatePost={() => setShowCreatePostModal(true)}
        onOpenAstraAi={() => {
          setSelectedTarotistaId(null);
          setActiveTab('astra_ai');
        }}
        onOpenNotifications={() => {
          if (!currentUser) {
            setShowAuthModal(true);
            return;
          }
          setShowNotificationsDrawer(true);
        }}
        onOpenMessages={() => {
          if (!currentUser) {
            setShowAuthModal(true);
            return;
          }
          setSelectedTarotistaId(null);
          setActiveTab('messages');
        }}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Body Layout Container */}
      <div className="pt-16 pb-16 px-2 sm:px-4 max-w-5xl mx-auto min-h-screen">
        {/* VIEW 1: Active 1:1 Consultation Room */}
        {activeConsultation ? (
          <ConsultationRoomView
            consultation={activeConsultation}
            currentUser={currentUser || undefined}
            tarotistaProfiles={tarotistaProfiles}
            onTransitionStatus={handleTransitionStatus}
            onSubmitReview={handleSubmitReview}
            onClose={() => setActiveConsultationId(null)}
          />
        ) : selectedTarotistaId ? (
          /* VIEW 2: Universal Public Profile Detail (Clientes & Tarotistas) */
          <PublicUserProfileView
            userId={selectedTarotistaId}
            currentUser={currentUser}
            reviews={reviews}
            onBack={() => setSelectedTarotistaId(null)}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onStartConversation={handleStartConversation}
            onBookConsultation={(tarotistaProfileId) => {
              if (!currentUser) {
                setShowAuthModal(true);
                return;
              }
              const tar = tarotistaProfiles.find(t => t.id === tarotistaProfileId || t.userId === tarotistaProfileId);
              if (tar) setBookingTarotista(tar);
            }}
            onLikeVideo={handleLikeVideo}
            onUnlockVideo={handleUnlockVideo}
          />
        ) : (
          /* VIEW 3: Main Tabs or Full Auth View */
          !currentUser && !isGuestExploring ? (
            <AuthView
              onAuthSuccess={(user) => {
                handleAuthSuccess(user);
              }}
              onExploreAsGuest={() => setIsGuestExploring(true)}
            />
          ) : (
            <>
              {activeTab === 'feed' && (
                <FeedView
                  videos={videos}
                  currentUser={currentUser}
                  tarotistaProfiles={tarotistaProfiles}
                  activeCategory={activeCategory}
                  initialPostId={initialPostId}
                  onLikeVideo={handleLikeVideo}
                  onUnlockVideo={handleUnlockVideo}
                  onBookConsultation={(tarotistaId) => {
                    if (!currentUser) {
                      setShowAuthModal(true);
                      return;
                    }
                    const tar = tarotistaProfiles.find(t => t.id === tarotistaId || t.userId === tarotistaId);
                    if (tar) setBookingTarotista(tar);
                  }}
                  onViewTarotistaProfile={(tarotistaId) => setSelectedTarotistaId(tarotistaId)}
                  onOpenWallet={() => {
                    if (!currentUser) {
                      setShowAuthModal(true);
                      return;
                    }
                    setActiveTab('profile');
                  }}
                  onOpenAuthModal={() => setShowAuthModal(true)}
                  onOpenCreatePost={() => setShowCreatePostModal(true)}
                  onSelectHashtag={(tag) => {
                    setSearchQuery(tag);
                    setSelectedTarotistaId(null);
                    setActiveTab('explore');
                  }}
                />
              )}

            {activeTab === 'explore' && (
              <div className="space-y-6 max-w-3xl mx-auto pb-14">
                {/* Search Input */}
                <div className="bg-[#1A1026] border border-[#D4AF37]/35 rounded-full px-4 py-3 flex items-center gap-2.5 shadow-lg">
                  <AstralCompassIcon className="w-5 h-5 text-[#D4AF37]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar videntes, @usuarios, #hashtags, signos, tarot..."
                    className="bg-transparent flex-1 text-xs sm:text-sm text-[#F7E7C1] placeholder-[#A09BAE] outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-[#A09BAE] hover:text-white px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Banner Interactivo: Carta del Día Colectiva + Frecuencia Astral */}
                {!searchQuery && (
                  <div className="bg-gradient-to-r from-[#1A1026] via-[#241438] to-[#120D1D] border border-[#D4AF37]/40 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] flex items-center justify-center sm:justify-start gap-1">
                        ✦ Sincronicidad Colectiva de Hoy
                      </span>
                      <h3 className="font-cinzel text-base sm:text-lg font-bold text-[#F7E7C1]">
                        {dailyCardRevealed ? '🎴 XVII · La Estrella (Renovación & Claridad)' : '🎴 Descubre el Arcano Colectivo del Día'}
                      </h3>
                      <p className="text-xs text-[#A09BAE] max-w-md leading-relaxed">
                        {dailyCardRevealed
                          ? 'La energía colectiva vibra hoy en Acuario y el elemento Aire: momento ideal para manifestar intenciones, sanar vínculos y escuchar tu intuición.'
                          : 'Toca la carta sagrada para sintonizar con la frecuencia astrológica que guía hoy a la comunidad de KABALY.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setDailyCardRevealed(!dailyCardRevealed)}
                      className={`px-5 py-3 rounded-2xl border font-cinzel text-xs font-bold uppercase tracking-wider shrink-0 transition-all ${
                        dailyCardRevealed
                          ? 'bg-[#0B0911]/90 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                          : 'bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] border-transparent hover:scale-105 gold-glow'
                      }`}
                    >
                      {dailyCardRevealed ? '✦ Carta Revelada' : '🔮 Revelar Carta'}
                    </button>
                  </div>
                )}

                {/* Carrusel de Videntes en Línea Ahora Mismo */}
                {!searchQuery && tarotistaProfiles.filter(t => t.availability === 'online').length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Videntes Conectados Ahora Mismo
                      </span>
                    </div>
                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                      {tarotistaProfiles
                        .filter(t => t.availability === 'online')
                        .map((tar) => (
                          <div
                            key={tar.id}
                            onClick={() => setSelectedTarotistaId(tar.id)}
                            className="bg-[#120D1D]/90 border border-emerald-500/30 hover:border-[#D4AF37] rounded-2xl p-2.5 flex items-center gap-2.5 shrink-0 cursor-pointer transition-all"
                          >
                            <div className="relative">
                              <img src={tar.avatar} alt={tar.name} className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]" />
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B0911] absolute bottom-0 right-0" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#F7E7C1]">{tar.name}</p>
                              <span className="text-[10px] text-[#D4AF37] font-semibold">{tar.pricePerMinCoins} 🪙/min</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Trending Hashtags Pills */}
                {socialSearchResults.hashtags.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] shrink-0">
                      ✦ Tendencias:
                    </span>
                    {socialSearchResults.hashtags.slice(0, 10).map((h) => (
                      <button
                        key={h.tag}
                        onClick={() => setSearchQuery(h.tag)}
                        className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 border transition-all ${
                          searchQuery.toLowerCase() === h.tag.toLowerCase()
                            ? 'bg-[#D4AF37] text-[#0B0911] font-bold border-[#D4AF37]'
                            : 'bg-[#1A1026]/80 text-[#F7E7C1]/85 border-[#D4AF37]/25 hover:border-[#D4AF37]'
                        }`}
                      >
                        {h.tag} <span className="opacity-60 text-[10px]">({h.count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Sub-tabs de Exploración Social */}
                <div className="flex border-b border-white/10 gap-2 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'todo', label: 'Todo el Cosmos' },
                    { id: 'videntes', label: `Videntes (${socialSearchResults.tarotistas.length})` },
                    { id: 'buscadores', label: `Comunidad (${socialSearchResults.users.length})` },
                    { id: 'visiones', label: `Visiones (${socialSearchResults.posts.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setExploreSubTab(t.id as any)}
                      className={`pb-2.5 px-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                        exploreSubTab === t.id
                          ? 'border-[#D4AF37] text-[#D4AF37]'
                          : 'border-transparent text-[#A09BAE] hover:text-[#F7E7C1]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sección 1: Videntes Verificados */}
                {(exploreSubTab === 'todo' || exploreSubTab === 'videntes') && socialSearchResults.tarotistas.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-cinzel text-sm font-bold text-[#D4AF37] uppercase tracking-widest flex items-center gap-1.5">
                      <SolomonStarIcon className="w-4 h-4" />
                      <span>Videntes y Oráculos Verificados</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {socialSearchResults.tarotistas.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTarotistaId(t.id)}
                          className="glass-card p-4 rounded-3xl border border-[#D4AF37]/30 flex items-center gap-4 cursor-pointer hover:border-[#D4AF37] transition-all group"
                        >
                          <img src={t.avatar} alt={t.professionalName} className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37] group-hover:scale-105 transition-transform" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-playfair font-bold text-sm text-[#F7E7C1] truncate">{t.professionalName}</h3>
                              {t.isVerified && (
                                <span className="material-symbols-outlined text-xs text-[#D4AF37] filled" title="Verificado">verified</span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#D4AF37] truncate">{t.specialties.slice(0, 3).join(' • ')}</p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-[#A7A7A7]">
                              <span className="flex items-center gap-0.5 text-[#D4AF37]">
                                ✦ {t.ratingAverage}
                              </span>
                              <span>({t.totalReviews} reseñas)</span>
                              <span className="ml-auto font-bold text-[#F7E7C1]">{t.pricePerMinCoins} Mon/min</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sección 2: Comunidad y Buscadores Astrales (Cualquier usuario) */}
                {(exploreSubTab === 'todo' || exploreSubTab === 'buscadores') && socialSearchResults.users.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-cinzel text-sm font-bold text-[#F7E7C1] uppercase tracking-widest flex items-center gap-1.5">
                      <span>✦ Almas y Buscadores de la Comunidad</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {socialSearchResults.users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setSelectedTarotistaId(u.id)}
                          className="bg-[#120D1D]/90 p-3.5 rounded-2xl border border-white/10 hover:border-[#D4AF37]/50 flex items-center gap-3 cursor-pointer transition-all"
                        >
                          <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-full object-cover border border-[#D4AF37]/50 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-[#F7E7C1] truncate">{u.name}</p>
                              <span className="text-[10px] text-[#D4AF37] font-mono truncate">{u.handle}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-[#A09BAE]">
                              {u.sunSign && <span className="text-[#D4AF37]">☉ {u.sunSign}</span>}
                              {u.rulingArcana && <span>• 🎴 {u.rulingArcana}</span>}
                              <span className="ml-auto text-[10px] text-[#F7E7C1]/60">{u.followersCount} seg.</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sección 3: Visiones (Posts & Reels) */}
                {(exploreSubTab === 'todo' || exploreSubTab === 'visiones') && socialSearchResults.posts.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-cinzel text-sm font-bold text-[#D4AF37] uppercase tracking-widest">
                      ✦ Visiones y Publicaciones Recientes
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {socialSearchResults.posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedTarotistaId(post.tarotistaId)}
                          className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#120D1D] border border-white/10 hover:border-[#D4AF37] cursor-pointer group"
                        >
                          {post.mediaType === 'image' ? (
                            <img src={post.videoUrl || post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <video src={post.videoUrl} poster={post.thumbnailUrl} muted playsInline className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-2.5 right-2.5">
                            <p className="text-[11px] font-bold text-[#F7E7C1] line-clamp-1">{post.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-[#D4AF37] mt-0.5">
                              <span className="truncate">{post.tarotistaName}</span>
                              <span className="flex items-center gap-0.5 shrink-0">
                                <SacredFlameIcon className="w-3 h-3" filled />
                                {post.likes}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'live' && (
              <LiveStreamView
                stream={activeStream}
                currentUser={currentUser || {
                  id: 'anon',
                  name: 'Invitado',
                  email: '',
                  role: 'cliente',
                  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
                  coinsBalance: 0,
                  isAgeVerified: false,
                  spentToday: 0,
                  spentThisWeek: 0,
                  createdAt: '',
                }}
                tarotistaProfiles={tarotistaProfiles}
                gifts={gifts}
                onSendGift={handleSendGift}
                onJoinQueue={handleJoinQueue}
                onViewProfile={(uid) => setSelectedTarotistaId(uid)}
                onBookConsultation={(tarotistaId) => {
                  if (!currentUser) {
                    setShowAuthModal(true);
                    return;
                  }
                  const tar = tarotistaProfiles.find(t => t.id === tarotistaId || t.userId === tarotistaId);
                  if (tar) setBookingTarotista(tar);
                }}
                onOpenWallet={() => {
                  if (!currentUser) {
                    setShowAuthModal(true);
                    return;
                  }
                  setActiveTab('profile');
                }}
              />
            )}

            {activeTab === 'astra_ai' && (
              <AstraAiView
                currentUser={currentUser || {
                  id: 'anon',
                  name: 'Invitado',
                  email: '',
                  role: 'cliente',
                  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
                  coinsBalance: 0,
                  isAgeVerified: false,
                  spentToday: 0,
                  spentThisWeek: 0,
                  createdAt: '',
                }}
                tarotistaProfiles={tarotistaProfiles}
                onViewProfile={(id) => setSelectedTarotistaId(id)}
                onBookConsultation={(id) => {
                  if (!currentUser) {
                    setShowAuthModal(true);
                    return;
                  }
                  const tar = tarotistaProfiles.find(t => t.id === id);
                  if (tar) setBookingTarotista(tar);
                }}
              />
            )}

            {activeTab === 'messages' && (
              currentUser ? (
                <MessagesView
                  currentUser={currentUser}
                  initialTargetUserId={initialChatUserId}
                  onClearInitialTargetUser={() => setInitialChatUserId(null)}
                  onOpenProfile={(uid) => {
                    setSelectedTarotistaId(uid);
                  }}
                  onBookConsultation={(tarotistaUserId) => {
                    const tar = tarotistaProfiles.find(t => t.id === tarotistaUserId || t.userId === tarotistaUserId);
                    if (tar) setBookingTarotista(tar);
                    else setSelectedTarotistaId(tarotistaUserId);
                  }}
                  onOpenPost={(postId) => {
                    setInitialPostId(postId);
                    setActiveTab('feed');
                  }}
                />
              ) : (
                <div className="glass-card max-w-md mx-auto p-8 rounded-3xl border border-[#D4AF37]/30 text-center space-y-4 my-12">
                  <span className="material-symbols-outlined text-5xl text-[#D4AF37] gold-glow">forum</span>
                  <h3 className="font-cinzel text-xl font-bold text-[#F7E7C1]">Mensajería Privada</h3>
                  <p className="text-xs text-[#A09BAE] leading-relaxed">
                    Inicia sesión o crea tu cuenta para conectar de forma privada y segura con tarotistas y usuarios de KABALY.
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 transition-all"
                  >
                    Acceder o Registrarse
                  </button>
                </div>
              )
            )}

            {activeTab === 'profile' && (
              currentUser ? (
                currentUser.role === 'admin' ? (
                  <AdminPanel
                    tarotistaProfiles={tarotistaProfiles}
                    consultations={consultations}
                    ledger={ledger}
                    reports={reports}
                    withdrawals={withdrawals}
                    onApproveTarotista={handleApproveTarotista}
                    onResolveDispute={handleResolveDispute}
                    onBack={() => setActiveTab('feed')}
                  />
                ) : (
                  <UserProfileView
                    currentUser={currentUser}
                    tarotistaProfiles={tarotistaProfiles}
                    videos={videos}
                    consultations={consultations}
                    onSwitchUserRole={() => {}}
                    onOpenAdmin={() => {}}
                    onOpenWallet={() => {}}
                    onOpenLimitsModal={() => setShowSpendingLimits(true)}
                    onUpdateProfile={handleUpdateProfile}
                    onRefreshUser={fetchState}
                    onCreatePost={async () => {}}
                    onSelectConsultation={(id) => setActiveConsultationId(id)}
                    onViewPublicProfile={(uid) => setSelectedTarotistaId(uid)}
                    onSelectVideo={(id) => {
                      const v = videos.find(x => x.id === id);
                      if (v) {
                        setActiveCategory(v.category);
                        setActiveTab('feed');
                      }
                    }}
                  />
                )
              ) : (
                <div className="glass-card max-w-md mx-auto p-8 rounded-3xl border border-[#D4AF37]/30 text-center space-y-4 my-12">
                  <span className="material-symbols-outlined text-5xl text-[#D4AF37] gold-glow">lock</span>
                  <h3 className="font-cinzel text-xl font-bold text-[#F7E7C1]">Acceso a Perfil y Monedero</h3>
                  <p className="text-xs text-[#A7A7A7] leading-relaxed">
                    Inicia sesión o crea tu cuenta para acceder a tus consultas privadas, historial de saldo, recargas y configuración personal.
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 transition-all"
                  >
                    Iniciar Sesión o Registrarse
                  </button>
                </div>
              )
            )}
          </>
          )
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if ((tab === 'profile' || tab === 'messages') && !currentUser) {
            setIsGuestExploring(false);
            setShowAuthModal(true);
            return;
          }
          setSelectedTarotistaId(null);
          setActiveConsultationId(null);
          setActiveTab(tab);
        }}
        hasActiveLiveStream={!!activeStream}
        unreadMessagesCount={unreadMessagesCount}
        onOpenCreatePost={() => {
          if (!currentUser) {
            setShowAuthModal(true);
            return;
          }
          setShowCreatePostModal(true);
        }}
        currentUserAvatar={currentUser?.avatar}
      />

      {/* Modal: Autenticación Real (Login / Registro) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Modal: Límites de Gasto Responsable */}
      {showSpendingLimits && currentUser && (
        <SpendingLimitsModal
          currentUser={currentUser}
          onClose={() => setShowSpendingLimits(false)}
          onSaveLimits={async () => {
            setShowSpendingLimits(false);
            await fetchState();
          }}
        />
      )}

      {/* Modal: Reservar Consulta 1:1 */}
      {bookingTarotista && (
        <BookConsultationModal
          tarotista={bookingTarotista}
          currentUser={currentUser || {
            id: 'anon',
            name: 'Invitado',
            email: '',
            role: 'cliente',
            avatar: '',
            coinsBalance: 0,
            isAgeVerified: false,
            spentToday: 0,
            spentThisWeek: 0,
            createdAt: '',
          }}
          onClose={() => setBookingTarotista(null)}
          onConfirmBooking={handleBookConsultation}
          onOpenWallet={() => {
            setBookingTarotista(null);
            if (!currentUser) {
              setShowAuthModal(true);
              return;
            }
            setActiveTab('profile');
          }}
        />
      )}

      {/* Modal: Crear Publicación / Reel desde dispositivo */}
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onPostCreated={() => {
          setShowCreatePostModal(false);
          fetchState();
        }}
      />

      {/* Drawer: Ecos del Cosmos (Centro de Notificaciones) */}
      <NotificationsDrawer
        isOpen={showNotificationsDrawer}
        onClose={() => {
          setShowNotificationsDrawer(false);
          fetchUnreadCount();
        }}
        onOpenUserProfile={(uid) => {
          setShowNotificationsDrawer(false);
          setSelectedTarotistaId(uid);
        }}
        onOpenPost={(postId) => {
          setShowNotificationsDrawer(false);
          const v = videos.find(x => x.id === postId);
          if (v) {
            setSelectedTarotistaId(v.tarotistaId);
          }
        }}
      />
    </div>
  );
};

export default App;
