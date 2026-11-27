import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  KeyRound,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import type { PosBackupPayload } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';
import {
  formatExpiryDate,
  formatExpiryDateTime,
  formatRemainingDetailed,
  getRemainingTimeParts,
  getSubscriptionProgressPercent,
} from '../../lib/accessControl';
import { firebaseProjectInfo } from '../../lib/firebase';
import SUPABASE_SCHEMA_DOWNLOAD from '../../../supabase_schema.sql?raw';

export const SettingsSyncView: React.FC<{ initialTab?: 'profile' | 'cloud' | 'guide' }> = ({
  initialTab = 'profile',
}) => {
  const {
    shop,
    sales,
    expenses,
    products,
    lang,
    user,
    isAdmin,
    subscriptionExpiry,
    subscriptionDaysRemaining,
    activeLicense,
    activePass,
    refreshSubscriptionStatus,
    supabaseAuthReady,
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

  const [tab, setTab] = useState<'profile' | 'cloud' | 'guide'>(
    isAdmin ? initialTab : 'profile'
  );
  const activeTab: 'profile' | 'cloud' | 'guide' = isAdmin ? tab : 'profile';

  useEffect(() => {
    setTab(isAdmin ? initialTab : 'profile');
  }, [initialTab, isAdmin]);

  // Shop Settings Form
  const [shopName, setShopName] = useState(shop.shopName);
  const [shopSubtitle, setShopSubtitle] = useState(shop.shopSubtitle);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [receiptFooter, setReceiptFooter] = useState(shop.receiptFooter);
  const [defaultMarginPercent, setDefaultMarginPercent] = useState(
    String(shop.defaultMarginPercent)
  );
  const [tgBotToken, setTgBotToken] = useState(shop.telegramBotToken || '');
  const [tgChatId, setTgChatId] = useState(shop.telegramChatId || '');
  const [tgEnabled, setTgEnabled] = useState(Boolean(shop.telegramEnabled));
  const [showTgToken, setShowTgToken] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setShopName(shop.shopName);
    setShopSubtitle(shop.shopSubtitle);
    setPhone(shop.phone);
    setAddress(shop.address);
    setReceiptFooter(shop.receiptFooter);
    setDefaultMarginPercent(String(shop.defaultMarginPercent));
    setTgBotToken(shop.telegramBotToken || '');
    setTgChatId(shop.telegramChatId || '');
    setTgEnabled(Boolean(shop.telegramEnabled));
  }, [shop]);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('saveShop');
    try {
      const parsedMargin = Number(defaultMarginPercent);
      await updateShopSettings({
        shopName,
        shopSubtitle,
        phone,
        address,
        receiptFooter,
        defaultMarginPercent:
          Number.isFinite(parsedMargin) && parsedMargin >= 0 ? parsedMargin : 20,
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

  const hasPersonalTelegram = Boolean(tgBotToken.trim() && tgChatId.trim());
  const isTelegramReady = hasPersonalTelegram || integrations.telegramConfigured;

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedToken = tgBotToken.trim();
    const cleanedChatId = tgChatId.trim();
    if ((cleanedToken && !cleanedChatId) || (!cleanedToken && cleanedChatId)) {
      showToast(
        lang === 'my'
          ? 'Bot Token နှင့် Chat ID နှစ်ခုလုံးကို ပြည့်စုံစွာ ထည့်သွင်းပေးပါ။'
          : 'Please enter both Bot Token and Chat ID.',
        'error'
      );
      return;
    }
    setBusyAction('saveTelegram');
    try {
      await updateShopSettings({
        telegramBotToken: cleanedToken,
        telegramChatId: cleanedChatId,
        telegramEnabled: tgEnabled,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestTelegram = async () => {
    setBusyAction('testTelegram');
    try {
      const ok = await sendTelegramMessage(
        `<b>${shopName || shop.shopName}</b>\n✅ ${
          lang === 'my'
            ? 'Telegram Bot ချိတ်ဆက်မှု စမ်းသပ်ချက် အောင်မြင်ပါသည်။'
            : 'Telegram Bot test message delivered successfully!'
        }`,
        {
          botToken: tgBotToken.trim() || undefined,
          chatId: tgChatId.trim() || undefined,
        }
      );
      if (ok && tgBotToken.trim() && tgChatId.trim()) {
        await updateShopSettings({
          telegramBotToken: tgBotToken.trim(),
          telegramChatId: tgChatId.trim(),
          telegramEnabled: tgEnabled,
        });
      }
    } finally {
      setBusyAction(null);
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

    await sendTelegramMessage(msg, {
      botToken: tgBotToken.trim() || undefined,
      chatId: tgChatId.trim() || undefined,
    });
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
      {/* Sub-navigation Tabs (Admin sees all 3 tabs; Clients only see Shop Profile) */}
      {isAdmin && (
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
                activeTab === id
                  ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                  : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: Editable Shop Profile, License Remaining Details & Self-Service Telegram Integration */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          {!isAdmin && subscriptionExpiry !== null && (() => {
            const parts = getRemainingTimeParts(subscriptionExpiry, nowMs);
            const remDays = subscriptionDaysRemaining ?? 0;
            const createdAtMs = activePass?.createdAtMs || activeLicense?.createdAtMs;
            const estimatedTotalDays =
              activePass?.durationDays && activePass.durationDays > 0
                ? activePass.durationDays
                : createdAtMs && subscriptionExpiry > createdAtMs
                ? Math.max(1, Math.round((subscriptionExpiry - createdAtMs) / (1000 * 60 * 60 * 24)))
                : Math.max(30, remDays);
            const progressPct = getSubscriptionProgressPercent(
              subscriptionExpiry,
              estimatedTotalDays,
              createdAtMs,
              nowMs
            );
            const isCritical = remDays <= 1 || parts.expired;
            const isWarning = !isCritical && remDays <= 5;
            const passCode = activeLicense?.passCode || activePass?.code || '—';
            const planLabel = activeLicense?.label || activePass?.label || 'Standard';
            const boundCount = activePass?.boundDevices?.length ?? 1;
            const maxDevices = activePass?.maxDevices ?? activeLicense?.maxDevices ?? 1;

            return (
              <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-titanium-900 dark:text-titanium-50 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-burgundy-700 dark:text-burgundy-300" />
                      {lang === 'my'
                        ? 'လိုင်စင်နှင့် လက်ကျန်ရက် အသေးစိတ်'
                        : 'Subscription & Remaining Time'}
                    </h3>
                    <p className="text-xs text-titanium-500 dark:text-titanium-400 mt-0.5">
                      {formatRemainingDetailed(subscriptionExpiry, lang, nowMs, false)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                        isCritical
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                          : isWarning
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isCritical
                        ? lang === 'my'
                          ? 'သက်တမ်းကုန်ခါနီး'
                          : 'Expiring'
                        : isWarning
                        ? lang === 'my'
                          ? 'သက်တမ်းတိုးရန်'
                          : 'Renew Soon'
                        : lang === 'my'
                        ? 'အသုံးပြုနိုင်'
                        : 'Active'}
                    </span>
                    <button
                      type="button"
                      disabled={busyAction === 'refreshLicense'}
                      onClick={async () => {
                        setBusyAction('refreshLicense');
                        try {
                          const ok = await refreshSubscriptionStatus();
                          setNowMs(Date.now());
                          showToast(
                            ok
                              ? lang === 'my'
                                ? 'လိုင်စင်သက်တမ်းကို ပြန်လည်စစ်ဆေးပြီးပါပြီ။'
                                : 'Subscription status refreshed.'
                              : lang === 'my'
                              ? 'လိုင်စင်သက်တမ်း စစ်ဆေးမှု မအောင်မြင်ပါ။'
                              : 'Could not refresh license status.',
                            ok ? 'success' : 'error'
                          );
                        } finally {
                          setBusyAction(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          busyAction === 'refreshLicense' ? 'animate-spin' : ''
                        }`}
                      />
                      {lang === 'my' ? 'ပြန်စစ်' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {/* Live Days / Hours / Minutes Breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-center">
                    <div className="text-xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50">
                      {parts.days}
                    </div>
                    <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
                      {lang === 'my' ? 'ရက် (Days)' : 'Days'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-center">
                    <div className="text-xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50">
                      {parts.hours}
                    </div>
                    <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
                      {lang === 'my' ? 'နာရီ (Hours)' : 'Hours'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-center">
                    <div className="text-xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50">
                      {parts.minutes}
                    </div>
                    <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
                      {lang === 'my' ? 'မိနစ် (Mins)' : 'Minutes'}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-titanium-200 dark:bg-titanium-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCritical
                          ? 'bg-red-600 dark:bg-red-500'
                          : isWarning
                          ? 'bg-amber-500 dark:bg-amber-400'
                          : 'bg-emerald-600 dark:bg-emerald-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400">
                    <span>
                      {remDays} / {estimatedTotalDays}{' '}
                      {lang === 'my' ? 'ရက် ကျန်ရှိသည်' : 'days remaining'}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                </div>

                {/* License Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-titanium-100 dark:border-titanium-800 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-titanium-500 dark:text-titanium-400">
                      <KeyRound className="w-3.5 h-3.5" />
                      Pass Code
                    </span>
                    <span className="font-mono-num font-semibold text-burgundy-800 dark:text-burgundy-300 truncate">
                      {passCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-titanium-500 dark:text-titanium-400">
                      {lang === 'my' ? 'အမျိုးအစား' : 'Plan'}
                    </span>
                    <span className="font-medium text-titanium-800 dark:text-titanium-200 truncate">
                      {planLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-titanium-500 dark:text-titanium-400">
                      {lang === 'my' ? 'ကုန်ဆုံးမည့်အချိန်' : 'Expires At'}
                    </span>
                    <span className="font-mono-num font-semibold text-titanium-900 dark:text-titanium-100">
                      {formatExpiryDateTime(subscriptionExpiry)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-titanium-500 dark:text-titanium-400">
                      <Smartphone className="w-3.5 h-3.5" />
                      {lang === 'my' ? 'စက်အရေအတွက်' : 'Devices'}
                    </span>
                    <span className="font-mono-num text-titanium-800 dark:text-titanium-200">
                      {boundCount} / {maxDevices}
                      {createdAtMs ? ` · ${formatExpiryDate(createdAtMs)}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <form
            onSubmit={handleSaveShop}
            className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4"
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
                  step="any"
                  inputMode="decimal"
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

          {/* Self-Service Telegram Integration Card (Available for Every User) */}
          <form
            onSubmit={handleSaveTelegram}
            className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-burgundy-50 dark:bg-burgundy-950 border border-burgundy-200/80 dark:border-burgundy-800/70 flex items-center justify-center">
                  <Send className="w-4 h-4 text-burgundy-700 dark:text-burgundy-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-titanium-900 dark:text-titanium-50">
                    {lang === 'my'
                      ? 'Telegram Bot ချိတ်ဆက်မှု (ကိုယ်တိုင်ချိတ်ဆက်ရန်)'
                      : 'Telegram Bot Integration'}
                  </h3>
                  <p className="text-[11px] text-titanium-500 dark:text-titanium-400">
                    {lang === 'my'
                      ? 'မိမိကိုယ်ပိုင် Bot Token နှင့် Chat ID ထည့်၍ ဘောင်ချာနှင့် နေ့စဉ်အရောင်းချုပ်များကို Telegram သို့ တိုက်ရိုက်ပို့နိုင်ပါသည်'
                      : 'Connect your own Telegram Bot Token & Chat ID to receive sales vouchers and daily summaries.'}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                  isTelegramReady
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-titanium-100 dark:bg-titanium-800 text-titanium-600 dark:text-titanium-400 border-titanium-200 dark:border-titanium-700'
                }`}
              >
                {isTelegramReady && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isTelegramReady
                  ? lang === 'my'
                    ? 'ချိတ်ဆက်ပြီး'
                    : 'Connected'
                  : lang === 'my'
                  ? 'မချိတ်ရသေး'
                  : 'Not Connected'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  Telegram Bot Token
                </label>
                <div className="relative">
                  <input
                    type={showTgToken ? 'text' : 'password'}
                    autoComplete="off"
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    placeholder="1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3.5 pr-10 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTgToken((v) => !v)}
                    aria-label={showTgToken ? 'Hide Bot Token' : 'Show Bot Token'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200"
                  >
                    {showTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="123456789 or -1001234567890"
                  className="w-full px-3.5 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>

              <div className="flex items-end">
                <label className="w-full flex items-center gap-2.5 px-3.5 py-2 bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tgEnabled}
                    onChange={(e) => setTgEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-burgundy-700"
                  />
                  <span className="text-xs font-medium text-titanium-700 dark:text-titanium-200">
                    {lang === 'my'
                      ? 'ဘောင်ချာဖွင့်တိုင်း အလိုအလျောက်ပို့မည်'
                      : 'Auto-send on every new sale'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-burgundy-800 dark:text-burgundy-200 bg-burgundy-50 dark:bg-burgundy-950/60 hover:bg-burgundy-100/80 dark:hover:bg-burgundy-900/60 border border-burgundy-200 dark:border-burgundy-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {busyAction === 'testTelegram'
                    ? '...'
                    : lang === 'my'
                    ? 'စမ်းသပ်မက်ဆေ့ချ် ပို့မည်'
                    : 'Send Test Message'}
                </button>
                <button
                  type="button"
                  onClick={handleSendDailyTelegram}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {busyAction === 'telegram' ? '...' : t('sendDailyTelegram')}
                </button>
              </div>

              <button
                type="submit"
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {busyAction === 'saveTelegram'
                  ? '...'
                  : lang === 'my'
                  ? 'Telegram ချိတ်ဆက်မှု သိမ်းမည်'
                  : 'Save Telegram Settings'}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-[11px] text-titanium-600 dark:text-titanium-400 space-y-1 leading-relaxed">
              <div className="font-semibold text-titanium-800 dark:text-titanium-200">
                {lang === 'my' ? 'ချိတ်ဆက်ပုံ အဆင့် ၃ ဆင့်' : 'Quick Setup Guide (3 Steps)'}
              </div>
              <div>
                1.{' '}
                {lang === 'my'
                  ? 'Telegram တွင် @BotFather ကိုရှာပြီး /newbot ဖြင့် Bot အသစ်ဖန်တီးကာ Bot Token ကို ကူးယူပါ။'
                  : 'Open @BotFather on Telegram, run /newbot, and copy your Bot Token.'}
              </div>
              <div>
                2.{' '}
                {lang === 'my'
                  ? 'မိမိဖန်တီးထားသော Bot ထဲသို့ ဝင်ပြီး Start (/start) တစ်ချက်နှိပ်ပေးပါ (အရေးကြီးသည်)။'
                  : 'Open your newly created bot and tap Start (/start) once so it can message you.'}
              </div>
              <div>
                3.{' '}
                {lang === 'my'
                  ? '@userinfobot ထံမှ မိမိ၏ Chat ID နံပါတ်ကို ယူ၍ အထက်တွင် ထည့်သွင်းပြီး "စမ်းသပ်မက်ဆေ့ချ် ပို့မည်" ကို နှိပ်စစ်ဆေးပါ။'
                  : 'Get your numeric Chat ID from @userinfobot, paste it above, and tap "Send Test Message".'}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Cloud Databases (Firebase + Supabase), Telegram & Backup/Restore (Admin only) */}
      {isAdmin && activeTab === 'cloud' && (
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
                !supabaseAuthReady && (
                  <button
                    onClick={loginWithGoogle}
                    disabled={signingIn}
                    className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {signingIn ? '...' : t('signInGoogle')}
                  </button>
                )
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

      {/* TAB 3: Myanmar Step-by-Step Guide & Source Code Architecture (Admin only) */}
      {isAdmin && activeTab === 'guide' && (
        <div className="max-w-4xl space-y-5">
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-titanium-900 dark:text-titanium-50">
              ၁။ စနစ်တည်ဆောက်ပုံ (Folder Architecture &amp; Source Code ရှင်းလင်းချက်)
            </h3>
            <p className="text-sm text-titanium-600 dark:text-titanium-300 leading-relaxed">
              ဤ Lin Pos System Web App ကို မည်မျှပင် အရောင်းများနေစေကာမူ Server မကျပ်ဘဲ အမြဲပေါ့ပါးသွက်လက်နေစေရန်{' '}
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
