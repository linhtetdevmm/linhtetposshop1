import React, { useMemo, useState } from 'react';
import { Banknote, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Debt } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

export const DebtsView: React.FC = () => {
  const { debts, lang, createDebt, updateDebt, recordDebtPayment, deleteDebt } = usePos();
  const t = useT(lang);

  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // Add / Edit form state
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

  const openAdd = () => {
    setEditingId(null);
    setType('receivable');
    setPartyName('');
    setPhone('');
    setReferenceNo('');
    setTotalAmount('');
    setPaidAmount('0');
    setDueDate(getTodayISO());
    setNote('');
    setModalOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditingId(d.id);
    setType(d.type);
    setPartyName(d.partyName);
    setPhone(d.phone);
    setReferenceNo(d.referenceNo);
    setTotalAmount(String(d.totalAmount));
    setPaidAmount(String(d.paidAmount));
    setDueDate(d.dueDate);
    setNote(d.note);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) return;
    const payload = {
      type,
      partyName: partyName.trim(),
      phone: phone.trim(),
      referenceNo: referenceNo.trim(),
      totalAmount: Number(totalAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      dueDate,
      note: note.trim(),
    };
    if (editingId) {
      await updateDebt(editingId, payload);
    } else {
      await createDebt(payload);
    }
    setModalOpen(false);
    setEditingId(null);
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
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('receivables')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-num text-burgundy-800 dark:text-burgundy-300">
            {formatMMK(summary.rec)}
          </div>
        </div>
        <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl p-5">
          <div className="text-xs text-titanium-500 dark:text-titanium-400">{t('payables')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-num text-amber-700 dark:text-amber-400">
            {formatMMK(summary.pay)}
          </div>
        </div>
      </div>

      {/* Filter & Add Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-titanium-200/70 dark:bg-titanium-800 rounded-lg">
          {(['all', 'receivable', 'payable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === tab
                  ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                  : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-50'
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
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg whitespace-nowrap transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addDebt')}
        </button>
      </div>

      {/* Debts Table */}
      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
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
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {filtered.map((debt) => (
                <tr key={debt.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                  <td className="px-5 py-3">
                    <div className="font-medium text-titanium-900 dark:text-titanium-50">
                      {debt.partyName}
                    </div>
                    <div className="text-xs text-titanium-500 dark:text-titanium-400">
                      {debt.type === 'receivable' ? t('receivables') : t('payables')}
                      {debt.referenceNo ? ` · ${debt.referenceNo}` : ''}
                      {debt.phone ? ` · ${debt.phone}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-num text-xs text-titanium-600 dark:text-titanium-400 whitespace-nowrap">
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
                  <td className="px-4 py-3 text-right font-mono-num text-titanium-800 dark:text-titanium-200 whitespace-nowrap">
                    {formatMMK(debt.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-titanium-500 dark:text-titanium-400 whitespace-nowrap">
                    {formatMMK(debt.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-titanium-900 dark:text-titanium-50 whitespace-nowrap">
                    {formatMMK(debt.remainingAmount)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {debt.status !== 'settled' && (
                      <button
                        onClick={() => {
                          setPayTarget(debt);
                          setPayAmount(String(debt.remainingAmount));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:underline mr-3"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        {t('recordPayment')}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(debt)}
                      className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300 mr-3"
                      aria-label={t('edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteDebt(debt.id)}
                      className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-titanium-500 dark:text-titanium-400">
                    No debt records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Debt Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
                {editingId
                  ? lang === 'my'
                    ? 'အကြွေးစာရင်း ပြင်ဆင်ရန်'
                    : 'Edit Debt Record'
                  : t('addDebt')}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
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
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      type === dt
                        ? 'border-burgundy-700 dark:border-burgundy-600 bg-burgundy-700 dark:bg-burgundy-600 text-white'
                        : 'border-titanium-200 dark:border-titanium-700 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-50 dark:hover:bg-titanium-800'
                    }`}
                  >
                    {dt === 'receivable' ? t('receivables') : t('payables')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('partyName')}</label>
                  <input
                    required
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('refNo')}</label>
                  <input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('customerPhone')}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('dueDate')}</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('totalAmount')}</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('paidAmount')}</label>
                  <input
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('note')}</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Repayment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4">
          <form
            onSubmit={handleRepay}
            className="w-full max-w-sm bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('recordPayment')}</h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm font-medium text-titanium-900 dark:text-titanium-50">{payTarget.partyName}</div>
              <div className="text-xs text-titanium-500 dark:text-titanium-400">
                {t('remaining')}:{' '}
                <span className="font-mono-num font-bold text-titanium-900 dark:text-titanium-50">
                  {formatMMK(payTarget.remainingAmount)}
                </span>
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('paymentAmount')}</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payTarget.remainingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="px-4 py-2 text-xs font-medium text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg"
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
