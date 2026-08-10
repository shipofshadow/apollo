import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, Key, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminRoleApi,
  deleteAdminRoleApi,
  fetchAdminRolesApi,
  updateAdminRoleApi,
  type AdminRole,
} from '../../services/api';
import {
  TABLE_PAGE_SIZE,
  RoleBadge,
  ConfirmDialog,
  ModalShell,
  Breadcrumbs,
  Pager,
} from './_sharedComponents';
import {
  PERMISSION_CATALOG,
  PERMISSION_LABELS,
  stringifyPermissions,
  parsePermissions,
  stringifyPermissionLabel,
  togglePermissionInRaw,
  hasPermissionInRaw,
  slugifyRoleKey,
  type RoleDraft,
  type ConfirmDialogState,
} from './_sharedUtils';

export default function ManageRolesPanel() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageRoles = user?.role === 'admin' || user?.role === 'owner';

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [rolePage, setRolePage] = useState(1);
  const [activeView, setActiveView] = useState<'matrix' | 'manage'>('matrix');

  const [newRole, setNewRole] = useState({ key: '', name: '', description: '', permissions: '' });
  const [roleEdits, setRoleEdits] = useState<Record<number, RoleDraft>>({});

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingDialog, setConfirmingDialog] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name)), [roles]);
  const roleTotalPages = Math.max(1, Math.ceil(sortedRoles.length / TABLE_PAGE_SIZE));
  const pagedRoles = useMemo(() => {
    const start = (rolePage - 1) * TABLE_PAGE_SIZE;
    return sortedRoles.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedRoles, rolePage]);

  const refreshRoleEditState = (nextRoles: AdminRole[]) => {
    const mapped: Record<number, RoleDraft> = {};
    nextRoles.forEach(role => {
      mapped[role.id] = {
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: stringifyPermissions(role.permissions),
      };
    });
    setRoleEdits(mapped);
  };

  const loadRoles = async () => {
    if (!token) return;
    setLoadingRoles(true);
    try {
      const { roles: list } = await fetchAdminRolesApi(token);
      setRoles(list);
      refreshRoleEditState(list);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to load roles.', 'error');
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => { void loadRoles(); }, [token]);
  useEffect(() => { setRolePage(prev => Math.min(prev, roleTotalPages)); }, [roleTotalPages]);

  const requestConfirmation = (config: ConfirmDialogState) => setConfirmDialog(config);
  const closeConfirmation = () => { if (!confirmingDialog) setConfirmDialog(null); };
  const confirmAction = async () => {
    if (!confirmDialog) return;
    setConfirmingDialog(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmingDialog(false);
    }
  };

  const performRoleCreate = async (payload: RoleDraft) => {
    if (!token || !canManageRoles) return;
    setCreatingRole(true);
    try {
      const { role } = await createAdminRoleApi(token, {
        key: payload.key.trim().toLowerCase(),
        name: payload.name.trim(),
        description: payload.description.trim(),
        permissions: parsePermissions(payload.permissions),
      });
      const nextRoles = [role, ...roles];
      setRoles(nextRoles);
      refreshRoleEditState(nextRoles);
      setNewRole({ key: '', name: '', description: '', permissions: '' });
      setShowAddRoleModal(false);
      showToast('Role created successfully.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to create role.', 'error');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleRoleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: RoleDraft = { key: newRole.key, name: newRole.name, description: newRole.description, permissions: newRole.permissions };
    requestConfirmation({
      title: 'Create new role?',
      message: `${payload.name || payload.key} will be added to the role catalog.`,
      confirmLabel: 'Create Role',
      onConfirm: async () => performRoleCreate(payload),
    });
  };

  const performRoleSave = async (roleId: number, draft: RoleDraft) => {
    if (!token || !canManageRoles) return;
    setSavingRoleId(roleId);
    try {
      const { role } = await updateAdminRoleApi(token, roleId, {
        key: draft.key.trim().toLowerCase(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        permissions: parsePermissions(draft.permissions),
      });
      const nextRoles = roles.map(item => (item.id === roleId ? role : item));
      setRoles(nextRoles);
      refreshRoleEditState(nextRoles);
      setEditingRoleId(null);
      showToast('Role updated successfully.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update role.', 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleRoleSave = (roleId: number) => {
    const draft = roleEdits[roleId];
    if (!draft) return;
    requestConfirmation({
      title: 'Save role changes?',
      message: `Updates to ${draft.name || draft.key} will be saved.`,
      confirmLabel: 'Save Changes',
      onConfirm: async () => performRoleSave(roleId, draft),
    });
  };

  const performRoleDelete = async (roleId: number) => {
    if (!token || !canManageRoles) return;
    setDeletingRoleId(roleId);
    try {
      await deleteAdminRoleApi(token, roleId);
      const nextRoles = roles.filter(item => item.id !== roleId);
      setRoles(nextRoles);
      refreshRoleEditState(nextRoles);
      showToast('Role deleted successfully.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to delete role.', 'error');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleRoleDelete = (roleId: number, roleName: string) => {
    requestConfirmation({
      title: 'Delete role?',
      message: `${roleName} will be permanently deleted.`,
      confirmLabel: 'Delete Role',
      tone: 'danger',
      onConfirm: async () => performRoleDelete(roleId),
    });
  };

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Roles' }]} />

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Access Control</p>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Role &amp; Permission Catalog</h2>
            </div>
          </div>

          {canManageRoles && activeView === 'manage' && (
            <button
              type="button"
              onClick={() => setShowAddRoleModal(true)}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Role</span>
            </button>
          )}
        </div>
      </section>

      {/* View Toggle */}
      <section className="rounded-xl border border-gray-800/80 bg-[#121212] p-3 shadow-xl">
        <div className="flex gap-2">
          {(['matrix', 'manage'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveView(v)}
              className={[
                'rounded-lg border px-5 py-2.5 text-left transition-all cursor-pointer font-mono text-xs font-bold uppercase tracking-wider',
                activeView === v
                  ? 'border-brand-orange bg-brand-orange/15 text-white shadow-[0_0_15px_rgba(249,115,22,0.15)] font-bold'
                  : 'border-gray-800 bg-brand-darker/60 text-gray-400 hover:border-brand-orange/60 hover:text-white',
              ].join(' ')}
            >
              <span>{v === 'matrix' ? 'Role Access Matrix' : 'Manage Role List'}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Role Matrix View */}
      {activeView === 'matrix' && (
        <section className="rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
              <Key className="w-4 h-4" /> Comprehensive Role Permission Matrix
            </h3>
            <span className="text-[10px] font-mono text-gray-500">{sortedRoles.length} Roles Defined</span>
          </div>

          {loadingRoles ? (
            <div className="py-16 flex items-center justify-center gap-3 text-xs font-mono text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
              <span>Loading role matrix…</span>
            </div>
          ) : sortedRoles.length === 0 ? (
            <div className="py-16 text-center space-y-2 font-mono">
              <ShieldCheck className="w-10 h-10 text-gray-600 mx-auto opacity-50" />
              <p className="text-xs text-gray-500 uppercase tracking-widest">No roles defined yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {sortedRoles.map(role => (
                <article key={role.id} className="rounded-xl border border-gray-800/80 bg-brand-darker/70 p-5 space-y-3 hover:border-brand-orange/40 transition-all shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-white uppercase">{role.name}</h4>
                      <RoleBadge role={role.key} />
                    </div>
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{role.key}</p>
                    <p className="text-xs text-gray-400 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                      {role.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 space-y-1.5">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 mb-1">Assigned Permissions</p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {role.permissions.length > 0
                        ? role.permissions.map(item => (
                            <div key={item} className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-[#121212] px-2.5 py-1 text-xs font-mono text-gray-300">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{PERMISSION_LABELS[item] ?? item}</span>
                            </div>
                          ))
                        : <p className="text-xs font-mono text-gray-500 italic">No permissions granted</p>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Manage Roles Table View */}
      {activeView === 'manage' && canManageRoles && (
        <section className="rounded-xl border border-gray-800/80 bg-[#121212] overflow-hidden shadow-2xl space-y-4">
          <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Role Catalog Table
            </h3>
            <span className="text-[10px] font-mono text-gray-500">{sortedRoles.length} Roles Active</span>
          </div>

          <div className="p-6 space-y-4">
            <div className="border border-gray-800 rounded-xl overflow-x-auto bg-brand-darker">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-800 bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Role Title &amp; Key</th>
                    <th className="py-3.5 px-4 hidden md:table-cell">Description</th>
                    <th className="py-3.5 px-4 hidden lg:table-cell">Permissions Granted</th>
                    <th className="py-3.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {loadingRoles ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-orange inline" />
                      </td>
                    </tr>
                  ) : pagedRoles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 font-mono">
                          <ShieldCheck className="w-8 h-8 text-gray-600 opacity-50" />
                          <p className="text-xs text-gray-500 uppercase tracking-widest">No custom roles found.</p>
                          <button
                            type="button"
                            onClick={() => setShowAddRoleModal(true)}
                            className="mt-2 text-xs text-brand-orange hover:underline font-bold uppercase"
                          >
                            Add the first role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : pagedRoles.map(role => {
                    const isDeleting = deletingRoleId === role.id;
                    return (
                      <tr key={role.id} className="hover:bg-gray-800/30 transition-colors align-middle">
                        <td className="py-3.5 px-4 text-white font-bold">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{role.name}</span>
                            <RoleBadge role={role.key} />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{role.key}</p>
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 max-w-xs hidden md:table-cell">
                          {role.description || <span className="text-gray-600 italic">No description</span>}
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 max-w-xs hidden lg:table-cell">
                          {role.permissions.map(p => stringifyPermissionLabel(p)).join(', ') || <span className="text-gray-600 italic">None</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setEditingRoleId(role.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-brand-orange text-gray-300 hover:text-white text-xs font-bold uppercase transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-brand-orange" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={role.isSystem || isDeleting}
                              onClick={() => handleRoleDelete(role.id, role.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400 text-xs font-bold uppercase disabled:opacity-30 transition-colors cursor-pointer"
                              title={role.isSystem ? 'System roles cannot be deleted' : undefined}
                            >
                              {isDeleting
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Deleting...</span></>
                                : <><Trash2 className="w-3.5 h-3.5" /><span>Delete</span></>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <Pager page={rolePage} totalPages={roleTotalPages} totalItems={sortedRoles.length} onPageChange={setRolePage} />
            </div>
          </div>
        </section>
      )}

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <ModalShell
          title="Add New Custom Role"
          description="Create a custom access role and assign permissions."
          onClose={() => { if (!creatingRole) { setShowAddRoleModal(false); setNewRole({ key: '', name: '', description: '', permissions: '' }); } }}
        >
          <form className="space-y-5 font-sans" onSubmit={handleRoleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Role Title <span className="text-red-400">*</span>
                </label>
                <input
                  value={newRole.name}
                  onChange={e => {
                    const name = e.target.value;
                    setNewRole(prev => ({ ...prev, name, key: prev.key.trim() === '' ? slugifyRoleKey(name) : prev.key }));
                  }}
                  placeholder="e.g. Lead Technician"
                  required
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Role Key <span className="text-red-400">*</span>
                </label>
                <input
                  value={newRole.key}
                  onChange={e => setNewRole(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="e.g. lead-technician"
                  required
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Description</label>
                <input
                  value={newRole.description}
                  onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Responsibilities and operational scope..."
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Granted Permissions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {PERMISSION_CATALOG.map(item => (
                  <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-gray-800 bg-brand-darker/60 hover:border-brand-orange/40 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={hasPermissionInRaw(newRole.permissions, item.key)}
                      onChange={() => setNewRole(prev => ({ ...prev, permissions: togglePermissionInRaw(prev.permissions, item.key) }))}
                      className="mt-0.5 accent-brand-orange shrink-0 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">{item.label}</span>
                      <span className="text-[11px] text-gray-400 block font-mono">{item.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/80">
              <button
                type="button"
                onClick={() => { if (!creatingRole) { setShowAddRoleModal(false); setNewRole({ key: '', name: '', description: '', permissions: '' }); } }}
                disabled={creatingRole}
                className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingRole}
                className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {creatingRole
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating...</span></>
                  : <><Plus className="w-4 h-4" /><span>Create Role</span></>}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Role Modal */}
      {editingRoleId !== null && (() => {
        const editingRole = roles.find(r => r.id === editingRoleId);
        const draft = roleEdits[editingRoleId] ?? (editingRole ? {
          key: editingRole.key, name: editingRole.name,
          description: editingRole.description, permissions: stringifyPermissions(editingRole.permissions),
        } : { key: '', name: '', description: '', permissions: '' });
        const isSaving = savingRoleId === editingRoleId;
        return (
          <ModalShell
            title="Edit Role Configuration"
            description="Update title, description, and assigned permissions."
            onClose={() => {
              if (!isSaving) {
                setEditingRoleId(null);
                if (editingRole) {
                  setRoleEdits(prev => ({ ...prev, [editingRoleId]: { key: editingRole.key, name: editingRole.name, description: editingRole.description, permissions: stringifyPermissions(editingRole.permissions) } }));
                }
              }
            }}
          >
            <div className="space-y-5 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                    Role Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={draft.name}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, name: e.target.value } }))}
                    placeholder="Role name"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                    Role Key
                  </label>
                  <input
                    value={draft.key}
                    disabled={editingRole?.isSystem}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, key: e.target.value } }))}
                    placeholder="role-key"
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono disabled:opacity-60"
                  />
                  {editingRole?.isSystem && <p className="text-[11px] text-amber-400 font-mono">System role key is locked.</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Description</label>
                  <textarea
                    rows={2}
                    value={draft.description}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, description: e.target.value } }))}
                    placeholder="Describe role responsibilities..."
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Permissions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {PERMISSION_CATALOG.map(item => (
                    <label key={item.key} className="flex items-start gap-3 p-3 rounded-xl border border-gray-800 bg-brand-darker/60 hover:border-brand-orange/40 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={hasPermissionInRaw(draft.permissions, item.key)}
                        onChange={() => setRoleEdits(prev => ({
                          ...prev, [editingRoleId]: { ...draft, permissions: togglePermissionInRaw(draft.permissions, item.key) },
                        }))}
                        className="mt-0.5 accent-brand-orange shrink-0 w-4 h-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">{item.label}</span>
                        <span className="text-[11px] text-gray-400 block font-mono">{item.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    if (!isSaving) {
                      setEditingRoleId(null);
                      if (editingRole) {
                        setRoleEdits(prev => ({ ...prev, [editingRoleId]: { key: editingRole.key, name: editingRole.name, description: editingRole.description, permissions: stringifyPermissions(editingRole.permissions) } }));
                      }
                    }
                  }}
                  className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleRoleSave(editingRoleId)}
                  className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                    : <><Save className="w-4 h-4" /><span>Save Changes</span></>}
                </button>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          confirming={confirmingDialog}
          onConfirm={() => void confirmAction()}
          onClose={closeConfirmation}
        />
      )}
    </div>
  );
}
