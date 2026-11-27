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
  return Math.round(((sell - cost) / cost) * 10000) / 100;
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

let cachedFontEmbedCssPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function getEmbeddedPaOhFontCss(): Promise<string> {
  if (!cachedFontEmbedCssPromise) {
    cachedFontEmbedCssPromise = (async () => {
      try {
        const res = await fetch('/fonts/PaOhMyanmarPyum.ttf');
        if (!res.ok) return '';
        const buffer = await res.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        return `@font-face {
  font-family: "PaOhMyanmarPyum";
  src: url("data:font/ttf;base64,${base64}") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
* {
  font-family: "PaOhMyanmarPyum", sans-serif !important;
}`;
      } catch {
        return '';
      }
    })();
  }
  return cachedFontEmbedCssPromise;
}

async function renderVoucherSnapshot(
  element: HTMLElement,
  mode: 'ticket' | 'invoice' = 'ticket'
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  const fontEmbedCSS = await getEmbeddedPaOhFontCss();
  const targetWidth = mode === 'invoice' ? 720 : 380;

  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '0';
  sandbox.style.width = `${targetWidth}px`;
  sandbox.style.backgroundColor = '#ffffff';
  sandbox.style.zIndex = '-1';
  sandbox.style.pointerEvents = 'none';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${targetWidth}px`;
  clone.style.maxWidth = `${targetWidth}px`;
  clone.style.minWidth = `${targetWidth}px`;
  clone.style.margin = '0';
  clone.style.boxSizing = 'border-box';
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const rect = clone.getBoundingClientRect();
    const width = Math.max(targetWidth, Math.ceil(rect.width));
    const height = Math.max(100, Math.ceil(rect.height));

    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2.5,
      width,
      height,
      backgroundColor: '#ffffff',
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    });

    return { dataUrl, width, height };
  } finally {
    document.body.removeChild(sandbox);
  }
}

/**
 * Export Voucher DOM Node to High-DPI PNG with embedded PaOhMyanmarPyum font
 */
export async function exportElementToPng(
  element: HTMLElement,
  filename: string,
  mode: 'ticket' | 'invoice' = 'ticket'
) {
  const { dataUrl } = await renderVoucherSnapshot(element, mode);
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export Voucher DOM Node to Crisp PDF preserving PaOhMyanmarPyum Myanmar Unicode glyphs
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  mode: 'ticket' | 'invoice' = 'ticket'
) {
  const { dataUrl, width, height } = await renderVoucherSnapshot(element, mode);
  const safeRatio = width > 0 ? height / width : 1.4;

  if (mode === 'invoice') {
    const pdfWidthMm = 210; // A4 width
    const marginMm = 10;
    const contentWidthMm = pdfWidthMm - marginMm * 2;
    const contentHeightMm = safeRatio * contentWidthMm;
    const pdfHeightMm = Math.max(297, contentHeightMm + marginMm * 2);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm],
    });

    pdf.addImage(dataUrl, 'PNG', marginMm, marginMm, contentWidthMm, contentHeightMm);
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return;
  }

  const pdfWidthMm = 88; // Thermal / compact receipt width in mm (clean A6/80mm style)
  const pdfHeightMm = Math.max(110, safeRatio * pdfWidthMm + 8);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidthMm, pdfHeightMm],
  });

  pdf.addImage(dataUrl, 'PNG', 4, 4, pdfWidthMm - 8, safeRatio * (pdfWidthMm - 8));
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
