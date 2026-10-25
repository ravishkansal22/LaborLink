/**
 * Derives up to 2 initials from a display name.
 * Supports Latin and Devanagari letters; collapses extra spaces; falls back to `?`.
 */
export function getInitials(name: string): string {
  if (typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';

  const letters: string[] = [];
  for (const part of parts) {
    if (letters.length >= 2) break;
    const letter = firstLetter(part);
    if (letter) letters.push(letter);
  }

  if (letters.length === 0) return '?';
  return letters.map(toInitialCase).join('');
}

function firstLetter(word: string): string {
  const match = word.match(/\p{L}/u);
  return match?.[0] ?? '';
}

function toInitialCase(ch: string): string {
  // Devanagari and other scripts have no case; Latin gets uppercased.
  const upper = ch.toUpperCase();
  return upper !== ch.toLowerCase() ? upper : ch;
}
