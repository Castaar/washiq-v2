'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import styles from './DiversenPanel.module.scss';

export interface BirthdayPerson {
  id: string;
  name: string;
  isToday: boolean;
}

export interface AnnouncementItem {
  id: string;
  text: string;
  text_fr?: string;
  kind: 'general' | 'birthday';
  created_by_name: string;
  created_at: string;
  isAllSites: boolean;
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { day: 'numeric', month: 'short' });
}

export function DiversenPanel({
  birthdays,
  announcements: initialAnnouncements,
  canPostGeneral,
  siteId,
  siteName,
}: {
  birthdays: BirthdayPerson[];
  announcements: AnnouncementItem[];
  canPostGeneral: boolean;
  siteId?: string;
  siteName?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('diversen');
  const tCommon = useTranslations('common');
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [wishedIds, setWishedIds] = useState<string[]>([]);
  const [generalText, setGeneralText] = useState('');
  const [generalTextFr, setGeneralTextFr] = useState('');
  const [perSiteOnly, setPerSiteOnly] = useState(false);
  const [posting, setPosting] = useState(false);

  function displayText(a: AnnouncementItem) {
    return locale === 'fr' && a.text_fr ? a.text_fr : a.text;
  }

  async function handleWish(person: BirthdayPerson) {
    const text = `🎉 Gelukkige verjaardag, ${person.name}!`;
    const text_fr = `🎉 Joyeux anniversaire, ${person.name} !`;
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, text_fr, kind: 'birthday', is_all_sites: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      setAnnouncements((prev) => [
        { id: data.id, text, text_fr, kind: 'birthday', created_by_name: '', created_at: new Date().toISOString(), isAllSites: true },
        ...prev,
      ]);
      setWishedIds((prev) => [...prev, person.id]);
    }
  }

  async function handlePostGeneral() {
    if (!generalText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: generalText.trim(),
          text_fr: generalTextFr.trim(),
          kind: 'general',
          is_all_sites: !perSiteOnly,
          siteId: perSiteOnly ? siteId : undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setAnnouncements((prev) => [
          { id: data.id, text: generalText.trim(), text_fr: generalTextFr.trim(), kind: 'general', created_by_name: '', created_at: new Date().toISOString(), isAllSites: !perSiteOnly },
          ...prev,
        ]);
        setGeneralText('');
        setGeneralTextFr('');
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {birthdays.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('verjaardagenVandaag')}</h2>
          <div className={styles.birthdayList}>
            {birthdays.map((b) => (
              <div key={b.id} className={styles.birthdayRow}>
                <span className={styles.birthdayName}>{b.name}</span>
                <button
                  type="button"
                  className={styles.wishBtn}
                  onClick={() => handleWish(b)}
                  disabled={wishedIds.includes(b.id)}
                >
                  {wishedIds.includes(b.id) ? t('gewenst') : t('wensVerjaardag')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {canPostGeneral && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('algemeenBericht')}</h2>
          <textarea
            className={styles.textarea}
            placeholder={t('berichtPlaceholder')}
            value={generalText}
            onChange={(e) => setGeneralText(e.target.value)}
            rows={3}
          />
          <textarea
            className={styles.textarea}
            placeholder={t('berichtFrPlaceholder')}
            value={generalTextFr}
            onChange={(e) => setGeneralTextFr(e.target.value)}
            rows={3}
          />
          {siteId && (
            <label className={styles.perSiteToggle}>
              <input
                type="checkbox"
                checked={perSiteOnly}
                onChange={(e) => setPerSiteOnly(e.target.checked)}
              />
              {t('enkelVoor', { site: siteName || t('ditFiliaal') })}
            </label>
          )}
          <button
            type="button"
            className={styles.postBtn}
            onClick={handlePostGeneral}
            disabled={posting || !generalText.trim()}
          >
            {posting ? tCommon('bezig') : t('plaatsen')}
          </button>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('recenteBerichten')}</h2>
        {announcements.length === 0 ? (
          <p className={styles.empty}>{t('nogGeenBerichten')}</p>
        ) : (
          <div className={styles.list}>
            {announcements.map((a) => (
              <div key={a.id} className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">{a.kind === 'birthday' ? '🎉' : '📢'}</span>
                <div className={styles.itemBody}>
                  <p className={styles.itemText}>{displayText(a)}</p>
                  <span className={styles.itemMeta}>
                    {a.created_by_name && `${a.created_by_name} · `}{fmtDate(a.created_at, locale)}
                    {a.kind === 'general' && !a.isAllSites && ` · ${t('ditFiliaal')}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
