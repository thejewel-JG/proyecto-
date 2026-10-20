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
import { OnboardingModal } from './components/OnboardingModal';
import { SpendingLimitsModal } from './components/SpendingLimitsModal';
import { BookConsultationModal } from './components/BookConsultationModal';

export const App: React.FC = () => {
  // App state
  const [users, setUsers] = useState<User[]>([]);
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

  // Active User State
  const [currentUserId, setCurrentUserId] = useState<string>('usr_cliente_1');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showSpendingLimits, setShowSpendingLimits] = useState<boolean>(false);
  const [bookingTarotista, setBookingTarotista] = useState<TarotistaProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

  // Load state from backend server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setUsers(data.users || []);
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

  const currentUser = users.find(u => u.id === currentUserId) || users[0] || {
    id: 'usr_cliente_1',
    name: 'Elena Pastor',
    email: 'elena@gmail.com',
    role: 'cliente',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    coinsBalance: 1240,
    isAgeVerified: true,
    spentToday: 0,
    spentThisWeek: 45,
    createdAt: new Date().toISOString(),
  };

  // Role switcher handler
  const handleSwitchRole = (role: 'cliente' | 'tarotista' | 'admin') => {
    if (role === 'admin') {
      const admin = users.find(u => u.role === 'admin');
      if (admin) setCurrentUserId(admin.id);
      setActiveTab('profile');
      setSelectedTarotistaId(null);
      return;
    }

    if (role === 'tarotista') {
      const tarotistaUser = users.find(u => u.role === 'tarotista');
      if (tarotistaUser) {
        setCurrentUserId(tarotistaUser.id);
      } else {
        setShowOnboarding(true);
      }
      return;
    }

    const clientUser = users.find(u => u.role === 'cliente');
    if (clientUser) setCurrentUserId(clientUser.id);
  };

  // Video Actions
  const handleLikeVideo = async (videoId: string) => {
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
    try {
      const res = await fetch(`/api/videos/${videoId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
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
    try {
      const res = await fetch(`/api/streams/${streamId}/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, giftId }),
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
    try {
      const res = await fetch(`/api/streams/${streamId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, durationMinutes, consultationType: type }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Consultation Actions
  const handleConfirmBooking = async (type: 'chat' | 'audio' | 'video', durationMinutes: number) => {
    if (!bookingTarotista) return;

    try {
      const res = await fetch('/api/consultations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentUser.id,
          tarotistaId: bookingTarotista.id,
          type,
          durationMinutes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBookingTarotista(null);
        setActiveConsultationId(data.consultation.id);
        await fetchState();
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

  // Wallet Actions
  const handleTopupCoins = async (packageId: string, paymentMethod: 'apple_pay' | 'stripe') => {
    try {
      const res = await fetch('/api/coins/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, packageId, paymentMethod }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        alert(`¡Recarga completada! Has recibido ${data.package.coins} Monedas Astrales en tu monedero.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestWithdrawal = async (amountEur: number, vatNumber: string, bankIban: string) => {
    const profile = tarotistaProfiles.find(p => p.userId === currentUser.id);
    if (!profile) return;

    try {
      const res = await fetch('/api/tarotistas/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarotistaProfileId: profile.id,
          amountEur,
          vatNumber,
          bankIban,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        alert('Solicitud de retiro y justificante fiscal procesados correctamente.');
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePost = async (postData: {
    title: string;
    mediaUrl: string;
    mediaType: 'video' | 'image';
    category: Category;
    isPremium: boolean;
    priceCoins?: number;
    description: string;
  }) => {
    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, ...postData }),
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

  const handleUpdateProfile = async (updatedData: { name: string; handle: string; bio: string; avatar: string; coverImage: string }) => {
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, ...updatedData }),
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

  // Onboarding Complete
  const handleOnboardingComplete = async (data: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setShowOnboarding(false);
        await fetchState();
        if (result.user) setCurrentUserId(result.user.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Tarotista Directory for Explore view
  const filteredTarotistas = tarotistaProfiles.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.professionalName.toLowerCase().includes(q) || p.specialties.some(s => s.toLowerCase().includes(q));
  });

  const activeStream = liveStreams[0];
  const selectedTarotista = tarotistaProfiles.find(p => p.id === selectedTarotistaId);
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
        onSwitchUserRole={handleSwitchRole}
        onOpenWallet={() => {
          setActiveTab('profile');
          setSelectedTarotistaId(null);
        }}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenAdmin={() => {
          setActiveTab('profile');
          setSelectedTarotistaId(null);
        }}
      />

      {/* Main Body Layout Container */}
      <div className="pt-24 pb-20 px-2 sm:px-4 max-w-5xl mx-auto min-h-screen">
        {/* VIEW 1: Active 1:1 Consultation Room */}
        {activeConsultation ? (
          <ConsultationRoomView
            consultation={activeConsultation}
            currentUser={currentUser}
            tarotistaProfiles={tarotistaProfiles}
            onTransitionStatus={handleTransitionStatus}
            onSubmitReview={handleSubmitReview}
            onBack={() => setActiveConsultationId(null)}
          />
        ) : selectedTarotista ? (
          /* VIEW 2: Tarotista Profile Detail View */
          <TarotistaProfileView
            profile={selectedTarotista}
            videos={videos}
            reviews={reviews}
            onBookConsultation={(tarotistaId) => {
              const prof = tarotistaProfiles.find(p => p.id === tarotistaId);
              if (prof) setBookingTarotista(prof);
            }}
            onBack={() => setSelectedTarotistaId(null)}
          />
        ) : (
          /* VIEW 3: Main Tabs (Feed, Explore, Live, Astra AI, Profile/Wallet/Admin) */
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
                  const prof = tarotistaProfiles.find(p => p.id === tarotistaId);
                  if (prof) setBookingTarotista(prof);
                }}
                onViewTarotistaProfile={(id) => setSelectedTarotistaId(id)}
                onOpenWallet={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'explore' && (
              <div className="w-full max-w-2xl mx-auto space-y-4">
                <div className="flex items-center gap-2 bg-[#1A1026] border border-[#D4AF37]/30 rounded-full px-4 py-3">
                  <span className="material-symbols-outlined text-[#D4AF37]">search</span>
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
                        <h3 className="font-playfair text-base font-bold text-[#F7E7C1] flex items-center gap-1">
                          {t.professionalName}
                          <span className="material-symbols-outlined text-xs text-[#D4AF37] filled">verified</span>
                        </h3>
                        <p className="text-[10px] text-[#A7A7A7] line-clamp-1">{t.bio}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-bold text-[#D4AF37]">€{t.pricePerMinEur.toFixed(2)}/min</span>
                          <span className="text-[10px] bg-[#5A2D82] text-[#D4AF37] px-2 py-0.5 rounded-full font-bold">
                            ★ {t.ratingAverage.toFixed(1)}
                          </span>
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
                currentUser={currentUser}
                tarotistaProfiles={tarotistaProfiles}
                gifts={gifts}
                onSendGift={handleSendGift}
                onJoinQueue={handleJoinQueue}
                onBookConsultation={(tarotistaId) => {
                  const prof = tarotistaProfiles.find(p => p.id === tarotistaId);
                  if (prof) setBookingTarotista(prof);
                }}
                onOpenWallet={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'astra_ai' && (
              <AstraAiView
                currentUser={currentUser}
                tarotistaProfiles={tarotistaProfiles}
                onBookConsultation={(tarotistaId) => {
                  const prof = tarotistaProfiles.find(p => p.id === tarotistaId);
                  if (prof) setBookingTarotista(prof);
                }}
              />
            )}

            {activeTab === 'profile' && (
              <>
                {currentUser.role === 'admin' ? (
                  <AdminPanel
                    currentUser={currentUser}
                    tarotistaProfiles={tarotistaProfiles}
                    consultations={consultations}
                    reports={reports}
                    ledger={ledger}
                    onApproveTarotista={handleApproveTarotista}
                    onResolveDispute={handleResolveDispute}
                    onBack={() => setActiveTab('feed')}
                  />
                ) : (
                  <UserProfileView
                    currentUser={currentUser}
                    videos={videos}
                    tarotistaProfiles={tarotistaProfiles}
                    coinPackages={coinPackages}
                    ledger={ledger}
                    withdrawals={withdrawals}
                    onTopup={handleTopupCoins}
                    onRequestWithdrawal={handleRequestWithdrawal}
                    onOpenSpendingLimits={() => setShowSpendingLimits(true)}
                    onCreatePost={handleCreatePost}
                    onUpdateProfile={handleUpdateProfile}
                    onSwitchUserRole={handleSwitchRole}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Fixed Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedTarotistaId(null);
          setActiveConsultationId(null);
        }}
        hasActiveLiveStream={liveStreams.some(s => s.isLive)}
      />

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      {showSpendingLimits && (
        <SpendingLimitsModal
          currentUser={currentUser}
          onSaveLimits={(daily, weekly) => {
            currentUser.spendingLimitDaily = daily;
            currentUser.spendingLimitWeekly = weekly;
            alert('Límites de gasto guardados correctamente.');
          }}
          onClose={() => setShowSpendingLimits(false)}
        />
      )}

      {bookingTarotista && (
        <BookConsultationModal
          tarotista={bookingTarotista}
          currentUser={currentUser}
          onConfirmBooking={handleConfirmBooking}
          onClose={() => setBookingTarotista(null)}
          onOpenWallet={() => {
            setBookingTarotista(null);
            setActiveTab('profile');
          }}
        />
      )}
    </div>
  );
};

export default App;
