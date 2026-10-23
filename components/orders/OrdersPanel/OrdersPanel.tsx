'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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

function fmtDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  const t = useTranslations('orders');
  const tCommon = useTranslations('common');
  const locale = useLocale();
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
        setCopyResult(t('gekopieerd', { count: data.copied }));
        if (data.copied > 0) {
          const refreshed = await fetch(`/api/orders/items?siteId=${siteId}`);
          if (refreshed.ok) setItems(await refreshed.json() as OrderItemData[]);
        }
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setCopyResult(err?.error ?? t('kopierenMislukt'));
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
        const list = await fetch(`/api/orders/requests?siteId=${siteId}`);
        if (list.ok) setRequests((await list.json()) as OrderRequestData[]);
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
          <h2 className={styles.sectionTitle}>{t('kopieerTitel')}</h2>
          <div className={styles.copyRow}>
            <select className={styles.select} value={copyFromSiteId} onChange={(e) => { setCopyFromSiteId(e.target.value); setCopyResult(''); }}>
              <option value="">{t('kiesBronsite')}</option>
              {otherSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className={styles.saveBtn} onClick={handleCopy} disabled={copying || !copyFromSiteId}>
              {copying ? tCommon('bezig') : t('kopieren')}
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
            <h2 className={styles.sectionTitle}>{t(`categorie.${category}`)}</h2>
            {categoryItems.length === 0 ? (
              <p className={styles.empty}>{t('nogGeenProducten')}</p>
            ) : (
              <div className={styles.list}>
                {categoryItems.map((item) => (
                  editingId === item.id ? (
                    <div key={item.id} className={styles.editCard}>
                      <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('naam')} autoFocus />
                      <textarea className={styles.textarea} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder={t('omschrijving')} rows={2} />
                      <select className={styles.select} value={editCategory} onChange={(e) => setEditCategory(e.target.value as OrderCategory)}>
                        {categories.map((c) => (
                          <option key={c} value={c}>{t(`categorie.${c}`)}</option>
                        ))}
                      </select>
                      <div className={styles.formActions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setEditingId(null)}>{tCommon('annuleren')}</button>
                        <button type="button" className={styles.saveBtn} onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
                          {savingEdit ? tCommon('bezig') : tCommon('opslaan')}
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
                        <input
                          className={styles.detailsInput}
                          placeholder={t('detailsPlaceholder')}
                          value={detailsDraft[item.id] ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => setDetailsDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      </div>
                      {/* Everyone can order — owners too (e.g. a selfcarwash has no employees) */}
                      <button
                        type="button"
                        className={styles.orderBtn}
                        onClick={(e) => { e.stopPropagation(); handleOrder(item); }}
                        disabled={orderingId === item.id || orderedIds.includes(item.id)}
                      >
                        {orderedIds.includes(item.id) ? t('besteldVinkje') : orderingId === item.id ? tCommon('bezig') : t('bestellen')}
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                          aria-label={tCommon('verwijderen')}
                        >
                          ✕
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
                    placeholder={t('naamPlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className={styles.textarea}
                    placeholder={t('omschrijvingOptioneel')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                  <div className={styles.formActions}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setFormOpenFor(null)}>
                      {tCommon('annuleren')}
                    </button>
                    <button type="button" className={styles.saveBtn} onClick={() => handleAddItem(category)} disabled={saving || !name.trim()}>
                      {saving ? tCommon('bezig') : tCommon('opslaan')}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.openFormBtn} onClick={() => { setName(''); setDescription(''); setFormOpenFor(category); }}>
                  {t('productToevoegen')}
                </button>
              )
            )}
          </section>
        );
      })}

      {(canManage || requests.length > 0) && (
        <section className={styles.section}>
          <div className={styles.listHeader}>
            <h2 className={styles.sectionTitle}>
              {t('bestellingen')} {openCount > 0 && <span className={styles.openBadge}>{openCount}</span>}
            </h2>
            <div className={styles.filterTabs}>
              {(['open', 'alles'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={[styles.filterTab, requestFilter === f ? styles.filterTabActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setRequestFilter(f)}
                >
                  {t(`filter.${f}`)}
                </button>
              ))}
            </div>
          </div>
          {filteredRequests.length === 0 ? (
            <p className={styles.empty}>{t('geenBestellingen')}</p>
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
                      {req.requested_by_name} · {fmtDateTime(req.requested_at, locale)}
                    </span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className={[styles.resolveBtn, req.is_handled ? styles.resolveBtnDone : ''].filter(Boolean).join(' ')}
                      onClick={() => handleToggleHandled(req)}
                      disabled={handlingId === req.id}
                    >
                      {req.is_handled ? t('vinkjeBesteld') : t('markeerBesteld')}
                    </button>
                  ) : (
                    <span className={[styles.resolveBtn, styles.statusTag, req.is_handled ? styles.resolveBtnDone : ''].filter(Boolean).join(' ')}>
                      {req.is_handled ? t('vinkjeBesteld') : t('aangevraagd')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
