import crypto from 'crypto';
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

function getClientIp(req: VercelReq): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : '';
  return (first || req.socket?.remoteAddress || 'unknown').trim().slice(0, 64);
}

const passLoginAttempts = new Map<string, { count: number; resetAt: number }>();

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  const nowMs = Date.now();
  if (passLoginAttempts.size > 500) {
    for (const [k, v] of passLoginAttempts.entries()) {
      if (v.resetAt <= nowMs) passLoginAttempts.delete(k);
    }
  }
  const curRate = passLoginAttempts.get(clientIp);
  if (curRate && curRate.resetAt > nowMs) {
    if (curRate.count >= 25) {
      return res.status(429).json({
        ok: false,
        code: 'rate_limited',
        error: 'Too many login link attempts. Please wait a few minutes.',
      });
    }
    curRate.count += 1;
  } else {
    passLoginAttempts.set(clientIp, { count: 1, resetAt: nowMs + 10 * 60 * 1000 });
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

  const body = parseBody(req.body);
  const rawCode = typeof body.passCode === 'string' ? body.passCode : '';
  const passCode = rawCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40);
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim().slice(0, 64) : '';

  if (passCode.length < 6) {
    return res.status(400).json({ ok: false, code: 'invalid_format', error: 'Invalid access pass.' });
  }
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId)) {
    return res.status(400).json({ ok: false, code: 'invalid_device', error: 'Invalid device ID.' });
  }

  try {
    const supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: passRow, error: passErr } = await supabaseAdmin
      .from('pos_access_passes')
      .select('*')
      .eq('code', passCode)
      .maybeSingle();

    if (passErr) {
      throw new Error(`pos_access_passes: ${passErr.message}`);
    }
    if (!passRow) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Access pass not found.' });
    }
    if (passRow.status !== 'active') {
      return res.status(403).json({ ok: false, code: 'revoked', error: 'Access pass is revoked.' });
    }

    const expA = Date.parse(String(passRow.expires_at || ''));
    const expB = Date.parse(String(passRow.subscription_expiry || ''));
    const effectiveExpMs = Math.min(
      Number.isFinite(expA) ? expA : Infinity,
      Number.isFinite(expB) ? expB : Infinity
    );
    if (!Number.isFinite(effectiveExpMs) || effectiveExpMs <= nowMs) {
      return res.status(403).json({ ok: false, code: 'expired', error: 'Access pass has expired.' });
    }

    const existingEmail = String(passRow.assigned_email || '').trim().toLowerCase();
    if (existingEmail === 'loveking20178@gmail.com') {
      return res.status(403).json({
        ok: false,
        code: 'admin_restricted',
        error: 'Admin accounts cannot sign in via pass link.',
      });
    }

    const maxDevices = Math.max(1, Number(passRow.max_devices || 1));
    const existingDevices: string[] = Array.isArray(passRow.bound_devices)
      ? passRow.bound_devices.map(String)
      : [];
    const nextDevices = existingDevices.includes(deviceId)
      ? existingDevices
      : [...existingDevices, deviceId];

    if (nextDevices.length > maxDevices) {
      return res.status(403).json({
        ok: false,
        code: 'device_limit',
        maxDevices,
        error: `Device limit (${maxDevices}) reached.`,
      });
    }

    let targetUid = String(passRow.assigned_uid || '').trim();
    let targetEmail = existingEmail;

    if (targetUid) {
      const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(targetUid);
      if (!userErr && userRes?.user) {
        targetEmail = (userRes.user.email || targetEmail).trim().toLowerCase();
      } else {
        targetUid = '';
      }
    }

    if (targetEmail === 'loveking20178@gmail.com') {
      return res.status(403).json({
        ok: false,
        code: 'admin_restricted',
        error: 'Admin accounts cannot sign in via pass link.',
      });
    }

    if (!targetEmail) {
      const slug = passCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      targetEmail = `key.${slug}@linpos.local`;
    }

    if (!targetUid) {
      const randomPassword = crypto.randomBytes(24).toString('base64url');
      const { data: createdData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: String(passRow.label || 'Customer Shop').slice(0, 120),
        },
      });
      if (!createErr && createdData?.user?.id) {
        targetUid = createdData.user.id;
      }
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token || !linkData?.user?.id) {
      throw new Error(linkErr?.message || 'Unable to generate sign-in link.');
    }

    const finalUid = targetUid || linkData.user.id;
    const finalEmail = (linkData.user.email || targetEmail).trim().toLowerCase();

    if (finalEmail === 'loveking20178@gmail.com') {
      return res.status(403).json({
        ok: false,
        code: 'admin_restricted',
        error: 'Admin accounts cannot sign in via pass link.',
      });
    }

    if (!linkData.user.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(finalUid, { email_confirm: true });
    }

    const nowIso = new Date().toISOString();
    const safeLabel = String(passRow.label || 'Customer Shop').slice(0, 120);

    const { error: updatePassErr } = await supabaseAdmin
      .from('pos_access_passes')
      .update({
        assigned_uid: finalUid,
        assigned_email: finalEmail.slice(0, 160),
        bound_devices: nextDevices,
        updated_at: nowIso,
      })
      .eq('code', passCode);
    if (updatePassErr) {
      throw new Error(`pos_access_passes update: ${updatePassErr.message}`);
    }

    const { error: licErr } = await supabaseAdmin.from('pos_user_licenses').upsert({
      user_id: finalUid,
      email: finalEmail.slice(0, 160),
      display_name: safeLabel,
      pass_code: passCode,
      label: safeLabel,
      status: 'active',
      expires_at: passRow.expires_at,
      subscription_expiry: passRow.subscription_expiry,
      max_devices: maxDevices,
      updated_at: nowIso,
    });
    if (licErr) {
      throw new Error(`pos_user_licenses upsert: ${licErr.message}`);
    }

    const { data: existingShop } = await supabaseAdmin
      .from('pos_shops')
      .select('owner_id')
      .eq('owner_id', finalUid)
      .maybeSingle();

    if (!existingShop) {
      await supabaseAdmin.from('pos_shops').upsert({
        owner_id: finalUid,
        shop_name: safeLabel,
        shop_subtitle: 'POS & Inventory Management',
        phone: '',
        address: '',
        receipt_footer: 'ဝယ်ယူအားပေးမှုအတွက် အထူးကျေးဇူးတင်ပါသည်။',
        currency: 'MMK',
        default_margin_percent: 25,
        telegram_enabled: false,
        updated_at: nowIso,
      });
    }

    return res.status(200).json({
      ok: true,
      tokenHash: linkData.properties.hashed_token,
      email: finalEmail,
      label: safeLabel,
    });
  } catch (err) {
    console.error('Pass-link login error:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to authenticate via access pass link.',
    });
  }
}
