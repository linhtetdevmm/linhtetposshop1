import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from '../lib/firebase';
import {
  clampNumber,
  clampString,
  sanitizeDate,
  sanitizeId,
  type AccessGateStatus,
  type AccessPass,
  type Debt,
  type Delivery,
  type DeliveryStatus,
  type Expense,
  type Language,
  type PaymentMethod,
  type PosBackupPayload,
  type Product,
  type Purchase,
  type PurchaseItem,
  type Sale,
  type SaleItem,
  type ShopSettings,
  type StockLog,
  type UserLicense,
} from '../types/pos';
import { createSeedDataset } from '../data/seedData';
import { generateDocId, generateVoucherNo, getTodayISO } from '../lib/format';
import {
  getOrCreateDeviceId,
  isPrimaryAdminEmail,
  normalizePassCode,
  timestampToMs,
} from '../lib/accessControl';
import {
  checkClientSupabaseHealth,
  isClientSupabaseConfigured,
  pullPosDataDirectFromSupabase,
  pushPosDataDirectToSupabase,
} from '../lib/supabaseSync';

const LOCAL_STORAGE_KEY = 'shwepos_local_state_v1';

interface IntegrationStatus {
  telegramConfigured: boolean;
  supabaseConfigured: boolean;
  supabaseMode: 'server' | 'client' | 'none';
}

export type CloudHealthStatus = 'checking' | 'syncing' | 'healthy' | 'degraded' | 'error';

export interface CloudHealthInfo {
  status: CloudHealthStatus;
  online: boolean;
  supabaseReachable: boolean | null;
  supabaseError: string | null;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface PosContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  isAdmin: boolean;
  accessStatus: AccessGateStatus;
  activeLicense: UserLicense | null;
  activePass: AccessPass | null;
  activeShopId: string;
  adminTargetShopId: string | null;
  adminTargetShopLabel: string;
  adminSelectShop: (shopId: string | null, label?: string) => void;
  redeemAccessPass: (code: string) => Promise<{ ok: boolean; error?: string }>;
  isCloudMode: boolean;
  loadingData: boolean;
  lang: Language;
  setLang: (lang: Language) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  integrations: IntegrationStatus;
  cloudHealth: CloudHealthInfo;
  refreshCloudHealth: (force?: boolean) => Promise<void>;
  toast: ToastMessage | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;

  // Core POS Data
  shop: ShopSettings;
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  stockLogs: StockLog[];
  debts: Debt[];
  expenses: Expense[];
  deliveries: Delivery[];

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  seedCloudWithSampleData: () => Promise<void>;

