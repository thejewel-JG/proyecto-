import React, { useState } from 'react';
import { UserRole } from '../types';

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
  onExploreAsGuest?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthSuccess,
  onExploreAsGuest,
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

      onAuthSuccess(data.user);
      resetForm();
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="bg-[#1A1026] border-2 border-[#D4AF37] rounded-3xl p-6 md:p-10 max-w-lg w-full gold-glow shadow-2xl relative">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-[#5A2D82] to-[#D4AF37] p-0.5 shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center">
            <div className="w-full h-full bg-[#0B0911] rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#D4AF37]">auto_awesome</span>
            </div>
          </div>
          <h1 className="font-cinzel text-3xl md:text-4xl font-bold tracking-[0.25em] text-[#F7E7C1] text-gold-glow uppercase">
            KABALY
          </h1>
          <span className="text-xs text-[#D4AF37] tracking-[0.35em] uppercase block mt-2 font-medium">
            Tu Destino, Tu Magia
          </span>
          <p className="text-xs text-[#A7A7A7] mt-3 max-w-xs mx-auto">
            Comunidad exclusiva de tarot, astrología, directos sagrados y lecturas espirituales.
          </p>
        </div>

        {/* Auth Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#0B0911] rounded-2xl border border-[#D4AF37]/30 mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
            className={`py-3 text-xs font-bold rounded-xl tracking-wider uppercase transition-all ${
              activeTab === 'login'
                ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
            className={`py-3 text-xs font-bold rounded-xl tracking-wider uppercase transition-all ${
              activeTab === 'register'
                ? 'bg-[#5A2D82] text-[#D4AF37] border border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                : 'text-[#A7A7A7] hover:text-[#F7E7C1]'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
            <span className="material-symbols-outlined text-red-400 text-lg flex-shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-widest gold-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLoading ? 'Comprobando credenciales...' : 'Entrar a KABALY'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                Nombre Completo o Nombre Sagrado
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sofía Astral"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                  Contraseña (mín. 8 caracteres)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0911] border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-xs text-[#F7E7C1] placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>
            </div>

            {/* Selector de Rol */}
            <div>
              <label className="block text-[11px] font-semibold text-[#D4AF37] uppercase tracking-wider mb-1.5">
                Deseo unirme como:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('cliente')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'cliente'
                      ? 'border-[#D4AF37] bg-[#5A2D82]/50 text-[#F7E7C1]'
                      : 'border-[#D4AF37]/20 bg-[#0B0911] text-[#A7A7A7] hover:border-[#D4AF37]/40'
                  }`}
                >
                  <span className="block font-bold text-xs text-[#D4AF37]">Consultante</span>
                  <span className="block text-[10px] text-[#A7A7A7] mt-0.5">Explorar, ver directos y solicitar lecturas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('tarotista')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'tarotista'
                      ? 'border-[#D4AF37] bg-[#5A2D82]/50 text-[#F7E7C1]'
                      : 'border-[#D4AF37]/20 bg-[#0B0911] text-[#A7A7A7] hover:border-[#D4AF37]/40'
                  }`}
                >
                  <span className="block font-bold text-xs text-[#D4AF37]">Tarotista / Astrólogo</span>
                  <span className="block text-[10px] text-[#A7A7A7] mt-0.5">Ofrecer consultas y crear contenido</span>
                </button>
              </div>
            </div>

            {/* Checkboxes de Mayoría de Edad y Términos */}
            <div className="space-y-2.5 pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#A7A7A7]">
                <input
                  type="checkbox"
                  required
                  checked={isAgeVerified}
                  onChange={(e) => setIsAgeVerified(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37] rounded"
                />
                <span>
                  Declaro bajo juramento que tengo <strong className="text-[#F7E7C1]">18 años o más</strong> para acceder a los servicios de KABALY.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#A7A7A7]">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37] rounded"
                />
                <span>
                  Acepto los <a href="#terminos" className="text-[#D4AF37] underline">Términos del Servicio</a> y la Política de Privacidad.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-gradient-to-r from-[#D4AF37] to-[#F7E7C1] text-[#0B0911] font-bold py-3.5 rounded-full text-xs uppercase tracking-widest gold-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLoading ? 'Registrando cuenta...' : 'Crear Cuenta y Entrar'}
            </button>
          </form>
        )}

        {/* Opción de Explorar como Invitado */}
        {onExploreAsGuest && (
          <div className="mt-6 pt-6 border-t border-[#D4AF37]/20 text-center">
            <button
              type="button"
              onClick={onExploreAsGuest}
              className="text-xs text-[#A7A7A7] hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-1.5 mx-auto tracking-wide"
            >
              <span>Explorar la plataforma como invitado</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
