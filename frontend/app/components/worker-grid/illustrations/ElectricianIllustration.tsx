/** Decorative 3D-style electrician icon (lightning + plug). */
export function ElectricianIllustration() {
  return (
    <svg viewBox="0 0 96 96" width={72} height={72} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="elec-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10193c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10193c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="elec-plug" x1="20%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#f4f6ff" />
          <stop offset="45%" stopColor="#c5d0f5" />
          <stop offset="100%" stopColor="#7a8ab8" />
        </linearGradient>
        <linearGradient id="elec-bolt" x1="30%" y1="5%" x2="70%" y2="95%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="50%" stopColor="#f5b400" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="elec-copper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0c090" />
          <stop offset="100%" stopColor="#b87333" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="84" rx="22" ry="5" fill="url(#elec-ground)" />
      <rect x="28" y="42" width="40" height="28" rx="10" fill="url(#elec-plug)" stroke="#eef2ff" strokeWidth="1.5" />
      <rect x="36" y="68" width="8" height="10" rx="2" fill="url(#elec-copper)" />
      <rect x="52" y="68" width="8" height="10" rx="2" fill="url(#elec-copper)" />
      <path
        d="M52 14 L38 42 H48 L42 66 L62 34 H50 L56 14 Z"
        fill="url(#elec-bolt)"
        stroke="#fff6d6"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M48 20 L42 36 H48" fill="none" stroke="#fffce8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
