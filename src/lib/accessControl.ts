export const PRIMARY_ADMIN_EMAIL = 'loveking20178@gmail.com';

const DEVICE_ID_STORAGE_KEY = 'shwepos_device_id_v1';
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isPrimaryAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const nextId = `dev_${hex}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function generateRandomPassCode(prefix = 'SHWE'): string {
  const cleanPrefix = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'SHWE';

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let chars = '';
  for (let i = 0; i < 12; i++) {
    chars += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return `${cleanPrefix}-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function normalizePassCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40);
}

export function timestampToMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    // Support YYYY-MM-DD as end-of-day local time, or full ISO datetime strings
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? Date.parse(`${trimmed}T23:59:59`)
      : Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof val === 'object' && val !== null) {
    const maybe = val as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  }
  return 0;
}

export function resolveSubscriptionExpiryMs(data: Record<string, unknown> | undefined | null): number {
  if (!data) return 0;
  const subMs = timestampToMs(data.subscription_expiry);
  const expMs = timestampToMs(data.expiresAt);
  if (subMs > 0 && expMs > 0) return Math.min(subMs, expMs);
  return subMs || expMs || 0;
}

export function getRemainingDays(expiresAtMs: number, nowMs = Date.now()): number {
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiredDaysAgo(expiresAtMs: number, nowMs = Date.now()): number {
  if (!expiresAtMs || expiresAtMs > nowMs) return 0;
  return Math.floor((nowMs - expiresAtMs) / (1000 * 60 * 60 * 24));
}

export function formatExpiryDate(ms: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('en-CA'); // YYYY-MM-DD
  } catch {
    return '—';
  }
}
