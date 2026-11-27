import React, { useRef, useState } from 'react';
import {
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Send,
  X,
} from 'lucide-react';
import type { Sale } from '../types/pos';
import { usePos } from '../context/PosContext';
import { useT } from '../i18n/translations';
import {
  buildTelegramReceiptMessage,
  exportElementToPdf,
  exportElementToPng,
  formatMMK,
} from '../lib/format';

interface VoucherModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({ sale, onClose }) => {
  const { shop, user, lang, sendTelegramMessage, showToast } = usePos();
  const t = useT(lang);
  const voucherRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'tg' | null>(null);
  const [viewMode, setViewMode] = useState<'ticket' | 'invoice'>('ticket');
  const [showBusinessCard, setShowBusinessCard] = useState(false);

  if (!sale) return null;

  const handleSelectMode = (mode: 'ticket' | 'invoice') => {
    setViewMode(mode);
    if (mode === 'invoice') {
      setShowBusinessCard(true);
    }
  };

  const handleExportPng = async () => {
    if (!voucherRef.current) return;
    setExporting('png');
    try {
      const suffix = viewMode === 'invoice' ? '-invoice' : '';
      await exportElementToPng(voucherRef.current, `${sale.voucherNo}${suffix}.png`, viewMode);
      showToast(lang === 'my' ? 'PNG ဘောင်ချာ ထုတ်ပြီးပါပြီ။' : 'PNG voucher downloaded.');
    } catch {
      showToast(lang === 'my' ? 'PNG ထုတ်ယူမှု မအောင်မြင်ပါ။' : 'PNG export failed.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!voucherRef.current) return;
    setExporting('pdf');
    try {
      const suffix = viewMode === 'invoice' ? '-invoice' : '';
      await exportElementToPdf(voucherRef.current, `${sale.voucherNo}${suffix}.pdf`, viewMode);
      showToast(lang === 'my' ? 'PDF ဘောင်ချာ ထုတ်ပြီးပါပြီ။' : 'PDF voucher downloaded.');
    } catch {
      showToast(lang === 'my' ? 'PDF ထုတ်ယူမှု မအောင်မြင်ပါ။' : 'PDF export failed.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleSendTelegram = async () => {
    setExporting('tg');
    const message = buildTelegramReceiptMessage(shop, sale);
    await sendTelegramMessage(message);
    setExporting(null);
  };

  const changeOrDue = sale.paidAmount - sale.total;
  const paymentStatusLabel =
    changeOrDue >= 0
      ? t('statusPaid')
      : sale.paidAmount > 0
      ? t('statusPartial')
      : t('statusUnpaid');

  const paymentStatusClass =
    changeOrDue >= 0
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : sale.paidAmount > 0
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';

  const initials = (shop.shopName || 'LP')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${
          viewMode === 'invoice' ? 'max-w-3xl' : 'max-w-md'
        } bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl overflow-hidden my-auto shadow-2xl transition-all duration-200`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-titanium-200 dark:border-titanium-800">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 truncate">
            {t('voucherTitle')} · <span className="font-mono-num">{sale.voucherNo}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100 rounded-md transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode & Business Card Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-titanium-50/80 dark:bg-titanium-950/50 border-b border-titanium-200 dark:border-titanium-800">
          <div className="inline-flex items-center gap-1 p-1 bg-titanium-200/75 dark:bg-titanium-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleSelectMode('ticket')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'ticket'
                  ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                  : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{t('compactTicket')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('invoice')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'invoice'
                  ? 'bg-white dark:bg-titanium-900 text-burgundy-800 dark:text-burgundy-200 shadow-xs'
                  : 'text-titanium-600 dark:text-titanium-400 hover:text-titanium-900 dark:hover:text-titanium-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t('detailedInvoice')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBusinessCard((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              showBusinessCard
                ? 'bg-burgundy-50 dark:bg-burgundy-950/70 border-burgundy-300 dark:border-burgundy-700 text-burgundy-800 dark:text-burgundy-200'
                : 'bg-white dark:bg-titanium-900 border-titanium-200 dark:border-titanium-700 text-titanium-600 dark:text-titanium-300 hover:bg-titanium-100 dark:hover:bg-titanium-800'
            }`}
          >
            <IdCard className="w-3.5 h-3.5" />
            <span>{t('businessCard')}</span>
          </button>
        </div>

        {/* Printable / Exportable Voucher Area (Always crisp white paper + deep blue accent for PNG/PDF) */}
        <div className="p-4 sm:p-5 bg-titanium-100/80 dark:bg-titanium-950/80 max-h-[68vh] overflow-auto">
          {viewMode === 'ticket' ? (
            /* COMPACT TICKET VIEW */
            <div className="flex justify-center">
              <div
                ref={voucherRef}
                className="w-full max-w-[360px] bg-white text-titanium-900 border border-titanium-200 p-5 flex flex-col gap-4 leading-[1.75]"
              >
                {/* Shop Header */}
                <div className="text-center flex flex-col gap-1 border-b border-dashed border-titanium-300 pb-3.5">
                  <h2 className="text-base font-bold text-burgundy-800 leading-[1.55]">
                    {shop.shopName}
                  </h2>
                  {shop.shopSubtitle && (
                    <p className="text-xs text-titanium-600 leading-[1.7]">{shop.shopSubtitle}</p>
                  )}
                  {shop.address && (
                    <p className="text-[11px] text-titanium-500 leading-[1.7]">{shop.address}</p>
                  )}
                  {shop.phone && (
                    <p className="text-[11px] font-mono-num text-titanium-600 whitespace-nowrap">
                      {shop.phone}
                    </p>
                  )}
                </div>

                {/* Voucher Meta */}
                <div className="flex flex-col gap-1.5 text-xs text-titanium-700 border-b border-dashed border-titanium-300 pb-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-titanium-500 whitespace-nowrap">{t('voucherNo')}</span>
                    <span className="font-mono-num font-semibold text-titanium-900 whitespace-nowrap">
                      {sale.voucherNo}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-titanium-500 whitespace-nowrap">{t('date')}</span>
                    <span className="font-mono-num whitespace-nowrap">{sale.date}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-titanium-500 whitespace-nowrap">{t('customerName')}</span>
                    <span className="text-right truncate">
                      {sale.customerName || t('walkInCustomer')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-titanium-500 whitespace-nowrap">{t('paymentMethod')}</span>
                    <span className="uppercase font-medium whitespace-nowrap">
                      {sale.paymentMethod}
                    </span>
                  </div>
                </div>

                {/* Line Items */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-titanium-300 text-titanium-500">
                      <th className="text-left py-2 font-medium">{t('itemCol')}</th>
                      <th className="text-right py-2 font-medium whitespace-nowrap px-2">
                        {t('qtyCol')}
                      </th>
                      <th className="text-right py-2 font-medium whitespace-nowrap">
                        {t('amountCol')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-titanium-100">
                    {sale.items.map((item, idx) => (
                      <tr key={`${item.productId}_${idx}`}>
                        <td className="py-2.5 pr-2 align-top">
                          <div className="font-medium text-titanium-900 leading-[1.6]">
                            {item.name}
                          </div>
                          <div className="text-[11px] font-mono-num text-titanium-500 whitespace-nowrap">
                            {formatMMK(item.unitPrice)} / {item.unit}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-num align-top whitespace-nowrap">
                          {item.qty}
                        </td>
                        <td className="py-2.5 text-right font-mono-num font-medium align-top whitespace-nowrap">
                          {formatMMK(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-dashed border-titanium-300 pt-3.5 flex flex-col gap-2 text-xs">
                  <div className="flex items-baseline justify-between gap-4 text-titanium-600">
                    <span className="whitespace-nowrap">{t('subtotal')}</span>
                    <span className="font-mono-num whitespace-nowrap shrink-0">
                      {formatMMK(sale.subtotal)}
                    </span>
                  </div>
                  {sale.discount > 0 && (
                    <div className="flex items-baseline justify-between gap-4 text-titanium-600">
                      <span className="whitespace-nowrap">{t('discount')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        -{formatMMK(sale.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 text-sm font-bold text-burgundy-800 pt-2 border-t border-titanium-200">
                    <span className="whitespace-nowrap">{t('grandTotal')}</span>
                    <span className="font-mono-num whitespace-nowrap shrink-0">
                      {formatMMK(sale.total)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 text-titanium-600">
                    <span className="whitespace-nowrap">{t('paidAmount')}</span>
                    <span className="font-mono-num whitespace-nowrap shrink-0">
                      {formatMMK(sale.paidAmount)}
                    </span>
                  </div>
                  {changeOrDue >= 0 ? (
                    <div className="flex items-baseline justify-between gap-4 text-titanium-600">
                      <span className="whitespace-nowrap">{t('changeAmount')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        {formatMMK(changeOrDue)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-4 text-red-700 font-medium">
                      <span className="whitespace-nowrap">{t('dueAmount')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        {formatMMK(Math.abs(changeOrDue))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Optional Business Card Strip in Ticket Mode */}
                {showBusinessCard && (
                  <div className="rounded-lg border border-burgundy-200 bg-burgundy-50/60 p-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-burgundy-700 whitespace-nowrap">
                        {t('businessCard')}
                      </span>
                      <span className="text-[10px] font-mono-num font-semibold text-titanium-500 whitespace-nowrap">
                        {shop.currency}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-titanium-900 leading-[1.6]">
                      {shop.shopName}
                    </div>
                    {shop.shopSubtitle && (
                      <div className="text-[11px] text-titanium-600 leading-[1.65]">
                        {shop.shopSubtitle}
                      </div>
                    )}
                    <div className="pt-1 flex flex-col gap-1 text-[11px] text-titanium-600">
                      {shop.phone && (
                        <div className="flex items-center gap-1.5 font-mono-num whitespace-nowrap">
                          <Phone className="w-3 h-3 text-burgundy-700 shrink-0" />
                          <span>{shop.phone}</span>
                        </div>
                      )}
                      {shop.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 text-burgundy-700 shrink-0 mt-1" />
                          <span className="leading-[1.65]">{shop.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-dashed border-titanium-300 pt-3 text-center">
                  <p className="text-[11px] text-titanium-500 leading-[1.75]">
                    {shop.receiptFooter || t('thankYou')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* DETAILED INVOICE VIEW (Fixed minimum width to guarantee clean columns on preview & export) */
            <div className="flex justify-start md:justify-center">
              <div
                ref={voucherRef}
                className="w-[680px] min-w-[680px] shrink-0 bg-white text-titanium-900 border border-titanium-200 p-7 flex flex-col gap-6 leading-[1.75]"
              >
                {/* Top Invoice Header */}
                <div className="flex items-start justify-between gap-6 border-b-2 border-burgundy-800 pb-5">
                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-burgundy-700 whitespace-nowrap">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{t('invoiceHeading')}</span>
                    </div>
                    <h2 className="text-xl font-bold text-titanium-950 leading-[1.45]">
                      {shop.shopName}
                    </h2>
                    {shop.shopSubtitle && (
                      <p className="text-xs text-titanium-600 leading-[1.7]">{shop.shopSubtitle}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                    <div className="text-sm font-bold font-mono-num text-burgundy-800 whitespace-nowrap">
                      {sale.voucherNo}
                    </div>
                    <div className="text-xs font-mono-num text-titanium-600 whitespace-nowrap">
                      {t('date')}: <span className="font-semibold text-titanium-900">{sale.date}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11px] uppercase font-medium px-2.5 py-0.5 rounded bg-titanium-100 text-titanium-700 whitespace-nowrap">
                        {sale.paymentMethod}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border whitespace-nowrap ${paymentStatusClass}`}
                      >
                        {paymentStatusLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Business Card & Bill To Section */}
                <div className={`grid ${showBusinessCard ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  {showBusinessCard && (
                    <div className="rounded-xl border border-burgundy-200 bg-gradient-to-br from-burgundy-50/75 via-white to-titanium-50 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold tracking-wide text-burgundy-700 whitespace-nowrap">
                          {t('businessCard')}
                        </span>
                        <span className="text-[11px] font-mono-num font-semibold text-titanium-500 whitespace-nowrap">
                          {shop.currency}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-burgundy-800 text-white font-bold text-xs flex items-center justify-center shrink-0 tracking-wide">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <div className="text-sm font-bold text-titanium-950 truncate leading-[1.5]">
                            {shop.shopName}
                          </div>
                          {shop.shopSubtitle && (
                            <div className="text-[11px] text-titanium-600 truncate leading-[1.6]">
                              {shop.shopSubtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-burgundy-100 flex flex-col gap-1.5 text-xs text-titanium-700">
                        {shop.phone && (
                          <div className="flex items-center gap-2 font-mono-num whitespace-nowrap">
                            <Phone className="w-3.5 h-3.5 text-burgundy-700 shrink-0" />
                            <span>{shop.phone}</span>
                          </div>
                        )}
                        {user?.email && (
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-burgundy-700 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {shop.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-burgundy-700 shrink-0 mt-1" />
                            <span className="leading-[1.65]">{shop.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bill To Card */}
                  <div className="rounded-xl border border-titanium-200 bg-titanium-50/70 p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-wide text-titanium-500 whitespace-nowrap">
                        {t('billTo')}
                      </span>
                      <span className="text-[11px] font-mono-num text-titanium-500 whitespace-nowrap">
                        {sale.items.length} {t('items')}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-titanium-950 leading-[1.55]">
                      {sale.customerName || t('walkInCustomer')}
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-titanium-600">
                      {sale.customerPhone && (
                        <div className="flex items-center gap-2 font-mono-num whitespace-nowrap">
                          <Phone className="w-3.5 h-3.5 text-titanium-400 shrink-0" />
                          <span>{sale.customerPhone}</span>
                        </div>
                      )}
                      <div className="whitespace-nowrap">
                        <span className="text-titanium-500">{t('paymentMethod')}: </span>
                        <span className="uppercase font-medium text-titanium-800">
                          {sale.paymentMethod}
                        </span>
                      </div>
                      {sale.note && (
                        <div className="pt-1.5 text-[11px] text-titanium-500 border-t border-titanium-200/80 leading-[1.65]">
                          {t('note')}: {sale.note}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Line Items Table */}
                <div className="border border-titanium-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-burgundy-50/60 text-burgundy-900 border-b border-titanium-200">
                      <tr>
                        <th className="text-left px-3.5 py-2.5 font-semibold w-9 whitespace-nowrap">
                          #
                        </th>
                        <th className="text-left px-3.5 py-2.5 font-semibold whitespace-nowrap">
                          {t('sku')}
                        </th>
                        <th className="text-left px-3.5 py-2.5 font-semibold">{t('itemCol')}</th>
                        <th className="text-right px-3.5 py-2.5 font-semibold whitespace-nowrap">
                          {t('qtyCol')}
                        </th>
                        <th className="text-right px-3.5 py-2.5 font-semibold whitespace-nowrap">
                          {t('priceCol')}
                        </th>
                        <th className="text-right px-3.5 py-2.5 font-semibold whitespace-nowrap">
                          {t('amountCol')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-titanium-100">
                      {sale.items.map((item, idx) => (
                        <tr key={`${item.productId}_${idx}`}>
                          <td className="px-3.5 py-3 font-mono-num text-titanium-500 whitespace-nowrap align-top">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-3 font-mono-num text-titanium-600 whitespace-nowrap align-top">
                            {item.sku}
                          </td>
                          <td className="px-3.5 py-3 align-top">
                            <div className="font-medium text-titanium-950 leading-[1.6]">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-titanium-500 leading-[1.5]">
                              {item.unit}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap align-top">
                            {item.qty}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono-num text-titanium-700 whitespace-nowrap align-top">
                            {formatMMK(item.unitPrice)}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono-num font-semibold text-titanium-950 whitespace-nowrap align-top">
                            {formatMMK(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals & Footer Signature Row */}
                <div className="grid grid-cols-12 gap-6 pt-1 items-end">
                  <div className="col-span-5 flex flex-col gap-6">
                    <p className="text-xs text-titanium-600 leading-[1.75]">
                      {shop.receiptFooter || t('thankYou')}
                    </p>
                    <div className="pt-5 max-w-[200px]">
                      <div className="border-t border-titanium-300 pt-2 text-[11px] text-titanium-500 whitespace-nowrap">
                        {t('authorizedSignature')}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-7 rounded-xl border border-titanium-200 bg-titanium-50/75 p-4 flex flex-col gap-2.5 text-xs">
                    <div className="flex items-baseline justify-between gap-6 text-titanium-600">
                      <span className="whitespace-nowrap">{t('subtotal')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        {formatMMK(sale.subtotal)}
                      </span>
                    </div>
                    {sale.discount > 0 && (
                      <div className="flex items-baseline justify-between gap-6 text-titanium-600">
                        <span className="whitespace-nowrap">{t('discount')}</span>
                        <span className="font-mono-num whitespace-nowrap shrink-0">
                          -{formatMMK(sale.discount)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-6 text-sm font-bold text-burgundy-800 pt-2 border-t border-titanium-200">
                      <span className="whitespace-nowrap">{t('grandTotal')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        {formatMMK(sale.total)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-6 text-titanium-600 pt-0.5">
                      <span className="whitespace-nowrap">{t('paidAmount')}</span>
                      <span className="font-mono-num whitespace-nowrap shrink-0">
                        {formatMMK(sale.paidAmount)}
                      </span>
                    </div>
                    {changeOrDue >= 0 ? (
                      <div className="flex items-baseline justify-between gap-6 text-titanium-600">
                        <span className="whitespace-nowrap">{t('changeAmount')}</span>
                        <span className="font-mono-num whitespace-nowrap shrink-0">
                          {formatMMK(changeOrDue)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-6 text-red-700 font-semibold">
                        <span className="whitespace-nowrap">{t('dueAmount')}</span>
                        <span className="font-mono-num whitespace-nowrap shrink-0">
                          {formatMMK(Math.abs(changeOrDue))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800 bg-white dark:bg-titanium-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPng}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting === 'png' ? '...' : t('exportPng')}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              {exporting === 'pdf' ? '...' : t('exportPdf')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSendTelegram}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-burgundy-700 dark:text-burgundy-300 hover:bg-burgundy-50 dark:hover:bg-burgundy-950/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {exporting === 'tg' ? '...' : t('sendTelegram')}
          </button>
        </div>
      </div>
    </div>
  );
};
