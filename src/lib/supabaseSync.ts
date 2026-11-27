import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';
import type {
  AccessPass,
  AuthUser,
  Debt,
  Delivery,
  Expense,
  PosBackupPayload,
  Product,
  Purchase,
  Sale,
  ShopSettings,
  StockLog,
  UserLicense,
} from '../types/pos';
import { resolveSubscriptionExpiryMs, timestampToMs } from './accessControl';

declare const __SHWEPOS_SUPABASE_URL__: string | undefined;
declare const __SHWEPOS_SUPABASE_ANON_KEY__: string | undefined;

export interface SupabaseSyncPayload {
  ownerId: string;
  shop: ShopSettings;
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  stockLogs: StockLog[];
  debts: Debt[];
  expenses: Expense[];
  deliveries: Delivery[];
}

export interface SupabaseShopRow extends ShopSettings {
  id: string;
}

function cleanCredential(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isValidSupabaseHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeBrowserSupabaseKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return false;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const json = JSON.parse(atob(padded)) as { role?: string };
      if (json.role && json.role !== 'anon') return false;
    } catch {
      // Allow non-JWT publishable keys (e.g. sb_publishable_*)
    }
  }
  return true;
}

function getClientSupabaseCredentials(): { url: string; anonKey: string } {
  const urlCandidates = [
    typeof __SHWEPOS_SUPABASE_URL__ === 'string' ? __SHWEPOS_SUPABASE_URL__ : '',
    import.meta.env.VITE_SUPABASE_URL,
  ].map(cleanCredential);

  const keyCandidates = [
    typeof __SHWEPOS_SUPABASE_ANON_KEY__ === 'string' ? __SHWEPOS_SUPABASE_ANON_KEY__ : '',
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ].map(cleanCredential);

  return {
    url: urlCandidates.find(isValidSupabaseHttpUrl) || '',
    anonKey: keyCandidates.find(isSafeBrowserSupabaseKey) || '',
  };
}

export function isClientSupabaseConfigured(): boolean {
  const { url, anonKey } = getClientSupabaseCredentials();
  return Boolean(url && anonKey);
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

export function getClientSupabase(): SupabaseClient | null {
  const { url, anonKey } = getClientSupabaseCredentials();
  if (!url || !anonKey) return null;
  const sig = `${url}::${anonKey.slice(0, 12)}`;
  if (!cachedClient || cachedSignature !== sig) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      cachedSignature = sig;
    } catch {
      cachedClient = null;
      cachedSignature = '';
      return null;
    }
  }
  return cachedClient;
}

export function mapSupabaseUser(u: SupabaseUser | null): AuthUser | null {
  if (!u) return null;
  const metaName =
    typeof u.user_metadata?.full_name === 'string' && u.user_metadata.full_name.trim()
      ? u.user_metadata.full_name.trim()
      : null;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: metaName || (u.email ? u.email.split('@')[0] : null),
    provider: 'supabase',
  };
}

export function onSupabaseAuthChange(
  callback: (user: AuthUser | null, initialResolved: boolean) => void
): () => void {
  const supabase = getClientSupabase();
  if (!supabase) {
    callback(null, true);
    return () => {};
  }

  let active = true;
  supabase.auth
    .getSession()
    .then(({ data }) => {
      if (!active) return;
      callback(mapSupabaseUser(data.session?.user ?? null), true);
    })
    .catch(() => {
      if (!active) return;
      callback(null, true);
    });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    callback(mapSupabaseUser(session?.user ?? null), true);
  });

  return () => {
    active = false;
    sub.subscription.unsubscribe();
  };
}

export async function signInWithSupabaseEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; user?: AuthUser; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const mapped = mapSupabaseUser(data.user ?? data.session?.user ?? null);
  return { ok: true, user: mapped ?? undefined };
}

export async function signUpWithSupabaseEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ ok: boolean; user?: AuthUser; needsEmailConfirm?: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: (displayName || '').trim() || email.trim().split('@')[0],
      },
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data.session && data.user) {
    return { ok: true, needsEmailConfirm: true };
  }
  const mapped = mapSupabaseUser(data.user ?? data.session?.user ?? null);
  return { ok: true, user: mapped ?? undefined, needsEmailConfirm: false };
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getClientSupabase();
  if (!supabase) return;
  await supabase.auth.signOut().catch(() => {});
}

