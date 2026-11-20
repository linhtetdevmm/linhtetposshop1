import React, { useRef, useState } from 'react';
import { Download, FileText, Send, X } from 'lucide-react';
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
  const { shop, lang, sendTelegramMessage, showToast } = usePos();
  const t = useT(lang);
  const voucherRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'tg' | null>(null);

  if (!sale) return null;

  const handleExportPng = async () => {
    if (!voucherRef.current) return;
    setExporting('png');
    try {
      await exportElementToPng(voucherRef.current, `${sale.voucherNo}.png`);
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
      await exportElementToPdf(voucherRef.current, `${sale.voucherNo}.pdf`);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-titanium-200 dark:border-titanium-800">
          <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50">
            {t('voucherTitle')} · <span className="font-mono-num">{sale.voucherNo}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100 rounded-md transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable / Exportable Voucher Area (Always crisp white paper + burgundy accent for PNG/PDF) */}
        <div className="p-5 bg-titanium-50 dark:bg-titanium-950/70 flex justify-center">
          <div
            ref={voucherRef}
            className="w-full max-w-[360px] bg-white text-titanium-900 border border-titanium-200 p-5 space-y-4"
          >
            {/* Shop Header */}
            <div className="text-center space-y-1 border-b border-dashed border-titanium-300 pb-3">
              <h2 className="text-base font-bold tracking-tight text-burgundy-800">
                {shop.shopName}
              </h2>
              {shop.shopSubtitle && (
                <p className="text-xs text-titanium-600">{shop.shopSubtitle}</p>
              )}
              {shop.address && (
                <p className="text-[11px] text-titanium-500 leading-relaxed">{shop.address}</p>
              )}
              {shop.phone && (
                <p className="text-[11px] font-mono-num text-titanium-600">{shop.phone}</p>
              )}
            </div>

            {/* Voucher Meta */}
            <div className="grid grid-cols-2 gap-y-1 text-xs text-titanium-700 border-b border-dashed border-titanium-300 pb-3">
              <span className="text-titanium-500">{t('voucherNo')}</span>
              <span className="text-right font-mono-num font-semibold text-titanium-900">{sale.voucherNo}</span>

              <span className="text-titanium-500">{t('date')}</span>
              <span className="text-right font-mono-num">{sale.date}</span>

              <span className="text-titanium-500">{t('customerName')}</span>
              <span className="text-right truncate">
                {sale.customerName || t('walkInCustomer')}
              </span>

              <span className="text-titanium-500">{t('paymentMethod')}</span>
              <span className="text-right uppercase font-medium">{sale.paymentMethod}</span>
            </div>

            {/* Line Items */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-titanium-300 text-titanium-500">
                  <th className="text-left py-1.5 font-medium">{t('itemCol')}</th>
                  <th className="text-right py-1.5 font-medium w-10">{t('qtyCol')}</th>
                  <th className="text-right py-1.5 font-medium w-20">{t('amountCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-100">
                {sale.items.map((item, idx) => (
                  <tr key={`${item.productId}_${idx}`}>
                    <td className="py-2 pr-2 align-top">
                      <div className="font-medium text-titanium-900 leading-snug">{item.name}</div>
                      <div className="text-[11px] font-mono-num text-titanium-500">
                        {formatMMK(item.unitPrice)} / {item.unit}
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono-num align-top">{item.qty}</td>
                    <td className="py-2 text-right font-mono-num font-medium align-top">
                      {formatMMK(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-dashed border-titanium-300 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-titanium-600">
                <span>{t('subtotal')}</span>
                <span className="font-mono-num">{formatMMK(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-titanium-600">
                  <span>{t('discount')}</span>
                  <span className="font-mono-num">-{formatMMK(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-burgundy-800 pt-1 border-t border-titanium-200">
                <span>{t('grandTotal')}</span>
                <span className="font-mono-num">{formatMMK(sale.total)}</span>
              </div>
              <div className="flex justify-between text-titanium-600">
                <span>{t('paidAmount')}</span>
                <span className="font-mono-num">{formatMMK(sale.paidAmount)}</span>
              </div>
              {changeOrDue >= 0 ? (
                <div className="flex justify-between text-titanium-600">
                  <span>{t('changeAmount')}</span>
                  <span className="font-mono-num">{formatMMK(changeOrDue)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-red-700 font-medium">
                  <span>{t('dueAmount')}</span>
                  <span className="font-mono-num">{formatMMK(Math.abs(changeOrDue))}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-titanium-300 pt-3 text-center">
              <p className="text-[11px] text-titanium-500 leading-relaxed">
                {shop.receiptFooter || t('thankYou')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800 bg-white dark:bg-titanium-900">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPng}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting === 'png' ? '...' : t('exportPng')}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              {exporting === 'pdf' ? '...' : t('exportPdf')}
            </button>
          </div>
          <button
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
