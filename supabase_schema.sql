-- ShwePOS Full Supabase Auth + PostgreSQL Schema (100% Free Tier Ready)
-- Copy and run this entire SQL script in Supabase Dashboard -> SQL Editor -> Run
-- Supports Email/Password Auth, Random Access Passes, subscription_expiry, Admin Panel & Full POS CRUD

-- 1. Core POS Shop & Operational Tables
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
  date TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pos_stock_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

-- 2. Admin Random Access Passes & User Subscription Licenses
CREATE TABLE IF NOT EXISTS pos_access_passes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'Customer Shop',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  duration_days INTEGER NOT NULL DEFAULT 30,
  expires_at TIMESTAMPTZ NOT NULL,
  subscription_expiry TIMESTAMPTZ NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 1,
  bound_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_uid TEXT DEFAULT '',
  assigned_email TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_user_licenses (
  user_id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  pass_code TEXT NOT NULL,
  label TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  subscription_expiry TIMESTAMPTZ NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast per-shop queries
CREATE INDEX IF NOT EXISTS idx_pos_products_owner ON pos_products(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_owner ON pos_sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_purchases_owner ON pos_purchases(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_logs_owner ON pos_stock_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_debts_owner ON pos_debts(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_expenses_owner ON pos_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_deliveries_owner ON pos_deliveries(owner_id);
CREATE INDEX IF NOT EXISTS idx_pos_access_passes_assigned ON pos_access_passes(assigned_uid);

-- 3. Server-Side Security Helper Functions
CREATE OR REPLACE FUNCTION public.is_shwepos_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'loveking20178@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.has_active_shwepos_license()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_shwepos_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pos_user_licenses lic
      WHERE lic.user_id = auth.uid()::text
        AND lic.status = 'active'
        AND LEAST(lic.expires_at, lic.subscription_expiry) > NOW()
    );
$$;

-- 4. Atomic Server-Side Random Access Pass Redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_shwepos_pass(
  p_pass_code TEXT,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_email TEXT := coalesce(auth.jwt() ->> 'email', '');
  v_display TEXT := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', split_part(v_email, '@', 1));
  v_code TEXT := upper(regexp_replace(trim(coalesce(p_pass_code, '')), '[^A-Za-z0-9-]', '', 'g'));
  v_dev TEXT := left(trim(coalesce(p_device_id, '')), 64);
  v_pass public.pos_access_passes%ROWTYPE;
  v_devices JSONB;
  v_effective_exp TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  SELECT * INTO v_pass FROM public.pos_access_passes WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_pass.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'revoked');
  END IF;

  v_effective_exp := LEAST(v_pass.expires_at, v_pass.subscription_expiry);
  IF v_effective_exp <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expired');
  END IF;

  IF coalesce(v_pass.assigned_uid, '') <> '' AND v_pass.assigned_uid <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'assigned_other');
  END IF;

  v_devices := coalesce(v_pass.bound_devices, '[]'::jsonb);
  IF v_dev <> '' AND NOT (v_devices @> jsonb_build_array(v_dev)) THEN
    IF jsonb_array_length(v_devices) >= greatest(1, coalesce(v_pass.max_devices, 1)) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'device_limit',
        'maxDevices', greatest(1, coalesce(v_pass.max_devices, 1))
      );
    END IF;
    v_devices := v_devices || jsonb_build_array(v_dev);
  END IF;

  UPDATE public.pos_access_passes
  SET assigned_uid = v_uid,
      assigned_email = left(v_email, 160),
      bound_devices = v_devices,
      updated_at = NOW()
  WHERE code = v_code;

  INSERT INTO public.pos_user_licenses (
    user_id, email, display_name, pass_code, label, status,
    expires_at, subscription_expiry, max_devices, created_at, updated_at
  )
  VALUES (
    v_uid, left(v_email, 160), left(v_display, 120), v_code, left(v_pass.label, 120), 'active',
    v_effective_exp, v_effective_exp, greatest(1, coalesce(v_pass.max_devices, 1)), NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    pass_code = EXCLUDED.pass_code,
    label = EXCLUDED.label,
    status = 'active',
    expires_at = EXCLUDED.expires_at,
    subscription_expiry = EXCLUDED.subscription_expiry,
    max_devices = EXCLUDED.max_devices,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'expiresAt', v_effective_exp,
    'label', v_pass.label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_shwepos_pass(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shwepos_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_shwepos_license() TO authenticated;

-- 5. Row Level Security (Strict Per-User Isolation + Admin Full Control)
ALTER TABLE pos_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_access_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_user_licenses ENABLE ROW LEVEL SECURITY;

-- Revoke broad anon write privileges; allow anon read probe (returns 0 rows under RLS) for health check
REVOKE ALL ON TABLE pos_shops, pos_products, pos_sales, pos_purchases, pos_stock_logs, pos_debts, pos_expenses, pos_deliveries, pos_access_passes, pos_user_licenses FROM anon;
GRANT SELECT ON TABLE pos_shops TO anon;
GRANT ALL ON TABLE pos_shops, pos_products, pos_sales, pos_purchases, pos_stock_logs, pos_debts, pos_expenses, pos_deliveries, pos_access_passes, pos_user_licenses TO authenticated;

-- Drop legacy wide-open policies if present
DROP POLICY IF EXISTS "allow_owner_sync_shops" ON pos_shops;
DROP POLICY IF EXISTS "allow_owner_sync_products" ON pos_products;
DROP POLICY IF EXISTS "allow_owner_sync_sales" ON pos_sales;
DROP POLICY IF EXISTS "allow_owner_sync_purchases" ON pos_purchases;
DROP POLICY IF EXISTS "allow_owner_sync_stock_logs" ON pos_stock_logs;
DROP POLICY IF EXISTS "allow_owner_sync_debts" ON pos_debts;
DROP POLICY IF EXISTS "allow_owner_sync_expenses" ON pos_expenses;
DROP POLICY IF EXISTS "allow_owner_sync_deliveries" ON pos_deliveries;

DROP POLICY IF EXISTS "shwepos_owner_or_admin_shops" ON pos_shops;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_products" ON pos_products;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_sales" ON pos_sales;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_purchases" ON pos_purchases;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_stock_logs" ON pos_stock_logs;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_debts" ON pos_debts;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_expenses" ON pos_expenses;
DROP POLICY IF EXISTS "shwepos_owner_or_admin_deliveries" ON pos_deliveries;
DROP POLICY IF EXISTS "shwepos_admin_passes" ON pos_access_passes;
DROP POLICY IF EXISTS "shwepos_assigned_read_pass" ON pos_access_passes;
DROP POLICY IF EXISTS "shwepos_admin_licenses" ON pos_user_licenses;
DROP POLICY IF EXISTS "shwepos_user_read_own_license" ON pos_user_licenses;

-- Authenticated Shop Owner (with active license) OR Admin has full CRUD on their own shop data
CREATE POLICY "shwepos_owner_or_admin_shops" ON pos_shops
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_products" ON pos_products
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_sales" ON pos_sales
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_purchases" ON pos_purchases
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_stock_logs" ON pos_stock_logs
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_debts" ON pos_debts
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_expenses" ON pos_expenses
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

CREATE POLICY "shwepos_owner_or_admin_deliveries" ON pos_deliveries
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()))
  WITH CHECK (public.is_shwepos_admin() OR (owner_id = auth.uid()::text AND public.has_active_shwepos_license()));

-- Access Passes & User Licenses Policies
CREATE POLICY "shwepos_admin_passes" ON pos_access_passes
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin())
  WITH CHECK (public.is_shwepos_admin());

CREATE POLICY "shwepos_assigned_read_pass" ON pos_access_passes
  FOR SELECT TO authenticated
  USING (assigned_uid = auth.uid()::text);

CREATE POLICY "shwepos_admin_licenses" ON pos_user_licenses
  FOR ALL TO authenticated
  USING (public.is_shwepos_admin())
  WITH CHECK (public.is_shwepos_admin());

CREATE POLICY "shwepos_user_read_own_license" ON pos_user_licenses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);