export async function checkClientSupabaseHealth(): Promise<{
  reachable: boolean;
  error: string | null;
}> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return { reachable: false, error: 'Supabase environment variables not configured.' };
  }
  try {
    const probePromise = supabase
      .from('pos_shops')
      .select('owner_id', { count: 'exact', head: true })
      .limit(1);
    const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'Connection timed out' } }), 3500)
    );
    const result = await Promise.race([probePromise, timeoutPromise]);
    if (result.error) {
      return { reachable: false, error: result.error.message };
    }
    return { reachable: true, error: null };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : 'Unable to reach Supabase.',
    };
  }
}

// ---------- Supabase Access Passes & User Licenses ----------

function mapPassRow(r: Record<string, unknown>): AccessPass {
  const expMs = resolveSubscriptionExpiryMs({
    subscription_expiry: r.subscription_expiry,
    expiresAt: r.expires_at,
  });
  return {
    code: String(r.code || ''),
    label: String(r.label || ''),
    note: String(r.note || ''),
    status: r.status === 'revoked' ? 'revoked' : 'active',
    durationDays: Number(r.duration_days || 30),
    expiresAtMs: expMs,
    subscriptionExpiryMs: timestampToMs(r.subscription_expiry) || expMs,
    maxDevices: Number(r.max_devices || 1),
    boundDevices: Array.isArray(r.bound_devices) ? r.bound_devices.map(String) : [],
    assignedUid: String(r.assigned_uid || ''),
    assignedEmail: String(r.assigned_email || ''),
    createdBy: String(r.created_by || ''),
    createdAtMs: timestampToMs(r.created_at),
    updatedAtMs: timestampToMs(r.updated_at),
  };
}

function mapLicenseRow(r: Record<string, unknown>): UserLicense {
  const expMs = resolveSubscriptionExpiryMs({
    subscription_expiry: r.subscription_expiry,
    expiresAt: r.expires_at,
  });
  return {
    userId: String(r.user_id || ''),
    email: String(r.email || ''),
    displayName: String(r.display_name || ''),
    passCode: String(r.pass_code || ''),
    label: String(r.label || ''),
    status: r.status === 'revoked' ? 'revoked' : 'active',
    expiresAtMs: expMs,
    subscriptionExpiryMs: timestampToMs(r.subscription_expiry) || expMs,
    maxDevices: Number(r.max_devices || 1),
    createdAtMs: timestampToMs(r.created_at),
    updatedAtMs: timestampToMs(r.updated_at),
  };
}

export async function fetchSupabaseUserLicense(userId: string): Promise<{
  license: UserLicense | null;
  pass: AccessPass | null;
  error?: string;
}> {
  const supabase = getClientSupabase();
  if (!supabase) return { license: null, pass: null, error: 'Supabase not configured.' };

  const { data: licData, error: licErr } = await supabase
    .from('pos_user_licenses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (licErr) {
    return { license: null, pass: null, error: licErr.message };
  }
  if (!licData) {
    return { license: null, pass: null };
  }

  const license = mapLicenseRow(licData as Record<string, unknown>);
  let pass: AccessPass | null = null;
  if (license.passCode) {
    const { data: passData } = await supabase
      .from('pos_access_passes')
      .select('*')
      .eq('code', license.passCode)
      .maybeSingle();
    if (passData) {
      pass = mapPassRow(passData as Record<string, unknown>);
    }
  }
  return { license, pass };
}

