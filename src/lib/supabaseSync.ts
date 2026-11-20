import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Debt,
  Delivery,
  Expense,
  PosBackupPayload,
  Product,
  Purchase,
  Sale,
  ShopSettings,
  StockLog,
} from '../types/pos';

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

function getClientSupabaseCredentials(): { url: string; anonKey: string } {
  const url = (
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof __SHWEPOS_SUPABASE_URL__ === 'string' ? __SHWEPOS_SUPABASE_URL__ : '') ||
    ''
  ).trim();

  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof __SHWEPOS_SUPABASE_ANON_KEY__ === 'string' ? __SHWEPOS_SUPABASE_ANON_KEY__ : '') ||
    ''
  ).trim();

  return { url, anonKey };
}

export function isClientSupabaseConfigured(): boolean {
  const { url, anonKey } = getClientSupabaseCredentials();
  return Boolean(url && anonKey);
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

function getClientSupabase(): SupabaseClient | null {
  const { url, anonKey } = getClientSupabaseCredentials();
  if (!url || !anonKey) return null;
  const sig = `${url}::${anonKey.slice(0, 12)}`;
  if (!cachedClient || cachedSignature !== sig) {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedSignature = sig;
  }
  return cachedClient;
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
    };

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to pull data from Supabase.',
    };
  }
}
