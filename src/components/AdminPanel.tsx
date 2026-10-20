import React, { useState } from 'react';
import { User, TarotistaProfile, Consultation, Report, LedgerTransaction } from '../types';

interface AdminPanelProps {
  currentUser: User;
  tarotistaProfiles: TarotistaProfile[];
  consultations: Consultation[];
  reports: Report[];
  ledger: LedgerTransaction[];
  onApproveTarotista: (profileId: string, approve: boolean) => void;
  onResolveDispute: (consultationId: string, refundClient: boolean) => void;
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  tarotistaProfiles,
  consultations,
  reports,
  ledger,
  onApproveTarotista,
  onResolveDispute,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'kyc' | 'disputes' | 'reports' | 'finance'>('kyc');

  const pendingKycProfiles = tarotistaProfiles.filter(p => p.kycStatus === 'pendiente');
  const disputedConsultations = consultations.filter(c => c.status === 'disputada');
  const pendingReports = reports.filter(r => r.status === 'pendiente');

  // Financial calculations
  const totalGmvEur = ledger
    .filter(t => t.type === 'topup' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amountEur, 0);

  const totalPlatformCommissionsEur = consultations
    .filter(c => c.status === 'completada')
    .reduce((sum, c) => sum + (c.platformCommissionCoins / 10), 0);

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-[#0B0911] text-[#F7E7C1] min-h-screen p-4 pb-28 border-x border-[#D4AF37]/30">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#D4AF37]/30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[#A7A7A7] hover:text-[#F7E7C1]">
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div>
            <h2 className="font-playfair text-2xl font-bold text-[#D4AF37] text-gold-glow">Panel de Control Admin</h2>
            <span className="text-xs text-[#A7A7A7]">Plataforma de Moderación, KYC & Auditoría Financiera KABALY</span>
          </div>
        </div>

        <div className="bg-[#D4AF37] text-[#0B0911] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Super-Admin Active
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="glass-card p-4 rounded-2xl border border-[#D4AF37]/30">
          <span className="text-[10px] text-[#A7A7A7] uppercase font-bold tracking-wider block mb-1">Volumen Bruto (GMV)</span>
          <span className="font-playfair text-2xl font-bold text-[#D4AF37]">€{totalGmvEur.toFixed(2)}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-[#D4AF37]/30">
          <span className="text-[10px] text-[#A7A7A7] uppercase font-bold tracking-wider block mb-1">Comisión KABALY</span>
          <span className="font-playfair text-2xl font-bold text-green-400">€{totalPlatformCommissionsEur.toFixed(2)}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-[#D4AF37]/30">
          <span className="text-[10px] text-[#A7A7A7] uppercase font-bold tracking-wider block mb-1">KYC Pendientes</span>
          <span className="font-playfair text-2xl font-bold text-yellow-400">{pendingKycProfiles.length}</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-[#D4AF37]/30">
          <span className="text-[10px] text-[#A7A7A7] uppercase font-bold tracking-wider block mb-1">Disputas Abiertas</span>
          <span className="font-playfair text-2xl font-bold text-red-400">{disputedConsultations.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D4AF37]/30 mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('kyc')}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'kyc'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          Validación KYC ({pendingKycProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab('disputes')}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'disputes'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          Centro de Disputas ({disputedConsultations.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          Reportes de Contenido ({pendingReports.length})
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`py-3 px-5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'finance'
              ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
              : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
          }`}
        >
          Comisiones & Ajustes
        </button>
      </div>

      {/* Tab 1: KYC Validation Queue */}
      {activeTab === 'kyc' && (
        <div className="space-y-4">
          {pendingKycProfiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A7A7A7] glass-card rounded-2xl">
              ¡Excelente! No hay solicitudes de verificación KYC pendientes.
            </div>
          ) : (
            pendingKycProfiles.map((p) => (
              <div key={p.id} className="glass-card p-5 rounded-3xl border border-[#D4AF37]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <img src={p.avatar} alt={p.professionalName} className="w-14 h-14 rounded-full object-cover border-2 border-[#D4AF37]" />
                  <div>
                    <h4 className="font-playfair text-base font-bold text-[#F7E7C1]">{p.professionalName}</h4>
                    <span className="text-xs text-[#A7A7A7] block">{p.country} • {p.experienceYears} años experiencia</span>
                    <span className="text-[10px] text-[#D4AF37] underline font-semibold mt-1 inline-block cursor-pointer">
                      📄 Documento de Identidad Oficial ({p.docIdentityUrl || 'Documento.pdf'})
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => onApproveTarotista(p.id, true)}
                    className="flex-1 md:flex-none bg-green-500 text-black font-bold px-4 py-2 rounded-full text-xs uppercase hover:brightness-110"
                  >
                    Aprobar KYC
                  </button>
                  <button
                    onClick={() => onApproveTarotista(p.id, false)}
                    className="flex-1 md:flex-none bg-red-500/20 border border-red-500 text-red-300 font-bold px-4 py-2 rounded-full text-xs hover:bg-red-500/30"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Dispute Resolution */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {disputedConsultations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A7A7A7] glass-card rounded-2xl">
              No hay disputas activas que requieran intervención administrativa.
            </div>
          ) : (
            disputedConsultations.map((c) => (
              <div key={c.id} className="glass-card p-5 rounded-3xl border border-red-500/40 bg-red-950/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">Disputa Registrada</span>
                    <h4 className="font-playfair text-base font-bold text-[#F7E7C1]">
                      Cliente: {c.clientName} ↔ Tarotista: {c.tarotistaName}
                    </h4>
                    <span className="text-xs text-[#A7A7A7]">
                      Importe en juego: {c.totalCoins} Monedas (€{(c.totalCoins / 10).toFixed(2)})
                    </span>
                  </div>
                  <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500 px-3 py-1 rounded-full font-bold">
                    PENDIENTE RESOLUCIÓN
                  </span>
                </div>

                <p className="text-xs text-[#F7E7C1] bg-[#0B0911] p-3 rounded-xl border border-red-500/20 mb-4 italic">
                  Motivo: "{c.disputeReason || 'Interrupción técnica de conexión o desacuerdo.'}"
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => onResolveDispute(c.id, true)}
                    className="bg-green-500 text-black font-bold px-4 py-2 rounded-full text-xs uppercase"
                  >
                    Reembolsar Monedas al Cliente
                  </button>
                  <button
                    onClick={() => onResolveDispute(c.id, false)}
                    className="bg-[#D4AF37] text-[#0B0911] font-bold px-4 py-2 rounded-full text-xs uppercase"
                  >
                    Liberar Pago a Tarotista
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Content Moderation Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          {pendingReports.map((r) => (
            <div key={r.id} className="glass-card p-4 rounded-2xl border border-[#D4AF37]/20 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-[#D4AF37] block">Reporte de {r.reporterName} contra {r.reportedUserName}</span>
                <p className="text-[#cec3d1] mt-0.5">"{r.description}"</p>
                <span className="text-[9px] text-[#A7A7A7] mt-1 block">Razón: {r.reason} • {new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <button
                onClick={() => alert('Reporte marcado como revisado.')}
                className="bg-[#2E1B47] border border-[#D4AF37]/40 text-[#D4AF37] font-bold px-3 py-1.5 rounded-full text-xs"
              >
                Resolver
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Financial Settings & Custom Commission Override */}
      {activeTab === 'finance' && (
        <div className="glass-card p-6 rounded-3xl border border-[#D4AF37]/30 space-y-4">
          <h3 className="font-playfair text-lg text-[#D4AF37] font-bold">Configuración Global de Comisiones KABALY</h3>
          <p className="text-xs text-[#A7A7A7]">
            Comisión estándar de la plataforma: <span className="text-[#D4AF37] font-bold">20.0%</span> de cada consulta o regalo. Se pueden configurar porcentajes personalizados por tarotista según antigüedad o promociones.
          </p>

          <div className="space-y-3 pt-3 border-t border-[#D4AF37]/20">
            {tarotistaProfiles.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-xs bg-[#1A1026] p-3 rounded-xl">
                <span className="font-bold text-[#F7E7C1]">{p.professionalName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#A7A7A7]">Comisión:</span>
                  <span className="text-[#D4AF37] font-bold">{p.customCommissionPercentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
