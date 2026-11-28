import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Minus,
  Package,
  Pencil,
  Plus,
  Receipt,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import type { PaymentMethod, Product, Sale, SaleItem } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK } from '../../lib/format';
import { sanitizeProductImageUrl } from '../../lib/imageUtils';
import { BarcodeScannerModal } from '../BarcodeScannerModal';

interface PosSalesViewProps {
  onOpenVoucher: (sale: Sale) => void;
}

export const PosSalesView: React.FC<PosSalesViewProps> = ({ onOpenVoucher }) => {
  const { products, sales, lang, createSale, updateSale, deleteSale, showToast } = usePos();
  const t = useT(lang);

  const [subTab, setSubTab] = useState<'counter' | 'history'>('counter');
  const [mobilePane, setMobilePane] = useState<'catalog' | 'cart'>('catalog');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [payMode, setPayMode] = useState<'full' | 'half' | 'partial'>('full');
  const [discount, setDiscount] = useState<string>('0');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [courierName, setCourierName] = useState('Shop Rider');
  const [deliveryFee, setDeliveryFee] = useState('2500');
  const [submitting, setSubmitting] = useState(false);

  const [historySearch, setHistorySearch] = useState('');

  // Edit Sale Modal State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editVoucherNo, setEditVoucherNo] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('cash');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editPaidAmount, setEditPaidAmount] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editAddProdId, setEditAddProdId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditVoucherNo(sale.voucherNo);
    setEditDate(sale.date);
    setEditCustomerName(sale.customerName);
    setEditCustomerPhone(sale.customerPhone);
    setEditPaymentMethod(sale.paymentMethod);
    setEditDiscount(String(sale.discount));
    setEditPaidAmount(String(sale.paidAmount));
    setEditNote(sale.note);
    setEditItems(sale.items.map((item) => ({ ...item })));
    setEditAddProdId(products[0]?.id || '');
  };

  const addEditSaleItem = () => {
    const prod = products.find((p) => p.id === editAddProdId);
    if (!prod) return;
    setEditItems((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id
            ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unit: prod.unit,
          qty: 1,
          costPrice: prod.costPrice,
          unitPrice: prod.sellPrice,
          lineTotal: prod.sellPrice,
        },
      ];
    });
  };

  const updateEditSaleItem = (idx: number, field: 'qty' | 'unitPrice', val: number) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const nextQty = field === 'qty' ? Math.max(1, val) : item.qty;
        const nextPrice = field === 'unitPrice' ? Math.max(0, val) : item.unitPrice;
        return { ...item, qty: nextQty, unitPrice: nextPrice, lineTotal: nextQty * nextPrice };
      })
    );
  };

  const removeEditSaleItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const editSubtotal = useMemo(
    () => editItems.reduce((sum, i) => sum + i.lineTotal, 0),
    [editItems]
  );
  const editDiscountNum = Math.min(editSubtotal, Math.max(0, Number(editDiscount) || 0));
  const editTotal = Math.max(0, editSubtotal - editDiscountNum);
  const editTotalCost = useMemo(
    () => editItems.reduce((sum, i) => sum + i.costPrice * i.qty, 0),
    [editItems]
  );
  const editProfit = editTotal - editTotalCost;

  const handleSaveEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || editItems.length === 0 || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateSale(editingSale.id, {
        voucherNo: editVoucherNo.trim() || editingSale.voucherNo,
        date: editDate || editingSale.date,
        customerName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim(),
        paymentMethod: editPaymentMethod,
        items: editItems,
        discount: editDiscountNum,
        paidAmount: Math.max(0, Number(editPaidAmount) || 0),
        note: editNote.trim(),
      });
      setEditingSale(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const productImageMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      const safe = sanitizeProductImageUrl(p.imageUrl);
      if (safe) map.set(p.id, safe);
    });
    return map;
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

  const handleScannedProduct = (product: Product) => {
    addToCart(product);
    showToast(`${product.name} — ${t('barcodeAdded')}`, 'success');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exactSkuMatch = products.find((p) => p.sku.trim().toLowerCase() === q);
    const target = exactSkuMatch || (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (target) {
      e.preventDefault();
      handleScannedProduct(target);
      setSearch('');
    }
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
  const halfTotal = Math.round(grandTotal / 2);
  const effectivePaid =
    payMode === 'full'
      ? paymentMethod === 'credit'
        ? 0
        : grandTotal
      : payMode === 'half'
      ? halfTotal
      : paidAmount === ''
      ? paymentMethod === 'credit'
        ? 0
        : grandTotal
      : Math.max(0, Number(paidAmount) || 0);
  const diff = effectivePaid - grandTotal;

  const selectPayMode = (mode: 'full' | 'half' | 'partial') => {
    setPayMode(mode);
    if (mode === 'full') {
      if (paymentMethod === 'credit') setPaymentMethod('cash');
      setPaidAmount('');
    } else if (mode === 'half') {
      if (paymentMethod === 'credit') setPaymentMethod('cash');
      setPaidAmount(grandTotal > 0 ? String(halfTotal) : '');
    } else {
      if (paidAmount === '') {
        setPaidAmount(paymentMethod === 'credit' ? '0' : '');
      }
    }
  };

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
      setPayMode('full');
      if (paymentMethod === 'credit') setPaymentMethod('cash');
      setPaidAmount('');
      setNote('');
      setIncludeDelivery(false);
      setDeliveryAddress('');
      setMobilePane('catalog');
      onOpenVoucher(created);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCartQty = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const openMobileCart = () => {
    setMobilePane('cart');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Ignore scroll error
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
      {/* Sub-navigation Segmented Control + Mobile Catalog/Cart Quick Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        {subTab === 'counter' && (
          <div className="lg:hidden inline-flex items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
            <button
              type="button"
              onClick={() => setMobilePane('catalog')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mobilePane === 'catalog'
                  ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                  : 'text-titanium-600 dark:text-titanium-400'
              }`}
            >
              {lang === 'my' ? 'ပစ္စည်းရွေး' : 'Items'}
            </button>
            <button
              type="button"
              onClick={openMobileCart}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mobilePane === 'cart'
                  ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white shadow-xs'
                  : cart.length > 0
                  ? 'text-burgundy-800 dark:text-burgundy-300'
                  : 'text-titanium-600 dark:text-titanium-400'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {lang === 'my' ? 'ဘောင်ချာ' : 'Cart'} ({totalCartQty})
            </button>
          </div>
        )}
      </div>

      {subTab === 'counter' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Product Catalog Selector */}
            <div
              className={`lg:col-span-7 space-y-4 ${
                mobilePane === 'cart' ? 'hidden lg:block' : 'block'
              } ${cart.length > 0 ? 'pb-24 lg:pb-0' : ''}`}
            >
            <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t('searchPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
                  title={t('scanBarcode')}
                >
                  <ScanBarcode className="w-4 h-4" />
                  <span>{t('scanBarcode')}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white shadow-xs'
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
                const safeImg = sanitizeProductImageUrl(product.imageUrl);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className={`text-left bg-white dark:bg-titanium-900 border rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all hover:border-burgundy-600 dark:hover:border-burgundy-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 ${
                      inCartQty > 0
                        ? 'border-burgundy-600 dark:border-burgundy-500 ring-2 ring-burgundy-600/20 bg-burgundy-50/35 dark:bg-burgundy-950/30'
                        : 'border-titanium-200/90 dark:border-titanium-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-12 h-12 rounded-lg border border-titanium-200/90 dark:border-titanium-700 bg-titanium-50 dark:bg-titanium-950 overflow-hidden flex items-center justify-center shrink-0">
                        {safeImg ? (
                          <img
                            src={safeImg}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-titanium-300 dark:text-titanium-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400 truncate">
                            {product.sku} · {product.category}
                          </span>
                          {inCartQty > 0 && (
                            <span className="text-xs font-mono-num font-bold text-burgundy-700 dark:text-burgundy-300 shrink-0">
                              ×{inCartQty}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-titanium-900 dark:text-titanium-50 line-clamp-2 min-h-[2.4rem]">
                          {product.name}
                        </div>
                      </div>
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

            {/* Right: Live POS Cart & Checkout (Sticky on Desktop with Deep Blue Header & Pinned Footer) */}
            <div
              className={`lg:col-span-5 bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl shadow-sm overflow-hidden flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] ${
                mobilePane === 'catalog' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Cart Header (Deep Royal Blue Bar) */}
              <div className="flex items-center justify-between bg-gradient-to-r from-burgundy-800 to-burgundy-900 dark:from-burgundy-900 dark:to-titanium-900 text-white px-5 py-3.5 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobilePane('catalog')}
                    className="lg:hidden inline-flex items-center gap-1 px-2 py-1 -ml-1 text-xs font-medium text-white bg-white/15 hover:bg-white/25 rounded-md"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {lang === 'my' ? 'ပစ္စည်းထပ်ရွေး' : 'Items'}
                  </button>
                  <ShoppingCart className="w-4 h-4 text-burgundy-200 hidden lg:block" />
                  <h3 className="text-sm font-semibold text-white">
                    {t('cart')} ({totalCartQty})
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-burgundy-100 hover:text-red-200 transition-colors"
                  >
                    {t('clearCart')}
                  </button>
                )}
              </div>

              {/* Scrollable Middle: Cart Items + Customer + Payment + Options */}
              <div className="lg:flex-1 lg:overflow-y-auto px-5 space-y-4 py-3.5">
                {cart.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-titanium-500 dark:text-titanium-400">
                      {t('emptyCart')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobilePane('catalog')}
                      className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 dark:bg-burgundy-600 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {lang === 'my' ? 'ပစ္စည်းသွားရွေးမည်' : 'Browse Products'}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-titanium-100 dark:divide-titanium-800 max-h-56 lg:max-h-60 overflow-y-auto pr-1">
                    {cart.map((item) => {
                      const thumb = productImageMap.get(item.productId);
                      return (
                      <div
                        key={item.productId}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        {thumb && (
                          <img
                            src={thumb}
                            alt={item.name}
                            className="w-8 h-8 rounded-md object-cover border border-titanium-200 dark:border-titanium-700 shrink-0"
                          />
                        )}
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
                      );
                    })}
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
                          const prevWasCredit = paymentMethod === 'credit';
                          setPaymentMethod(pm);
                          if (pm === 'credit') {
                            setPayMode('partial');
                            setPaidAmount('0');
                          } else if (prevWasCredit) {
                            setPayMode('full');
                            setPaidAmount('');
                          }
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

                {/* Payment Settlement Option: Pay Full / Half (50%) / Partial */}
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1.5">
                    {t('paymentOption')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectPayMode('full')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        payMode === 'full' && paymentMethod !== 'credit'
                          ? 'border-emerald-700 dark:border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('payFull')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPayMode('half')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        payMode === 'half'
                          ? 'border-burgundy-700 dark:border-burgundy-600 bg-burgundy-700 dark:bg-burgundy-600 text-white shadow-xs'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('payHalf')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPayMode('partial')}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        payMode === 'partial'
                          ? 'border-amber-600 dark:border-amber-500 bg-amber-600 text-white shadow-xs'
                          : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                      }`}
                    >
                      {t('payPartial')}
                    </button>
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
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label className="block text-xs text-titanium-500 dark:text-titanium-400 truncate">
                        {t('paidAmount')}
                      </label>
                      {payMode !== 'full' && grandTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => selectPayMode('full')}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                        >
                          {t('payFull')}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={
                        payMode === 'half'
                          ? grandTotal > 0
                            ? String(halfTotal)
                            : ''
                          : paidAmount
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setPaidAmount(val);
                        if (val === '') {
                          setPayMode(paymentMethod === 'credit' ? 'partial' : 'full');
                        } else {
                          const num = Math.max(0, Number(val) || 0);
                          if (grandTotal > 0 && num === grandTotal && paymentMethod !== 'credit') {
                            setPayMode('full');
                          } else {
                            setPayMode('partial');
                          }
                        }
                      }}
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
              </div>

              {/* Pinned Bottom Summary & Checkout Voucher Button (Always Visible) */}
              <div className="border-t border-titanium-200 dark:border-titanium-800 px-5 pt-3.5 pb-4 space-y-3 shrink-0 bg-burgundy-50/35 dark:bg-titanium-950/40">
                <div className="space-y-1 text-sm">
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
                  {cart.length > 0 && effectivePaid < grandTotal && (
                    <div className="flex justify-between text-xs">
                      <span className="text-titanium-500 dark:text-titanium-400">
                        {t('paidAmount')}
                      </span>
                      <span className="font-mono-num font-semibold text-burgundy-700 dark:text-burgundy-300">
                        {formatMMK(effectivePaid)}
                      </span>
                    </div>
                  )}
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
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg shadow-xs transition-colors"
                >
                  {submitting ? '...' : t('completeSale')}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Sticky Bottom Checkout Dock (No scrolling down required after picking items) */}
          {cart.length > 0 && mobilePane === 'catalog' && (
            <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/95 dark:bg-titanium-900/95 backdrop-blur-md border border-burgundy-200 dark:border-burgundy-700/60 rounded-xl shadow-lg px-3.5 py-2.5 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={openMobileCart}
                className="min-w-0 text-left flex-1"
              >
                <div className="text-[11px] text-titanium-500 dark:text-titanium-400 truncate">
                  {totalCartQty} {t('items')} · {t('cart')}
                </div>
                <div className="text-sm font-bold font-mono-num text-burgundy-800 dark:text-burgundy-300 truncate">
                  {formatMMK(grandTotal)}
                </div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={openMobileCart}
                  className="px-3 py-2 text-xs font-semibold text-burgundy-800 dark:text-burgundy-200 bg-burgundy-50 dark:bg-burgundy-950/80 border border-burgundy-200 dark:border-burgundy-800 rounded-lg whitespace-nowrap"
                >
                  {lang === 'my' ? 'ခြင်းကြည့်' : 'Review'}
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {submitting
                    ? '...'
                    : lang === 'my'
                    ? 'ဘောင်ချာထုတ်'
                    : 'Voucher'}
                </button>
              </div>
            </div>
          )}
        </>
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
                        onClick={() => openEditSale(sale)}
                        className="inline-flex items-center text-titanium-400 hover:text-burgundy-700 dark:hover:text-burgundy-300 transition-colors mr-2.5"
                        aria-label={t('edit')}
                        title={t('edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
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

      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEditSale}
            className="w-full max-w-2xl bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {t('edit')} {t('salesHistory')} · {editingSale.voucherNo}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('voucherNo')}</label>
                  <input
                    required
                    value={editVoucherNo}
                    onChange={(e) => setEditVoucherNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('date')}</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('customerName')}</label>
                  <input
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder={t('walkInCustomer')}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('customerPhone')}</label>
                  <input
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              {/* Editable Line Items */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-titanium-700 dark:text-titanium-300">
                    {t('items')} ({editItems.length})
                  </label>
                  {products.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={editAddProdId}
                        onChange={(e) => setEditAddProdId(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600 max-w-[200px]"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatMMK(p.sellPrice)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addEditSaleItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('addItem')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="border border-titanium-200 dark:border-titanium-800 rounded-lg divide-y divide-titanium-100 dark:divide-titanium-800">
                  {editItems.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="p-2.5 flex flex-wrap items-center gap-2 justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-titanium-900 dark:text-titanium-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono-num text-titanium-500 dark:text-titanium-400">
                          {item.sku} · {item.unit}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => updateEditSaleItem(idx, 'qty', Number(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-xs font-mono-num text-right bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-md"
                          aria-label={t('qtyCol')}
                        />
                        <span className="text-xs text-titanium-400">×</span>
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => updateEditSaleItem(idx, 'unitPrice', Number(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-xs font-mono-num text-right bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-md"
                          aria-label={t('sellPrice')}
                        />
                        <span className="w-24 text-right text-xs font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                          {formatMMK(item.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEditSaleItem(idx)}
                          disabled={editItems.length <= 1}
                          className="text-titanium-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30"
                          aria-label={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('paymentMethod')}</label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  >
                    <option value="cash">{t('cash')}</option>
                    <option value="kbzpay">{t('kbzpay')}</option>
                    <option value="wavepay">{t('wavepay')}</option>
                    <option value="credit">{t('credit')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('discount')}</label>
                  <input
                    type="number"
                    min={0}
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs text-titanium-500 dark:text-titanium-400">{t('paidAmount')}</label>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditPaidAmount(String(Math.round(editTotal / 2)))}
                        className="text-[11px] font-semibold text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editPaymentMethod === 'credit') setEditPaymentMethod('cash');
                          setEditPaidAmount(String(editTotal));
                        }}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        {t('payFull')}
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('note')}</label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>

              <div className="p-3 rounded-lg bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-titanium-500 dark:text-titanium-400">{t('subtotal')}: </span>
                  <span className="font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                    {formatMMK(editSubtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-titanium-500 dark:text-titanium-400">{t('grandTotal')}: </span>
                  <span className="font-mono-num font-bold text-burgundy-800 dark:text-burgundy-300">
                    {formatMMK(editTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-titanium-500 dark:text-titanium-400">{t('profit')}: </span>
                  <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                    {editProfit >= 0 ? '+' : ''}{formatMMK(editProfit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={editItems.length === 0 || savingEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg"
              >
                {savingEdit ? '...' : t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        products={products}
        lang={lang}
        onClose={() => setScannerOpen(false)}
        onAddProduct={handleScannedProduct}
      />
    </div>
  );
};
