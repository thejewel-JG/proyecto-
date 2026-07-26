import React, { useState } from 'react';

interface OnboardingModalProps {
  onComplete: (data: {
    name: string;
    email: string;
    role: 'cliente' | 'tarotista';
    isAgeVerified: boolean;
    tarotistaData?: {
      professionalName: string;
      specialties: string[];
      bio: string;
      experienceYears: number;
      pricePerMinCoins: number;
      languages: string[];
      country: string;
      docIdentityUrl: string;
    };
  }) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [role, setRole] = useState<'cliente' | 'tarotista'>('cliente');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Tarotista form
  const [professionalName, setProfessionalName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState(5);
  const [pricePerMinCoins, setPricePerMinCoins] = useState(20);
  const [country, setCountry] = useState('España');
  const [docFileUploaded, setDocFileUploaded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Por favor, indica tu nombre y correo electrónico.');
      return;
    }
    if (!isAgeVerified) {
      alert('Debes confirmar que eres mayor de 18 años para usar ASTRALIS.');
      return;
    }
    if (!acceptedTerms) {
      alert('Debes aceptar el aviso legal y condiciones de servicio.');
      return;
    }

    onComplete({
      name,
      email,
      role,
      isAgeVerified,
      tarotistaData: role === 'tarotista' ? {
        professionalName: professionalName || name,
        specialties: ['Tarot', 'Astrología', 'Lunas'],
        bio: bio || 'Guía místico verificado en ASTRALIS.',
        experienceYears,
        pricePerMinCoins,
        languages: ['Español'],
        country,
        docIdentityUrl: docFileUploaded ? 'documento_identidad_subido.pdf' : 'doc_demo.pdf',
      } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 md:p-8 max-w-lg w-full gold-glow my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <h2 className="font-cinzel text-2xl font-bold tracking-[0.2em] text-[#F7E7C1] text-gold-glow uppercase">
            ASTRALIS
          </h2>
          <span className="text-[10px] text-[#D4AF37] tracking-[0.3em] uppercase block mt-1">
            Bienvenido a tu Espacio Sagrado
          </span>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0911] rounded-2xl border border-[#D4AF37]/30 mb-6">
          <button
            type="button"
            onClick={() => setRole('cliente')}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              role === 'cliente'
                ? 'bg-[#5A2D82] text-[#D4AF37] gold-glow'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Busco Orientación
          </button>
          <button
            type="button"
            onClick={() => setRole('tarotista')}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              role === 'tarotista'
                ? 'bg-[#5A2D82] text-[#D4AF37] gold-glow'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Soy Profesional 🔮
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#F7E7C1]">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#A7A7A7] block mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Elena Pastor"
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#A7A7A7] block mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-3 text-xs text-[#F7E7C1] outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Additional Fields if Tarotista */}
          {role === 'tarotista' && (
            <div className="p-4 bg-[#2E1B47]/40 border border-[#D4AF37]/30 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                Solicitud de Verificación de Perfil Profesional (KYC)
              </span>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Nombre Artístico / Profesional</label>
                <input
                  type="text"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  placeholder="Ej. Luna Mística"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#A7A7A7] block mb-1">Años de Experiencia</label>
                  <input
                    type="number"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#A7A7A7] block mb-1">Tarifa (Monedas/min)</label>
                  <input
                    type="number"
                    value={pricePerMinCoins}
                    onChange={(e) => setPricePerMinCoins(Number(e.target.value))}
                    className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#A7A7A7] block mb-1">Biografía & Filosofía</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe tu trayectoria y conexión con las artes místicas..."
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl p-2.5 text-xs text-[#F7E7C1] h-16"
                />
              </div>

              {/* Upload PDF Document */}
              <div className="p-3 bg-[#0B0911] border border-dashed border-[#D4AF37]/50 rounded-xl text-center">
                <span className="material-symbols-outlined text-2xl text-[#D4AF37] block mb-1">upload_file</span>
                <span className="text-[10px] text-[#A7A7A7] block">Adjuntar Documento de Identidad (DNI/Pasaporte)</span>
                <button
                  type="button"
                  onClick={() => setDocFileUploaded(true)}
                  className={`mt-2 px-3 py-1 rounded-full text-[10px] font-bold ${
                    docFileUploaded ? 'bg-green-500 text-black' : 'bg-[#5A2D82] text-[#D4AF37]'
                  }`}
                >
                  {docFileUploaded ? '✓ Documento Subido' : 'Subir Documento PDF'}
                </button>
              </div>
            </div>
          )}

          {/* Legal Compliance Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-[#D4AF37]/20 text-[11px] text-[#A7A7A7]">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAgeVerified}
                onChange={(e) => setIsAgeVerified(e.target.checked)}
                className="mt-0.5 accent-[#D4AF37]"
              />
              <span>
                Confirmo que tengo <strong className="text-[#F7E7C1]">18 años de edad o más</strong>.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-[#D4AF37]"
              />
              <span>
                Acepto las <strong className="text-[#F7E7C1]">Condiciones de Uso y el Aviso Legal</strong>: Los servicios tienen carácter de entretenimiento y crecimiento personal; no sustituyen asesoramiento médico o legal.
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all mt-4"
          >
            Entrar a ASTRALIS
          </button>
        </form>
      </div>
    </div>
  );
};
