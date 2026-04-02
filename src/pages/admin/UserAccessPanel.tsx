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

const TABLE_PAGE_SIZE = 8;

const PERMISSION_CATALOG = [
  { key: 'analytics:view', label: 'View Analytics', description: 'Can view dashboard charts and reports.' },
  { key: 'bookings:manage', label: 'Manage Bookings', description: 'Can view and update booking records.' },
  { key: 'bookings:assign-tech', label: 'Assign Technicians', description: 'Can assign team members to jobs.' },
  { key: 'bookings:notes', label: 'Internal Notes', description: 'Can edit internal booking notes.' },
  { key: 'chatbot:manage', label: 'Manage Chatbot', description: 'Can access the chatbot console, handoff queue, and reply as an agent.' },
  { key: 'build-updates:manage', label: 'Build Updates', description: 'Can post progress updates and photos.' },
  { key: 'clients:manage', label: 'Manage Clients', description: 'Can view clients and booking counts.' },
  { key: 'users:manage', label: 'Manage Users', description: 'Can create users and change user roles.' },
  { key: 'roles:view', label: 'View Roles', description: 'Can view role matrix and role definitions.' },
  { key: 'roles:manage', label: 'Manage Roles', description: 'Can create, edit, and delete roles.' },
  { key: 'security:audit:view', label: 'Security Audit', description: 'Can view and export authentication security audit logs.' },
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
  const [rolePage, setRolePage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);

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
    return dynamic;
  }, [roles]);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const roleTotalPages = Math.max(1, Math.ceil(sortedRoles.length / TABLE_PAGE_SIZE));
  const usersTotalPages = Math.max(1, Math.ceil(sortedUsers.length / TABLE_PAGE_SIZE));
  const clientsTotalPages = Math.max(1, Math.ceil(clients.length / TABLE_PAGE_SIZE));

  const pagedRoles = useMemo(() => {
    const start = (rolePage - 1) * TABLE_PAGE_SIZE;
    return sortedRoles.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedRoles, rolePage]);

  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * TABLE_PAGE_SIZE;
    return sortedUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedUsers, usersPage]);

  const pagedClients = useMemo(() => {
    const start = (clientsPage - 1) * TABLE_PAGE_SIZE;
    return clients.slice(start, start + TABLE_PAGE_SIZE);
  }, [clients, clientsPage]);

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

  useEffect(() => {
    setRolePage(prev => Math.min(prev, roleTotalPages));
  }, [roleTotalPages]);

  useEffect(() => {
    setUsersPage(prev => Math.min(prev, usersTotalPages));
  }, [usersTotalPages]);

  useEffect(() => {
    setClientsPage(prev => Math.min(prev, clientsTotalPages));
  }, [clientsTotalPages]);

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
        role: roleOptions.includes('staff') ? 'staff' : (roleOptions[0] ?? newUser.role),
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
    if (roleOptions.length === 0) {
      showToast('API is offline.', 'error');
      return;
    }

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

  const renderPager = (
    page: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (next: number) => void,
  ) => {
    const from = totalItems === 0 ? 0 : (page - 1) * TABLE_PAGE_SIZE + 1;
    const to = Math.min(page * TABLE_PAGE_SIZE, totalItems);

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 px-3 py-2">
        <p className="text-xs text-gray-400">
          Showing {from}-{to} of {totalItems}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-sm border border-gray-700 px-2 py-1 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-40"
          >
            Prev
          </button>
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-sm border border-gray-700 px-2 py-1 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</p>
              <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wide text-white">User Access</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-300">
                Manage user accounts, role permissions, and client directory visibility from one control center.
              </p>
            </div>
            <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-widest text-gray-300">Active View</p>
              <p className="text-sm font-semibold text-white">
                {visibleTabs.find(tab => tab.key === activeTab)?.label ?? 'Role Matrix'}
              </p>
            </div>
          </div>

        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'group rounded-lg border px-3 py-3 text-left transition-all',
                  isActive
                    ? 'border-brand-orange bg-brand-orange/15 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                    : 'border-gray-700 text-gray-300 hover:border-brand-orange/70 hover:text-white',
                ].join(' ')}
              >
                <span className="block text-[11px] font-bold uppercase tracking-widest">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === 'role-matrix' && (
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Role Access Matrix
        </p>
        {loadingRoles ? (
          <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {sortedRoles.map(role => (
              <article key={role.id} className="rounded-lg border border-gray-800 bg-brand-darker/70 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">{role.name}</p>
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">{role.key}</p>
                <p className="text-xs text-gray-400 mb-3 min-h-[2.5rem]">{role.description || 'No description.'}</p>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  {role.permissions.length > 0 ? role.permissions.map(item => (
                    <li key={item} className="rounded border border-gray-800 bg-brand-dark/70 px-2 py-1">
                      {stringifyPermissionLabel(item)}
                    </li>
                  )) : <li className="text-gray-500">No permissions listed</li>}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      )}

      {canManageUsers && activeTab === 'roles' && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Manage Roles
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
                setNewRole(prev => ({
                  ...prev,
                  name,
                  key: prev.key.trim() === '' ? slugifyRoleKey(name) : prev.key,
                }));
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
            <div className="col-span-1 md:col-span-2 xl:col-span-1 flex flex-col md:flex-row gap-2">
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

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-1.5 md:py-2 px-2 md:pr-4">Key</th>
                  <th className="py-1.5 md:py-2 px-2 md:pr-4">Name</th>
                  <th className="py-1.5 md:py-2 px-2 md:pr-4 hidden md:table-cell">Description</th>
                  <th className="py-1.5 md:py-2 px-2 md:pr-4 hidden lg:table-cell">Permissions</th>
                  <th className="py-1.5 md:py-2 px-2 md:pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRoles.map(role => {
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
                    <tr key={role.id} className="border-b border-gray-800/70 align-top text-xs md:text-sm">
                      <td className="py-1.5 md:py-2.5 px-2 md:pr-4 text-gray-300">
                        {isEditing ? (
                          <input
                            value={draft.key}
                            disabled={role.isSystem}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, key: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs w-20 md:w-32 disabled:opacity-60"
                          />
                        ) : role.key}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-2 md:pr-4 text-white">
                        {isEditing ? (
                          <input
                            value={draft.name}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, name: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs w-24 md:w-40"
                          />
                        ) : role.name}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-2 md:pr-4 text-gray-300 max-w-xs hidden md:table-cell">
                        {isEditing ? (
                          <textarea
                            value={draft.description}
                            onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, description: e.target.value } }))}
                            className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs w-full min-h-12 md:min-h-16"
                          />
                        ) : (role.description || 'No description')}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-2 md:pr-4 text-gray-400 max-w-xs hidden lg:table-cell">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={draft.permissions}
                              onChange={e => setRoleEdits(prev => ({ ...prev, [role.id]: { ...draft, permissions: e.target.value } }))}
                              className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs w-full min-h-12 md:min-h-16"
                            />
                            <div className="grid grid-cols-1 gap-0.5 max-h-28 md:max-h-36 overflow-auto pr-1">
                              {PERMISSION_CATALOG.map(item => (
                                <label key={item.key} className="flex items-center gap-1 text-[10px] md:text-xs text-gray-400">
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
                      <td className="py-1.5 md:py-2.5 px-2 md:pr-4">
                        <div className="flex items-center gap-0.5 md:gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleRoleSave(role.id)}
                                className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-200 hover:border-brand-orange hover:text-white disabled:opacity-60"
                                title="Save"
                              >
                                <Save className="w-3 h-3 md:w-3.5 md:h-3.5" />
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
                                className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-gray-500"
                                title="Cancel"
                              >
                                <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingRoleId(role.id)}
                              className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-brand-orange hover:text-white"
                              title="Edit"
                            >
                              <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={role.isSystem || isDeleting}
                            onClick={() => handleRoleDelete(role.id, role.name)}
                            className="p-1 md:px-2 md:py-1.5 rounded-sm border border-red-900/60 text-xs text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-40"
                            title={role.isSystem ? 'System role cannot be deleted' : 'Delete role'}
                          >
                            <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPager(rolePage, roleTotalPages, sortedRoles.length, setRolePage)}
          </div>
        </section>
      )}

      {canManageUsers && activeTab === 'users' && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-5 space-y-4">
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
                disabled={roleOptions.length === 0}
                className="flex-1 bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
              >
                {roleOptions.length > 0
                  ? roleOptions.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))
                  : <option value="" disabled>No roles available</option>}
              </select>
              <button
                type="submit"
                disabled={creatingUser || roleOptions.length === 0}
                className="px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {creatingUser ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
          {roleOptions.length === 0 && (
            <p className="text-xs text-yellow-400">No roles loaded from API. User creation is disabled while API is offline.</p>
          )}
        </section>
      )}

      {canManageUsers && activeTab === 'users' && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-3 md:p-5 space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Manage Users
            </p>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5">
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users"
                className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40"
              />
              <button
                type="button"
                onClick={() => {
                  setUsersPage(1);
                  void loadUsers();
                }}
                className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-8 md:py-10 flex items-center justify-center"><Loader2 className="w-4 md:w-5 h-4 md:h-5 animate-spin text-brand-orange" /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800 -mx-3 md:mx-0">
              <table className="w-full text-left text-xs md:text-sm inline-block md:table min-w-full\">
                <thead>
                  <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                    <th className="py-1.5 md:py-2 px-3 md:px-4">Name</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4 hidden md:table-cell">Email</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4">Role</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4 hidden lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map(item => (
                    <tr key={item.id} className="border-b border-gray-800/70">
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-white font-medium">{item.name}</td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs md:text-sm">{item.email}</td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4">
                        <select
                          value={item.role}
                          disabled={updatingRoleId === item.id || roleOptions.length === 0}
                          onChange={e => handleRoleChange(item.id, item.role, e.target.value as UserRole, item.name)}
                          className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs focus:outline-none focus:border-brand-orange disabled:opacity-60"
                        >
                          {roleOptions.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-400 hidden lg:table-cell text-xs md:text-sm">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPager(usersPage, usersTotalPages, sortedUsers.length, setUsersPage)}
            </div>
          )}
        </section>
      )}

      {activeTab === 'clients' && (
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3 md:p-5 space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Manage Clients
          </p>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5\">
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40"
            />
            <button
              type="button"
              onClick={() => {
                setClientsPage(1);
                void loadClients();
              }}
              className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </div>

        {loadingClients ? (
          <div className="py-8 md:py-10 flex items-center justify-center"><Loader2 className="w-4 md:w-5 h-4 md:h-5 animate-spin text-brand-orange" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800 -mx-3 md:mx-0">
            <table className="w-full text-left text-xs md:text-sm inline-block md:table min-w-full\">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-1.5 md:py-2 px-3 md:px-4">Client</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden md:table-cell\">Email</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden lg:table-cell\">Phone</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4\">Bookings</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden xl:table-cell\">Last Booking</th>
                </tr>
              </thead>
              <tbody>
                {pagedClients.map(item => (
                  <tr key={item.id} className="border-b border-gray-800/70\">
                    <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-white font-medium\">{item.name}</td>
                    <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs md:text-sm\">{item.email}</td>
                    <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden lg:table-cell text-xs md:text-sm\">{item.phone || '—'}</td>
                    <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300\">{item.bookingCount}</td>
                    <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-400 hidden xl:table-cell text-xs md:text-sm\">
                      {item.lastBookingAt ? new Date(item.lastBookingAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPager(clientsPage, clientsTotalPages, clients.length, setClientsPage)}
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
