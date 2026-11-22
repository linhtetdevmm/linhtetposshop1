import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, KeyRound, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { usePos } from '../context/PosContext';
import {
  formatExpiryDate,
  formatExpiryDateTime,
  formatRemainingDetailed,
  getRemainingTimeParts,
  getSubscriptionProgressPercent,
} from '../lib/accessControl';

interface SubscriptionBadgeProps {
  onOpenSettings: () => void;
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ onOpenSettings }) => {
  const {
    lang,
    isAdmin,
    subscriptionExpiry,
    subscriptionDaysRemaining,
    activeLicense,
    activePass,
    refreshSubscriptionStatus,
    showToast,
  } = usePos();

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (open) {
      setNowMs(Date.now());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (isAdmin || subscriptionExpiry === null) {
    return null;
  }

  const parts = getRemainingTimeParts(subscriptionExpiry, nowMs);
  const remDays = subscriptionDaysRemaining ?? 0;
  const compactLabel = formatRemainingDetailed(subscriptionExpiry, lang, nowMs, true);
  const detailedLabel = formatRemainingDetailed(subscriptionExpiry, lang, nowMs, false);
  const createdAtMs = activePass?.createdAtMs || activeLicense?.createdAtMs;
  const durationDays = activePass?.durationDays;
  const estimatedTotalDays =
    durationDays && durationDays > 0
      ? durationDays
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

  const pillClasses = isCritical
    ? 'border-red-200/90 dark:border-red-900/70 bg-red-50/80 hover:bg-red-50 dark:bg-red-950/35 dark:hover:bg-red-950/55 text-red-700 dark:text-red-300'
    : isWarning
    ? 'border-amber-200/90 dark:border-amber-900/60 bg-amber-50/80 hover:bg-amber-50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-300'
    : 'border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55 text-emerald-800 dark:text-emerald-300';

  const progressBarClass = isCritical
    ? 'bg-red-600 dark:bg-red-500'
    : isWarning
    ? 'bg-amber-500 dark:bg-amber-400'
    : 'bg-emerald-600 dark:bg-emerald-500';

  const passCode = activeLicense?.passCode || activePass?.code || '—';
  const planLabel = activeLicense?.label || activePass?.label || 'Standard';
  const boundCount = activePass?.boundDevices?.length ?? 1;
  const maxDevices = activePass?.maxDevices ?? activeLicense?.maxDevices ?? 1;

  const xsShortLabel =
    parts.days > 0
      ? lang === 'my'
        ? `${parts.days}ရက်`
        : `${parts.days}d`
      : parts.hours > 0
      ? lang === 'my'
        ? `${parts.hours}နာရီ`
        : `${parts.hours}h`
      : lang === 'my'
      ? `${Math.max(1, parts.minutes)}မိနစ်`
      : `${Math.max(1, parts.minutes)}m`;

  const handleRefresh = async () => {
    setChecking(true);
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
      setChecking(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={detailedLabel}
        title={`${detailedLabel} (${formatExpiryDateTime(subscriptionExpiry)})`}
        className={`h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${pillClasses}`}
      >
        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline font-mono-num">{compactLabel}</span>
        <span className="sm:hidden font-mono-num">{xsShortLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl shadow-lg p-4 z-50 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-titanium-100 dark:border-titanium-800">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 ${
                  isCritical
                    ? 'text-red-600 dark:text-red-400'
                    : isWarning
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span className="text-xs font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                {lang === 'my' ? 'လက်ကျန်သက်တမ်း အသေးစိတ်' : 'License Remaining Time'}
              </span>
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                isCritical
                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                  : isWarning
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
              }`}
            >
              {isCritical
                ? lang === 'my'
                  ? 'သတိပေးချက်'
                  : 'Expiring'
                : isWarning
                ? lang === 'my'
                  ? 'သက်တမ်းတိုးရန်'
                  : 'Renew Soon'
                : lang === 'my'
                ? 'အသုံးပြုနိုင်'
                : 'Active'}
            </span>
          </div>

          {/* Countdown & Progress */}
          <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 space-y-2">
            <div className="text-sm font-bold font-mono-num text-titanium-900 dark:text-titanium-50">
              {detailedLabel}
            </div>
            <div className="w-full h-2 bg-titanium-200 dark:bg-titanium-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBarClass}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400">
              <span>
                {remDays} / {estimatedTotalDays} {lang === 'my' ? 'ရက်' : 'days'}
              </span>
              <span>{progressPct}%</span>
            </div>
          </div>

          {/* Metadata rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-titanium-500 dark:text-titanium-400">
                <KeyRound className="w-3.5 h-3.5" />
                Pass Code
              </span>
              <span className="font-mono-num font-semibold text-burgundy-800 dark:text-burgundy-300 truncate max-w-[170px]">
                {passCode}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-titanium-500 dark:text-titanium-400">
                {lang === 'my' ? 'အမျိုးအစား' : 'Plan'}
              </span>
              <span className="font-medium text-titanium-800 dark:text-titanium-200 truncate max-w-[170px]">
                {planLabel}
              </span>
            </div>
            {createdAtMs && createdAtMs > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-titanium-500 dark:text-titanium-400">
                  {lang === 'my' ? 'စတင်သည့်ရက်' : 'Activated'}
                </span>
                <span className="font-mono-num text-titanium-700 dark:text-titanium-300">
                  {formatExpiryDate(createdAtMs)}
                </span>
              </div>
            )}
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
              <span className="font-mono-num text-titanium-700 dark:text-titanium-300">
                {boundCount} / {maxDevices}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2.5 border-t border-titanium-100 dark:border-titanium-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              {lang === 'my' ? 'ပြန်စစ်မည်' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
            >
              {lang === 'my' ? 'အသေးစိတ်ကြည့်မည်' : 'View Details'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
