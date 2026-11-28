import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Package, Trash2 } from 'lucide-react';
import type { Language } from '../types/pos';
import { useT } from '../i18n/translations';
import { compressProductImageFile, sanitizeProductImageUrl } from '../lib/imageUtils';

interface ProductImagePickerProps {
  value: string;
  onChange: (nextUrl: string) => void;
  lang: Language;
}

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  value,
  onChange,
  lang,
}) => {
  const t = useT(lang);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(() => Boolean(value && /^https?:\/\//i.test(value)));
  const [urlDraft, setUrlDraft] = useState(() => (/^https?:\/\//i.test(value) ? value : ''));
  const [errorMsg, setErrorMsg] = useState('');

  const safePreview = sanitizeProductImageUrl(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setProcessing(true);
    setErrorMsg('');
    try {
      const compressed = await compressProductImageFile(file);
      onChange(compressed);
      setShowUrlInput(false);
      setUrlDraft('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'my'
          ? 'ပုံဖတ်၍မရပါ။'
          : 'Failed to process image.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleUrlChange = (raw: string) => {
    setUrlDraft(raw);
    setErrorMsg('');
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      return;
    }
    const sanitized = sanitizeProductImageUrl(trimmed);
    if (sanitized) {
      onChange(sanitized);
    } else if (/^https?:\/\//i.test(trimmed)) {
      setErrorMsg(lang === 'my' ? 'ပုံလင့်ပုံစံ မမှန်ကန်ပါ။' : 'Invalid image URL.');
    }
  };

  return (
    <div className="bg-titanium-50 dark:bg-titanium-950 border border-titanium-200 dark:border-titanium-800 rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-titanium-700 dark:text-titanium-300">
          {t('productImage')}
        </label>
        <span className="text-[11px] text-titanium-400 dark:text-titanium-500">
          {t('imageOptionalHint')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg border border-titanium-200 dark:border-titanium-700 bg-white dark:bg-titanium-900 overflow-hidden flex items-center justify-center shrink-0">
          {safePreview ? (
            <img
              src={safePreview}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setErrorMsg(lang === 'my' ? 'ပုံပြသ၍မရပါ။' : 'Could not load image preview.')}
            />
          ) : (
            <Package className="w-6 h-6 text-titanium-300 dark:text-titanium-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-burgundy-700 hover:bg-burgundy-800 dark:bg-burgundy-600 dark:hover:bg-burgundy-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {processing ? '...' : t('uploadImage')}
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-titanium-700 dark:text-titanium-300 bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 hover:bg-titanium-100 dark:hover:bg-titanium-800 rounded-lg transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              URL
            </button>

            {safePreview && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setUrlDraft('');
                  setErrorMsg('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('removeImage')}
              </button>
            )}
          </div>

          {showUrlInput && (
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={t('imageUrlPlaceholder')}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-titanium-900 border border-titanium-200 dark:border-titanium-700 rounded-lg focus:outline-none focus:border-burgundy-600"
            />
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
    </div>
  );
};
