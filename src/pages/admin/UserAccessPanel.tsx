import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Save, ShieldCheck, Trash2, Users, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminRoleApi,
  createAdminUserApi,
  deleteAdminRoleApi,
  fetchAdminClientsApi,
  fetchAdminRolesApi,
  fetchAdminUsersApi,
  updateAdminRoleApi,
  updateAdminUserRoleApi,
  type AdminRole,
  type AdminManagedUser,
} from '../../services/api';
import type { ClientAdminSummary, UserRole } from '../../types';

const FALLBACK_ROLES: UserRole[] = ['client', 'staff', 'manager', 'admin'];

const PERMISSION_CATALOG = [
  { key: 'analytics:view', label: 'View Analytics', description: 'Can view dashboard charts and reports.' },
  { key: 'bookings:manage', label: 'Manage Bookings', description: 'Can view and update booking records.' },
  { key: 'bookings:assign-tech', label: 'Assign Technicians', description: 'Can assign team members to jobs.' },
  { key: 'bookings:notes', label: 'Internal Notes', description: 'Can edit internal booking notes.' },
  { key: 'build-updates:manage', label: 'Build Updates', description: 'Can post progress updates and photos.' },
  { key: 'clients:manage', label: 'Manage Clients', description: 'Can view clients and booking counts.' },
  { key: 'users:manage', label: 'Manage Users', description: 'Can create users and change user roles.' },
  { key: 'roles:view', label: 'View Roles', description: 'Can view role matrix and role definitions.' },
  { key: 'roles:manage', label: 'Manage Roles', description: 'Can create, edit, and delete roles.' },
  { key: 'reviews:manage', label: 'Manage Reviews', description: 'Can approve, reject, and delete reviews.' },
  { key: 'shop-hours:manage', label: 'Shop Hours', description: 'Can update business hours.' },
  { key: 'media:upload', label: 'Media Uploads', description: 'Can upload service/product/content media.' },
  { key: 'client:self', label: 'Client Portal', description: 'Can use own client account pages only.' },
] as const;

const PERMISSION_LABELS: Record<string, string> = PERMISSION_CATALOG.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {} as Record<string, string>);

function stringifyPermissions(list: string[]): string {
  return list.join(', ');
}

function parsePermissions(raw: string): string[] {
  const set = new Set<string>();
  raw
    .split(/[\n,]/g)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .forEach(item => set.add(item));

  return Array.from(set);
}

function stringifyPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}

function togglePermissionInRaw(raw: string, permission: string): string {
  const list = parsePermissions(raw);
  const has = list.includes(permission);
  const next = has ? list.filter(item => item !== permission) : [...list, permission];
  return stringifyPermissions(next);
}

function hasPermissionInRaw(raw: string, permission: string): boolean {
  return parsePermissions(raw).includes(permission);
}

function slugifyRoleKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

type RoleDraft = {
  key: string;
  name: string;
  description: string;
  permissions: string;
};

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void>;
};

