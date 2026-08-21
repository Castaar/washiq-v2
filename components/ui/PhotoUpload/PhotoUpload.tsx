'use client';

import { useRef } from 'react';
import styles from './PhotoUpload.module.scss';

interface PhotoUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

function compressImage(file: File, maxPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoUpload({ photos, onChange, maxPhotos = 5 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxPhotos - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const compressed = await Promise.all(toProcess.map((f) => compressImage(f)));
    onChange([...photos, ...compressed]);
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
              <img src={src} alt={`Foto ${i + 1}`} className={styles.thumbImg} />
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} aria-label="Verwijder foto">×</button>
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
          >
            + Foto toevoegen ({photos.length}/{maxPhotos})
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
    </div>
  );
}
