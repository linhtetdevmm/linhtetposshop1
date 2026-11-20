import React, { useState } from 'react';
import {
  AlertTriangle,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatExpiryDate, normalizePassCode } from '../lib/accessControl';

export const AccessGateScreen: React.FC = () => {
  const {
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    user,
    signingIn,
    accessStatus,
    activeLicense,
    loginWithGoogle,
    logout,
    redeemAccessPass,
  } = usePos();

  const [passInput, setPassInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    try {
      const res = await redeemAccessPass(cleaned);
      if (!res.ok) {
        setErrorMsg(res.error || (lang === 'my' ? 'Pass မမှန်ကန်ပါ။' : 'Invalid pass code.'));
      } else {
        setPassInput('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusNotice = (() => {
    if (accessStatus === 'expired') {
      return {
        tone: 'error' as const,
        title: lang === 'my' ? 'သက်တမ်းကုန်ဆုံးသွားပါပြီ' : 'Access Pass Expired',
        desc:
          lang === 'my'
            ? `သင့် Access Pass (${activeLicense?.passCode || ''}) သည် ${formatExpiryDate(
                activeLicense?.expiresAtMs || 0
              )} တွင် သက်တမ်းကုန်ဆုံးသွားပါပြီ။ ဆက်လက်အသုံးပြုရန် Admin ထံမှ သက်တမ်းတိုးခြင်း သို့မဟုတ် Pass အသစ်ထည့်သွင်းပေးပါ။`
            : `Your pass (${activeLicense?.passCode || ''}) expired on ${formatExpiryDate(
                activeLicense?.expiresAtMs || 0
              )}. Ask Admin to extend your license or enter a new Access Pass below.`,
      };
    }
    if (accessStatus === 'revoked') {
      return {
        tone: 'error' as const,
        title: lang === 'my' ? 'ဝင်ခွင့် ပိတ်ထားပါသည်' : 'Access Suspended by Admin',
        desc:
          lang === 'my'
            ? 'သင့် Access Pass ကို Admin မှ ယာယီပိတ်ထားပါသည်။ Admin နှင့် ဆက်သွယ်ပါ သို့မဟုတ် Pass အသစ်ထည့်သွင်းပါ။'
            : 'Your access pass has been revoked by the Administrator. Contact Admin or enter a new valid pass.',
      };
    }
    if (accessStatus === 'device_limit') {
      return {
        tone: 'error' as const,
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
            {lang === 'my' ? 'ဝင်ခွင့်လိုင်စင် စစ်ဆေးနေပါသည်...' : 'Verifying access license...'}
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
              ShwePOS
            </div>
            <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
              {lang === 'my' ? 'လုံခြုံရေး ဝင်ခွင့်စစ်ဆေးမှု' : 'Authorized Access Gate'}
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
            <div className="mx-auto w-12 h-12 rounded-xl bg-burgundy-50 dark:bg-burgundy-950 border border-burgundy-200 dark:border-burgundy-900 flex items-center justify-center">
              {user ? (
                <KeyRound className="w-6 h-6 text-burgundy-700 dark:text-burgundy-300" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-burgundy-700 dark:text-burgundy-300" />
              )}
            </div>
            <h1 className="text-lg font-bold tracking-tight text-titanium-900 dark:text-titanium-50">
              {!user
                ? lang === 'my'
                  ? 'ShwePOS ဝင်ခွင့်စစ်ဆေးခြင်း'
                  : 'Sign In to ShwePOS'
                : lang === 'my'
                ? 'Admin Access Pass ထည့်သွင်းပါ'
                : 'Enter Admin Access Pass'}
            </h1>
            <p className="text-xs text-titanium-600 dark:text-titanium-400 leading-relaxed">
              {!user
                ? lang === 'my'
                  ? 'Link ရှိရုံဖြင့် ဝင်ရောက်၍ မရပါ။ သင့်ကိုယ်ပိုင် Gmail ဖြင့်ဝင်ပြီး Admin ပေးထားသော Random Pass ဖြင့် သတ်မှတ်သက်တမ်းအတွင်း အသုံးပြုနိုင်ပါသည်။'
                  : 'This workspace is protected. Sign in with your Google Account and activate with an Admin-issued Access Pass.'
                : lang === 'my'
                ? 'သင့် Gmail အတွက် သီးသန့် POS ဒေတာသိမ်းဆည်းပေးမည်ဖြစ်ပြီး Admin သတ်မှတ်ထားသော သက်တမ်းအတွင်းသာ ဝင်ခွင့်ရှိပါမည်။'
                : 'Your POS data is strictly isolated to your Gmail account and active for your Admin-assigned pass duration.'}
            </p>
          </div>

          {!user ? (
            <div className="space-y-4">
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

              <div className="p-3.5 rounded-xl bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 text-[11px] text-titanium-600 dark:text-titanium-400 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-titanium-800 dark:text-titanium-200">
                  {lang === 'my' ? 'ဝင်ရောက်ပုံ အဆင့် ၂ ဆင့်' : '2-Step Secure Access'}
                </div>
                <div>
                  1.{' '}
                  {lang === 'my'
                    ? 'သင့် Gmail ဖြင့် ဝင်ရောက်ပါ (Admin Account ဖြစ်ပါက Pass မလိုဘဲ Admin Panel ပါ တိုက်ရိုက်ပွင့်မည်)။'
                    : 'Sign in with your Gmail account (Admin account unlocks full control automatically).'}
                </div>
                <div>
                  2.{' '}
                  {lang === 'my'
                    ? 'Admin ပေးထားသော Random Pass (ဥပမာ SHWE-XXXX-XXXX-XXXX) ထည့်သွင်း၍ ဝင်ရောက်ပါ။'
                    : 'Enter your Admin-issued Random Pass (e.g. SHWE-XXXX-XXXX-XXXX) to activate.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signed-in Gmail Identity Bar */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800">
                <div className="min-w-0">
                  <div className="text-[11px] text-titanium-500 dark:text-titanium-400">
                    {lang === 'my' ? 'ဝင်ရောက်ထားသော Gmail' : 'Signed in as'}
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

              {/* Status Alert if Expired / Revoked / Device Limit */}
              {statusNotice && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {statusNotice.title}
                  </div>
                  <p className="text-[11px] text-red-700 dark:text-red-300/90 leading-relaxed">
                    {statusNotice.desc}
                  </p>
                </div>
              )}

              {/* Pass Redemption Form */}
              <form onSubmit={handleSubmitPass} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-titanium-700 dark:text-titanium-300 mb-1.5">
                    {lang === 'my' ? 'Random Access Pass ကုဒ်' : 'Random Access Pass Code'}
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
