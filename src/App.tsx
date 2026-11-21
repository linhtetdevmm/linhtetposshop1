import React, { useState } from 'react';
import {
  BarChart3,
  Boxes,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Truck,
  X,
} from 'lucide-react';
import type { NavTab, Sale } from './types/pos';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PosProvider, usePos } from './context/PosContext';
import { useT } from './i18n/translations';
import { formatExpiryDate } from './lib/accessControl';
import { VoucherModal } from './components/VoucherModal';
import { ConnectionStatusBadge } from './components/ConnectionStatusBadge';
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
    loginWithGoogle,
    logout,
    toast,
  } = usePos();
  const t = useT(lang);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'profile' | 'cloud' | 'guide'>('profile');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voucherSale, setVoucherSale] = useState<Sale | null>(null);

  // Strict Access Gate: unauthorized or expired subscriptions cannot enter the POS shell
  if (accessStatus !== 'granted' || isSubscriptionExpired) {
    return <AccessGateScreen />;
  }

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'pos', label: t('navPos'), icon: ShoppingCart },
    { id: 'products', label: t('navProducts'), icon: Package },
    { id: 'purchases', label: t('navPurchases'), icon: ShoppingBag },
    { id: 'stock', label: t('navStock'), icon: Boxes },
    { id: 'debts', label: t('navDebts'), icon: CreditCard },
    { id: 'expenses', label: t('navExpenses'), icon: Receipt },
    { id: 'delivery', label: t('navDelivery'), icon: Truck },
    { id: 'reports', label: t('navReports'), icon: BarChart3 },
    { id: 'settings', label: t('navSettings'), icon: Settings },
    ...(isAdmin
      ? [
          {
            id: 'admin' as NavTab,
            label: lang === 'my' ? 'Admin ဝင်ခွင့်စီမံမှု' : 'Admin Access',
            icon: Shield,
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
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white dark:bg-titanium-900 border-r border-titanium-200 dark:border-titanium-800 sticky top-0 h-screen">
        {/* Brand Block */}
        <div className="h-16 px-5 flex items-center border-b border-titanium-200 dark:border-titanium-800">
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-burgundy-800 dark:text-burgundy-300 truncate">
              {shop.shopName}
            </div>
            <div
              className={`text-[11px] truncate ${
                !isAdmin && remainingDays !== null && remainingDays <= 5
                  ? 'text-amber-700 dark:text-amber-300 font-medium'
                  : 'text-titanium-500 dark:text-titanium-400'
              }`}
            >
              {isAdmin
                ? 'Super Admin · MMK'
                : remainingDays !== null && subscriptionExpiry
                ? lang === 'my'
                  ? `${remainingDays} ရက်ကျန် (${formatExpiryDate(subscriptionExpiry)})`
                  : `${remainingDays}d left (${formatExpiryDate(subscriptionExpiry)})`
                : isCloudMode
                ? `${t('cloudSynced')} · MMK`
                : `${t('localDemoMode')} · MMK`}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                  active
                    ? 'bg-burgundy-50 dark:bg-burgundy-950 text-burgundy-800 dark:text-burgundy-300 font-semibold'
                    : 'text-titanium-600 dark:text-titanium-400 hover:bg-titanium-100/80 dark:hover:bg-titanium-800/70 hover:text-titanium-900 dark:hover:text-titanium-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Account & Theme/Lang Controls */}
        <div className="p-3 border-t border-titanium-200 dark:border-titanium-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200/80 dark:hover:bg-titanium-700 rounded-md transition-colors whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'my' ? 'မြန်မာ / EN' : 'EN / မြန်မာ'}
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 text-titanium-700 dark:text-burgundy-300 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200/80 dark:hover:bg-titanium-700 rounded-md transition-colors"
              aria-label={darkMode ? t('lightMode') : t('darkMode')}
              title={darkMode ? t('lightMode') : t('darkMode')}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {user ? (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                  {user.displayName || user.email}
                </div>
                <div className="text-[11px] text-titanium-500 dark:text-titanium-400 truncate">
                  {user.email}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-titanium-500 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors shrink-0"
                title={t('signOut')}
                aria-label={t('signOut')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-burgundy-800 dark:text-burgundy-200 bg-white dark:bg-titanium-950 border border-titanium-300 dark:border-titanium-700 hover:bg-burgundy-50 dark:hover:bg-burgundy-950/60 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              {signingIn ? '...' : t('signInGoogle')}
            </button>
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
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-titanium-900 h-full flex flex-col border-r border-titanium-200 dark:border-titanium-800 z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-titanium-200 dark:border-titanium-800">
              <span className="text-sm font-bold text-burgundy-800 dark:text-burgundy-300 truncate">
                {shop.shopName}
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-titanium-500"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-left ${
                      active
                        ? 'bg-burgundy-50 dark:bg-burgundy-950 text-burgundy-800 dark:text-burgundy-300 font-semibold'
                        : 'text-titanium-600 dark:text-titanium-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-titanium-200 dark:border-titanium-800 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
                  className="flex-1 py-2 text-xs font-medium bg-titanium-100 dark:bg-titanium-800 rounded-md"
                >
                  {lang === 'my' ? 'Switch to EN' : 'မြန်မာဘာသာ'}
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="px-3 py-2 bg-titanium-100 dark:bg-titanium-800 text-titanium-700 dark:text-burgundy-300 rounded-md"
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
              {!user ? (
                <button
                  onClick={loginWithGoogle}
                  disabled={signingIn}
                  className="w-full py-2 text-xs font-semibold text-white bg-burgundy-700 dark:bg-burgundy-600 disabled:opacity-50 rounded-lg"
                >
                  {signingIn ? '...' : t('signInGoogle')}
                </button>
              ) : (
                <button
                  onClick={logout}
                  className="w-full py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg"
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
        <header className="h-16 sticky top-0 z-30 bg-white/95 dark:bg-titanium-900/95 backdrop-blur border-b border-titanium-200 dark:border-titanium-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-titanium-600 dark:text-titanium-300 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-titanium-500 dark:text-titanium-400 truncate max-w-[180px]">
                {shop.shopName}
              </span>
              <span className="hidden sm:inline text-titanium-300 dark:text-titanium-700">/</span>
              <h1 className="font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ConnectionStatusBadge
              onOpenSettings={() => {
                setSettingsTab('cloud');
                setActiveTab('settings');
              }}
            />
            <button
              onClick={() => setActiveTab('pos')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
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
          {activeTab === 'stock' && <StockView />}
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