export async function redeemSupabaseAccessPass(
  passCode: string,
  deviceId: string
): Promise<{ ok: boolean; code?: string; maxDevices?: number; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };

  const { data, error } = await supabase.rpc('redeem_shwepos_pass', {
    p_pass_code: passCode,
    p_device_id: deviceId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const result = (data || {}) as {
    ok?: boolean;
    code?: string;
    maxDevices?: number;
  };
  return {
    ok: Boolean(result.ok),
    code: result.code,
    maxDevices: result.maxDevices,
  };
}

// ---------- Supabase Admin Panel Helpers ----------

export async function fetchSupabaseAdminData(): Promise<{
  passes: AccessPass[];
  licenses: UserLicense[];
  shops: SupabaseShopRow[];
  error?: string;
}> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return { passes: [], licenses: [], shops: [], error: 'Supabase not configured.' };
  }

  const [passesRes, licensesRes, shopsRes] = await Promise.all([
    supabase.from('pos_access_passes').select('*').order('created_at', { ascending: false }),
    supabase.from('pos_user_licenses').select('*').order('updated_at', { ascending: false }),
    supabase.from('pos_shops').select('*').order('updated_at', { ascending: false }),
  ]);

  const err = passesRes.error || licensesRes.error || shopsRes.error;
  if (err) {
    return { passes: [], licenses: [], shops: [], error: err.message };
  }

  return {
    passes: (passesRes.data || []).map((r) => mapPassRow(r as Record<string, unknown>)),
    licenses: (licensesRes.data || []).map((r) => mapLicenseRow(r as Record<string, unknown>)),
    shops: (shopsRes.data || []).map((r) => ({
      id: String(r.owner_id),
      ownerId: String(r.owner_id),
      shopName: String(r.shop_name || 'Lin Pos System Shop'),
      shopSubtitle: String(r.shop_subtitle || ''),
      phone: String(r.phone || ''),
      address: String(r.address || ''),
      receiptFooter: String(r.receipt_footer || ''),
      currency: 'MMK',
      defaultMarginPercent: Number(r.default_margin_percent ?? 20),
      telegramEnabled: Boolean(r.telegram_enabled),
      telegramBotToken: typeof r.telegram_bot_token === 'string' ? r.telegram_bot_token : '',
      telegramChatId: typeof r.telegram_chat_id === 'string' ? r.telegram_chat_id : '',
    })),
  };
}

