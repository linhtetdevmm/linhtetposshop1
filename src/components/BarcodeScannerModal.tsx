import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, CheckCircle2, RefreshCw, ScanBarcode, TriangleAlert, X } from 'lucide-react';
import type { Language, Product } from '../types/pos';
import { useT } from '../i18n/translations';
import { formatMMK } from '../lib/format';

interface BarcodeScannerModalProps {
  open: boolean;
  products: Product[];
  lang: Language;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
}

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 200);
  } catch {
    // Ignore audio context errors
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  products,
  lang,
  onClose,
  onAddProduct,
}) => {
  const t = useT(lang);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const productsRef = useRef(products);
  const onAddProductRef = useRef(onAddProduct);
  const onCloseRef = useRef(onClose);

  productsRef.current = products;
  onAddProductRef.current = onAddProduct;
  onCloseRef.current = onClose;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [continuousScan, setContinuousScan] = useState(true);
  const continuousScanRef = useRef(continuousScan);
  continuousScanRef.current = continuousScan;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastFeedback, setLastFeedback] = useState<{
    type: 'success' | 'error';
    code: string;
    productName?: string;
    price?: number;
  } | null>(null);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // Ignore stop error
    }
    controlsRef.current = null;

    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    try {
      BrowserCodeReader.releaseAllStreams();
    } catch {
      // Ignore release error
    }
  }, []);

  const handleDecodedCode = useCallback(
    (rawCode: string, force = false) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      if (
        !force &&
        lastScanRef.current.code === code &&
        now - lastScanRef.current.time < 1200
      ) {
        return;
      }
      lastScanRef.current = { code, time: now };

      const normalized = code.toLowerCase();
      const matched = productsRef.current.find(
        (p) => p.sku.trim().toLowerCase() === normalized || p.id.toLowerCase() === normalized
      );

      if (matched) {
        playBeep();
        onAddProductRef.current(matched);
        setLastFeedback({
          type: 'success',
          code,
          productName: matched.name,
          price: matched.sellPrice,
        });
        if (!continuousScanRef.current) {
          stopCamera();
          onCloseRef.current();
        }
      } else {
        setLastFeedback({
          type: 'error',
          code,
        });
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setLastFeedback(null);
      setCameraError(null);
      return;
    }

    let cancelled = false;
    const startScanner = async () => {
      setCameraStarting(true);
      setCameraError(null);
      stopCamera();

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t('cameraUnavailable'));
        setCameraStarting(false);
        return;
      }

      try {
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 900,
        });

        try {
          const videoDevices = await BrowserCodeReader.listVideoInputDevices();
          if (!cancelled) {
            setDevices(videoDevices);
          }
        } catch {
          // Device enumeration is optional
        }

        if (cancelled || !videoRef.current) return;

        const callback = (result: { getText: () => string } | undefined) => {
          if (result && !cancelled) {
            handleDecodedCode(result.getText());
          }
        };

        const controls = selectedDeviceId
          ? await reader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, callback)
          : await reader.decodeFromConstraints(
              {
                video: {
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: false,
              },
              videoRef.current,
              callback
            );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setCameraError(t('cameraUnavailable'));
        }
      } finally {
        if (!cancelled) {
          setCameraStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, selectedDeviceId, handleDecodedCode, stopCamera, t]);

  if (!open) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode, true);
    setManualCode('');
  };

  const handleCycleCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % devices.length;
    setSelectedDeviceId(devices[nextIndex].deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-titanium-950/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-titanium-200 dark:border-titanium-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-burgundy-50 dark:bg-burgundy-950/80 text-burgundy-700 dark:text-burgundy-300 flex items-center justify-center shrink-0">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-titanium-900 dark:text-titanium-50 truncate">
                {t('scannerTitle')}
              </h3>
              <p className="text-[11px] text-titanium-500 dark:text-titanium-400 truncate">
                {t('scannerHint')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-titanium-500 hover:text-titanium-900 dark:hover:text-titanium-100 rounded-lg hover:bg-titanium-100 dark:hover:bg-titanium-800 transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-5 space-y-4">
          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-titanium-950 border border-titanium-200 dark:border-titanium-800">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Viewfinder Frame Overlay */}
            {!cameraError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-36 max-w-[78%] rounded-lg border border-white/20 bg-titanium-950/10">
                  <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-burgundy-400 rounded-tl" />
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-burgundy-400 rounded-tr" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-burgundy-400 rounded-bl" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-burgundy-400 rounded-br" />
                  <div className="absolute inset-x-3 top-1/2 h-0.5 bg-burgundy-400/75 shadow-[0_0_8px_rgba(92,142,255,0.85)]" />
                </div>
              </div>
            )}

            {/* Loading State */}
            {cameraStarting && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-titanium-950/70 text-titanium-100 text-xs">
                <Camera className="w-6 h-6 text-burgundy-400 animate-pulse" />
                <span>{lang === 'my' ? 'ကင်မရာ ဖွင့်နေပါသည်...' : 'Starting camera...'}</span>
              </div>
            )}

            {/* Error State */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6 text-center bg-titanium-950 text-titanium-200">
                <TriangleAlert className="w-7 h-7 text-amber-400" />
                <p className="text-xs leading-relaxed text-titanium-300 max-w-xs">
                  {cameraError}
                </p>
              </div>
            )}
          </div>

          {/* Live Scan Feedback Banner */}
          {lastFeedback && (
            <div
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-xs ${
                lastFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {lastFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <TriangleAlert className="w-4 h-4 shrink-0" />
                )}
                <div className="min-w-0 truncate">
                  {lastFeedback.type === 'success' ? (
                    <>
                      <span className="font-semibold">{lastFeedback.productName}</span>
                      <span className="ml-1.5 opacity-85">· {t('barcodeAdded')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('barcodeNotFound')}: </span>
                      <span className="font-mono-num font-semibold">{lastFeedback.code}</span>
                    </>
                  )}
                </div>
              </div>
              {lastFeedback.price !== undefined && (
                <span className="font-mono-num font-semibold shrink-0">
                  {formatMMK(lastFeedback.price)}
                </span>
              )}
            </div>
          )}

          {/* Controls Row: Continuous toggle + Camera switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer text-titanium-700 dark:text-titanium-300 select-none">
              <input
                type="checkbox"
                checked={continuousScan}
                onChange={(e) => setContinuousScan(e.target.checked)}
                className="rounded border-titanium-300 dark:border-titanium-700 text-burgundy-700 focus:ring-burgundy-600"
              />
              <span>{t('continuousScan')}</span>
            </label>

            {devices.length > 1 && (
              <button
                type="button"
                onClick={handleCycleCamera}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-200 bg-titanium-100 dark:bg-titanium-800 hover:bg-titanium-200 dark:hover:bg-titanium-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('switchCamera')}
              </button>
            )}
          </div>

          {/* Manual / USB Wedge SKU Fallback */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t('manualBarcodePlaceholder')}
              className="flex-1 px-3 py-2 text-xs font-mono-num bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-600/30 focus:border-burgundy-600"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-45 rounded-lg whitespace-nowrap shrink-0 transition-colors"
            >
              {t('addItem')}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3.5 border-t border-titanium-200 dark:border-titanium-800 bg-titanium-50/70 dark:bg-titanium-950/40">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-titanium-700 dark:text-titanium-200 bg-white dark:bg-titanium-800 border border-titanium-200 dark:border-titanium-700 hover:bg-titanium-100 dark:hover:bg-titanium-700 rounded-lg transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
