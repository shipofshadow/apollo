import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Save, ShieldCheck, Trash2, X } from 'lucide-react';
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

  const canManageRoles = user?.role === 'admin';

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
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
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
            <ShieldCheck className="w-3.5 h-3.5" /> Create Role
          </p>

          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3" onSubmit={handleRoleCreate}>
            <input
              value={newRole.key}
              onChange={e => setNewRole(prev => ({ ...prev, key: e.target.value }))}
              placeholder="Role key"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange"
              required
            />
            <input
              value={newRole.name}
              onChange={e => {
                const name = e.target.value;
                setNewRole(prev => ({ ...prev, name, key: prev.key.trim() === '' ? slugifyRoleKey(name) : prev.key }));
              }}
              placeholder="Role name"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange"
              required
            />
            <input
              value={newRole.description}
              onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange"
            />
            <div className="col-span-1 md:col-span-2 xl:col-span-1 flex gap-2">
              <input
                value={newRole.permissions}
                onChange={e => setNewRole(prev => ({ ...prev, permissions: e.target.value }))}
                placeholder="Permissions"
                className="flex-1 bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange min-w-0"
              />
              <button
                type="submit"
                disabled={creatingRole}
                className="px-3 md:px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {creatingRole ? 'Adding...' : 'Add Role'}
              </button>
            </div>
          </form>

          <div className="border border-gray-800 rounded-lg p-3 bg-brand-darker/50">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Choose Access</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PERMISSION_CATALOG.map(item => (
                <label key={item.key} className="flex items-start gap-2 p-2 rounded-md border border-gray-800 hover:border-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPermissionInRaw(newRole.permissions, item.key)}
                    onChange={() => setNewRole(prev => ({ ...prev, permissions: togglePermissionInRaw(prev.permissions, item.key) }))}
                    className="mt-0.5 accent-brand-orange"
                  />
                  <span>
                    <span className="text-sm text-white font-medium">{item.label}</span>
                    <span className="block text-xs text-gray-500">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Roles table */}
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 px-3">Key</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3 hidden md:table-cell">Description</th>
                  <th className="py-2 px-3 hidden lg:table-cell">Permissions</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRoles ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-orange inline" />
                    </td>
                  </tr>
                ) : pagedRoles.map(role => {
                  const draft = roleEdits[role.id] ?? {
                    key: role.key, name: role.name, description: role.description,
                    permissions: stringifyPermissions(role.permissions),
                  };
                  const isEditing = editingRoleId === role.id;
                  const isSaving  = savingRoleId === role.id;
                  const isDeleting = deletingRoleId === role.id;
                  return (
                    <tr key={role.id} className="border-b border-gray-800/70 align-top text-xs md:text-sm">
                      <td className="py-2.5 px-3 text-gray-300">
                        {isEditing
                          ? <input value={draft.key} disabled={role.isSystem}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, key: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-28 disabled:opacity-60" />
                          : role.key}
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        {isEditing
                          ? <input value={draft.name}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, name: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-36" />
                          : <div className="flex items-center gap-1.5">{role.name}<RoleBadge role={role.key} /></div>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-300 max-w-xs hidden md:table-cell">
                        {isEditing
                          ? <textarea value={draft.description}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, description: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-h-[3rem]" />
                          : (role.description || 'No description')}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 max-w-xs hidden lg:table-cell">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea value={draft.permissions}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, permissions: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-h-[3rem]" />
                            <div className="grid grid-cols-1 gap-0.5 max-h-36 overflow-auto pr-1">
                              {PERMISSION_CATALOG.map(item => (
                                <label key={item.key} className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <input
                                    type="checkbox"
                                    checked={hasPermissionInRaw(draft.permissions, item.key)}
                                    onChange={() => setRoleEdits(prev => ({
                                      ...prev, [role.id]: { ...draft, permissions: togglePermissionInRaw(draft.permissions, item.key) },
                                    }))}
                                    className="accent-brand-orange"
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (role.permissions.map(p => stringifyPermissionLabel(p)).join(', ') || 'No permissions')}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button type="button" disabled={isSaving} onClick={() => handleRoleSave(role.id)}
                                className="p-1.5 rounded-sm border border-gray-700 text-gray-200 hover:border-brand-orange hover:text-white disabled:opacity-60" title="Save">
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button type="button"
                                onClick={() => {
                                  setEditingRoleId(null);
                                  setRoleEdits(prev => ({ ...prev, [role.id]: { key: role.key, name: role.name, description: role.description, permissions: stringifyPermissions(role.permissions) } }));
                                }}
                                className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-gray-500" title="Cancel">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setEditingRoleId(role.id)}
                              className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button type="button" disabled={role.isSystem || isDeleting}
                            onClick={() => handleRoleDelete(role.id, role.name)}
                            className="p-1.5 rounded-sm border border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-40"
                            title={role.isSystem ? 'System role cannot be deleted' : 'Delete role'}>
                            <Trash2 className="w-3.5 h-3.5" />
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
