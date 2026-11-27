import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import type { NavTab, Sale } from './types/pos';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PosProvider, usePos } from './context/PosContext';
import { useT } from './i18n/translations';
import {
  formatExpiryDate,
  formatExpiryDateTime,
  formatRemainingDetailed,
} from './lib/accessControl';
import {
  getLowStockProducts,
  loadStockThreshold,
  saveStockThreshold,
} from './lib/stockAlerts';
import { VoucherModal } from './components/VoucherModal';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
import { LowStockNotification } from './components/LowStockNotification';
import { SubscriptionBadge } from './components/SubscriptionBadge';
import { AccessGateScreen } from './components/AccessGateScreen';
import { DashboardView } from './components/views/DashboardView';
import { PosSalesView } from './components/views/PosSalesView';
import { ProductsView } from './components/views/ProductsView';
import { PurchasesView } from './components/views/PurchasesView';
import { StockView } from './components/views/StockView';
import { DebtsView } from './components/views/DebtsView';
import { ExpensesView } from './components/views/ExpensesView';
import { DeliveryView } from './components/views/DeliveryView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsSyncView } from './components/views/SettingsSyncView';
import { AdminAccessView } from './components/views/AdminAccessView';

function PosShell() {
  const {
    shop,
    products,
    activeShopId,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    user,
    signingIn,
    isAdmin,
    accessStatus,
    subscriptionExpiry,
    isSubscriptionExpired,
    subscriptionDaysRemaining,
    adminTargetShopId,
    adminTargetShopLabel,
    adminSelectShop,
    isCloudMode,
    supabaseAuthReady,
    loginWithGoogle,
    logout,
    toast,
  } = usePos();
  const t = useT(lang);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'profile' | 'cloud' | 'guide'>('profile');
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shwepos_sidebar_expanded') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voucherSale, setVoucherSale] = useState<Sale | null>(null);
  const [customStockThreshold, setCustomStockThreshold] = useState<number | null>(() =>
    loadStockThreshold(activeShopId)
  );
  const [stockLowOnlyKey, setStockLowOnlyKey] = useState(0);

  useEffect(() => {
    setCustomStockThreshold(loadStockThreshold(activeShopId));
  }, [activeShopId]);

  const handleChangeStockThreshold = (next: number | null) => {
    setCustomStockThreshold(next);
    saveStockThreshold(activeShopId, next);
  };

  const lowStockProducts = useMemo(
    () => getLowStockProducts(products, customStockThreshold),
    [products, customStockThreshold]
  );
  const lowStockCount = lowStockProducts.length;
  const hasOutOfStock = useMemo(
    () => lowStockProducts.some((p) => p.stock <= 0),
    [lowStockProducts]
  );

  const handleOpenLowStockView = () => {
    setStockLowOnlyKey((k) => k + 1);
    setActiveTab('stock');
    setMobileMenuOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('shwepos_sidebar_expanded', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Strict Access Gate: unauthorized or expired subscriptions cannot enter the POS shell
  if (accessStatus !== 'granted' || isSubscriptionExpired) {
    return <AccessGateScreen />;
  }

  const navItems: {
    id: NavTab;
    label: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'dashboard', label: t('navDashboard'), Icon: LayoutDashboard },
    { id: 'pos', label: t('navPos'), Icon: ShoppingCart },
    { id: 'products', label: t('navProducts'), Icon: Package },
    { id: 'purchases', label: t('navPurchases'), Icon: ShoppingBag },
    { id: 'stock', label: t('navStock'), Icon: Boxes },
    { id: 'debts', label: t('navDebts'), Icon: Wallet },
    { id: 'expenses', label: t('navExpenses'), Icon: ReceiptText },
    { id: 'delivery', label: t('navDelivery'), Icon: Truck },
    { id: 'reports', label: t('navReports'), Icon: TrendingUp },
    { id: 'settings', label: isAdmin ? t('navSettings') : t('shopProfileTab'), Icon: Settings },
    ...(isAdmin
      ? [
          {
            id: 'admin' as NavTab,
            label: lang === 'my' ? 'Admin ဝင်ခွင့်စီမံမှု' : 'Admin Access',
            Icon: ShieldCheck,
          },
        ]
      : []),
  ];

  const currentNav = navItems.find((n) => n.id === activeTab) || navItems[0];
  const remainingDays = subscriptionDaysRemaining;

  const handleSelectNav = (id: NavTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-titanium-50 dark:bg-titanium-950 text-titanium-900 dark:text-titanium-50">
      {/* Desktop Collapsible Sidebar: Deep Royal Blue Architecture */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:shrink-0 bg-gradient-to-b from-burgundy-900 via-burgundy-900 to-burgundy-950 dark:from-titanium-900 dark:via-titanium-950 dark:to-burgundy-950 text-white border-r border-burgundy-800/80 dark:border-titanium-800 sticky top-0 h-screen transition-all duration-200 shadow-lg shadow-burgundy-950/15 ${
          sidebarExpanded ? 'lg:w-64' : 'lg:w-[70px]'
        }`}
      >
        {/* Top Header & Toggle Button */}
        <div
          className={`h-16 flex items-center border-b border-white/12 dark:border-titanium-800 ${
            sidebarExpanded ? 'px-4 justify-between gap-2' : 'px-2 justify-center'
          }`}
        >
          {sidebarExpanded && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white dark:text-burgundy-200 truncate">
                {shop.shopName}
              </div>
              <div
                className={`text-[11px] truncate ${
                  !isAdmin && remainingDays !== null && remainingDays <= 5
                    ? 'text-amber-300 font-medium'
                    : 'text-burgundy-200/90 dark:text-titanium-400'
                }`}
              >
                {isAdmin
                  ? 'Super Admin · MMK'
                  : remainingDays !== null && subscriptionExpiry
                  ? `${formatRemainingDetailed(subscriptionExpiry, lang, Date.now(), true)} · ${formatExpiryDate(subscriptionExpiry)}`
                  : isCloudMode
                  ? `${t('cloudSynced')} · MMK`
                  : `${t('localDemoMode')} · MMK`}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            title={
              sidebarExpanded
                ? lang === 'my'
                  ? 'ဘေးဘား ကျုံ့မည် (အိုင်ကွန်သာပြ)'
                  : 'Collapse sidebar (Icon rail)'
                : lang === 'my'
                ? 'ဘေးဘား ချဲ့မည် (စာသားများပြ)'
                : 'Expand sidebar (Show labels)'
            }
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarExpanded}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-burgundy-100 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-titanium-900/80 dark:hover:bg-burgundy-900/70 border border-white/15 dark:border-titanium-700 transition-colors shrink-0"
          >
            {sidebarExpanded ? (
              <PanelLeftClose className="w-4 h-4" strokeWidth={1.85} />
            ) : (
              <PanelLeftOpen className="w-4 h-4" strokeWidth={1.85} />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 overflow-y-auto py-3.5 space-y-1.5 ${sidebarExpanded ? 'px-3' : 'px-2.5'}`}>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const IconComp = item.Icon;
            const showStockBadge = item.id === 'stock' && lowStockCount > 0;
            const badgeText = lowStockCount > 99 ? '99+' : String(lowStockCount);
            const badgeTone = hasOutOfStock
              ? 'bg-red-500 text-white border-red-400'
              : 'bg-amber-400 text-titanium-950 border-amber-300';
            const stockTitle = showStockBadge
              ? `${item.label} (${lowStockCount} ${lang === 'my' ? 'မျိုး လက်ကျန်နည်း' : 'low stock'})`
              : item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                title={stockTitle}
                aria-label={stockTitle}
                className={`relative w-full flex items-center rounded-xl transition-all ${
                  sidebarExpanded ? 'gap-3 px-3.5 py-2.5 text-left' : 'justify-center h-10 px-0'
                } ${
                  active
                    ? 'bg-white text-burgundy-900 dark:bg-burgundy-600 dark:text-white font-semibold shadow-sm'
                    : 'text-burgundy-100/85 dark:text-titanium-300 hover:bg-white/12 dark:hover:bg-titanium-800/80 hover:text-white'
                }`}
              >
                <IconComp
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active ? 'text-burgundy-700 dark:text-white' : ''
                  }`}
                  strokeWidth={active ? 2.15 : 1.75}
                  aria-hidden="true"
                />
                {sidebarExpanded && <span className="text-sm truncate">{item.label}</span>}
                {showStockBadge &&
                  (sidebarExpanded ? (
                    <span
                      className={`ml-auto px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded-md border leading-none shrink-0 ${badgeTone}`}
                    >
                      {badgeText}
                    </span>
                  ) : (
                    <span
                      className={`absolute top-1 right-1 min-w-[15px] h-[15px] px-1 inline-flex items-center justify-center text-[9px] font-mono-num font-bold rounded-full border leading-none ${badgeTone}`}
                    >
                      {badgeText}
                    </span>
                  ))}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Account & Theme/Lang Controls */}
        <div
          className={`border-t border-white/12 dark:border-titanium-800 space-y-2 ${
            sidebarExpanded ? 'p-3' : 'p-2.5 flex flex-col items-center'
          }`}
        >
          {sidebarExpanded ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-white/12 hover:bg-white/20 dark:bg-titanium-800 dark:hover:bg-titanium-700 border border-white/12 dark:border-titanium-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {lang === 'my' ? 'မြန်မာ / EN' : 'EN / မြန်မာ'}
                </button>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="p-1.5 text-white dark:text-burgundy-300 bg-white/12 hover:bg-white/20 dark:bg-titanium-800 dark:hover:bg-titanium-700 border border-white/12 dark:border-titanium-700 rounded-lg transition-colors"
                  aria-label={darkMode ? t('lightMode') : t('darkMode')}
                  title={darkMode ? t('lightMode') : t('darkMode')}
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>

              {user ? (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/8 dark:bg-titanium-900/70">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {user.displayName || user.email}
                    </div>
                    <div className="text-[11px] text-burgundy-200 dark:text-titanium-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1.5 text-burgundy-200 hover:text-red-300 rounded-md transition-colors shrink-0"
                    title={t('signOut')}
                    aria-label={t('signOut')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : !supabaseAuthReady ? (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={signingIn}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-burgundy-900 bg-white hover:bg-burgundy-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {signingIn ? '...' : t('signInGoogle')}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
                title={lang === 'my' ? 'Switch to EN' : 'မြန်မာဘာသာ'}
                aria-label={lang === 'my' ? 'Switch to EN' : 'မြန်မာဘာသာ'}
                className="w-9 h-9 inline-flex items-center justify-center text-burgundy-100 hover:text-white bg-white/10 hover:bg-white/20 dark:bg-titanium-800/90 dark:hover:bg-titanium-700 border border-white/10 dark:border-titanium-700 rounded-lg transition-colors"
              >
                <Globe className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={toggleDarkMode}
                title={darkMode ? t('lightMode') : t('darkMode')}
                aria-label={darkMode ? t('lightMode') : t('darkMode')}
                className="w-9 h-9 inline-flex items-center justify-center text-burgundy-100 hover:text-white dark:text-burgundy-300 bg-white/10 hover:bg-white/20 dark:bg-titanium-800/90 dark:hover:bg-titanium-700 border border-white/10 dark:border-titanium-700 rounded-lg transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Moon className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={logout}
                  title={`${t('signOut')} (${user.email || ''})`}
                  aria-label={t('signOut')}
                  className="w-9 h-9 inline-flex items-center justify-center text-burgundy-200 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                </button>
              ) : !supabaseAuthReady ? (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={signingIn}
                  title={t('signInGoogle')}
                  aria-label={t('signInGoogle')}
                  className="w-10 h-10 inline-flex items-center justify-center text-burgundy-900 bg-white hover:bg-burgundy-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              ) : null}
            </>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-titanium-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-gradient-to-b from-burgundy-900 via-burgundy-900 to-burgundy-950 dark:from-titanium-900 dark:via-titanium-950 dark:to-burgundy-950 text-white h-full flex flex-col border-r border-burgundy-800 dark:border-titanium-800 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/12 dark:border-titanium-800">
              <span className="text-sm font-bold text-white dark:text-burgundy-200 truncate">
                {shop.shopName}
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-burgundy-100 hover:text-white"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                const IconComp = item.Icon;
                const showStockBadge = item.id === 'stock' && lowStockCount > 0;
                const badgeTone = hasOutOfStock
                  ? 'bg-red-500 text-white border-red-400'
                  : 'bg-amber-400 text-titanium-950 border-amber-300';
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl text-left transition-colors ${
                      active
                        ? 'bg-white text-burgundy-900 dark:bg-burgundy-600 dark:text-white font-semibold shadow-sm'
                        : 'text-burgundy-100/85 dark:text-titanium-300 hover:bg-white/12 dark:hover:bg-titanium-800/70 hover:text-white'
                    }`}
                  >
                    <IconComp
                      className={`w-[18px] h-[18px] shrink-0 ${
                        active ? 'text-burgundy-700 dark:text-white' : ''
                      }`}
                      strokeWidth={active ? 2.15 : 1.75}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                    {showStockBadge && (
                      <span
                        className={`ml-auto px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded-md border leading-none shrink-0 ${badgeTone}`}
                      >
                        {lowStockCount > 99 ? '99+' : lowStockCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/12 dark:border-titanium-800 space-y-2">
              {!isAdmin && subscriptionExpiry !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab('profile');
                    handleSelectNav('settings');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    remainingDays !== null && remainingDays <= 5
                      ? 'bg-amber-400/15 border-amber-300/40 text-amber-200'
                      : 'bg-white/10 border-white/15 text-burgundy-50'
                  }`}
                >
                  <div className="font-semibold font-mono-num truncate">
                    {formatRemainingDetailed(subscriptionExpiry, lang, Date.now(), false)}
                  </div>
                  <div className="text-[11px] opacity-80 font-mono-num truncate mt-0.5">
                    {lang === 'my' ? 'ကုန်ဆုံးချိန်' : 'Expires'}: {formatExpiryDateTime(subscriptionExpiry)}
                  </div>
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
                  className="flex-1 py-2 text-xs font-medium text-white bg-white/12 hover:bg-white/20 border border-white/15 rounded-lg"
                >
                  {lang === 'my' ? 'Switch to EN' : 'မြန်မာဘာသာ'}
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="px-3 py-2 bg-white/12 hover:bg-white/20 text-white border border-white/15 rounded-lg"
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
              {!user ? (
                !supabaseAuthReady && (
                  <button
                    onClick={loginWithGoogle}
                    disabled={signingIn}
                    className="w-full py-2 text-xs font-semibold text-burgundy-900 bg-white hover:bg-burgundy-50 disabled:opacity-50 rounded-lg"
                  >
                    {signingIn ? '...' : t('signInGoogle')}
                  </button>
                )
              ) : (
                <button
                  onClick={logout}
                  className="w-full py-2 text-xs font-medium text-red-200 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg"
                >
                  {t('signOut')} ({user.email})
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Contextual Top Bar (Single Row) */}
        <header className="h-16 sticky top-0 z-30 bg-white/95 dark:bg-titanium-900/95 backdrop-blur-md border-b border-titanium-200/90 dark:border-titanium-800/90 shadow-2xs px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-burgundy-800 dark:text-titanium-300 hover:bg-burgundy-50 dark:hover:bg-titanium-800 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline font-semibold text-burgundy-800 dark:text-burgundy-300 truncate max-w-[180px]">
                {shop.shopName}
              </span>
              <span className="hidden sm:inline text-titanium-300 dark:text-titanium-700">/</span>
              <h1 className="font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SubscriptionBadge
              onOpenSettings={() => {
                setSettingsTab('profile');
                setActiveTab('settings');
              }}
            />
            <LowStockNotification
              lowStockProducts={lowStockProducts}
              customThreshold={customStockThreshold}
              onChangeThreshold={handleChangeStockThreshold}
              onOpenStock={handleOpenLowStockView}
            />
            <ConnectionStatusBadge
              onOpenSettings={() => {
                setSettingsTab(isAdmin ? 'cloud' : 'profile');
                setActiveTab('settings');
              }}
            />
            <button
              onClick={() => setActiveTab('pos')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 shadow-xs shadow-burgundy-900/20 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('quickSale')}
            </button>
          </div>
        </header>

        {/* Admin Remote Shop Management Banner */}
        {isAdmin && adminTargetShopId && (
          <div className="bg-burgundy-800 dark:bg-burgundy-900 text-white px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {lang === 'my'
                  ? `Admin Edit Mode: လက်ရှိ "${adminTargetShopLabel || shop.shopName}" ၏ ဒေတာများကို တိုက်ရိုက်ပြင်ဆင်နေပါသည်`
                  : `Admin Edit Mode: Managing "${adminTargetShopLabel || shop.shopName}"`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                adminSelectShop(null, '');
                setActiveTab('admin');
              }}
              className="px-3 py-1 bg-white/15 hover:bg-white/25 rounded-md font-semibold transition-colors whitespace-nowrap"
            >
              {lang === 'my' ? 'Admin Panel သို့ ပြန်မည်' : 'Return to Admin Shop'}
            </button>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onOpenVoucher={(sale) => setVoucherSale(sale)}
            />
          )}
          {activeTab === 'pos' && (
            <PosSalesView onOpenVoucher={(sale) => setVoucherSale(sale)} />
          )}
          {activeTab === 'products' && <ProductsView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'stock' && (
            <StockView
              customThreshold={customStockThreshold}
              onChangeThreshold={handleChangeStockThreshold}
              initialLowOnlyKey={stockLowOnlyKey}
            />
          )}
          {activeTab === 'debts' && <DebtsView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'delivery' && <DeliveryView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'settings' && <SettingsSyncView initialTab={settingsTab} />}
          {activeTab === 'admin' && isAdmin && <AdminAccessView onNavigate={setActiveTab} />}
        </main>
      </div>

      {/* Voucher PNG / PDF / Telegram Modal */}
      <VoucherModal sale={voucherSale} onClose={() => setVoucherSale(null)} />

      {/* Lightweight Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg text-xs font-medium shadow-md border transition-opacity ${
            toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
              : toast.type === 'info'
              ? 'bg-titanium-900 dark:bg-titanium-800 text-titanium-50 border-titanium-700'
              : 'bg-burgundy-50 dark:bg-burgundy-950 text-burgundy-900 dark:text-burgundy-100 border-burgundy-200 dark:border-burgundy-800'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PosProvider>
        <PosShell />
      </PosProvider>
    </ErrorBoundary>
  );
}
