import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Filter, Loader2, LockIcon, Pencil, Save, Trash2, UserPlus, Users, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminUserApi,
  deleteAdminUserApi,
  fetchAdminRolesApi,
  fetchAdminUsersApi,
  updateAdminUserInfoApi,
  updateAdminUserRoleApi,
  updateAdminUserStatusApi,
  type AdminManagedUser,
  type AdminRole,
} from '../../services/api';
import type { UserRole } from '../../types';
import {
  TABLE_PAGE_SIZE,
  RoleBadge,
  StatusBadge,
  ConfirmDialog,
  ModalShell,
  Breadcrumbs,
  Pager,
} from './_sharedComponents';
import { type ConfirmDialogState } from './_sharedUtils';
import { getDicebearAvatarDataUri } from '../../utils/avatar';

const USER_ROLES: readonly UserRole[] = ['owner', 'admin', 'manager', 'staff', 'client'];

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export default function ManageUsersPanel() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageUsers = user?.role === 'admin' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';

  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [userEditDraft, setUserEditDraft] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });

  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const [newUser, setNewUser] = useState<{ name: string; email: string; phone: string; password: string; role: UserRole }>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingDialog, setConfirmingDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const roleOptions = useMemo<UserRole[]>(() => roles.map(r => r.key).filter(isUserRole), [roles]);
  const nonClientRoleOptions = useMemo<UserRole[]>(() => roleOptions.filter(r => r !== 'client'), [roleOptions]);

  const nonClientUsers = useMemo(() => users.filter(u => u.role !== 'client'), [users]);

  const filteredUsers = useMemo(() => {
    if (!userRoleFilter) return nonClientUsers;
    return nonClientUsers.filter(u => u.role === userRoleFilter);
  }, [nonClientUsers, userRoleFilter]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE));

  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * TABLE_PAGE_SIZE;
    return filteredUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  const loadRoles = async () => {
    if (!token) return;
    try {
      const { roles: list } = await fetchAdminRolesApi(token);
      setRoles(list);
    } catch {
      // non-critical
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

  useEffect(() => { void loadRoles(); }, [token]);
  useEffect(() => { void loadUsers(); }, [token, canManageUsers]);
  useEffect(() => { setUsersPage(1); }, [userRoleFilter]);
  useEffect(() => { setUsersPage(prev => Math.min(prev, usersTotalPages)); }, [usersTotalPages]);

  useEffect(() => {
    if (roleOptions.length === 0 || roleOptions.includes(newUser.role)) return;
    const preferred = roleOptions.includes('staff') ? 'staff' : roleOptions[0];
    setNewUser(prev => ({ ...prev, role: preferred }));
  }, [roleOptions, newUser.role]);

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

  const performCreateUser = async (payload: { name: string; email: string; phone?: string; password: string; role: UserRole }) => {
    if (!token || !canManageUsers) return;
    setCreatingUser(true);
    try {
      const { user: created } = await createAdminUserApi(token, payload);
      setUsers(prev => [created, ...prev]);
      setNewUser({ name: '', email: '', phone: '', password: '', role: roleOptions.includes('staff') ? 'staff' : (roleOptions[0] ?? newUser.role) });
      setShowCreateModal(false);
      showToast('User account created successfully.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to create user.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleOptions.length) { showToast('API is offline.', 'error'); return; }
    const payload = { name: newUser.name.trim(), email: newUser.email.trim(), phone: newUser.phone.trim() || undefined, password: newUser.password, role: newUser.role };
    requestConfirmation({
      title: 'Create user account?',
      message: `Create login credentials for ${payload.name || payload.email} with the ${payload.role} role.`,
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
      showToast('User role updated successfully.', 'success');
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
      message: `${label} will be changed from ${currentRole} to ${nextRole}.`,
      confirmLabel: 'Change Role',
      onConfirm: async () => performRoleChange(id, nextRole),
    });
  };

  const performSaveUserEdit = async (id: number) => {
    if (!token || !canManageUsers) return;
    setSavingUserId(id);
    try {
      const { user: updated } = await updateAdminUserInfoApi(token, id, {
        name: userEditDraft.name.trim(),
        email: userEditDraft.email.trim(),
        phone: userEditDraft.phone.trim(),
      });
      setUsers(prev => prev.map(item => (item.id === id ? updated : item)));
      setEditingUserId(null);
      setUserEditDraft({ name: '', email: '', phone: '' });
      showToast('User details updated.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update user info.', 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleEditUser = (user: AdminManagedUser) => {
    setEditingUserId(user.id);
    setUserEditDraft({ name: user.name, email: user.email, phone: user.phone ?? '' });
  };

  const handleCancelUserEdit = () => {
    setEditingUserId(null);
    setUserEditDraft({ name: '', email: '', phone: '' });
  };

  const handleSaveUserEdit = (id: number, name: string) => {
    requestConfirmation({
      title: 'Save user details?',
      message: `Updates to ${name}'s account will be saved.`,
      confirmLabel: 'Save Changes',
      onConfirm: async () => performSaveUserEdit(id),
    });
  };

  const performToggleStatus = async (id: number, makeActive: boolean) => {
    if (!token || !canManageUsers) return;
    setTogglingStatusId(id);
    try {
      const { user: updated } = await updateAdminUserStatusApi(token, id, makeActive);
      setUsers(prev => prev.map(item => (item.id === id ? updated : item)));
      showToast(makeActive ? 'Account enabled.' : 'Account disabled.', 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to update account status.', 'error');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleToggleStatus = (id: number, isActive: boolean, name: string) => {
    const makeActive = !isActive;
    requestConfirmation({
      title: makeActive ? 'Enable user account?' : 'Disable user account?',
      message: makeActive
        ? `${name}'s account will be enabled for login.`
        : `${name}'s account will be disabled. They cannot log in until re-enabled.`,
      confirmLabel: makeActive ? 'Enable Account' : 'Disable Account',
      tone: makeActive ? 'default' : 'danger',
      onConfirm: async () => performToggleStatus(id, makeActive),
    });
  };

  const performDeleteUser = async (id: number, name: string) => {
    if (!token || !canManageUsers) return;
    setDeletingUserId(id);
    try {
      await deleteAdminUserApi(token, id);
      setUsers(prev => prev.filter(item => item.id !== id));
      showToast(`${name}'s account deleted.`, 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to delete user.', 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteUser = (id: number, name: string) => {
    requestConfirmation({
      title: 'Delete user account?',
      message: `${name}'s account will be permanently deleted. This action cannot be undone.`,
      confirmLabel: 'Delete User',
      tone: 'danger',
      onConfirm: async () => performDeleteUser(id, name),
    });
  };

  if (!canManageUsers) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-8 text-center space-y-3 font-sans shadow-2xl">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-display font-black uppercase tracking-tight text-red-200">Access Restricted</h3>
        <p className="text-xs font-mono text-red-300/80 max-w-md mx-auto">
          User account management is restricted to Root Owners and Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Users' }]} />

      {/* Top Hero Header Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <Users className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Staff &amp; Admin Access</p>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Internal User Directory</h2>
            </div>
          </div>
          {canManageUsers && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          )}
        </div>
      </section>

      {/* Users List Panel */}
      <section className="rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-800/80 pb-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
            <Users className="w-4 h-4" /> Internal Accounts Catalog
          </h3>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search name or email..."
                className="w-full bg-brand-darker border border-gray-800 text-white pl-9 pr-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="">All Roles</option>
                {nonClientRoleOptions.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={() => { setUsersPage(1); void loadUsers(); }}
              className="px-4 py-2 bg-brand-darker border border-gray-800 hover:border-brand-orange text-gray-300 hover:text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        {nonClientRoleOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {nonClientRoleOptions.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => setUserRoleFilter(prev => prev === role ? '' : role)}
                className={`transition-all cursor-pointer ${userRoleFilter && userRoleFilter !== role ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
              >
                <RoleBadge role={role} />
              </button>
            ))}
          </div>
        )}

        {loadingUsers ? (
          <div className="py-16 flex items-center justify-center gap-3 text-xs font-mono text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
            <span>Loading user directory…</span>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-x-auto bg-brand-darker">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">User Name</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Email Address</th>
                  <th className="py-3.5 px-4">Assigned Role</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Status</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Created Date</th>
                  <th className="py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {pagedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500">
                      No internal user accounts found.
                    </td>
                  </tr>
                ) : pagedUsers.map(item => {
                  const isActive = item.is_active !== false;
                  const isProtected = !isOwner && (item.role === 'admin' || item.role === 'owner');
                  const isSelf = user?.id === item.id;
                  const userAvatarFallback = getDicebearAvatarDataUri({
                    id: item.id,
                    name: item.name,
                    email: item.email,
                  });
                  const userAvatar = item.avatar_url ?? item.avatarUrl ?? userAvatarFallback;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-800/30 transition-colors align-middle ${!isActive ? 'opacity-50' : ''}`}>
                      <td className="py-3.5 px-4 text-white font-bold">
                        <div className="flex items-center gap-3">
                          <img
                            src={userAvatar}
                            alt={item.name}
                            className="h-8 w-8 rounded-full border border-gray-700 object-cover shrink-0"
                            onError={(e) => {
                              if (e.currentTarget.src !== userAvatarFallback) {
                                e.currentTarget.src = userAvatarFallback;
                                return;
                              }
                              e.currentTarget.onerror = null;
                            }}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300 hidden md:table-cell">{item.email}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={item.role}
                            disabled={isProtected || updatingRoleId === item.id || !roleOptions.length}
                            onChange={e => handleRoleChange(item.id, item.role, e.target.value as UserRole, item.name)}
                            className="bg-brand-darker border border-gray-800 text-white px-2 py-1 rounded text-xs font-mono focus:outline-none focus:border-brand-orange disabled:opacity-50 cursor-pointer"
                          >
                            {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <RoleBadge role={item.role} />
                          {isProtected && (
                            <span title="Protected Account (Owner level required)" className="text-gray-500">
                              <LockIcon className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <StatusBadge isActive={isActive} />
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 hidden lg:table-cell">
                        {new Date(item.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={isProtected || savingUserId === item.id}
                            onClick={() => handleEditUser(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-brand-orange text-gray-300 hover:text-white text-xs font-bold uppercase disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-brand-orange" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProtected || togglingStatusId === item.id}
                            onClick={() => handleToggleStatus(item.id, isActive, item.name)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase disabled:opacity-40 transition-colors cursor-pointer ${
                              isActive
                                ? 'border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400'
                                : 'border-gray-800 hover:border-emerald-500/40 text-gray-400 hover:text-emerald-400'
                            }`}
                          >
                            {togglingStatusId === item.id
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Updating...</span></>
                              : isActive
                                ? <><Ban className="w-3.5 h-3.5" /><span>Disable</span></>
                                : <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span>Enable</span></>}
                          </button>
                          <button
                            type="button"
                            disabled={isProtected || isSelf || deletingUserId === item.id}
                            onClick={() => handleDeleteUser(item.id, item.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400 text-xs font-bold uppercase disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            {deletingUserId === item.id
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

            <Pager page={usersPage} totalPages={usersTotalPages} totalItems={filteredUsers.length} onPageChange={setUsersPage} />
          </div>
        )}
      </section>

      {/* Create User Modal */}
      {showCreateModal && (
        <ModalShell
          title="Add New User Account"
          description="Create credentials for a staff member, manager, or admin."
          onClose={() => { if (!creatingUser) setShowCreateModal(false); }}
        >
          <form className="space-y-4 font-sans" onSubmit={handleCreateUser}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.name}
                  onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  required
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.email}
                  onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. jane@example.com"
                  type="email"
                  required
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Phone Number
                </label>
                <input
                  value={newUser.phone}
                  onChange={e => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+63 9XX XXX XXXX"
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.password}
                  onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  type="password"
                  minLength={8}
                  required
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Assigned Role <span className="text-red-400">*</span>
                </label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  disabled={!roleOptions.length}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono cursor-pointer"
                >
                  {roleOptions.length > 0
                    ? roleOptions.map(role => <option key={role} value={role}>{role}</option>)
                    : <option value="" disabled>No roles loaded</option>}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/80">
              <button
                type="button"
                onClick={() => { if (!creatingUser) setShowCreateModal(false); }}
                disabled={creatingUser}
                className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingUser || !roleOptions.length}
                className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {creatingUser
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating...</span></>
                  : <><UserPlus className="w-4 h-4" /><span>Create User</span></>}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit User Modal */}
      {editingUserId !== null && (() => {
        const editingUser = users.find(item => item.id === editingUserId);
        const isSavingThis = savingUserId === editingUserId;
        return (
          <ModalShell
            title="Edit User Information"
            description="Update name, email address, and contact number."
            onClose={() => { if (!isSavingThis) handleCancelUserEdit(); }}
          >
            <div className="space-y-4 font-sans">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={userEditDraft.name}
                  onChange={e => setUserEditDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  value={userEditDraft.email}
                  onChange={e => setUserEditDraft(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                  type="email"
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
                  Phone Number
                </label>
                <input
                  value={userEditDraft.phone}
                  onChange={e => setUserEditDraft(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-brand-orange font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={handleCancelUserEdit}
                  disabled={isSavingThis}
                  className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingThis}
                  onClick={() => handleSaveUserEdit(editingUserId, editingUser?.name ?? '')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest hover:bg-orange-600 transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {isSavingThis
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