  // CRUD Operations
  updateShopSettings: (
    updates: Partial<Omit<ShopSettings, 'ownerId' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;

  saveProduct: (
    product: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  createSale: (payload: {
    customerName: string;
    customerPhone: string;
    paymentMethod: PaymentMethod;
    items: SaleItem[];
    discount: number;
    paidAmount: number;
    note: string;
    createDelivery?: {
      address: string;
      courierName: string;
      deliveryFee: number;
    };
  }) => Promise<Sale>;
  deleteSale: (id: string) => Promise<void>;

  createPurchase: (payload: {
    supplierName: string;
    date: string;
    items: PurchaseItem[];
    paidAmount: number;
    status: 'paid' | 'credit';
    note: string;
  }) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;

  adjustProductStock: (payload: {
    productId: string;
    type: 'in' | 'out' | 'adjust';
    quantity: number;
    reason: string;
  }) => Promise<void>;

  createDebt: (
    payload: Omit<Debt, 'id' | 'ownerId' | 'remainingAmount' | 'status' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  recordDebtPayment: (debtId: string, payAmount: number) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;

  saveExpense: (
    payload: Omit<Expense, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  createDelivery: (
    payload: Omit<Delivery, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateDeliveryStatus: (deliveryId: string, status: DeliveryStatus) => Promise<void>;
  deleteDelivery: (id: string) => Promise<void>;

  // Backup, Restore, Telegram, Supabase
  exportBackupJson: () => void;
  restoreBackupJson: (backup: PosBackupPayload) => Promise<void>;
  sendTelegramMessage: (message: string) => Promise<boolean>;
  pushToSupabase: () => Promise<boolean>;
  pullFromSupabase: () => Promise<boolean>;
}

const PosContext = createContext<PosContextValue | null>(null);

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.shop && Array.isArray(parsed.products)) {
        return parsed as ReturnType<typeof createSeedDataset>;
      }
    }
  } catch {
    // Fallback to seed data
  }
  return createSeedDataset('local_demo');
}

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('shwepos_lang');
    return saved === 'en' ? 'en' : 'my';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('shwepos_theme') === 'dark';
  });
  const [integrations, setIntegrations] = useState<IntegrationStatus>(() => {
    const clientSupa = isClientSupabaseConfigured();
    return {
      telegramConfigured: false,
      supabaseConfigured: clientSupa,
      supabaseMode: clientSupa ? 'client' : 'none',
    };
  });
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [healthChecking, setHealthChecking] = useState<boolean>(true);
  const [syncingSupabase, setSyncingSupabase] = useState<boolean>(false);
  const [supabaseReachable, setSupabaseReachable] = useState<boolean | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const initialLocal = useMemo(() => loadLocalData(), []);
  const [shop, setShop] = useState<ShopSettings>(initialLocal.shop);
  const [products, setProducts] = useState<Product[]>(initialLocal.products);
  const [sales, setSales] = useState<Sale[]>(initialLocal.sales);
  const [purchases, setPurchases] = useState<Purchase[]>(initialLocal.purchases);
  const [stockLogs, setStockLogs] = useState<StockLog[]>(initialLocal.stockLogs);
  const [debts, setDebts] = useState<Debt[]>(initialLocal.debts);
  const [expenses, setExpenses] = useState<Expense[]>(initialLocal.expenses);
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialLocal.deliveries);

  const [signingIn, setSigningIn] = useState(false);
  const signingInRef = useRef(false);
  const shopDocReadyRef = useRef<string | null>(null);
  const [isSecondaryAdmin, setIsSecondaryAdmin] = useState(false);
  const [licenseReady, setLicenseReady] = useState(false);
  const [activeLicense, setActiveLicense] = useState<UserLicense | null>(null);
  const [activePass, setActivePass] = useState<AccessPass | null>(null);
  const [clockTick, setClockTick] = useState<number>(() => Date.now());
  const [adminTargetShopId, setAdminTargetShopId] = useState<string | null>(null);
  const [adminTargetShopLabel, setAdminTargetShopLabel] = useState<string>('');
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const isAdmin = Boolean(user && (isPrimaryAdminEmail(user.email) || isSecondaryAdmin));
  const activeShopId = isAdmin && adminTargetShopId ? adminTargetShopId : user?.uid || 'local_demo';
  const isCloudMode = Boolean(authReady && user);

  const adminSelectShop = useCallback(
    (shopId: string | null, label = '') => {
      if (!isAdmin) return;
      shopDocReadyRef.current = null;
      setAdminTargetShopId(shopId);
      setAdminTargetShopLabel(label);
    },
    [isAdmin]
  );

  // Periodic 30-second clock tick so expired passes lock automatically while app stays open
  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = Date.now();
      setToast({ id, type, text });
      window.setTimeout(() => {
        setToast((prev) => (prev && prev.id === id ? null : prev));
      }, 3600);
    },
    []
  );

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    localStorage.setItem('shwepos_lang', next);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('shwepos_theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Live backend & Supabase health probe (Server Proxy + Static Web Client Direct fallback)
  const refreshCloudHealth = useCallback(async (force = false) => {
    const clientSupa = isClientSupabaseConfigured();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOnline(false);
      setHealthChecking(false);
      setLastCheckedAt(new Date().toISOString());
      return;
    }

    setHealthChecking(true);
    try {
      const url = force ? '/api/integrations/status?force=1' : '/api/integrations/status';
      const r = await fetch(url);
      const contentType = r.headers.get('content-type') || '';
      if (r.ok && contentType.includes('application/json')) {
        const data = (await r.json()) as {
          telegramConfigured?: boolean;
          supabaseConfigured?: boolean;
          supabaseReachable?: boolean | null;
          supabaseError?: string | null;
          checkedAt?: string;
        };
        const serverSupa = Boolean(data.supabaseConfigured);
        if (serverSupa) {
          setIntegrations({
            telegramConfigured: Boolean(data.telegramConfigured),
            supabaseConfigured: true,
            supabaseMode: 'server',
          });
          setSupabaseReachable(
            typeof data.supabaseReachable === 'boolean' ? data.supabaseReachable : true
          );
          setSupabaseError(data.supabaseError || null);
          setLastCheckedAt(data.checkedAt || new Date().toISOString());
          return;
        }
        // Server responded, but Supabase env is not set on server -> check static Web client keys
        if (clientSupa) {
          const probe = await checkClientSupabaseHealth();
          setIntegrations({
            telegramConfigured: Boolean(data.telegramConfigured),
            supabaseConfigured: true,
            supabaseMode: 'client',
          });
          setSupabaseReachable(probe.reachable);
          setSupabaseError(probe.error);
          setLastCheckedAt(new Date().toISOString());
          return;
        }
        setIntegrations({
          telegramConfigured: Boolean(data.telegramConfigured),
          supabaseConfigured: false,
          supabaseMode: 'none',
        });
        setSupabaseReachable(null);
        setSupabaseError(null);
        setLastCheckedAt(data.checkedAt || new Date().toISOString());
        return;
      }

      // Static Web host (no Express /api route)
      if (clientSupa) {
        const probe = await checkClientSupabaseHealth();
        setIntegrations((prev) => ({
          ...prev,
          supabaseConfigured: true,
          supabaseMode: 'client',
        }));
        setSupabaseReachable(probe.reachable);
        setSupabaseError(probe.error);
      } else {
        setIntegrations((prev) => ({
          ...prev,
          supabaseConfigured: false,
          supabaseMode: 'none',
        }));
        setSupabaseReachable(null);
        setSupabaseError(null);
      }
      setLastCheckedAt(new Date().toISOString());
    } catch {
      if (clientSupa) {
        const probe = await checkClientSupabaseHealth();
        setIntegrations((prev) => ({
          ...prev,
          supabaseConfigured: true,
          supabaseMode: 'client',
        }));
        setSupabaseReachable(probe.reachable);
        setSupabaseError(probe.error);
      }
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshCloudHealth(false);
    const handleOnline = () => {
      setOnline(true);
      void refreshCloudHealth(true);
    };
    const handleOffline = () => {
      setOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCloudHealth]);

  const cloudHealth: CloudHealthInfo = useMemo(() => {
    let status: CloudHealthStatus;
    if (!online) {
      status = 'error';
    } else if (syncingSupabase) {
      status = 'syncing';
    } else if (healthChecking) {
      status = 'checking';
    } else if (integrations.supabaseConfigured && supabaseReachable === false) {
      status = 'error';
    } else if (
      (integrations.supabaseConfigured && supabaseReachable === true) ||
      isCloudMode
    ) {
      status = 'healthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      online,
      supabaseReachable,
      supabaseError,
      lastCheckedAt,
      lastSyncedAt,
    };
  }, [
    online,
    syncingSupabase,
    healthChecking,
    integrations.supabaseConfigured,
    supabaseReachable,
    supabaseError,
    isCloudMode,
    lastCheckedAt,
    lastSyncedAt,
  ]);

  // Persist local demo state when not signed in
  useEffect(() => {
    if (!authReady || user) return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          shop,
          products,
          sales,
          purchases,
          stockLogs,
          debts,
          expenses,
          deliveries,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [authReady, user, shop, products, sales, purchases, stockLogs, debts, expenses, deliveries]);

  // Ensure root /shops/{uid} document exists before subcollection writes (Master Gate invariant)
  const ensureShopDoc = useCallback(async (uid: string, displayName?: string | null) => {
    if (shopDocReadyRef.current === uid) return;
    const shopPath = `shops/${uid}`;
    const ref = doc(db, 'shops', uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ownerId: uid,
          shopName: clampString(displayName ? `${displayName}'s Shop` : 'Shwe Yaung Retail', 120),
          shopSubtitle: 'POS & Inventory Management',
          phone: '',
          address: '',
          receiptFooter: 'ဝယ်ယူအားပေးမှုအတွက် အထူးကျေးဇူးတင်ပါသည်။',
          currency: 'MMK',
          defaultMarginPercent: 25,
          telegramEnabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      shopDocReadyRef.current = uid;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, shopPath);
    }
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        shopDocReadyRef.current = null;
        setIsSecondaryAdmin(false);
        setActiveLicense(null);
        setActivePass(null);
        setLicenseReady(true);
        setAdminTargetShopId(null);
        setAdminTargetShopLabel('');
        const local = loadLocalData();
        setShop(local.shop);
        setProducts(local.products);
        setSales(local.sales);
        setPurchases(local.purchases);
        setStockLogs(local.stockLogs);
        setDebts(local.debts);
        setExpenses(local.expenses);
        setDeliveries(local.deliveries);
      } else {
        setLicenseReady(false);
      }
    });
    return () => unsub();
  }, []);

  // Check optional secondary admin record (/admins/{uid}) for non-primary emails
  useEffect(() => {
    if (!authReady || !user) {
      setIsSecondaryAdmin(false);
      return;
    }
    if (isPrimaryAdminEmail(user.email)) {
      setIsSecondaryAdmin(true);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'admins', user.uid))
      .then((snap) => {
        if (!cancelled) setIsSecondaryAdmin(snap.exists());
      })
      .catch(() => {
        if (!cancelled) setIsSecondaryAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Real-time license & pass enforcement for regular Gmail users
  useEffect(() => {
    if (!authReady || !user) return;
    if (isAdmin) {
      setLicenseReady(true);
      return;
    }

    setLicenseReady(false);
    let passUnsub: (() => void) | null = null;

    const licenseUnsub = onSnapshot(
      doc(db, 'userLicenses', user.uid),
      (snap) => {
        if (passUnsub) {
          passUnsub();
          passUnsub = null;
        }
        if (!snap.exists()) {
          setActiveLicense(null);
          setActivePass(null);
          setLicenseReady(true);
          return;
        }
        const d = snap.data();
        const lic: UserLicense = {
          userId: String(d.userId || user.uid),
          email: String(d.email || user.email || ''),
          displayName: String(d.displayName || ''),
          passCode: String(d.passCode || ''),
          label: String(d.label || ''),
          status: d.status === 'revoked' ? 'revoked' : 'active',
          expiresAtMs: timestampToMs(d.expiresAt),
          maxDevices: Number(d.maxDevices || 1),
          createdAtMs: timestampToMs(d.createdAt),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
        setActiveLicense(lic);

        if (!lic.passCode) {
          setActivePass(null);
          setLicenseReady(true);
          return;
        }

        passUnsub = onSnapshot(
          doc(db, 'accessPasses', lic.passCode),
          (passSnap) => {
            if (!passSnap.exists()) {
              setActivePass(null);
            } else {
              const p = passSnap.data();
              setActivePass({
                code: String(p.code || lic.passCode),
                label: String(p.label || lic.label),
                note: String(p.note || ''),
                status: p.status === 'revoked' ? 'revoked' : 'active',
                durationDays: Number(p.durationDays || 30),
                expiresAtMs: timestampToMs(p.expiresAt),
                maxDevices: Number(p.maxDevices || 1),
                boundDevices: Array.isArray(p.boundDevices) ? p.boundDevices.map(String) : [],
                assignedUid: String(p.assignedUid || ''),
                assignedEmail: String(p.assignedEmail || ''),
                createdBy: String(p.createdBy || ''),
                createdAtMs: timestampToMs(p.createdAt),
                updatedAtMs: timestampToMs(p.updatedAt),
              });
            }
            setLicenseReady(true);
          },
          () => {
            setActivePass(null);
            setLicenseReady(true);
          }
        );
      },
      () => {
        setActiveLicense(null);
        setActivePass(null);
        setLicenseReady(true);
      }
    );

    return () => {
      licenseUnsub();
      if (passUnsub) passUnsub();
    };
  }, [authReady, user, isAdmin]);

  // Compute strict Access Gate status
  const accessStatus: AccessGateStatus = useMemo(() => {
    if (!authReady) return 'loading';
    if (!user) return 'unauthenticated';
    if (isAdmin) return 'granted';
    if (!licenseReady) return 'loading';
    if (!activeLicense || !activePass) return 'needs_pass';
    if (activeLicense.status === 'revoked' || activePass.status === 'revoked') return 'revoked';
    const effectiveExpiry = Math.min(activeLicense.expiresAtMs || 0, activePass.expiresAtMs || 0);
    if (!effectiveExpiry || effectiveExpiry <= clockTick) return 'expired';
    if (activePass.assignedUid && activePass.assignedUid !== user.uid) return 'revoked';
    if (
      activePass.boundDevices.length >= activePass.maxDevices &&
      !activePass.boundDevices.includes(deviceId)
    ) {
      return 'device_limit';
    }
    return 'granted';
  }, [authReady, user, isAdmin, licenseReady, activeLicense, activePass, clockTick, deviceId]);

  // Atomic Pass Redemption (verifies live Firestore server doc, binds Gmail + deviceId)
  const redeemAccessPass = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; error?: string }> => {
      if (!user) {
        return {
          ok: false,
          error: lang === 'my' ? 'Google Account ဖြင့် အရင်ဝင်ပေးပါ။' : 'Please sign in with Google first.',
        };
      }
      const code = normalizePassCode(rawCode);
      if (code.length < 6) {
        return {
          ok: false,
          error: lang === 'my' ? 'Access Pass ပုံစံ မမှန်ကန်ပါ။' : 'Invalid Access Pass format.',
        };
      }

      try {
        const passRef = doc(db, 'accessPasses', code);
        const snap = await getDocFromServer(passRef);
        if (!snap.exists()) {
          return {
            ok: false,
            error:
              lang === 'my'
                ? 'ဤ Access Pass မရှိပါ။ Admin ထံမှ မှန်ကန်သော Pass ကို စစ်ဆေးပါ။'
                : 'Access Pass not found. Please check your code with Admin.',
          };
        }

        const p = snap.data();
        if (p.status !== 'active') {
          return {
            ok: false,
            error:
              lang === 'my'
                ? 'ဤ Pass ကို Admin မှ ပိတ်ထားပြီးဖြစ်ပါသည်။'
                : 'This Access Pass has been revoked by Admin.',
          };
        }

        const expiresAtMs = timestampToMs(p.expiresAt);
        if (!expiresAtMs || expiresAtMs <= Date.now()) {
          return {
            ok: false,
            error:
              lang === 'my'
                ? 'ဤ Pass သည် သက်တမ်းကုန်ဆုံးသွားပြီးဖြစ်ပါသည်။'
                : 'This Access Pass has already expired.',
          };
        }

        const existingAssignedUid = typeof p.assignedUid === 'string' ? p.assignedUid : '';
        if (existingAssignedUid && existingAssignedUid !== user.uid) {
          return {
            ok: false,
            error:
              lang === 'my'
                ? 'ဤ Pass ကို အခြား Gmail အကောင့်တစ်ခုတွင် အသုံးပြုပြီးဖြစ်ပါသည်။'
                : 'This Access Pass is already bound to another Gmail account.',
          };
        }

        const maxDevices = Number(p.maxDevices || 1);
        const existingDevices: string[] = Array.isArray(p.boundDevices)
          ? p.boundDevices.map(String)
          : [];
        const nextDevices = existingDevices.includes(deviceId)
          ? existingDevices
          : [...existingDevices, deviceId];

        if (nextDevices.length > maxDevices) {
          return {
            ok: false,
            error:
              lang === 'my'
                ? `စက်အရေအတွက် (${maxDevices} လုံး) ပြည့်နေပါပြီ။ Admin ထံတွင် Device Reset တောင်းပါ။`
                : `Device limit (${maxDevices}) reached. Ask Admin to reset devices.`,
          };
        }

        const licRef = doc(db, 'userLicenses', user.uid);
        const existingLic = await getDoc(licRef);
        const batch = writeBatch(db);

        batch.update(passRef, {
          assignedUid: user.uid,
          assignedEmail: clampString(user.email || '', 160),
          boundDevices: nextDevices,
          updatedAt: serverTimestamp(),
        });

        const expiresTs =
          p.expiresAt instanceof Timestamp ? p.expiresAt : Timestamp.fromMillis(expiresAtMs);

        if (existingLic.exists()) {
          batch.update(licRef, {
            passCode: code,
            label: clampString(p.label, 120, 'Licensed Shop'),
            status: 'active',
            expiresAt: expiresTs,
            maxDevices,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(licRef, {
            userId: user.uid,
            email: clampString(user.email || '', 160),
            displayName: clampString(user.displayName || '', 120),
            passCode: code,
            label: clampString(p.label, 120, 'Licensed Shop'),
            status: 'active',
            expiresAt: expiresTs,
            maxDevices,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        showToast(
          lang === 'my'
            ? 'Access Pass အတည်ပြုပြီးပါပြီ။ ကြိုဆိုပါသည်!'
            : 'Access Pass activated! Welcome to ShwePOS.'
        );
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('permission')) {
          return {
            ok: false,
            error:
              lang === 'my'
                ? 'ဤ Pass သည် အခြားသူအသုံးပြုပြီး သို့မဟုတ် သက်တမ်းကုန်ဆုံးသွားပြီး ဖြစ်နိုင်ပါသည်။'
                : 'Pass is already claimed by another Gmail account, expired, or invalid.',
          };
        }
        return {
          ok: false,
          error:
            msg ||
            (lang === 'my' ? 'Pass စစ်ဆေးမှု မအောင်မြင်ပါ။' : 'Failed to verify Access Pass.'),
        };
      }
    },
    [user, deviceId, lang, showToast]
  );

  // Firestore real-time listeners (strictly gated on authReady && user && accessStatus === 'granted')
  useEffect(() => {
    if (!authReady || !user || accessStatus !== 'granted') return;
    let active = true;
    const uid = activeShopId;
    setLoadingData(true);

    const unsubscribers: (() => void)[] = [];

    const initShop =
      uid === user.uid ? ensureShopDoc(uid, user.displayName) : Promise.resolve();

    initShop
      .then(() => {
        if (!active) return;

        // 1. Shop settings doc
        unsubscribers.push(
          onSnapshot(
            doc(db, 'shops', uid),
            (snap) => {
              if (snap.exists()) {
                setShop(snap.data() as ShopSettings);
              }
              setLoadingData(false);
            },
            (err) => handleFirestoreError(err, OperationType.GET, `shops/${uid}`)
          )
        );

        // Helper for subcollections (always includes ownerId where-clause for Pillar 8 compliance)
        const watchSub = <T extends { id: string }>(
          subName: string,
          setter: React.Dispatch<React.SetStateAction<T[]>>,
          sortByDateField?: string
        ) => {
          const path = `shops/${uid}/${subName}`;
          const q = query(collection(db, 'shops', uid, subName), where('ownerId', '==', uid));
          const u = onSnapshot(
            q,
            (snapshot) => {
              const list = snapshot.docs.map(
                (d) => ({ id: d.id, ...d.data() }) as T
              );
              if (sortByDateField) {
                list.sort((a, b) => {
                  const av = String((a as Record<string, unknown>)[sortByDateField] || '');
                  const bv = String((b as Record<string, unknown>)[sortByDateField] || '');
                  return bv.localeCompare(av);
                });
              }
              setter(list);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, path)
          );
          unsubscribers.push(u);
        };

        watchSub<Product>('products', setProducts);
        watchSub<Sale>('sales', setSales, 'date');
        watchSub<Purchase>('purchases', setPurchases, 'date');
        watchSub<StockLog>('stockLogs', setStockLogs, 'date');
        watchSub<Debt>('debts', setDebts, 'dueDate');
        watchSub<Expense>('expenses', setExpenses, 'date');
        watchSub<Delivery>('deliveries', setDeliveries, 'date');
      })
      .catch((err) => {
        console.error('Shop init error:', err);
        setLoadingData(false);
      });

    return () => {
      active = false;
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, user, accessStatus, activeShopId, ensureShopDoc]);

  const loginWithGoogle = useCallback(async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setSigningIn(true);
    try {
      await signInWithGoogle();
      showToast(
        lang === 'my'
          ? 'Google အကောင့်ဖြင့် ဝင်ရောက်ပြီးပါပြီ။'
          : 'Signed in with Google.'
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        showToast(
          lang === 'my' ? 'Google ဝင်ရောက်ခြင်းကို ပိတ်လိုက်ပါသည်။' : 'Google sign-in popup was closed.',
          'info'
        );
      } else if (code === 'auth/popup-blocked') {
        showToast(
          lang === 'my'
            ? 'Browser မှ Popup ကို ပိတ်ထားပါသည်။ Popup ဖွင့်ပေးပြီး ထပ်စမ်းကြည့်ပါ။'
            : 'Popup was blocked by your browser. Please allow popups and try again.',
          'error'
        );
      } else {
        console.error('Sign-in failed:', err);
        showToast(
          lang === 'my' ? 'Google ဝင်ရောက်မှု မအောင်မြင်ပါ။' : 'Google Sign-In failed.',
          'error'
        );
      }
    } finally {
      signingInRef.current = false;
      setSigningIn(false);
    }
  }, [lang, showToast]);

  const logout = useCallback(async () => {
    setAdminTargetShopId(null);
    setAdminTargetShopLabel('');
    await signOutUser();
    showToast(lang === 'my' ? 'အကောင့်မှ ထွက်လိုက်ပါပြီ။' : 'Signed out.', 'info');
  }, [lang, showToast]);

  const seedCloudWithSampleData = useCallback(async () => {
    const uid = activeShopId;
    const sample = createSeedDataset(uid);

    if (!user) {
      setShop(sample.shop);
      setProducts(sample.products);
      setSales(sample.sales);
      setPurchases(sample.purchases);
      setStockLogs(sample.stockLogs);
      setDebts(sample.debts);
      setExpenses(sample.expenses);
      setDeliveries(sample.deliveries);
      showToast(lang === 'my' ? 'နမူနာဒေတာ ထည့်သွင်းပြီးပါပြီ။' : 'Sample shop data loaded.');
      return;
    }

    try {
      await ensureShopDoc(uid, user.displayName);
      // Update shop profile first
      await updateDoc(doc(db, 'shops', uid), {
        shopName: sample.shop.shopName,
        shopSubtitle: sample.shop.shopSubtitle,
        phone: sample.shop.phone,
        address: sample.shop.address,
        receiptFooter: sample.shop.receiptFooter,
        defaultMarginPercent: sample.shop.defaultMarginPercent,
        telegramEnabled: sample.shop.telegramEnabled,
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      for (const p of sample.products) {
        const { id, ...rest } = p;
        batch.set(doc(db, 'shops', uid, 'products', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const s of sample.sales) {
        const { id, ...rest } = s;
        batch.set(doc(db, 'shops', uid, 'sales', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const pur of sample.purchases) {
        const { id, ...rest } = pur;
        batch.set(doc(db, 'shops', uid, 'purchases', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const log of sample.stockLogs) {
        const { id, ...rest } = log;
        batch.set(doc(db, 'shops', uid, 'stockLogs', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
        });
      }
      for (const d of sample.debts) {
        const { id, ...rest } = d;
        batch.set(doc(db, 'shops', uid, 'debts', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const e of sample.expenses) {
        const { id, ...rest } = e;
        batch.set(doc(db, 'shops', uid, 'expenses', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const dlv of sample.deliveries) {
        const { id, ...rest } = dlv;
        batch.set(doc(db, 'shops', uid, 'deliveries', sanitizeId(id)), {
          ...rest,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast(
        lang === 'my'
          ? 'Firebase Cloud ထဲသို့ နမူနာဒေတာများ ထည့်သွင်းပြီးပါပြီ။'
          : 'Sample shop dataset seeded to Firebase Cloud.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shops/${uid}`);
    }
  }, [user, activeShopId, ensureShopDoc, lang, showToast]);

  // ---------------------------------------------------------------------------
  // 1. Shop Settings
  // ---------------------------------------------------------------------------
  const updateShopSettings = useCallback(
    async (updates: Partial<Omit<ShopSettings, 'ownerId' | 'createdAt' | 'updatedAt'>>) => {
      const sanitized = {
        shopName: clampString(updates.shopName ?? shop.shopName, 120, 'My POS Shop'),
        shopSubtitle: clampString(updates.shopSubtitle ?? shop.shopSubtitle, 160),
        phone: clampString(updates.phone ?? shop.phone, 40),
        address: clampString(updates.address ?? shop.address, 240),
        receiptFooter: clampString(updates.receiptFooter ?? shop.receiptFooter, 240),
        defaultMarginPercent: clampNumber(
          updates.defaultMarginPercent ?? shop.defaultMarginPercent,
          0,
          1000
        ),
        telegramEnabled: Boolean(updates.telegramEnabled ?? shop.telegramEnabled),
      };

      if (!user) {
        setShop((prev) => ({ ...prev, ...sanitized }));
        showToast(lang === 'my' ? 'ဆိုင်အချက်အလက် သိမ်းဆည်းပြီးပါပြီ။' : 'Shop settings saved.');
        return;
      }

      const path = `shops/${activeShopId}`;
      try {
        if (activeShopId === user.uid) {
          await ensureShopDoc(activeShopId, user.displayName);
        }
        await updateDoc(doc(db, 'shops', activeShopId), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
        showToast(lang === 'my' ? 'ဆိုင်အချက်အလက် သိမ်းဆည်းပြီးပါပြီ။' : 'Shop settings saved.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, activeShopId, shop, ensureShopDoc, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 2. Products CRUD
  // ---------------------------------------------------------------------------
  const saveProduct = useCallback(
    async (
      input: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      const uid = activeShopId;
      const id = sanitizeId(existingId || generateDocId('prod'));
      const data = {
        sku: clampString(input.sku, 64, `SKU-${Date.now().toString().slice(-4)}`),
        name: clampString(input.name, 140, 'Unnamed Product'),
        category: clampString(input.category, 64, 'General'),
        unit: clampString(input.unit, 32, 'pcs'),
        costPrice: clampNumber(input.costPrice, 0, 1000000000),
        marginPercent: clampNumber(input.marginPercent, 0, 10000),
        sellPrice: clampNumber(input.sellPrice, 0, 1000000000),
        stock: clampNumber(input.stock, -1000000, 100000000),
        minStock: clampNumber(input.minStock, 0, 10000000),
      };

      if (!user) {
        setProducts((prev) => {
          if (existingId) {
            return prev.map((p) => (p.id === existingId ? { ...p, ...data } : p));
          }
          return [{ id, ownerId: uid, ...data }, ...prev];
        });
        showToast(lang === 'my' ? 'ကုန်ပစ္စည်း သိမ်းဆည်းပြီးပါပြီ။' : 'Product saved.');
        return;
      }

      const path = `shops/${uid}/products/${id}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        if (existingId) {
          await updateDoc(doc(db, 'shops', uid, 'products', id), {
            ...data,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'shops', uid, 'products', id), {
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(lang === 'my' ? 'ကုန်ပစ္စည်း သိမ်းဆည်းပြီးပါပြီ။' : 'Product saved.');
      } catch (error) {
        handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
      }
    },
    [user, activeShopId, ensureShopDoc, lang, showToast]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!user) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast(lang === 'my' ? 'ပစ္စည်းဖျက်ပြီးပါပြီ။' : 'Product deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/products/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'products', sanitizeId(id)));
        showToast(lang === 'my' ? 'ပစ္စည်းဖျက်ပြီးပါပြီ။' : 'Product deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 3. Sales / POS Checkout (Auto Stock Deduct + Auto Debt + Optional Delivery)
  // ---------------------------------------------------------------------------
  const createSale = useCallback(
    async (payload: {
      customerName: string;
      customerPhone: string;
      paymentMethod: PaymentMethod;
      items: SaleItem[];
      discount: number;
      paidAmount: number;
      note: string;
      createDelivery?: {
        address: string;
        courierName: string;
        deliveryFee: number;
      };
    }): Promise<Sale> => {
      const uid = activeShopId;
      const saleId = sanitizeId(generateDocId('sale'));
      const voucherNo = generateVoucherNo('INV');
      const today = getTodayISO();
      const boundedItems = payload.items.slice(0, 100);
      const subtotal = boundedItems.reduce((s, it) => s + it.lineTotal, 0);
      const discount = clampNumber(payload.discount, 0, subtotal);
      const total = Math.max(0, subtotal - discount);
      const totalCost = boundedItems.reduce((s, it) => s + it.costPrice * it.qty, 0);
      const profit = total - totalCost;
      const paidAmount = clampNumber(payload.paidAmount, 0, 1000000000);

      const newSale: Sale = {
        id: saleId,
        ownerId: uid,
        voucherNo,
        date: today,
        customerName: clampString(payload.customerName, 120),
        customerPhone: clampString(payload.customerPhone, 40),
        paymentMethod: payload.paymentMethod,
        items: boundedItems,
        subtotal,
        discount,
        total,
        totalCost,
        profit,
        paidAmount,
        note: clampString(payload.note, 240),
      };

      const remainingDebt =
        payload.paymentMethod === 'credit' || paidAmount < total
          ? Math.max(0, total - paidAmount)
          : 0;

      if (!user) {
        setSales((prev) => [newSale, ...prev]);
        // Deduct stock + add logs
        const newLogs: StockLog[] = [];
        setProducts((prev) =>
          prev.map((prod) => {
            const matched = boundedItems.find((i) => i.productId === prod.id);
            if (!matched) return prod;
            const nextStock = prod.stock - matched.qty;
            newLogs.push({
              id: generateDocId('log'),
              ownerId: uid,
              productId: prod.id,
              productName: prod.name,
              type: 'out',
              quantity: matched.qty,
              previousStock: prod.stock,
              newStock: nextStock,
              reason: `Sale ${voucherNo}`,
              date: today,
            });
            return { ...prod, stock: nextStock };
          })
        );
        if (newLogs.length > 0) {
          setStockLogs((prev) => [...newLogs, ...prev]);
        }

        if (remainingDebt > 0) {
          const due = new Date();
          due.setDate(due.getDate() + 14);
          setDebts((prev) => [
            {
              id: generateDocId('debt'),
              ownerId: uid,
              type: 'receivable',
              partyName: newSale.customerName || 'Credit Customer',
              phone: newSale.customerPhone,
              referenceNo: voucherNo,
              totalAmount: total,
              paidAmount: Math.min(paidAmount, total),
              remainingAmount: remainingDebt,
              dueDate: due.toISOString().slice(0, 10),
              status: paidAmount > 0 ? 'partial' : 'pending',
              note: `Auto-created from POS ${voucherNo}`,
            },
            ...prev,
          ]);
        }

        if (payload.createDelivery && payload.createDelivery.address.trim()) {
          setDeliveries((prev) => [
            {
              id: generateDocId('deliv'),
              ownerId: uid,
              voucherNo,
              date: today,
              customerName: newSale.customerName || 'Customer',
              phone: newSale.customerPhone,
              address: clampString(payload.createDelivery!.address, 240),
              courierName: clampString(payload.createDelivery!.courierName, 80, 'Shop Rider'),
              deliveryFee: clampNumber(payload.createDelivery!.deliveryFee, 0),
              codAmount:
                payload.paymentMethod === 'credit'
                  ? remainingDebt + clampNumber(payload.createDelivery!.deliveryFee, 0)
                  : 0,
              status: 'pending',
              note: `POS order ${voucherNo}`,
            },
            ...prev,
          ]);
        }

        showToast(
          lang === 'my' ? `ဘောင်ချာ ${voucherNo} အောင်မြင်စွာ ဖွင့်ပြီးပါပြီ။` : `Sale ${voucherNo} completed.`
        );
        return newSale;
      }

      // Cloud Mode Atomic Batch Write
      const path = `shops/${uid}/sales/${saleId}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        const batch = writeBatch(db);
        const { id: _ignoreId, ...saleBody } = newSale;

        batch.set(doc(db, 'shops', uid, 'sales', saleId), {
          ...saleBody,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const item of boundedItems) {
          const existingProd = products.find((p) => p.id === item.productId);
          if (existingProd) {
            const nextStock = existingProd.stock - item.qty;
            batch.update(doc(db, 'shops', uid, 'products', sanitizeId(existingProd.id)), {
              stock: nextStock,
              updatedAt: serverTimestamp(),
            });
            const logId = sanitizeId(generateDocId('log'));
            batch.set(doc(db, 'shops', uid, 'stockLogs', logId), {
              ownerId: uid,
              productId: sanitizeId(existingProd.id),
              productName: clampString(existingProd.name, 140),
              type: 'out',
              quantity: item.qty,
              previousStock: existingProd.stock,
              newStock: nextStock,
              reason: clampString(`Sale ${voucherNo}`, 200),
              date: today,
              createdAt: serverTimestamp(),
            });
          }
        }

        if (remainingDebt > 0) {
          const due = new Date();
          due.setDate(due.getDate() + 14);
          const debtId = sanitizeId(generateDocId('debt'));
          batch.set(doc(db, 'shops', uid, 'debts', debtId), {
            ownerId: uid,
            type: 'receivable',
            partyName: clampString(newSale.customerName || 'Credit Customer', 120),
            phone: clampString(newSale.customerPhone, 40),
            referenceNo: voucherNo,
            totalAmount: total,
            paidAmount: Math.min(paidAmount, total),
            remainingAmount: remainingDebt,
            dueDate: sanitizeDate(due.toISOString().slice(0, 10)),
            status: paidAmount > 0 ? 'partial' : 'pending',
            note: clampString(`Auto-created from POS ${voucherNo}`, 240),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (payload.createDelivery && payload.createDelivery.address.trim()) {
          const delivId = sanitizeId(generateDocId('deliv'));
          batch.set(doc(db, 'shops', uid, 'deliveries', delivId), {
            ownerId: uid,
            voucherNo,
            date: today,
            customerName: clampString(newSale.customerName || 'Customer', 120),
            phone: clampString(newSale.customerPhone, 40),
            address: clampString(payload.createDelivery.address, 240),
            courierName: clampString(payload.createDelivery.courierName, 80, 'Shop Rider'),
            deliveryFee: clampNumber(payload.createDelivery.deliveryFee, 0),
            codAmount:
              payload.paymentMethod === 'credit'
                ? remainingDebt + clampNumber(payload.createDelivery.deliveryFee, 0)
                : 0,
            status: 'pending',
            note: clampString(`POS order ${voucherNo}`, 240),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        showToast(
          lang === 'my' ? `ဘောင်ချာ ${voucherNo} Cloud တွင် သိမ်းပြီးပါပြီ။` : `Sale ${voucherNo} saved to Cloud.`
        );
        return newSale;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, activeShopId, products, ensureShopDoc, lang, showToast]
  );

  const deleteSale = useCallback(
    async (id: string) => {
      if (!user) {
        setSales((prev) => prev.filter((s) => s.id !== id));
        showToast(lang === 'my' ? 'အရောင်းမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Sale deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/sales/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'sales', sanitizeId(id)));
        showToast(lang === 'my' ? 'အရောင်းမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Sale deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 4. Purchases (Auto Stock Replenishment + Cost Update + Optional Payable Debt)
  // ---------------------------------------------------------------------------
  const createPurchase = useCallback(
    async (payload: {
      supplierName: string;
      date: string;
      items: PurchaseItem[];
      paidAmount: number;
      status: 'paid' | 'credit';
      note: string;
    }) => {
      const uid = activeShopId;
      const purId = sanitizeId(generateDocId('pur'));
      const refNo = generateVoucherNo('PO');
      const date = sanitizeDate(payload.date);
      const boundedItems = payload.items.slice(0, 100);
      const totalAmount = boundedItems.reduce((s, it) => s + it.lineTotal, 0);
      const paidAmount =
        payload.status === 'paid' ? totalAmount : clampNumber(payload.paidAmount, 0, totalAmount);
      const remaining = Math.max(0, totalAmount - paidAmount);

      const newPurchase: Purchase = {
        id: purId,
        ownerId: uid,
        refNo,
        date,
        supplierName: clampString(payload.supplierName, 120, 'Supplier'),
        items: boundedItems,
        totalAmount,
        paidAmount,
        status: remaining > 0 ? 'credit' : 'paid',
        note: clampString(payload.note, 240),
      };

      if (!user) {
        setPurchases((prev) => [newPurchase, ...prev]);
        const newLogs: StockLog[] = [];
        setProducts((prev) =>
          prev.map((prod) => {
            const matched = boundedItems.find((i) => i.productId === prod.id);
            if (!matched) return prod;
            const nextStock = prod.stock + matched.qty;
            const nextCost = matched.costPrice;
            const nextSell = Math.round(nextCost * (1 + prod.marginPercent / 100));
            newLogs.push({
              id: generateDocId('log'),
              ownerId: uid,
              productId: prod.id,
              productName: prod.name,
              type: 'in',
              quantity: matched.qty,
              previousStock: prod.stock,
              newStock: nextStock,
              reason: `Purchase ${refNo}`,
              date,
            });
            return { ...prod, stock: nextStock, costPrice: nextCost, sellPrice: nextSell };
          })
        );
        if (newLogs.length > 0) setStockLogs((prev) => [...newLogs, ...prev]);
        if (remaining > 0) {
          const due = new Date();
          due.setDate(due.getDate() + 14);
          setDebts((prev) => [
            {
              id: generateDocId('debt'),
              ownerId: uid,
              type: 'payable',
              partyName: newPurchase.supplierName,
              phone: '',
              referenceNo: refNo,
              totalAmount,
              paidAmount,
              remainingAmount: remaining,
              dueDate: due.toISOString().slice(0, 10),
              status: paidAmount > 0 ? 'partial' : 'pending',
              note: `Supplier credit from ${refNo}`,
            },
            ...prev,
          ]);
        }
        showToast(lang === 'my' ? 'အဝယ်စာရင်းနှင့် Stock ပေါင်းထည့်ပြီးပါပြီ။' : 'Purchase recorded & restocked.');
        return;
      }

      const path = `shops/${uid}/purchases/${purId}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        const batch = writeBatch(db);
        const { id: _id, ...purBody } = newPurchase;
        batch.set(doc(db, 'shops', uid, 'purchases', purId), {
          ...purBody,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const item of boundedItems) {
          const existingProd = products.find((p) => p.id === item.productId);
          if (existingProd) {
            const nextStock = existingProd.stock + item.qty;
            const nextCost = clampNumber(item.costPrice, 0, 1000000000);
            const nextSell = Math.round(nextCost * (1 + existingProd.marginPercent / 100));
            batch.update(doc(db, 'shops', uid, 'products', sanitizeId(existingProd.id)), {
              stock: nextStock,
              costPrice: nextCost,
              sellPrice: nextSell,
              updatedAt: serverTimestamp(),
            });
            const logId = sanitizeId(generateDocId('log'));
            batch.set(doc(db, 'shops', uid, 'stockLogs', logId), {
              ownerId: uid,
              productId: sanitizeId(existingProd.id),
              productName: clampString(existingProd.name, 140),
              type: 'in',
              quantity: item.qty,
              previousStock: existingProd.stock,
              newStock: nextStock,
              reason: clampString(`Purchase ${refNo}`, 200),
              date,
              createdAt: serverTimestamp(),
            });
          }
        }

        if (remaining > 0) {
          const due = new Date();
          due.setDate(due.getDate() + 14);
          const debtId = sanitizeId(generateDocId('debt'));
          batch.set(doc(db, 'shops', uid, 'debts', debtId), {
            ownerId: uid,
            type: 'payable',
            partyName: newPurchase.supplierName,
            phone: '',
            referenceNo: refNo,
            totalAmount,
            paidAmount,
            remainingAmount: remaining,
            dueDate: sanitizeDate(due.toISOString().slice(0, 10)),
            status: paidAmount > 0 ? 'partial' : 'pending',
            note: clampString(`Supplier credit from ${refNo}`, 240),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        showToast(lang === 'my' ? 'အဝယ်စာရင်းနှင့် Stock ပေါင်းထည့်ပြီးပါပြီ။' : 'Purchase recorded & restocked.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, activeShopId, products, ensureShopDoc, lang, showToast]
  );

  const deletePurchase = useCallback(
    async (id: string) => {
      if (!user) {
        setPurchases((prev) => prev.filter((p) => p.id !== id));
        showToast(lang === 'my' ? 'အဝယ်မှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Purchase deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/purchases/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'purchases', sanitizeId(id)));
        showToast(lang === 'my' ? 'အဝယ်မှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Purchase deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 5. Stock Adjustment
  // ---------------------------------------------------------------------------
  const adjustProductStock = useCallback(
    async (payload: {
      productId: string;
      type: 'in' | 'out' | 'adjust';
      quantity: number;
      reason: string;
    }) => {
      const uid = activeShopId;
      const prod = products.find((p) => p.id === payload.productId);
      if (!prod) return;

      const qty = Number(payload.quantity) || 0;
      let nextStock = prod.stock;
      if (payload.type === 'in') nextStock = prod.stock + Math.abs(qty);
      else if (payload.type === 'out') nextStock = prod.stock - Math.abs(qty);
      else nextStock = qty;

      const today = getTodayISO();
      const logId = sanitizeId(generateDocId('log'));
      const logEntry: StockLog = {
        id: logId,
        ownerId: uid,
        productId: sanitizeId(prod.id),
        productName: clampString(prod.name, 140),
        type: payload.type,
        quantity: payload.type === 'adjust' ? nextStock - prod.stock : Math.abs(qty),
        previousStock: prod.stock,
        newStock: nextStock,
        reason: clampString(payload.reason, 200, 'Manual adjustment'),
        date: today,
      };

      if (!user) {
        setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, stock: nextStock } : p)));
        setStockLogs((prev) => [logEntry, ...prev]);
        showToast(lang === 'my' ? 'ကုန်လက်ကျန် ပြင်ဆင်ပြီးပါပြီ။' : 'Stock updated.');
        return;
      }

      const path = `shops/${uid}/products/${prod.id}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        const batch = writeBatch(db);
        batch.update(doc(db, 'shops', uid, 'products', sanitizeId(prod.id)), {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        const { id: _id, ...logBody } = logEntry;
        batch.set(doc(db, 'shops', uid, 'stockLogs', logId), {
          ...logBody,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        showToast(lang === 'my' ? 'ကုန်လက်ကျန် ပြင်ဆင်ပြီးပါပြီ။' : 'Stock updated.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, activeShopId, products, ensureShopDoc, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 6. Debts Ledger
  // ---------------------------------------------------------------------------
  const createDebt = useCallback(
    async (
      payload: Omit<
        Debt,
        'id' | 'ownerId' | 'remainingAmount' | 'status' | 'createdAt' | 'updatedAt'
      >
    ) => {
      const uid = activeShopId;
      const id = sanitizeId(generateDocId('debt'));
      const totalAmount = clampNumber(payload.totalAmount, 0);
      const paidAmount = clampNumber(payload.paidAmount, 0, totalAmount);
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const status: Debt['status'] =
        remainingAmount === 0 ? 'settled' : paidAmount > 0 ? 'partial' : 'pending';

      const record: Debt = {
        id,
        ownerId: uid,
        type: payload.type,
        partyName: clampString(payload.partyName, 120, 'Party'),
        phone: clampString(payload.phone, 40),
        referenceNo: clampString(payload.referenceNo, 48),
        totalAmount,
        paidAmount,
        remainingAmount,
        dueDate: sanitizeDate(payload.dueDate),
        status,
        note: clampString(payload.note, 240),
      };

      if (!user) {
        setDebts((prev) => [record, ...prev]);
        showToast(lang === 'my' ? 'အကြွေးစာရင်း ထည့်သွင်းပြီးပါပြီ။' : 'Debt record added.');
        return;
      }

      const path = `shops/${uid}/debts/${id}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        const { id: _id, ...body } = record;
        await setDoc(doc(db, 'shops', uid, 'debts', id), {
          ...body,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(lang === 'my' ? 'အကြွေးစာရင်း ထည့်သွင်းပြီးပါပြီ။' : 'Debt record added.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, activeShopId, ensureShopDoc, lang, showToast]
  );

  const recordDebtPayment = useCallback(
    async (debtId: string, payAmount: number) => {
      const debt = debts.find((d) => d.id === debtId);
      if (!debt || debt.status === 'settled') return;

      const added = clampNumber(payAmount, 0, debt.remainingAmount);
      if (added <= 0) return;

      const nextPaid = debt.paidAmount + added;
      const nextRemaining = Math.max(0, debt.totalAmount - nextPaid);
      const nextStatus: Debt['status'] = nextRemaining === 0 ? 'settled' : 'partial';

      if (!user) {
        setDebts((prev) =>
          prev.map((d) =>
            d.id === debtId
              ? {
                  ...d,
                  paidAmount: nextPaid,
                  remainingAmount: nextRemaining,
                  status: nextStatus,
                }
              : d
          )
        );
        showToast(lang === 'my' ? 'အကြွေးဆပ်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ။' : 'Payment recorded.');
        return;
      }

      const path = `shops/${activeShopId}/debts/${debtId}`;
      try {
        await updateDoc(doc(db, 'shops', activeShopId, 'debts', sanitizeId(debtId)), {
          paidAmount: nextPaid,
          remainingAmount: nextRemaining,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        showToast(lang === 'my' ? 'အကြွေးဆပ်ငွေ မှတ်တမ်းတင်ပြီးပါပြီ။' : 'Payment recorded.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, activeShopId, debts, lang, showToast]
  );

  const deleteDebt = useCallback(
    async (id: string) => {
      if (!user) {
        setDebts((prev) => prev.filter((d) => d.id !== id));
        showToast(lang === 'my' ? 'အကြွေးမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Debt record deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/debts/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'debts', sanitizeId(id)));
        showToast(lang === 'my' ? 'အကြွေးမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Debt record deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 7. Expenses CRUD
  // ---------------------------------------------------------------------------
  const saveExpense = useCallback(
    async (
      payload: Omit<Expense, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      const uid = activeShopId;
      const id = sanitizeId(existingId || generateDocId('exp'));
      const data = {
        date: sanitizeDate(payload.date),
        category: clampString(payload.category, 64, 'General'),
        title: clampString(payload.title, 140, 'Expense'),
        amount: clampNumber(payload.amount, 0),
        note: clampString(payload.note, 240),
      };

      if (!user) {
        setExpenses((prev) => {
          if (existingId) {
            return prev.map((e) => (e.id === existingId ? { ...e, ...data } : e));
          }
          return [{ id, ownerId: uid, ...data }, ...prev];
        });
        showToast(lang === 'my' ? 'ကုန်ကျစရိတ် သိမ်းဆည်းပြီးပါပြီ။' : 'Expense saved.');
        return;
      }

      const path = `shops/${uid}/expenses/${id}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        if (existingId) {
          await updateDoc(doc(db, 'shops', uid, 'expenses', id), {
            ...data,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'shops', uid, 'expenses', id), {
            ownerId: uid,
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(lang === 'my' ? 'ကုန်ကျစရိတ် သိမ်းဆည်းပြီးပါပြီ။' : 'Expense saved.');
      } catch (error) {
        handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
      }
    },
    [user, activeShopId, ensureShopDoc, lang, showToast]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      if (!user) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        showToast(lang === 'my' ? 'ကုန်ကျစရိတ် ဖျက်ပြီးပါပြီ။' : 'Expense deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/expenses/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'expenses', sanitizeId(id)));
        showToast(lang === 'my' ? 'ကုန်ကျစရိတ် ဖျက်ပြီးပါပြီ။' : 'Expense deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 8. Delivery CRUD & Workflow
  // ---------------------------------------------------------------------------
  const createDelivery = useCallback(
    async (payload: Omit<Delivery, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
      const uid = activeShopId;
      const id = sanitizeId(generateDocId('deliv'));
      const data: Delivery = {
        id,
        ownerId: uid,
        voucherNo: clampString(payload.voucherNo, 48, generateVoucherNo('DLV')),
        date: sanitizeDate(payload.date),
        customerName: clampString(payload.customerName, 120, 'Customer'),
        phone: clampString(payload.phone, 40),
        address: clampString(payload.address, 240, 'Yangon'),
        courierName: clampString(payload.courierName, 80, 'Express'),
        deliveryFee: clampNumber(payload.deliveryFee, 0),
        codAmount: clampNumber(payload.codAmount, 0),
        status: payload.status || 'pending',
        note: clampString(payload.note, 240),
      };

      if (!user) {
        setDeliveries((prev) => [data, ...prev]);
        showToast(lang === 'my' ? 'ပို့ဆောင်ရေးစာရင်း ထည့်သွင်းပြီးပါပြီ။' : 'Delivery order added.');
        return;
      }

      const path = `shops/${uid}/deliveries/${id}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        const { id: _id, ...body } = data;
        await setDoc(doc(db, 'shops', uid, 'deliveries', id), {
          ...body,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(lang === 'my' ? 'ပို့ဆောင်ရေးစာရင်း ထည့်သွင်းပြီးပါပြီ။' : 'Delivery order added.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user, activeShopId, ensureShopDoc, lang, showToast]
  );

  const updateDeliveryStatus = useCallback(
    async (deliveryId: string, status: DeliveryStatus) => {
      const existing = deliveries.find((d) => d.id === deliveryId);
      if (!existing || existing.status === 'delivered' || existing.status === 'cancelled') return;

      if (!user) {
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? { ...d, status } : d))
        );
        showToast(lang === 'my' ? 'ပို့ဆောင်မှုအခြေအနေ ပြောင်းလဲပြီးပါပြီ။' : 'Delivery status updated.');
        return;
      }

      const path = `shops/${activeShopId}/deliveries/${deliveryId}`;
      try {
        await updateDoc(doc(db, 'shops', activeShopId, 'deliveries', sanitizeId(deliveryId)), {
          status,
          updatedAt: serverTimestamp(),
        });
        showToast(lang === 'my' ? 'ပို့ဆောင်မှုအခြေအနေ ပြောင်းလဲပြီးပါပြီ။' : 'Delivery status updated.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, activeShopId, deliveries, lang, showToast]
  );

  const deleteDelivery = useCallback(
    async (id: string) => {
      if (!user) {
        setDeliveries((prev) => prev.filter((d) => d.id !== id));
        showToast(lang === 'my' ? 'ပို့ဆောင်မှုမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Delivery deleted.', 'info');
        return;
      }
      const path = `shops/${activeShopId}/deliveries/${id}`;
      try {
        await deleteDoc(doc(db, 'shops', activeShopId, 'deliveries', sanitizeId(id)));
        showToast(lang === 'my' ? 'ပို့ဆောင်မှုမှတ်တမ်း ဖျက်ပြီးပါပြီ။' : 'Delivery deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user, activeShopId, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 9. Backup & Restore JSON
  // ---------------------------------------------------------------------------
  const exportBackupJson = useCallback(() => {
    const stripMeta = <T extends Record<string, unknown>>(item: T) => {
      const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = item;
      return rest;
    };

    const payload: PosBackupPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shop: stripMeta(shop as unknown as Record<string, unknown>) as PosBackupPayload['shop'],
      products: products.map((p) =>
        stripMeta(p as unknown as Record<string, unknown>)
      ) as PosBackupPayload['products'],
      sales: sales.map((s) =>
        stripMeta(s as unknown as Record<string, unknown>)
      ) as PosBackupPayload['sales'],
      purchases: purchases.map((p) =>
        stripMeta(p as unknown as Record<string, unknown>)
      ) as PosBackupPayload['purchases'],
      stockLogs: stockLogs.map((l) =>
        stripMeta(l as unknown as Record<string, unknown>)
      ) as PosBackupPayload['stockLogs'],
      debts: debts.map((d) =>
        stripMeta(d as unknown as Record<string, unknown>)
      ) as PosBackupPayload['debts'],
      expenses: expenses.map((e) =>
        stripMeta(e as unknown as Record<string, unknown>)
      ) as PosBackupPayload['expenses'],
      deliveries: deliveries.map((d) =>
        stripMeta(d as unknown as Record<string, unknown>)
      ) as PosBackupPayload['deliveries'],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShwePOS-Backup-${getTodayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(lang === 'my' ? 'Backup ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။' : 'Backup JSON downloaded.');
  }, [shop, products, sales, purchases, stockLogs, debts, expenses, deliveries, lang, showToast]);

  const restoreBackupJson = useCallback(
    async (backup: PosBackupPayload) => {
      const uid = activeShopId;
      if (!backup || !backup.shop || !Array.isArray(backup.products)) {
        showToast(lang === 'my' ? 'Backup ဖိုင်ပုံစံ မမှန်ကန်ပါ။' : 'Invalid backup JSON file.', 'error');
        return;
      }

      if (!user) {
        setShop({ ...backup.shop, ownerId: uid, currency: 'MMK' });
        setProducts(backup.products.map((p) => ({ ...p, ownerId: uid })));
        setSales((backup.sales || []).map((s) => ({ ...s, ownerId: uid })));
        setPurchases((backup.purchases || []).map((p) => ({ ...p, ownerId: uid })));
        setStockLogs((backup.stockLogs || []).map((l) => ({ ...l, ownerId: uid })));
        setDebts((backup.debts || []).map((d) => ({ ...d, ownerId: uid })));
        setExpenses((backup.expenses || []).map((e) => ({ ...e, ownerId: uid })));
        setDeliveries((backup.deliveries || []).map((d) => ({ ...d, ownerId: uid })));
        showToast(lang === 'my' ? 'Backup မှ ဒေတာများ ပြန်သွင်းပြီးပါပြီ။' : 'Backup restored locally.');
        return;
      }

      const path = `shops/${uid}`;
      try {
        await ensureShopDoc(uid, user.displayName);
        await updateDoc(doc(db, 'shops', uid), {
          shopName: clampString(backup.shop.shopName, 120, 'My Shop'),
          shopSubtitle: clampString(backup.shop.shopSubtitle, 160),
          phone: clampString(backup.shop.phone, 40),
          address: clampString(backup.shop.address, 240),
          receiptFooter: clampString(backup.shop.receiptFooter, 240),
          defaultMarginPercent: clampNumber(backup.shop.defaultMarginPercent, 0, 1000),
          telegramEnabled: Boolean(backup.shop.telegramEnabled),
          updatedAt: serverTimestamp(),
        });

        const batch = writeBatch(db);
        const writeCollection = <T extends { id: string }>(
          col: string,
          list: T[] | undefined,
          includeUpdated = true
        ) => {
          (list || []).slice(0, 60).forEach((item) => {
            const { id, ...rest } = item;
            const docId = sanitizeId(id || generateDocId(col));
            batch.set(doc(db, 'shops', uid, col, docId), {
              ...rest,
              ownerId: uid,
              createdAt: serverTimestamp(),
              ...(includeUpdated ? { updatedAt: serverTimestamp() } : {}),
            });
          });
        };

        writeCollection('products', backup.products);
        writeCollection('sales', backup.sales);
        writeCollection('purchases', backup.purchases);
        writeCollection('stockLogs', backup.stockLogs, false);
        writeCollection('debts', backup.debts);
        writeCollection('expenses', backup.expenses);
        writeCollection('deliveries', backup.deliveries);

        await batch.commit();
        showToast(
          lang === 'my'
            ? 'Backup ဖိုင်မှ Firebase Cloud သို့ ပြန်သွင်းပြီးပါပြီ။'
            : 'Backup restored to Firebase Cloud.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [user, activeShopId, ensureShopDoc, lang, showToast]
  );

  // ---------------------------------------------------------------------------
  // 10. Telegram & Supabase Server-Side Proxy Actions
  // ---------------------------------------------------------------------------
  const sendTelegramMessage = useCallback(
    async (message: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          showToast(
            data.error ||
              (lang === 'my'
                ? 'Telegram Bot Token/Chat ID ကို Server Env တွင် ထည့်သွင်းပေးပါ။'
                : 'Configure TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID in server secrets.'),
            'error'
          );
          return false;
        }
        showToast(lang === 'my' ? 'Telegram သို့ ပေးပို့ပြီးပါပြီ။' : 'Sent to Telegram successfully.');
        return true;
      } catch {
        showToast(lang === 'my' ? 'Telegram ပေးပို့မှု မအောင်မြင်ပါ။' : 'Telegram network error.', 'error');
        return false;
      }
    },
    [lang, showToast]
  );

  const pushToSupabase = useCallback(async (): Promise<boolean> => {
    const ownerId = activeShopId;
    const payload = {
      ownerId,
      shop,
      products,
      sales,
      purchases,
      stockLogs,
      debts,
      expenses,
      deliveries,
    };

    const markSuccess = () => {
      const now = new Date().toISOString();
      setSupabaseReachable(true);
      setSupabaseError(null);
      setLastCheckedAt(now);
      setLastSyncedAt(now);
    };

    const markFailure = (errText: string) => {
      setSupabaseReachable(false);
      setSupabaseError(errText);
      setLastCheckedAt(new Date().toISOString());
    };

    const tryDirectClientSync = async (): Promise<boolean> => {
      const direct = await pushPosDataDirectToSupabase(payload);
      if (!direct.ok) {
        const msg =
          direct.error ||
          (lang === 'my'
            ? 'SUPABASE_URL နှင့် SUPABASE_ANON_KEY (သို့) VITE_SUPABASE_* ကို Environment Variables တွင် ထည့်သွင်းပေးပါ။'
            : 'Configure SUPABASE_URL & SUPABASE_ANON_KEY (or VITE_SUPABASE_*) in environment variables.');
        markFailure(msg);
        showToast(msg, 'error');
        return false;
      }
      markSuccess();
      showToast(
        lang === 'my' ? 'Supabase PostgreSQL သို့ Sync တင်ပြီးပါပြီ။' : 'Synced all POS data to Supabase.'
      );
      return true;
    };

    setSyncingSupabase(true);
    try {
      // If running on static Web hosting (Vercel / Netlify / Electron) with client keys, sync directly
      if (integrations.supabaseMode === 'client') {
        return await tryDirectClientSync();
      }

      const res = await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (isClientSupabaseConfigured()) return await tryDirectClientSync();
        throw new Error('Server API route not available on static hosting.');
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (res.status === 400 && isClientSupabaseConfigured()) {
          return await tryDirectClientSync();
        }
        const msg =
          data.error ||
          (lang === 'my'
            ? 'SUPABASE_URL နှင့် SUPABASE_ANON_KEY ကို Server Env တွင် ထည့်သွင်းပေးပါ။'
            : 'Configure SUPABASE_URL & SUPABASE_ANON_KEY in server secrets.');
        markFailure(msg);
        showToast(msg, 'error');
        return false;
      }
      markSuccess();
      showToast(
        lang === 'my' ? 'Supabase PostgreSQL သို့ Sync တင်ပြီးပါပြီ။' : 'Synced all POS data to Supabase.'
      );
      return true;
    } catch {
      if (isClientSupabaseConfigured()) {
        return await tryDirectClientSync();
      }
      const msg =
        lang === 'my'
          ? 'Supabase Sync မအောင်မြင်ပါ။ Web Deploy တွင် VITE_SUPABASE_URL နှင့် VITE_SUPABASE_ANON_KEY ထည့်ပြီး Redeploy လုပ်ပါ။'
          : 'Supabase sync failed. For static Web deploys, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and redeploy.';
      markFailure(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setSyncingSupabase(false);
    }
  }, [
    user,
    activeShopId,
    shop,
    products,
    sales,
    purchases,
    stockLogs,
    debts,
    expenses,
    deliveries,
    integrations.supabaseMode,
    lang,
    showToast,
  ]);

  const pullFromSupabase = useCallback(async (): Promise<boolean> => {
    const ownerId = activeShopId;

    const markSuccess = () => {
      const now = new Date().toISOString();
      setSupabaseReachable(true);
      setSupabaseError(null);
      setLastCheckedAt(now);
      setLastSyncedAt(now);
    };

    const markFailure = (errText: string) => {
      setSupabaseReachable(false);
      setSupabaseError(errText);
      setLastCheckedAt(new Date().toISOString());
    };

    const tryDirectClientPull = async (): Promise<boolean> => {
      const direct = await pullPosDataDirectFromSupabase(ownerId);
      if (!direct.ok || !direct.data) {
        const msg = direct.error || 'Supabase pull failed.';
        markFailure(msg);
        showToast(msg, 'error');
        return false;
      }
      markSuccess();
      if (!direct.data.shop) {
        showToast(
          lang === 'my' ? 'Supabase တွင် ဒေတာမရှိသေးပါ။' : 'No records found in Supabase for this account.',
          'info'
        );
        return false;
      }
      await restoreBackupJson(direct.data);
      return true;
    };

    setSyncingSupabase(true);
    try {
      if (integrations.supabaseMode === 'client') {
        return await tryDirectClientPull();
      }

      const res = await fetch('/api/supabase/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (isClientSupabaseConfigured()) return await tryDirectClientPull();
        throw new Error('Server API route not available on static hosting.');
      }
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: PosBackupPayload;
      };
      if (!res.ok || !payload.ok || !payload.data) {
        if (res.status === 400 && isClientSupabaseConfigured()) {
          return await tryDirectClientPull();
        }
        const msg = payload.error || 'Supabase pull failed.';
        markFailure(msg);
        showToast(msg, 'error');
        return false;
      }
      markSuccess();
      if (!payload.data.shop) {
        showToast(
          lang === 'my' ? 'Supabase တွင် ဒေတာမရှိသေးပါ။' : 'No records found in Supabase for this account.',
          'info'
        );
        return false;
      }
      await restoreBackupJson(payload.data);
      return true;
    } catch {
      if (isClientSupabaseConfigured()) {
        return await tryDirectClientPull();
      }
      const msg = lang === 'my' ? 'Supabase မှ ဆွဲယူမှု မအောင်မြင်ပါ။' : 'Supabase pull failed.';
      markFailure(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setSyncingSupabase(false);
    }
  }, [user, activeShopId, restoreBackupJson, integrations.supabaseMode, lang, showToast]);

  const value: PosContextValue = {
    user,
    authReady,
    signingIn,
    isAdmin,
    accessStatus,
    activeLicense,
    activePass,
    activeShopId,
    adminTargetShopId,
    adminTargetShopLabel,
    adminSelectShop,
    redeemAccessPass,
    isCloudMode,
    loadingData,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    integrations,
    cloudHealth,
    refreshCloudHealth,
    toast,
    showToast,
    shop,
    products,
    sales,
    purchases,
    stockLogs,
    debts,
    expenses,
    deliveries,
    loginWithGoogle,
    logout,
    seedCloudWithSampleData,
    updateShopSettings,
    saveProduct,
    deleteProduct,
    createSale,
    deleteSale,
    createPurchase,
    deletePurchase,
    adjustProductStock,
    createDebt,
    recordDebtPayment,
    deleteDebt,
    saveExpense,
    deleteExpense,
    createDelivery,
    updateDeliveryStatus,
    deleteDelivery,
    exportBackupJson,
    restoreBackupJson,
    sendTelegramMessage,
    pushToSupabase,
    pullFromSupabase,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
