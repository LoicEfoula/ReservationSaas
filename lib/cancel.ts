// Délai minimal (en minutes) avant le rendez-vous pour annuler en ligne.
export const CANCEL_MIN_NOTICE_MIN = 120;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cancelUrl(token: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/annuler/${token}`;
}