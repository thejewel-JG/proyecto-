import React, { useState } from 'react';
import { UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

const ZODIAC_SIGNS = [
  'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
  'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [sunSign, setSunSign] = useState('');
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

      if (sunSign && data.user) {
        await fetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.user.name,
            handle: data.user.handle || `@${data.user.name.toLowerCase().replace(/\s+/g, '')}`,
            bio: data.user.bio || `Alma de ${sunSign} conectada al cosmos en KABALY ✨`,
            avatar: data.user.avatar,
            sunSign,
          }),
        }).catch(() => {});
        data.user.sunSign = sunSign;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative mystic-card rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E5B54F]/35 shadow-[0_15px_50px_rgba(0,0,0,0.8)] my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#A09BAE] hover:text-[#F7E7C1] hover:border-[#E5B54F]/50 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Emblem & Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[#E5B54F] drop-shadow-[0_0_15px_rgba(229,181,79,0.7)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.5 8.5L23 11L14.5 13.5L12 22L9.5 13.5L1 11L9.5 8.5L12 0Z" />
              <circle cx="12" cy="11" r="2.2" fill="#FFF8E7" />
            </svg>
          </div>
          <h2 className="font-cinzel text-2xl font-bold tracking-[0.25em] text-[#F7E7C1] uppercase">
            KABALY
          </h2>
          <span className="text-[10px] text-[#E5B54F] tracking-[0.35em] uppercase font-semibold block mt-0.5">
            TU DESTINO, TU MAGIA
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6 relative">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
            className={`flex-1 pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'login'
                ? 'text-[#F7E7C1] font-bold'
                : 'text-[#A09BAE] hover:text-[#F7E7C1]'
            }`}
          >
            Iniciar sesión
            {activeTab === 'login' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#E5B54F] to-transparent shadow-[0_0_8px_#E5B54F]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
            className={`flex-1 pb-3 text-xs sm:text-sm font-semibold tracking-wide transition-all relative ${
              activeTab === 'register'
                ? 'text-[#F7E7C1] font-bold'
                : 'text-[#A09BAE] hover:text-[#F7E7C1]'
            }`}
          >
            Crear cuenta
            {activeTab === 'register' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#E5B54F] to-transparent shadow-[0_0_8px_#E5B54F]" />
            )}
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-base shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#A09BAE] text-base">mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="bg-transparent flex-1 text-xs sm:text-sm text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
              />
            </div>

            <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#A09BAE] text-base">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="bg-transparent flex-1 text-xs sm:text-sm text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#A09BAE] hover:text-[#F7E7C1]"
              >
                <span className="material-symbols-outlined text-base">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="gold-gradient-btn w-full py-3.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Entrando...' : 'Entrar en KABALY'}</span>
              <span className="text-sm">✦</span>
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="mystic-input rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#A09BAE] text-base">person</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre Completo o Sagrado"
                className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
              />
            </div>

            <div className="mystic-input rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#A09BAE] text-base">mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="mystic-input rounded-xl px-3 py-2 flex items-center gap-2">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="bg-transparent w-full text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                />
              </div>
              <div className="mystic-input rounded-xl px-3 py-2 flex items-center gap-2">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir clave"
                  className="bg-transparent w-full text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                />
              </div>
            </div>

            <div className="mystic-input rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#E5B54F] text-sm">auto_awesome</span>
              <select
                value={sunSign}
                onChange={(e) => setSunSign(e.target.value)}
                className="bg-transparent flex-1 text-xs text-[#F7E7C1] outline-none cursor-pointer"
              >
                <option value="" className="bg-[#120B1D]">Signo Solar (Opcional)...</option>
                {ZODIAC_SIGNS.map((s) => (
                  <option key={s} value={s} className="bg-[#120B1D] text-[#F7E7C1]">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 pt-1 text-[10px] text-[#A09BAE]">
              <label className="flex items-start gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgeVerified}
                  onChange={(e) => setIsAgeVerified(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-[#E5B54F] focus:ring-0 bg-transparent"
                />
                <span>Mayor de 18 años.</span>
              </label>
              <label className="flex items-start gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-[#E5B54F] focus:ring-0 bg-transparent"
                />
                <span>Acepto condiciones de uso y aviso legal.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="gold-gradient-btn w-full py-3.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Creando...' : 'Crear Cuenta'}</span>
              <span className="text-sm">✦</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
