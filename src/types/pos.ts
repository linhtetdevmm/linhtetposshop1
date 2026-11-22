export type Language = 'my' | 'en';

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'purchases'
  | 'stock'
  | 'debts'
  | 'expenses'
  | 'delivery'
  | 'reports'
  | 'settings'
  | 'admin';

export type AccessGateStatus =
  | 'loading'
  | 'unauthenticated'
  | 'needs_pass'
  | 'expired'
  | 'revoked'
  | 'device_limit'
  | 'granted';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  provider: 'supabase' | 'firebase';
}

export interface AccessPass {
  code: string;
  label: string;
  note: string;
  status: 'active' | 'revoked';
  durationDays: number;
  expiresAtMs: number;
  subscriptionExpiryMs?: number;
  maxDevices: number;
  boundDevices: string[];
  assignedUid: string;
  assignedEmail: string;
  createdBy: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface UserLicense {
  userId: string;
  email: string;
  displayName: string;
  passCode: string;
  label: string;
  status: 'active' | 'revoked';
  expiresAtMs: number;
  subscriptionExpiryMs?: number;
  maxDevices: number;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export type PaymentMethod = 'cash' | 'kbzpay' | 'wavepay' | 'credit';

export interface ShopSettings {
  ownerId: string;
  shopName: string;
  shopSubtitle: string;
  phone: string;
  address: string;
  receiptFooter: string;
  currency: 'MMK';
  defaultMarginPercent: number;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  ownerId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  marginPercent: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  costPrice: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  ownerId: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
  profit: number;
  paidAmount: number;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseItem {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  costPrice: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  ownerId: string;
  refNo: string;
  date: string; // YYYY-MM-DD
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  status: 'paid' | 'credit';
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockLog {
  id: string;
  ownerId: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjust';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  date: string; // YYYY-MM-DD
  createdAt?: unknown;
}

export interface Debt {
  id: string;
  ownerId: string;
  type: 'receivable' | 'payable';
  partyName: string;
  phone: string;
  referenceNo: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'partial' | 'settled';
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Expense {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  category: string;
  title: string;
  amount: number;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DeliveryStatus = 'pending' | 'dispatched' | 'delivered' | 'cancelled';

export interface Delivery {
  id: string;
  ownerId: string;
  voucherNo: string;
  date: string; // YYYY-MM-DD
  customerName: string;
  phone: string;
  address: string;
  courierName: string;
  deliveryFee: number;
  codAmount: number;
  status: DeliveryStatus;
  note: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PosBackupPayload {
  version: string;
  exportedAt: string;
  shop: Omit<ShopSettings, 'ownerId' | 'createdAt' | 'updatedAt'>;
  products: Omit<Product, 'ownerId' | 'createdAt' | 'updatedAt'>[];
  sales: Omit<Sale, 'ownerId' | 'createdAt' | 'updatedAt'>[];
  purchases: Omit<Purchase, 'ownerId' | 'createdAt' | 'updatedAt'>[];
  stockLogs: Omit<StockLog, 'ownerId' | 'createdAt'>[];
  debts: Omit<Debt, 'ownerId' | 'createdAt' | 'updatedAt'>[];
  expenses: Omit<Expense, 'ownerId' | 'createdAt' | 'updatedAt'>[];
  deliveries: Omit<Delivery, 'ownerId' | 'createdAt' | 'updatedAt'>[];
}

// Defensive payload truncation & sanitization matching firebase-blueprint.json verbatim
export function clampString(val: unknown, maxLength: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.slice(0, maxLength);
}

export function clampNumber(val: unknown, min = 0, max = 1000000000): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeId(val: string): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function sanitizeDate(val: string): string {
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(val)) return val;
  return new Date().toISOString().slice(0, 10);
}
