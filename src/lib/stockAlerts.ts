import type { Product } from '../types/pos';

const STORAGE_PREFIX = 'shwepos_stock_threshold_';

export function loadStockThreshold(shopId: string): number | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${shopId}`);
    if (raw === null || raw === '') return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  } catch {
    return null;
  }
}

export function saveStockThreshold(shopId: string, threshold: number | null): void {
  try {
    const key = `${STORAGE_PREFIX}${shopId}`;
    if (threshold === null || !Number.isFinite(threshold) || threshold < 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(Math.floor(threshold)));
  } catch {
    // Ignore storage quota errors
  }
}

export function getEffectiveStockThreshold(
  product: Product,
  customThreshold: number | null
): number {
  return customThreshold !== null ? customThreshold : product.minStock;
}

export function isProductLowStock(
  product: Product,
  customThreshold: number | null
): boolean {
  return product.stock <= getEffectiveStockThreshold(product, customThreshold);
}

export function getLowStockProducts(
  products: Product[],
  customThreshold: number | null
): Product[] {
  return products
    .filter((p) => isProductLowStock(p, customThreshold))
    .sort((a, b) => {
      // Out of stock items first, then smallest buffer above/below threshold
      if (a.stock <= 0 && b.stock > 0) return -1;
      if (b.stock <= 0 && a.stock > 0) return 1;
      const diffA = a.stock - getEffectiveStockThreshold(a, customThreshold);
      const diffB = b.stock - getEffectiveStockThreshold(b, customThreshold);
      if (diffA !== diffB) return diffA - diffB;
      return a.stock - b.stock;
    });
}
