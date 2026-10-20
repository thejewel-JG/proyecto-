import React, { useState } from 'react';
import { UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('cliente');
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setRole('cliente');
    setIsAgeVerified(false);
    setAcceptedTerms(false);
    setErrorMessage('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Credenciales incorrectas.');
        return;
      }

      onAuthSuccess(data.user);
      resetForm();
      onClose();
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!isAgeVerified) {
      setErrorMessage('Debe confirmar que es mayor de 18 años para ingresar a KABALY.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Debe aceptar las condiciones de uso y aviso legal.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          isAgeVerified,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error al crear la cuenta.');
        return;
      }

      onAuthSuccess(data.user);
      resetForm();
      onClose();
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0911]/90 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 md:p-8 max-w-md w-full gold-glow my-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A7A7A7] hover:text-[#F7E7C1] transition-colors"
          title="Cerrar"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <h2 className="font-cinzel text-2xl font-bold tracking-[0.2em] text-[#F7E7C1] text-gold-glow uppercase">
            KABALY
          </h2>
          <span className="text-[10px] text-[#D4AF37] tracking-[0.3em] uppercase block mt-1">
            Tu Espacio Místico & Sagrado
          </span>
        </div>

        {/* Auth Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0911] rounded-2xl border border-[#D4AF37]/30 mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'login'
                ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'register'
                ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-red-400">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@kabaly.app"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all mt-4 disabled:opacity-50"
            >
              {isLoading ? 'Verificando...' : 'Entrar a KABALY'}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                Nombre o Alias Místico
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Alex Cosmos"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-4 py-2 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-4 py-2 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 car."
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                  Confirmar
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/40 rounded-xl px-3 py-2 text-xs text-[#F7E7C1] focus:border-[#D4AF37] outline-none"
                />
              </div>
            </div>

            {/* Role selection */}
            <div>
              <label className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
                Tipo de Cuenta
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('cliente')}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all text-center ${
                    role === 'cliente'
                      ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                  }`}
                >
                  ✨ Consultante
                </button>
                <button
                  type="button"
                  onClick={() => setRole('tarotista')}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all text-center ${
                    role === 'tarotista'
                      ? 'bg-[#5A2D82] border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-[#0B0911] border-[#D4AF37]/20 text-[#A7A7A7]'
                  }`}
                >
                  🔮 Tarotista / Guía
                </button>
              </div>
            </div>

            {/* Verification Checkboxes */}
            <div className="space-y-2 pt-1 text-[11px] text-[#A7A7A7]">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={isAgeVerified}
                  onChange={(e) => setIsAgeVerified(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <span>Confirmo bajo declaración jurada que <strong>tengo 18 años o más</strong>.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <span>Acepto las <strong>Condiciones de Uso</strong> y el Aviso Legal.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#D4AF37] text-[#0B0911] font-bold py-3 rounded-full text-xs uppercase tracking-wider gold-glow hover:scale-[1.02] active:scale-95 transition-all mt-2 disabled:opacity-50"
            >
              {isLoading ? 'Registrando...' : 'Registrar y Acceder'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
