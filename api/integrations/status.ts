import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface VercelReq extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelRes extends ServerResponse {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
}

function getTelegramConfig() {
  const token = (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.VITE_TELEGRAM_BOT_TOKEN ||
    ''
  ).trim();
  const chatId = (
    process.env.TELEGRAM_CHAT_ID ||
    process.env.VITE_TELEGRAM_CHAT_ID ||
    ''
  ).trim();
  return { token, chatId };
}

function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key };
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { token, chatId } = getTelegramConfig();
  const { url, key } = getSupabaseConfig();
  const supabaseConfigured = Boolean(url && key);

  let supabaseReachable: boolean | null = null;
  let supabaseError: string | null = null;
  const checkedAt = new Date().toISOString();

  if (supabaseConfigured) {
    try {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const probePromise = supabase
        .from('pos_shops')
        .select('owner_id', { count: 'exact', head: true })
        .limit(1);
      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: 'Connection timed out' } }), 3500)
      );
      const result = await Promise.race([probePromise, timeoutPromise]);
      supabaseReachable = !result.error;
      supabaseError = result.error ? result.error.message : null;
    } catch (err) {
      supabaseReachable = false;
      supabaseError = err instanceof Error ? err.message : 'Unable to reach Supabase';
    }
  }

  return res.status(200).json({
    telegramConfigured: Boolean(token && chatId),
    supabaseConfigured,
    supabaseReachable,
    supabaseError,
    checkedAt,
  });
}
