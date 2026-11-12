'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import styles from './KoppelingenPanel.module.scss';

type Provider = 'mycarwash' | 'shayp';

interface Connection {
  id: string;
  provider: Provider;
  label: string;
  baseUrl: string;
  username: string;
  customerId: string;
  lastOkAt: string | null;
  lastError: string;
}

interface ProgramMapRow { number: number; name: string; programId: string }

interface Link {
  provider: Provider;
  connectionId: string;
  enabled: boolean;
  externalId: string;
  externalName: string;
  programMap: ProgramMapRow[];
  lastSyncedAt: string | null;
  lastError: string;
}

interface Target { id: string; name: string; detail?: string }

interface Props {
  siteId: string;
  siteName: string;
  siteType: 'wasstraat' | 'selfcarwash';
  programs: { id: string; name: string }[];
}

const EMPTY_DRAFT = { provider: 'mycarwash' as Provider, label: '', baseUrl: '', username: '', customerId: '', secret: '' };

export function KoppelingenPanel({ siteId, siteName, siteType, programs }: Props) {
  const t = useTranslations('koppelingen');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const fmtWhen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }) : '—';

  const [connections, setConnections] = useState<Connection[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [seenPrograms, setSeenPrograms] = useState<{ number: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [c, s] = await Promise.all([
        fetch('/api/integrations/connections').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch(`/api/integrations/site?siteId=${siteId}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      ]);
      setConnections(c as Connection[]);
      setLinks((s as { links: Link[] }).links);
      setSeenPrograms((s as { seenPrograms: { number: number; name: string }[] }).seenPrograms);
    } catch {
      setLoadError(t('ladenMislukt'));
    } finally {
      setLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => { load(); }, [load]);

  async function handleAddConnection(e: React.FormEvent) {
    e.preventDefault();
    setSavingNew(true);
    setNewError('');
    try {
      const res = await fetch('/api/integrations/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNewError((data as { error?: string }).error ?? t('opslaanMislukt')); return; }
      setDraft(EMPTY_DRAFT);
      setShowNew(false);
      await load();
    } finally {
      setSavingNew(false);
    }
  }

  async function handleDeleteConnection(c: Connection) {
    if (!window.confirm(t('verwijderenBevestig', { label: c.label }))) return;
    const res = await fetch(`/api/integrations/connections/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert((data as { error?: string }).error ?? t('opslaanMislukt'));
      return;
    }
    await load();
  }

  const providers: Provider[] = siteType === 'selfcarwash' ? ['shayp'] : ['mycarwash', 'shayp'];

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('titel', { site: siteName })}</h2>
      </div>
      <p className={styles.hint}>{t('uitleg')}</p>

      {loading ? (
        <p className={styles.muted}>{t('laden')}</p>
      ) : loadError ? (
        <p className={styles.error}>{loadError}</p>
      ) : (
        <>
          {providers.map((p) => (
            <SiteLinkCard
              key={p}
              provider={p}
              siteId={siteId}
              link={links.find((l) => l.provider === p) ?? null}
              connections={connections.filter((c) => c.provider === p)}
              programs={programs}
              seenPrograms={seenPrograms}
              onSaved={load}
              fmtWhen={fmtWhen}
            />
          ))}

          <div className={styles.subhead}>
            <h3 className={styles.subtitle}>{t('mijnKoppelingen')}</h3>
            {!showNew && (
              <button type="button" className={styles.btn} onClick={() => setShowNew(true)}>{t('nieuweKoppeling')}</button>
            )}
          </div>
          {connections.length === 0 && !showNew && <p className={styles.muted}>{t('geenKoppelingen')}</p>}
          <ul className={styles.connList}>
            {connections.map((c) => (
              <li key={c.id} className={styles.connRow}>
                <span className={styles.connName}>{c.label}</span>
                <span className={styles.badge}>{t(`provider.${c.provider}`)}</span>
                <span className={c.lastError ? styles.error : styles.muted}>
                  {c.lastError ? c.lastError : t('laatstOk', { when: fmtWhen(c.lastOkAt) })}
                </span>
                <button type="button" className={styles.linkBtn} onClick={() => handleDeleteConnection(c)}>{t('verwijderen')}</button>
              </li>
            ))}
          </ul>

          {showNew && (
            <form className={styles.newForm} onSubmit={handleAddConnection} noValidate autoComplete="off">
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('type')}</span>
                  <select className={styles.input} value={draft.provider} onChange={(e) => setDraft({ ...EMPTY_DRAFT, provider: e.target.value as Provider })}>
                    <option value="mycarwash">{t('provider.mycarwash')}</option>
                    <option value="shayp">{t('provider.shayp')}</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('naam')}</span>
                  <input className={styles.input} value={draft.label} placeholder={t(`provider.${draft.provider}`)} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                </label>
                {draft.provider === 'mycarwash' ? (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('apiUrl')}</span>
                      <input className={styles.input} value={draft.baseUrl} placeholder="https://…/integration3" onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('gebruikersnaam')}</span>
                      <input className={styles.input} value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('wachtwoord')}</span>
                      <input className={styles.input} type="password" autoComplete="new-password" value={draft.secret} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('klantId')}</span>
                      <input className={styles.input} value={draft.customerId} placeholder="xxxxxxxx-xxxx-…" onChange={(e) => setDraft({ ...draft, customerId: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('apiSleutel')}</span>
                      <input className={styles.input} type="password" autoComplete="new-password" value={draft.secret} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
              <p className={styles.muted}>{draft.provider === 'mycarwash' ? t('mycarwashHint') : t('shaypHint')}</p>
              {newError && <p className={styles.error}>{newError}</p>}
              <div className={styles.footer}>
                <button type="button" className={styles.linkBtn} onClick={() => { setShowNew(false); setNewError(''); setDraft(EMPTY_DRAFT); }}>{t('annuleren')}</button>
                <button type="submit" className={styles.btn} disabled={savingNew}>{savingNew ? t('testen') : t('testenEnOpslaan')}</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function SiteLinkCard({
  provider, siteId, link, connections, programs, seenPrograms, onSaved, fmtWhen,
}: {
  provider: Provider;
  siteId: string;
  link: Link | null;
  connections: Connection[];
  programs: { id: string; name: string }[];
  seenPrograms: { number: number; name: string }[];
  onSaved: () => Promise<void>;
  fmtWhen: (iso: string | null) => string;
}) {
  const t = useTranslations('koppelingen');
  const [connectionId, setConnectionId] = useState(link?.connectionId ?? '');
  const [externalId, setExternalId] = useState(link?.externalId ?? '');
  const [externalName, setExternalName] = useState(link?.externalName ?? '');
  const [enabled, setEnabled] = useState(link?.enabled ?? true);
  const [programMap, setProgramMap] = useState<ProgramMapRow[]>(() => mergeRows(link?.programMap ?? [], seenPrograms));
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [newNumber, setNewNumber] = useState('');

  useEffect(() => {
    setConnectionId(link?.connectionId ?? '');
    setExternalId(link?.externalId ?? '');
    setExternalName(link?.externalName ?? '');
    setEnabled(link?.enabled ?? true);
    setProgramMap(mergeRows(link?.programMap ?? [], seenPrograms));
  }, [link, seenPrograms]);

  // Load the locations / meters of the chosen connection
  useEffect(() => {
    if (!connectionId) { setTargets(null); return; }
    let cancelled = false;
    setTargets(null);
    fetch(`/api/integrations/connections/${connectionId}/targets`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setError((data as { error?: string }).error ?? t('opslaanMislukt')); setTargets([]); return; }
        setError('');
        setTargets(data as Target[]);
      })
      .catch(() => { if (!cancelled) setTargets([]); });
    return () => { cancelled = true; };
  }, [connectionId, t]);

  async function fetchPrograms() {
    setBusy('programs');
    setError('');
    try {
      const r = await fetch(`/api/integrations/site/programs?siteId=${siteId}&connectionId=${connectionId}&locationId=${encodeURIComponent(externalId)}`);
      const data = await r.json().catch(() => ([]));
      if (!r.ok) { setError((data as { error?: string }).error ?? t('opslaanMislukt')); return; }
      const rows = data as { number: number; name: string }[];
      if (rows.length === 0) setMsg(t('geenProgrammasGevonden'));
      setProgramMap((prev) => mergeRows(prev, rows));
    } finally {
      setBusy('');
    }
  }

  async function save(nextConnectionId = connectionId) {
    setBusy('save');
    setError('');
    setMsg('');
    try {
      const r = await fetch('/api/integrations/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, provider, connectionId: nextConnectionId, externalId, externalName, enabled, programMap }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError((data as { error?: string }).error ?? t('opslaanMislukt')); return; }
      const syncError = (data as { syncError?: string }).syncError;
      if (syncError) setError(t('ophalenMislukt', { error: syncError }));
      else setMsg(nextConnectionId ? t('opgeslagen') : t('uitgeschakeld'));
      await onSaved();
    } finally {
      setBusy('');
    }
  }

  async function syncNow() {
    setBusy('sync');
    setError('');
    setMsg('');
    try {
      const r = await fetch('/api/integrations/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId }) });
      const data = (await r.json().catch(() => ({}))) as Record<string, string>;
      setMsg(data[provider] ?? t('opgeslagen'));
      await onSaved();
    } finally {
      setBusy('');
    }
  }

  const providerLabel = t(`provider.${provider}`);
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.subtitle}>{providerLabel}</h3>
        <span className={styles.muted}>{provider === 'mycarwash' ? t('mycarwashWat') : t('shaypWat')}</span>
      </div>

      {connections.length === 0 && !link ? (
        <p className={styles.muted}>{t('eerstKoppelingToevoegen', { provider: providerLabel })}</p>
      ) : (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>{t('koppeling')}</span>
            <select className={styles.input} value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setExternalId(''); setExternalName(''); }}>
              <option value="">{t('nietGebruiken')}</option>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          {connectionId && (
            <label className={styles.field}>
              <span className={styles.label}>{provider === 'mycarwash' ? t('vestiging') : t('watermeter')}</span>
              <select
                className={styles.input}
                value={externalId}
                disabled={targets === null}
                onChange={(e) => { setExternalId(e.target.value); setExternalName(targets?.find((x) => x.id === e.target.value)?.name ?? ''); }}
              >
                <option value="">{targets === null ? t('laden') : t('kies')}</option>
                {(targets ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.detail ? ` (${x.detail})` : ''}</option>)}
                {externalId && targets && !targets.some((x) => x.id === externalId) && <option value={externalId}>{externalName || externalId}</option>}
              </select>
            </label>
          )}
          {connectionId && (
            <label className={styles.checkField}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>{t('actief')}</span>
            </label>
          )}
        </div>
      )}

      {provider === 'mycarwash' && connectionId && externalId && (
        <div className={styles.mapBlock}>
          <div className={styles.subhead}>
            <span className={styles.label}>{t('programmaKoppeling')}</span>
            <button type="button" className={styles.linkBtn} onClick={fetchPrograms} disabled={busy !== ''}>
              {busy === 'programs' ? t('laden') : t('programmasOphalen')}
            </button>
          </div>
          <p className={styles.muted}>{t('programmaKoppelingUitleg')}</p>
          {programMap.map((row) => (
            <div key={row.number} className={styles.mapRow}>
              <span className={styles.mapNumber}>#{row.number}</span>
              <span className={styles.mapName}>{row.name || '—'}</span>
              <select
                className={styles.input}
                value={row.programId}
                onChange={(e) => setProgramMap((prev) => prev.map((r) => (r.number === row.number ? { ...r, programId: e.target.value } : r)))}
              >
                <option value="">{t('nietMeetellen')}</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ))}
          <div className={styles.mapRow}>
            <input
              className={styles.input}
              inputMode="numeric"
              placeholder={t('nummerToevoegen')}
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ''))}
            />
            <button
              type="button"
              className={styles.linkBtn}
              disabled={!newNumber}
              onClick={() => { setProgramMap((prev) => mergeRows(prev, [{ number: Number(newNumber), name: '' }])); setNewNumber(''); }}
            >
              {t('toevoegen')}
            </button>
          </div>
        </div>
      )}

      {link && (
        <p className={link.lastError ? styles.error : styles.muted}>
          {link.lastError ? t('laatsteFout', { error: link.lastError }) : t('laatstOpgehaald', { when: fmtWhen(link.lastSyncedAt) })}
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {msg && <p className={styles.ok}>{msg}</p>}

      {(connections.length > 0 || link) && (
        <div className={styles.footer}>
          {link && link.connectionId && (
            <button type="button" className={styles.linkBtn} onClick={syncNow} disabled={busy !== ''}>
              {busy === 'sync' ? t('laden') : t('nuOphalen')}
            </button>
          )}
          <button
            type="button"
            className={styles.btn}
            disabled={busy !== '' || (!!connectionId && !externalId) || (!connectionId && !link)}
            onClick={() => save()}
          >
            {busy === 'save' ? t('laden') : t('opslaan')}
          </button>
        </div>
      )}
    </div>
  );
}

function mergeRows(rows: ProgramMapRow[], extra: { number: number; name: string }[]): ProgramMapRow[] {
  const map = new Map<number, ProgramMapRow>(rows.map((r) => [r.number, r]));
  for (const e of extra) {
    const cur = map.get(e.number);
    if (!cur) map.set(e.number, { number: e.number, name: e.name, programId: '' });
    else if (!cur.name && e.name) map.set(e.number, { ...cur, name: e.name });
  }
  return [...map.values()].sort((a, b) => a.number - b.number);
}
