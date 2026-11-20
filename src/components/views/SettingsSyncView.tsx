import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  Copy,
  Database,
  Download,
  FileCode2,
  RefreshCw,
  Save,
  Send,
  Upload,
} from 'lucide-react';
import type { PosBackupPayload } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';
import { firebaseProjectInfo } from '../../lib/firebase';

const SUPABASE_SCHEMA_DOWNLOAD = `-- ShwePOS Supabase PostgreSQL Schema
-- Run this SQL inside Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS pos_shops (
  owner_id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_subtitle TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  receipt_footer TEXT DEFAULT '',
  currency TEXT DEFAULT 'MMK',
  default_margin_percent NUMERIC DEFAULT 25,
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

-- RLS Policies & Grants (Fixes "new row violates row-level security policy")
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
`;

export const SettingsSyncView: React.FC = () => {
  const {
    shop,
    sales,
    expenses,
    products,
    lang,
    user,
    signingIn,
    isCloudMode,
    integrations,
    updateShopSettings,
    loginWithGoogle,
    seedCloudWithSampleData,
    exportBackupJson,
    restoreBackupJson,
    sendTelegramMessage,
    pushToSupabase,
    pullFromSupabase,
    showToast,
  } = usePos();
  const t = useT(lang);

  const [tab, setTab] = useState<'profile' | 'cloud' | 'guide'>('profile');

  // Shop Settings Form
  const [shopName, setShopName] = useState(shop.shopName);
  const [shopSubtitle, setShopSubtitle] = useState(shop.shopSubtitle);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [receiptFooter, setReceiptFooter] = useState(shop.receiptFooter);
  const [defaultMarginPercent, setDefaultMarginPercent] = useState(
    String(shop.defaultMarginPercent)
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShopName(shop.shopName);
    setShopSubtitle(shop.shopSubtitle);
    setPhone(shop.phone);
    setAddress(shop.address);
    setReceiptFooter(shop.receiptFooter);
    setDefaultMarginPercent(String(shop.defaultMarginPercent));
  }, [shop]);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('saveShop');
    try {
      await updateShopSettings({
        shopName,
        shopSubtitle,
        phone,
        address,
        receiptFooter,
        defaultMarginPercent: Number(defaultMarginPercent) || 20,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction('restore');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PosBackupPayload;
      await restoreBackupJson(parsed);
    } catch {
      showToast(
        lang === 'my' ? 'JSON ဖိုင်ဖတ်၍ မရပါ။' : 'Failed to parse backup JSON file.',
        'error'
      );
    } finally {
      setBusyAction(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendDailyTelegram = async () => {
    setBusyAction('telegram');
    const today = getTodayISO();
    const todaySales = sales.filter((s) => s.date === today);
    const totalRev = todaySales.reduce((s, x) => s + x.total, 0);
    const totalProfit = todaySales.reduce((s, x) => s + x.profit, 0);
    const todayExp = expenses
      .filter((e) => e.date === today)
      .reduce((s, x) => s + x.amount, 0);
    const lowStock = products.filter((p) => p.stock <= p.minStock).length;

    const msg = [
      `<b>${shop.shopName} — Daily Report (${today})</b>`,
      `Orders: ${todaySales.length}`,
      `Sales Revenue: <b>${formatMMK(totalRev)}</b>`,
      `Gross Profit: ${formatMMK(totalProfit)}`,
      `Today Expenses: ${formatMMK(todayExp)}`,
      `Net Today: <b>${formatMMK(totalProfit - todayExp)}</b>`,
      `Low Stock Alerts: ${lowStock} items`,
    ].join('\n');

    await sendTelegramMessage(msg);
    setBusyAction(null);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SCHEMA_DOWNLOAD], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(
      lang === 'my' ? 'supabase_schema.sql ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။' : 'Downloaded supabase_schema.sql'
    );
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_DOWNLOAD);
      showToast(
        lang === 'my'
          ? 'SQL Schema နှင့် RLS Policy များကို Copy ကူးပြီးပါပြီ။ Supabase SQL Editor တွင် Paste ချပြီး Run ပါ။'
          : 'Copied SQL Schema & RLS policies to clipboard. Paste and run in Supabase SQL Editor.'
      );
    } catch {
      handleDownloadSql();
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
        {(
          [
            ['profile', t('shopProfileTab')],
            ['cloud', t('cloudBackupTab')],
            ['guide', t('guideTab')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === id
                ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Editable Shop Profile */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveShop}
          className="max-w-2xl bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4"
        >
          <div>
            <h3 className="text-base font-semibold text-titanium-900 dark:text-titanium-50">
              {t('shopProfileTab')}
            </h3>
            <p className="text-xs text-titanium-500 dark:text-titanium-400 mt-0.5">
              {lang === 'my'
                ? 'ဆိုင်အမည်နှင့် အချက်အလက်များကို ပြောင်းလဲလိုက်လျှင် Dashboard နှင့် PNG/PDF ဘောင်ချာများအားလုံးတွင် ချက်ချင်းပြောင်းလဲသွားပါမည်။'
                : 'Changes to your shop name and details update the workspace header and all PNG/PDF vouchers immediately.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('shopName')}
              </label>
              <input
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('shopSubtitle')}
              </label>
              <input
                value={shopSubtitle}
                onChange={(e) => setShopSubtitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('shopPhone')}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('defaultMargin')}
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                step="0.5"
                value={defaultMarginPercent}
                onChange={(e) => setDefaultMarginPercent(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('shopAddress')}
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                {t('receiptFooter')}
              </label>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={busyAction === 'saveShop'}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {t('saveSettings')}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Cloud Databases (Firebase + Supabase), Telegram & Backup/Restore */}
      {tab === 'cloud' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firebase Cloud Card */}
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-burgundy-700 dark:text-burgundy-300" />
                <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">Firebase Firestore &amp; Auth</h3>
              </div>
              <span
                className={`text-xs font-semibold ${
                  isCloudMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {isCloudMode ? t('cloudSynced') : t('localDemoMode')}
              </span>
            </div>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {lang === 'my'
                ? 'Offline-First IndexedDB Cache ပါဝင်သော Firebase Firestore ဖြင့် ချိတ်ဆက်ထားသောကြောင့် အင်တာနက်နှေးချိန် သို့မဟုတ် အလုပ်ရှုပ်ချိန်တွင်ပင် POS စနစ် လုံးဝမလေးဘဲ သွက်လက်စွာ အလုပ်လုပ်နိုင်ပါသည်။'
                : 'Connected to Firebase Firestore with persistent multi-tab IndexedDB cache for instant zero-lag POS operations even under unstable networks.'}
            </p>
            <div className="text-xs font-mono-num text-titanium-500 dark:text-titanium-400 space-y-1 border-t border-titanium-100 dark:border-titanium-800 pt-3">
              <div>Project: {firebaseProjectInfo.projectId}</div>
              <div>Account: {user ? user.email : 'Not signed in (Local Preview)'}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {!user ? (
                <button
                  onClick={loginWithGoogle}
                  disabled={signingIn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {signingIn ? '...' : t('signInGoogle')}
                </button>
              ) : (
                <button
                  onClick={seedCloudWithSampleData}
                  className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
                >
                  {t('seedSampleData')}
                </button>
              )}
            </div>
          </div>

          {/* Supabase PostgreSQL Sync Card */}
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-burgundy-700 dark:text-burgundy-300" />
                <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('supabaseTitle')}</h3>
              </div>
              <span
                className={`text-xs font-semibold ${
                  integrations.supabaseConfigured
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-titanium-500 dark:text-titanium-400'
                }`}
              >
                {integrations.supabaseConfigured
                  ? `${t('configured')} (${integrations.supabaseMode === 'server' ? 'Server' : 'Web'})`
                  : t('notConfiguredEnv')}
              </span>
            </div>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {lang === 'my'
                ? 'Firebase အပြင် Supabase PostgreSQL နှင့်ပါ တွဲဖက်အသုံးပြုနိုင်ပါသည်။ Full-Stack Server တွင် SUPABASE_URL နှင့် SUPABASE_ANON_KEY (သို့) Static Web Hosting (Vercel/Netlify) တွင် VITE_SUPABASE_URL နှင့် VITE_SUPABASE_ANON_KEY ထည့်ပြီး Redeploy လုပ်ရုံဖြင့် Sync တင်/ပြန်ဆွဲနိုင်ပါသည်။'
                : 'Mirror or restore your entire POS database with Supabase PostgreSQL. Works via /api/supabase/* server proxy (SUPABASE_URL + SUPABASE_ANON_KEY) or direct Web client on Vercel/Netlify (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={async () => {
                  setBusyAction('supaPush');
                  await pushToSupabase();
                  setBusyAction(null);
                }}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {busyAction === 'supaPush' ? '...' : t('pushToSupabase')}
              </button>
              <button
                onClick={async () => {
                  setBusyAction('supaPull');
                  await pullFromSupabase();
                  setBusyAction(null);
                }}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {busyAction === 'supaPull' ? '...' : t('pullFromSupabase')}
              </button>
              <button
                onClick={handleDownloadSql}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-burgundy-800 dark:text-burgundy-300 hover:underline"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                {t('downloadSqlSchema')}
              </button>
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:text-burgundy-700 dark:hover:text-burgundy-300"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === 'my' ? 'SQL + RLS Copy ကူးမည်' : 'Copy SQL + RLS'}
              </button>
            </div>
          </div>

          {/* Backup & Restore Card */}
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('backupTitle')}</h3>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {lang === 'my'
                ? 'ဆိုင်ဒေတာအားလုံး (ပစ္စည်း၊ အရောင်း၊ အဝယ်၊ Stock၊ အကြွေး၊ ကုန်ကျစရိတ်၊ ပို့ဆောင်ရေး) ကို JSON ဖိုင်တစ်ဖိုင်တည်းဖြင့် သိမ်းဆည်းပြီး အချိန်မရွေး ပြန်လည် Restore လုပ်နိုင်ပါသည်။'
                : 'Export a complete timestamped JSON snapshot of all shop records, or restore an earlier backup directly into Local or Firebase Cloud storage.'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={exportBackupJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t('exportBackup')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busyAction === 'restore'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {busyAction === 'restore' ? '...' : t('importBackup')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Telegram Bot Integration Card */}
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-burgundy-700 dark:text-burgundy-300" />
                <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('telegramTitle')}</h3>
              </div>
              <span
                className={`text-xs font-semibold ${
                  integrations.telegramConfigured
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-titanium-500 dark:text-titanium-400'
                }`}
              >
                {integrations.telegramConfigured ? t('configured') : t('notConfiguredEnv')}
              </span>
            </div>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {lang === 'my'
                ? 'Telegram Bot မှတစ်ဆင့် ဆိုင်ရှင်၏ ဖုန်းထဲသို့ ဘောင်ချာတစ်စောင်ချင်းစီ သို့မဟုတ် နေ့စဉ်အရောင်းချုပ်ကို ချက်ချင်းပို့နိုင်ပါသည်။ Server Secrets တွင် TELEGRAM_BOT_TOKEN နှင့် TELEGRAM_CHAT_ID ထည့်သွင်းပါ။'
                : 'Deliver individual sale receipts or end-of-day MMK financial summaries straight to your Telegram chat via /api/telegram/send using TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.'}
            </p>
            <button
              onClick={handleSendDailyTelegram}
              disabled={busyAction === 'telegram'}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {busyAction === 'telegram' ? '...' : t('sendDailyTelegram')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Myanmar Step-by-Step Guide & Source Code Architecture */}
      {tab === 'guide' && (
        <div className="max-w-4xl space-y-5">
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-titanium-900 dark:text-titanium-50">
              ၁။ စနစ်တည်ဆောက်ပုံ (Folder Architecture &amp; Source Code ရှင်းလင်းချက်)
            </h3>
            <p className="text-sm text-titanium-600 dark:text-titanium-300 leading-relaxed">
              ဤ ShwePOS Web App ကို မည်မျှပင် အရောင်းများနေစေကာမူ Server မကျပ်ဘဲ အမြဲပေါ့ပါးသွက်လက်နေစေရန်{' '}
              <strong>Offline-First + Local Cache Architecture</strong> ဖြင့် တည်ဆောက်ထားပါသည်။
            </p>
            <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-4 font-mono-num text-xs leading-relaxed text-titanium-700 dark:text-titanium-300 overflow-x-auto">
              <pre>{`├── server.ts                  # Express Backend (Telegram & Supabase Proxy API)
├── firestore.rules            # Hardened Firebase Security Rules (Owner-Only Isolation)
├── supabase_schema.sql        # Supabase PostgreSQL Tables ဖန်တီးရန် SQL ဖိုင်
├── src/
│   ├── lib/firebase.ts        # Firebase Auth + Offline IndexedDB Persistent Cache
│   ├── lib/format.ts          # MMK တွက်ချက်မှု, UTF-8 BOM CSV, PNG & PDF ဘောင်ချာထုတ်စနစ်
│   ├── context/PosContext.tsx # POS State Engine (Sales, Stock, Debts, Backup, Cloud Sync)
│   ├── i18n/translations.ts   # မြန်မာ / English ဘာသာစကားနှစ်မျိုး Dictionary
│   └── components/
│       ├── VoucherModal.tsx   # ဆိုင်နာမည်ပါ PNG/PDF ဘောင်ချာနှင့် Telegram ပို့စနစ်
│       └── views/             # Dashboard, POS, Products, Purchases, Stock, Debts, Expense, Delivery, Reports`}</pre>
            </div>
          </div>

          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-titanium-900 dark:text-titanium-50">
              ၂။ Firebase နှင့် Supabase နှစ်မျိုးလုံး ချိတ်ဆက်အသုံးပြုနည်း (Step-by-Step)
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-sm text-titanium-700 dark:text-titanium-300 leading-relaxed">
              <li>
                <strong>Firebase ချိတ်ဆက်ခြင်း:</strong> ညာဘက်အပေါ်ထောင့်ရှိ{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  Google ဖြင့် ဝင်မည်
                </code>{' '}
                ကိုနှိပ်လိုက်ရုံဖြင့် သင့်ကိုယ်ပိုင် Firestore Cloud Database သို့ အလိုအလျောက်ချိတ်ဆက်သွားပါမည်။{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  persistentLocalCache
                </code>{' '}
                ပါဝင်သောကြောင့် ဖုန်း/ကွန်ပျူတာထဲတွင် ချက်ချင်းသိမ်းပြီး နောက်ကွယ်မှ Cloud သို့ Sync တင်ပေးပါသည်။
              </li>
              <li>
                <strong>Supabase ချိတ်ဆက်ခြင်း:</strong>{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-burgundy-700 dark:text-burgundy-300 underline"
                >
                  supabase.com
                </a>{' '}
                တွင် Project အသစ်ဖွင့်ပြီး <strong>SQL Editor</strong> ထဲသို့ ဤ App မှ{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  supabase_schema.sql
                </code>{' '}
                ကို Run ပေးပါ။ ထို့နောက် Environment Secrets တွင်{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  SUPABASE_URL
                </code>{' '}
                နှင့်{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  SUPABASE_ANON_KEY
                </code>{' '}
                (Vercel / Netlify စသည့် Web Hosting တွင် Deploy လုပ်ပါက{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  VITE_SUPABASE_URL
                </code>{' '}
                နှင့်{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  VITE_SUPABASE_ANON_KEY
                </code>{' '}
                ကို Environment Variables ထဲထည့်ပြီး Redeploy လုပ်ပေးပါ)။
              </li>
              <li>
                <strong>Telegram Bot ချိတ်ဆက်ခြင်း:</strong> Telegram ရှိ{' '}
                <code className="font-mono-num text-xs bg-titanium-100 dark:bg-titanium-800 px-1.5 py-0.5 rounded">
                  @BotFather
                </code>{' '}
                တွင် <code className="font-mono-num text-xs">/newbot</code> ဖြင့် Token ရယူပြီး{' '}
                <code className="font-mono-num text-xs">@userinfobot</code> မှ Chat ID ယူကာ{' '}
                <code className="font-mono-num text-xs">TELEGRAM_BOT_TOKEN</code> နှင့်{' '}
                <code className="font-mono-num text-xs">TELEGRAM_CHAT_ID</code> ထည့်ပေးပါ။
              </li>
            </ol>
          </div>

          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-titanium-900 dark:text-titanium-50">
              ၃။ Web App မှ PC Desktop App (.exe / .dmg) ပြန်ထုတ်နည်း (Electron)
            </h3>
            <p className="text-sm text-titanium-600 dark:text-titanium-300 leading-relaxed">
              ဤ Project ကို Windows/Mac ကွန်ပျူတာတွင် Offline Desktop Software အဖြစ် ပြန်ထုတ်လိုပါက
              အောက်ပါအဆင့် ၃ ဆင့်ဖြင့် Electron Wrapper ထည့်သွင်းနိုင်ပါသည်:
            </p>
            <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-4 font-mono-num text-xs leading-relaxed text-titanium-700 dark:text-titanium-300 overflow-x-auto">
              <pre>{`# 1. Production Build ထုတ်ပါ
npm run build

# 2. Electron နှင့် Electron Builder ထည့်သွင်းပါ
npm install -D electron electron-builder

# 3. electron/main.cjs ဖိုင်တွင် dist/index.html ကို BrowserWindow ဖြင့်ဖွင့်ပြီး
#    Windows (.exe) installer ထုတ်ပါ
npx electron-builder --win --x64`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
