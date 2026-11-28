import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface VercelReq extends IncomingMessage {
  body?: unknown;
}

interface VercelRes extends ServerResponse {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceRoleKey) {
    return res.status(501).json({
      ok: false,
      code: 'service_role_missing',
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.',
    });
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization Bearer token.' });
  }

  try {
    const supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    const caller = callerData?.user;
    if (
      callerErr ||
      !caller ||
      (caller.email || '').trim().toLowerCase() !== 'loveking20178@gmail.com'
    ) {
      return res.status(403).json({ ok: false, error: 'Administrator privileges required.' });
    }

    const body = parseBody(req.body);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rawLabel = typeof body.label === 'string' ? body.label.trim() : '';
    const label = (rawLabel || 'Customer Shop').slice(0, 120);
    const note = (typeof body.note === 'string' ? body.note.trim() : '').slice(0, 240);
    const rawCode = typeof body.passCode === 'string' ? body.passCode : '';
    const passCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
    const durationDays = Math.min(3650, Math.max(1, Math.round(Number(body.durationDays) || 30)));
    const expiresAtMs = Number(body.expiresAtMs);
    const maxDevices = Math.min(50, Math.max(1, Math.round(Number(body.maxDevices) || 1)));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return res.status(400).json({ ok: false, error: 'Invalid customer email address.' });
    }
    if (password.length < 6 || password.length > 128) {
      return res
        .status(400)
        .json({ ok: false, error: 'Password must be between 6 and 128 characters.' });
    }
    if (passCode.length < 6) {
      return res
        .status(400)
        .json({ ok: false, error: 'Access pass code must be at least 6 characters.' });
    }
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return res.status(400).json({ ok: false, error: 'Expiry date must be in the future.' });
    }

    const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: label },
    });

    if (createErr || !createdData?.user) {
      const msg = createErr?.message || 'Failed to create user account.';
      const isDup = /already|exists|registered/i.test(msg);
      return res.status(isDup ? 409 : 400).json({
        ok: false,
        code: isDup ? 'email_exists' : 'create_failed',
        error: msg,
      });
    }

    const newUid = createdData.user.id;
    const expIso = new Date(expiresAtMs).toISOString();
    const nowIso = new Date().toISOString();

    const { error: passErr } = await supabaseAdmin.from('pos_access_passes').upsert({
      code: passCode,
      label,
      note,
      status: 'active',
      duration_days: durationDays,
      expires_at: expIso,
      subscription_expiry: expIso,
      max_devices: maxDevices,
      bound_devices: [],
      assigned_uid: newUid,
      assigned_email: email,
      created_by: caller.id,
      updated_at: nowIso,
    });
    if (passErr) throw new Error(`pos_access_passes: ${passErr.message}`);

    const { error: licErr } = await supabaseAdmin.from('pos_user_licenses').upsert({
      user_id: newUid,
      email,
      display_name: label,
      pass_code: passCode,
      label,
      status: 'active',
      expires_at: expIso,
      subscription_expiry: expIso,
      max_devices: maxDevices,
      updated_at: nowIso,
    });
    if (licErr) throw new Error(`pos_user_licenses: ${licErr.message}`);

    const { error: shopErr } = await supabaseAdmin.from('pos_shops').upsert({
      owner_id: newUid,
      shop_name: label,
      shop_subtitle: 'POS & Inventory Management',
      phone: '',
      address: '',
      receipt_footer: 'ဝယ်ယူအားပေးမှုအတွက် အထူးကျေးဇူးတင်ပါသည်။',
      currency: 'MMK',
      default_margin_percent: 25,
      telegram_enabled: false,
      updated_at: nowIso,
    });
    if (shopErr) throw new Error(`pos_shops: ${shopErr.message}`);

    return res.status(200).json({
      ok: true,
      userId: newUid,
      email,
      passCode,
    });
  } catch (err) {
    console.error('Admin create-user error:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create customer account.',
    });
  }
}
