import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
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
      showToast('Role created.', 'success');
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
      message: `${payload.name || payload.key} will be added to the role list.`,
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
      showToast('Role updated.', 'success');
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
      message: `Updates to ${draft.name || draft.key} will be applied.`,
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
      showToast('Role deleted.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to delete role.', 'error');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleRoleDelete = (roleId: number, roleName: string) => {
    requestConfirmation({
      title: 'Delete role?',
      message: `${roleName} will be permanently removed.`,
      confirmLabel: 'Delete Role',
      tone: 'danger',
      onConfirm: async () => performRoleDelete(roleId),
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Roles' }]} />

      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</p>
            <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wide text-white">Manage Roles</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-300">
              Define roles, assign permissions, and view the full role access matrix.
            </p>
          </div>
          {canManageRoles && activeView === 'manage' && (
            <button
              type="button"
              onClick={() => setShowAddRoleModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New Role
            </button>
          )}
        </div>
      </section>

      {/* View toggle */}
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3">
        <div className="flex gap-2">
          {(['matrix', 'manage'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveView(v)}
              className={[
                'rounded-lg border px-4 py-2.5 text-left transition-all',
                activeView === v
                  ? 'border-brand-orange bg-brand-orange/15 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                  : 'border-gray-700 text-gray-300 hover:border-brand-orange/70 hover:text-white',
              ].join(' ')}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest">
                {v === 'matrix' ? 'Role Matrix' : 'Manage Roles'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Role Matrix */}
      {activeView === 'matrix' && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Role Access Matrix
          </p>
          {loadingRoles ? (
            <div className="py-8 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
              <span className="text-xs">Loading roles...</span>
            </div>
          ) : sortedRoles.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-gray-700" />
              <p className="text-sm text-gray-500">No roles defined yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {sortedRoles.map(role => (
                <article key={role.id} className="rounded-lg border border-gray-800 bg-brand-darker/70 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">{role.name}</p>
                    <RoleBadge role={role.key} />
                  </div>
                  <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">{role.key}</p>
                  <p className="text-xs text-gray-400 mb-3 min-h-[2.5rem]">{role.description || 'No description.'}</p>
                  <ul className="space-y-1.5 text-xs text-gray-300">
                    {role.permissions.length > 0
                      ? role.permissions.map(item => (
                          <li key={item} className="rounded border border-gray-800 bg-brand-dark/70 px-2 py-1">
                            {PERMISSION_LABELS[item] ?? item}
                          </li>
                        ))
                      : <li className="text-gray-500">No permissions listed</li>}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Manage Roles */}
      {activeView === 'manage' && canManageRoles && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> All Roles
          </p>

          {/* Roles table */}
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 px-3">Role Name</th>
                  <th className="py-2 px-3 hidden md:table-cell">Description</th>
                  <th className="py-2 px-3 hidden lg:table-cell">Permissions</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRoles ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-orange inline" />
                    </td>
                  </tr>
                ) : pagedRoles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-gray-700" />
                        <p className="text-sm text-gray-500">No roles found.</p>
                        <button
                          type="button"
                          onClick={() => setShowAddRoleModal(true)}
                          className="mt-1 text-xs text-brand-orange hover:underline"
                        >
                          Add the first role
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : pagedRoles.map(role => {
                  const isDeleting = deletingRoleId === role.id;
                  return (
                    <tr key={role.id} className="border-b border-gray-800/70 align-middle text-xs md:text-sm">
                      <td className="py-2.5 px-3 text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {role.name}
                          <RoleBadge role={role.key} />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{role.key}</p>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300 max-w-xs hidden md:table-cell">
                        {role.description || <span className="text-gray-600">No description</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 max-w-xs hidden lg:table-cell">
                        {role.permissions.map(p => stringifyPermissionLabel(p)).join(', ') || <span className="text-gray-600">No permissions</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button type="button"
                            onClick={() => setEditingRoleId(role.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white text-xs font-semibold whitespace-nowrap transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Role
                          </button>
                          <button type="button"
                            disabled={role.isSystem || isDeleting}
                            onClick={() => handleRoleDelete(role.id, role.name)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200 text-xs font-semibold whitespace-nowrap disabled:opacity-40 transition-colors"
                            title={role.isSystem ? 'System roles cannot be deleted' : undefined}>
                            {isDeleting
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Deleting...</span></>
                              : <><Trash2 className="w-3.5 h-3.5" /><span>Delete Role</span></>}
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
        </section>
      )}

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <ModalShell
          title="Add New Role"
          description="Create a custom role and choose which permissions it grants."
          onClose={() => { if (!creatingRole) { setShowAddRoleModal(false); setNewRole({ key: '', name: '', description: '', permissions: '' }); } }}
        >
          <form className="space-y-4" onSubmit={handleRoleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Role Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={newRole.name}
                  onChange={e => {
                    const name = e.target.value;
                    setNewRole(prev => ({ ...prev, name, key: prev.key.trim() === '' ? slugifyRoleKey(name) : prev.key }));
                  }}
                  placeholder="e.g. Technician"
                  required
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Role Key <span className="text-red-400">*</span>
                </label>
                <input
                  value={newRole.key}
                  onChange={e => setNewRole(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="e.g. technician (auto-filled)"
                  required
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
                <p className="text-[10px] text-gray-600">Unique identifier used internally. Lowercase letters, numbers, and hyphens only.</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Description <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  value={newRole.description}
                  onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this role do?"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Permissions</p>
              <p className="text-xs text-gray-500">Select the actions this role is allowed to perform.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {PERMISSION_CATALOG.map(item => (
                  <label key={item.key} className="flex items-start gap-2 p-2.5 rounded-md border border-gray-800 hover:border-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPermissionInRaw(newRole.permissions, item.key)}
                      onChange={() => setNewRole(prev => ({ ...prev, permissions: togglePermissionInRaw(prev.permissions, item.key) }))}
                      className="mt-0.5 accent-brand-orange shrink-0"
                    />
                    <span>
                      <span className="text-sm text-white font-medium">{item.label}</span>
                      <span className="block text-xs text-gray-500">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => { if (!creatingRole) { setShowAddRoleModal(false); setNewRole({ key: '', name: '', description: '', permissions: '' }); } }}
                disabled={creatingRole}
                className="px-4 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingRole}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {creatingRole
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating...</>
                  : <><Plus className="w-3.5 h-3.5" />Create Role</>}
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
            title="Edit Role"
            description="Update the role's name, description, and permissions."
            onClose={() => {
              if (!isSaving) {
                setEditingRoleId(null);
                if (editingRole) {
                  setRoleEdits(prev => ({ ...prev, [editingRoleId]: { key: editingRole.key, name: editingRole.name, description: editingRole.description, permissions: stringifyPermissions(editingRole.permissions) } }));
                }
              }
            }}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Role Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={draft.name}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, name: e.target.value } }))}
                    placeholder="Role name"
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Role Key
                  </label>
                  <input
                    value={draft.key}
                    disabled={editingRole?.isSystem}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, key: e.target.value } }))}
                    placeholder="role-key"
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange font-mono disabled:opacity-60"
                  />
                  {editingRole?.isSystem && <p className="text-[10px] text-yellow-500">System role keys cannot be changed.</p>}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={e => setRoleEdits(prev => ({ ...prev, [editingRoleId]: { ...draft, description: e.target.value } }))}
                    placeholder="Describe what this role can do"
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange min-h-[3.5rem] resize-y"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Permissions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {PERMISSION_CATALOG.map(item => (
                    <label key={item.key} className="flex items-start gap-2 p-2.5 rounded-md border border-gray-800 hover:border-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPermissionInRaw(draft.permissions, item.key)}
                        onChange={() => setRoleEdits(prev => ({
                          ...prev, [editingRoleId]: { ...draft, permissions: togglePermissionInRaw(draft.permissions, item.key) },
                        }))}
                        className="mt-0.5 accent-brand-orange shrink-0"
                      />
                      <span>
                        <span className="text-sm text-white font-medium">{item.label}</span>
                        <span className="block text-xs text-gray-500">{item.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleRoleSave(editingRoleId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {isSaving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>
                    : <><Save className="w-3.5 h-3.5" />Save Changes</>}
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
