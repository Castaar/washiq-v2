'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './PhotoUpload.module.scss';

interface PhotoUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number, maxPx: number, quality: number): string {
  const scale = Math.min(1, maxPx / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// Large phone photos (12+ MP, sometimes HEIC) can fail when read as one big data URL.
// Decode via createImageBitmap or an object URL instead, which uses far less memory.
async function compressImage(file: File, maxPx = 1200, quality = 0.75): Promise<string> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      try {
        return drawToJpeg(bmp, bmp.width, bmp.height, maxPx, quality);
      } finally {
        bmp.close?.();
      }
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxPx, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoUpload({ photos, onChange, maxPhotos = 5 }: PhotoUploadProps) {
  const t = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      const remaining = maxPhotos - photos.length;
      const toProcess = Array.from(files).slice(0, remaining);
      // One failing photo must not block the others
      const results = await Promise.allSettled(toProcess.map((f) => compressImage(f)));
      const ok = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value);
      const failed = results.length - ok.length;
      if (ok.length > 0) onChange([...photos, ...ok]);
      if (failed > 0) {
        setError(failed === 1
          ? 'Eén foto kon niet verwerkt worden. Probeer een andere foto of maak een nieuwe.'
          : `${failed} foto's konden niet verwerkt worden. Probeer andere foto's of maak nieuwe.`);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.wrap}>
      {photos.length > 0 && (
        <div className={styles.previews}>
          {photos.map((src, i) => (
            <div key={i} className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${t('foto')} ${i + 1}`} className={styles.thumbImg} />
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} aria-label={t('verwijderFoto')}>×</button>
            </div>
          ))}
        </div>
      )}
      {photos.length < maxPhotos && (
        <>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Foto verwerken…' : `${t('fotoToevoegen')} (${photos.length}/${maxPhotos})`}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className={styles.hidden}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
