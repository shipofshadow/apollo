import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Filter, Loader2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminUserApi,
  fetchAdminRolesApi,
  fetchAdminUsersApi,
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

export default function ManageUsersPanel() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageUsers = user?.role === 'admin';

  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);

  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', password: '', role: 'staff' });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingDialog, setConfirmingDialog] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const roleOptions = useMemo<UserRole[]>(() => roles.map(r => r.key).filter(Boolean), [roles]);
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
      // roles are non-critical for this panel
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
      showToast('User account created.', 'success');
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
      title: makeActive ? 'Enable account?' : 'Disable account?',
      message: makeActive
        ? `${name}'s account will be re-enabled and they will be able to log in.`
        : `${name}'s account will be disabled. They will not be able to log in until re-enabled.`,
      confirmLabel: makeActive ? 'Enable Account' : 'Disable Account',
      tone: makeActive ? 'default' : 'danger',
      onConfirm: async () => performToggleStatus(id, makeActive),
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Users' }]} />

      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</p>
            <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wide text-white">Manage Users</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-300">
              Create internal accounts, assign roles, and control access for staff, managers, and admins.
            </p>
          </div>
          {canManageUsers && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add New User
            </button>
          )}
        </div>
      </section>

      {/* Users list */}
      {canManageUsers && (
        <section className="rounded-xl border border-gray-800 bg-brand-dark p-3 md:p-5 space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Internal Users
            </p>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5 flex-wrap">
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search users"
                className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40" />
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden="true" />
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  className="bg-brand-darker border border-gray-700 text-white px-2 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange">
                  <option value="">All Roles</option>
                  {nonClientRoleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { setUsersPage(1); void loadUsers(); }}
                className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white whitespace-nowrap">
                Search
              </button>
            </div>
          </div>

          {nonClientRoleOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {nonClientRoleOptions.map(role => (
                <button key={role} type="button"
                  onClick={() => setUserRoleFilter(prev => prev === role ? '' : role)}
                  className={`transition-opacity ${userRoleFilter && userRoleFilter !== role ? 'opacity-40' : 'opacity-100'}`}>
                  <RoleBadge role={role} />
                </button>
              ))}
            </div>
          )}

          {loadingUsers ? (
            <div className="py-10 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
              <span className="text-xs">Loading users...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800 -mx-3 md:mx-0">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                    <th className="py-2 px-3 md:px-4">Name</th>
                    <th className="py-2 px-3 md:px-4 hidden md:table-cell">Email</th>
                    <th className="py-2 px-3 md:px-4">Role</th>
                    <th className="py-2 px-3 md:px-4 hidden sm:table-cell">Status</th>
                    <th className="py-2 px-3 md:px-4 hidden lg:table-cell">Created</th>
                    <th className="py-2 px-3 md:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-gray-700" />
                          <p className="text-sm text-gray-500">No users found.</p>
                          <p className="text-xs text-gray-600">Try adjusting your search or filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : pagedUsers.map(item => {
                    const isActive = item.is_active !== false;
                    return (
                      <tr key={item.id} className={`border-b border-gray-800/70 ${!isActive ? 'opacity-60' : ''}`}>
                        <td className="py-2.5 px-3 md:px-4 text-white font-medium">{item.name}</td>
                        <td className="py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs">{item.email}</td>
                        <td className="py-2.5 px-3 md:px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <label className="sr-only" htmlFor={`role-select-${item.id}`}>Change role for {item.name}</label>
                            <select id={`role-select-${item.id}`} value={item.role}
                              disabled={updatingRoleId === item.id || !roleOptions.length}
                              onChange={e => handleRoleChange(item.id, item.role, e.target.value as UserRole, item.name)}
                              className="bg-brand-darker border border-gray-700 text-white px-1.5 py-1 rounded-sm text-xs focus:outline-none focus:border-brand-orange disabled:opacity-60">
                              {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <RoleBadge role={item.role} />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 md:px-4 hidden sm:table-cell">
                          <StatusBadge isActive={isActive} />
                        </td>
                        <td className="py-2.5 px-3 md:px-4 text-gray-400 hidden lg:table-cell text-xs">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 md:px-4">
                          <button type="button"
                            disabled={togglingStatusId === item.id}
                            onClick={() => handleToggleStatus(item.id, isActive, item.name)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-xs font-semibold whitespace-nowrap disabled:opacity-60 transition-colors ${
                              isActive
                                ? 'border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200'
                                : 'border-green-900/60 text-green-300 hover:border-green-500 hover:text-green-200'
                            }`}>
                            {togglingStatusId === item.id
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Updating...</span></>
                              : isActive
                                ? <><Ban className="w-3.5 h-3.5" /><span>Disable</span></>
                                : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Enable</span></>}
                          </button>
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
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <ModalShell
          title="Add New User"
          description="Create an internal account for a staff member, manager, or admin."
          onClose={() => { if (!creatingUser) setShowCreateModal(false); }}
        >
          <form
            className="space-y-4"
            onSubmit={e => { handleCreateUser(e); }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.name}
                  onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  required
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.email}
                  onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. jane@example.com"
                  type="email"
                  required
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Phone Number <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  value={newUser.phone}
                  onChange={e => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 555-123-4567"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  value={newUser.password}
                  onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  type="password"
                  minLength={8}
                  required
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Role <span className="text-red-400">*</span>
                </label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  disabled={!roleOptions.length}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                >
                  {roleOptions.length > 0
                    ? roleOptions.map(role => <option key={role} value={role}>{role}</option>)
                    : <option value="" disabled>No roles available</option>}
                </select>
                {!roleOptions.length && (
                  <p className="text-xs text-yellow-400">No roles loaded from API. User creation is disabled while API is offline.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => { if (!creatingUser) setShowCreateModal(false); }}
                disabled={creatingUser}
                className="px-4 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingUser || !roleOptions.length}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {creatingUser
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating...</>
                  : <><UserPlus className="w-3.5 h-3.5" />Create User</>}
              </button>
            </div>
          </form>
        </ModalShell>
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
