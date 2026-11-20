import React, { useMemo, useState } from 'react';
import { Banknote, Plus, Trash2, X } from 'lucide-react';
import type { Debt } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

export const DebtsView: React.FC = () => {
  const { debts, lang, createDebt, recordDebtPayment, deleteDebt } = usePos();
  const t = useT(lang);

  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // Add form state
  const [type, setType] = useState<'receivable' | 'payable'>('receivable');
  const [partyName, setPartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [dueDate, setDueDate] = useState(getTodayISO());
  const [note, setNote] = useState('');

  const summary = useMemo(() => {
    const rec = debts
      .filter((d) => d.type === 'receivable' && d.status !== 'settled')
      .reduce((s, d) => s + d.remainingAmount, 0);
    const pay = debts
      .filter((d) => d.type === 'payable' && d.status !== 'settled')
      .reduce((s, d) => s + d.remainingAmount, 0);
    return { rec, pay };
  }, [debts]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return debts;
    return debts.filter((d) => d.type === filterType);
  }, [debts, filterType]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) return;
    await createDebt({
      type,
      partyName: partyName.trim(),
      phone: phone.trim(),
      referenceNo: referenceNo.trim(),
      totalAmount: Number(totalAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      dueDate,
      note: note.trim(),
    });
    setAddOpen(false);
    setPartyName('');
    setPhone('');
    setReferenceNo('');
    setTotalAmount('');
    setPaidAmount('0');
    setNote('');
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    await recordDebtPayment(payTarget.id, Number(payAmount) || 0);
    setPayTarget(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-5">
      {/* Top KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500">{t('receivables')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-num text-teal-800 dark:text-teal-300">
            {formatMMK(summary.rec)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500">{t('payables')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-num text-amber-700 dark:text-amber-400">
            {formatMMK(summary.pay)}
          </div>
        </div>
      </div>

      {/* Filter & Add Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
          {(['all', 'receivable', 'payable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab === 'all'
                ? t('allCategories')
                : tab === 'receivable'
                ? t('receivables')
                : t('payables')}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t('addDebt')}
        </button>
      </div>

      {/* Debts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('partyName')}</th>
                <th className="px-4 py-3 font-medium">{t('dueDate')}</th>
                <th className="px-4 py-3 font-medium">{t('status')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('totalAmount')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('paidAmount')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('remaining')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((debt) => (
                <tr key={debt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {debt.partyName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {debt.type === 'receivable' ? t('receivables') : t('payables')}
                      {debt.referenceNo ? ` · ${debt.referenceNo}` : ''}
                      {debt.phone ? ` · ${debt.phone}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {debt.dueDate}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span
                      className={
                        debt.status === 'settled'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : debt.status === 'partial'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {t(debt.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatMMK(debt.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-slate-500 whitespace-nowrap">
                    {formatMMK(debt.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatMMK(debt.remainingAmount)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {debt.status !== 'settled' && (
                      <button
                        onClick={() => {
                          setPayTarget(debt);
                          setPayAmount(String(debt.remainingAmount));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline mr-3"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        {t('recordPayment')}
                      </button>
                    )}
                    <button
                      onClick={() => deleteDebt(debt.id)}
                      className="inline-flex items-center text-slate-400 hover:text-red-600"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No debt records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Debt Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold">{t('addDebt')}</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(['receivable', 'payable'] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setType(dt)}
                    className={`py-2 text-xs font-medium rounded-lg border ${
                      type === dt
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {dt === 'receivable' ? t('receivables') : t('payables')}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('partyName')}</label>
                <input
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('customerPhone')}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('dueDate')}</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('totalAmount')}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('paidAmount')}</label>
                  <input
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('note')}</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Repayment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleRepay}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold">{t('recordPayment')}</h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm font-medium">{payTarget.partyName}</div>
              <div className="text-xs text-slate-500">
                {t('remaining')}:{' '}
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                  {formatMMK(payTarget.remainingAmount)}
                </span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('paymentAmount')}</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payTarget.remainingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