export async function createSupabaseAccessPass(pass: {
  code: string;
  label: string;
  note: string;
  durationDays: number;
  expiresAtMs: number;
  maxDevices: number;
  createdBy: string;
  assignedEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };

  const expIso = new Date(pass.expiresAtMs).toISOString();
  const { error } = await supabase.from('pos_access_passes').upsert({
    code: pass.code,
    label: pass.label,
    note: pass.note,
    status: 'active',
    duration_days: pass.durationDays,
    expires_at: expIso,
    subscription_expiry: expIso,
    max_devices: pass.maxDevices,
    bound_devices: [],
    assigned_uid: '',
    assigned_email: (pass.assignedEmail || '').trim().toLowerCase().slice(0, 160),
    created_by: pass.createdBy,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminCreateSupabaseUserAndBindPass(input: {
  email: string;
  password: string;
  label: string;
  note: string;
  passCode: string;
  durationDays: number;
  expiresAtMs: number;
  maxDevices: number;
  createdBy: string;
}): Promise<{
  ok: boolean;
  userId?: string;
  needsEmailConfirm?: boolean;
  error?: string;
}> {
  const supabase = getClientSupabase();
  const { url, anonKey } = getClientSupabaseCredentials();
  if (!supabase || !url || !anonKey) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const expIso = new Date(input.expiresAtMs).toISOString();
  const nowIso = new Date().toISOString();

  // 1. Try privileged server-side endpoint first (auto-confirms email when SERVICE_ROLE_KEY is set)
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token || '';
    if (accessToken) {
      const resp = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: input.password,
          label: input.label,
          note: input.note,
          passCode: input.passCode,
          durationDays: input.durationDays,
          expiresAtMs: input.expiresAtMs,
          maxDevices: input.maxDevices,
        }),
      });
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await resp.json()) as {
          ok?: boolean;
          code?: string;
          userId?: string;
          error?: string;
        };
        if (resp.ok && json.ok && json.userId) {
          return { ok: true, userId: json.userId, needsEmailConfirm: false };
        }
        // Only fall back to client ephemeral signup when server lacks service_role key
        if (json.code !== 'service_role_missing' && resp.status !== 404) {
          return { ok: false, error: json.error || 'Failed to create customer account.' };
        }
      }
    }
  } catch {
    // Static host or network proxy unavailable -> fall back to client ephemeral signup
  }

  // 2. Client fallback using an isolated non-persisting Supabase client so Admin session stays intact
  const ephemeral = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'linpos_ephemeral_admin_signup',
    },
  });

  const { data: signUpData, error: signUpErr } = await ephemeral.auth.signUp({
    email: cleanEmail,
    password: input.password,
    options: {
      data: {
        full_name: input.label,
      },
    },
  });

  if (signUpErr) {
    return { ok: false, error: signUpErr.message };
  }

  const createdUser = signUpData?.user;
  if (!createdUser?.id) {
    return { ok: false, error: 'Failed to create customer account.' };
  }

  // Supabase returns empty identities array when email already exists (with confirmation enabled)
  if (Array.isArray(createdUser.identities) && createdUser.identities.length === 0) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  const newUid = createdUser.id;
  const needsEmailConfirm = !signUpData.session;

  const { error: passErr } = await supabase.from('pos_access_passes').upsert({
    code: input.passCode,
    label: input.label,
    note: input.note,
    status: 'active',
    duration_days: input.durationDays,
    expires_at: expIso,
    subscription_expiry: expIso,
    max_devices: input.maxDevices,
    bound_devices: [],
    assigned_uid: newUid,
    assigned_email: cleanEmail,
    created_by: input.createdBy,
    updated_at: nowIso,
  });
  if (passErr) return { ok: false, error: `pos_access_passes: ${passErr.message}` };

  const { error: licErr } = await supabase.from('pos_user_licenses').upsert({
    user_id: newUid,
    email: cleanEmail,
    display_name: input.label,
    pass_code: input.passCode,
    label: input.label,
    status: 'active',
    expires_at: expIso,
    subscription_expiry: expIso,
    max_devices: input.maxDevices,
    updated_at: nowIso,
  });
  if (licErr) return { ok: false, error: `pos_user_licenses: ${licErr.message}` };

  const { error: shopErr } = await supabase.from('pos_shops').upsert({
    owner_id: newUid,
    shop_name: input.label,
    shop_subtitle: 'POS & Inventory Management',
    phone: '',
    address: '',
    receipt_footer: 'ဝယ်ယူအားပေးမှုအတွက် အထူးကျေးဇူးတင်ပါသည်။',
    currency: 'MMK',
    default_margin_percent: 25,
    telegram_enabled: false,
    updated_at: nowIso,
  });
  if (shopErr) return { ok: false, error: `pos_shops: ${shopErr.message}` };

  return { ok: true, userId: newUid, needsEmailConfirm };
}

