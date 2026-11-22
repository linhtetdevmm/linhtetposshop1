import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Package } from 'lucide-react';
import type { Product } from '../types/pos';
import { usePos } from '../context/PosContext';
import { useT } from '../i18n/translations';
import { getEffectiveStockThreshold } from '../lib/stockAlerts';

interface LowStockNotificationProps {
  lowStockProducts: Product[];
  customThreshold: number | null;
  onChangeThreshold: (next: number | null) => void;
  onOpenStock: () => void;
}

export const LowStockNotification: React.FC<LowStockNotificationProps> = ({
  lowStockProducts,
  customThreshold,
  onChangeThreshold,
  onOpenStock,
}) => {
  const { lang } = usePos();
  const t = useT(lang);
  const [open, setOpen] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(
    customThreshold !== null ? String(customThreshold) : '5'
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (customThreshold !== null) {
      setThresholdInput(String(customThreshold));
    }
  }, [customThreshold]);

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

  const outOfStockCount = lowStockProducts.filter((p) => p.stock <= 0).length;
  const hasAlerts = lowStockProducts.length > 0;

  const badgeTitle = hasAlerts
    ? lang === 'my'
      ? `ကုန်လက်ကျန်နည်း ပစ္စည်း ${lowStockProducts.length} မျိုး`
      : `${lowStockProducts.length} low-stock product${lowStockProducts.length === 1 ? '' : 's'}`
    : lang === 'my'
    ? 'ကုန်လက်ကျန် သတိပေးချက် မရှိပါ'
    : 'No low-stock alerts';

  const handleApplyCustomThreshold = (raw: string) => {
    setThresholdInput(raw);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChangeThreshold(Math.floor(parsed));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={badgeTitle}
        title={badgeTitle}
        className={`relative h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
          outOfStockCount > 0
            ? 'border-red-200/90 dark:border-red-900/70 bg-red-50/70 hover:bg-red-50 dark:bg-red-950/35 dark:hover:bg-red-950/55 text-red-700 dark:text-red-300'
            : hasAlerts
            ? 'border-amber-200/90 dark:border-amber-900/60 bg-amber-50/70 hover:bg-amber-50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-300'
            : 'border-titanium-200 dark:border-titanium-700 bg-white dark:bg-titanium-900 hover:bg-titanium-50 dark:hover:bg-titanium-800 text-titanium-600 dark:text-titanium-300'
        }`}
      >
        <Bell className="w-4 h-4 shrink-0" />
        {hasAlerts && (
          <span
            className={`font-mono-num text-[11px] font-semibold leading-none ${
              outOfStockCount > 0
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-800 dark:text-amber-300'
            }`}
          >
            {lowStockProducts.length > 99 ? '99+' : lowStockProducts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl shadow-lg p-4 z-50 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-titanium-100 dark:border-titanium-800">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  outOfStockCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : hasAlerts
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span className="text-xs font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                {t('lowStockAlerts')}
              </span>
            </div>
            <span className="text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400 shrink-0">
              {lowStockProducts.length} {t('items')}
            </span>
          </div>

          {/* Threshold Mode Switcher */}
          <div className="p-2.5 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 space-y-2">
            <div className="text-[11px] font-medium text-titanium-600 dark:text-titanium-400">
              {lang === 'my' ? 'သတိပေးမည့် လက်ကျန်သတ်မှတ်ချက်' : 'Alert Threshold'}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeThreshold(null)}
                className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md border transition-colors ${
                  customThreshold === null
                    ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white border-burgundy-700 dark:border-burgundy-600'
                    : 'bg-white dark:bg-titanium-900 text-titanium-600 dark:text-titanium-300 border-titanium-200 dark:border-titanium-700 hover:bg-titanium-100 dark:hover:bg-titanium-800'
                }`}
              >
                {lang === 'my' ? 'ပစ္စည်းအလိုက် (Min)' : 'Per Item (Min)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(0, Math.floor(Number(thresholdInput) || 5));
                  setThresholdInput(String(val));
                  onChangeThreshold(val);
                }}
                className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md border transition-colors ${
                  customThreshold !== null
                    ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white border-burgundy-700 dark:border-burgundy-600'
                    : 'bg-white dark:bg-titanium-900 text-titanium-600 dark:text-titanium-300 border-titanium-200 dark:border-titanium-700 hover:bg-titanium-100 dark:hover:bg-titanium-800'
                }`}
              >
                {lang === 'my' ? 'သတ်မှတ်အရေအတွက်' : 'Custom ≤'}
              </button>
            </div>
            {customThreshold !== null && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-titanium-500 dark:text-titanium-400">
                  {lang === 'my' ? 'လက်ကျန် ≤ (သို့) အောက်:' : 'Stock at or below:'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={thresholdInput}
                  onChange={(e) => handleApplyCustomThreshold(e.target.value)}
                  className="w-20 px-2 py-1 text-xs font-mono-num text-right bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-md focus:outline-none focus:border-burgundy-600"
                />
              </div>
            )}
          </div>

          {/* Product List */}
          {lowStockProducts.length === 0 ? (
            <div className="py-5 px-3 text-center space-y-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-xs text-titanium-500 dark:text-titanium-400">
                {t('noLowStock')}
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-titanium-100 dark:divide-titanium-800 -mx-1 px-1">
              {lowStockProducts.slice(0, 12).map((item) => {
                const limit = getEffectiveStockThreshold(item, customThreshold);
                const isOut = item.stock <= 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenStock();
                    }}
                    className="w-full py-2 px-1.5 flex items-center justify-between gap-2.5 text-left hover:bg-titanium-50 dark:hover:bg-titanium-800/60 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-titanium-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-titanium-900 dark:text-titanium-50 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400 truncate">
                          {item.sku} · {lang === 'my' ? 'သတ်မှတ်' : 'limit'} {limit}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold font-mono-num ${
                          isOut
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {item.stock} {item.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
              {lowStockProducts.length > 12 && (
                <div className="py-2 text-center text-[11px] text-titanium-500 dark:text-titanium-400">
                  {lang === 'my'
                    ? `နောက်ထပ် ${lowStockProducts.length - 12} မျိုး ကျန်ရှိသေးသည်`
                    : `+${lowStockProducts.length - 12} more items`}
                </div>
              )}
            </div>
          )}

          {/* Footer Action */}
          <div className="pt-2 border-t border-titanium-100 dark:border-titanium-800">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenStock();
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors"
            >
              {lang === 'my' ? 'ကုန်လက်ကျန်စာရင်းတွင် ကြည့်မည်' : 'Inspect in Stock Control'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
