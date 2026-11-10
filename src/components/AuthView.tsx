import React, { useState } from 'react';
import { UserRole } from '../types';

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
  onExploreAsGuest?: () => void;
}

const ZODIAC_SIGNS = [
  'Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
  'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
];

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthSuccess,
  onExploreAsGuest,
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
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

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
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock social login
  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    // In demo environment, prefill demo account or alert
    setEmail('elena@gmail.com');
    setPassword('DemoPass123!');
  };

  return (
    <div className="relative min-h-screen -mt-16 -mb-16 -mx-2 sm:-mx-4 flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background celestial universe with glowing moon and mystic aura */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80"
          alt="Cosmos KABALY"
          className="w-full h-full object-cover object-top opacity-35 scale-105"
        />
        {/* Deep atmospheric mystic gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090412]/80 via-[#0E061B]/90 to-[#0B0911]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Golden Emblem (8-pointed star) */}
        <div className="mb-2 relative group">
          <div className="w-14 h-14 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-[#E5B54F] drop-shadow-[0_0_20px_rgba(229,181,79,0.8)] transition-transform duration-500 group-hover:rotate-45"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.5 8.5L23 11L14.5 13.5L12 22L9.5 13.5L1 11L9.5 8.5L12 0Z" />
              <circle cx="12" cy="11" r="2.2" fill="#FFF8E7" />
            </svg>
          </div>
        </div>

        {/* Brand Titles */}
        <h1 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-[0.26em] text-[#F7E7C1] text-gold-glow uppercase text-center">
          KABALY
        </h1>
        <span className="text-[10px] sm:text-[11px] text-[#E5B54F] tracking-[0.38em] uppercase font-semibold mt-1 text-center">
          TU DESTINO, TU MAGIA
        </span>

        {/* Narrative Description */}
        <p className="text-xs sm:text-sm text-[#D8CEF0]/85 text-center mt-3.5 mb-7 max-w-sm leading-relaxed px-2">
          Conéctate con los mejores oráculos, tarotistas y guías espirituales. Resuelve tus dudas, recibe orientación y descubre lo que el universo tiene para ti.
        </p>

        {/* Glassmorphic Auth Card */}
        <div className="mystic-card rounded-3xl p-6 sm:p-8 w-full border border-[#E5B54F]/30 shadow-[0_12px_45px_rgba(0,0,0,0.7)] backdrop-blur-2xl relative">
          {/* Tabs: Iniciar sesión / Crear cuenta */}
          <div className="flex border-b border-white/10 mb-6 relative">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide transition-all relative ${
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
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide transition-all relative ${
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

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5">
              <span className="material-symbols-outlined text-red-400 text-base shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="relative">
                <div className="mystic-input rounded-xl px-4 py-3.5 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#A09BAE] text-lg">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Correo electrónico"
                    className="bg-transparent flex-1 text-xs sm:text-sm text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="relative">
                <div className="mystic-input rounded-xl px-4 py-3.5 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#A09BAE] text-lg">lock</span>
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
                    className="text-[#A09BAE] hover:text-[#F7E7C1] transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-[#A09BAE] hover:text-[#E5B54F] transition-colors"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              </div>

              {/* Primary CTA button */}
              <button
                type="submit"
                disabled={isLoading}
                className="gold-gradient-btn w-full py-3.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Entrando al cosmos...' : 'Entrar en KABALY'}</span>
                <span className="text-sm">✦</span>
              </button>

              {/* Social Login Section */}
              <div className="pt-4">
                <div className="relative flex items-center justify-center mb-4">
                  <div className="border-t border-white/10 w-full" />
                  <span className="bg-[#150B23] px-3 text-[11px] text-[#A09BAE] uppercase tracking-wider whitespace-nowrap">
                    o continua con
                  </span>
                  <div className="border-t border-white/10 w-full" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Google */}
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="mystic-input rounded-xl py-2.5 px-3 flex items-center justify-center gap-2.5 hover:border-[#E5B54F]/50 transition-all text-xs font-semibold text-[#F7E7C1]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  {/* Apple */}
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Apple')}
                    className="mystic-input rounded-xl py-2.5 px-3 flex items-center justify-center gap-2.5 hover:border-[#E5B54F]/50 transition-all text-xs font-semibold text-[#F7E7C1]"
                  >
                    <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.68-7.81-11.97-14.3-5.74-8.73-10.24-18.73-13.48-29.99-3.25-11.26-4.88-22.09-4.88-32.48 0-14.13 3.65-25.96 10.96-35.48 7.31-9.52 16.43-14.39 27.35-14.61 4.79 0 10.15 1.25 16.08 3.76 5.92 2.51 9.77 3.82 11.53 3.92 1.52-.1 5.56-1.46 12.12-4.08 6.56-2.61 12.35-3.81 17.38-3.59 13.06.66 23.36 5.32 30.9 13.98-11.53 6.96-17.18 16.63-16.96 29.02.22 9.68 4.02 17.65 11.41 23.91 7.39 6.26 16.19 9.89 26.41 10.87-2.17 6.42-4.67 12.63-7.51 18.63zM119.22 33.15c0-7.18 2.61-13.92 7.82-20.21 5.22-6.29 11.63-10.35 19.24-12.18.22 1.41.33 2.72.33 3.92 0 7.07-2.67 13.92-8.01 20.55-5.33 6.63-11.75 10.45-19.25 11.43-.07-1.19-.13-2.36-.13-3.51z" />
                    </svg>
                    <span>Apple</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                  Nombre Completo o Nombre Sagrado
                </label>
                <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#A09BAE] text-base">person</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Sofía Astral"
                    className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                  Correo Electrónico
                </label>
                <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#A09BAE] text-base">mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                    Contraseña (mín. 8)
                  </label>
                  <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#A09BAE] text-base">lock</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                    Confirmar Contraseña
                  </label>
                  <div className="mystic-input rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#A09BAE] text-base">lock_clock</span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-transparent flex-1 text-xs text-[#F7E7C1] placeholder-[#A09BAE]/70 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Signo Solar */}
              <div>
                <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                  ☉ Signo Solar (Opcional · Activa Sinastría)
                </label>
                <div className="mystic-input rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#E5B54F] text-base">auto_awesome</span>
                  <select
                    value={sunSign}
                    onChange={(e) => setSunSign(e.target.value)}
                    className="bg-transparent flex-1 text-xs text-[#F7E7C1] outline-none cursor-pointer"
                  >
                    <option value="" className="bg-[#120B1D]">Selecciona tu signo zodiacal...</option>
                    {ZODIAC_SIGNS.map((s) => (
                      <option key={s} value={s} className="bg-[#120B1D] text-[#F7E7C1]">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rol */}
              <div>
                <label className="block text-[11px] font-semibold text-[#E5B54F] uppercase tracking-wider mb-1">
                  Propósito en KABALY
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('cliente')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      role === 'cliente'
                        ? 'bg-[#E5B54F]/20 border-[#E5B54F] text-[#F7E7C1]'
                        : 'border-white/10 text-[#A09BAE] hover:border-white/20'
                    }`}
                  >
                    ✦ Buscador Espiritual
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('tarotista')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      role === 'tarotista'
                        ? 'bg-[#E5B54F]/20 border-[#E5B54F] text-[#F7E7C1]'
                        : 'border-white/10 text-[#A09BAE] hover:border-white/20'
                    }`}
                  >
                    🔮 Vidente / Oráculo
                  </button>
                </div>
              </div>

              {/* Verificación de edad y términos */}
              <div className="space-y-2 pt-1 text-[11px] text-[#A09BAE]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAgeVerified}
                    onChange={(e) => setIsAgeVerified(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 text-[#E5B54F] focus:ring-0 bg-transparent"
                  />
                  <span>Confirmo que soy mayor de 18 años.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 text-[#E5B54F] focus:ring-0 bg-transparent"
                  />
                  <span>Acepto las condiciones de servicio y la política de privacidad mística.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="gold-gradient-btn w-full py-3.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Creando vínculo...' : 'Crear Cuenta Sagrada'}</span>
                <span className="text-sm">✦</span>
              </button>
            </form>
          )}

          {/* Guest explore option */}
          {onExploreAsGuest && (
            <div className="mt-5 text-center pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={onExploreAsGuest}
                className="text-xs text-[#E5B54F]/90 hover:text-[#F7E7C1] transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium"
              >
                <span>Explorar KABALY como invitado</span>
                <span className="text-sm">→</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="mystic-card rounded-3xl p-6 max-w-sm w-full border border-[#E5B54F]/30 text-center">
            <span className="material-symbols-outlined text-4xl text-[#E5B54F] mb-2">lock_reset</span>
            <h3 className="font-cinzel text-lg font-bold text-[#F7E7C1]">Recuperar Contraseña</h3>
            <p className="text-xs text-[#A09BAE] mt-1 mb-4">
              Introduce tu correo electrónico para recibir un enlace de restablecimiento seguro.
            </p>
            {forgotSent ? (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs mb-4">
                ¡Enlace de recuperación enviado! Revisa tu bandeja de entrada.
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="mystic-input w-full rounded-xl px-4 py-2.5 text-xs text-[#F7E7C1] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setForgotSent(true)}
                  className="gold-gradient-btn w-full py-2.5 rounded-full text-xs font-bold"
                >
                  Enviar enlace de acceso
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setShowForgotModal(false); setForgotSent(false); }}
              className="text-xs text-[#A09BAE] hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
