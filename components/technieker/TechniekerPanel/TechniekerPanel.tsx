'use client';

import { useState } from 'react';
import styles from './TechniekerPanel.module.scss';

export interface TechniekerItem {
  id: string;
  kind: 'defect' | 'schade' | 'maintenance';
  siteId: string;
  siteName: string;
  title: string;
  subtitle: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
  assignedToName?: string;
}

const KIND_LABEL: Record<TechniekerItem['kind'], string> = {
  defect: 'Defect',
  schade: 'Schade',
  maintenance: 'Onderhoud',
};

const UNDO_TIMEOUT_MS = 6000;

interface AllowedSite { id: string; name: string; }
interface AvailableUser { id: string; name: string; }

export function TechniekerPanel({ items: initial, userRole = 'technician', allowedSites = [], availableUsers = [] }: { items: TechniekerItem[]; userRole?: string; allowedSites?: AllowedSite[]; availableUsers?: AvailableUser[] }) {
  const [items, setItems] = useState(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [undoQueue, setUndoQueue] = useState<{ item: TechniekerItem; note: string }[]>([]);

  // Add-task form (owner/developer only)
  const canAdd = userRole === 'owner' || userRole === 'developer';
  const [showAdd, setShowAdd] = useState(false);
  const [addSiteId, setAddSiteId] = useState(allowedSites[0]?.id ?? '');
  const [addDesc, setAddDesc] = useState('');
  const [addErnst, setAddErnst] = useState<'laag' | 'medium' | 'hoog'>('medium');
  const [addAssignedTo, setAddAssignedTo] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addDesc.trim() || !addSiteId) return;
    setAddSaving(true);
    const res = await fetch('/api/incidents/defect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: addSiteId, omschrijving: addDesc.trim(), ernst: addErnst, assigned_to_name: addAssignedTo }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string };
      const siteName = allowedSites.find((s) => s.id === addSiteId)?.name ?? '';
      setItems((prev) => [{
        id: data.id, kind: 'defect', siteId: addSiteId, siteName,
        title: addDesc.trim(), subtitle: '', severity: addErnst === 'hoog' ? 'high' : addErnst === 'laag' ? 'low' : 'medium',
        date: new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' }),
      }, ...prev]);
      setAddDesc('');
      setAddErnst('medium');
      setAddAssignedTo('');
      setShowAdd(false);
    }
    setAddSaving(false);
  }

  const sites = Array.from(new Set(items.map((i) => i.siteName)));

  function requestConfirm(id: string) {
    setConfirmId(id);
  }

  function cancelConfirm() {
    setConfirmId(null);
  }

  async function handleResolve(item: TechniekerItem) {
    setConfirmId(null);
    setResolvingId(item.id);
    const note = noteDrafts[item.id]?.trim() ?? '';
    try {
      if (item.kind === 'defect') {
        await fetch(`/api/incidents/defect/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: true, resolve_note: note }),
        });
      } else if (item.kind === 'schade') {
        await fetch(`/api/incidents/schade/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: true }),
        });
      } else {
        await fetch(`/api/maintenance/${item.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: note }),
        });
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // Show undo toast
      const entry = { item, note };
      setUndoQueue((prev) => [...prev, entry]);
      setTimeout(() => {
        setUndoQueue((prev) => prev.filter((e) => e.item.id !== item.id));
      }, UNDO_TIMEOUT_MS);
    } finally {
      setResolvingId(null);
    }
  }

  async function handleUndo(entry: { item: TechniekerItem; note: string }) {
    setUndoQueue((prev) => prev.filter((e) => e.item.id !== entry.item.id));
    try {
      if (entry.item.kind === 'defect') {
        await fetch(`/api/incidents/defect/${entry.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: false }),
        });
      } else if (entry.item.kind === 'schade') {
        await fetch(`/api/incidents/schade/${entry.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: false }),
        });
      } else {
        await fetch(`/api/maintenance/${entry.item.id}/undo-complete`, {
          method: 'POST',
        });
      }
      setItems((prev) => [...prev, entry.item]);
    } catch { /* ignore — page refresh will restore state */ }
  }

  return (
    <>
      {/* ── Add task (owner/developer) ───────────────────────── */}
      {canAdd && (
        <div className={styles.addBlock}>
          {!showAdd ? (
            <button type="button" className={styles.addBtn} onClick={() => setShowAdd(true)}>
              + Taak toevoegen
            </button>
          ) : (
            <form className={styles.addForm} onSubmit={handleAddTask}>
              {allowedSites.length > 1 && (
                <select className={styles.addSelect} value={addSiteId} onChange={(e) => setAddSiteId(e.target.value)}>
                  {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <input
                className={styles.addInput}
                type="text"
                placeholder="Omschrijving taak..."
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                autoFocus
              />
              <select className={styles.addSelect} value={addErnst} onChange={(e) => setAddErnst(e.target.value as 'laag' | 'medium' | 'hoog')}>
                <option value="laag">Laag</option>
                <option value="medium">Medium</option>
                <option value="hoog">Hoog</option>
              </select>
              {availableUsers.length > 0 && (
                <select className={styles.addSelect} value={addAssignedTo} onChange={(e) => setAddAssignedTo(e.target.value)}>
                  <option value="">Toewijzen aan... (optioneel)</option>
                  {availableUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              )}
              <div className={styles.addActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Annuleren</button>
                <button type="submit" className={styles.submitBtn} disabled={addSaving || !addDesc.trim()}>
                  {addSaving ? '...' : 'Toevoegen'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Undo toasts ─────────────────────────────────────── */}
      {undoQueue.length > 0 && (
        <div className={styles.undoStack}>
          {undoQueue.map((entry) => (
            <div key={entry.item.id} className={styles.undoToast}>
              <span className={styles.undoText}>
                &ldquo;{entry.item.title}&rdquo; gemarkeerd als opgelost
              </span>
              <button
                type="button"
                className={styles.undoBtn}
                onClick={() => handleUndo(entry)}
              >
                Ongedaan maken
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.wrap}>
        {items.length === 0 && undoQueue.length === 0 && (
          <p className={styles.empty}>Geen openstaande problemen of onderhoud — alles is in orde.</p>
        )}
        {sites.map((siteName) => (
          <div key={siteName} className={styles.siteGroup}>
            <h2 className={styles.siteTitle}>{siteName}</h2>
            <div className={styles.list}>
              {items.filter((i) => i.siteName === siteName).map((item) => (
                <div key={item.id} className={[styles.item, styles[`severity_${item.severity}`]].join(' ')}>
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      <span className={[styles.kindBadge, styles[`kind_${item.kind}`]].join(' ')}>
                        {KIND_LABEL[item.kind]}
                      </span>
                      {item.date && <span className={styles.itemDate}>{item.date}</span>}
                    </div>
                    <p className={styles.itemTitle}>{item.title}</p>
                    {item.subtitle && <p className={styles.itemSubtitle}>{item.subtitle}</p>}
                    {item.assignedToName && <p className={styles.itemSubtitle}>Toegewezen: {item.assignedToName}</p>}
                    {(item.kind === 'maintenance' || item.kind === 'defect') && (
                      <input
                        className={styles.noteInput}
                        type="text"
                        placeholder="Opmerking bij oplossen (optioneel)"
                        value={noteDrafts[item.id] ?? ''}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    )}
                  </div>

                  {confirmId === item.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Zeker?</span>
                      <button
                        type="button"
                        className={styles.confirmYes}
                        onClick={() => handleResolve(item)}
                        disabled={resolvingId === item.id}
                      >
                        {resolvingId === item.id ? '...' : 'Ja'}
                      </button>
                      <button
                        type="button"
                        className={styles.confirmNo}
                        onClick={cancelConfirm}
                      >
                        Nee
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.resolveBtn}
                      onClick={() => requestConfirm(item.id)}
                      disabled={resolvingId === item.id}
                    >
                      Oplossen
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
