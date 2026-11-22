import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import {
  formatExpiryDate,
  getExpiredDaysAgo,
  normalizePassCode,
  PRIMARY_ADMIN_EMAIL,
} from '../lib/accessControl';

export const AccessGateScreen: React.FC = () => {
  const {
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    user,
    supabaseAuthReady,
    signingIn,
    authError,
    accessStatus,
    activeLicense,
    subscriptionExpiry,
    isSubscriptionExpired,
    refreshSubscriptionStatus,
    loginWithSupabase,
    registerWithSupabase,
    loginWithGoogle,
    logout,
    redeemAccessPass,
  } = usePos();

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authInfoMsg, setAuthInfoMsg] = useState<string | null>(null);

  const [passInput, setPassInput] = useState(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('pass');
      if (fromUrl && fromUrl.trim().length >= 6) {
        const normalized = normalizePassCode(fromUrl);
        sessionStorage.setItem('linpos_pending_pass', normalized);
        return normalized;
      }
      return sessionStorage.getItem('linpos_pending_pass') || '';
    } catch {
      return '';
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [checkingRenewal, setCheckingRenewal] = useState(false);
  const [renewalInfoMsg, setRenewalInfoMsg] = useState<string | null>(null);
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSupabaseAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthInfoMsg(null);
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || passwordInput.length < 6) {
      setAuthInfoMsg(
        lang === 'my'
          ? 'Email မှန်ကန်စွာနှင့် Password အနည်းဆုံး ၆ လုံး ထည့်သွင်းပေးပါ။'
          : 'Please enter a valid email and a password of at least 6 characters.'
      );
      return;
    }
    if (authTab === 'login') {
      await loginWithSupabase(trimmedEmail, passwordInput);
    } else {
      const res = await registerWithSupabase(trimmedEmail, passwordInput, nameInput.trim());
      if (res.ok && res.needsEmailConfirm) {
        setAuthInfoMsg(
          lang === 'my'
            ? 'အကောင့်ဖွင့်ပြီးပါပြီ! သင့် Email Inbox မှ အတည်ပြုလင့်ခ်ကို နှိပ်ပြီး ဝင်ရောက်ပါ (သို့မဟုတ် Supabase Auth > Providers > Email တွင် Confirm email ကို ပိတ်ထားပါ)။'
            : 'Account created! Confirm your email from your inbox or turn off "Confirm email" in Supabase Auth settings.'
        );
        setAuthTab('login');
      }
    }
  };

  const effectiveExpiryMs = subscriptionExpiry ?? activeLicense?.expiresAtMs ?? 0;
  const expiredState = accessStatus === 'expired' || isSubscriptionExpired;
  const expiredDaysAgo = getExpiredDaysAgo(effectiveExpiryMs);

  const handleSubmitPass = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizePassCode(passInput);
    if (cleaned.length < 6) {
      setErrorMsg(
        lang === 'my'
          ? 'Admin ပေးထားသော Access Pass ကို မှန်ကန်စွာ ရိုက်ထည့်ပေးပါ။'
          : 'Please enter a valid Admin-issued Access Pass.'
      );
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setRenewalInfoMsg(null);
    try {
      const res = await redeemAccessPass(cleaned);
      if (!res.ok) {
        setErrorMsg(res.error || (lang === 'my' ? 'Pass မမှန်ကန်ပါ။' : 'Invalid pass code.'));
      } else {
        setPassInput('');
        try {
          sessionStorage.removeItem('linpos_pending_pass');
          const url = new URL(window.location.href);
          if (url.searchParams.has('pass')) {
            url.searchParams.delete('pass');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        } catch {
          // Ignore URL/storage errors
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckRenewal = async () => {
    setCheckingRenewal(true);
    setRenewalInfoMsg(null);
    setErrorMsg(null);
    try {
      const unlocked = await refreshSubscriptionStatus();
      if (!unlocked) {
        setRenewalInfoMsg(
          lang === 'my'
            ? 'သက်တမ်းတိုးမှု မတွေ့ရှိသေးပါ။ Admin မှ သက်တမ်းတိုးပြီးပါက ဤခလုတ်ကို ထပ်နှိပ်၍ စစ်ဆေးနိုင်ပါသည်။'
            : 'No active renewal found yet. Once Admin extends your subscription, tap Check Again.'
        );
      }
    } finally {
      setCheckingRenewal(false);
    }
  };

  const handleCopyRenewalRequest = async () => {
    const expiryLabel = formatExpiryDate(effectiveExpiryMs);
    const requestText = [
      'Lin Pos System Subscription Renewal Request',
      `Account: ${user?.email || ''}`,
      activeLicense?.passCode ? `Current Pass: ${activeLicense.passCode}` : null,
      effectiveExpiryMs ? `Expired On: ${expiryLabel}` : null,
      lang === 'my'
        ? 'Lin Pos System လိုင်စင် သက်တမ်းတိုးပေးရန် တောင်းဆိုအပ်ပါသည်။'
        : 'Please extend my Lin Pos System subscription license.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(requestText);
      setCopiedRequest(true);
      window.setTimeout(() => setCopiedRequest(false), 2400);
    } catch {
      setRenewalInfoMsg(requestText);
    }
  };

  const nonExpiredAlert = (() => {
    if (accessStatus === 'revoked') {
      return {
        title: lang === 'my' ? 'ဝင်ခွင့် ပိတ်ထားပါသည်' : 'Access Suspended by Admin',
        desc:
          lang === 'my'
            ? 'သင့် Access Pass ကို Admin မှ ယာယီပိတ်ထားပါသည်။ Admin နှင့် ဆက်သွယ်ပါ သို့မဟုတ် Pass အသစ်ထည့်သွင်းပါ။'
            : 'Your access pass has been revoked by the Administrator. Contact Admin or enter a new valid pass.',
      };
    }
    if (accessStatus === 'device_limit') {
      return {
        title: lang === 'my' ? 'စက်အရေအတွက် ပြည့်နေပါသည်' : 'Device Limit Reached',
        desc:
          lang === 'my'
            ? 'ဤ Pass သည် သတ်မှတ်ထားသော စက်အရေအတွက် ပြည့်သွားပြီဖြစ်ပါသည်။ စက်အသစ်ပြောင်းလိုပါက Admin ထံတွင် Device Reset လုပ်ခိုင်းပါ။'
            : 'This pass has reached its maximum allowed devices. Ask Admin to reset devices or increase your device limit.',
      };
    }
    return null;
  })();

  if (accessStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-titanium-50 dark:bg-titanium-950 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-burgundy-700/10 dark:bg-burgundy-500/15 border border-burgundy-200 dark:border-burgundy-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-burgundy-700 dark:text-burgundy-300 animate-pulse" />
          </div>
          <p className="text-xs font-medium text-titanium-600 dark:text-titanium-400">
            {lang === 'my' ? 'ဝင်ခွင့်လိုင်စင် စစ်ဆေးနေပါသည်...' : 'Verifying subscription license...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-titanium-50 dark:bg-titanium-950 text-titanium-900 dark:text-titanium-50">
      {/* Minimal Top Utility Bar */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-titanium-200 dark:border-titanium-800 bg-white/90 dark:bg-titanium-900/90 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-burgundy-700 dark:bg-burgundy-600 text-white flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-burgundy-800 dark:text-burgundy-300">
              Lin Pos System
            </div>
            <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
              {expiredState
                ? lang === 'my'
                  ? 'လိုင်စင် သက်တမ်းတိုးရန်'
                  : 'Subscription Renewal'
                : lang === 'my'
                ? 'လုံခြုံရေး ဝင်ခွင့်စစ်ဆေးမှု'
                : 'Authorized Access Gate'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200/80 dark:hover:bg-titanium-700 rounded-lg transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'my' ? 'မြန်မာ / EN' : 'EN / မြန်မာ'}
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 text-titanium-700 dark:text-burgundy-300 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200/80 dark:hover:bg-titanium-700 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Centered Gate Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div
              className={`mx-auto w-12 h-12 rounded-xl border flex items-center justify-center ${
                expiredState
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
                  : 'bg-burgundy-50 dark:bg-burgundy-950 border-burgundy-200 dark:border-burgundy-900'
              }`}
            >
              {!user ? (
                <ShieldCheck className="w-6 h-6 text-burgundy-700 dark:text-burgundy-300" />
              ) : expiredState ? (
                <CalendarClock className="w-6 h-6 text-amber-700 dark:text-amber-300" />
              ) : (
                <KeyRound className="w-6 h-6 text-burgundy-700 dark:text-burgundy-300" />
              )}
            </div>
            <h1 className="text-lg font-bold tracking-tight text-titanium-900 dark:text-titanium-50">
              {!user
                ? lang === 'my'
                  ? 'Lin Pos System ဝင်ခွင့်စစ်ဆေးခြင်း'
                  : 'Sign In to Lin Pos System'
                : expiredState
                ? lang === 'my'
                  ? 'သက်တမ်းတိုးရန် (Renew Subscription)'
                  : 'Renew Subscription'
                : lang === 'my'
                ? 'Admin Access Pass ထည့်သွင်းပါ'
                : 'Enter Admin Access Pass'}
            </h1>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {!user
                ? lang === 'my'
                  ? supabaseAuthReady
                    ? 'Link ရှိရုံဖြင့် ဝင်ရောက်၍ မရပါ။ သင့် Email အကောင့်ဖြင့်ဝင်ပြီး Admin ပေးထားသော Random Pass ဖြင့် သတ်မှတ်သက်တမ်းအတွင်း အသုံးပြုနိုင်ပါသည်။'
                    : 'Link ရှိရုံဖြင့် ဝင်ရောက်၍ မရပါ။ သင့်ကိုယ်ပိုင် Gmail ဖြင့်ဝင်ပြီး Admin ပေးထားသော Random Pass ဖြင့် သတ်မှတ်သက်တမ်းအတွင်း အသုံးပြုနိုင်ပါသည်။'
                  : supabaseAuthReady
                  ? 'This workspace is protected. Sign in with your Email account and activate with an Admin-issued Access Pass.'
                  : 'This workspace is protected. Sign in with your Google Account and activate with an Admin-issued Access Pass.'
                : expiredState
                ? lang === 'my'
                  ? 'သင့် POS လိုင်စင်သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ သင့်ဆိုင်၏ အရောင်းနှင့် စတော့ဒေတာအားလုံးကို လုံခြုံစွာ သိမ်းဆည်းထားပေးပြီး သက်တမ်းတိုးပြီးသည်နှင့် ချက်ချင်းပြန်လည်အသုံးပြုနိုင်ပါမည်။'
                  : 'Your POS subscription has ended. All of your shop records, inventory, and sales remain safely saved and will unlock as soon as you renew.'
                : lang === 'my'
                ? 'သင့်အကောင့်အတွက် သီးသန့် POS ဒေတာသိမ်းဆည်းပေးမည်ဖြစ်ပြီး Admin သတ်မှတ်ထားသော သက်တမ်းအတွင်းသာ ဝင်ခွင့်ရှိပါမည်။'
                : 'Your POS data is strictly isolated to your account and active for your Admin-assigned pass duration.'}
            </p>
          </div>

          {!user ? (
            <div className="space-y-4">
              {passInput.trim().length >= 6 && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  {lang === 'my'
                    ? `Access Pass (${passInput}) ကို Link မှတစ်ဆင့် အသင့်ထည့်သွင်းထားပါသည်။ Email ဖြင့် ဝင်ပြီးတာနဲ့ အတည်ပြုနိုင်ပါမည်။`
                    : `Access Pass (${passInput}) is pre-filled from your invite link. Sign in or create an account below to activate it.`}
                </div>
              )}
              {supabaseAuthReady && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-titanium-100 dark:bg-titanium-800">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setAuthInfoMsg(null);
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                        authTab === 'login'
                          ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                          : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-100'
                      }`}
                    >
                      {lang === 'my' ? 'အကောင့်ဝင်မည် (Sign In)' : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('register');
                        setAuthInfoMsg(null);
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                        authTab === 'register'
                          ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                          : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-100'
                      }`}
                    >
                      {lang === 'my' ? 'အကောင့်သစ်ဖွင့်မည်' : 'Create Account'}
                    </button>
                  </div>

                  <form onSubmit={handleSupabaseAuthSubmit} className="space-y-3">
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                          {lang === 'my' ? 'အမည် / ဆိုင်အမည်' : 'Name / Shop Name'}
                        </label>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder={lang === 'my' ? 'ဥပမာ - ရွှေစင်ဆိုင်' : 'e.g. Golden Shop'}
                          className="w-full px-3.5 py-2.5 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-xl focus:outline-none focus:border-burgundy-600"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                        {lang === 'my' ? 'Email လိပ်စာ' : 'Email Address'}
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full px-3.5 py-2.5 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-xl focus:outline-none focus:border-burgundy-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                        {lang === 'my' ? 'Password (အနည်းဆုံး ၆ လုံး)' : 'Password (min 6 chars)'}
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-xl focus:outline-none focus:border-burgundy-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={signingIn}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-xl transition-colors"
                    >
                      {authTab === 'login' ? (
                        <Mail className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      {signingIn
                        ? lang === 'my'
                          ? 'ဝင်ရောက်နေသည်...'
                          : 'Please wait...'
                        : authTab === 'login'
                        ? lang === 'my'
                          ? 'Supabase Email ဖြင့် ဝင်မည်'
                          : 'Sign In with Email'
                        : lang === 'my'
                        ? 'Supabase အကောင့်သစ် ဖွင့်မည်'
                        : 'Create Free Account'}
                    </button>
                  </form>

                  {authInfoMsg && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      {authInfoMsg}
                    </div>
                  )}
                </div>
              )}

              {!supabaseAuthReady && (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={signingIn}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-xl transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {signingIn
                    ? lang === 'my'
                      ? 'ဝင်ရောက်နေသည်...'
                      : 'Signing in...'
                    : lang === 'my'
                    ? 'Google Account (Gmail) ဖြင့် ဝင်မည်'
                    : 'Continue with Google (Gmail)'}
                </button>
              )}

              {authError && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-[11px] text-titanium-600 dark:text-titanium-400 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-titanium-800 dark:text-titanium-200">
                  {lang === 'my' ? 'ဝင်ရောက်ပုံ အဆင့် ၂ ဆင့်' : '2-Step Secure Access'}
                </div>
                <div>
                  1.{' '}
                  {lang === 'my'
                    ? supabaseAuthReady
                      ? 'ပထမဆုံးအကြိမ် ဝင်သူ (Admin loveking20178@gmail.com အပါအဝင်) ဖြစ်ပါက "အကောင့်သစ်ဖွင့်မည်" Tab ကိုနှိပ်ပြီး Email + Password အသစ်တစ်ခု တစ်ကြိမ်ဖွင့်ဝင်ပါ (VPN မလိုပါ)။'
                      : 'သင့် Gmail ဖြင့် ဝင်ရောက်ပါ (Admin Account ဖြစ်ပါက Pass မလိုဘဲ Admin Panel ပါ တိုက်ရိုက်ပွင့်မည်)။'
                    : supabaseAuthReady
                    ? 'First time here (including Admin loveking20178@gmail.com)? Tap "Create Account" once with your Email & any 6+ char password (no VPN needed).'
                    : 'Sign in with your Gmail account (Admin account unlocks full control automatically).'}
                </div>
                <div>
                  2.{' '}
                  {lang === 'my'
                    ? 'Admin Account ဖြစ်ပါက Pass မလိုဘဲ တိုက်ရိုက်ပွင့်ပါမည်။ Customer များသည် Admin ပေးသော Random Pass (ဥပမာ SHWE-XXXX-XXXX-XXXX) ထည့်၍ ဝင်ရပါမည်။'
                    : 'Admin unlocks automatically without a pass. Customers enter their Admin-issued Random Pass (e.g. SHWE-XXXX-XXXX-XXXX).'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signed-in Gmail Identity Bar */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800">
                <div className="min-w-0">
                  <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
                    {lang === 'my' ? 'ဝင်ရောက်ထားသော အကောင့်' : 'Signed in as'}
                  </div>
                  <div className="text-xs font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                    {user.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-titanium-600 dark:text-titanium-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {lang === 'my' ? 'ပြောင်းမည်' : 'Switch'}
                </button>
              </div>

              {/* Friendly Renew Subscription Notice (Expired State) */}
              {expiredState && (
                <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {lang === 'my'
                          ? 'လိုင်စင်သက်တမ်း ကုန်ဆုံးနေပါသည်'
                          : 'Your License Needs Renewal'}
                      </div>
                      <div className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                        {lang === 'my'
                          ? `သက်တမ်းကုန်ရက်: ${formatExpiryDate(effectiveExpiryMs)}${
                              expiredDaysAgo > 0 ? ` (လွန်ခဲ့သော ${expiredDaysAgo} ရက်)` : ' (ယနေ့)'
                            }`
                          : `Expired on ${formatExpiryDate(effectiveExpiryMs)}${
                              expiredDaysAgo > 0
                                ? ` (${expiredDaysAgo} day${expiredDaysAgo === 1 ? '' : 's'} ago)`
                                : ' (today)'
                            }`}
                      </div>
                    </div>
                    {activeLicense?.passCode && (
                      <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-white/80 dark:bg-titanium-900/80 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 shrink-0">
                        {activeLicense.passCode}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-amber-900/80 dark:text-amber-200/85 leading-relaxed">
                    {lang === 'my'
                      ? `Admin (${PRIMARY_ADMIN_EMAIL}) ထံ ဆက်သွယ်၍ သက်တမ်းတိုးနိုင်ပါသည် သို့မဟုတ် အောက်တွင် Renewal Pass အသစ်ထည့်သွင်း၍ ချက်ချင်းပြန်ဖွင့်နိုင်ပါသည်။`
                      : `Contact Admin (${PRIMARY_ADMIN_EMAIL}) to extend your plan, or enter a new Access Pass below to continue immediately.`}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleCopyRenewalRequest}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100 bg-white dark:bg-titanium-900 hover:bg-amber-100/70 dark:hover:bg-titanium-800 border border-amber-300/80 dark:border-amber-800 rounded-lg transition-colors"
                    >
                      {copiedRequest ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          {lang === 'my' ? 'ကူးယူပြီးပါပြီ' : 'Copied Request'}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {lang === 'my' ? 'သက်တမ်းတိုးစာ ကူးမည်' : 'Copy Renewal Info'}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckRenewal}
                      disabled={checkingRenewal}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-burgundy-800 dark:text-burgundy-200 bg-burgundy-50 dark:bg-burgundy-950/60 hover:bg-burgundy-100/80 dark:hover:bg-burgundy-950 border border-burgundy-200 dark:border-burgundy-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${checkingRenewal ? 'animate-spin' : ''}`}
                      />
                      {checkingRenewal
                        ? lang === 'my'
                          ? 'စစ်ဆေးနေသည်...'
                          : 'Checking...'
                        : lang === 'my'
                        ? 'ပြန်စစ်ဆေးမည်'
                        : 'Check Renewal'}
                    </button>
                  </div>

                  {renewalInfoMsg && (
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-titanium-900/70 px-2.5 py-2 rounded-lg border border-amber-200/70 dark:border-amber-800/60 leading-relaxed">
                      {renewalInfoMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Status Alert for Revoked / Device Limit */}
              {!expiredState && nonExpiredAlert && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {nonExpiredAlert.title}
                  </div>
                  <p className="text-[11px] text-red-700 dark:text-red-300/90 leading-relaxed">
                    {nonExpiredAlert.desc}
                  </p>
                </div>
              )}

              {/* Pass Redemption / Renewal Form */}
              <form onSubmit={handleSubmitPass} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-titanium-700 dark:text-titanium-300 mb-1.5">
                    {expiredState
                      ? lang === 'my'
                        ? 'သက်တမ်းတိုး Pass အသစ်ရှိပါက ထည့်သွင်းပါ'
                        : 'Have a Renewal Access Pass?'
                      : lang === 'my'
                      ? 'Random Access Pass ကုဒ်'
                      : 'Random Access Pass Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={passInput}
                    onChange={(e) => {
                      setPassInput(e.target.value.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="SHWE-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-3.5 py-2.5 text-sm font-mono-num tracking-wider uppercase bg-titanium-50 dark:bg-titanium-950 border border-titanium-300 dark:border-titanium-700 rounded-xl focus:outline-none focus:border-burgundy-600 text-center"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || passInput.trim().length < 6}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-xl transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  {submitting
                    ? lang === 'my'
                      ? 'စစ်ဆေးနေသည်...'
                      : 'Activating...'
                    : expiredState
                    ? lang === 'my'
                      ? 'Pass အသစ်ဖြင့် သက်တမ်းတိုးပြီး ဝင်မည်'
                      : 'Renew & Unlock POS'
                    : lang === 'my'
                    ? 'Pass အတည်ပြုပြီး ဝင်ရောက်မည်'
                    : 'Activate & Enter Workspace'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
