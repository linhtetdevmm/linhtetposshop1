import React, { useEffect, useMemo, useState } from 'react';
import { Package, Pencil, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { Product, StockLog } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { calculateMarginPercent, calculateSellPrice, formatMMK } from '../../lib/format';
import { sanitizeProductImageUrl } from '../../lib/imageUtils';
import { ProductImagePicker } from '../ProductImagePicker';
import {
  getEffectiveStockThreshold,
  getLowStockProducts,
  isProductLowStock,
} from '../../lib/stockAlerts';

interface StockViewProps {
  customThreshold?: number | null;
  onChangeThreshold?: (next: number | null) => void;
  initialLowOnlyKey?: number;
}

export const StockView: React.FC<StockViewProps> = ({
  customThreshold = null,
  onChangeThreshold,
  initialLowOnlyKey = 0,
}) => {
  const {
    products,
    stockLogs,
    lang,
    adjustProductStock,
    saveProduct,
    deleteProduct,
    updateStockLog,
    deleteStockLog,
  } = usePos();
  const t = useT(lang);

  const [lowOnly, setLowOnly] = useState(initialLowOnlyKey > 0);
  const [thresholdInput, setThresholdInput] = useState(
    customThreshold !== null ? String(customThreshold) : '5'
  );

  useEffect(() => {
    if (initialLowOnlyKey > 0) {
      setLowOnly(true);
    }
  }, [initialLowOnlyKey]);

  useEffect(() => {
    if (customThreshold !== null) {
      setThresholdInput(String(customThreshold));
    }
  }, [customThreshold]);

  // Stock Adjustment modal
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'in' | 'out' | 'adjust'>('in');
  const [adjQty, setAdjQty] = useState('5');
  const [adjReason, setAdjReason] = useState('');

  // Full Stock Item Edit modal
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [epSku, setEpSku] = useState('');
  const [epName, setEpName] = useState('');
  const [epCategory, setEpCategory] = useState('');
  const [epUnit, setEpUnit] = useState('');
  const [epCost, setEpCost] = useState('0');
  const [epMargin, setEpMargin] = useState('0');
  const [epSell, setEpSell] = useState('0');
  const [epStock, setEpStock] = useState('0');
  const [epMinStock, setEpMinStock] = useState('0');
  const [epImageUrl, setEpImageUrl] = useState('');

  // Stock Log Edit modal
  const [editLog, setEditLog] = useState<StockLog | null>(null);
  const [elDate, setElDate] = useState('');
  const [elProductName, setElProductName] = useState('');
  const [elType, setElType] = useState<'in' | 'out' | 'adjust'>('in');
  const [elQty, setElQty] = useState('0');
  const [elPrev, setElPrev] = useState('0');
  const [elNew, setElNew] = useState('0');
  const [elReason, setElReason] = useState('');

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

  const lowStockList = useMemo(
    () => getLowStockProducts(products, customThreshold),
    [products, customThreshold]
  );

  const displayedProducts = useMemo(
    () => (lowOnly ? lowStockList : products),
    [products, lowStockList, lowOnly]
  );

  const openEditProduct = (p: Product) => {
    setEditProd(p);
    setEpSku(p.sku);
    setEpName(p.name);
    setEpCategory(p.category);
    setEpUnit(p.unit);
    setEpCost(String(p.costPrice));
    setEpMargin(String(p.marginPercent));
    setEpSell(String(p.sellPrice));
    setEpStock(String(p.stock));
    setEpMinStock(String(p.minStock));
    setEpImageUrl(p.imageUrl || '');
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProd || !epName.trim()) return;
    await saveProduct(
      {
        sku: epSku.trim() || editProd.sku,
        name: epName.trim(),
        category: epCategory.trim() || 'General',
        unit: epUnit.trim() || 'pcs',
        costPrice: Number(epCost) || 0,
        marginPercent: Number(epMargin) || 0,
        sellPrice: Number(epSell) || 0,
        stock: Number(epStock) || 0,
        minStock: Number(epMinStock) || 0,
        imageUrl: sanitizeProductImageUrl(epImageUrl),
      },
      editProd.id
    );
    setEditProd(null);
  };

  const openEditLog = (log: StockLog) => {
    setEditLog(log);
    setElDate(log.date);
    setElProductName(log.productName);
    setElType(log.type);
    setElQty(String(log.quantity));
    setElPrev(String(log.previousStock));
    setElNew(String(log.newStock));
    setElReason(log.reason);
  };

  const handleSaveEditLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLog) return;
    await updateStockLog(editLog.id, {
      date: elDate,
      productName: elProductName.trim() || editLog.productName,
      type: elType,
      quantity: Number(elQty) || 0,
      previousStock: Number(elPrev) || 0,
      newStock: Number(elNew) || 0,
      reason: elReason.trim() || 'Adjustment',
    });
    setEditLog(null);
  };

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
        <div className="px-5 py-4 border-b border-titanium-200 dark:border-titanium-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('navStock')}</h3>
            {lowStockList.length > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-mono-num font-semibold rounded-md bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70">
                {lowStockList.length} {lang === 'my' ? 'မျိုး နည်းနေ' : 'low'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onChangeThreshold && (
              <div className="inline-flex items-center gap-1.5 text-xs text-titanium-600 dark:text-titanium-400">
                <span>{lang === 'my' ? 'သတိပေးအဆင့်:' : 'Threshold:'}</span>
                <select
                  value={customThreshold === null ? 'per_item' : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'per_item') {
                      onChangeThreshold(null);
                    } else {
                      const val = Math.max(0, Math.floor(Number(thresholdInput) || 5));
                      setThresholdInput(String(val));
                      onChangeThreshold(val);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-md focus:outline-none focus:border-burgundy-600"
                >
                  <option value="per_item">
                    {lang === 'my' ? 'ပစ္စည်းအလိုက် (Min)' : 'Per Item (Min)'}
                  </option>
                  <option value="custom">
                    {lang === 'my' ? 'စုပေါင်းသတ်မှတ် ≤' : 'Global ≤'}
                  </option>
                </select>
                {customThreshold !== null && (
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={thresholdInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setThresholdInput(raw);
                      if (raw.trim() === '') return;
                      const parsed = Number(raw);
                      if (Number.isFinite(parsed) && parsed >= 0) {
                        onChangeThreshold(Math.floor(parsed));
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs font-mono-num text-right bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-md focus:outline-none focus:border-burgundy-600"
                  />
                )}
              </div>
            )}
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
                const isLow = isProductLowStock(p, customThreshold);
                const threshold = getEffectiveStockThreshold(p, customThreshold);
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40 ${
                      p.stock <= 0
                        ? 'bg-red-50/35 dark:bg-red-950/15'
                        : isLow
                        ? 'bg-amber-50/35 dark:bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <td className="px-5 py-3 font-mono-num text-xs text-titanium-500 dark:text-titanium-400">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-titanium-900 dark:text-titanium-50">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md border border-titanium-200 dark:border-titanium-700 bg-titanium-50 dark:bg-titanium-950 overflow-hidden flex items-center justify-center shrink-0">
                          {sanitizeProductImageUrl(p.imageUrl) ? (
                            <img
                              src={sanitizeProductImageUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-3.5 h-3.5 text-titanium-300 dark:text-titanium-600" />
                          )}
                        </div>
                        <span>{p.name}</span>
                        {isLow && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border whitespace-nowrap ${
                              p.stock <= 0
                                ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800/70'
                                : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/70'
                            }`}
                          >
                            {p.stock <= 0
                              ? t('outOfStock')
                              : lang === 'my'
                              ? 'လက်ကျန်နည်း'
                              : 'Low'}
                          </span>
                        )}
                      </div>
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
                      {threshold}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-titanium-700 dark:text-titanium-300">
                      {formatMMK(Math.max(0, p.stock) * p.costPrice)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
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
                        <button
                          onClick={() => openEditProduct(p)}
                          className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300"
                          aria-label={t('edit')}
                          title={t('edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                          aria-label={t('delete')}
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                <th className="px-4 py-3 font-medium">{t('reason')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {stockLogs.slice(0, 50).map((log) => (
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
                  <td className="px-4 py-2.5 text-xs text-titanium-600 dark:text-titanium-400">
                    {log.reason}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEditLog(log)}
                      className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300 mr-3"
                      aria-label={t('edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteStockLog(log.id)}
                      className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

      {/* Full Stock Item Edit Modal */}
      {editProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSaveEditProduct}
            className="w-full max-w-lg bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {t('editProduct')}
              </h3>
              <button type="button" onClick={() => setEditProd(null)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <ProductImagePicker value={epImageUrl} onChange={setEpImageUrl} lang={lang} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('sku')}</label>
                  <input
                    required
                    value={epSku}
                    onChange={(e) => setEpSku(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('productName')}</label>
                  <input
                    required
                    value={epName}
                    onChange={(e) => setEpName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('category')}</label>
                  <input
                    required
                    value={epCategory}
                    onChange={(e) => setEpCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('unit')}</label>
                  <input
                    required
                    value={epUnit}
                    onChange={(e) => setEpUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('costPrice')}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={epCost}
                    onChange={(e) => {
                      setEpCost(e.target.value);
                      setEpSell(String(calculateSellPrice(Number(e.target.value) || 0, Number(epMargin) || 0)));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('marginPercent')}</label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    min={0}
                    required
                    value={epMargin}
                    onChange={(e) => {
                      setEpMargin(e.target.value);
                      setEpSell(String(calculateSellPrice(Number(epCost) || 0, Number(e.target.value) || 0)));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('sellPrice')}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={epSell}
                    onChange={(e) => {
                      setEpSell(e.target.value);
                      setEpMargin(String(calculateMarginPercent(Number(epCost) || 0, Number(e.target.value) || 0)));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('stock')}</label>
                  <input
                    type="number"
                    required
                    value={epStock}
                    onChange={(e) => setEpStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('minStock')}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={epMinStock}
                    onChange={(e) => setEpMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setEditProd(null)}
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

      {/* Edit Stock Log Modal */}
      {editLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSaveEditLog}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {lang === 'my' ? 'Stock မှတ်တမ်း ပြင်ဆင်ရန်' : 'Edit Stock Log'}
              </h3>
              <button type="button" onClick={() => setEditLog(null)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('date')}</label>
                  <input
                    type="date"
                    required
                    value={elDate}
                    onChange={(e) => setElDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('status')}</label>
                  <select
                    value={elType}
                    onChange={(e) => setElType(e.target.value as 'in' | 'out' | 'adjust')}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  >
                    <option value="in">{t('stockIn')}</option>
                    <option value="out">{t('stockOut')}</option>
                    <option value="adjust">{t('stockAdjust')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('productName')}</label>
                <input
                  required
                  value={elProductName}
                  onChange={(e) => setElProductName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('qtyCol')}</label>
                  <input
                    type="number"
                    required
                    value={elQty}
                    onChange={(e) => setElQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('previousStock')}</label>
                  <input
                    type="number"
                    required
                    value={elPrev}
                    onChange={(e) => setElPrev(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('newStock')}</label>
                  <input
                    type="number"
                    required
                    value={elNew}
                    onChange={(e) => setElNew(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('reason')}</label>
                <input
                  required
                  value={elReason}
                  onChange={(e) => setElReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setEditLog(null)}
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
