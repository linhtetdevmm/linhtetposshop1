-- ShwePOS Supabase PostgreSQL Schema
-- Copy and run this SQL in your Supabase Dashboard -> SQL Editor
-- Enables complete dual-database sync with ShwePOS (Firebase + Supabase)

CREATE TABLE IF NOT EXISTS pos_shops (
  owner_id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_subtitle TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  receipt_footer TEXT DEFAULT '',
  currency TEXT DEFAULT 'MMK',
  default_margin_percent NUMERIC DEFAULT 20,
  telegram_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_products (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  margin_percent NUMERIC NOT NULL DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_sales (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  voucher_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  payment_method TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_purchases (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  ref_no TEXT NOT NULL,
  date TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_stock_logs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_debts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  party_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  reference_no TEXT DEFAULT '',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_expenses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_deliveries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  voucher_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT NOT NULL,
  courier_name TEXT NOT NULL,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  cod_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) with idempotent policies for ShwePOS API Sync
ALTER TABLE pos_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_deliveries ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE pos_shops, pos_products, pos_sales, pos_purchases, pos_stock_logs, pos_debts, pos_expenses, pos_deliveries TO anon, authenticated;

DROP POLICY IF EXISTS "allow_owner_sync_shops" ON pos_shops;
DROP POLICY IF EXISTS "allow_owner_sync_products" ON pos_products;
DROP POLICY IF EXISTS "allow_owner_sync_sales" ON pos_sales;
DROP POLICY IF EXISTS "allow_owner_sync_purchases" ON pos_purchases;
DROP POLICY IF EXISTS "allow_owner_sync_stock_logs" ON pos_stock_logs;
DROP POLICY IF EXISTS "allow_owner_sync_debts" ON pos_debts;
DROP POLICY IF EXISTS "allow_owner_sync_expenses" ON pos_expenses;
DROP POLICY IF EXISTS "allow_owner_sync_deliveries" ON pos_deliveries;

CREATE POLICY "allow_owner_sync_shops" ON pos_shops FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_products" ON pos_products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_sales" ON pos_sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_purchases" ON pos_purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_stock_logs" ON pos_stock_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_debts" ON pos_debts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_expenses" ON pos_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_owner_sync_deliveries" ON pos_deliveries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
