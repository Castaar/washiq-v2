'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './OrdersPanel.module.scss';

export type OrderCategory = 'algemeen' | 'chemie';

export interface OrderItemData {
  id: string;
  name: string;
  description: string;
  category: OrderCategory;
}

export interface OrderRequestData {
  id: string;
  item_name: string;
  details: string;
  requested_by_name: string;
  requested_at: string;
  is_handled: boolean;
  handled_by_name: string;
}

export interface OrderSiteOption {
  id: string;
  name: string;
}

const CATEGORY_LABEL: Record<OrderCategory, string> = {
  algemeen: 'Producten & acties',
  chemie: 'Chemie',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OrdersPanel({
  siteId,
  initialItems,
  initialRequests,
  canManage,
  otherSites = [],
}: {
  siteId: string;
  initialItems: OrderItemData[];
  initialRequests: OrderRequestData[];
  canManage: boolean;
  otherSites?: OrderSiteOption[];
}) {
  const [items, setItems] = useState(initialItems);
  const [requests, setRequests] = useState(initialRequests);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState<Record<string, string>>({});

  const [formOpenFor, setFormOpenFor] = useState<OrderCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<OrderCategory>('algemeen');
  const [savingEdit, setSavingEdit] = useState(false);

  const [copyFromSiteId, setCopyFromSiteId] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState('');

  const [handlingId, setHandlingId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<'open' | 'alles'>('open');

  // Deep-link from a push notification: /orders?request=<id> scrolls to and
  // highlights that specific bestelling.
  const searchParams = useSearchParams();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (!requestId) return;
    const match = requests.find((r) => r.id === requestId);
    if (!match) return;
    if (match.is_handled) setRequestFilter('alles');
    setHighlightId(requestId);
    const timeout = setTimeout(() => {
      rowRefs.current[requestId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clear = setTimeout(() => setHighlightId(null), 4000);
    return () => { clearTimeout(timeout); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleAddItem(category: OrderCategory) {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/orders/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, name, description, category }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setItems((prev) => [...prev, { id: data.id, name: name.trim(), description: description.trim(), category }].sort((a, b) => a.name.localeCompare(b.name)));
        setName('');
        setDescription('');
        setFormOpenFor(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(id: string) {
    const res = await fetch(`/api/orders/items/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function startEdit(item: OrderItemData) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditCategory(item.category);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/orders/items/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDescription, category: editCategory }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === editingId
          ? { ...i, name: editName.trim(), description: editDescription.trim(), category: editCategory }
          : i)));
        setEditingId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCopy() {
    if (!copyFromSiteId) return;
    setCopying(true);
    setCopyResult('');
    try {
      const res = await fetch('/api/orders/items/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSiteId: copyFromSiteId, toSiteId: siteId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { copied: number };
        setCopyResult(`${data.copied} product(en) gekopieerd`);
        if (data.copied > 0) {
          const refreshed = await fetch(`/api/orders/items?siteId=${siteId}`);
          if (refreshed.ok) setItems(await refreshed.json() as OrderItemData[]);
        }
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setCopyResult(err?.error ?? 'Kopiëren mislukt');
      }
    } finally {
      setCopying(false);
    }
  }

  async function handleOrder(item: OrderItemData) {
    setOrderingId(item.id);
    try {
      const res = await fetch('/api/orders/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, itemId: item.id, details: detailsDraft[item.id] ?? '' }),
      });
      if (res.ok) {
        setOrderedIds((prev) => [...prev, item.id]);
        setDetailsDraft((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      }
    } finally {
      setOrderingId(null);
    }
  }

  async function handleToggleHandled(req: OrderRequestData) {
    setHandlingId(req.id);
    try {
      const res = await fetch(`/api/orders/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_handled: !req.is_handled }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, is_handled: !req.is_handled } : r)),
        );
      }
    } finally {
      setHandlingId(null);
    }
  }

  const filteredRequests = requests.filter((r) => (requestFilter === 'open' ? !r.is_handled : true));
  const openCount = requests.filter((r) => !r.is_handled).length;
  const categories: OrderCategory[] = ['algemeen', 'chemie'];

  return (
    <div className={styles.wrap}>
      {canManage && otherSites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Kopieer producten van andere carwash</h2>
          <div className={styles.copyRow}>
            <select className={styles.select} value={copyFromSiteId} onChange={(e) => { setCopyFromSiteId(e.target.value); setCopyResult(''); }}>
              <option value="">-- Kies bronsite --</option>
              {otherSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className={styles.saveBtn} onClick={handleCopy} disabled={copying || !copyFromSiteId}>
              {copying ? 'Bezig...' : 'Kopiëren'}
            </button>
            {copyResult && <span className={styles.copyResult}>{copyResult}</span>}
          </div>
        </section>
      )}

      {categories.map((category) => {
        const categoryItems = items.filter((i) => i.category === category);
        if (categoryItems.length === 0 && !canManage) return null;
        return (
          <section key={category} className={styles.section}>
            <h2 className={styles.sectionTitle}>{CATEGORY_LABEL[category]}</h2>
            {categoryItems.length === 0 ? (
              <p className={styles.empty}>Nog geen producten toegevoegd.</p>
            ) : (
              <div className={styles.list}>
                {categoryItems.map((item) => (
                  editingId === item.id ? (
                    <div key={item.id} className={styles.editCard}>
                      <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Naam" autoFocus />
                      <textarea className={styles.textarea} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Omschrijving" rows={2} />
                      <select className={styles.select} value={editCategory} onChange={(e) => setEditCategory(e.target.value as OrderCategory)}>
                        {categories.map((c) => (
                          <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                        ))}
                      </select>
                      <div className={styles.formActions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setEditingId(null)}>Annuleren</button>
                        <button type="button" className={styles.saveBtn} onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
                          {savingEdit ? 'Bezig...' : 'Opslaan'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className={[styles.itemCard, canManage ? styles.itemCardClickable : ''].filter(Boolean).join(' ')}
                      onClick={canManage ? () => startEdit(item) : undefined}
                      role={canManage ? 'button' : undefined}
                      tabIndex={canManage ? 0 : undefined}
                    >
                      <div className={styles.itemBody}>
                        <span className={styles.itemName}>{item.name}</span>
                        {item.description && <span className={styles.itemDesc}>{item.description}</span>}
                        {!canManage && (
                          <input
                            className={styles.detailsInput}
                            placeholder="Details (soort, hoeveelheid, ...)"
                            value={detailsDraft[item.id] ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setDetailsDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        )}
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                          aria-label="Verwijderen"
                        >
                          ✕
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.orderBtn}
                          onClick={() => handleOrder(item)}
                          disabled={orderingId === item.id || orderedIds.includes(item.id)}
                        >
                          {orderedIds.includes(item.id) ? 'Besteld ✓' : orderingId === item.id ? 'Bezig...' : 'Bestellen'}
                        </button>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}

            {canManage && (
              formOpenFor === category ? (
                <div className={styles.addForm}>
                  <input
                    className={styles.input}
                    placeholder="Naam (bv. Actiefolder maart)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className={styles.textarea}
                    placeholder="Omschrijving (optioneel)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                  <div className={styles.formActions}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setFormOpenFor(null)}>
                      Annuleren
                    </button>
                    <button type="button" className={styles.saveBtn} onClick={() => handleAddItem(category)} disabled={saving || !name.trim()}>
                      {saving ? 'Bezig...' : 'Opslaan'}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.openFormBtn} onClick={() => { setName(''); setDescription(''); setFormOpenFor(category); }}>
                  + Product toevoegen
                </button>
              )
            )}
          </section>
        );
      })}

      {canManage && (
        <section className={styles.section}>
          <div className={styles.listHeader}>
            <h2 className={styles.sectionTitle}>
              Bestellingen {openCount > 0 && <span className={styles.openBadge}>{openCount}</span>}
            </h2>
            <div className={styles.filterTabs}>
              {(['open', 'alles'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={[styles.filterTab, requestFilter === f ? styles.filterTabActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setRequestFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {filteredRequests.length === 0 ? (
            <p className={styles.empty}>Geen bestellingen.</p>
          ) : (
            <div className={styles.list}>
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  ref={(el) => { rowRefs.current[req.id] = el; }}
                  className={[
                    styles.requestCard,
                    req.is_handled ? styles.requestCardDone : '',
                    highlightId === req.id ? styles.requestCardHighlight : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className={styles.itemBody}>
                    <span className={styles.itemName}>{req.item_name}</span>
                    {req.details && <span className={styles.itemDesc}>{req.details}</span>}
                    <span className={styles.itemDesc}>
                      {req.requested_by_name} · {fmtDateTime(req.requested_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={[styles.resolveBtn, req.is_handled ? styles.resolveBtnDone : ''].filter(Boolean).join(' ')}
                    onClick={() => handleToggleHandled(req)}
                    disabled={handlingId === req.id}
                  >
                    {req.is_handled ? '✓ Besteld' : 'Markeer besteld'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
