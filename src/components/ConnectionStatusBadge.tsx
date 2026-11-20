import React, { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, Database, RefreshCw, Settings, Wifi, WifiOff } from 'lucide-react';
import { usePos } from '../context/PosContext';

interface ConnectionStatusBadgeProps {
  onOpenSettings: () => void;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ onOpenSettings }) => {
  const { lang, isCloudMode, user, integrations, cloudHealth, refreshCloudHealth } = usePos();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleRecheck = async () => {
    setChecking(true);
    try {
      await refreshCloudHealth(true);
    } finally {
      setChecking(false);
    }
  };

  // Visual mapping by live backend/cloud health
  const statusConfig = (() => {
    switch (cloudHealth.status) {
      case 'healthy': {
        const bothConnected = isCloudMode && integrations.supabaseConfigured && cloudHealth.supabaseReachable;
        const supaOnly = !isCloudMode && integrations.supabaseConfigured && cloudHealth.supabaseReachable;
        return {
          dotClass: 'bg-emerald-500 ring-4 ring-emerald-500/20',
          borderClass:
            'border-emerald-200/80 dark:border-emerald-900/70 bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55',
          textClass: 'text-emerald-800 dark:text-emerald-300',
          shortLabel:
            lang === 'my'
              ? bothConnected
                ? 'Cloud ချိတ်ဆက်ပြီး'
                : supaOnly
                ? 'Supabase ချိတ်ပြီး'
                : 'Firebase ချိတ်ပြီး'
              : bothConnected
              ? 'Cloud Connected'
              : supaOnly
              ? 'Supabase Live'
              : 'Firebase Live',
          headline:
            lang === 'my'
              ? 'Backend နှင့် အောင်မြင်စွာ ချိတ်ဆက်ထားသည်'
              : 'Connected to Cloud Backend',
        };
      }
      case 'checking':
      case 'syncing':
        return {
          dotClass: 'bg-amber-400 ring-4 ring-amber-400/25 animate-pulse',
          borderClass:
            'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 hover:bg-amber-50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50',
          textClass: 'text-amber-800 dark:text-amber-300',
          shortLabel:
            cloudHealth.status === 'syncing'
              ? lang === 'my'
                ? 'Sync လုပ်နေသည်...'
                : 'Syncing...'
              : lang === 'my'
              ? 'စစ်ဆေးနေသည်...'
              : 'Checking...',
          headline:
            cloudHealth.status === 'syncing'
              ? lang === 'my'
                ? 'Supabase သို့ ဒေတာ Sync လုပ်နေပါသည်'
                : 'Synchronizing with Supabase...'
              : lang === 'my'
              ? 'Backend ချိတ်ဆက်မှုကို စစ်ဆေးနေပါသည်'
              : 'Verifying backend connectivity...',
        };
      case 'degraded':
        return {
          dotClass: 'bg-amber-500 ring-4 ring-amber-500/20',
          borderClass:
            'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/25 dark:hover:bg-amber-950/45',
          textClass: 'text-amber-800 dark:text-amber-300',
          shortLabel: lang === 'my' ? 'Local မုဒ်' : 'Local Only',
          headline:
            lang === 'my'
              ? 'Local Cache မုဒ်ဖြင့် အလုပ်လုပ်နေသည်'
              : 'Running in Local Cache Mode',
        };
      case 'error':
      default:
        return {
          dotClass: 'bg-red-500 ring-4 ring-red-500/25',
          borderClass:
            'border-red-200 dark:border-red-900/70 bg-red-50/80 hover:bg-red-50 dark:bg-red-950/40 dark:hover:bg-red-950/60',
          textClass: 'text-red-800 dark:text-red-300',
          shortLabel: !cloudHealth.online
            ? lang === 'my'
              ? 'Offline ဖြစ်နေသည်'
              : 'Offline'
            : lang === 'my'
            ? 'ချိတ်ဆက်မှု မှားနေသည်'
            : 'Sync Error',
          headline: !cloudHealth.online
            ? lang === 'my'
              ? 'အင်တာနက် ပြတ်တောက်နေပါသည်'
              : 'Network Offline (Local Cache Active)'
            : lang === 'my'
            ? 'Supabase / Backend ချိတ်ဆက်မှု မအောင်မြင်ပါ'
            : 'Backend Connection Issue',
        };
    }
  })();

  const formatClock = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={statusConfig.headline}
        title={statusConfig.headline}
        className={`h-9 inline-flex items-center gap-2 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${statusConfig.borderClass} ${statusConfig.textClass}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dotClass}`} />
        <span className="hidden sm:inline">{statusConfig.shortLabel}</span>
        <span className="sm:hidden">
          {cloudHealth.status === 'error' ? (
            <CloudOff className="w-3.5 h-3.5" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl shadow-lg p-4 z-50 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-titanium-100 dark:border-titanium-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dotClass}`} />
                <span className="text-xs font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                  {statusConfig.headline}
                </span>
              </div>
              <p className="text-[11px] text-titanium-500 dark:text-titanium-400 mt-1 font-mono-num">
                {lang === 'my' ? 'နောက်ဆုံးစစ်ဆေးချိန်' : 'Last checked'}:{' '}
                {formatClock(cloudHealth.lastCheckedAt)}
              </p>
            </div>
          </div>

          {/* Service Health Rows */}
          <div className="space-y-2 text-xs">
            {/* Network */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-titanium-600 dark:text-titanium-400">
                {cloudHealth.online ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                )}
                {lang === 'my' ? 'အင်တာနက်' : 'Network'}
              </span>
              <span
                className={`font-medium ${
                  cloudHealth.online
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {cloudHealth.online
                  ? lang === 'my'
                    ? 'Online'
                    : 'Online'
                  : lang === 'my'
                  ? 'Offline'
                  : 'Offline'}
              </span>
            </div>

            {/* Supabase Backend */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-titanium-600 dark:text-titanium-400">
                <Database className="w-3.5 h-3.5 text-burgundy-700 dark:text-burgundy-300" />
                Supabase
              </span>
              <span
                className={`font-medium text-right ${
                  !integrations.supabaseConfigured
                    ? 'text-amber-700 dark:text-amber-400'
                    : cloudHealth.supabaseReachable === true
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : cloudHealth.supabaseReachable === false
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-titanium-500 dark:text-titanium-400'
                }`}
              >
                {!integrations.supabaseConfigured
                  ? lang === 'my'
                    ? 'Env မထည့်ရသေး'
                    : 'Not Configured'
                  : cloudHealth.supabaseReachable === true
                  ? `${lang === 'my' ? 'ချိတ်ဆက်ပြီး' : 'Connected'} (${
                      integrations.supabaseMode === 'server' ? 'Server' : 'Web'
                    })`
                  : cloudHealth.supabaseReachable === false
                  ? lang === 'my'
                    ? 'မချိတ်နိုင်ပါ'
                    : 'Unreachable'
                  : lang === 'my'
                  ? 'စစ်ဆေးနေသည်...'
                  : 'Checking...'}
              </span>
            </div>

            {/* Firebase Cloud */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-titanium-600 dark:text-titanium-400">
                <Cloud className="w-3.5 h-3.5 text-burgundy-700 dark:text-burgundy-300" />
                Firebase Cloud
              </span>
              <span
                className={`font-medium truncate max-w-[160px] ${
                  isCloudMode
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
                title={user?.email || undefined}
              >
                {isCloudMode
                  ? lang === 'my'
                    ? 'ချိတ်ဆက်ပြီး'
                    : 'Synced'
                  : lang === 'my'
                  ? 'Local မုဒ်'
                  : 'Local Demo'}
              </span>
            </div>

            {/* Optional Error Details */}
            {cloudHealth.supabaseError && (
              <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 text-[11px] text-red-700 dark:text-red-300 break-words leading-relaxed">
                {cloudHealth.supabaseError}
              </div>
            )}

            {/* Last Synced */}
            {cloudHealth.lastSyncedAt && (
              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-titanium-500 dark:text-titanium-400 font-mono-num">
                <span>{lang === 'my' ? 'နောက်ဆုံး Sync' : 'Last Sync'}</span>
                <span>{formatClock(cloudHealth.lastSyncedAt)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2.5 border-t border-titanium-100 dark:border-titanium-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={checking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              {lang === 'my' ? 'ပြန်စစ်မည်' : 'Re-check'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              {lang === 'my' ? 'Cloud ဆက်တင်' : 'Cloud Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
