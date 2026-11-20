import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Trash2, Truck, X } from 'lucide-react';
import type { DeliveryStatus } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { useT } from '../../i18n/translations';
import { formatMMK, generateVoucherNo, getTodayISO } from '../../lib/format';

export const DeliveryView: React.FC = () => {
  const { deliveries, lang, createDelivery, updateDeliveryStatus, deleteDelivery } = usePos();
  const t = useT(lang);

  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const [voucherNo, setVoucherNo] = useState(generateVoucherNo('DLV'));
  const [date, setDate] = useState(getTodayISO());
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [courierName, setCourierName] = useState('Royal Express');
  const [deliveryFee, setDeliveryFee] = useState('3000');
  const [codAmount, setCodAmount] = useState('0');
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return deliveries;
    return deliveries.filter((d) => d.status === statusFilter);
  }, [deliveries, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !address.trim()) return;
    await createDelivery({
      voucherNo: voucherNo.trim() || generateVoucherNo('DLV'),
      date,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      courierName: courierName.trim() || 'Courier',
      deliveryFee: Number(deliveryFee) || 0,
      codAmount: Number(codAmount) || 0,
      status: 'pending',
      note: note.trim(),
    });
    setModalOpen(false);
    setVoucherNo(generateVoucherNo('DLV'));
    setCustomerName('');
    setPhone('');
    setAddress('');
    setCodAmount('0');
    setNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
          {(['all', 'pending', 'dispatched', 'delivered', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {st === 'all' ? t('allCategories') : t(st)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t('addDelivery')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('voucherNo')}</th>
                <th className="px-4 py-3 font-medium">{t('customerName')}</th>
                <th className="px-4 py-3 font-medium">{t('courierName')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('deliveryFee')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('codAmount')}</th>
                <th className="px-4 py-3 font-medium">{t('status')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((d) => {
                const isTerminal = d.status === 'delivered' || d.status === 'cancelled';
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="font-mono-num font-medium text-slate-900 dark:text-white">
                        {d.voucherNo}
                      </div>
                      <div className="text-xs font-mono-num text-slate-500">{d.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {d.customerName}
                      </div>
                      <div className="text-xs text-slate-500 max-w-xs truncate">
                        {d.address} {d.phone ? `· ${d.phone}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {d.courierName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num whitespace-nowrap">
                      {formatMMK(d.deliveryFee)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold whitespace-nowrap">
                      {formatMMK(d.codAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                      <span
                        className={
                          d.status === 'delivered'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : d.status === 'dispatched'
                            ? 'text-teal-700 dark:text-teal-400'
                            : d.status === 'cancelled'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {t(d.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2.5">
                        {!isTerminal && d.status === 'pending' && (
                          <button
                            onClick={() => updateDeliveryStatus(d.id, 'dispatched')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            {t('markDispatched')}
                          </button>
                        )}
                        {!isTerminal && (
                          <button
                            onClick={() => updateDeliveryStatus(d.id, 'delivered')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('markDelivered')}
                          </button>
                        )}
                        <button
                          onClick={() => deleteDelivery(d.id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No delivery records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden my-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold">{t('addDelivery')}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('voucherNo')}</label>
                  <input
                    required
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('date')}</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('customerName')}</label>
                  <input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('customerPhone')}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('address')}</label>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('courierName')}</label>
                  <input
                    required
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('deliveryFee')}</label>
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('codAmount')}</label>
                  <input
                    type="number"
                    min={0}
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
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
                onClick={() => setModalOpen(false)}
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
