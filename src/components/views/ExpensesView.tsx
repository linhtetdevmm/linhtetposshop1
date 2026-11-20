import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Expense } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, getTodayISO } from '../../lib/format';

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Staff', 'Transport', 'Packaging', 'Marketing', 'Misc'];

export const ExpensesView: React.FC = () => {
  const { expenses, lang, saveExpense, deleteExpense } = usePos();
  const t = useT(lang);

  const [catFilter, setCatFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [date, setDate] = useState(getTodayISO());
  const [category, setCategory] = useState('Utilities');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const openAdd = () => {
    setEditingId(undefined);
    setDate(getTodayISO());
    setCategory('Utilities');
    setTitle('');
    setAmount('');
    setNote('');
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditingId(e.id);
    setDate(e.date);
    setCategory(e.category);
    setTitle(e.title);
    setAmount(String(e.amount));
    setNote(e.note);
    setModalOpen(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return;
    await saveExpense(
      {
        date,
        category,
        title: title.trim(),
        amount: Number(amount) || 0,
        note: note.trim(),
      },
      editingId
    );
    setModalOpen(false);
  };

  const filtered = useMemo(() => {
    if (catFilter === 'ALL') return expenses;
    return expenses.filter((e) => e.category === catFilter);
  }, [expenses, catFilter]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', ...EXPENSE_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                catFilter === cat
                  ? 'bg-burgundy-700 dark:bg-burgundy-600 text-white'
                  : 'bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 text-titanium-700 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800'
              }`}
            >
              {cat === 'ALL' ? t('allCategories') : cat}
            </button>
          ))}
        </div>

        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 rounded-lg whitespace-nowrap transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addExpense')}
        </button>
      </div>

      <div className="bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-titanium-200 dark:border-titanium-800 flex items-center justify-between text-xs text-titanium-500 dark:text-titanium-400">
          <span>
            {filtered.length} {t('items')}
          </span>
          <span>
            {t('totalAmount')}:{' '}
            <strong className="font-mono-num text-sm text-titanium-900 dark:text-titanium-50 ml-1">
              {formatMMK(totalFiltered)}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-titanium-50 dark:bg-titanium-950/60 text-xs text-titanium-500 dark:text-titanium-400 border-b border-titanium-200 dark:border-titanium-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('date')}</th>
                <th className="px-4 py-3 font-medium">{t('category')}</th>
                <th className="px-4 py-3 font-medium">{t('expenseTitle')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('amount')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-100 dark:divide-titanium-800">
              {filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-titanium-50/70 dark:hover:bg-titanium-800/40">
                  <td className="px-5 py-3 font-mono-num text-xs text-titanium-500 dark:text-titanium-400 whitespace-nowrap">
                    {exp.date}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-titanium-600 dark:text-titanium-300">
                    {exp.category}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-titanium-900 dark:text-titanium-50">
                      {exp.title}
                    </div>
                    {exp.note && <div className="text-xs text-titanium-500 dark:text-titanium-400">{exp.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-amber-800 dark:text-amber-400 whitespace-nowrap">
                    {formatMMK(exp.amount)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(exp)}
                      className="inline-flex items-center text-titanium-500 hover:text-burgundy-700 dark:hover:text-burgundy-300 mr-3"
                      aria-label={t('edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="inline-flex items-center text-titanium-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-titanium-500 dark:text-titanium-400">
                    No expenses logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">{t('addExpense')}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-titanium-500 hover:text-titanium-800 dark:hover:text-titanium-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('date')}</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('category')}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
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
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('expenseTitle')}</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
              </div>
              <div>
                <label className="block text-xs text-titanium-500 dark:text-titanium-400 mb-1">{t('amount')}</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
                />
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
    </div>
  );
};
