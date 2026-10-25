/** Decorative 3D-style plumber icon (pipe elbow + wrench). */
export function PlumberIllustration() {
  return (
    <svg viewBox="0 0 96 96" width={72} height={72} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="plumb-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10193c" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10193c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="plumb-chrome" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#f7f9ff" />
          <stop offset="40%" stopColor="#b8c4dc" />
          <stop offset="100%" stopColor="#6b7898" />
        </linearGradient>
        <linearGradient id="plumb-wrench" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#ff9a6b" />
          <stop offset="55%" stopColor="#e85d2a" />
          <stop offset="100%" stopColor="#b33a12" />
        </linearGradient>
        <linearGradient id="plumb-drop" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#9fdcff" />
          <stop offset="100%" stopColor="#08799e" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="84" rx="22" ry="5" fill="url(#plumb-ground)" />
      <path
        d="M28 30 h22 a14 14 0 0 1 14 14 v22 h-16 v-16 a6 6 0 0 0-6-6 H28 Z"
        fill="url(#plumb-chrome)"
        stroke="#eef2ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="30" r="7" fill="url(#plumb-chrome)" stroke="#fff" strokeWidth="1.25" />
      <circle cx="64" cy="66" r="7" fill="url(#plumb-chrome)" stroke="#fff" strokeWidth="1.25" />
      <path
        d="M58 22 L72 36 L66 42 L62 38 L52 48 L46 42 L56 32 L52 28 Z"
        fill="url(#plumb-wrench)"
        stroke="#ffd4c0"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M70 18 C70 18 78 28 78 36 C78 42 74 46 70 46 C66 46 62 42 62 36 C62 28 70 18 70 18 Z" fill="url(#plumb-drop)" stroke="#d6f0ff" strokeWidth="1" />
      <path d="M70 24 C70 24 74 30 74 35" fill="none" stroke="#e8f7ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
