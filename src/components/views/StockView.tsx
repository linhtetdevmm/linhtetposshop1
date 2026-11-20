import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Product } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK } from '../../lib/format';

export const StockView: React.FC = () => {
  const { products, stockLogs, lang, adjustProductStock } = usePos();
  const t = useT(lang);

  const [lowOnly, setLowOnly] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'in' | 'out' | 'adjust'>('in');
  const [adjQty, setAdjQty] = useState('5');
  const [adjReason, setAdjReason] = useState('');

  const valuation = useMemo(() => {
    const costValue = products.reduce(
      (sum, p) => sum + Math.max(0, p.stock) * p.costPrice,
      0
    );
    const retailValue = products.reduce(
      (sum, p) => sum + Math.max(0, p.stock) * p.sellPrice,
      0
    );
    return {
      costValue,
      retailValue,
      potentialProfit: retailValue - costValue,
    };
  }, [products]);

  const displayedProducts = useMemo(
    () => (lowOnly ? products.filter((p) => p.stock <= p.minStock) : products),
    [products, lowOnly]
  );

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    await adjustProductStock({
      productId: adjustTarget.id,
      type: adjType,
      quantity: Number(adjQty) || 0,
      reason: adjReason.trim() || 'Stock adjustment',
    });
    setAdjustTarget(null);
    setAdjReason('');
  };

  return (
    <div className="space-y-6">
      {/* Valuation KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('stockValuationCost')}</div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50">
            {formatMMK(valuation.costValue)}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('stockValuationRetail')}</div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-burgundy-800 dark:text-burgundy-300">
            {formatMMK(valuation.retailValue)}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('potentialProfit')}</div>
          <div className="mt-1.5 text-xl font-bold font-mono-num text-emerald-700 dark:text-emerald-400">
            +{formatMMK(valuation.potentialProfit)}
          </div>
        </div>
      </div>

      {/* Inventory Stock Table */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-titanium-200 dark:border-titanium-800 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('navStock')}</h3>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-titanium-700 dark:text-titanium-300 cursor-pointer">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="rounded border-titanium-300 dark:border-titanium-700 accent-burgundy-700 text-burgundy-700"
            />
            {t('lowStockOnly')}
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('sku')}</th>
                <th className="px-4 py-3 font-medium">{t('productName')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('stock')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('minStock')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('stockValuationCost')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {displayedProducts.map((p) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                    <td className="px-5 py-3 font-mono-num text-xs text-titanium-500 dark:text-titanium-400">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-titanium-900 dark:text-titanium-50">
                      {p.name}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono-num font-bold ${
                        p.stock <= 0
                          ? 'text-red-700 dark:text-red-400'
                          : isLow
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-titanium-900 dark:text-titanium-50'
                      }`}
                    >
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-titanium-500 dark:text-titanium-400">
                      {p.minStock}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-titanium-700 dark:text-titanium-300">
                      {formatMMK(Math.max(0, p.stock) * p.costPrice)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setAdjustTarget(p);
                          setAdjType('in');
                          setAdjQty('5');
                          setAdjReason('');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {t('adjustStock')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Audit Log */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('stockAuditLog')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('date')}</th>
                <th className="px-4 py-3 font-medium">{t('productName')}</th>
                <th className="px-4 py-3 font-medium">{t('status')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('qtyCol')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('previousStock')} → {t('newStock')}
                </th>
                <th className="px-5 py-3 font-medium">{t('reason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {stockLogs.slice(0, 25).map((log) => (
                <tr key={log.id} className="hover:bg-titanium-50/50 dark:hover:bg-titanium-800/30">
                  <td className="px-5 py-2.5 font-mono-num text-xs text-titanium-500 dark:text-titanium-400 whitespace-nowrap">
                    {log.date}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-titanium-900 dark:text-titanium-50">
                    {log.productName}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold uppercase">
                    <span
                      className={
                        log.type === 'in'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : log.type === 'out'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }
                    >
                      {log.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                    {log.type === 'in' ? `+${log.quantity}` : log.type === 'out' ? `-${log.quantity}` : log.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-xs text-titanium-500 dark:text-titanium-400">
                    {log.previousStock} → {log.newStock}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-titanium-600 dark:text-titanium-400">
                    {log.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleAdjustSubmit}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 truncate pr-2">
                {t('adjustStock')} · {adjustTarget.name}
              </h3>
              <button type="button" onClick={() => setAdjustTarget(null)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-titanium-500 dark:text-titanium-400">
                {t('stock')}:{' '}
                <span className="font-mono-num font-bold text-titanium-900 dark:text-titanium-50">
                  {adjustTarget.stock} {adjustTarget.unit}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['in', 'out', 'adjust'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAdjType(mode)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      adjType === mode
                        ? 'border-burgundy-700 dark:border-burgundy-600 bg-burgundy-700 dark:bg-burgundy-600 text-white'
                        : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                    }`}
                  >
                    {mode === 'in'
                      ? t('stockIn')
                      : mode === 'out'
                      ? t('stockOut')
                      : t('stockAdjust')}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('qtyCol')}</label>
                <input
                  type="number"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('reason')}</label>
                <input
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Stock count verification, damaged items..."
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
