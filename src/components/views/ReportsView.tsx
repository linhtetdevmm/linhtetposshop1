import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { exportToCsv, formatMMK, getTodayISO } from '../../lib/format';

interface SummaryRow {
  period: string;
  orders: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export const ReportsView: React.FC = () => {
  const { sales, expenses, shop, lang, darkMode, showToast } = usePos();
  const t = useT(lang);

  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    const keyLen = mode === 'monthly' ? 7 : 4;

    for (const s of sales) {
      const period = s.date.slice(0, keyLen);
      const row = map.get(period) || {
        period,
        orders: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
      };
      row.orders += 1;
      row.revenue += s.total;
      row.cogs += s.totalCost;
      row.grossProfit += s.profit;
      map.set(period, row);
    }

    for (const e of expenses) {
      const period = e.date.slice(0, keyLen);
      const row = map.get(period) || {
        period,
        orders: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
      };
      row.expenses += e.amount;
      map.set(period, row);
    }

    return Array.from(map.values())
      .map((r) => ({ ...r, netProfit: r.grossProfit - r.expenses }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [sales, expenses, mode]);

  const totals = useMemo(
    () =>
      summaryRows.reduce(
        (acc, r) => ({
          orders: acc.orders + r.orders,
          revenue: acc.revenue + r.revenue,
          cogs: acc.cogs + r.cogs,
          grossProfit: acc.grossProfit + r.grossProfit,
          expenses: acc.expenses + r.expenses,
          netProfit: acc.netProfit + r.netProfit,
        }),
        { orders: 0, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 }
      ),
    [summaryRows]
  );

  const handleExportSummaryCsv = () => {
    const headers = [
      t('period'),
      t('orderCount'),
      `${t('revenue')} (MMK)`,
      `${t('cogs')} (MMK)`,
      `${t('grossProfit')} (MMK)`,
      `${t('expensesCol')} (MMK)`,
      `${t('netProfitCol')} (MMK)`,
    ];
    const rows = summaryRows.map((r) => [
      r.period,
      r.orders,
      r.revenue,
      r.cogs,
      r.grossProfit,
      r.expenses,
      r.netProfit,
    ]);
    rows.push([
      'TOTAL',
      totals.orders,
      totals.revenue,
      totals.cogs,
      totals.grossProfit,
      totals.expenses,
      totals.netProfit,
    ]);
    const cleanShop = shop.shopName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24) || 'Shop';
    exportToCsv(
      `${cleanShop}_${mode === 'monthly' ? 'Monthly' : 'Yearly'}_Report_${getTodayISO()}.csv`,
      headers,
      rows
    );
    showToast(
      lang === 'my'
        ? `${mode === 'monthly' ? 'လချုပ်' : 'နှစ်ချုပ်'} CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။`
        : 'Summary CSV exported.'
    );
  };

  const handleExportSalesDetailCsv = () => {
    const headers = [
      t('voucherNo'),
      t('date'),
      t('customerName'),
      t('paymentMethod'),
      `${t('subtotal')} (MMK)`,
      `${t('discount')} (MMK)`,
      `${t('grandTotal')} (MMK)`,
      `${t('cogs')} (MMK)`,
      `${t('profit')} (MMK)`,
    ];
    const rows = sales.map((s) => [
      s.voucherNo,
      s.date,
      s.customerName || 'Walk-in',
      s.paymentMethod,
      s.subtotal,
      s.discount,
      s.total,
      s.totalCost,
      s.profit,
    ]);
    exportToCsv(`Sales_Detail_${getTodayISO()}.csv`, headers, rows);
    showToast(
      lang === 'my' ? 'အရောင်းအသေးစိတ် CSV ထုတ်ပြီးပါပြီ။' : 'Detailed Sales CSV exported.'
    );
  };

  const chartData = useMemo(() => [...summaryRows].reverse(), [summaryRows]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
          <button
            onClick={() => setMode('monthly')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'monthly'
                ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
            }`}
          >
            {t('monthlySummary')}
          </button>
          <button
            onClick={() => setMode('yearly')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'yearly'
                ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
            }`}
          >
            {t('yearlySummary')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportSummaryCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg whitespace-nowrap transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {mode === 'monthly' ? t('exportMonthlyCsv') : t('exportYearlyCsv')}
          </button>
          <button
            onClick={handleExportSalesDetailCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 hover:bg-titanium-50 dark:hover:bg-titanium-800 rounded-lg whitespace-nowrap transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('exportSalesCsv')}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
            {mode === 'monthly' ? t('monthlySummary') : t('yearlySummary')}
          </h3>
          <span className="text-xs font-mono-num text-titanium-500 dark:text-titanium-400">MMK (Ks)</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={darkMode ? '#2c2221' : '#e8dfdc'}
              />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: darkMode ? '#a4938e' : '#776661' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: darkMode ? '#a4938e' : '#776661' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
              />
              <Tooltip
                formatter={(value: unknown) => formatMMK(Number(value) || 0)}
                contentStyle={{
                  backgroundColor: darkMode ? '#1b1515' : '#ffffff',
                  borderColor: darkMode ? '#2c2221' : '#e8dfdc',
                  color: darkMode ? '#faf8f7' : '#1b1515',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="revenue" name={t('revenue')} fill={darkMode ? '#b24c47' : '#7a2e2e'} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="netProfit" name={t('netProfitCol')} fill={darkMode ? '#4ade80' : '#2e7d5b'} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expenses" name={t('expensesCol')} fill={darkMode ? '#e3a05b' : '#c2783a'} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Ledger Table */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('period')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('orderCount')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('revenue')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('cogs')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('grossProfit')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('expensesCol')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('netProfitCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {summaryRows.map((row) => (
                <tr key={row.period} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                  <td className="px-5 py-3 font-mono-num font-semibold text-titanium-900 dark:text-titanium-50">
                    {row.period}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-titanium-600 dark:text-titanium-400">
                    {row.orders}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-medium text-titanium-900 dark:text-titanium-50">
                    {formatMMK(row.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-titanium-500 dark:text-titanium-400">
                    {formatMMK(row.cogs)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-burgundy-700 dark:text-burgundy-300">
                    {formatMMK(row.grossProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-amber-700 dark:text-amber-400">
                    {formatMMK(row.expenses)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono-num font-bold ${
                      row.netProfit >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {formatMMK(row.netProfit)}
                  </td>
                </tr>
              ))}
              {summaryRows.length > 0 && (
                <tr className="bg-titanium-50 dark:bg-titanium-950/60 font-bold border-t border-titanium-200 dark:border-titanium-800 text-titanium-900 dark:text-titanium-50">
                  <td className="px-5 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.orders}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{formatMMK(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{formatMMK(totals.cogs)}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-burgundy-700 dark:text-burgundy-300">
                    {formatMMK(totals.grossProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-amber-700 dark:text-amber-400">
                    {formatMMK(totals.expenses)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                    {formatMMK(totals.netProfit)}
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
