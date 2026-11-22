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

export interface RemainingTimeParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
}

export function getRemainingTimeParts(expiresAtMs: number, nowMs = Date.now()): RemainingTimeParts {
  if (!expiresAtMs || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, expired: true };
  }
  const diff = expiresAtMs - nowMs;
  const dayMs = 1000 * 60 * 60 * 24;
  const hourMs = 1000 * 60 * 60;
  const minuteMs = 1000 * 60;

  const days = Math.floor(diff / dayMs);
  const hours = Math.floor((diff % dayMs) / hourMs);
  const minutes = Math.floor((diff % hourMs) / minuteMs);

  return { totalMs: diff, days, hours, minutes, expired: false };
}

export function formatRemainingDetailed(
  expiresAtMs: number,
  lang: 'my' | 'en',
  nowMs = Date.now(),
  compact = false
): string {
  const { days, hours, minutes, expired } = getRemainingTimeParts(expiresAtMs, nowMs);
  if (expired) {
    return lang === 'my' ? 'သက်တမ်းကုန်ဆုံးပြီး' : 'Expired';
  }

  const safeMins = days === 0 && hours === 0 ? Math.max(1, minutes) : minutes;

  if (compact) {
    if (days > 0) {
      return lang === 'my' ? `${days} ရက် ${hours} နာရီ` : `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return lang === 'my' ? `${hours} နာရီ ${safeMins} မိနစ်` : `${hours}h ${safeMins}m`;
    }
    return lang === 'my' ? `${safeMins} မိနစ်` : `${safeMins}m`;
  }

  if (days > 0) {
    return lang === 'my'
      ? `${days} ရက် ${hours} နာရီ ${safeMins} မိနစ် ကျန်`
      : `${days}d ${hours}h ${safeMins}m left`;
  }
  if (hours > 0) {
    return lang === 'my'
      ? `${hours} နာရီ ${safeMins} မိနစ် ကျန်`
      : `${hours}h ${safeMins}m left`;
  }
  return lang === 'my' ? `${safeMins} မိနစ် ကျန်` : `${safeMins}m left`;
}

export function formatExpiryDateTime(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  try {
    const d = new Date(ms);
    const datePart = d.toLocaleDateString('en-CA');
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return '—';
  }
}

export function getSubscriptionProgressPercent(
  expiresAtMs: number,
  durationDays?: number,
  createdAtMs?: number,
  nowMs = Date.now()
): number {
  if (!expiresAtMs || expiresAtMs <= nowMs) return 0;
  const remainingMs = expiresAtMs - nowMs;
  const dayMs = 1000 * 60 * 60 * 24;

  let totalWindowMs = 0;
  if (createdAtMs && createdAtMs > 0 && expiresAtMs > createdAtMs) {
    totalWindowMs = expiresAtMs - createdAtMs;
  } else if (durationDays && durationDays > 0) {
    totalWindowMs = durationDays * dayMs;
  } else {
    totalWindowMs = 30 * dayMs;
  }

  if (totalWindowMs <= 0) return 100;
  const rawPct = Math.round((remainingMs / totalWindowMs) * 100);
  return Math.min(100, Math.max(1, rawPct));
}

