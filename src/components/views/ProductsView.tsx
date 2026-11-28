import React, { useMemo, useState } from 'react';
import { Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Product } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import {
  calculateMarginPercent,
  calculateSellPrice,
  formatMMK,
} from '../../lib/format';
import { sanitizeProductImageUrl } from '../../lib/imageUtils';
import { ProductImagePicker } from '../ProductImagePicker';

export const ProductsView: React.FC = () => {
  const { products, shop, lang, saveProduct, deleteProduct } = usePos();
  const t = useT(lang);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState<string>('0');
  const [marginPercent, setMarginPercent] = useState<string>(
    String(shop.defaultMarginPercent || 25)
  );
  const [sellPrice, setSellPrice] = useState<string>('0');
  const [stock, setStock] = useState<string>('10');
  const [minStock, setMinStock] = useState<string>('5');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [previewProd, setPreviewProd] = useState<Product | null>(null);

  const openAdd = () => {
    setEditingId(undefined);
    setSku(`SKU-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setCategory('');
    setUnit('pcs');
    setCostPrice('10000');
    const defMargin = shop.defaultMarginPercent || 25;
    setMarginPercent(String(defMargin));
    setSellPrice(String(calculateSellPrice(10000, defMargin)));
    setStock('10');
    setMinStock('5');
    setImageUrl('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setSku(p.sku);
    setName(p.name);
    setCategory(p.category);
    setUnit(p.unit);
    setCostPrice(String(p.costPrice));
    setMarginPercent(String(p.marginPercent));
    setSellPrice(String(p.sellPrice));
    setStock(String(p.stock));
    setMinStock(String(p.minStock));
    setImageUrl(p.imageUrl || '');
    setModalOpen(true);
  };

  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const c = Number(val) || 0;
    const m = Number(marginPercent) || 0;
    setSellPrice(String(calculateSellPrice(c, m)));
  };

  const handleMarginChange = (val: string) => {
    setMarginPercent(val);
    const c = Number(costPrice) || 0;
    const m = Number(val) || 0;
    setSellPrice(String(calculateSellPrice(c, m)));
  };

  const handleSellPriceChange = (val: string) => {
    setSellPrice(val);
    const c = Number(costPrice) || 0;
    const s = Number(val) || 0;
    setMarginPercent(String(calculateMarginPercent(c, s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveProduct(
      {
        sku: sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        category: category.trim() || 'General',
        unit: unit.trim() || 'pcs',
        costPrice: Number(costPrice) || 0,
        marginPercent: Number(marginPercent) || 0,
        sellPrice: Number(sellPrice) || 0,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        imageUrl: sanitizeProductImageUrl(imageUrl),
      },
      editingId
    );
    setModalOpen(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const previewProfit = (Number(sellPrice) || 0) - (Number(costPrice) || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-lg focus:outline-none focus:border-burgundy-600"
          />
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('addProduct')}
        </button>
      </div>

      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('sku')}</th>
                <th className="px-4 py-3 font-medium">{t('productName')}</th>
                <th className="px-4 py-3 font-medium">{t('category')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('costPrice')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('marginPercent')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('sellPrice')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('stock')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {filtered.map((p) => {
                const profitUnit = p.sellPrice - p.costPrice;
                const low = p.stock <= p.minStock;
                const safeImg = sanitizeProductImageUrl(p.imageUrl);
                return (
                  <tr key={p.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                    <td className="px-5 py-3 font-mono-num text-xs text-titanium-500 dark:text-titanium-400 whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-titanium-900 dark:text-titanium-50">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => safeImg && setPreviewProd(p)}
                          disabled={!safeImg}
                          className={`w-10 h-10 rounded-lg border border-titanium-200 dark:border-titanium-700 bg-titanium-50 dark:bg-titanium-950 overflow-hidden flex items-center justify-center shrink-0 ${
                            safeImg ? 'cursor-zoom-in hover:border-burgundy-600' : 'cursor-default'
                          }`}
                        >
                          {safeImg ? (
                            <img src={safeImg} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-titanium-300 dark:text-titanium-600" />
                          )}
                        </button>
                        <span className="min-w-0">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-titanium-600 dark:text-titanium-400">
                      {p.category} · {p.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-titanium-700 dark:text-titanium-300 whitespace-nowrap">
                      {formatMMK(p.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-burgundy-700 dark:text-burgundy-300 whitespace-nowrap">
                      +{p.marginPercent}%
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                        {formatMMK(p.sellPrice)}
                      </div>
                      <div className="text-[11px] font-mono-num text-emerald-700 dark:text-emerald-400">
                        +{formatMMK(profitUnit)}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono-num font-semibold whitespace-nowrap ${
                        p.stock <= 0
                          ? 'text-red-700 dark:text-red-400'
                          : low
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-titanium-800 dark:text-titanium-200'
                      }`}
                    >
                      {p.stock}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300 mr-3"
                        aria-label={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                        aria-label={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal with Cost + Margin % Auto-Calculator */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {editingId ? t('editProduct') : t('addProduct')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <ProductImagePicker value={imageUrl} onChange={setImageUrl} lang={lang} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('sku')}</label>
                  <input
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('productName')}</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('category')}</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Groceries"
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg placeholder:text-titanium-400/75 dark:placeholder:text-titanium-500 focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('unit')}</label>
                  <input
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>

              {/* MMK Cost + Profit Margin % Bidirectional Calculator */}
              <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-3.5 space-y-3">
                <p className="text-xs text-titanium-500 dark:text-titanium-400">
                  {t('pricingHelper')}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-titanium-700 dark:text-titanium-300 mb-1">
                      {t('costPrice')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={costPrice}
                      onChange={(e) => handleCostChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-burgundy-700 dark:text-burgundy-300 mb-1">
                      {t('marginPercent')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      min={0}
                      required
                      value={marginPercent}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-white dark:bg-titanium-900 border border-burgundy-600/60 dark:border-burgundy-500/60 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-titanium-700 dark:text-titanium-300 mb-1">
                      {t('sellPrice')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={sellPrice}
                      onChange={(e) => handleSellPriceChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num font-semibold bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-titanium-500 dark:text-titanium-400">{t('profitPerUnit')}:</span>
                  <span
                    className={`font-mono-num font-semibold ${
                      previewProfit >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {previewProfit >= 0 ? '+' : ''}
                    {formatMMK(previewProfit)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('stock')}</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('minStock')}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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

      {previewProd && sanitizeProductImageUrl(previewProd.imageUrl) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/75 p-4"
          onClick={() => setPreviewProd(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-titanium-200 dark:border-titanium-800">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                  {previewProd.name}
                </div>
                <div className="text-xs font-mono-num text-titanium-500 dark:text-titanium-400">
                  {previewProd.sku} · {formatMMK(previewProd.sellPrice)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProd(null)}
                className="p-1 text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-titanium-50 dark:bg-titanium-950 flex items-center justify-center">
              <img
                src={sanitizeProductImageUrl(previewProd.imageUrl)}
                alt={previewProd.name}
                className="max-h-80 w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
