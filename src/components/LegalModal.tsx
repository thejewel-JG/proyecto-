import React, { useState } from 'react';

export type LegalTab = 'terms' | 'privacy' | 'cookies';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="mystic-card rounded-3xl max-w-2xl w-full border border-[#E5B54F]/35 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#140B22]">
          <div className="flex items-center gap-2">
            <span className="text-[#E5B54F] text-lg">✦</span>
            <h2 className="font-cinzel text-base sm:text-lg font-bold text-[#F7E7C1] tracking-wider uppercase">
              Marco Legal y Privacidad — KABALY
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#A09BAE] hover:text-white"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-[#12091E] px-4">
          {[
            { id: 'terms', label: 'Condiciones de Uso (+18)' },
            { id: 'privacy', label: 'Privacidad (RGPD)' },
            { id: 'cookies', label: 'Cookies y Consumo Responsable' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as LegalTab)}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === t.id
                  ? 'border-[#E5B54F] text-[#E5B54F] font-bold'
                  : 'border-transparent text-[#A09BAE] hover:text-[#F7E7C1]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-[#D8CEF0]/90 leading-relaxed">
          {activeTab === 'terms' && (
            <>
              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                1. Naturaleza del Servicio y Mayoría de Edad (+18)
              </h3>
              <p>
                El acceso y uso de <strong>KABALY</strong> está estrictamente reservado a personas mayores de <strong>18 años</strong>. Al registrarse o navegar por la plataforma, el usuario declara bajo su responsabilidad haber alcanzado la mayoría de edad legal en su jurisdicción.
              </p>
              <p>
                De conformidad con la legislación vigente en España y la Unión Europea, se informa expresamente que las lecturas de tarot, astrología, videncia, runas, rituales y canalizaciones ofrecidas a través de KABALY tienen fines exclusivos de <strong>entretenimiento, orientación espiritual, introspección y desarrollo personal</strong>. En ningún caso sustituyen la atención médica, psiquiátrica, psicológica, jurídica o financiera impartida por profesionales colegiados.
              </p>

              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                2. Monedero Virtual, Custodia Escrow y Consultas 1:1
              </h3>
              <p>
                Las transacciones dentro de la plataforma se realizan mediante Monedas KABALY adquiridas a través de pasarela segura cifrada (Stripe). Al solicitar una consulta 1:1 con un oráculo verificado, el importe en monedas queda retenido en depósito de garantía (<em>Escrow</em>) y únicamente se libera al profesional una vez finalizada satisfactoriamente la sesión. Si el vidente rechaza o no atiende la solicitud en plazo, el 100% de las monedas se reintegra automáticamente al saldo del cliente.
              </p>

              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                3. Código Ético de la Comunidad
              </h3>
              <p>
                Queda terminantemente prohibido el acoso, la coacción, la promesa de curaciones médicas milagrosas, el intercambio de datos bancarios o de pago fuera de la plataforma y la difusión de contenido ilícito. El incumplimiento conllevará la suspensión inmediata de la cuenta.
              </p>
            </>
          )}

          {activeTab === 'privacy' && (
            <>
              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                1. Protección de Datos Personales (RGPD / LOPDGDD)
              </h3>
              <p>
                En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), los datos personales recabados (nombre o alias, correo electrónico, fecha opcional de nacimiento para carta natal y registros de transacciones) son tratados con la única finalidad de gestionar tu cuenta, las comunicaciones en tiempo real y la seguridad contable de tus consultas.
              </p>

              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                2. Confidencialidad de los Susurros y Consultas
              </h3>
              <p>
                Las conversaciones privadas y sesiones 1:1 están protegidas mediante controles de acceso autenticados. Únicamente el equipo de moderación podrá revisar un mensaje específico cuando uno de los participantes envíe un reporte formal por infracción de seguridad.
              </p>

              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                3. Ejercicio de Derechos ARCO-POL
              </h3>
              <p>
                Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición desde los ajustes de tu perfil o escribiendo a nuestro canal oficial de soporte.
              </p>
            </>
          )}

          {activeTab === 'cookies' && (
            <>
              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                1. Uso de Cookies Técnicas Estrictamente Necesarias
              </h3>
              <p>
                KABALY utiliza cookies de sesión seguras (<code>HttpOnly</code> y <code>SameSite</code>) imprescindibles para mantener tu sesión iniciada de forma protegida y recordar tus preferencias de privacidad. No vendemos ni cedemos perfiles publicitarios a terceros.
              </p>

              <h3 className="font-cinzel text-sm font-bold text-[#E5B54F]">
                2. Compromiso de Consumo Responsable
              </h3>
              <p>
                Fomentamos un uso saludable y consciente de las consultas espirituales. Todos los usuarios disponen en su Billetera Astral de una herramienta de <strong>Límites de Gasto Diario y Semanal</strong> configurable libremente para mantener el control absoluto de su presupuesto.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#140B22] flex justify-end">
          <button
            onClick={onClose}
            className="gold-gradient-btn px-6 py-2.5 rounded-full text-xs font-bold"
          >
            Entendido y Aceptar ✦
          </button>
        </div>
      </div>
    </div>
  );
};
