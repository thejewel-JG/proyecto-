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
  const [bookingTarotista, setBookingTarotista] = useState<TarotistaProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

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

  const handleUpdateProfile = async (updatedData: { name: string; handle: string; bio: string; avatar: string; coverImage: string }) => {
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
        alert('Perfil actualizado correctamente.');
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

  // Filtered Tarotista Directory for Explore view
  const filteredTarotistas = tarotistaProfiles.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.professionalName.toLowerCase().includes(q) ||
      p.specialties.some(s => s.toLowerCase().includes(q)) ||
      p.bio.toLowerCase().includes(q)
    );
  });

  const selectedTarotista = tarotistaProfiles.find(p => p.id === selectedTarotistaId);
  const activeStream = liveStreams[0] || null;
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
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenAdmin={() => {
          if (currentUser?.role === 'admin') {
            setActiveTab('profile');
            setSelectedTarotistaId(null);
          }
        }}
      />

      {/* Main Body Layout Container */}
      <div className="pt-24 pb-20 px-2 sm:px-4 max-w-5xl mx-auto min-h-screen">
        {/* VIEW 1: Active 1:1 Consultation Room */}
        {activeConsultation ? (
          <ConsultationRoomView
            consultation={activeConsultation}
            onTransitionStatus={handleTransitionStatus}
            onSubmitReview={handleSubmitReview}
            onClose={() => setActiveConsultationId(null)}
          />
        ) : selectedTarotista ? (
          /* VIEW 2: Tarotista Public Profile Detail */
          <TarotistaProfileView
            profile={selectedTarotista}
            onBack={() => setSelectedTarotistaId(null)}
            onBookConsultation={(id) => {
              if (!currentUser) {
                setShowAuthModal(true);
                return;
              }
              const tar = tarotistaProfiles.find(t => t.id === id);
              if (tar) setBookingTarotista(tar);
            }}
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
                onLikeVideo={handleLikeVideo}
                onUnlockVideo={handleUnlockVideo}
                onBookConsultation={(tarotistaId) => {
                  if (!currentUser) {
                    setShowAuthModal(true);
                    return;
                  }
                  const tar = tarotistaProfiles.find(t => t.id === tarotistaId);
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
              />
            )}

            {activeTab === 'explore' && (
              <div className="space-y-6 max-w-2xl mx-auto pb-12">
                <div className="bg-[#1A1026] border border-[#D4AF37]/30 rounded-full px-4 py-2.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-lg">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar tarotistas, carta astral, runas..."
                    className="bg-transparent flex-1 text-xs text-[#F7E7C1] outline-none"
                  />
                </div>

                <h2 className="font-playfair text-lg font-bold text-[#D4AF37] flex items-center gap-2">
                  <span className="material-symbols-outlined">auto_awesome</span>
                  Tarotistas Verificados KABALY
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTarotistas.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTarotistaId(t.id)}
                      className="glass-card p-4 rounded-3xl border border-[#D4AF37]/30 flex items-center gap-4 cursor-pointer hover:border-[#D4AF37] transition-all group"
                    >
                      <img src={t.avatar} alt={t.professionalName} className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37] group-hover:scale-105 transition-transform" />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-playfair font-bold text-sm text-[#F7E7C1]">{t.professionalName}</h3>
                          {t.isVerified && (
                            <span className="material-symbols-outlined text-xs text-[#D4AF37] filled" title="Verificado">verified</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#D4AF37]">{t.specialties.slice(0, 2).join(' • ')}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-[#A7A7A7]">
                          <span className="flex items-center gap-0.5 text-[#D4AF37]">
                            <span className="material-symbols-outlined text-xs filled">star</span>
                            {t.ratingAverage}
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
                    onCreatePost={async () => {}}
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
          if (tab === 'profile' && !currentUser) {
            setIsGuestExploring(false);
            setShowAuthModal(true);
            return;
          }
          setSelectedTarotistaId(null);
          setActiveConsultationId(null);
          setActiveTab(tab);
        }}
        hasActiveLiveStream={!!activeStream}
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
          onUpdateLimits={async (daily, weekly) => {
            setShowSpendingLimits(false);
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
    </div>
  );
};

export default App;
