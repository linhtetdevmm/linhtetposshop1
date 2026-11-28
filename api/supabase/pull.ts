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
      error: 'Supabase is not configured in server environment variables.',
    });
  }

  const body = parseBody(req.body);
  const ownerId = typeof body.ownerId === 'string' ? body.ownerId : '';
  if (!ownerId) {
    return res.status(400).json({ ok: false, error: 'ownerId is required.' });
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Authentication required for cloud restore.' });
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

    return res.status(200).json({
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
}
