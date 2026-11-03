import React from 'react';

interface IconProps {
  className?: string;
  filled?: boolean;
}

/** 1. Llama Sagrada / Chispa Alquímica («Resonar» - sustituye al corazón típico) */
export const SacredFlameIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path
      d="M12 2C12 2 6 8.5 6 13.5C6 17.09 8.69 20 12 20C15.31 20 18 17.09 18 13.5C18 8.5 12 2 12 2Z"
      fill={filled ? 'rgba(212, 175, 55, 0.35)' : 'none'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6.8L13.3 11.2L17.6 12.5L13.3 13.8L12 18.2L10.7 13.8L6.4 12.5L10.7 11.2L12 6.8Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? '1.2' : '1.5'}
    />
  </svg>
);

/** 2. Bola de Cristal sobre Altar («Oráculo / Susurros» - sustituye al icono de comentarios) */
export const CrystalBallIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle
      cx="12"
      cy="10.5"
      r="7.5"
      fill={filled ? 'rgba(212, 175, 55, 0.25)' : 'rgba(11, 9, 17, 0.25)'}
    />
    <path d="M7.5 17.5H16.5L18 20.5H6L7.5 17.5Z" strokeLinejoin="round" />
    <path
      d="M12 6.5L12.8 9.2L15.5 10L12.8 10.8L12 13.5L11.2 10.8L8.5 10L11.2 9.2L12 6.5Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

/** 3. Carta Arcano / Grimorio («Grimorio» - sustituye al marcador de guardado) */
export const ArcanaGrimoireIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect
      x="5"
      y="2.5"
      width="14"
      height="19"
      rx="2.5"
      fill={filled ? 'rgba(212, 175, 55, 0.3)' : 'rgba(11, 9, 17, 0.25)'}
    />
    <path
      d="M12 7.2L13.4 10.6L16.8 12L13.4 13.4L12 16.8L10.6 13.4L7.2 12L10.6 10.6L12 7.2Z"
      fill={filled ? 'currentColor' : 'none'}
    />
    <circle cx="8" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="16" cy="18.5" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

/** 4. Estrella Fugaz / Proyección Astral («Expandir» - sustituye al botón compartir) */
export const ShootingStarIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path
      d="M16.5 3.5L18 7L21.5 8.5L18 10L16.5 13.5L15 10L11.5 8.5L15 7L16.5 3.5Z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M13 11L3 21" strokeLinecap="round" />
    <path d="M9 10L3 16" strokeLinecap="round" opacity="0.65" />
    <path d="M14 15L8 21" strokeLinecap="round" opacity="0.65" />
  </svg>
);

/** 5. Ojo Místico / Visiones (Icono de Feed / Inicio) */
export const MysticEyeIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
      fill={filled ? 'rgba(212, 175, 55, 0.2)' : 'none'}
    />
    <circle cx="12" cy="12" r="3" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

/** 6. Rosa Astral / Brújula (Icono de Explorar Videntes) */
export const AstralCompassIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="9" fill={filled ? 'rgba(212, 175, 55, 0.18)' : 'none'} />
    <path d="M12 3V6M12 18V21M3 12H6M18 12H21" strokeLinecap="round" />
    <polygon
      points="12 6.5 14 10 17.5 12 14 14 12 17.5 10 14 6.5 12 10 10 12 6.5"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);

/** 7. Estrella Alquímica de 8 Puntas (Botón Central de Publicar y Doble Toque) */
export const SolomonStarIcon: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z" />
  </svg>
);

/** 8. Lunas Entrelazadas (Icono de Mensajes Privados / Cámara Secreta) */
export const TwinMoonsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path
      d="M15.5 4.5a7.5 7.5 0 1 0 0 15 6.5 6.5 0 0 1 0-15z"
      fill={filled ? 'currentColor' : 'none'}
    />
    <circle cx="17.5" cy="12" r="2.5" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

/** 9. Corona Lunar / Altar (Icono de Perfil) */
export const LunarCrownAltarIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="9.5" r="3.5" fill={filled ? 'currentColor' : 'none'} />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    <path d="M8 4.2C9.2 3.3 10.5 2.8 12 2.8C13.5 2.8 14.8 3.3 16 4.2" strokeLinecap="round" />
  </svg>
);

/** 10. Ritual en Vivo / Péndulo Radiante (Icono de Directos) */
export const RitualLiveIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', filled = false }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 2V6" strokeLinecap="round" />
    <polygon
      points="12 6 16.5 13 12 21 7.5 13 12 6"
      fill={filled ? 'rgba(212, 175, 55, 0.35)' : 'none'}
      strokeLinejoin="round"
    />
    <path d="M4.5 10C3.5 11.5 3.5 14.5 4.5 16" strokeLinecap="round" opacity="0.7" />
    <path d="M19.5 10C20.5 11.5 20.5 14.5 19.5 16" strokeLinecap="round" opacity="0.7" />
  </svg>
);

/** 11. Sol Alquímico (Insignia de Tarotista Verificado / Monedas) */
export const AlchemicalSunIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" fill="rgba(212, 175, 55, 0.25)" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <path d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M19.07 4.93L17.66 6.34M6.34 17.66L4.93 19.07" strokeLinecap="round" />
  </svg>
);

