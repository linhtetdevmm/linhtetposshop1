import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  KeyRound,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Shield,
  Smartphone,
  Store,
  Trash2,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  createSupabaseAccessPass,
  deleteSupabaseAccessPass,
  fetchSupabaseAdminData,
  updateSupabaseAccessPass,
  updateSupabaseShopProfile,
} from '../../lib/supabaseSync';
import {
  formatExpiryDate,
  formatExpiryDateTime,
  formatRemainingDetailed,
  generateRandomPassCode,
  getRemainingDays,
  normalizePassCode,
  resolveSubscriptionExpiryMs,
  timestampToMs,
} from '../../lib/accessControl';
import {
  clampNumber,
  clampString,
  type AccessPass,
  type NavTab,
  type ShopSettings,
  type UserLicense,
} from '../../types/pos';
import { usePos } from '../../context/PosContext';

interface AdminAccessViewProps {
  onNavigate: (tab: NavTab) => void;
}

interface ShopRow extends ShopSettings {
  id: string;
}

const DURATION_PRESETS = [
  { days: 7, my: '၇ ရက်', en: '7 Days' },
  { days: 30, my: '၁ လ (၃၀ ရက်)', en: '1 Month' },
  { days: 60, my: '၂ လ (၆၀ ရက်)', en: '2 Months' },
  { days: 90, my: '၃ လ (၉၀ ရက်)', en: '3 Months' },
  { days: 180, my: '၆ လ (၁၈၀ ရက်)', en: '6 Months' },
  { days: 365, my: '၁ နှစ် (၃၆၅ ရက်)', en: '1 Year' },
];

const DEFAULT_PUBLIC_APP_URL = 'https://linhtetposshop1.vercel.app';
const SHARE_URL_STORAGE_KEY = 'linpos_share_web_url';

function normalizeShareUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_PUBLIC_APP_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveDefaultShareUrl(): string {
  try {
    const saved = localStorage.getItem(SHARE_URL_STORAGE_KEY);
    if (saved && saved.trim()) return normalizeShareUrl(saved);
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    // Private dev preview / localhost links cannot be opened by customers
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('ais-dev-')
    ) {
      return DEFAULT_PUBLIC_APP_URL;
    }
    return normalizeShareUrl(window.location.origin);
  }
  return DEFAULT_PUBLIC_APP_URL;
}

