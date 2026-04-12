import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Filter, Loader2, Pencil, Save, ShieldCheck, Trash2, Users, UserPlus, X } from 'lucide-react';
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
  updateAdminUserInfoApi,
  updateAdminUserRoleApi,
  updateAdminUserStatusApi,
  type AdminRole,
  type AdminManagedUser,
} from '../../services/api';
import type { ClientAdminSummary, UserRole } from '../../types';

const TABLE_PAGE_SIZE = 8;
const USER_ROLES: readonly UserRole[] = ['admin', 'manager', 'staff', 'client'];

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

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
  { key: 'email:manage', label: 'Manage Email Config', description: 'Can view secure mailbox config and transport status.' },
  { key: 'email:send', label: 'Send Email', description: 'Can compose and send emails from the admin mailbox panel.' },
  { key: 'email:test', label: 'Send Email Test', description: 'Can send test emails from the configured mailbox transport.' },
  { key: 'email:inbox:view', label: 'View Inbox', description: 'Can read recent emails from the configured mailbox inbox.' },
  { key: 'email:delete', label: 'Delete/Move Email', description: 'Can move or delete mailbox messages.' },
  { key: 'client:self', label: 'Client Portal', description: 'Can use own client account pages only.' },
] as const;

const PERMISSION_LABELS: Record<string, string> = PERMISSION_CATALOG.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {} as Record<string, string>);

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin:   'bg-red-900/50 text-red-300 border-red-800',
  manager: 'bg-amber-900/50 text-amber-300 border-amber-800',
  staff:   'bg-blue-900/50 text-blue-300 border-blue-800',
  client:  'bg-gray-800 text-gray-400 border-gray-700',
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_BADGE_STYLES[role] ?? 'bg-purple-900/50 text-purple-300 border-purple-800';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      {role}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${isActive ? 'bg-green-900/50 text-green-300 border-green-800' : 'bg-red-900/50 text-red-300 border-red-800'}`}>
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

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
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientEditDraft, setClientEditDraft] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });
  const [savingClientId, setSavingClientId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'role-matrix' | 'roles' | 'users' | 'clients'>('role-matrix');
  const [rolePage, setRolePage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);

  const [userSearch, setUserSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [newUser, setNewUser] = useState<{ name: string; email: string; phone: string; password: string; role: UserRole }>({
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

  const nonClientUsers = useMemo(() => {
    return sortedUsers.filter(u => u.role !== 'client');
  }, [sortedUsers]);

  const filteredUsers = useMemo(() => {
    if (!userRoleFilter) return nonClientUsers;
    return nonClientUsers.filter(u => u.role === userRoleFilter);
  }, [nonClientUsers, userRoleFilter]);

  const filteredClients = useMemo(() => {
    if (clientStatusFilter === 'all') return clients;
    const wantActive = clientStatusFilter === 'active';
    return clients.filter(c => (c.is_active !== false) === wantActive);
  }, [clients, clientStatusFilter]);

  const roleOptions = useMemo<UserRole[]>(() => {
    const dynamic = roles.map(r => r.key).filter(isUserRole);
    return dynamic;
  }, [roles]);

  const nonClientRoleOptions = useMemo<UserRole[]>(() => {
    return roleOptions.filter(r => r !== 'client');
  }, [roleOptions]);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const roleTotalPages = Math.max(1, Math.ceil(sortedRoles.length / TABLE_PAGE_SIZE));
  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE));
  const clientsTotalPages = Math.max(1, Math.ceil(filteredClients.length / TABLE_PAGE_SIZE));

  const pagedRoles = useMemo(() => {
    const start = (rolePage - 1) * TABLE_PAGE_SIZE;
    return sortedRoles.slice(start, start + TABLE_PAGE_SIZE);
  }, [sortedRoles, rolePage]);

  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * TABLE_PAGE_SIZE;
    return filteredUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  const pagedClients = useMemo(() => {
    const start = (clientsPage - 1) * TABLE_PAGE_SIZE;
    return filteredClients.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredClients, clientsPage]);

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ key: 'role-matrix' | 'roles' | 'users' | 'clients'; label: string }> = [
      { key: 'role-matrix', label: 'Role Matrix' },
      { key: 'clients', label: 'Manage Clients' },
    ];

    if (canManageUsers) {
      tabs.splice(1, 0, { key: 'roles', label: 'Roles' }, { key: 'users', label: 'Manage Users' });
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
    setUsersPage(1);
  }, [userRoleFilter]);

  useEffect(() => {
    setUsersPage(prev => Math.min(prev, usersTotalPages));
  }, [usersTotalPages]);

  useEffect(() => {
    setClientsPage(1);
  }, [clientStatusFilter]);

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

  const performToggleUserStatus = async (id: number, makeActive: boolean) => {
    if (!token || !canManageUsers) return;
    setTogglingStatusId(id);
    try {
      const { user: updated } = await updateAdminUserStatusApi(token, id, makeActive);
      setUsers(prev => prev.map(item => (item.id === id ? updated : item)));
      setClients(prev => prev.map(item => (item.id === id ? { ...item, is_active: updated.is_active } : item)));
      showToast(makeActive ? 'Account enabled.' : 'Account disabled.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update account status.', 'error');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleToggleUserStatus = (id: number, currentIsActive: boolean, name: string) => {
    const makeActive = !currentIsActive;
    requestConfirmation({
      title: makeActive ? 'Enable account?' : 'Disable account?',
      message: makeActive
        ? `${name}'s account will be re-enabled and they will be able to log in.`
        : `${name}'s account will be disabled. They will not be able to log in until re-enabled.`,
      confirmLabel: makeActive ? 'Enable Account' : 'Disable Account',
      tone: makeActive ? 'default' : 'danger',
      onConfirm: async () => performToggleUserStatus(id, makeActive),
    });
  };

  const handleEditClient = (client: ClientAdminSummary) => {
    setEditingClientId(client.id);
    setClientEditDraft({ name: client.name, email: client.email, phone: client.phone });
  };

  const handleCancelClientEdit = () => {
    setEditingClientId(null);
    setClientEditDraft({ name: '', email: '', phone: '' });
  };

  const performSaveClientEdit = async (id: number) => {
    if (!token || !canManageUsers) return;
    setSavingClientId(id);
    try {
      const { user: updated } = await updateAdminUserInfoApi(token, id, {
        name: clientEditDraft.name.trim(),
        email: clientEditDraft.email.trim(),
        phone: clientEditDraft.phone.trim(),
      });
      setClients(prev => prev.map(item =>
        item.id === id
          ? { ...item, name: updated.name, email: updated.email, phone: updated.phone }
          : item
      ));
      setUsers(prev => prev.map(item => (item.id === id ? updated : item)));
      setEditingClientId(null);
      showToast('Client info updated.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update client info.', 'error');
    } finally {
      setSavingClientId(null);
    }
  };

  const handleSaveClientEdit = (id: number, name: string) => {
    requestConfirmation({
      title: 'Save client changes?',
      message: `Updates to ${name}'s profile will be applied.`,
      confirmLabel: 'Save Changes',
      onConfirm: async () => performSaveClientEdit(id),
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
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">{role.name}</p>
                  <RoleBadge role={role.key} />
                </div>
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
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {role.name}
                            <RoleBadge role={role.key} />
                          </div>
                        )}
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
              <Users className="w-3.5 h-3.5" /> Internal Users
            </p>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5 flex-wrap">
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users"
                className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40"
              />
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="bg-brand-darker border border-gray-700 text-white px-2 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange"
                >
                  <option value="">All Roles</option>
                  {nonClientRoleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
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

          {nonClientRoleOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {nonClientRoleOptions.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setUserRoleFilter(prev => prev === role ? '' : role)}
                  className={`transition-opacity ${userRoleFilter && userRoleFilter !== role ? 'opacity-40' : 'opacity-100'}`}
                >
                  <RoleBadge role={role} />
                </button>
              ))}
            </div>
          )}

          {loadingUsers ? (
            <div className="py-8 md:py-10 flex items-center justify-center"><Loader2 className="w-4 md:w-5 h-4 md:h-5 animate-spin text-brand-orange" /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800 -mx-3 md:mx-0">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                    <th className="py-1.5 md:py-2 px-3 md:px-4">Name</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4 hidden md:table-cell">Email</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4">Role</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4 hidden sm:table-cell">Status</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4 hidden lg:table-cell">Created</th>
                    <th className="py-1.5 md:py-2 px-3 md:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-500">No users found.</td>
                    </tr>
                  ) : pagedUsers.map(item => {
                    const isActive = item.is_active !== false;
                    const isToggling = togglingStatusId === item.id;
                    const isUpdatingRole = updatingRoleId === item.id;
                    return (
                      <tr key={item.id} className={`border-b border-gray-800/70 ${!isActive ? 'opacity-60' : ''}`}>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-white font-medium">{item.name}</td>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs md:text-sm">{item.email}</td>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <select
                              value={item.role}
                              disabled={isUpdatingRole || roleOptions.length === 0}
                              onChange={e => handleRoleChange(item.id, item.role, e.target.value as UserRole, item.name)}
                              className="bg-brand-darker border border-gray-700 text-white px-1.5 md:px-2 py-1 md:py-1.5 rounded-sm text-xs focus:outline-none focus:border-brand-orange disabled:opacity-60"
                            >
                              {roleOptions.map(role => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            <RoleBadge role={item.role} />
                          </div>
                        </td>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4 hidden sm:table-cell">
                          <StatusBadge isActive={isActive} />
                        </td>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-400 hidden lg:table-cell text-xs md:text-sm">{new Date(item.created_at).toLocaleDateString()}</td>
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleUserStatus(item.id, isActive, item.name)}
                            className={`p-1 md:px-2 md:py-1.5 rounded-sm border text-xs disabled:opacity-60 transition-colors ${
                              isActive
                                ? 'border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200'
                                : 'border-green-900/60 text-green-300 hover:border-green-500 hover:text-green-200'
                            }`}
                            title={isActive ? 'Disable account' : 'Enable account'}
                          >
                            {isToggling
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : isActive
                                ? <Ban className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                : <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {renderPager(usersPage, usersTotalPages, filteredUsers.length, setUsersPage)}
            </div>
          )}
        </section>
      )}

      {activeTab === 'clients' && (
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3 md:p-5 space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Client Accounts
          </p>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5 flex-wrap">
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40"
            />
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <select
                value={clientStatusFilter}
                onChange={e => setClientStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="bg-brand-darker border border-gray-700 text-white px-2 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Disabled</option>
              </select>
            </div>
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
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-1.5 md:py-2 px-3 md:px-4">Client</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden md:table-cell">Email</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden lg:table-cell">Phone</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden sm:table-cell">Status</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4">Bookings</th>
                  <th className="py-1.5 md:py-2 px-3 md:px-4 hidden xl:table-cell">Last Booking</th>
                  {canManageUsers && <th className="py-1.5 md:py-2 px-3 md:px-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pagedClients.length === 0 ? (
                  <tr>
                    <td colSpan={canManageUsers ? 7 : 6} className="py-8 text-center text-xs text-gray-500">No clients found.</td>
                  </tr>
                ) : pagedClients.map(item => {
                  const isClientActive = item.is_active !== false;
                  const isEditingThis = editingClientId === item.id;
                  const isSavingThis = savingClientId === item.id;
                  const isTogglingThis = togglingStatusId === item.id;

                  return (
                    <tr key={item.id} className={`border-b border-gray-800/70 align-top ${!isClientActive ? 'opacity-60' : ''}`}>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-white font-medium">
                        {isEditingThis ? (
                          <input
                            value={clientEditDraft.name}
                            onChange={e => setClientEditDraft(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-28"
                            placeholder="Name"
                          />
                        ) : item.name}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs md:text-sm">
                        {isEditingThis ? (
                          <input
                            value={clientEditDraft.email}
                            onChange={e => setClientEditDraft(prev => ({ ...prev, email: e.target.value }))}
                            type="email"
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-36"
                            placeholder="Email"
                          />
                        ) : item.email}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300 hidden lg:table-cell text-xs md:text-sm">
                        {isEditingThis ? (
                          <input
                            value={clientEditDraft.phone}
                            onChange={e => setClientEditDraft(prev => ({ ...prev, phone: e.target.value }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-28"
                            placeholder="Phone"
                          />
                        ) : (item.phone || '—')}
                      </td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 hidden sm:table-cell">
                        <StatusBadge isActive={isClientActive} />
                      </td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-300">{item.bookingCount}</td>
                      <td className="py-1.5 md:py-2.5 px-3 md:px-4 text-gray-400 hidden xl:table-cell text-xs md:text-sm">
                        {item.lastBookingAt ? new Date(item.lastBookingAt).toLocaleDateString() : '—'}
                      </td>
                      {canManageUsers && (
                        <td className="py-1.5 md:py-2.5 px-3 md:px-4">
                          <div className="flex items-center gap-0.5 md:gap-1.5">
                            {isEditingThis ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isSavingThis}
                                  onClick={() => handleSaveClientEdit(item.id, item.name)}
                                  className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-200 hover:border-brand-orange hover:text-white disabled:opacity-60"
                                  title="Save"
                                >
                                  {isSavingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelClientEdit}
                                  className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-gray-500"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEditClient(item)}
                                className="p-1 md:px-2 md:py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-brand-orange hover:text-white"
                                title="Edit client info"
                              >
                                <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isTogglingThis}
                              onClick={() => handleToggleUserStatus(item.id, isClientActive, item.name)}
                              className={`p-1 md:px-2 md:py-1.5 rounded-sm border text-xs disabled:opacity-60 transition-colors ${
                                isClientActive
                                  ? 'border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200'
                                  : 'border-green-900/60 text-green-300 hover:border-green-500 hover:text-green-200'
                              }`}
                              title={isClientActive ? 'Disable account' : 'Enable account'}
                            >
                              {isTogglingThis
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : isClientActive
                                  ? <Ban className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                  : <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {renderPager(clientsPage, clientsTotalPages, filteredClients.length, setClientsPage)}
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
