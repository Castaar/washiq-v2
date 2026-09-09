'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import styles from './BottomSheet.module.scss';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const t = useTranslations('common');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} />
        {title && (
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('sluiten')}>×</button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
