import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PurchaseItem } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

export const PurchasesView: React.FC = () => {
  const { purchases, products, lang, createPurchase, deletePurchase } = usePos();
  const t = useT(lang);

  const [modalOpen, setModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [status, setStatus] = useState<'paid' | 'credit'>('paid');
  const [paidAmount, setPaidAmount] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [selectedProdId, setSelectedProdId] = useState('');
  const [qty, setQty] = useState('10');
  const [costPrice, setCostPrice] = useState('');

  const handleSelectProduct = (prodId: string) => {
    setSelectedProdId(prodId);
    const p = products.find((x) => x.id === prodId);
    if (p) setCostPrice(String(p.costPrice));
  };

  const addLine = () => {
    const p = products.find((x) => x.id === selectedProdId);
    if (!p) return;
    const q = Math.max(1, Number(qty) || 1);
    const c = Math.max(0, Number(costPrice) || p.costPrice);
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        qty: q,
        costPrice: c,
        lineTotal: q * c,
      },
    ]);
    setSelectedProdId('');
    setQty('10');
    setCostPrice('');
  };

  const totalAmount = items.reduce((s, it) => s + it.lineTotal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || items.length === 0) return;
    await createPurchase({
      supplierName: supplierName.trim(),
      date,
      items,
      paidAmount: status === 'paid' ? totalAmount : Number(paidAmount) || 0,
      status,
      note,
    });
    setModalOpen(false);
    setSupplierName('');
    setItems([]);
    setPaidAmount('');
    setNote('');
  };

  const totalSpent = purchases.reduce((s, p) => s + p.totalAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-titanium-600 dark:text-titanium-400">
          {t('totalAmount')}:{' '}
          <span className="font-mono-num font-bold text-titanium-900 dark:text-titanium-50 ml-1">
            {formatMMK(totalSpent)}
          </span>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t('newPurchase')}
        </button>
      </div>

      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('refNo')}</th>
                <th className="px-4 py-3 font-medium">{t('date')}</th>
                <th className="px-4 py-3 font-medium">{t('supplierName')}</th>
                <th className="px-4 py-3 font-medium">{t('purchaseStatus')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('totalAmount')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('paidAmount')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {purchases.map((pur) => (
                <tr key={pur.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                  <td className="px-5 py-3 font-mono-num font-medium text-titanium-900 dark:text-titanium-50 whitespace-nowrap">
                    {pur.refNo}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-titanium-600 dark:text-titanium-400 whitespace-nowrap">
                    {pur.date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-titanium-900 dark:text-titanium-50">
                      {pur.supplierName}
                    </div>
                    <div className="text-xs text-titanium-500 dark:text-titanium-400">
                      {pur.items.length} {t('items')} {pur.note ? `· ${pur.note}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span
                      className={
                        pur.status === 'paid'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }
                    >
                      {pur.status === 'paid' ? t('paid') : t('credit')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-titanium-900 dark:text-titanium-50 whitespace-nowrap">
                    {formatMMK(pur.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-titanium-600 dark:text-titanium-400 whitespace-nowrap">
                    {formatMMK(pur.paidAmount)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => deletePurchase(pur.id)}
                      className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-titanium-500 dark:text-titanium-400">
                    No purchase orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('newPurchase')}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('supplierName')}</label>
                  <input
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Bayintnaung Wholesale"
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('date')}</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              {/* Add Item Row */}
              <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('productName')}</label>
                    <select
                      value={selectedProdId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    >
                      <option value="">-- Select --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('qtyCol')}</label>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('costPrice')}</label>
                    <input
                      type="number"
                      min={0}
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={addLine}
                      disabled={!selectedProdId}
                      className="w-full py-2 px-3 text-xs font-semibold text-white bg-titanium-800 dark:bg-burgundy-600 hover:bg-titanium-900 dark:hover:bg-burgundy-500 disabled:opacity-40 rounded-lg transition-colors"
                    >
                      {t('addItem')}
                    </button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="divide-y divide-titanium-200 dark:divide-titanium-800 text-xs pt-1">
                    {items.map((it, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between gap-2">
                        <span className="font-medium text-titanium-800 dark:text-titanium-200 truncate">
                          {it.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 font-mono-num">
                          <span>
                            {it.qty} × {formatMMK(it.costPrice)}
                          </span>
                          <span className="font-semibold">{formatMMK(it.lineTotal)}</span>
                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('purchaseStatus')}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'paid' | 'credit')}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  >
                    <option value="paid">{t('paid')}</option>
                    <option value="credit">{t('credit')}</option>
                  </select>
                </div>
                {status === 'credit' && (
                  <div>
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('paidAmount')}</label>
                    <input
                      type="number"
                      min={0}
                      max={totalAmount}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                )}
                <div className={status === 'paid' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('note')}</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-titanium-200 dark:border-titanium-800 text-sm font-bold">
                <span>{t('totalAmount')}</span>
                <span className="font-mono-num text-burgundy-800 dark:text-burgundy-300">
                  {formatMMK(totalAmount)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-40 rounded-lg"
              >
                {t('recordPurchase')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