export default function UserAccessPanel() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageUsers = user?.role === 'admin';

  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [clients, setClients] = useState<ClientAdminSummary[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'role-matrix' | 'roles' | 'users' | 'clients'>('role-matrix');

  const [userSearch, setUserSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
  });

  const [newRole, setNewRole] = useState({
    key: '',
    name: '',
    description: '',
    permissions: '',
  });

  const [roleEdits, setRoleEdits] = useState<Record<number, RoleDraft>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingDialog, setConfirmingDialog] = useState(false);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.id - b.id);
  }, [users]);

  const roleOptions = useMemo<UserRole[]>(() => {
    const dynamic = roles.map(r => r.key).filter(Boolean);
    if (dynamic.length > 0) return dynamic;
    return FALLBACK_ROLES;
  }, [roles]);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ key: 'role-matrix' | 'roles' | 'users' | 'clients'; label: string }> = [
      { key: 'role-matrix', label: 'Role Matrix' },
      { key: 'clients', label: 'Clients' },
    ];

    if (canManageUsers) {
      tabs.splice(1, 0, { key: 'roles', label: 'Roles' }, { key: 'users', label: 'Users' });
    }

    return tabs;
  }, [canManageUsers]);

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

  const loadUsers = async () => {
    if (!token || !canManageUsers) return;
    setLoadingUsers(true);
    try {
      const { users: list } = await fetchAdminUsersApi(token, { search: userSearch.trim() || undefined });
      setUsers(list);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to load users.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadClients = async () => {
    if (!token) return;
    setLoadingClients(true);
    try {
      const { clients: list } = await fetchAdminClientsApi(token, { search: clientSearch.trim() || undefined });
      setClients(list);
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to load clients.', 'error');
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, [token]);

  useEffect(() => {
    void loadUsers();
  }, [token, canManageUsers]);

  useEffect(() => {
    void loadClients();
  }, [token]);

  useEffect(() => {
    if (roleOptions.length === 0) return;
    if (roleOptions.includes(newUser.role)) return;

    const preferred = roleOptions.includes('staff') ? 'staff' : roleOptions[0];
    setNewUser(prev => ({ ...prev, role: preferred }));
  }, [roleOptions, newUser.role]);

  useEffect(() => {
    if (visibleTabs.some(tab => tab.key === activeTab)) return;
    setActiveTab(visibleTabs[0]?.key ?? 'role-matrix');
  }, [visibleTabs, activeTab]);

  const requestConfirmation = (config: ConfirmDialogState) => {
    setConfirmDialog(config);
  };

  const closeConfirmation = () => {
    if (confirmingDialog) return;
    setConfirmDialog(null);
  };

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

  const performCreateUser = async (payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
  }) => {
    if (!token || !canManageUsers) return;

    setCreatingUser(true);
    try {
      const { user: created } = await createAdminUserApi(token, payload);
      setUsers(prev => [created, ...prev]);
      setNewUser({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: roleOptions.includes('staff') ? 'staff' : (roleOptions[0] ?? 'client'),
      });
      showToast('User account created.', 'success');
      await loadClients();
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to create user.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      phone: newUser.phone.trim() || undefined,
      password: newUser.password,
      role: newUser.role,
    };

    requestConfirmation({
      title: 'Create user account?',
      message: `This will create a login for ${payload.name || payload.email} with the ${payload.role} role.`,
      confirmLabel: 'Create User',
      onConfirm: async () => performCreateUser(payload),
    });
  };

  const performRoleChange = async (id: number, role: UserRole) => {
    if (!token || !canManageUsers) return;
    setUpdatingRoleId(id);
    try {
      const { user: updated } = await updateAdminUserRoleApi(token, id, role);
      setUsers(prev => prev.map(item => (item.id === id ? updated : item)));
      showToast('Role updated.', 'success');
      await loadClients();
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update role.', 'error');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRoleChange = (id: number, currentRole: UserRole, nextRole: UserRole, label: string) => {
    if (currentRole === nextRole) return;

    requestConfirmation({
      title: 'Change user role?',
      message: `${label} will be moved from ${currentRole} to ${nextRole}.`,
      confirmLabel: 'Change Role',
      onConfirm: async () => performRoleChange(id, nextRole),
    });
  };

  const performRoleCreate = async (payload: RoleDraft) => {
    if (!token || !canManageUsers) return;

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
    const payload: RoleDraft = {
      key: newRole.key,
      name: newRole.name,
      description: newRole.description,
      permissions: newRole.permissions,
    };

    requestConfirmation({
      title: 'Create new role?',
      message: `${payload.name || payload.key} will be added to the role list.`,
      confirmLabel: 'Create Role',
      onConfirm: async () => performRoleCreate(payload),
    });
  };

  const performRoleSave = async (roleId: number, draft: RoleDraft) => {
    if (!token || !canManageUsers) return;

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
      await loadUsers();
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
    if (!token || !canManageUsers) return;

    setDeletingRoleId(roleId);
    try {
      await deleteAdminRoleApi(token, roleId);
      const nextRoles = roles.filter(item => item.id !== roleId);
      setRoles(nextRoles);
      refreshRoleEditState(nextRoles);
      showToast('Role deleted.', 'success');
      await loadUsers();
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
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">User Access</h2>

      <section className="bg-brand-dark border border-gray-800 rounded-sm p-3">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors',
                  isActive
                    ? 'bg-brand-orange text-white'
                    : 'border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === 'role-matrix' && (
      <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Role Access Matrix
        </p>
        {loadingRoles ? (
          <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {sortedRoles.map(role => (
              <article key={role.id} className="border border-gray-800 rounded-sm p-3 bg-brand-darker/70">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">{role.name}</p>
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">{role.key}</p>
                <p className="text-xs text-gray-400 mb-2">{role.description || 'No description.'}</p>
                <ul className="space-y-1 text-xs text-gray-400">
                  {role.permissions.length > 0 ? role.permissions.map(item => (
                    <li key={item}>- {stringifyPermissionLabel(item)}</li>
                  )) : <li>- No permissions listed</li>}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      )}

      {canManageUsers && activeTab === 'roles' && (
        <section className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Manage Roles
          </p>

          <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" onSubmit={handleRoleCreate}>
            <input
              value={newRole.key}
              onChange={e => setNewRole(prev => ({ ...prev, key: e.target.value }))}
              placeholder="Role key (e.g. advisor)"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              required
            />
            <input
              value={newRole.name}
              onChange={e => {
                const name = e.target.value;
                setNewRole(prev => ({
                  ...prev,
                  name,
                  key: prev.key.trim() === '' ? slugifyRoleKey(name) : prev.key,
                }));
              }}
              placeholder="Role name"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              required
            />
            <input
              value={newRole.description}
              onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
            />
            <div className="flex gap-2">
              <input
                value={newRole.permissions}
                onChange={e => setNewRole(prev => ({ ...prev, permissions: e.target.value }))}
                placeholder="Selected permissions appear here"
                className="flex-1 bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              />
              <button
                type="submit"
                disabled={creatingRole}
                className="px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {creatingRole ? 'Adding...' : 'Add Role'}
              </button>
            </div>
          </form>

          <div className="border border-gray-800 rounded-sm p-3 bg-brand-darker/50">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Choose Access</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PERMISSION_CATALOG.map(item => (
                <label key={item.key} className="flex items-start gap-2 p-2 rounded-sm border border-gray-800 hover:border-gray-700 cursor-pointer">
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Permissions</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRoles.map(role => {
                  const draft = roleEdits[role.id] ?? {
                    key: role.key,
                    name: role.name,
                    description: role.description,
                    permissions: stringifyPermissions(role.permissions),
                  };
                  const isEditing = editingRoleId === role.id;
                  const isSaving = savingRoleId === role.id;
                  const isDeleting = deletingRoleId === role.id;

                  return (
                    <tr key={role.id} className="border-b border-gray-800/70 align-top">
                      <td className="py-2.5 pr-4 text-gray-300">
                        {isEditing ? (
                          <input
                            value={draft.key}
                            disabled={role.isSystem}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, key: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1.5 rounded-sm text-xs w-32 disabled:opacity-60"
                          />
                        ) : role.key}
                      </td>
                      <td className="py-2.5 pr-4 text-white">
                        {isEditing ? (
                          <input
                            value={draft.name}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, name: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1.5 rounded-sm text-xs w-40"
                          />
                        ) : role.name}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-300 max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={draft.description}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, description: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1.5 rounded-sm text-xs w-full min-h-[64px]"
                          />
                        ) : (role.description || 'No description')}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 max-w-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={draft.permissions}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, permissions: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-2 py-1.5 rounded-sm text-xs w-full min-h-[64px]"
                            />
                            <div className="grid grid-cols-1 gap-1 max-h-36 overflow-auto pr-1">
                              {PERMISSION_CATALOG.map(item => (
                                <label key={item.key} className="flex items-center gap-2 text-xs text-gray-400">
                                  <input
                                    type="checkbox"
                                    checked={hasPermissionInRaw(draft.permissions, item.key)}
                                    onChange={() => setRoleEdits(prev => ({
                                      ...prev,
                                      [role.id]: { ...draft, permissions: togglePermissionInRaw(draft.permissions, item.key) },
                                    }))}
                                    className="accent-brand-orange"
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (role.permissions.map(item => stringifyPermissionLabel(item)).join(', ') || 'No permissions')}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleRoleSave(role.id)}
                                className="px-2 py-1.5 rounded-sm border border-gray-700 text-xs text-gray-200 hover:border-brand-orange hover:text-white disabled:opacity-60"
                                title="Save"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoleId(null);
                                  setRoleEdits(prev => ({
                                    ...prev,
                                    [role.id]: {
                                      key: role.key,
                                      name: role.name,
                                      description: role.description,
                                      permissions: stringifyPermissions(role.permissions),
                                    },
                                  }));
                                }}
                                className="px-2 py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-gray-500"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingRoleId(role.id)}
                              className="px-2 py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-brand-orange hover:text-white"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={role.isSystem || isDeleting}
                            onClick={() => handleRoleDelete(role.id, role.name)}
                            className="px-2 py-1.5 rounded-sm border border-red-900/60 text-xs text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-40"
                            title={role.isSystem ? 'System role cannot be deleted' : 'Delete role'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canManageUsers && activeTab === 'users' && (
        <section className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Create User Account
          </p>

          <form className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3" onSubmit={handleCreateUser}>
            <input
              value={newUser.name}
              onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              required
            />
            <input
              value={newUser.email}
              onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              type="email"
              required
            />
            <input
              value={newUser.phone}
              onChange={e => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone (optional)"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
            />
            <input
              value={newUser.password}
              onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Password"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              type="password"
              minLength={8}
              required
            />
            <div className="flex gap-2">
              <select
                value={newUser.role}
                onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="flex-1 bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              >
                {roleOptions.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {creatingUser ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </section>
      )}

      {canManageUsers && activeTab === 'users' && (
        <section className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Manage Users
            </p>
            <div className="flex items-center gap-2">
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users"
                className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange"
              />
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white"
              >
                Search
              </button>
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 text-[11px] uppercase tracking-widest border-b border-gray-800">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(item => (
                    <tr key={item.id} className="border-b border-gray-800/70">
                      <td className="py-2.5 pr-4 text-white font-medium">{item.name}</td>
                      <td className="py-2.5 pr-4 text-gray-300">{item.email}</td>
                      <td className="py-2.5 pr-4">
                        <select
                          value={item.role}
                          disabled={updatingRoleId === item.id}
                          onChange={e => handleRoleChange(item.id, item.role, e.target.value as UserRole, item.name)}
                          className="bg-brand-darker border border-gray-700 text-white px-2 py-1.5 rounded-sm text-xs focus:outline-none focus:border-brand-orange disabled:opacity-60"
                        >
                          {roleOptions.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'clients' && (
      <section className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Manage Clients
          </p>
          <div className="flex items-center gap-2">
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients"
              className="bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange"
            />
            <button
              type="button"
              onClick={() => void loadClients()}
              className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white"
            >
              Search
            </button>
          </div>
        </div>

        {loadingClients ? (
          <div className="py-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500 text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Bookings</th>
                  <th className="py-2 pr-4">Last Booking</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(item => (
                  <tr key={item.id} className="border-b border-gray-800/70">
                    <td className="py-2.5 pr-4 text-white font-medium">{item.name}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{item.email}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{item.phone || '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{item.bookingCount}</td>
                    <td className="py-2.5 pr-4 text-gray-400">
                      {item.lastBookingAt ? new Date(item.lastBookingAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-sm border border-gray-700 bg-brand-dark p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-gray-300">{confirmDialog.message}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={confirmingDialog}
                className="px-3 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={confirmingDialog}
                className={[
                  'px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50',
                  confirmDialog.tone === 'danger' ? 'bg-red-700 hover:bg-red-600' : 'bg-brand-orange hover:bg-orange-600',
                ].join(' ')}
              >
                {confirmingDialog ? 'Please wait...' : (confirmDialog.confirmLabel ?? 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
