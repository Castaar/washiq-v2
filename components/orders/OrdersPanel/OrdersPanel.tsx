'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './OrdersPanel.module.scss';

export interface OrderItemData {
  id: string;
  name: string;
  description: string;
}

export interface OrderRequestData {
  id: string;
  item_name: string;
  requested_by_name: string;
  requested_at: string;
  is_handled: boolean;
  handled_by_name: string;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OrdersPanel({
  siteId,
  initialItems,
  initialRequests,
  canManage,
}: {
  siteId: string;
  initialItems: OrderItemData[];
  initialRequests: OrderRequestData[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [requests, setRequests] = useState(initialRequests);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

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

  async function handleAddItem() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/orders/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, name, description }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setItems((prev) => [...prev, { id: data.id, name: name.trim(), description: description.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
        setName('');
        setDescription('');
        setFormOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(id: string) {
    const res = await fetch(`/api/orders/items/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleOrder(item: OrderItemData) {
    setOrderingId(item.id);
    try {
      const res = await fetch('/api/orders/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, itemId: item.id }),
      });
      if (res.ok) setOrderedIds((prev) => [...prev, item.id]);
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

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Producten &amp; acties</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>Nog geen producten toegevoegd.</p>
        ) : (
          <div className={styles.list}>
            {items.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemBody}>
                  <span className={styles.itemName}>{item.name}</span>
                  {item.description && <span className={styles.itemDesc}>{item.description}</span>}
                </div>
                {canManage ? (
                  <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteItem(item.id)} aria-label="Verwijderen">
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
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className={styles.section}>
          {formOpen ? (
            <>
              <h2 className={styles.sectionTitle}>Product toevoegen</h2>
              <input
                className={styles.input}
                placeholder="Naam (bv. Actiefolder maart)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Omschrijving (optioneel)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setFormOpen(false)}>
                  Annuleren
                </button>
                <button type="button" className={styles.saveBtn} onClick={handleAddItem} disabled={saving || !name.trim()}>
                  {saving ? 'Bezig...' : 'Opslaan'}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className={styles.openFormBtn} onClick={() => setFormOpen(true)}>
              + Product toevoegen
            </button>
          )}
        </section>
      )}

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
