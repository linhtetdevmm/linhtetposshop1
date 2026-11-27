import React, { useMemo, useState } from 'react';
import { Boxes, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Purchase, PurchaseItem } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

type PurchaseMode = 'retail' | 'wholesale';
type PurchaseFilter = 'all' | 'wholesale' | 'retail';
type PaySettlementMode = 'full' | 'half' | 'credit';

const PACK_PRESETS = [6, 10, 12, 24, 50];

function isWholesalePurchase(pur: Purchase): boolean {
  return (
    pur.refNo.toUpperCase().startsWith('PO-W') ||
    pur.items.some((it) => it.purchaseMode === 'wholesale' || (it.packCount ?? 0) > 0)
  );
}

export const PurchasesView: React.FC = () => {
  const { purchases, products, lang, createPurchase, updatePurchase, deletePurchase } = usePos();
  const t = useT(lang);

  // List filters
  const [filterMode, setFilterMode] = useState<PurchaseFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('retail');
  const [refNo, setRefNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [paySettlement, setPaySettlement] = useState<PaySettlementMode>('full');
  const [paidAmount, setPaidAmount] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Line builder state (shared + wholesale)
  const [selectedProdId, setSelectedProdId] = useState('');
  const [qty, setQty] = useState('10');
  const [costPrice, setCostPrice] = useState('');
  const [packCount, setPackCount] = useState('5');
  const [unitsPerPack, setUnitsPerPack] = useState('12');
  const [packCost, setPackCost] = useState('');
  const [wholesaleDiscount, setWholesaleDiscount] = useState('0');

  const selectedProduct = useMemo(
    () => products.find((x) => x.id === selectedProdId) ?? null,
    [products, selectedProdId]
  );

  // Live wholesale line preview
  const previewPackCount = Math.max(1, Number(packCount) || 1);
  const previewUnitsPerPack = Math.max(1, Number(unitsPerPack) || 1);
  const previewTotalUnits = previewPackCount * previewUnitsPerPack;
  const previewPackCost = Math.max(0, Number(packCost) || 0);
  const previewDiscount = Math.max(0, Number(wholesaleDiscount) || 0);
  const previewGrossLot = previewPackCount * previewPackCost;
  const previewWholesaleTotal = Math.max(0, previewGrossLot - previewDiscount);
  const previewEffectiveUnitCost =
    previewTotalUnits > 0 ? Math.round(previewWholesaleTotal / previewTotalUnits) : 0;

  const openAdd = (mode: PurchaseMode = 'retail') => {
    setEditingId(null);
    setPurchaseMode(mode);
    setRefNo('');
    setSupplierName('');
    setDate(getTodayISO());
    setPaySettlement('full');
    setPaidAmount('');
    setNote('');
    setItems([]);
    setSelectedProdId('');
    setQty('10');
    setCostPrice('');
    setPackCount('5');
    setUnitsPerPack('12');
    setPackCost('');
    setWholesaleDiscount('0');
    setModalOpen(true);
  };

  const openEdit = (pur: Purchase) => {
    const wholesale = isWholesalePurchase(pur);
    setEditingId(pur.id);
    setPurchaseMode(wholesale ? 'wholesale' : 'retail');
    setRefNo(pur.refNo);
    setSupplierName(pur.supplierName);
    setDate(pur.date);
    if (pur.status === 'paid' || pur.paidAmount >= pur.totalAmount) {
      setPaySettlement('full');
      setPaidAmount(String(pur.totalAmount));
    } else if (pur.totalAmount > 0 && Math.abs(pur.paidAmount - Math.round(pur.totalAmount / 2)) <= 1) {
      setPaySettlement('half');
      setPaidAmount(String(pur.paidAmount));
    } else {
      setPaySettlement('credit');
      setPaidAmount(String(pur.paidAmount));
    }
    setNote(pur.note);
    setItems(pur.items.map((it) => ({ ...it })));
    setSelectedProdId('');
    setQty('10');
    setCostPrice('');
    setPackCount('5');
    setUnitsPerPack('12');
    setPackCost('');
    setWholesaleDiscount('0');
    setModalOpen(true);
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProdId(prodId);
    const p = products.find((x) => x.id === prodId);
    if (p) {
      setCostPrice(String(p.costPrice));
      const upp = Math.max(1, Number(unitsPerPack) || 12);
      setPackCost(String(p.costPrice * upp));
    } else {
      setCostPrice('');
      setPackCost('');
    }
  };

  const handleUnitsPerPackChange = (nextVal: string) => {
    setUnitsPerPack(nextVal);
    if (selectedProduct) {
      const nextUpp = Math.max(1, Number(nextVal) || 1);
      setPackCost(String(selectedProduct.costPrice * nextUpp));
    }
  };

  const addLine = () => {
    const p = selectedProduct;
    if (!p) return;

    if (purchaseMode === 'wholesale') {
      const packs = Math.max(1, Number(packCount) || 1);
      const upp = Math.max(1, Number(unitsPerPack) || 1);
      const pCost = Math.max(0, Number(packCost) || p.costPrice * upp);
      const disc = Math.max(0, Number(wholesaleDiscount) || 0);
      const totalUnits = packs * upp;
      const lineTotal = Math.max(0, packs * pCost - disc);
      const effectiveUnitCost = totalUnits > 0 ? Math.round(lineTotal / totalUnits) : p.costPrice;

      setItems((prev) => [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: totalUnits,
          costPrice: effectiveUnitCost,
          lineTotal,
          purchaseMode: 'wholesale',
          packCount: packs,
          unitsPerPack: upp,
          packCost: pCost,
          wholesaleDiscount: disc > 0 ? disc : undefined,
        },
      ]);
      setSelectedProdId('');
      setPackCount('5');
      setPackCost('');
      setWholesaleDiscount('0');
      setCostPrice('');
    } else {
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
          purchaseMode: 'retail',
        },
      ]);
      setSelectedProdId('');
      setQty('10');
      setCostPrice('');
    }
  };

  const updateRetailLine = (idx: number, nextQty: number, nextCost: number) => {
    const q = Math.max(1, nextQty);
    const c = Math.max(0, nextCost);
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: q, costPrice: c, lineTotal: q * c } : it))
    );
  };

  const updateWholesaleLine = (
    idx: number,
    nextPacks: number,
    nextUpp: number,
    nextPackCost: number
  ) => {
    const packs = Math.max(1, nextPacks);
    const upp = Math.max(1, nextUpp);
    const pCost = Math.max(0, nextPackCost);
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const disc = Math.max(0, it.wholesaleDiscount || 0);
        const totalUnits = packs * upp;
        const lineTotal = Math.max(0, packs * pCost - disc);
        const unitCost = totalUnits > 0 ? Math.round(lineTotal / totalUnits) : 0;
        return {
          ...it,
          purchaseMode: 'wholesale',
          packCount: packs,
          unitsPerPack: upp,
          packCost: pCost,
          qty: totalUnits,
          costPrice: unitCost,
          lineTotal,
        };
      })
    );
  };

  const totalAmount = items.reduce((s, it) => s + it.lineTotal, 0);
  const totalModalUnits = items.reduce((s, it) => s + it.qty, 0);
  const totalModalPacks = items.reduce((s, it) => s + (it.packCount || 0), 0);

  const selectSettlementMode = (mode: PaySettlementMode) => {
    setPaySettlement(mode);
    if (mode === 'full') {
      setPaidAmount(String(totalAmount));
    } else if (mode === 'half') {
      setPaidAmount(String(Math.round(totalAmount / 2)));
    } else if (paidAmount === String(totalAmount)) {
      setPaidAmount('0');
    }
  };

  const effectivePaid =
    paySettlement === 'full'
      ? totalAmount
      : paySettlement === 'half'
      ? Math.min(totalAmount, Number(paidAmount) || Math.round(totalAmount / 2))
      : Math.min(totalAmount, Math.max(0, Number(paidAmount) || 0));

  const effectiveStatus: 'paid' | 'credit' = effectivePaid >= totalAmount ? 'paid' : 'credit';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || items.length === 0) return;

    const hasWholesaleItems =
      purchaseMode === 'wholesale' || items.some((it) => it.purchaseMode === 'wholesale' || (it.packCount ?? 0) > 0);

    if (editingId) {
      await updatePurchase(editingId, {
        refNo: refNo.trim() || (hasWholesaleItems ? 'PO-W' : 'PO'),
        supplierName: supplierName.trim(),
        date,
        items,
        paidAmount: effectivePaid,
        status: effectiveStatus,
        note,
      });
    } else {
      await createPurchase({
        supplierName: supplierName.trim(),
        date,
        items,
        paidAmount: effectivePaid,
        status: effectiveStatus,
        note,
        purchaseMode: hasWholesaleItems ? 'wholesale' : 'retail',
      });
    }
    setModalOpen(false);
    setEditingId(null);
    setSupplierName('');
    setItems([]);
    setPaidAmount('');
    setNote('');
  };

  // Metrics & filtered rows
  const { totalSpent, wholesaleSpent, wholesaleCount, creditCount } = useMemo(() => {
    let spent = 0;
    let wSpent = 0;
    let wCount = 0;
    let cCount = 0;
    for (const p of purchases) {
      spent += p.totalAmount;
      if (isWholesalePurchase(p)) {
        wSpent += p.totalAmount;
        wCount += 1;
      }
      if (p.status === 'credit' && p.paidAmount < p.totalAmount) {
        cCount += 1;
      }
    }
    return {
      totalSpent: spent,
      wholesaleSpent: wSpent,
      wholesaleCount: wCount,
      creditCount: cCount,
    };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return purchases.filter((pur) => {
      const wholesale = isWholesalePurchase(pur);
      if (filterMode === 'wholesale' && !wholesale) return false;
      if (filterMode === 'retail' && wholesale) return false;
      if (!q) return true;
      return (
        pur.refNo.toLowerCase().includes(q) ||
        pur.supplierName.toLowerCase().includes(q) ||
        (pur.note || '').toLowerCase().includes(q) ||
        pur.items.some((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q))
      );
    });
  }, [purchases, filterMode, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-titanium-200 dark:border-titanium-800 bg-white dark:bg-titanium-900 p-1">
            {(
              [
                { id: 'all', label: t('allPurchases'), count: purchases.length },
                { id: 'wholesale', label: t('wholesaleBadge'), count: wholesaleCount },
                { id: 'retail', label: t('retailBadge'), count: purchases.length - wholesaleCount },
              ] as const
            ).map((tab) => {
              const active = filterMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-burgundy-700 text-white dark:bg-burgundy-600'
                      : 'text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 font-mono-num text-[11px] ${
                      active ? 'text-white/85' : 'text-titanium-400 dark:text-titanium-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPurchases')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-lg focus:outline-none focus:border-burgundy-600 text-titanium-900 dark:text-titanium-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openAdd('retail')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-titanium-800 dark:text-titanium-100 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 hover:bg-titanium-50 dark:hover:bg-titanium-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t('newPurchase')}
          </button>
          <button
            type="button"
            onClick={() => openAdd('wholesale')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors whitespace-nowrap"
          >
            <Boxes className="w-4 h-4" />
            {t('wholesalePurchase')}
          </button>
        </div>
      </div>

      {/* Single-elevation Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-titanium-200 dark:divide-titanium-800">
        <div className="px-5 py-3.5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('totalAmount')}</div>
          <div className="mt-1 text-lg font-mono-num font-bold text-titanium-900 dark:text-titanium-50">
            {formatMMK(totalSpent)}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {t('wholesaleOrdersCount')} ({wholesaleCount})
          </div>
          <div className="mt-1 text-lg font-mono-num font-bold text-burgundy-700 dark:text-burgundy-300">
            {formatMMK(wholesaleSpent)}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {t('credit')} ({creditCount})
          </div>
          <div className="mt-1 text-lg font-mono-num font-bold text-amber-700 dark:text-amber-400">
            {formatMMK(
              purchases.reduce((s, p) => s + Math.max(0, p.totalAmount - p.paidAmount), 0)
            )}
          </div>
        </div>
      </div>

      {/* Purchases Table */}
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
              {filteredPurchases.map((pur) => {
                const wholesale = isWholesalePurchase(pur);
                const totalPacks = pur.items.reduce((s, it) => s + (it.packCount || 0), 0);
                const totalQty = pur.items.reduce((s, it) => s + it.qty, 0);
                return (
                  <tr key={pur.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-medium text-titanium-900 dark:text-titanium-50">
                          {pur.refNo}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                            wholesale
                              ? 'bg-burgundy-50 text-burgundy-700 border-burgundy-200 dark:bg-burgundy-950/60 dark:text-burgundy-300 dark:border-burgundy-800'
                              : 'bg-titanium-100 text-titanium-600 border-titanium-200 dark:bg-titanium-800 dark:text-titanium-300 dark:border-titanium-700'
                          }`}
                        >
                          {wholesale ? t('wholesaleBadge') : t('retailBadge')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-num text-titanium-600 dark:text-titanium-400 whitespace-nowrap">
                      {pur.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-titanium-900 dark:text-titanium-50">
                        {pur.supplierName}
                      </div>
                      <div className="text-xs text-titanium-500 dark:text-titanium-400 font-mono-num">
                        {pur.items.length} {t('items')}
                        {wholesale && totalPacks > 0
                          ? ` · ${totalPacks} ${lang === 'my' ? 'ဖာ' : 'packs'} (${totalQty} ${lang === 'my' ? 'ခု' : 'units'})`
                          : ` · ${totalQty} ${lang === 'my' ? 'ခု' : 'units'}`}
                        {pur.note ? ` · ${pur.note}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
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
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(pur)}
                        className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300 mr-3"
                        aria-label={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePurchase(pur.id)}
                        className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="text-sm text-titanium-500 dark:text-titanium-400 mb-3">
                      {lang === 'my' ? 'အဝယ်စာရင်း မရှိသေးပါ။' : 'No matching purchase orders found.'}
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAdd('wholesale')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 rounded-lg whitespace-nowrap"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        {t('wholesalePurchase')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Purchase Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800 shrink-0">
              <div className="flex items-center gap-2.5">
                {purchaseMode === 'wholesale' ? (
                  <Boxes className="w-4 h-4 text-burgundy-700 dark:text-burgundy-400" />
                ) : (
                  <Package className="w-4 h-4 text-titanium-600 dark:text-titanium-300" />
                )}
                <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                  {editingId
                    ? lang === 'my'
                      ? 'အဝယ်စာရင်း ပြင်ဆင်ရန်'
                      : 'Edit Purchase Order'
                    : purchaseMode === 'wholesale'
                    ? t('wholesalePurchase')
                    : t('newPurchase')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Purchase Type Toggle */}
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1.5">
                  {t('purchaseModeLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchaseMode('retail')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      purchaseMode === 'retail'
                        ? 'border-burgundy-700 bg-burgundy-700 text-white dark:border-burgundy-600 dark:bg-burgundy-600'
                        : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    {t('retailPurchase')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseMode('wholesale')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      purchaseMode === 'wholesale'
                        ? 'border-burgundy-700 bg-burgundy-700 text-white dark:border-burgundy-600 dark:bg-burgundy-600'
                        : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    {t('wholesalePurchase')}
                  </button>
                </div>
              </div>

              {/* Supplier & Date Row */}
              <div className={`grid grid-cols-1 ${editingId ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                {editingId && (
                  <div>
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                      {t('refNo')}
                    </label>
                    <input
                      required
                      value={refNo}
                      onChange={(e) => setRefNo(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                    {t('supplierName')}
                  </label>
                  <input
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder={
                      purchaseMode === 'wholesale'
                        ? lang === 'my'
                          ? 'ဥပမာ - ဘုရင့်နောင် လက်ကားဒိုင်'
                          : 'e.g. Bayintnaung Wholesale Market'
                        : 'e.g. Yangon Trading Co.'
                    }
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                    {t('date')}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              {/* Add Item Builder */}
              <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-3.5 space-y-3">
                {purchaseMode === 'retail' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                        {t('productName')}
                      </label>
                      <select
                        value={selectedProdId}
                        onChange={(e) => handleSelectProduct(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                      >
                        <option value="">-- Select --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name} ({p.stock} {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                        {t('qtyCol')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                        {t('costPrice')}
                      </label>
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
                        className="w-full py-2 px-3 text-xs font-semibold text-white bg-titanium-800 dark:bg-burgundy-600 hover:bg-titanium-900 dark:hover:bg-burgundy-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {t('addItem')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Wholesale Pack / Carton Builder */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                          {t('productName')}
                        </label>
                        <select
                          value={selectedProdId}
                          onChange={(e) => handleSelectProduct(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                        >
                          <option value="">-- Select --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} · {p.name} ({formatMMK(p.costPrice)} / {p.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                          {t('packQty')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={packCount}
                          onChange={(e) => setPackCount(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                          {t('unitsPerPack')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={unitsPerPack}
                          onChange={(e) => handleUnitsPerPackChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-4">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                          {t('packPrice')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={packCost}
                          onChange={(e) => setPackCost(e.target.value)}
                          placeholder={
                            selectedProduct
                              ? String(selectedProduct.costPrice * previewUnitsPerPack)
                              : '0'
                          }
                          className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                          {t('wholesaleDiscount')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={wholesaleDiscount}
                          onChange={(e) => setWholesaleDiscount(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <div className="flex flex-wrap gap-1">
                          {PACK_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleUnitsPerPackChange(String(preset))}
                              className={`px-2 py-1.5 text-[11px] font-mono-num font-semibold rounded-md border transition-colors ${
                                Number(unitsPerPack) === preset
                                  ? 'bg-burgundy-700 text-white border-burgundy-700 dark:bg-burgundy-600 dark:border-burgundy-600'
                                  : 'bg-white dark:bg-titanium-900 text-titanium-600 dark:text-titanium-300 border-titanium-200 dark:border-titanium-700 hover:bg-titanium-100 dark:hover:bg-titanium-800'
                              }`}
                            >
                              ×{preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={addLine}
                          disabled={!selectedProdId}
                          className="w-full py-2 px-3 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {t('addItem')}
                        </button>
                      </div>
                    </div>

                    {selectedProduct && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-lg text-xs">
                        <div className="text-titanium-600 dark:text-titanium-300 font-mono-num">
                          {t('totalUnitsLabel')}:{' '}
                          <span className="font-bold text-titanium-900 dark:text-titanium-50">
                            {previewPackCount} × {previewUnitsPerPack} = {previewTotalUnits}{' '}
                            {selectedProduct.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono-num">
                          <span className="text-titanium-600 dark:text-titanium-300">
                            {t('unitCostCalc')}:{' '}
                            <span
                              className={`font-bold ${
                                previewEffectiveUnitCost < selectedProduct.costPrice
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-titanium-900 dark:text-titanium-50'
                              }`}
                            >
                              {formatMMK(previewEffectiveUnitCost)}
                            </span>
                          </span>
                          <span className="font-bold text-burgundy-700 dark:text-burgundy-300">
                            {formatMMK(previewWholesaleTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Added Items List */}
                {items.length > 0 && (
                  <div className="divide-y divide-titanium-200 dark:divide-titanium-800 text-xs pt-1">
                    {items.map((it, idx) => {
                      const isLineWholesale =
                        it.purchaseMode === 'wholesale' || (it.packCount ?? 0) > 0;
                      return (
                        <div
                          key={idx}
                          className="py-2 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-[140px]">
                            <div className="font-medium text-titanium-800 dark:text-titanium-200 truncate">
                              {it.name}
                            </div>
                            <div className="text-[11px] text-titanium-500 dark:text-titanium-400 font-mono-num">
                              {it.sku}
                              {isLineWholesale && it.packCount && it.unitsPerPack
                                ? ` · ${it.packCount}×${it.unitsPerPack}=${it.qty} (${formatMMK(it.costPrice)}/unit)`
                                : ''}
                              {it.wholesaleDiscount
                                ? ` · -${formatMMK(it.wholesaleDiscount)}`
                                : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 font-mono-num">
                            {isLineWholesale && it.packCount && it.unitsPerPack ? (
                              <>
                                <input
                                  type="number"
                                  min={1}
                                  value={it.packCount}
                                  onChange={(e) =>
                                    updateWholesaleLine(
                                      idx,
                                      Number(e.target.value) || 1,
                                      it.unitsPerPack || 1,
                                      it.packCost ?? it.costPrice * (it.unitsPerPack || 1)
                                    )
                                  }
                                  className="w-14 px-2 py-1 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded text-right"
                                  title={t('packQty')}
                                />
                                <span>×</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={it.unitsPerPack}
                                  onChange={(e) =>
                                    updateWholesaleLine(
                                      idx,
                                      it.packCount || 1,
                                      Number(e.target.value) || 1,
                                      it.packCost ?? it.costPrice * (it.unitsPerPack || 1)
                                    )
                                  }
                                  className="w-14 px-2 py-1 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded text-right"
                                  title={t('unitsPerPack')}
                                />
                                <span>@</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={it.packCost ?? it.costPrice * (it.unitsPerPack || 1)}
                                  onChange={(e) =>
                                    updateWholesaleLine(
                                      idx,
                                      it.packCount || 1,
                                      it.unitsPerPack || 1,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="w-24 px-2 py-1 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded text-right"
                                  title={t('packPrice')}
                                />
                              </>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min={1}
                                  value={it.qty}
                                  onChange={(e) =>
                                    updateRetailLine(idx, Number(e.target.value) || 1, it.costPrice)
                                  }
                                  className="w-16 px-2 py-1 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded text-right"
                                  aria-label="Quantity"
                                />
                                <span>×</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={it.costPrice}
                                  onChange={(e) =>
                                    updateRetailLine(idx, it.qty, Number(e.target.value) || 0)
                                  }
                                  className="w-24 px-2 py-1 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded text-right"
                                  aria-label="Cost price"
                                />
                              </>
                            )}
                            <span className="font-semibold w-24 text-right">
                              {formatMMK(it.lineTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Settlement Options */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1.5">
                    {t('purchaseStatus')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => selectSettlementMode('full')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        paySettlement === 'full'
                          ? 'border-emerald-700 dark:border-emerald-600 bg-emerald-600 text-white'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('payFull')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectSettlementMode('half')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        paySettlement === 'half'
                          ? 'border-burgundy-700 dark:border-burgundy-600 bg-burgundy-700 dark:bg-burgundy-600 text-white'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('payHalf')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectSettlementMode('credit')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        paySettlement === 'credit'
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('credit')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {paySettlement !== 'full' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs text-titanium-500 dark:text-titanium-400">
                          {t('paidAmount')}
                        </label>
                        {totalAmount > 0 && (
                          <span className="text-[11px] font-mono-num text-amber-700 dark:text-amber-400">
                            {t('remaining')}: {formatMMK(Math.max(0, totalAmount - effectivePaid))}
                          </span>
                        )}
                      </div>
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
                  <div className={paySettlement === 'full' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                      {t('note')}
                    </label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-titanium-200 dark:border-titanium-800 text-sm font-bold">
                <div className="text-xs font-medium text-titanium-500 dark:text-titanium-400 font-mono-num">
                  {items.length} {t('items')}
                  {totalModalPacks > 0 ? ` · ${totalModalPacks} ${t('totalPacksLabel')}` : ''}
                  {totalModalUnits > 0 ? ` · ${totalModalUnits} ${t('totalUnitsLabel')}` : ''}
                </div>
                <div className="flex items-center gap-3">
                  <span>{t('totalAmount')}</span>
                  <span className="font-mono-num text-burgundy-800 dark:text-burgundy-300">
                    {formatMMK(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg whitespace-nowrap"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-40 rounded-lg whitespace-nowrap"
              >
                {editingId ? t('save') : t('recordPurchase')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
