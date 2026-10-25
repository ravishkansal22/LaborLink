/** Decorative 3D-style mason icon (brick wall + trowel). */
export function MasonIllustration() {
  return (
    <svg viewBox="0 0 96 96" width={72} height={72} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mason-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10193c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10193c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mason-brick" x1="20%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#f2a08a" />
          <stop offset="45%" stopColor="#c84a3a" />
          <stop offset="100%" stopColor="#8a2a22" />
        </linearGradient>
        <linearGradient id="mason-mortar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8ebf5" />
          <stop offset="100%" stopColor="#aeb4c8" />
        </linearGradient>
        <linearGradient id="mason-steel" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#f5f7ff" />
          <stop offset="50%" stopColor="#9aa6c0" />
          <stop offset="100%" stopColor="#5c6884" />
        </linearGradient>
        <linearGradient id="mason-wood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8c49a" />
          <stop offset="100%" stopColor="#8b5a2b" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="84" rx="22" ry="5" fill="url(#mason-ground)" />
      <rect x="18" y="36" width="52" height="36" rx="3" fill="url(#mason-mortar)" stroke="#dfe3f0" strokeWidth="1" />
      <rect x="20" y="38" width="22" height="10" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="44" y="38" width="24" height="10" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="20" y="50" width="14" height="10" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="36" y="50" width="22" height="10" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="60" y="50" width="8" height="10" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="20" y="62" width="22" height="8" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <rect x="44" y="62" width="24" height="8" rx="1.5" fill="url(#mason-brick)" stroke="#ffd0c4" strokeWidth="0.75" />
      <path
        d="M58 18 L78 28 L70 40 L62 34 L52 48 L44 44 L56 28 L50 24 Z"
        fill="url(#mason-steel)"
        stroke="#fff"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <rect x="46" y="14" width="8" height="18" rx="2" transform="rotate(28 50 23)" fill="url(#mason-wood)" stroke="#f5e0c8" strokeWidth="0.75" />
    </svg>
  );
}