export const AdminAccessView: React.FC<AdminAccessViewProps> = ({ onNavigate }) => {
  const { user, isAdmin, lang, showToast, adminSelectShop, activeShopId } = usePos();

  const [subTab, setSubTab] = useState<'passes' | 'users'>('passes');
  const [passes, setPasses] = useState<AccessPass[]>([]);
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Generator form state
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [passCode, setPassCode] = useState(() => generateRandomPassCode('LIN'));
  const [shareWebUrl, setShareWebUrl] = useState<string>(() => resolveDefaultShareUrl());
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [customExpiryDate, setCustomExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [maxDevices, setMaxDevices] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  const [lastCreatedPass, setLastCreatedPass] = useState<AccessPass | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  // Edit Pass Modal
  const [editingPass, setEditingPass] = useState<AccessPass | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editMaxDevices, setEditMaxDevices] = useState('1');

  // Edit Shop Profile Modal
  const [editingShop, setEditingShop] = useState<ShopRow | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopSubtitle, setEditShopSubtitle] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopMargin, setEditShopMargin] = useState('25');

  const isSupabaseMode = user?.provider === 'supabase';

  const reloadSupabaseAdmin = async () => {
    const res = await fetchSupabaseAdminData();
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setPasses(res.passes);
      setLicenses(res.licenses);
      setShops(res.shops);
    }
    setLoading(false);
  };

  // Real-time listeners (Firebase) or live loader (Supabase) for Admin only
  useEffect(() => {
    if (!isAdmin || !user) return;
    setLoading(true);

    if (user.provider === 'supabase') {
      let active = true;
      fetchSupabaseAdminData().then((res) => {
        if (!active) return;
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          setPasses(res.passes);
          setLicenses(res.licenses);
          setShops(res.shops);
        }
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    const u1 = onSnapshot(
      collection(db, 'accessPasses'),
      (snap) => {
        const list: AccessPass[] = snap.docs
          .map((d): AccessPass => {
            const p = d.data();
            const expMs = resolveSubscriptionExpiryMs(p);
            return {
              code: String(p.code || d.id),
              label: String(p.label || ''),
              note: String(p.note || ''),
              status: p.status === 'revoked' ? 'revoked' : 'active',
              durationDays: Number(p.durationDays || 30),
              expiresAtMs: expMs,
              subscriptionExpiryMs: timestampToMs(p.subscription_expiry) || expMs,
              maxDevices: Number(p.maxDevices || 1),
              boundDevices: Array.isArray(p.boundDevices) ? p.boundDevices.map(String) : [],
              assignedUid: String(p.assignedUid || ''),
              assignedEmail: String(p.assignedEmail || ''),
              createdBy: String(p.createdBy || ''),
              createdAtMs: timestampToMs(p.createdAt),
              updatedAtMs: timestampToMs(p.updatedAt),
            };
          })
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setPasses(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'accessPasses');
      }
    );

    const u2 = onSnapshot(
      collection(db, 'userLicenses'),
      (snap) => {
        const list: UserLicense[] = snap.docs
          .map((d): UserLicense => {
            const x = d.data();
            const expMs = resolveSubscriptionExpiryMs(x);
            return {
              userId: String(x.userId || d.id),
              email: String(x.email || ''),
              displayName: String(x.displayName || ''),
              passCode: String(x.passCode || ''),
              label: String(x.label || ''),
              status: x.status === 'revoked' ? 'revoked' : 'active',
              expiresAtMs: expMs,
              subscriptionExpiryMs: timestampToMs(x.subscription_expiry) || expMs,
              maxDevices: Number(x.maxDevices || 1),
              createdAtMs: timestampToMs(x.createdAt),
              updatedAtMs: timestampToMs(x.updatedAt),
            };
          })
          .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        setLicenses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'userLicenses')
    );

    const u3 = onSnapshot(
      collection(db, 'shops'),
      (snap) => {
        const list: ShopRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as ShopSettings),
        }));
        setShops(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [isAdmin, user, showToast]);

  const nowMs = Date.now();

  const stats = useMemo(() => {
    const active = passes.filter((p) => p.status === 'active' && p.expiresAtMs > nowMs).length;
    const expired = passes.filter((p) => p.status === 'active' && p.expiresAtMs <= nowMs).length;
    const revoked = passes.filter((p) => p.status === 'revoked').length;
    const claimed = passes.filter((p) => Boolean(p.assignedUid)).length;
    return { total: passes.length, active, expired, revoked, claimed, shops: shops.length };
  }, [passes, shops.length, nowMs]);

  const filteredPasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return passes.filter((p) => {
      const isExpired = p.status === 'active' && p.expiresAtMs <= nowMs;
      if (statusFilter === 'active' && (p.status !== 'active' || isExpired)) return false;
      if (statusFilter === 'expired' && !isExpired) return false;
      if (statusFilter === 'revoked' && p.status !== 'revoked') return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.assignedEmail.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q)
      );
    });
  }, [passes, search, statusFilter, nowMs]);

  const handleShareUrlChange = (next: string) => {
    setShareWebUrl(next);
    try {
      if (next.trim()) {
        localStorage.setItem(SHARE_URL_STORAGE_KEY, next.trim());
      } else {
        localStorage.removeItem(SHARE_URL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const copyText = async (text: string, msgMy: string, msgEn: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showToast(lang === 'my' ? msgMy : msgEn);
        return;
      }
    } catch {
      // Fall through to textarea fallback
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(ta);
      if (copied) {
        showToast(lang === 'my' ? msgMy : msgEn);
        return;
      }
    } catch {
      // Fall through
    }
    showToast(text, 'info');
  };

  const buildShareInvite = (p: AccessPass) => {
    const baseUrl = normalizeShareUrl(shareWebUrl);
    const directUrl = `${baseUrl}/?pass=${encodeURIComponent(p.code)}`;
    const expStr = formatExpiryDate(p.expiresAtMs);
    return [
      `Lin Pos System — Access Pass (${p.label})`,
      `Web Link: ${directUrl}`,
      `Access Pass: ${p.code}`,
      `Valid Until: ${expStr} (${p.maxDevices} Device${p.maxDevices > 1 ? 's' : ''})`,
      isSupabaseMode
        ? `အထက်ပါ Link ကို နှိပ်ပြီး Email + Password ဖြင့် အကောင့်ဝင်/ဖွင့်ကာ Access Pass ကို အတည်ပြုအသုံးပြုနိုင်ပါသည်။`
        : `အထက်ပါ Link ကို နှိပ်ပြီး အကောင့်ဝင်ကာ Access Pass ကို ထည့်သွင်းအသုံးပြုနိုင်ပါသည်။`,
    ].join('\n');
  };

  const shareInvite = async (p: AccessPass) => {
    const text = buildShareInvite(p);
    const baseUrl = normalizeShareUrl(shareWebUrl);
    const directUrl = `${baseUrl}/?pass=${encodeURIComponent(p.code)}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Lin Pos System — ${p.label}`,
          text,
          url: directUrl,
        });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    await copyText(
      text,
      'Viber/Telegram ပို့ရန် ဖိတ်စာ Copy ကူးပြီးပါပြီ။',
      'Invite message copied.'
    );
  };

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    const cleanCode = normalizePassCode(passCode);
    if (cleanCode.length < 6) {
      showToast(
        lang === 'my' ? 'Pass ကုဒ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။' : 'Pass code must be at least 6 chars.',
        'error'
      );
      return;
    }

    let expiresMs: number;
    let calcDays: number;
    if (durationMode === 'custom') {
      const target = new Date(`${customExpiryDate}T23:59:59`);
      expiresMs = target.getTime();
      if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
        showToast(
          lang === 'my' ? 'အနာဂတ်ရက်စွဲတစ်ခုကို ရွေးချယ်ပေးပါ။' : 'Please select a future expiry date.',
          'error'
        );
        return;
      }
      calcDays = Math.max(1, Math.ceil((expiresMs - Date.now()) / (1000 * 60 * 60 * 24)));
    } else {
      calcDays = clampNumber(durationDays, 1, 3650);
      expiresMs = Date.now() + calcDays * 24 * 60 * 60 * 1000;
    }

    setCreating(true);
    try {
      const safeLabel = clampString(label, 120, 'Customer Shop');
      const safeNote = clampString(note, 240);
      const safeMaxDev = clampNumber(maxDevices, 1, 50);

      if (isSupabaseMode) {
        const res = await createSupabaseAccessPass({
          code: cleanCode,
          label: safeLabel,
          note: safeNote,
          durationDays: calcDays,
          expiresAtMs: expiresMs,
          maxDevices: safeMaxDev,
          createdBy: user.uid,
        });
        if (!res.ok) {
          showToast(res.error || 'Supabase error creating pass', 'error');
          return;
        }
        await reloadSupabaseAdmin();
      } else {
        const expiryTs = Timestamp.fromMillis(expiresMs);
        await setDoc(doc(db, 'accessPasses', cleanCode), {
          code: cleanCode,
          label: safeLabel,
          note: safeNote,
          status: 'active',
          durationDays: calcDays,
          expiresAt: expiryTs,
          subscription_expiry: expiryTs,
          maxDevices: safeMaxDev,
          boundDevices: [],
          assignedUid: '',
          assignedEmail: '',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const created: AccessPass = {
        code: cleanCode,
        label: safeLabel,
        note: safeNote,
        status: 'active',
        durationDays: calcDays,
        expiresAtMs: expiresMs,
        maxDevices: safeMaxDev,
        boundDevices: [],
        assignedUid: '',
        assignedEmail: '',
        createdBy: user.uid,
      };
      setLastCreatedPass(created);
      setLabel('');
      setNote('');
      setPassCode(generateRandomPassCode('LIN'));
      showToast(
        lang === 'my'
          ? `Random Pass (${cleanCode}) ထုတ်ပေးပြီးပါပြီ။`
          : `Access Pass ${cleanCode} created.`
      );
    } catch (err) {
      if (isSupabaseMode) {
        showToast(err instanceof Error ? err.message : 'Failed to create pass', 'error');
      } else {
        handleFirestoreError(err, OperationType.CREATE, `accessPasses/${cleanCode}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleExtendPass = async (p: AccessPass, addDays: number) => {
    const baseMs = Math.max(Date.now(), p.expiresAtMs || Date.now());
    const nextMs = baseMs + addDays * 24 * 60 * 60 * 1000;

    if (isSupabaseMode) {
      const linkedLic = p.assignedUid ? licenses.find((l) => l.userId === p.assignedUid) : undefined;
      const res = await updateSupabaseAccessPass(
        p.code,
        {
          status: 'active',
          durationDays: clampNumber((p.durationDays || 30) + addDays, 1, 3650),
          expiresAtMs: nextMs,
        },
        linkedLic ? { userId: p.assignedUid, status: 'active', expiresAtMs: nextMs } : undefined
      );
      if (!res.ok) {
        showToast(res.error || 'Failed to extend pass', 'error');
        return;
      }
      await reloadSupabaseAdmin();
      showToast(
        lang === 'my'
          ? `${p.code} ကို +${addDays} ရက် သက်တမ်းတိုးပြီးပါပြီ။`
          : `Extended ${p.code} by +${addDays} days.`
      );
      return;
    }

    const nextTs = Timestamp.fromMillis(nextMs);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'accessPasses', p.code), {
        status: 'active',
        durationDays: clampNumber((p.durationDays || 30) + addDays, 1, 3650),
        expiresAt: nextTs,
        subscription_expiry: nextTs,
        updatedAt: serverTimestamp(),
      });
      if (p.assignedUid) {
        const linkedLic = licenses.find((l) => l.userId === p.assignedUid);
        if (linkedLic) {
          batch.update(doc(db, 'userLicenses', p.assignedUid), {
            status: 'active',
            expiresAt: nextTs,
            subscription_expiry: nextTs,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      showToast(
        lang === 'my'
          ? `${p.code} ကို +${addDays} ရက် သက်တမ်းတိုးပြီးပါပြီ။`
          : `Extended ${p.code} by +${addDays} days.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessPasses/${p.code}`);
    }
  };

  const handleToggleRevoke = async (p: AccessPass) => {
    const nextStatus = p.status === 'active' ? 'revoked' : 'active';
    if (isSupabaseMode) {
      const linkedLic = p.assignedUid ? licenses.find((l) => l.userId === p.assignedUid) : undefined;
      const res = await updateSupabaseAccessPass(
        p.code,
        { status: nextStatus },
        linkedLic ? { userId: p.assignedUid, status: nextStatus } : undefined
      );
      if (!res.ok) {
        showToast(res.error || 'Failed to update status', 'error');
        return;
      }
      await reloadSupabaseAdmin();
      showToast(
        nextStatus === 'revoked'
          ? lang === 'my'
            ? `${p.code} ကို ဝင်ခွင့်ပိတ်လိုက်ပါပြီ။`
            : `Revoked ${p.code}.`
          : lang === 'my'
          ? `${p.code} ကို ပြန်လည်ဖွင့်ပေးပြီးပါပြီ။`
          : `Re-activated ${p.code}.`,
        nextStatus === 'revoked' ? 'info' : 'success'
      );
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'accessPasses', p.code), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (p.assignedUid) {
        const linkedLic = licenses.find((l) => l.userId === p.assignedUid);
        if (linkedLic) {
          batch.update(doc(db, 'userLicenses', p.assignedUid), {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      showToast(
        nextStatus === 'revoked'
          ? lang === 'my'
            ? `${p.code} ကို ဝင်ခွင့်ပိတ်လိုက်ပါပြီ။`
            : `Revoked ${p.code}.`
          : lang === 'my'
          ? `${p.code} ကို ပြန်လည်ဖွင့်ပေးပြီးပါပြီ။`
          : `Re-activated ${p.code}.`,
        nextStatus === 'revoked' ? 'info' : 'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessPasses/${p.code}`);
    }
  };

  const handleResetDevices = async (p: AccessPass) => {
    if (isSupabaseMode) {
      const res = await updateSupabaseAccessPass(p.code, { boundDevices: [] });
      if (!res.ok) {
        showToast(res.error || 'Failed to reset devices', 'error');
        return;
      }
      await reloadSupabaseAdmin();
      showToast(
        lang === 'my'
          ? `${p.code} ၏ စက်ကန့်သတ်ချက်ကို Reset လုပ်ပြီးပါပြီ။`
          : `Cleared bound devices for ${p.code}.`
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'accessPasses', p.code), {
        boundDevices: [],
        updatedAt: serverTimestamp(),
      });
      showToast(
        lang === 'my'
          ? `${p.code} ၏ စက်ကန့်သတ်ချက်ကို Reset လုပ်ပြီးပါပြီ။`
          : `Cleared bound devices for ${p.code}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessPasses/${p.code}`);
    }
  };

  const handleUnassignUser = async (p: AccessPass) => {
    if (isSupabaseMode) {
      const linkedLic = p.assignedUid ? licenses.find((l) => l.userId === p.assignedUid) : undefined;
      const res = await updateSupabaseAccessPass(
        p.code,
        { assignedUid: '', assignedEmail: '', boundDevices: [] },
        linkedLic && linkedLic.passCode === p.code
          ? { userId: p.assignedUid, status: 'revoked' }
          : undefined
      );
      if (!res.ok) {
        showToast(res.error || 'Failed to unassign user', 'error');
        return;
      }
      await reloadSupabaseAdmin();
      showToast(
        lang === 'my'
          ? `${p.code} မှ အကောင့်ချိတ်ဆက်မှုကို ဖြုတ်လိုက်ပါပြီ။`
          : `Unassigned account from ${p.code}.`,
        'info'
      );
      return;
    }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'accessPasses', p.code), {
        assignedUid: '',
        assignedEmail: '',
        boundDevices: [],
        updatedAt: serverTimestamp(),
      });
      if (p.assignedUid) {
        const linkedLic = licenses.find((l) => l.userId === p.assignedUid);
        if (linkedLic && linkedLic.passCode === p.code) {
          batch.update(doc(db, 'userLicenses', p.assignedUid), {
            status: 'revoked',
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      showToast(
        lang === 'my'
          ? `${p.code} မှ Gmail ချိတ်ဆက်မှုကို ဖြုတ်လိုက်ပါပြီ။`
          : `Unassigned Gmail from ${p.code}.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessPasses/${p.code}`);
    }
  };

  const handleDeletePass = async (p: AccessPass) => {
    if (isSupabaseMode) {
      const res = await deleteSupabaseAccessPass(p.code, p.assignedUid || undefined);
      if (!res.ok) {
        showToast(res.error || 'Failed to delete pass', 'error');
        return;
      }
      await reloadSupabaseAdmin();
      showToast(
        lang === 'my' ? `${p.code} ကို ဖျက်လိုက်ပါပြီ။` : `Deleted pass ${p.code}.`,
        'info'
      );
      return;
    }
    try {
      if (p.assignedUid) {
        const linkedLic = licenses.find((l) => l.userId === p.assignedUid);
        if (linkedLic && linkedLic.passCode === p.code) {
          await updateDoc(doc(db, 'userLicenses', p.assignedUid), {
            status: 'revoked',
            updatedAt: serverTimestamp(),
          });
        }
      }
      await deleteDoc(doc(db, 'accessPasses', p.code));
      showToast(
        lang === 'my' ? `${p.code} ကို ဖျက်လိုက်ပါပြီ။` : `Deleted pass ${p.code}.`,
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `accessPasses/${p.code}`);
    }
  };

  const openEditPass = (p: AccessPass) => {
    setEditingPass(p);
    setEditLabel(p.label);
    setEditNote(p.note);
    setEditExpiryDate(formatExpiryDate(p.expiresAtMs));
    setEditMaxDevices(String(p.maxDevices));
  };

  const handleSaveEditPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPass) return;
    const nextMs = new Date(`${editExpiryDate}T23:59:59`).getTime();
    if (!Number.isFinite(nextMs)) return;
    const nextMaxDev = clampNumber(Number(editMaxDevices), 1, 50);
    const nextLabel = clampString(editLabel, 120, editingPass.label);
    const nextNote = clampString(editNote, 240);

    if (isSupabaseMode) {
      const linkedLic = editingPass.assignedUid
        ? licenses.find((l) => l.userId === editingPass.assignedUid)
        : undefined;
      const res = await updateSupabaseAccessPass(
        editingPass.code,
        { label: nextLabel, note: nextNote, expiresAtMs: nextMs, maxDevices: nextMaxDev },
        linkedLic
          ? {
              userId: editingPass.assignedUid,
              label: nextLabel,
              expiresAtMs: nextMs,
              maxDevices: nextMaxDev,
            }
          : undefined
      );
      if (!res.ok) {
        showToast(res.error || 'Failed to update pass', 'error');
        return;
      }
      setEditingPass(null);
      await reloadSupabaseAdmin();
      showToast(lang === 'my' ? 'Pass အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။' : 'Access Pass updated.');
      return;
    }

    const nextTs = Timestamp.fromMillis(nextMs);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'accessPasses', editingPass.code), {
        label: nextLabel,
        note: nextNote,
        expiresAt: nextTs,
        subscription_expiry: nextTs,
        maxDevices: nextMaxDev,
        updatedAt: serverTimestamp(),
      });
      if (editingPass.assignedUid) {
        const linkedLic = licenses.find((l) => l.userId === editingPass.assignedUid);
        if (linkedLic) {
          batch.update(doc(db, 'userLicenses', editingPass.assignedUid), {
            label: nextLabel,
            expiresAt: nextTs,
            subscription_expiry: nextTs,
            maxDevices: nextMaxDev,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      setEditingPass(null);
      showToast(lang === 'my' ? 'Pass အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။' : 'Access Pass updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessPasses/${editingPass.code}`);
    }
  };

  const openEditShop = (s: ShopRow) => {
    setEditingShop(s);
    setEditShopName(s.shopName || '');
    setEditShopSubtitle(s.shopSubtitle || '');
    setEditShopPhone(s.phone || '');
    setEditShopAddress(s.address || '');
    setEditShopMargin(String(s.defaultMarginPercent ?? 25));
  };

  const handleSaveEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    if (isSupabaseMode) {
      const res = await updateSupabaseShopProfile(editingShop.id, {
        shopName: clampString(editShopName, 120, editingShop.shopName),
        shopSubtitle: clampString(editShopSubtitle, 160),
        phone: clampString(editShopPhone, 40),
        address: clampString(editShopAddress, 240),
        defaultMarginPercent: clampNumber(Number(editShopMargin), 0, 1000),
      });
      if (!res.ok) {
        showToast(res.error || 'Failed to update shop', 'error');
        return;
      }
      setEditingShop(null);
      await reloadSupabaseAdmin();
      showToast(
        lang === 'my' ? 'ဆိုင်အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။' : 'Shop profile updated by Admin.'
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'shops', editingShop.id), {
        shopName: clampString(editShopName, 120, editingShop.shopName),
        shopSubtitle: clampString(editShopSubtitle, 160),
        phone: clampString(editShopPhone, 40),
        address: clampString(editShopAddress, 240),
        defaultMarginPercent: clampNumber(Number(editShopMargin), 0, 1000),
        updatedAt: serverTimestamp(),
      });
      setEditingShop(null);
      showToast(
        lang === 'my' ? 'ဆိုင်အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။' : 'Shop profile updated by Admin.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${editingShop.id}`);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-sm text-titanium-500">
        {lang === 'my' ? 'Admin ဝင်ခွင့် မရှိပါ။' : 'Administrator access required.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-burgundy-50 dark:bg-burgundy-950 border border-burgundy-200 dark:border-burgundy-900 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-burgundy-700 dark:text-burgundy-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-titanium-900 dark:text-titanium-50">
              {lang === 'my'
                ? 'Admin အပြည့်အဝ ထိန်းချုပ်မှုစင်တာ (Access & Shops)'
                : 'Super Admin Control Center'}
            </h2>
            <p className="text-xs text-titanium-500 dark:text-titanium-400 mt-0.5 leading-relaxed">
              {lang === 'my'
                ? 'Random Pass ထုတ်ပေးခြင်း၊ သက်တမ်း (၁ လ / ၂ လ / စိတ်ကြိုက်ရက်) သတ်မှတ်ခြင်း၊ စက်ကန့်သတ်ခြင်း၊ ဝင်ခွင့်ပိတ်ခြင်း နှင့် Gmail အသုံးပြုသူအားလုံး၏ ဆိုင်ဒေတာများကို အပြည့်အဝ ပြင်ဆင်စီမံနိုင်ပါသည်။'
                : 'Generate time-limited random passes, control device limits, revoke/extend access in real time, and inspect or edit any registered user shop.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isSupabaseMode && (
            <button
              type="button"
              onClick={reloadSupabaseAdmin}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === 'my' ? 'ပြန်စစ်မည်' : 'Refresh'}
            </button>
          )}
          <div className="text-xs font-mono-num text-burgundy-800 dark:text-burgundy-300 bg-burgundy-50 dark:bg-burgundy-950/70 border border-burgundy-200 dark:border-burgundy-900 px-3 py-1.5 rounded-lg">
            Admin ({isSupabaseMode ? 'Supabase' : 'Firebase'}): {user?.email}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-4">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {lang === 'my' ? 'စုစုပေါင်း Pass များ' : 'Total Passes'}
          </div>
          <div className="text-2xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50 mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-4">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {lang === 'my' ? 'သက်တမ်းရှိ Active Pass' : 'Active Passes'}
          </div>
          <div className="text-2xl font-bold font-mono-num text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.active}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-4">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {lang === 'my' ? 'ချိတ်ဆက်ထားသော Gmail များ' : 'Claimed Gmail Users'}
          </div>
          <div className="text-2xl font-bold font-mono-num text-burgundy-800 dark:text-burgundy-300 mt-1">
            {stats.claimed}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-4">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">
            {lang === 'my' ? 'စာရင်းသွင်း ဆိုင်အားလုံး' : 'Registered Shops'}
          </div>
          <div className="text-2xl font-bold font-mono-num text-titanium-900 dark:text-titanium-50 mt-1">
            {stats.shops}
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
        <button
          type="button"
          onClick={() => setSubTab('passes')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'passes'
              ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
              : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          {lang === 'my' ? `Random Pass များ (${passes.length})` : `Access Passes (${passes.length})`}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            subTab === 'users'
              ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
              : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          {lang === 'my'
            ? `Gmail အသုံးပြုသူနှင့် ဆိုင်များ (${shops.length})`
            : `Gmail Users & Shops (${shops.length})`}
        </button>
      </div>

      {/* TAB 1: RANDOM PASS GENERATOR & MANAGEMENT */}
      {subTab === 'passes' && (
        <div className="space-y-6">
          {/* Create Pass Form */}
          <form
            onSubmit={handleCreatePass}
            className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {lang === 'my' ? 'Random Access Pass အသစ် ထုတ်ပေးမည်' : 'Generate New Random Access Pass'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'အသုံးပြုသူ / ဆိုင်အမည် *' : 'Customer / Shop Name *'}
                </label>
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={lang === 'my' ? 'ဥပမာ - ရွှေစင်ဖုန်းဆိုင်' : 'e.g. Golden Mobile Shop'}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'Random Pass ကုဒ် (ပြင်နိုင်/အသစ်ထုတ်နိုင်)' : 'Random Pass Code'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    required
                    value={passCode}
                    onChange={(e) => setPassCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 text-xs font-mono-num uppercase bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                  <button
                    type="button"
                    onClick={() => setPassCode(generateRandomPassCode('LIN'))}
                    className="px-2.5 py-2 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg text-titanium-700 dark:text-titanium-200 transition-colors"
                    title={lang === 'my' ? 'Random အသစ်ထုတ်မည်' : 'Regenerate Random Code'}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'စက်အရေအတွက် ကန့်သတ်ချက်' : 'Max Devices Allowed'}
                </label>
                <select
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                >
                  <option value={1}>1 Device ({lang === 'my' ? '၁ လုံးတည်း' : 'Strict Lock'})</option>
                  <option value={2}>2 Devices ({lang === 'my' ? '၂ လုံး' : 'Phone + PC'})</option>
                  <option value={3}>3 Devices ({lang === 'my' ? '၃ လုံး' : 'Small Team'})</option>
                  <option value={5}>5 Devices ({lang === 'my' ? '၅ လုံး' : 'Multi-Counter'})</option>
                  <option value={10}>10 Devices</option>
                  <option value={50}>50 Devices ({lang === 'my' ? 'အများအပြား' : 'Wide Access'})</option>
                </select>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-titanium-600 dark:text-titanium-400">
                  {lang === 'my' ? 'သက်တမ်း သတ်မှတ်ချက်' : 'Access Duration'}
                </label>
                <div className="inline-flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDurationMode('preset')}
                    className={`px-2 py-0.5 rounded ${
                      durationMode === 'preset'
                        ? 'bg-burgundy-700 text-white'
                        : 'bg-titanium-100 dark:bg-titanium-800 text-titanium-600 dark:text-titanium-300'
                    }`}
                  >
                    {lang === 'my' ? 'အမြန်ရွေးမည်' : 'Presets'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('custom')}
                    className={`px-2 py-0.5 rounded ${
                      durationMode === 'custom'
                        ? 'bg-burgundy-700 text-white'
                        : 'bg-titanium-100 dark:bg-titanium-800 text-titanium-600 dark:text-titanium-300'
                    }`}
                  >
                    {lang === 'my' ? 'ရက်စွဲစိတ်ကြိုက်ရွေးမည်' : 'Custom Date'}
                  </button>
                </div>
              </div>

              {durationMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setDurationDays(preset.days)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        durationDays === preset.days
                          ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white border-burgundy-700 dark:border-burgundy-600'
                          : 'bg-titanium-50 dark:bg-titanium-950 text-titanium-700 dark:text-titanium-300 border-titanium-200 dark:border-titanium-700 hover:border-burgundy-400'
                      }`}
                    >
                      {lang === 'my' ? preset.my : preset.en}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="date"
                  required
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  className="px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'မှတ်ချက် (ဖုန်းနံပါတ် / ငွေရှင်းမှတ်တမ်း)' : 'Note (Phone / Payment ref)'}
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={lang === 'my' ? 'ဥပမာ - 09-xxxx / ၁ လစာ ရှင်းပြီး' : 'Optional note'}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4" />
                {creating
                  ? '...'
                  : lang === 'my'
                  ? 'Random Pass ထုတ်ပေးမည်'
                  : 'Create Random Pass'}
              </button>
            </div>

            {/* Public Share URL Configuration */}
            <div className="p-3 rounded-xl bg-titanium-50 dark:bg-titanium-950 border border-titanium-200/80 dark:border-titanium-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-300">
                  <Link2 className="w-3.5 h-3.5 text-burgundy-700 dark:text-burgundy-300" />
                  {lang === 'my'
                    ? 'Customer ထံ Share ပေးမည့် Public Web Link'
                    : 'Public Share Web Link (Used in Invites)'}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShareUrlChange(DEFAULT_PUBLIC_APP_URL)}
                    className="px-2 py-0.5 text-[11px] font-medium rounded bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:border-burgundy-500"
                  >
                    Vercel Live
                  </button>
                  {typeof window !== 'undefined' &&
                    window.location.hostname.toLowerCase().startsWith('ais-dev-') && (
                      <button
                        type="button"
                        onClick={() =>
                          handleShareUrlChange(
                            window.location.origin.replace('https://ais-dev-', 'https://ais-pre-')
                          )
                        }
                        className="px-2 py-0.5 text-[11px] font-medium rounded bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:border-burgundy-500"
                      >
                        AI Studio Shared
                      </button>
                    )}
                </div>
              </div>
              <input
                type="url"
                value={shareWebUrl}
                onChange={(e) => handleShareUrlChange(e.target.value)}
                placeholder={DEFAULT_PUBLIC_APP_URL}
                className="w-full px-3 py-1.5 text-xs font-mono-num bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
              <p className="text-[11px] text-titanium-500 dark:text-titanium-400">
                {lang === 'my'
                  ? 'AI Studio Preview (ais-dev) Link သည် ပြင်ပဖုန်းများမှ ဝင်၍မရသောကြောင့် Customer များထံ ပို့သည့်အခါ Public Vercel Link (သို့) Shared App URL ကို အလိုအလျောက် ထည့်သွင်းပေးထားပါသည်။'
                  : 'Private preview (ais-dev) links do not work for customers, so invites automatically use your public production URL.'}
              </p>
            </div>

            {/* Instant Copy Bar for Newly Generated Pass */}
            {lastCreatedPass && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {lang === 'my' ? 'Pass အသစ် အဆင်သင့်ဖြစ်ပါပြီ:' : 'New Pass Ready:'}{' '}
                    <span className="font-mono-num">{lastCreatedPass.code}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {lastCreatedPass.label} · {lang === 'my' ? 'သက်တမ်းကုန်ရက်' : 'Expires'}:{' '}
                    {formatExpiryDate(lastCreatedPass.expiresAtMs)} · {lastCreatedPass.maxDevices} Device(s)
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        lastCreatedPass.code,
                        'Pass ကုဒ် Copy ကူးပြီးပါပြီ။',
                        'Pass code copied.'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-titanium-900 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {lang === 'my' ? 'ကုဒ်ကူးမည်' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        buildShareInvite(lastCreatedPass),
                        'Viber/Telegram ပို့ရန် စာသား Copy ကူးပြီးပါပြီ။',
                        'Full invite message copied.'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {lang === 'my' ? 'ဖိတ်စာအပြည့် Copy' : 'Copy Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => shareInvite(lastCreatedPass)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-burgundy-700 hover:bg-burgundy-800 text-white rounded-lg"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {lang === 'my' ? 'Share' : 'Share'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Search & Status Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  lang === 'my'
                    ? 'Pass ကုဒ်၊ ဆိုင်အမည် သို့မဟုတ် Gmail ဖြင့် ရှာမည်...'
                    : 'Search by pass code, label, or Gmail...'
                }
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-lg focus:outline-none focus:border-burgundy-600"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', lang === 'my' ? 'အားလုံး' : 'All'],
                  ['active', lang === 'my' ? 'Active' : 'Active'],
                  ['expired', lang === 'my' ? 'သက်တမ်းကုန်' : 'Expired'],
                  ['revoked', lang === 'my' ? 'ပိတ်ထား' : 'Revoked'],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    statusFilter === id
                      ? 'bg-burgundy-700 text-white border-burgundy-700'
                      : 'bg-white dark:bg-titanium-900 text-titanium-600 dark:text-titanium-300 border-titanium-200 dark:border-titanium-800'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Passes Table / List */}
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-titanium-500">
                {lang === 'my' ? 'ဒေတာဖတ်နေပါသည်...' : 'Loading access passes...'}
              </div>
            ) : filteredPasses.length === 0 ? (
              <div className="p-8 text-center text-xs text-titanium-500">
                {lang === 'my'
                  ? 'Pass မရှိသေးပါ။ အပေါ်တွင် Random Pass အသစ်ထုတ်ပေးနိုင်ပါသည်။'
                  : 'No access passes yet. Generate one above.'}
              </div>
            ) : (
              <div className="divide-y divide-titanium-100 dark:divide-titanium-800">
                {filteredPasses.map((p) => {
                  const isExpired = p.status === 'active' && p.expiresAtMs <= nowMs;
                  const remDays = getRemainingDays(p.expiresAtMs, nowMs);
                  return (
                    <div
                      key={p.code}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-titanium-50/70 dark:hover:bg-titanium-800/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(p.code, 'Pass ကုဒ် Copy ကူးပြီးပါပြီ။', 'Pass code copied.')
                            }
                            className="inline-flex items-center gap-1.5 font-mono-num text-sm font-bold text-burgundy-800 dark:text-burgundy-300 hover:underline"
                          >
                            {p.code}
                            <Copy className="w-3.5 h-3.5 opacity-70" />
                          </button>

                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              p.status === 'revoked'
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                : isExpired
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {p.status === 'revoked'
                              ? lang === 'my'
                                ? 'ပိတ်ထားသည်'
                                : 'Revoked'
                              : isExpired
                              ? lang === 'my'
                                ? 'သက်တမ်းကုန်'
                                : 'Expired'
                              : lang === 'my'
                              ? `Active (${formatRemainingDetailed(p.expiresAtMs, lang, nowMs, true)})`
                              : `Active (${formatRemainingDetailed(p.expiresAtMs, lang, nowMs, true)})`}
                          </span>

                          <span className="text-xs font-semibold text-titanium-900 dark:text-titanium-50">
                            {p.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-titanium-500 dark:text-titanium-400">
                          <span className="font-mono-num">
                            {lang === 'my' ? 'ကုန်ဆုံးချိန်' : 'Expires'}:{' '}
                            <strong className="text-titanium-700 dark:text-titanium-200">
                              {formatExpiryDateTime(p.expiresAtMs)}
                            </strong>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono-num">
                            <Smartphone className="w-3.5 h-3.5" />
                            {p.boundDevices.length} / {p.maxDevices}{' '}
                            {lang === 'my' ? 'စက်' : 'devices'}
                          </span>
                          <span>
                            Gmail:{' '}
                            <strong className="text-titanium-700 dark:text-titanium-200">
                              {p.assignedEmail || (lang === 'my' ? 'မဝင်ရသေး' : 'Unclaimed')}
                            </strong>
                          </span>
                          {p.note && <span className="truncate max-w-xs">· {p.note}</span>}
                        </div>
                      </div>

                      {/* Admin Action Controls */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => shareInvite(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 text-titanium-700 dark:text-titanium-200 rounded-lg"
                        >
                          <Share2 className="w-3 h-3" />
                          {lang === 'my' ? 'ဖိတ်စာ Share' : 'Share'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExtendPass(p, 30)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/70"
                          title={lang === 'my' ? '၁ လ တိုးမည်' : 'Extend 30 days'}
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          +30d
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExtendPass(p, 60)}
                          className="px-2.5 py-1.5 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/70"
                          title={lang === 'my' ? '၂ လ တိုးမည်' : 'Extend 60 days'}
                        >
                          +60d
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPass(p)}
                          className="p-1.5 text-titanium-600 dark:text-titanium-300 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg"
                          title={lang === 'my' ? 'ပြင်ဆင်မည်' : 'Edit Pass'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {p.boundDevices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleResetDevices(p)}
                            className="p-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg"
                            title={lang === 'my' ? 'Device Reset လုပ်မည်' : 'Reset Bound Devices'}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.assignedUid && (
                          <button
                            type="button"
                            onClick={() => handleUnassignUser(p)}
                            className="p-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg"
                            title={lang === 'my' ? 'Gmail ချိတ်ဆက်မှု ဖြုတ်မည်' : 'Unassign Gmail'}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleRevoke(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border ${
                            p.status === 'active'
                              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 hover:bg-red-100'
                              : 'bg-burgundy-50 dark:bg-burgundy-950/50 text-burgundy-800 dark:text-burgundy-200 border-burgundy-200 dark:border-burgundy-800'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {p.status === 'active'
                            ? lang === 'my'
                              ? 'ပိတ်မည်'
                              : 'Revoke'
                            : lang === 'my'
                            ? 'ပြန်ဖွင့်မည်'
                            : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePass(p)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                          title={lang === 'my' ? 'ဖျက်မည်' : 'Delete Pass'}
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
        </div>
      )}

      {/* TAB 2: REGISTERED GMAIL USERS & ALL SHOPS CONTROL */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-titanium-100 dark:border-titanium-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 flex items-center gap-2">
                <Store className="w-4 h-4 text-burgundy-700 dark:text-burgundy-300" />
                {lang === 'my'
                  ? 'Firebase ရှိ ဆိုင်များနှင့် Gmail အသုံးပြုသူအားလုံး'
                  : 'All Registered Shops & Licensed Gmail Accounts'}
              </h3>
            </div>

            {shops.length === 0 && licenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-titanium-500">
                {lang === 'my' ? 'ဆိုင်ဒေတာ မရှိသေးပါ။' : 'No registered shops yet.'}
              </div>
            ) : (
              <div className="divide-y divide-titanium-100 dark:divide-titanium-800">
                {shops.map((s) => {
                  const lic = licenses.find((l) => l.userId === s.id);
                  const isOwnAdminShop = s.id === user?.uid;
                  const isCurrentlyViewing = activeShopId === s.id;
                  const remDays = lic ? getRemainingDays(lic.expiresAtMs, nowMs) : 0;

                  return (
                    <div
                      key={s.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-titanium-50/70 dark:hover:bg-titanium-800/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-titanium-900 dark:text-titanium-50">
                            {s.shopName}
                          </span>
                          {isOwnAdminShop && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-burgundy-100 dark:bg-burgundy-950 text-burgundy-800 dark:text-burgundy-300">
                              Admin Shop
                            </span>
                          )}
                          {isCurrentlyViewing && !isOwnAdminShop && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {lang === 'my' ? 'လက်ရှိဖွင့်ထားသည်' : 'Currently Open'}
                            </span>
                          )}
                          {lic && (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                lic.status === 'revoked'
                                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                  : remDays <= 0
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {lic.status === 'revoked'
                                ? 'Revoked'
                                : remDays <= 0
                                ? 'Expired'
                                : `${formatRemainingDetailed(lic.expiresAtMs, lang, nowMs, true)} · ${formatExpiryDateTime(lic.expiresAtMs)}`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-titanium-500 dark:text-titanium-400">
                          <span>
                            Gmail:{' '}
                            <strong className="text-titanium-700 dark:text-titanium-200">
                              {isOwnAdminShop ? user?.email : lic?.email || s.id}
                            </strong>
                          </span>
                          {lic?.passCode && (
                            <span className="font-mono-num">Pass: {lic.passCode}</span>
                          )}
                          {s.phone && <span className="font-mono-num">Tel: {s.phone}</span>}
                          <span className="font-mono-num">
                            Margin: {s.defaultMarginPercent}%
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditShop(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 text-titanium-800 dark:text-titanium-200 rounded-lg"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {lang === 'my' ? 'ဆိုင်အချက်အလက်ပြင်မည်' : 'Edit Profile'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isOwnAdminShop) {
                              adminSelectShop(null, '');
                            } else {
                              adminSelectShop(s.id, `${s.shopName}${lic?.email ? ` (${lic.email})` : ''}`);
                            }
                            onNavigate('dashboard');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isOwnAdminShop
                            ? lang === 'my'
                              ? 'Admin ဆိုင်ဖွင့်မည်'
                              : 'Open Admin Shop'
                            : lang === 'my'
                            ? 'ဆိုင်ဒေတာ အကုန်ဝင်ပြင်မည်'
                            : 'Manage Full Shop'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Pass Modal */}
      {editingPass && (
        <div className="fixed inset-0 z-50 bg-titanium-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditPass}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-titanium-900 dark:text-titanium-50">
                {lang === 'my' ? 'Access Pass ပြင်ဆင်မည်' : 'Edit Access Pass'} ({editingPass.code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingPass(null)}
                className="p-1 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'အသုံးပြုသူ / ဆိုင်အမည်' : 'Customer / Shop Name'}
                </label>
                <input
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                    {lang === 'my' ? 'သက်တမ်းကုန်ရက်' : 'Expiry Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                    {lang === 'my' ? 'စက်အရေအတွက်' : 'Max Devices'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={editMaxDevices}
                    onChange={(e) => setEditMaxDevices(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'မှတ်ချက်' : 'Note'}
                </label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPass(null)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 bg-titanium-100 dark:bg-titanium-800 rounded-lg"
              >
                {lang === 'my' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 rounded-lg"
              >
                {lang === 'my' ? 'သိမ်းမည်' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Shop Profile Modal */}
      {editingShop && (
        <div className="fixed inset-0 z-50 bg-titanium-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditShop}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-titanium-900 dark:text-titanium-50">
                {lang === 'my' ? 'ဆိုင်အချက်အလက် ပြင်ဆင်မည် (Admin)' : 'Edit Shop Profile (Admin)'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                className="p-1 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'ဆိုင်အမည်' : 'Shop Name'}
                </label>
                <input
                  required
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'စာတန်းခွဲ' : 'Subtitle'}
                </label>
                <input
                  value={editShopSubtitle}
                  onChange={(e) => setEditShopSubtitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                    {lang === 'my' ? 'ဖုန်းနံပါတ်' : 'Phone'}
                  </label>
                  <input
                    value={editShopPhone}
                    onChange={(e) => setEditShopPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                    {lang === 'my' ? 'အမြတ် (%)' : 'Default Margin (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={editShopMargin}
                    onChange={(e) => setEditShopMargin(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-titanium-600 dark:text-titanium-400 mb-1">
                  {lang === 'my' ? 'လိပ်စာ' : 'Address'}
                </label>
                <input
                  value={editShopAddress}
                  onChange={(e) => setEditShopAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 bg-titanium-100 dark:bg-titanium-800 rounded-lg"
              >
                {lang === 'my' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 rounded-lg"
              >
                {lang === 'my' ? 'သိမ်းမည်' : 'Save Shop'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
