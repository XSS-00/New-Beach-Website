export function sanitizeInput(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"';&]/g, '')
    .trimStart();
}

export function createCsrfToken() {
  return createSecureCode(24);
}

export function createReservationCode() {
  return `NBo-${createSecureCode(4)}`;
}

function createSecureCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function isRateLimited() {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const attempts = JSON.parse(localStorage.getItem('bookingAttempts') || '[]').filter((time) => now - time < hour);
  if (attempts.length >= 5) {
    localStorage.setItem('bookingAttempts', JSON.stringify(attempts));
    return true;
  }
  attempts.push(now);
  localStorage.setItem('bookingAttempts', JSON.stringify(attempts));
  return false;
}

export function browserSecurityWarning() {
  console.warn(
    '%c⚠️ This is a private application. Unauthorized access attempts are monitored.',
    'background:#0f172a;color:#14b8a6;font-weight:700;padding:8px 12px;border-radius:8px;',
  );
}
