import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  let lastSupabaseProbe: {
    reachable: boolean;
    error: string | null;
    checkedAt: number;
  } | null = null;

  async function probeSupabaseHealth(
    url: string,
    key: string,
    force = false
  ): Promise<{ reachable: boolean; error: string | null; checkedAt: string }> {
    const now = Date.now();
    if (!force && lastSupabaseProbe && now - lastSupabaseProbe.checkedAt < 15000) {
      return {
        reachable: lastSupabaseProbe.reachable,
        error: lastSupabaseProbe.error,
        checkedAt: new Date(lastSupabaseProbe.checkedAt).toISOString(),
      };
    }

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
      const reachable = !result.error;
      const errorMsg = result.error ? result.error.message : null;
      lastSupabaseProbe = { reachable, error: errorMsg, checkedAt: now };
      return { reachable, error: errorMsg, checkedAt: new Date(now).toISOString() };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to reach Supabase';
      lastSupabaseProbe = { reachable: false, error: errorMsg, checkedAt: now };
      return { reachable: false, error: errorMsg, checkedAt: new Date(now).toISOString() };
    }
  }

  // Check configured server-side integrations and backend health without exposing secrets
  app.get('/api/integrations/status', async (req, res) => {
    const { token, chatId } = getTelegramConfig();
    const { url, key } = getSupabaseConfig();
    const supabaseConfigured = Boolean(url && key);
    const force = req.query.force === '1' || req.query.force === 'true';

    let supabaseReachable: boolean | null = null;
    let supabaseError: string | null = null;
    let checkedAt = new Date().toISOString();

    if (supabaseConfigured) {
      const health = await probeSupabaseHealth(url, key, force);
      supabaseReachable = health.reachable;
      supabaseError = health.error;
      checkedAt = health.checkedAt;
    }

    res.json({
      telegramConfigured: Boolean(token && chatId),
      supabaseConfigured,
      supabaseReachable,
      supabaseError,
      checkedAt,
    });
  });

  // Telegram Bot Proxy Endpoint (supports per-shop user credentials with server env fallback)
  app.post('/api/telegram/send', async (req, res) => {
    const envCfg = getTelegramConfig();
    const { message, botToken, chatId: reqChatId } = req.body as {
      message?: string;
      botToken?: string;
      chatId?: string;
    };

    const userToken = typeof botToken === 'string' ? botToken.trim() : '';
    const userChatId = typeof reqChatId === 'string' ? reqChatId.trim() : '';
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

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
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

      return res.json({ ok: true });
    } catch (err) {
      console.error('Telegram API proxy error:', err);
      return res.status(500).json({ ok: false, error: 'Network error sending Telegram alert.' });
    }
  });

  // Supabase Push Sync Proxy Endpoint
  app.post('/api/supabase/sync', async (req, res) => {
    const { url, key } = getSupabaseConfig();

    if (!url || !key) {
      return res.status(400).json({
        ok: false,
        error:
          'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY / VITE_SUPABASE_*) to your environment secrets and run supabase_schema.sql.',
      });
    }

    const { ownerId, shop, products, sales, purchases, stockLogs, debts, expenses, deliveries } =
      req.body || {};

    if (!ownerId || typeof ownerId !== 'string') {
      return res.status(400).json({ ok: false, error: 'ownerId is required for Supabase sync.' });
    }

    try {
      const supabase = createClient(url, key);

      if (shop) {
        const { error } = await supabase.from('pos_shops').upsert({
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
        });
        if (error) throw new Error(`pos_shops: ${error.message}`);
      }

      if (Array.isArray(products) && products.length > 0) {
        const rows = products.map((p: Record<string, unknown>) => ({
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

      if (Array.isArray(sales) && sales.length > 0) {
        const rows = sales.map((s: Record<string, unknown>) => ({
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

      if (Array.isArray(purchases) && purchases.length > 0) {
        const rows = purchases.map((p: Record<string, unknown>) => ({
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

      if (Array.isArray(stockLogs) && stockLogs.length > 0) {
        const rows = stockLogs.map((l: Record<string, unknown>) => ({
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

      if (Array.isArray(debts) && debts.length > 0) {
        const rows = debts.map((d: Record<string, unknown>) => ({
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

      if (Array.isArray(expenses) && expenses.length > 0) {
        const rows = expenses.map((e: Record<string, unknown>) => ({
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

      if (Array.isArray(deliveries) && deliveries.length > 0) {
        const rows = deliveries.map((d: Record<string, unknown>) => ({
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

      return res.json({
        ok: true,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Supabase sync failed.';
      if (msg.toLowerCase().includes('row-level security')) {
        return res.status(403).json({
          ok: false,
          error:
            'Supabase RLS Policy Blocked: Please copy/download the updated SQL Schema from Settings and run it in Supabase SQL Editor (or add SUPABASE_SERVICE_ROLE_KEY to secrets).',
        });
      }
      console.error('Supabase sync error:', err);
      return res.status(500).json({
        ok: false,
        error: msg,
      });
    }
  });

  // Supabase Pull Sync Proxy Endpoint
  app.post('/api/supabase/pull', async (req, res) => {
    const { url, key } = getSupabaseConfig();

    if (!url || !key) {
      return res.status(400).json({
        ok: false,
        error: 'Supabase is not configured in server environment variables.',
      });
    }

    const { ownerId } = req.body as { ownerId?: string };
    if (!ownerId) {
      return res.status(400).json({ ok: false, error: 'ownerId is required.' });
    }

    try {
      const supabase = createClient(url, key);
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

      return res.json({
        ok: true,
        data: {
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
              }
            : null,
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
          sales: (salesRes.data || []).map((r) => ({
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
          })),
          purchases: (purchRes.data || []).map((r) => ({
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
          })),
          stockLogs: (logsRes.data || []).map((r) => ({
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
          })),
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
          expenses: (expRes.data || []).map((r) => ({
            id: r.id,
            ownerId: r.owner_id,
            date: r.date,
            category: r.category,
            title: r.title,
            amount: Number(r.amount),
            note: r.note || '',
          })),
          deliveries: (delivRes.data || []).map((r) => ({
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
          })),
        },
      });
    } catch (err) {
      console.error('Supabase pull error:', err);
      return res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to pull data from Supabase.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });

    // When HMR is disabled in middleware mode, Vite 8 still serves /@vite/client
    // with an active WebSocket transport.connect() call against port 24678.
    // Neutralize the WebSocket connection while keeping all exports (updateStyle,
    // removeStyle, createHotContext, injectQuery, ErrorOverlay) intact.
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) return next();
        const patchedCode = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in middleware mode */'
          )
          .replace(
            'setupForwardConsoleHandler(transport, forwardConsole);',
            '/* Console forwarding disabled with HMR */'
          )
          .replace(
            'wsTransport.send(data);',
            '/* HMR send disabled */'
          );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).send(patchedCode);
      } catch (err) {
        return next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShwePOS server running at http://localhost:${PORT}`);
  });
}

startServer();
