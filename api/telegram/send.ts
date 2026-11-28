import type { IncomingMessage, ServerResponse } from 'http';

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

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const envCfg = getTelegramConfig();
  const body = parseBody(req.body);
  const message = typeof body.message === 'string' ? body.message : '';
  const userToken = typeof body.botToken === 'string' ? body.botToken.trim() : '';
  const userChatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';

  const token = userToken || envCfg.token;
  const chatId = userChatId || envCfg.chatId;

  if (!token || !chatId) {
    return res.status(400).json({
      ok: false,
      error:
        'Telegram Bot Token and Chat ID are required. Please configure your own Bot Token & Chat ID in Shop Profile.',
    });
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return res.status(400).json({ ok: false, error: 'Invalid Telegram Bot Token format.' });
  }
  if (!/^[-a-zA-Z0-9_@]{2,64}$/.test(chatId)) {
    return res.status(400).json({ ok: false, error: 'Invalid Telegram Chat ID format.' });
  }
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'Message text is required.' });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.slice(0, 4000),
          parse_mode: 'HTML',
        }),
      }
    );

    const data = (await response.json()) as { ok?: boolean; description?: string };
    if (!response.ok || !data.ok) {
      return res.status(502).json({
        ok: false,
        error: data.description || 'Failed to deliver Telegram message.',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram API proxy error:', err);
    return res.status(500).json({ ok: false, error: 'Network error sending Telegram alert.' });
  }
}
