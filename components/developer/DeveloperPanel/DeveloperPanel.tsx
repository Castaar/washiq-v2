'use client';

import { useState } from 'react';
import { SiteProgramManager } from '@/components/shared/WashProgramManager/WashProgramManager';
import styles from './DeveloperPanel.module.scss';

export interface DeveloperUser {
  id: string;
  name: string;
  email: string;
  role: 'developer' | 'owner' | 'employee' | 'technician';
  siteIds: string[];
  siteNames: string[];
  whatsapp: string;
  is_active: boolean;
}

export interface DeveloperSite {
  id: string;
  name: string;
  location: string;
}

export interface DeveloperProgram {
  id: string;
  siteId: string;
  name: string;
  tier: number;
  chemicals: string[];
}

export interface DeveloperMaintenanceTask {
  id: string;
  siteId: string;
  description: string;
  trigger_type: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
  trigger_value: number;
  trigger_day?: number;
  trigger_month?: number;
  trigger_month_list?: number[];
  last_done_at?: string;
  washes_at_last_done?: number;
}

export interface DeveloperStockItem {
  id: string;
  siteId: string;
  name: string;
  unit: string;
}

export interface DeveloperPanelProps {
  users: DeveloperUser[];
  sites: DeveloperSite[];
  programs: DeveloperProgram[];
  maintenanceTasks: DeveloperMaintenanceTask[];
  stockItems: DeveloperStockItem[];
}

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer',
  owner: 'Eigenaar',
  employee: 'Medewerker',
  technician: 'Technieker',
};

