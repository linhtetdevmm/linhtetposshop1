import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Receipt } from 'lucide-react';
import type { NavTab, Sale } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenVoucher: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenVoucher,
}) => {
  const { products, sales, debts, expenses, deliveries, lang, darkMode } = usePos();
  const t = useT(lang);

  const today = getTodayISO();
  const currentMonth = today.slice(0, 7);

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
    <div className="space-y-6">
      {/* Primary 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('todaySales')}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
            {formatMMK(stats.todaySalesTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {sales.filter((s) => s.date === today).length} {t('orders')} · {today}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('totalSalesMonth')}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
            {formatMMK(stats.monthSalesTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {currentMonth} · {t('monthlyExpenses')}:{' '}
            <span className="font-mono-num">{formatMMK(stats.monthExpensesTotal)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('grossProfit')} − {t('expensesCol')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('lowStockCount')}
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono-num ${
              stats.lowStockProducts.length > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {stats.lowStockProducts.length} / {products.length}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('pendingDeliveries')}:{' '}
            <span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">
              {stats.activeDeliveries}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Operational Summary Row (Flat Hairline Bar) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
              {t('totalReceivable')}:
            </span>
            <span className="font-mono-num font-semibold text-teal-800 dark:text-teal-300">
              {formatMMK(stats.totalReceivable)}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
              {t('totalPayable')}:
            </span>
            <span className="font-mono-num font-semibold text-amber-700 dark:text-amber-400">
              {formatMMK(stats.totalPayable)}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
              {t('pendingDeliveries')}:
            </span>
            <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200">
              {stats.activeDeliveries}
            </span>
          </div>
        </div>
        <button
          onClick={() => onNavigate('reports')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
        >
          {t('navReports')}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Chart + Low Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('revenueProfitChart')}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              MMK (Ks)
            </span>
          </div>
          <div className="h-72 w-full">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
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
                    stroke={darkMode ? '#1e293b' : '#e2e8f0'}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: darkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => formatMMK(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                      borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t('revenue')}
                    fill="#0F766E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="profit"
                    name={t('profit')}
                    fill="#16A34A"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="expense"
                    name={t('expense')}
                    fill="#D97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('lowStockAlerts')}
            </h3>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              {t('viewAll')}
            </button>
          </div>
          {stats.lowStockProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 text-center py-8">
              {t('noLowStock')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
              {stats.lowStockProducts.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('recentSales')}
          </h3>
          <button
            onClick={() => onNavigate('pos')}
            className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
          >
            {t('viewAll')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.slice(0, 6).map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-5 py-3 font-mono-num font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {sale.voucherNo}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {sale.date}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    {sale.customerName || t('walkInCustomer')}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-medium text-slate-600 dark:text-slate-300">
                    {sale.paymentMethod}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatMMK(sale.total)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    +{formatMMK(sale.profit)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => onOpenVoucher(sale)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      {t('voucher')}
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No sales recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
