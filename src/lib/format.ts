import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { Sale, ShopSettings } from '../types/pos';

export function formatMMK(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return `${rounded.toLocaleString('en-US')} Ks`;
}

export function calculateSellPrice(costPrice: number, marginPercent: number): number {
  const cost = Math.max(0, Number(costPrice) || 0);
  const margin = Math.max(0, Number(marginPercent) || 0);
  return Math.round(cost * (1 + margin / 100));
}

export function calculateMarginPercent(costPrice: number, sellPrice: number): number {
  const cost = Number(costPrice) || 0;
  const sell = Number(sellPrice) || 0;
  if (cost <= 0) return 0;
  return Math.round(((sell - cost) / cost) * 1000) / 10;
}

export function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateVoucherNo(prefix = 'INV'): string {
  const now = new Date();
  const ymd = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
}

export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * Export tabular rows to CSV with UTF-8 BOM (\uFEFF) so Myanmar Unicode
 * displays cleanly in Microsoft Excel, LibreOffice, and Google Sheets.
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Voucher DOM Node to High-DPI PNG
 */
export async function exportElementToPng(element: HTMLElement, filename: string) {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2.5,
    backgroundColor: '#ffffff',
    skipFonts: true,
  });
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export Voucher DOM Node to Crisp PDF preserving Myanmar Unicode glyphs
 */
export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2.5,
    backgroundColor: '#ffffff',
    skipFonts: true,
  });

  const rect = element.getBoundingClientRect();
  const pdfWidthMm = 88; // Thermal / compact receipt width in mm (clean A6/80mm style)
  const pdfHeightMm = Math.max(110, (rect.height / rect.width) * pdfWidthMm + 8);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidthMm, pdfHeightMm],
  });

  pdf.addImage(dataUrl, 'PNG', 4, 4, pdfWidthMm - 8, (rect.height / rect.width) * (pdfWidthMm - 8));
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function buildTelegramReceiptMessage(shop: ShopSettings, sale: Sale): string {
  const itemsText = sale.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.name} × ${item.qty} = ${formatMMK(item.lineTotal)}`
    )
    .join('\n');

  return [
    `<b>${shop.shopName}</b>`,
    `Voucher: <code>${sale.voucherNo}</code>`,
    `Date: ${sale.date}`,
    sale.customerName ? `Customer: ${sale.customerName}` : '',
    `Payment: ${sale.paymentMethod.toUpperCase()}`,
    `--------------------`,
    itemsText,
    `--------------------`,
    sale.discount > 0 ? `Discount: -${formatMMK(sale.discount)}` : '',
    `<b>Total: ${formatMMK(sale.total)}</b>`,
    `Profit: ${formatMMK(sale.profit)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
