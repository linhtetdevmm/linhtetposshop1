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
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return res.status(400).json({
      ok: false,
      error:
        'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY / VITE_SUPABASE_*) to Vercel Environment Variables.',
    });
  }

  const body = parseBody(req.body);
  const { ownerId, shop, products, sales, purchases, stockLogs, debts, expenses, deliveries } =
    body as {
      ownerId?: unknown;
      shop?: Record<string, unknown>;
      products?: Record<string, unknown>[];
      sales?: Record<string, unknown>[];
      purchases?: Record<string, unknown>[];
      stockLogs?: Record<string, unknown>[];
      debts?: Record<string, unknown>[];
      expenses?: Record<string, unknown>[];
      deliveries?: Record<string, unknown>[];
    };

  if (!ownerId || typeof ownerId !== 'string') {
    return res.status(400).json({ ok: false, error: 'ownerId is required for Supabase sync.' });
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Authentication required for cloud sync.' });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerErr } = await supabase.auth.getUser(token);
    const caller = callerData?.user;
    if (callerErr || !caller) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired session.' });
    }
    const isAdminCaller = (caller.email || '').trim().toLowerCase() === 'loveking20178@gmail.com';
    if (caller.id !== ownerId && !isAdminCaller) {
      return res.status(403).json({ ok: false, error: 'Access denied for this shop.' });
    }

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
      const baseRows = products.map((p) => ({
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
      const rowsWithImg = baseRows.map((row, idx) => ({
        ...row,
        image_url: typeof products[idx]?.imageUrl === 'string' ? products[idx].imageUrl : '',
      }));
      let { error } = await supabase.from('pos_products').upsert(rowsWithImg);
      if (error && /image_url|PGRST204/i.test(error.message)) {
        const retry = await supabase.from('pos_products').upsert(baseRows);
        error = retry.error;
      }
      if (error) throw new Error(`pos_products: ${error.message}`);
    }

    if (Array.isArray(sales) && sales.length > 0) {
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

    if (Array.isArray(purchases) && purchases.length > 0) {
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

    if (Array.isArray(stockLogs) && stockLogs.length > 0) {
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

    if (Array.isArray(debts) && debts.length > 0) {
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

    if (Array.isArray(expenses) && expenses.length > 0) {
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

    if (Array.isArray(deliveries) && deliveries.length > 0) {
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

    return res.status(200).json({
      ok: true,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Supabase sync failed.';
    if (msg.toLowerCase().includes('row-level security')) {
      return res.status(403).json({
        ok: false,
        error:
          'Supabase RLS Policy Blocked: Please add SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables.',
      });
    }
    console.error('Supabase sync error:', err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
