import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Plus, Receipt, Wallet, X } from 'lucide-react';
import type { NavTab, Sale } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Staff', 'Transport', 'Packaging', 'Marketing', 'Misc'];

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenVoucher: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenVoucher,
}) => {
  const { products, sales, debts, expenses, deliveries, lang, darkMode, saveExpense } = usePos();
  const t = useT(lang);

  const today = getTodayISO();
  const currentMonth = today.slice(0, 7);

  // Quick Expense Modal State
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [expDate, setExpDate] = useState(today);
  const [expCategory, setExpCategory] = useState('Utilities');
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  const openQuickExpense = () => {
    setExpDate(getTodayISO());
    setExpCategory('Utilities');
    setExpTitle('');
    setExpAmount('');
    setExpNote('');
    setQuickExpenseOpen(true);
  };

  const handleQuickExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || savingExpense) return;
    setSavingExpense(true);
    try {
      await saveExpense({
        date: expDate || getTodayISO(),
        category: expCategory,
        title: expTitle.trim(),
        amount: Number(expAmount) || 0,
        note: expNote.trim(),
      });
      setQuickExpenseOpen(false);
    } finally {
      setSavingExpense(false);
    }
  };

  const stats = useMemo(() => {
    const todaySalesTotal = sales
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + s.total, 0);

    const monthSales = sales.filter((s) => s.date.startsWith(currentMonth));
    const monthSalesTotal = monthSales.reduce((sum, s) => sum + s.total, 0);
    const monthGrossProfit = monthSales.reduce((sum, s) => sum + s.profit, 0);

    const monthExpensesTotal = expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    const netProfit = monthGrossProfit - monthExpensesTotal;
    const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

    const totalReceivable = debts
      .filter((d) => d.type === 'receivable' && d.status !== 'settled')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    const totalPayable = debts
      .filter((d) => d.type === 'payable' && d.status !== 'settled')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    const activeDeliveries = deliveries.filter(
      (d) => d.status === 'pending' || d.status === 'dispatched'
    ).length;

    return {
      todaySalesTotal,
      monthSalesTotal,
      monthExpensesTotal,
      netProfit,
      lowStockProducts,
      totalReceivable,
      totalPayable,
      activeDeliveries,
    };
  }, [sales, expenses, products, debts, deliveries, today, currentMonth]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<
      string,
      { month: string; revenue: number; profit: number; expense: number }
    >();

    for (const s of sales) {
      const m = s.date.slice(0, 7);
      const cur = map.get(m) || { month: m, revenue: 0, profit: 0, expense: 0 };
      cur.revenue += s.total;
      cur.profit += s.profit;
      map.set(m, cur);
    }

    for (const e of expenses) {
      const m = e.date.slice(0, 7);
      const cur = map.get(m) || { month: m, revenue: 0, profit: 0, expense: 0 };
      cur.expense += e.amount;
      map.set(m, cur);
    }

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [sales, expenses]);

  return (
    <div className="space-y-6 pb-20">
      {/* Primary 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 dark:from-burgundy-800 dark:via-burgundy-900 dark:to-titanium-900 text-white border border-burgundy-700 dark:border-burgundy-700/70 rounded-xl p-5 shadow-md shadow-burgundy-900/15">
          <div className="text-xs font-medium text-burgundy-100">
            {t('todaySales')}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-white">
            {formatMMK(stats.todaySalesTotal)}
          </div>
          <div className="mt-2 text-xs text-burgundy-100/90">
            {sales.filter((s) => s.date === today).length} {t('orders')} · {today}
          </div>
        </div>

        <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-titanium-500 dark:text-titanium-400">
            {t('totalSalesMonth')}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-burgundy-800 dark:text-burgundy-200">
            {formatMMK(stats.monthSalesTotal)}
          </div>
          <div className="mt-2 text-xs text-titanium-500 dark:text-titanium-400">
            {currentMonth} · {t('monthlyExpenses')}:{' '}
            <span className="font-mono-num">{formatMMK(stats.monthExpensesTotal)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-titanium-500 dark:text-titanium-400">
            {t('netProfit')} ({currentMonth})
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono-num ${
              stats.netProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatMMK(stats.netProfit)}
          </div>
          <div className="mt-2 text-xs text-titanium-500 dark:text-titanium-400">
            {t('grossProfit')} − {t('expensesCol')}
          </div>
        </div>

        <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-titanium-500 dark:text-titanium-400">
            {t('lowStockCount')}
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono-num ${
              stats.lowStockProducts.length > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-titanium-900 dark:text-titanium-50'
            }`}
          >
            {stats.lowStockProducts.length} / {products.length}
          </div>
          <div className="mt-2 text-xs text-titanium-500 dark:text-titanium-400">
            {t('pendingDeliveries')}:{' '}
            <span className="font-mono-num font-medium text-titanium-700 dark:text-titanium-300">
              {stats.activeDeliveries}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Operational Summary Row (Flat Hairline Bar) */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl px-5 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-xs text-titanium-500 dark:text-titanium-400 mr-2">
              {t('totalReceivable')}:
            </span>
            <span className="font-mono-num font-semibold text-burgundy-700 dark:text-burgundy-300">
              {formatMMK(stats.totalReceivable)}
            </span>
          </div>
          <span className="text-titanium-300 dark:text-titanium-700" aria-hidden="true">
            |
          </span>
          <div>
            <span className="text-xs text-titanium-500 dark:text-titanium-400 mr-2">
              {t('totalPayable')}:
            </span>
            <span className="font-mono-num font-semibold text-amber-700 dark:text-amber-400">
              {formatMMK(stats.totalPayable)}
            </span>
          </div>
          <span className="text-titanium-300 dark:text-titanium-700" aria-hidden="true">
            |
          </span>
          <div>
            <span className="text-xs text-titanium-500 dark:text-titanium-400 mr-2">
              {t('pendingDeliveries')}:
            </span>
            <span className="font-mono-num font-semibold text-titanium-800 dark:text-titanium-200">
              {stats.activeDeliveries}
            </span>
          </div>
        </div>
        <button
          onClick={() => onNavigate('reports')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap shrink-0"
        >
          {t('navReports')}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Chart + Low Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
              {t('revenueProfitChart')}
            </h3>
            <span className="text-xs text-titanium-500 dark:text-titanium-400 font-mono-num">
              MMK (Ks)
            </span>
          </div>
          <div className="h-72 w-full">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-titanium-500 dark:text-titanium-400">
                No chart data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={darkMode ? '#1b253b' : '#dce3ef'}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: darkMode ? '#8c99b2' : '#606e88' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: darkMode ? '#8c99b2' : '#606e88' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => formatMMK(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: darkMode ? '#101729' : '#ffffff',
                      borderColor: darkMode ? '#1b253b' : '#dce3ef',
                      color: darkMode ? '#f6f8fc' : '#101729',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t('revenue')}
                    fill={darkMode ? '#5c8eff' : '#1738b5'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="profit"
                    name={t('profit')}
                    fill={darkMode ? '#4ade80' : '#2f7d4e'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="expense"
                    name={t('expense')}
                    fill={darkMode ? '#fb923c' : '#d95d24'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
              {t('lowStockAlerts')}
            </h3>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap"
            >
              {t('viewAll')}
            </button>
          </div>
          {stats.lowStockProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-titanium-500 dark:text-titanium-400 text-center py-8">
              {t('noLowStock')}
            </div>
          ) : (
            <div className="divide-y divide-titanium-100 dark:divide-titanium-800 flex-1">
              {stats.lowStockProducts.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-titanium-900 dark:text-titanium-50 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-titanium-500 dark:text-titanium-400 font-mono-num">
                      {item.sku} · min {item.minStock}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold font-mono-num ${
                        item.stock <= 0
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.stock} {item.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200/90 dark:border-titanium-800 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
            {t('recentSales')}
          </h3>
          <button
            onClick={() => onNavigate('pos')}
            className="text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap"
          >
            {t('viewAll')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-burgundy-50/55 dark:bg-titanium-950/60 text-xs text-burgundy-900 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('voucherNo')}</th>
                <th className="px-4 py-3 font-medium">{t('date')}</th>
                <th className="px-4 py-3 font-medium">{t('customerName')}</th>
                <th className="px-4 py-3 font-medium">{t('paymentMethod')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('grandTotal')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('profit')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('voucher')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {sales.slice(0, 6).map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-titanium-50/80 dark:hover:bg-titanium-800/40 transition-colors"
                >
                  <td className="px-5 py-3 font-mono-num font-medium text-titanium-900 dark:text-titanium-50 whitespace-nowrap">
                    {sale.voucherNo}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-titanium-600 dark:text-titanium-400 whitespace-nowrap">
                    {sale.date}
                  </td>
                  <td className="px-4 py-3 text-titanium-800 dark:text-titanium-200">
                    {sale.customerName || t('walkInCustomer')}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-medium text-titanium-600 dark:text-titanium-300">
                    {sale.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-titanium-900 dark:text-titanium-50 whitespace-nowrap">
                    {formatMMK(sale.total)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    +{formatMMK(sale.profit)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onOpenVoucher(sale)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline whitespace-nowrap"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      {t('voucher')}
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-titanium-500 dark:text-titanium-400">
                    No sales recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Quick Expense Button */}
      <button
        type="button"
        onClick={openQuickExpense}
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-xl shadow-lg shadow-burgundy-900/25 border border-burgundy-500/30 transition-all active:scale-[0.98] whitespace-nowrap"
      >
        <Plus className="w-4 h-4" />
        <span>{t('quickExpense')}</span>
      </button>

      {/* Quick Expense Modal */}
      {quickExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleQuickExpenseSubmit}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-burgundy-50 dark:bg-burgundy-950/80 text-burgundy-700 dark:text-burgundy-300 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                    {t('quickExpense')}
                  </h3>
                  <p className="text-[11px] text-titanium-500 dark:text-titanium-400 truncate">
                    {t('quickExpenseSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickExpenseOpen(false)}
                className="p-1.5 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100 rounded-lg hover:bg-titanium-100 dark:hover:bg-titanium-800 transition-colors"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                    {t('date')}
                  </label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                    {t('category')}
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('expenseTitle')}
                </label>
                <input
                  required
                  autoFocus
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder={lang === 'my' ? 'ဥပမာ - မီတာခ / ဆီဖိုး / ပစ္စည်းပို့ခ' : 'e.g. Electricity bill, fuel, supplies'}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                />
              </div>

              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('amount')}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  inputMode="numeric"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                />
              </div>

              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">
                  {t('note')}
                </label>
                <input
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800 bg-titanium-50/70 dark:bg-titanium-950/40">
              <button
                type="button"
                onClick={() => setQuickExpenseOpen(false)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={savingExpense || !expTitle.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg"
              >
                {savingExpense ? '...' : t('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
