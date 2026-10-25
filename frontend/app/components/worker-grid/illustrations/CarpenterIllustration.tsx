/** Decorative 3D-style carpenter icon (hammer + plank). */
export function CarpenterIllustration() {
  return (
    <svg viewBox="0 0 96 96" width={72} height={72} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="carp-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10193c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10193c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="carp-plank" x1="10%" y1="20%" x2="90%" y2="80%">
          <stop offset="0%" stopColor="#f0d2a8" />
          <stop offset="50%" stopColor="#c4894a" />
          <stop offset="100%" stopColor="#7a4a22" />
        </linearGradient>
        <linearGradient id="carp-steel" x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#f7f9ff" />
          <stop offset="45%" stopColor="#9aa8c4" />
          <stop offset="100%" stopColor="#4a5674" />
        </linearGradient>
        <linearGradient id="carp-handle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8c49a" />
          <stop offset="100%" stopColor="#8b5a2b" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="84" rx="22" ry="5" fill="url(#carp-ground)" />
      <rect
        x="14"
        y="52"
        width="68"
        height="16"
        rx="3"
        fill="url(#carp-plank)"
        stroke="#f8e4c8"
        strokeWidth="1.25"
        transform="rotate(-8 48 60)"
      />
      <path d="M18 56 Q48 52 78 60" fill="none" stroke="#a86a38" strokeWidth="1" opacity="0.45" />
      <path d="M20 62 Q48 58 76 66" fill="none" stroke="#f5e0c0" strokeWidth="1" opacity="0.5" />
      <rect
        x="44"
        y="28"
        width="10"
        height="42"
        rx="3"
        fill="url(#carp-handle)"
        stroke="#f5e0c8"
        strokeWidth="0.75"
        transform="rotate(-32 49 49)"
      />
      <path
        d="M28 18 H52 L56 28 H48 L46 36 H34 L32 28 H24 Z"
        fill="url(#carp-steel)"
        stroke="#eef2ff"
        strokeWidth="1.25"
        strokeLinejoin="round"
        transform="rotate(-32 40 27)"
      />
      <path d="M34 16 L42 18" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" transform="rotate(-32 40 27)" />
    </svg>
  );
}