export async function updateSupabaseAccessPass(
  code: string,
  passUpdates: {
    label?: string;
    note?: string;
    status?: 'active' | 'revoked';
    durationDays?: number;
    expiresAtMs?: number;
    maxDevices?: number;
    boundDevices?: string[];
    assignedUid?: string;
    assignedEmail?: string;
  },
  linkedLicenseUpdate?: {
    userId: string;
    label?: string;
    status?: 'active' | 'revoked';
    expiresAtMs?: number;
    maxDevices?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (passUpdates.label !== undefined) row.label = passUpdates.label;
  if (passUpdates.note !== undefined) row.note = passUpdates.note;
  if (passUpdates.status !== undefined) row.status = passUpdates.status;
  if (passUpdates.durationDays !== undefined) row.duration_days = passUpdates.durationDays;
  if (passUpdates.expiresAtMs !== undefined) {
    const iso = new Date(passUpdates.expiresAtMs).toISOString();
    row.expires_at = iso;
    row.subscription_expiry = iso;
  }
  if (passUpdates.maxDevices !== undefined) row.max_devices = passUpdates.maxDevices;
  if (passUpdates.boundDevices !== undefined) row.bound_devices = passUpdates.boundDevices;
  if (passUpdates.assignedUid !== undefined) row.assigned_uid = passUpdates.assignedUid;
  if (passUpdates.assignedEmail !== undefined) row.assigned_email = passUpdates.assignedEmail;

  const { error } = await supabase.from('pos_access_passes').update(row).eq('code', code);
  if (error) return { ok: false, error: error.message };

  if (linkedLicenseUpdate) {
    const licRow: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (linkedLicenseUpdate.label !== undefined) licRow.label = linkedLicenseUpdate.label;
    if (linkedLicenseUpdate.status !== undefined) licRow.status = linkedLicenseUpdate.status;
    if (linkedLicenseUpdate.expiresAtMs !== undefined) {
      const iso = new Date(linkedLicenseUpdate.expiresAtMs).toISOString();
      licRow.expires_at = iso;
      licRow.subscription_expiry = iso;
    }
    if (linkedLicenseUpdate.maxDevices !== undefined) {
      licRow.max_devices = linkedLicenseUpdate.maxDevices;
    }
    const { error: licErr } = await supabase
      .from('pos_user_licenses')
      .update(licRow)
      .eq('user_id', linkedLicenseUpdate.userId);
    if (licErr) return { ok: false, error: licErr.message };
  }

  return { ok: true };
}

export async function deleteSupabaseAccessPass(
  code: string,
  linkedUserId?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };

  if (linkedUserId) {
    await supabase
      .from('pos_user_licenses')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('user_id', linkedUserId)
      .eq('pass_code', code);
  }
  const { error } = await supabase.from('pos_access_passes').delete().eq('code', code);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSupabaseShopProfile(
  ownerId: string,
  updates: {
    shopName: string;
    shopSubtitle: string;
    phone: string;
    address: string;
    defaultMarginPercent: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };

  const { error } = await supabase
    .from('pos_shops')
    .update({
      shop_name: updates.shopName,
      shop_subtitle: updates.shopSubtitle,
      phone: updates.phone,
      address: updates.address,
      default_margin_percent: updates.defaultMarginPercent,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', ownerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------- Single-Record POS CRUD Helpers for Full Supabase Cloud Mode ----------

export async function upsertSupabaseShop(
  ownerId: string,
  shop: ShopSettings
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const baseRow = {
    owner_id: ownerId,
    shop_name: shop.shopName,
    shop_subtitle: shop.shopSubtitle || '',
    phone: shop.phone || '',
    address: shop.address || '',
    receipt_footer: shop.receiptFooter || '',
    currency: shop.currency || 'MMK',
    default_margin_percent: Number(shop.defaultMarginPercent || 20),
    telegram_enabled: Boolean(shop.telegramEnabled),
    updated_at: new Date().toISOString(),
  };
  const withTg = {
    ...baseRow,
    telegram_bot_token: (shop.telegramBotToken || '').trim(),
    telegram_chat_id: (shop.telegramChatId || '').trim(),
  };
  let { error } = await supabase.from('pos_shops').upsert(withTg);
  if (error && /telegram_(bot_token|chat_id)|PGRST204/i.test(error.message)) {
    const retry = await supabase.from('pos_shops').upsert(baseRow);
    error = retry.error;
  }
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseProduct(
  ownerId: string,
  p: Product
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_products').upsert({
    id: String(p.id),
    owner_id: ownerId,
    sku: String(p.sku || ''),
    name: String(p.name || ''),
    category: String(p.category || ''),
    unit: String(p.unit || 'pcs'),
    cost_price: Number(p.costPrice || 0),
    margin_percent: Number(p.marginPercent || 0),
    sell_price: Number(p.sellPrice || 0),
    stock: Number(p.stock || 0),
    min_stock: Number(p.minStock || 5),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseProduct(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_products').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseSale(
  ownerId: string,
  s: Sale
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_sales').upsert({
    id: String(s.id),
    owner_id: ownerId,
    voucher_no: String(s.voucherNo || ''),
    date: String(s.date || ''),
    customer_name: String(s.customerName || ''),
    customer_phone: String(s.customerPhone || ''),
    payment_method: String(s.paymentMethod || 'cash'),
    items: s.items || [],
    subtotal: Number(s.subtotal || 0),
    discount: Number(s.discount || 0),
    total: Number(s.total || 0),
    total_cost: Number(s.totalCost || 0),
    profit: Number(s.profit || 0),
    paid_amount: Number(s.paidAmount || 0),
    note: String(s.note || ''),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseSale(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_sales').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabasePurchase(
  ownerId: string,
  p: Purchase
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_purchases').upsert({
    id: String(p.id),
    owner_id: ownerId,
    ref_no: String(p.refNo || ''),
    date: String(p.date || ''),
    supplier_name: String(p.supplierName || ''),
    items: p.items || [],
    total_amount: Number(p.totalAmount || 0),
    paid_amount: Number(p.paidAmount || 0),
    status: String(p.status || 'paid'),
    note: String(p.note || ''),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabasePurchase(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_purchases').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseStockLog(
  ownerId: string,
  l: StockLog
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_stock_logs').upsert({
    id: String(l.id),
    owner_id: ownerId,
    product_id: String(l.productId || ''),
    product_name: String(l.productName || ''),
    type: String(l.type || 'adjust'),
    quantity: Number(l.quantity || 0),
    previous_stock: Number(l.previousStock || 0),
    new_stock: Number(l.newStock || 0),
    reason: String(l.reason || ''),
    date: String(l.date || ''),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseStockLog(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_stock_logs').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseDebt(
  ownerId: string,
  d: Debt
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_debts').upsert({
    id: String(d.id),
    owner_id: ownerId,
    type: String(d.type || 'receivable'),
    party_name: String(d.partyName || ''),
    phone: String(d.phone || ''),
    reference_no: String(d.referenceNo || ''),
    total_amount: Number(d.totalAmount || 0),
    paid_amount: Number(d.paidAmount || 0),
    remaining_amount: Number(d.remainingAmount || 0),
    due_date: String(d.dueDate || ''),
    status: String(d.status || 'pending'),
    note: String(d.note || ''),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseDebt(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_debts').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseExpense(
  ownerId: string,
  e: Expense
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_expenses').upsert({
    id: String(e.id),
    owner_id: ownerId,
    date: String(e.date || ''),
    category: String(e.category || ''),
    title: String(e.title || ''),
    amount: Number(e.amount || 0),
    note: String(e.note || ''),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseExpense(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_expenses').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertSupabaseDelivery(
  ownerId: string,
  d: Delivery
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_deliveries').upsert({
    id: String(d.id),
    owner_id: ownerId,
    voucher_no: String(d.voucherNo || ''),
    date: String(d.date || ''),
    customer_name: String(d.customerName || ''),
    phone: String(d.phone || ''),
    address: String(d.address || ''),
    courier_name: String(d.courierName || ''),
    delivery_fee: Number(d.deliveryFee || 0),
    cod_amount: Number(d.codAmount || 0),
    status: String(d.status || 'pending'),
    note: String(d.note || ''),
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupabaseDelivery(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  const { error } = await supabase.from('pos_deliveries').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------- Bulk Push / Pull Helpers ----------

export async function pushPosDataDirectToSupabase(
  payload: SupabaseSyncPayload
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return {
      ok: false,
      error:
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY) in your Web environment variables and redeploy.',
    };
  }

  const { ownerId, shop, products, sales, purchases, stockLogs, debts, expenses, deliveries } =
    payload;

  try {
    if (shop) {
      const shopRes = await upsertSupabaseShop(ownerId, shop);
      if (!shopRes.ok) throw new Error(`pos_shops: ${shopRes.error}`);
    }

    if (products.length > 0) {
      const rows = products.map((p) => ({
        id: String(p.id),
        owner_id: ownerId,
        sku: String(p.sku || ''),
        name: String(p.name || ''),
        category: String(p.category || ''),
        unit: String(p.unit || 'pcs'),
        cost_price: Number(p.costPrice || 0),
        margin_percent: Number(p.marginPercent || 0),
        sell_price: Number(p.sellPrice || 0),
        stock: Number(p.stock || 0),
        min_stock: Number(p.minStock || 5),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_products').upsert(rows);
      if (error) throw new Error(`pos_products: ${error.message}`);
    }

    if (sales.length > 0) {
      const rows = sales.map((s) => ({
        id: String(s.id),
        owner_id: ownerId,
        voucher_no: String(s.voucherNo || ''),
        date: String(s.date || ''),
        customer_name: String(s.customerName || ''),
        customer_phone: String(s.customerPhone || ''),
        payment_method: String(s.paymentMethod || 'cash'),
        items: s.items || [],
        subtotal: Number(s.subtotal || 0),
        discount: Number(s.discount || 0),
        total: Number(s.total || 0),
        total_cost: Number(s.totalCost || 0),
        profit: Number(s.profit || 0),
        paid_amount: Number(s.paidAmount || 0),
        note: String(s.note || ''),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_sales').upsert(rows);
      if (error) throw new Error(`pos_sales: ${error.message}`);
    }

    if (purchases.length > 0) {
      const rows = purchases.map((p) => ({
        id: String(p.id),
        owner_id: ownerId,
        ref_no: String(p.refNo || ''),
        date: String(p.date || ''),
        supplier_name: String(p.supplierName || ''),
        items: p.items || [],
        total_amount: Number(p.totalAmount || 0),
        paid_amount: Number(p.paidAmount || 0),
        status: String(p.status || 'paid'),
        note: String(p.note || ''),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_purchases').upsert(rows);
      if (error) throw new Error(`pos_purchases: ${error.message}`);
    }

    if (stockLogs.length > 0) {
      const rows = stockLogs.map((l) => ({
        id: String(l.id),
        owner_id: ownerId,
        product_id: String(l.productId || ''),
        product_name: String(l.productName || ''),
        type: String(l.type || 'adjust'),
        quantity: Number(l.quantity || 0),
        previous_stock: Number(l.previousStock || 0),
        new_stock: Number(l.newStock || 0),
        reason: String(l.reason || ''),
        date: String(l.date || ''),
      }));
      const { error } = await supabase.from('pos_stock_logs').upsert(rows);
      if (error) throw new Error(`pos_stock_logs: ${error.message}`);
    }

    if (debts.length > 0) {
      const rows = debts.map((d) => ({
        id: String(d.id),
        owner_id: ownerId,
        type: String(d.type || 'receivable'),
        party_name: String(d.partyName || ''),
        phone: String(d.phone || ''),
        reference_no: String(d.referenceNo || ''),
        total_amount: Number(d.totalAmount || 0),
        paid_amount: Number(d.paidAmount || 0),
        remaining_amount: Number(d.remainingAmount || 0),
        due_date: String(d.dueDate || ''),
        status: String(d.status || 'pending'),
        note: String(d.note || ''),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_debts').upsert(rows);
      if (error) throw new Error(`pos_debts: ${error.message}`);
    }

    if (expenses.length > 0) {
      const rows = expenses.map((e) => ({
        id: String(e.id),
        owner_id: ownerId,
        date: String(e.date || ''),
        category: String(e.category || ''),
        title: String(e.title || ''),
        amount: Number(e.amount || 0),
        note: String(e.note || ''),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_expenses').upsert(rows);
      if (error) throw new Error(`pos_expenses: ${error.message}`);
    }

    if (deliveries.length > 0) {
      const rows = deliveries.map((d) => ({
        id: String(d.id),
        owner_id: ownerId,
        voucher_no: String(d.voucherNo || ''),
        date: String(d.date || ''),
        customer_name: String(d.customerName || ''),
        phone: String(d.phone || ''),
        address: String(d.address || ''),
        courier_name: String(d.courierName || ''),
        delivery_fee: Number(d.deliveryFee || 0),
        cod_amount: Number(d.codAmount || 0),
        status: String(d.status || 'pending'),
        note: String(d.note || ''),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('pos_deliveries').upsert(rows);
      if (error) throw new Error(`pos_deliveries: ${error.message}`);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Supabase sync failed.';
    if (msg.toLowerCase().includes('row-level security')) {
      return {
        ok: false,
        error:
          'Supabase RLS Policy Blocked: Please copy the SQL + RLS Schema from Settings and run it in Supabase SQL Editor.',
      };
    }
    return { ok: false, error: msg };
  }
}

export async function pullPosDataDirectFromSupabase(
  ownerId: string
): Promise<{ ok: boolean; error?: string; data?: PosBackupPayload }> {
  const supabase = getClientSupabase();
  if (!supabase) {
    return {
      ok: false,
      error:
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY) in your Web environment variables.',
    };
  }

  try {
    const [shopRes, prodRes, salesRes, purchRes, logsRes, debtsRes, expRes, delivRes] =
      await Promise.all([
        supabase.from('pos_shops').select('*').eq('owner_id', ownerId).maybeSingle(),
        supabase.from('pos_products').select('*').eq('owner_id', ownerId),
        supabase.from('pos_sales').select('*').eq('owner_id', ownerId),
        supabase.from('pos_purchases').select('*').eq('owner_id', ownerId),
        supabase.from('pos_stock_logs').select('*').eq('owner_id', ownerId),
        supabase.from('pos_debts').select('*').eq('owner_id', ownerId),
        supabase.from('pos_expenses').select('*').eq('owner_id', ownerId),
        supabase.from('pos_deliveries').select('*').eq('owner_id', ownerId),
      ]);

    const firstError =
      shopRes.error ||
      prodRes.error ||
      salesRes.error ||
      purchRes.error ||
      logsRes.error ||
      debtsRes.error ||
      expRes.error ||
      delivRes.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    const data: PosBackupPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shop: shopRes.data
        ? {
            shopName: shopRes.data.shop_name,
            shopSubtitle: shopRes.data.shop_subtitle || '',
            phone: shopRes.data.phone || '',
            address: shopRes.data.address || '',
            receiptFooter: shopRes.data.receipt_footer || '',
            currency: 'MMK',
            defaultMarginPercent: Number(shopRes.data.default_margin_percent || 20),
            telegramEnabled: Boolean(shopRes.data.telegram_enabled),
            telegramBotToken:
              typeof shopRes.data.telegram_bot_token === 'string'
                ? shopRes.data.telegram_bot_token
                : '',
            telegramChatId:
              typeof shopRes.data.telegram_chat_id === 'string'
                ? shopRes.data.telegram_chat_id
                : '',
          }
        : (null as unknown as PosBackupPayload['shop']),
      products: (prodRes.data || []).map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        costPrice: Number(r.cost_price),
        marginPercent: Number(r.margin_percent),
        sellPrice: Number(r.sell_price),
        stock: Number(r.stock),
        minStock: Number(r.min_stock),
      })),
      sales: (salesRes.data || [])
        .map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          voucherNo: r.voucher_no,
          date: r.date,
          customerName: r.customer_name || '',
          customerPhone: r.customer_phone || '',
          paymentMethod: r.payment_method,
          items: r.items || [],
          subtotal: Number(r.subtotal),
          discount: Number(r.discount),
          total: Number(r.total),
          totalCost: Number(r.total_cost),
          profit: Number(r.profit),
          paidAmount: Number(r.paid_amount),
          note: r.note || '',
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      purchases: (purchRes.data || [])
        .map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          refNo: r.ref_no,
          date: r.date,
          supplierName: r.supplier_name,
          items: r.items || [],
          totalAmount: Number(r.total_amount),
          paidAmount: Number(r.paid_amount),
          status: r.status,
          note: r.note || '',
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      stockLogs: (logsRes.data || [])
        .map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          productId: r.product_id,
          productName: r.product_name,
          type: r.type,
          quantity: Number(r.quantity),
          previousStock: Number(r.previous_stock),
          newStock: Number(r.new_stock),
          reason: r.reason,
          date: r.date,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      debts: (debtsRes.data || []).map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        type: r.type,
        partyName: r.party_name,
        phone: r.phone || '',
        referenceNo: r.reference_no || '',
        totalAmount: Number(r.total_amount),
        paidAmount: Number(r.paid_amount),
        remainingAmount: Number(r.remaining_amount),
        dueDate: r.due_date,
        status: r.status,
        note: r.note || '',
      })),
      expenses: (expRes.data || [])
        .map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          date: r.date,
          category: r.category,
          title: r.title,
          amount: Number(r.amount),
          note: r.note || '',
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      deliveries: (delivRes.data || [])
        .map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          voucherNo: r.voucher_no,
          date: r.date,
          customerName: r.customer_name,
          phone: r.phone || '',
          address: r.address,
          courierName: r.courier_name,
          deliveryFee: Number(r.delivery_fee),
          codAmount: Number(r.cod_amount),
          status: r.status,
          note: r.note || '',
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to pull data from Supabase.',
    };
  }
}