// ── User row ─────────────────────────────────────────────────
function UserRow({
  user,
  sites,
  onDelete,
  onUpdateSites,
  onUpdateRole,
  onUpdateUser,
}: {
  user: DeveloperUser;
  sites: DeveloperSite[];
  onDelete: (id: string) => void;
  onUpdateSites: (id: string, siteIds: string[]) => void;
  onUpdateRole: (id: string, role: DeveloperUser['role']) => void;
  onUpdateUser: (id: string, patch: Partial<DeveloperUser>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedSites, setSelectedSites] = useState<string[]>(user.siteIds);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp ?? '');
  const [isActive, setIsActive] = useState(user.is_active ?? true);
  const [saving, setSaving] = useState(false);

  function toggleSite(siteId: string) {
    setSelectedSites((prev) =>
      prev.includes(siteId) ? prev.filter((s) => s !== siteId) : [...prev, siteId],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, siteIds: selectedSites, whatsapp, is_active: isActive }),
      });
      onUpdateSites(user.id, selectedSites);
      onUpdateRole(user.id, selectedRole);
      onUpdateUser(user.id, { whatsapp, is_active: isActive });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Gebruiker "${user.name}" verwijderen?`)) return;
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    onDelete(user.id);
  }

  return (
    <div className={[styles.userCard, !user.is_active ? styles.userInactive : ''].join(' ')}>
      <div className={styles.userMain}>
        <div className={styles.userAvatar} aria-hidden="true">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userEmail}>{user.email}</span>
          {user.whatsapp && <span className={styles.whatsappPill}>WhatsApp: {user.whatsapp}</span>}
        </div>
        <span className={[styles.rolePill, styles[`role_${user.role}`]].join(' ')}>
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
        {!user.is_active && <span className={styles.inactivePill}>Inactief</span>}
        <div className={styles.sitePills}>
          {user.role === 'developer' ? (
            <span className={styles.allSitesPill}>Alle sites</span>
          ) : user.siteNames.length > 0 ? (
            user.siteNames.map((name) => (
              <span key={name} className={styles.sitePill}>{name}</span>
            ))
          ) : (
            <span className={styles.noAccess}>Geen toegang</span>
          )}
        </div>
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setEditing((v) => !v)}
            aria-label="Bewerken"
          >
            ✏
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDelete}
            aria-label="Verwijderen"
          >
            ✕
          </button>
        </div>
      </div>

      {editing && (
        <div className={styles.editPanel}>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Rol</span>
            <select
              className={styles.roleSelect}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as DeveloperUser['role'])}
            >
              <option value="developer">Developer</option>
              <option value="owner">Eigenaar</option>
              <option value="employee">Medewerker</option>
              <option value="technician">Technieker</option>
            </select>
          </div>
          {selectedRole !== 'developer' && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Toegang</span>
              <div className={styles.checkboxGroup}>
                {sites.map((s) => (
                  <label key={s.id} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={selectedSites.includes(s.id)}
                      onChange={() => toggleSite(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className={styles.editRow}>
            <span className={styles.editLabel}>WhatsApp</span>
            <input
              className={styles.input}
              type="tel"
              placeholder="+32 499 00 00 00"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Status</span>
            <label className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Actief (uitvinken = account deactiveren)
            </label>
          </div>
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>
              Annuleren
            </button>
            <button type="button" className={styles.saveSmallBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Products block per site ───────────────────────────────────
function SiteProductsBlock({
  site,
  products,
  onAdd,
  onDelete,
}: {
  site: DeveloperSite;
  products: DeveloperStockItem[];
  onAdd: (item: DeveloperStockItem) => void;
  onDelete: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUnit, setAddUnit] = useState('L');
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id, name: addName.trim(), unit: addUnit, current_stock: 0, min_stock_alert: 0 }),
      });
      const data = (await res.json()) as { id?: string };
      if (res.ok && data.id) {
        onAdd({ id: data.id, siteId: site.id, name: addName.trim(), unit: addUnit });
        setAddName(''); setAddUnit('L'); setShowAdd(false);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Product "${name}" verwijderen?`)) return;
    const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' });
    if (res.ok) onDelete(id);
  }

  return (
    <div className={styles.siteBlock}>
      <div className={styles.siteBlockHeader}>
        <span className={styles.siteBlockTitle}>{site.name}</span>
        <button type="button" className={styles.addSmallBtn} onClick={() => setShowAdd((v) => !v)}>
          + Product
        </button>
      </div>

      {products.length === 0 && !showAdd && (
        <p className={styles.noAccess}>Geen producten</p>
      )}

      <div className={styles.programList}>
        {products.map((p) => (
          <div key={p.id} className={styles.programMain}>
            <span className={styles.programName}>{p.name}</span>
            <span className={styles.chemPill}>{p.unit}</span>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(p.id, p.name)}
                aria-label="Verwijderen"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <form className={styles.addForm} onSubmit={handleAdd} noValidate>
          <div className={styles.addFormRow}>
            <div className={styles.addField}>
              <label className={styles.addLabel}>Naam</label>
              <input
                className={styles.input}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="LC Shampoo Fresh"
              />
            </div>
            <div className={styles.addField} style={{ maxWidth: 120 }}>
              <label className={styles.addLabel}>Eenheid</label>
              <select className={styles.roleSelect} value={addUnit} onChange={(e) => setAddUnit(e.target.value)}>
                <option value="L">L (liter)</option>
                <option value="kg">kg</option>
                <option value="stuks">stuks</option>
              </select>
            </div>
          </div>
          <div className={styles.addFormFooter}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Annuleren</button>
            <button type="submit" className={styles.saveSmallBtn} disabled={adding}>{adding ? 'Bezig...' : 'Opslaan'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Maintenance task row ──────────────────────────────────────
function MaintenanceTaskRow({
  task,
  label,
  onDelete,
  onUpdate,
}: {
  task: DeveloperMaintenanceTask;
  label: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Pick<DeveloperMaintenanceTask, 'last_done_at' | 'washes_at_last_done'>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [lastDoneAt, setLastDoneAt] = useState(task.last_done_at ?? '');
  const [washesAtLastDone, setWashesAtLastDone] = useState(
    task.washes_at_last_done !== undefined ? String(task.washes_at_last_done) : '',
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (lastDoneAt) body.last_done_at = lastDoneAt;
      if (task.trigger_type === 'washes' && washesAtLastDone !== '')
        body.washes_at_last_done = parseInt(washesAtLastDone) || 0;
      await fetch(`/api/maintenance/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onUpdate(task.id, {
        last_done_at: lastDoneAt || undefined,
        washes_at_last_done: task.trigger_type === 'washes' && washesAtLastDone !== ''
          ? parseInt(washesAtLastDone) || 0
          : undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.taskRow}>
      <div className={styles.taskMain}>
        <span className={styles.taskDesc}>{task.description}</span>
        <span className={styles.taskTrigger}>{label}</span>
        {task.last_done_at && (
          <span className={styles.taskMeta}>Laatste beurt: {task.last_done_at}</span>
        )}
        {task.trigger_type === 'washes' && task.washes_at_last_done !== undefined && (
          <span className={styles.taskMeta}>{task.washes_at_last_done.toLocaleString('nl-BE')} was.</span>
        )}
        <div className={styles.rowActions}>
          <button type="button" className={styles.editBtn} onClick={() => setEditing((v) => !v)} aria-label="Bewerken">✏</button>
          <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task.id)} aria-label="Verwijderen">✕</button>
        </div>
      </div>
      {editing && (
        <div className={styles.editPanel}>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Datum laatste beurt</span>
            <input
              className={styles.input}
              type="date"
              value={lastDoneAt}
              onChange={(e) => setLastDoneAt(e.target.value)}
            />
          </div>
          {task.trigger_type === 'washes' && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Tellerstand bij laatste beurt</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={washesAtLastDone}
                onChange={(e) => setWashesAtLastDone(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>Annuleren</button>
            <button type="button" className={styles.saveSmallBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────
type DevTab = 'sites' | 'users' | 'programs' | 'stock' | 'maintenance' | 'backup';

const DEV_TABS: { id: DevTab; label: string }[] = [
  { id: 'sites', label: 'Sites' },
  { id: 'users', label: 'Gebruikers' },
  { id: 'programs', label: "Programma's" },
  { id: 'stock', label: 'Voorraad' },
  { id: 'maintenance', label: 'Onderhoud' },
  { id: 'backup', label: 'Back-up' },
];

interface ImportPreview {
  meta: { ownerName?: string; ownerEmail?: string; exportedAt?: string; siteNames?: string[] };
  currentCounts: Record<string, number>;
  importCounts: Record<string, number>;
}

export function DeveloperPanel({ users: initialUsers, sites: initialSites, programs: initialPrograms, maintenanceTasks: initialTasks, stockItems: initialStock }: DeveloperPanelProps) {
  const [activeTab, setActiveTab] = useState<DevTab>('sites');
  const [users, setUsers] = useState(initialUsers);
  const [sites, setSites] = useState(initialSites);
  const [programs, setPrograms] = useState(initialPrograms);
  const [tasks, setTasks] = useState(initialTasks);
  const [stockItems, setStockItems] = useState(initialStock);

  // ── Back-up (export/import) state ───────────────────────────
  const owners = users.filter((u) => u.role === 'owner');
  const [backupOwnerId, setBackupOwnerId] = useState(owners[0]?.id ?? '');
  const [exporting, setExporting] = useState(false);
  const [importPayload, setImportPayload] = useState<Record<string, unknown> | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [checkingImport, setCheckingImport] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [restoreDone, setRestoreDone] = useState(false);

  async function handleExport() {
    if (!backupOwnerId) return;
    setExporting(true);
    setBackupError('');
    try {
      const res = await fetch(`/api/developer/export?ownerId=${backupOwnerId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setBackupError(err?.error ?? 'Export mislukt');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? 'washiq-backup.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFileSelected(file: File) {
    setBackupError('');
    setImportPreview(null);
    setRestoreDone(false);
    setImportFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setImportPayload(parsed);
      setCheckingImport(true);
      const res = await fetch('/api/developer/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true, payload: parsed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setBackupError(err?.error ?? 'Bestand kon niet gelezen worden');
        setImportPayload(null);
        return;
      }
      const data = (await res.json()) as { currentCounts: Record<string, number>; importCounts: Record<string, number>; meta: ImportPreview['meta'] };
      setImportPreview({ meta: data.meta, currentCounts: data.currentCounts, importCounts: data.importCounts });
    } catch {
      setBackupError('Ongeldig back-up bestand');
      setImportPayload(null);
    } finally {
      setCheckingImport(false);
    }
  }

  async function handleConfirmRestore() {
    if (!importPayload) return;
    if (!confirm('Dit overschrijft alle huidige data van deze carwash(es) met de back-up. Deze actie kan niet ongedaan gemaakt worden. Doorgaan?')) return;
    setRestoring(true);
    setBackupError('');
    try {
      const res = await fetch('/api/developer/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, payload: importPayload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setBackupError(err?.error ?? 'Herstellen mislukt');
        return;
      }
      setRestoreDone(true);
      setImportPayload(null);
      setImportPreview(null);
      setImportFileName('');
    } finally {
      setRestoring(false);
    }
  }

  // ── Site add state ──────────────────────────────────────────
  const [showAddSite, setShowAddSite] = useState(false);
  const [addSiteName, setAddSiteName] = useState('');
  const [addSiteLocation, setAddSiteLocation] = useState('');
  const [addingSite, setAddingSite] = useState(false);

  async function handleDeleteSite(id: string, name: string) {
    if (!confirm(`Carwash "${name}" en alle bijhorende data permanent verwijderen?`)) return;
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSites((prev) => prev.filter((s) => s.id !== id));
      setPrograms((prev) => prev.filter((p) => p.siteId !== id));
    }
  }

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault();
    if (!addSiteName || !addSiteLocation) return;
    setAddingSite(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addSiteName, location: addSiteLocation }),
      });
      const data = (await res.json()) as { id?: string };
      if (res.ok && data.id) {
        setSites((prev) => [...prev, { id: data.id!, name: addSiteName, location: addSiteLocation }]);
        setAddSiteName(''); setAddSiteLocation(''); setShowAddSite(false);
      }
    } finally {
      setAddingSite(false);
    }
  }

  // ── Program handlers ────────────────────────────────────────
  function handleDeleteProgram(id: string) {
    setPrograms((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdateProgram(id: string, updated: Partial<DeveloperProgram>) {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  }

  function handleAddProgram(program: DeveloperProgram) {
    setPrograms((prev) => [...prev, program]);
  }

  // ── Stock / product handlers ────────────────────────────────
  function handleAddStock(item: DeveloperStockItem) {
    setStockItems((prev) => [...prev, item]);
  }

  function handleDeleteStock(id: string) {
    setStockItems((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Maintenance task state & handlers ───────────────────────
  const [taskSiteId, setTaskSiteId] = useState(sites[0]?.id ?? '');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState<DeveloperMaintenanceTask['trigger_type']>('months');
  const [newTaskValue, setNewTaskValue] = useState('');
  const [newTaskDay, setNewTaskDay] = useState('');
  const [newTaskMonth, setNewTaskMonth] = useState('');
  const [newTaskMonthList, setNewTaskMonthList] = useState<number[]>([]);
  const [newTaskLastDoneAt, setNewTaskLastDoneAt] = useState('');
  const [newTaskWashesAtLastDone, setNewTaskWashesAtLastDone] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  function toggleTaskMonth(m: number) {
    setNewTaskMonthList((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b));
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskDesc.trim() || !taskSiteId) return;
    setAddingTask(true);
    try {
      const body: Record<string, unknown> = {
        siteId: taskSiteId,
        description: newTaskDesc.trim(),
        trigger_type: newTaskType,
      };
      if (newTaskType === 'washes' || newTaskType === 'months') {
        body.trigger_value = parseInt(newTaskValue) || 0;
      }
      if (newTaskType === 'fixed_date') {
        body.trigger_day = parseInt(newTaskDay) || 1;
        body.trigger_month = parseInt(newTaskMonth) || 1;
      }
      if (newTaskType === 'fixed_months') {
        body.trigger_month_list = newTaskMonthList;
      }
      if (newTaskLastDoneAt) {
        body.last_done_at = newTaskLastDoneAt;
      }
      if (newTaskType === 'washes' && newTaskWashesAtLastDone) {
        body.washes_at_last_done = parseInt(newTaskWashesAtLastDone) || 0;
      }
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { id?: string };
      if (res.ok && data.id) {
        const newTask: DeveloperMaintenanceTask = {
          id: data.id,
          siteId: taskSiteId,
          description: newTaskDesc.trim(),
          trigger_type: newTaskType,
          trigger_value: parseInt(newTaskValue) || 0,
          trigger_day: parseInt(newTaskDay) || 0,
          trigger_month: parseInt(newTaskMonth) || 0,
          trigger_month_list: newTaskMonthList,
          last_done_at: newTaskLastDoneAt || undefined,
          washes_at_last_done: newTaskType === 'washes' && newTaskWashesAtLastDone
            ? parseInt(newTaskWashesAtLastDone) || 0
            : undefined,
        };
        setTasks((prev) => [...prev, newTask]);
        setNewTaskDesc(''); setNewTaskValue(''); setNewTaskDay(''); setNewTaskMonth('');
        setNewTaskMonthList([]); setNewTaskType('months'); setNewTaskLastDoneAt(''); setNewTaskWashesAtLastDone(''); setShowAddTask(false);
      }
    } finally {
      setAddingTask(false);
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Onderhoudstaak verwijderen?')) return;
    await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleUpdateTask(id: string, patch: Pick<DeveloperMaintenanceTask, 'last_done_at' | 'washes_at_last_done'>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function taskTriggerLabel(t: DeveloperMaintenanceTask): string {
    if (t.trigger_type === 'washes') return `Elke ${(t.trigger_value ?? 0).toLocaleString('nl-BE')} wassingen`;
    if (t.trigger_type === 'months') {
      if (t.trigger_value === 12) return '1× per jaar';
      if (t.trigger_value === 24) return 'Om de 2 jaar';
      return `Elke ${t.trigger_value} maanden`;
    }
    if (t.trigger_type === 'fixed_date') return `${t.trigger_day ?? ''} ${MAANDEN[(t.trigger_month ?? 1) - 1]} (jaarlijks)`;
    if (t.trigger_type === 'fixed_months') return (t.trigger_month_list ?? []).map((m) => MAANDEN[m - 1]).join(' + ');
    return '';
  }

  // ── User state ──────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<DeveloperUser['role']>('employee');
  const [addSiteIds, setAddSiteIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  function toggleAddSite(siteId: string) {
    setAddSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((s) => s !== siteId) : [...prev, siteId],
    );
  }

  function handleDelete(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  function handleUpdateSites(id: string, siteIds: string[]) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              siteIds,
              siteNames: siteIds
                .map((sid) => sites.find((s) => s.id === sid)?.name ?? '')
                .filter(Boolean),
            }
          : u,
      ),
    );
  }

  function handleUpdateRole(id: string, role: DeveloperUser['role']) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  function handleUpdateUser(id: string, patch: Partial<DeveloperUser>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!addName || !addEmail || !addPassword) {
      setAddError('Vul alle velden in.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
          role: addRole,
          siteIds: addRole === 'developer' ? [] : addSiteIds,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setAddError(data.error ?? 'Onbekende fout');
        return;
      }
      const newUser: DeveloperUser = {
        id: data.id!,
        name: addName,
        email: addEmail,
        role: addRole,
        siteIds: addRole === 'developer' ? [] : addSiteIds,
        siteNames:
          addRole === 'developer'
            ? []
            : addSiteIds.map((sid) => sites.find((s) => s.id === sid)?.name ?? '').filter(Boolean),
        whatsapp: '',
        is_active: true,
      };
      setUsers((prev) => [...prev, newUser]);
      setAddName(''); setAddEmail(''); setAddPassword('');
      setAddRole('employee'); setAddSiteIds([]);
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  const grouped = {
    developer:  users.filter((u) => u.role === 'developer'),
    owner:      users.filter((u) => u.role === 'owner'),
    technician: users.filter((u) => u.role === 'technician'),
    employee:   users.filter((u) => u.role === 'employee'),
  };

  return (
    <div className={styles.panelWrapper}>
      {/* ── Section tabs ─────────────────────────────────────── */}
      <div className={styles.devTabs}>
        {DEV_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={[styles.devTab, activeTab === t.id ? styles.devTabActive : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ CARWASHES ══════════════════════════════════════ */}
      {activeTab === 'sites' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Carwashes</h1>
          <button type="button" className={styles.addUserBtn} onClick={() => setShowAddSite((v) => !v)}>
            + Nieuwe carwash
          </button>
        </div>

        {showAddSite && (
          <form className={styles.addForm} onSubmit={handleAddSite} noValidate>
            <div className={styles.addFormRow}>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Naam</label>
                <input className={styles.input} value={addSiteName} onChange={(e) => setAddSiteName(e.target.value)} placeholder="Dodane Aalst" />
              </div>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Locatie</label>
                <input className={styles.input} value={addSiteLocation} onChange={(e) => setAddSiteLocation(e.target.value)} placeholder="Aalst" />
              </div>
            </div>
            <div className={styles.addFormFooter}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAddSite(false)}>Annuleren</button>
              <button type="submit" className={styles.saveSmallBtn} disabled={addingSite}>{addingSite ? 'Bezig...' : 'Opslaan'}</button>
            </div>
          </form>
        )}

        <div className={styles.siteList}>
          {sites.map((s) => (
            <div key={s.id} className={styles.siteRow}>
              <span className={styles.siteName}>{s.name}</span>
              <span className={styles.siteLocation}>{s.location}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDeleteSite(s.id, s.name)}
                aria-label={`${s.name} verwijderen`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ══ PRODUCTEN (Voorraad) ═════════════════════════════ */}
      {activeTab === 'stock' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Producten</h1>
        </div>
        {sites.map((s) => {
          const siteStock = stockItems.filter((st) => st.siteId === s.id);
          return (
            <SiteProductsBlock
              key={s.id}
              site={s}
              products={siteStock}
              onAdd={handleAddStock}
              onDelete={handleDeleteStock}
            />
          );
        })}
      </div>
      )}

      {/* ══ PROGRAMMA'S ════════════════════════════════════ */}
      {activeTab === 'programs' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Programma&apos;s &amp; Chemie</h1>
        </div>
        {sites.map((s) => (
          <SiteProgramManager
            key={s.id}
            site={s}
            allSites={sites}
            programs={programs.filter((p) => p.siteId === s.id)}
            availableProducts={stockItems.filter((st) => st.siteId === s.id)}
            onDeleteProgram={handleDeleteProgram}
            onUpdateProgram={handleUpdateProgram}
            onAddProgram={handleAddProgram}
          />
        ))}
      </div>
      )}

      {/* ══ GEBRUIKERS ═════════════════════════════════════ */}
      {activeTab === 'users' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Gebruikers</h1>
          <button type="button" className={styles.addUserBtn} onClick={() => setShowAdd((v) => !v)}>
            + Nieuwe gebruiker
          </button>
        </div>

        {showAdd && (
          <form className={styles.addForm} onSubmit={handleAdd} noValidate>
            <div className={styles.addFormRow}>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Naam</label>
                <input className={styles.input} type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="John Dhoe" />
              </div>
              <div className={styles.addField}>
                <label className={styles.addLabel}>E-mail</label>
                <input className={styles.input} type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="john@domain.com" autoComplete="off" />
              </div>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Wachtwoord</label>
                <input className={styles.input} type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Rol</label>
                <select className={styles.roleSelect} value={addRole} onChange={(e) => setAddRole(e.target.value as DeveloperUser['role'])}>
                  <option value="developer">Developer</option>
                  <option value="owner">Eigenaar</option>
                  <option value="technician">Technieker</option>
                  <option value="employee">Medewerker</option>
                </select>
              </div>
            </div>
            {addRole !== 'developer' && (
              <div className={styles.addFormRow}>
                <div className={styles.addFieldFull}>
                  <label className={styles.addLabel}>Carwash toegang</label>
                  <div className={styles.checkboxGroup}>
                    {sites.map((s) => (
                      <label key={s.id} className={styles.checkboxItem}>
                        <input type="checkbox" checked={addSiteIds.includes(s.id)} onChange={() => toggleAddSite(s.id)} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {addError && <p className={styles.addError}>{addError}</p>}
            <div className={styles.addFormFooter}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Annuleren</button>
              <button type="submit" className={styles.saveSmallBtn} disabled={adding}>{adding ? 'Bezig...' : 'Opslaan'}</button>
            </div>
          </form>
        )}

        {(['developer', 'owner', 'technician', 'employee'] as const).map((role) => (
          grouped[role].length > 0 && (
            <section key={role} className={styles.group}>
              <h2 className={styles.groupTitle}>{ROLE_LABELS[role]}s ({grouped[role].length})</h2>
              <div className={styles.userList}>
                {grouped[role].map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    sites={sites}
                    onDelete={handleDelete}
                    onUpdateSites={handleUpdateSites}
                    onUpdateRole={handleUpdateRole}
                    onUpdateUser={handleUpdateUser}
                  />
                ))}
              </div>
            </section>
          )
        ))}
      </div>
      )}

      {/* ══ ONDERHOUD INSTALLATIE ══════════════════════════ */}
      {activeTab === 'maintenance' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Onderhoud installatie</h1>
          <button type="button" className={styles.addUserBtn} onClick={() => setShowAddTask((v) => !v)}>
            + Nieuwe taak
          </button>
        </div>

        {/* Site selector */}
        <div className={styles.taskSiteRow}>
          <label className={styles.addLabel}>Carwash</label>
          <select
            className={styles.roleSelect}
            value={taskSiteId}
            onChange={(e) => setTaskSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.location}</option>
            ))}
          </select>
        </div>

        {/* Add form */}
        {showAddTask && (
          <form className={styles.addForm} onSubmit={handleAddTask} noValidate>
            <div className={styles.addFormRow}>
              <div className={styles.addFieldFull}>
                <label className={styles.addLabel}>Omschrijving</label>
                <input
                  className={styles.input}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Algemeen nazicht installatie"
                />
              </div>
            </div>
            <div className={styles.addFormRow}>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Type interval</label>
                <select
                  className={styles.roleSelect}
                  value={newTaskType}
                  onChange={(e) => { setNewTaskType(e.target.value as DeveloperMaintenanceTask['trigger_type']); }}
                >
                  <option value="washes">Elke X wassingen</option>
                  <option value="months">Elke X maanden (12 = jaarlijks, 24 = 2 jaar)</option>
                  <option value="fixed_date">Vaste datum per jaar</option>
                  <option value="fixed_months">Vaste maand(en) per jaar</option>
                </select>
              </div>
              {(newTaskType === 'washes' || newTaskType === 'months') && (
                <div className={styles.addField}>
                  <label className={styles.addLabel}>{newTaskType === 'washes' ? 'Aantal wassingen' : 'Aantal maanden'}</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={newTaskValue}
                    onChange={(e) => setNewTaskValue(e.target.value)}
                    placeholder={newTaskType === 'washes' ? '10000' : '12'}
                  />
                </div>
              )}
              {newTaskType === 'fixed_date' && (
                <>
                  <div className={styles.addField}>
                    <label className={styles.addLabel}>Dag</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      max="31"
                      value={newTaskDay}
                      onChange={(e) => setNewTaskDay(e.target.value)}
                      placeholder="15"
                      style={{ width: 80 }}
                    />
                  </div>
                  <div className={styles.addField}>
                    <label className={styles.addLabel}>Maand</label>
                    <select
                      className={styles.roleSelect}
                      value={newTaskMonth}
                      onChange={(e) => setNewTaskMonth(e.target.value)}
                    >
                      <option value="">-- kies --</option>
                      {MAANDEN.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            {newTaskType === 'fixed_months' && (
              <div className={styles.addFormRow}>
                <div className={styles.addFieldFull}>
                  <label className={styles.addLabel}>Maanden</label>
                  <div className={styles.monthGrid}>
                    {MAANDEN.map((m, i) => (
                      <label key={i + 1} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={newTaskMonthList.includes(i + 1)}
                          onChange={() => toggleTaskMonth(i + 1)}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className={styles.addFormRow}>
              <div className={styles.addField}>
                <label className={styles.addLabel}>Laatste beurt (optioneel)</label>
                <input
                  className={styles.input}
                  type="date"
                  value={newTaskLastDoneAt}
                  onChange={(e) => setNewTaskLastDoneAt(e.target.value)}
                />
              </div>
              {newTaskType === 'washes' && (
                <div className={styles.addField}>
                  <label className={styles.addLabel}>Wassingen bij laatste beurt</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    value={newTaskWashesAtLastDone}
                    onChange={(e) => setNewTaskWashesAtLastDone(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <div className={styles.addFormFooter}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowAddTask(false)}>Annuleren</button>
              <button type="submit" className={styles.saveSmallBtn} disabled={addingTask}>{addingTask ? 'Bezig...' : 'Opslaan'}</button>
            </div>
          </form>
        )}

        {/* Task list for selected site */}
        <div className={styles.taskList}>
          {tasks.filter((t) => t.siteId === taskSiteId).length === 0 && (
            <p className={styles.noAccess}>Geen taken voor deze carwash</p>
          )}
          {tasks
            .filter((t) => t.siteId === taskSiteId)
            .map((t) => (
              <MaintenanceTaskRow
                key={t.id}
                task={t}
                label={taskTriggerLabel(t)}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
              />
            ))}
        </div>
      </div>
      )}

      {/* ══ BACK-UP (EXPORT/IMPORT) ═══════════════════════════ */}
      {activeTab === 'backup' && (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Back-up per eigenaar</h1>
        </div>

        {owners.length === 0 ? (
          <p className={styles.noAccess}>Geen eigenaars gevonden.</p>
        ) : (
          <>
            <div className={styles.addFormRow}>
              <div className={styles.addFieldFull}>
                <label className={styles.addLabel}>Eigenaar</label>
                <select
                  className={styles.roleSelect}
                  value={backupOwnerId}
                  onChange={(e) => setBackupOwnerId(e.target.value)}
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email}) — {o.siteNames.join(', ') || 'geen carwashes'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.backupActions}>
              <button type="button" className={styles.addUserBtn} onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporteren...' : '↓ Exporteer back-up (JSON)'}
              </button>
            </div>

            <div className={styles.backupImportSection}>
              <p className={styles.editLabel}>Back-up terug importeren</p>
              <p className={styles.noAccess} style={{ margin: 0 }}>
                Kies een eerder geëxporteerd JSON-bestand. Je krijgt eerst een overzicht te zien voor je iets overschrijft.
              </p>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFileSelected(f); }}
              />
              {checkingImport && <p className={styles.noAccess}>Bestand controleren...</p>}
              {backupError && <p className={styles.addError}>{backupError}</p>}
              {restoreDone && <p className={styles.editLabel} style={{ color: 'var(--color-accent-teal)' }}>Herstel voltooid.</p>}

              {importPreview && (
                <div className={styles.editPanel}>
                  <p className={styles.editLabel}>
                    Back-up van <strong>{importPreview.meta.ownerName}</strong> ({importPreview.meta.ownerEmail}) —{' '}
                    {importPreview.meta.exportedAt ? new Date(importPreview.meta.exportedAt).toLocaleString('nl-BE') : ''}
                  </p>
                  <p className={styles.editLabel}>Carwashes in dit bestand: {importPreview.meta.siteNames?.join(', ')}</p>
                  <div className={styles.taskList}>
                    {Object.keys(importPreview.importCounts).map((key) => (
                      <div key={key} className={styles.taskRow} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px' }}>
                        <span>{key}</span>
                        <span>
                          {importPreview.currentCounts[key] ?? 0} huidig → {importPreview.importCounts[key] ?? 0} in back-up
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.addError}>
                    Bevestigen overschrijft alle bovenstaande huidige data permanent met de back-up ({importFileName}).
                  </p>
                  <div className={styles.addFormFooter}>
                    <button type="button" className={styles.cancelBtn} onClick={() => { setImportPreview(null); setImportPayload(null); setImportFileName(''); }}>
                      Annuleren
                    </button>
                    <button type="button" className={styles.deleteBtnWide} onClick={handleConfirmRestore} disabled={restoring}>
                      {restoring ? 'Bezig met herstellen...' : 'Bevestig herstellen (overschrijft data)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
