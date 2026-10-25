/**
 * Masks an Indian-style phone for display.
 * Keeps a leading country code when present, shows the first 2 and last 2
 * national digits, and replaces the middle with `X`. Never throws.
 *
 * @example maskPhone('+91 9911050007') // '+91 99XXXXXX07'
 */
export function maskPhone(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return '—';

  const trimmed = input.trim();
  const ccMatch = trimmed.match(/^(\+\d{1,3})\s*/);
  const country = ccMatch?.[1] ?? '';
  const rest = country ? trimmed.slice(ccMatch![0].length) : trimmed;
  const digits = rest.replace(/\D/g, '');

  if (digits.length === 0) {
    return country || '—';
  }

  if (digits.length <= 4) {
    const masked = digits.length <= 2 ? digits : `${digits.slice(0, 1)}${'X'.repeat(digits.length - 2)}${digits.slice(-1)}`;
    return country ? `${country} ${masked}` : masked;
  }

  const head = digits.slice(0, 2);
  const tail = digits.slice(-2);
  const middle = 'X'.repeat(digits.length - 4);
  const national = `${head}${middle}${tail}`;
  return country ? `${country} ${national}` : national;
}
