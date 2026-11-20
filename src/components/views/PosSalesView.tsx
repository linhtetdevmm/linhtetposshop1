import React, { useMemo, useState } from 'react';
import { Minus, Plus, Receipt, Search, ShoppingCart, Trash2, Truck } from 'lucide-react';
import type { PaymentMethod, Product, Sale, SaleItem } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK } from '../../lib/format';

interface PosSalesViewProps {
  onOpenVoucher: (sale: Sale) => void;
}

export const PosSalesView: React.FC<PosSalesViewProps> = ({ onOpenVoucher }) => {
  const { products, sales, lang, createSale, deleteSale } = usePos();
  const t = useT(lang);

  const [subTab, setSubTab] = useState<'counter' | 'history'>('counter');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState<string>('0');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [courierName, setCourierName] = useState('Shop Rider');
  const [deliveryFee, setDeliveryFee] = useState('2500');
  const [submitting, setSubmitting] = useState(false);

  const [historySearch, setHistorySearch] = useState('');

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = selectedCategory === 'ALL' || p.category === selectedCategory;
      const qOk =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, search, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          qty: 1,
          costPrice: product.costPrice,
          unitPrice: product.sellPrice,
          lineTotal: product.sellPrice,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          return { ...item, qty: nextQty, lineTotal: nextQty * item.unitPrice };
        })
        .filter((x): x is SaleItem => x !== null)
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  );
  const discountNum = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const grandTotal = Math.max(0, subtotal - discountNum);
  const effectivePaid =
    paidAmount === ''
      ? paymentMethod === 'credit'
        ? 0
        : grandTotal
      : Math.max(0, Number(paidAmount) || 0);
  const diff = effectivePaid - grandTotal;

  const handleCheckout = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const created = await createSale({
        customerName,
        customerPhone,
        paymentMethod,
        items: cart,
        discount: discountNum,
        paidAmount: effectivePaid,
        note,
        createDelivery: includeDelivery
          ? {
              address: deliveryAddress || 'Yangon',
              courierName,
              deliveryFee: Number(deliveryFee) || 0,
            }
          : undefined,
      });

      // Reset cart cleanly
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('0');
      setPaidAmount('');
      setNote('');
      setIncludeDelivery(false);
      setDeliveryAddress('');
      onOpenVoucher(created);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.voucherNo.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.date.includes(q)
    );
  }, [sales, historySearch]);

  return (
    <div className="space-y-5">
      {/* Sub-navigation Segmented Control */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
          <button
            onClick={() => setSubTab('counter')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'counter'
                ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
            }`}
          >
            {t('posCounter')}
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'history'
                ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
            }`}
          >
            {t('salesHistory')} ({sales.length})
          </button>
        </div>
      </div>

      {subTab === 'counter' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Product Catalog Selector */}
          <div className="xl:col-span-7 space-y-4">
            <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white'
                        : 'bg-titanium-100 dark:bg-titanium-800 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-200 dark:hover:bg-titanium-700'
                    }`}
                  >
                    {cat === 'ALL' ? t('allCategories') : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const inCartQty =
                  cart.find((i) => i.productId === product.id)?.qty || 0;
                const isLow = product.stock <= product.minStock;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className={`text-left bg-white dark:bg-titanium-900 border rounded-xl p-3.5 transition-all hover:border-burgundy-600 dark:hover:border-burgundy-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 ${
                      inCartQty > 0
                        ? 'border-burgundy-600 dark:border-burgundy-500 ring-1 ring-burgundy-600/20'
                        : 'border-titanium-200 dark:border-titanium-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400">
                        {product.sku} · {product.category}
                      </span>
                      {inCartQty > 0 && (
                        <span className="text-xs font-mono-num font-bold text-burgundy-700 dark:text-burgundy-300">
                          ×{inCartQty}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-titanium-900 dark:text-titanium-50 line-clamp-2 min-h-[2.6rem]">
                      {product.name}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-titanium-100 dark:border-titanium-800 flex items-baseline justify-between">
                      <span className="text-sm font-bold font-mono-num text-burgundy-800 dark:text-burgundy-300">
                        {formatMMK(product.sellPrice)}
                      </span>
                      <span
                        className={`text-xs font-mono-num ${
                          product.stock <= 0
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-titanium-500 dark:text-titanium-400'
                        }`}
                      >
                        {product.stock} {product.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-10 text-center text-sm text-titanium-500 dark:text-titanium-400">
                  No matching products found.
                </div>
              )}
            </div>
          </div>

          {/* Right: Live POS Cart & Checkout */}
          <div className="xl:col-span-5 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-titanium-200 dark:border-titanium-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-burgundy-700 dark:text-burgundy-300" />
                <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                  {t('cart')} ({cart.reduce((s, i) => s + i.qty, 0)})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-titanium-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {t('clearCart')}
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-sm text-titanium-400 dark:text-titanium-500">
                {t('emptyCart')}
              </div>
            ) : (
              <div className="divide-y divide-titanium-100 dark:divide-titanium-800 max-h-64 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-titanium-900 dark:text-titanium-50 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs font-mono-num text-titanium-500 dark:text-titanium-400">
                        {formatMMK(item.unitPrice)} × {item.qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateCartQty(item.productId, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-titanium-200 dark:border-titanium-700 text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-mono-num font-semibold">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.productId, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-titanium-200 dark:border-titanium-700 text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-24 text-right text-xs font-mono-num font-semibold text-titanium-900 dark:text-titanium-50 shrink-0">
                      {formatMMK(item.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer & Payment Fields */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-titanium-200 dark:border-titanium-800">
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('customerName')}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('walkInCustomer')}
                  className="w-full px-3 py-1.5 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('customerPhone')}
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09-..."
                  className="w-full px-3 py-1.5 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1.5">
                {t('paymentMethod')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['cash', 'kbzpay', 'wavepay', 'credit'] as PaymentMethod[]).map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(pm);
                      if (pm === 'credit') setPaidAmount('0');
                      else setPaidAmount('');
                    }}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      paymentMethod === pm
                        ? 'border-burgundy-700 dark:border-burgundy-600 bg-burgundy-700 dark:bg-burgundy-600 text-white'
                        : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                    }`}
                  >
                    {t(pm)}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount & Paid Input */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('discount')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('paidAmount')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={String(grandTotal)}
                  className="w-full px-3 py-1.5 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>

            {/* Optional Delivery Dispatch Toggle */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-titanium-700 dark:text-titanium-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDelivery}
                  onChange={(e) => setIncludeDelivery(e.target.checked)}
                  className="rounded border-titanium-300 dark:border-titanium-700 accent-burgundy-700 text-burgundy-700 focus:ring-burgundy-600"
                />
                <Truck className="w-3.5 h-3.5 text-titanium-500 dark:text-titanium-400" />
                {t('addToDelivery')}
              </label>
              {includeDelivery && (
                <div className="mt-2.5 grid grid-cols-2 gap-2.5 pt-2 border-t border-titanium-100 dark:border-titanium-800">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={t('address')}
                    className="col-span-2 px-3 py-1.5 text-xs bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                  <input
                    type="text"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder={t('courierName')}
                    className="px-3 py-1.5 text-xs bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder={t('deliveryFee')}
                    className="px-3 py-1.5 text-xs font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="border-t border-titanium-200 dark:border-titanium-800 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-titanium-600 dark:text-titanium-400">
                <span>{t('subtotal')}</span>
                <span className="font-mono-num">{formatMMK(subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-titanium-900 dark:text-titanium-50">
                <span>{t('grandTotal')}</span>
                <span className="font-mono-num text-burgundy-800 dark:text-burgundy-300">
                  {formatMMK(grandTotal)}
                </span>
              </div>
              {cart.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-titanium-500 dark:text-titanium-400">
                    {diff >= 0 ? t('changeAmount') : t('dueAmount')}
                  </span>
                  <span
                    className={`font-mono-num font-semibold ${
                      diff >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {formatMMK(Math.abs(diff))}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0 || submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg transition-colors"
            >
              {submitting ? '...' : t('completeSale')}
            </button>
          </div>
        </div>
      ) : (
        /* Sales History Tab */
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-titanium-200 dark:border-titanium-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={`${t('voucherNo')}, ${t('customerName')}...`}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>
            <div className="text-xs text-titanium-500 dark:text-titanium-400 font-mono-num">
              {t('grandTotal')}:{' '}
              <span className="font-semibold text-titanium-900 dark:text-titanium-50">
                {formatMMK(filteredSales.reduce((s, x) => s + x.total, 0))}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('voucherNo')}</th>
                  <th className="px-4 py-3 font-medium">{t('date')}</th>
                  <th className="px-4 py-3 font-medium">{t('customerName')}</th>
                  <th className="px-4 py-3 font-medium">{t('paymentMethod')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('grandTotal')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('profit')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                    <td className="px-5 py-3 font-mono-num font-medium text-titanium-900 dark:text-titanium-50">
                      {sale.voucherNo}
                    </td>
                    <td className="px-4 py-3 font-mono-num text-titanium-600 dark:text-titanium-400">
                      {sale.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-titanium-900 dark:text-titanium-100">
                        {sale.customerName || t('walkInCustomer')}
                      </div>
                      <div className="text-xs text-titanium-500 dark:text-titanium-400">
                        {sale.items.length} {t('items')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase font-medium text-titanium-600 dark:text-titanium-300">
                      {sale.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                      {formatMMK(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                      +{formatMMK(sale.profit)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onOpenVoucher(sale)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline mr-3"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        {t('voucher')}
                      </button>
                      <button
                        onClick={() => deleteSale(sale.id)}
                        className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
      )}
    </div>
  );
};
