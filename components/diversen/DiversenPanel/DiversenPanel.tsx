'use client';

import { useState } from 'react';
import styles from './DiversenPanel.module.scss';

export interface BirthdayPerson {
  id: string;
  name: string;
  isToday: boolean;
}

export interface AnnouncementItem {
  id: string;
  text: string;
  kind: 'general' | 'birthday';
  created_by_name: string;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

export function DiversenPanel({
  birthdays,
  announcements: initialAnnouncements,
  canPostGeneral,
}: {
  birthdays: BirthdayPerson[];
  announcements: AnnouncementItem[];
  canPostGeneral: boolean;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [wishedIds, setWishedIds] = useState<string[]>([]);
  const [generalText, setGeneralText] = useState('');
  const [posting, setPosting] = useState(false);

  async function handleWish(person: BirthdayPerson) {
    const text = `🎉 Gelukkige verjaardag, ${person.name}!`;
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, kind: 'birthday', is_all_sites: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      setAnnouncements((prev) => [
        { id: data.id, text, kind: 'birthday', created_by_name: '', created_at: new Date().toISOString() },
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
        body: JSON.stringify({ text: generalText.trim(), kind: 'general', is_all_sites: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setAnnouncements((prev) => [
          { id: data.id, text: generalText.trim(), kind: 'general', created_by_name: '', created_at: new Date().toISOString() },
          ...prev,
        ]);
        setGeneralText('');
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {birthdays.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎂 Verjaardagen vandaag</h2>
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
                  {wishedIds.includes(b.id) ? 'Gewenst ✓' : 'Wens gelukkige verjaardag'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {canPostGeneral && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Algemeen bericht (alle filialen)</h2>
          <textarea
            className={styles.textarea}
            placeholder="Bv. Start promotie morgen!"
            value={generalText}
            onChange={(e) => setGeneralText(e.target.value)}
            rows={3}
          />
          <button
            type="button"
            className={styles.postBtn}
            onClick={handlePostGeneral}
            disabled={posting || !generalText.trim()}
          >
            {posting ? 'Bezig...' : 'Plaatsen'}
          </button>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recente berichten</h2>
        {announcements.length === 0 ? (
          <p className={styles.empty}>Nog geen berichten.</p>
        ) : (
          <div className={styles.list}>
            {announcements.map((a) => (
              <div key={a.id} className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">{a.kind === 'birthday' ? '🎉' : '📢'}</span>
                <div className={styles.itemBody}>
                  <p className={styles.itemText}>{a.text}</p>
                  <span className={styles.itemMeta}>
                    {a.created_by_name && `${a.created_by_name} · `}{fmtDate(a.created_at)}
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
