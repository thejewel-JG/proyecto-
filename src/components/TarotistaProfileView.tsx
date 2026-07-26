import React, { useState } from 'react';
import { TarotistaProfile, Video, Review } from '../types';

interface TarotistaProfileViewProps {
  profile: TarotistaProfile;
  videos: Video[];
  reviews: Review[];
  onBookConsultation: (tarotistaId: string) => void;
  onBack?: () => void;
}

export const TarotistaProfileView: React.FC<TarotistaProfileViewProps> = ({
  profile,
  videos,
  reviews,
  onBookConsultation,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'videos' | 'reviews' | 'shop'>('videos');

  const profileVideos = videos.filter(v => v.tarotistaId === profile.id);
  const profileReviews = reviews.filter(r => r.tarotistaId === profile.id);

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen pb-28 border-x border-[#D4AF37]/20">
      {/* Top Header Back Button */}
      {onBack && (
        <div className="fixed top-14 left-4 z-30">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#0B0911]/80 backdrop-blur-md border border-[#D4AF37]/30 text-[#F7E7C1] flex items-center justify-center hover:text-[#D4AF37]"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
        </div>
      )}

      {/* Banner Cover Image */}
      <div className="relative h-48 md:h-64 w-full overflow-hidden">
        <img src={profile.banner} alt={profile.professionalName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-black/30" />
      </div>

      {/* Profile Header Card */}
      <div className="px-4 -mt-16 relative z-10 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full border-4 border-[#D4AF37]/40 p-1 bg-[#1A1026] overflow-hidden gold-glow">
            <img src={profile.avatar} alt={profile.professionalName} className="w-full h-full object-cover rounded-full" />
          </div>
          {profile.isVerified && (
            <div className="absolute bottom-1 right-1 bg-[#D4AF37] text-[#0B0911] px-2 py-0.5 rounded-full flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg border border-[#0B0911]">
              <span className="material-symbols-outlined text-xs filled">verified</span>
              Verificado
            </div>
          )}
        </div>

        {/* Title & Bio */}
        <h2 className="font-playfair text-2xl md:text-3xl font-bold text-[#D4AF37] text-gold-glow mt-3">
          {profile.professionalName}
        </h2>
        <p className="text-xs text-[#A7A7A7] mt-0.5 tracking-wide uppercase font-semibold">
          Gran Maestra Tarotista & Guía Espiritual
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 w-full max-w-md my-6 border-y border-[#D4AF37]/20 py-4 gap-2">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[#D4AF37]">
              <span className="font-playfair text-xl font-bold">{profile.ratingAverage.toFixed(1)}</span>
              <span className="material-symbols-outlined text-sm filled">star</span>
            </div>
            <span className="text-[9px] text-[#A7A7A7] uppercase tracking-widest">{profile.totalReviews} Reseñas</span>
          </div>

          <div className="flex flex-col items-center border-x border-[#D4AF37]/20">
            <span className="font-playfair text-xl font-bold text-[#D4AF37]">{profile.totalReadings}</span>
            <span className="text-[9px] text-[#A7A7A7] uppercase tracking-widest">Consultas</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-playfair text-xl font-bold text-[#D4AF37]">
              {(profile.followersCount / 1000).toFixed(1)}k
            </span>
            <span className="text-[9px] text-[#A7A7A7] uppercase tracking-widest">Seguidores</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full max-w-md mb-6">
          <button
            onClick={() => onBookConsultation(profile.id)}
            className="flex-1 bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full flex items-center justify-center gap-2 text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">event</span>
            Reservar Consulta
          </button>
          <button 
            onClick={() => alert('Función de mensaje directo habilitada en consulta.')}
            className="px-4 py-3 rounded-full border border-[#D4AF37]/30 text-[#F7E7C1] hover:bg-[#2E1B47] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">chat_bubble</span>
          </button>
        </div>
      </div>

      {/* Specialties & Bio Section */}
      <section className="px-5 my-4">
        <h3 className="font-playfair text-lg text-[#D4AF37] mb-2 flex items-center gap-2">
          <span className="w-6 h-px bg-[#D4AF37]/40" />
          El Viaje Sagrado
        </h3>
        <p className="text-xs text-[#cec3d1] leading-relaxed">
          {profile.bio}
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {profile.specialties.map((spec, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-[#2E1B47]/60 border border-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-semibold uppercase tracking-wider"
            >
              {spec}
            </span>
          ))}
        </div>
      </section>

      {/* Content Tabs (Videos / Reviews / Shop) */}
      <section className="mt-8">
        <div className="flex border-b border-[#D4AF37]/20 px-4">
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-all ${
              activeTab === 'videos'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            VÍDEOS ({profileVideos.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-all ${
              activeTab === 'reviews'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            RESEÑAS ({profileReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-all ${
              activeTab === 'shop'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            CURSOS & TIENDA
          </button>
        </div>

        {/* Tab 1: Videos Grid */}
        {activeTab === 'videos' && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {profileVideos.map((v) => (
              <div
                key={v.id}
                className="glass-card aspect-[3/4] rounded-2xl relative overflow-hidden group cursor-pointer border border-[#D4AF37]/20"
              >
                <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0911] via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[#D4AF37] text-xs">
                  <span className="material-symbols-outlined text-sm filled">play_arrow</span>
                  <span>{v.likes}</span>
                </div>
                {v.isPremium && (
                  <div className="absolute top-2 right-2 bg-[#D4AF37] text-[#0B0911] p-1 rounded-full">
                    <span className="material-symbols-outlined text-xs font-bold">lock</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Reviews List */}
        {activeTab === 'reviews' && (
          <div className="p-4 space-y-3">
            {profileReviews.map((r) => (
              <div key={r.id} className="glass-card p-4 rounded-2xl border border-[#D4AF37]/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#5A2D82] text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                      {r.clientName.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#F7E7C1] block">{r.clientName}</span>
                      <span className="text-[9px] text-[#A7A7A7]">Consulta verificada</span>
                    </div>
                  </div>
                  <div className="flex text-[#D4AF37]">
                    {[...Array(5)].map((_, idx) => (
                      <span key={idx} className={`material-symbols-outlined text-sm ${idx < r.rating ? 'filled' : ''}`}>
                        star
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#cec3d1] italic">"{r.comment}"</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Courses & Shop */}
        {activeTab === 'shop' && (
          <div className="p-4 space-y-3">
            <div className="glass-card p-4 rounded-2xl border border-[#D4AF37]/20 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-[#5A2D82] flex items-center justify-center text-[#D4AF37]">
                <span className="material-symbols-outlined text-3xl">auto_stories</span>
              </div>
              <div className="flex-1">
                <h4 className="font-playfair text-sm text-[#F7E7C1] font-bold">Curso de Iniciación al Tarot Arcano</h4>
                <p className="text-[10px] text-[#A7A7A7]">12 Módulos en vídeo + Certificado digital</p>
                <span className="text-xs font-bold text-[#D4AF37] mt-1 block">150 Monedas (€15.00)</span>
              </div>
              <button 
                onClick={() => alert('Iniciando proceso de compra del curso')}
                className="bg-[#D4AF37] text-[#0B0911] font-bold px-3 py-1.5 rounded-full text-xs"
              >
                Comprar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Fixed Bottom Consultation Bar */}
      <div className="fixed bottom-12 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#0B0911] via-[#0B0911]/95 to-transparent">
        <div className="max-w-2xl mx-auto glass-card rounded-full p-2 pl-5 flex items-center justify-between shadow-2xl border border-[#D4AF37]/30">
          <div className="flex flex-col">
            <span className="text-[9px] text-[#A7A7A7] uppercase tracking-wider">Tarifa de consulta</span>
            <div className="flex items-baseline gap-1">
              <span className="font-playfair text-lg font-bold text-[#D4AF37]">€{profile.pricePerMinEur.toFixed(2)}</span>
              <span className="text-xs text-[#A7A7A7]">/ min ({profile.pricePerMinCoins} monedas)</span>
            </div>
          </div>
          <button
            onClick={() => onBookConsultation(profile.id)}
            className="bg-[#D4AF37] text-[#0B0911] font-bold px-6 py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-105 active:scale-95 transition-all"
          >
            Reservar Consulta
          </button>
        </div>
      </div>
    </div>
  );
};
