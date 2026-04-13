import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, ExternalLink, Filter, Loader2, Pencil, Save, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  deleteAdminUserApi,
  fetchAdminClientsApi,
  updateAdminUserInfoApi,
  updateAdminUserStatusApi,
} from '../../services/api';
import type { ClientAdminSummary } from '../../types';
import {
  TABLE_PAGE_SIZE,
  StatusBadge,
  ConfirmDialog,
  ModalShell,
  Breadcrumbs,
  Pager,
} from './_sharedComponents';
import { type ConfirmDialogState } from './_sharedUtils';
import { getDicebearAvatarDataUri } from '../../utils/avatar';

type Props = {
  onView: (client: ClientAdminSummary) => void;
};

export default function ManageClientsPanel({ onView }: Props) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageUsers = user?.role === 'admin' || user?.role === 'owner';

  const [clients, setClients] = useState<ClientAdminSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientEditDraft, setClientEditDraft] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });
  const [savingClientId, setSavingClientId] = useState<number | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<number | null>(null);

  const [clientsPage, setClientsPage] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingDialog, setConfirmingDialog] = useState(false);

  const filteredClients = useMemo(() => {
    if (clientStatusFilter === 'all') return clients;
    const wantActive = clientStatusFilter === 'active';
    return clients.filter(c => (c.is_active !== false) === wantActive);
  }, [clients, clientStatusFilter]);

  const clientsTotalPages = Math.max(1, Math.ceil(filteredClients.length / TABLE_PAGE_SIZE));

  const pagedClients = useMemo(() => {
    const start = (clientsPage - 1) * TABLE_PAGE_SIZE;
    return filteredClients.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredClients, clientsPage]);

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

  useEffect(() => { void loadClients(); }, [token]);
  useEffect(() => { setClientsPage(1); }, [clientStatusFilter]);
  useEffect(() => { setClientsPage(prev => Math.min(prev, clientsTotalPages)); }, [clientsTotalPages]);

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

  const performToggleStatus = async (id: number, makeActive: boolean) => {
    if (!token || !canManageUsers) return;
    setTogglingStatusId(id);
    try {
      const { user: updated } = await updateAdminUserStatusApi(token, id, makeActive);
      setClients(prev => prev.map(item => (item.id === id ? { ...item, is_active: updated.is_active } : item)));
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
        item.id === id ? { ...item, name: updated.name, email: updated.email, phone: updated.phone } : item
      ));
      setEditingClientId(null);
      setClientEditDraft({ name: '', email: '', phone: '' });
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

  const performDeleteClient = async (id: number, name: string) => {
    if (!token || !canManageUsers) return;
    setDeletingClientId(id);
    try {
      await deleteAdminUserApi(token, id);
      setClients(prev => prev.filter(item => item.id !== id));
      if (editingClientId === id) {
        handleCancelClientEdit();
      }
      showToast(`${name} deleted.`, 'success');
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to delete client.', 'error');
    } finally {
      setDeletingClientId(null);
    }
  };

  const handleDeleteClient = (id: number, name: string) => {
    requestConfirmation({
      title: 'Delete client account?',
      message: `${name}'s account and personal data will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete Client',
      tone: 'danger',
      onConfirm: async () => performDeleteClient(id, name),
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Manage Clients' }]} />

      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</p>
            <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wide text-white">Manage Clients</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-300">
              View and manage client accounts. Click a client to see their profile, vehicles, and booking history.
            </p>
          </div>
          <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">Total Clients</p>
            <p className="text-sm font-semibold text-white">{clients.length}</p>
          </div>
        </div>
      </section>

      {/* Clients list */}
      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3 md:p-5 space-y-3 md:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Client Accounts
          </p>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-1.5 flex-wrap">
            <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search clients"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40" />
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden="true" />
              <select value={clientStatusFilter} onChange={e => setClientStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                aria-label="Filter by status"
                className="bg-brand-darker border border-gray-700 text-white px-2 py-2 rounded-sm text-xs focus:outline-none focus:border-brand-orange">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Disabled</option>
              </select>
            </div>
            <button type="button" onClick={() => { setClientsPage(1); void loadClients(); }}
              className="px-3 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-brand-orange hover:text-white whitespace-nowrap">
              Search
            </button>
          </div>
        </div>

        {loadingClients ? (
          <div className="py-10 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
            <span className="text-xs">Loading clients...</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800 -mx-3 md:mx-0">
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 text-[10px] md:text-[11px] uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 px-3 md:px-4">Client</th>
                  <th className="py-2 px-3 md:px-4 hidden md:table-cell">Email</th>
                  <th className="py-2 px-3 md:px-4 hidden lg:table-cell">Phone</th>
                  <th className="py-2 px-3 md:px-4 hidden sm:table-cell">Status</th>
                  <th className="py-2 px-3 md:px-4">Bookings</th>
                  <th className="py-2 px-3 md:px-4 hidden xl:table-cell">Last Booking</th>
                  <th className="py-2 px-3 md:px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-gray-700" />
                        <p className="text-sm text-gray-500">No clients found.</p>
                        <p className="text-xs text-gray-600">Try adjusting your search or filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : pagedClients.map(item => {
                  const isClientActive = item.is_active !== false;
                  const isTogglingThis = togglingStatusId === item.id;
                  const isDeletingThis = deletingClientId === item.id;
                  const clientAvatarFallback = getDicebearAvatarDataUri({
                    id: item.id,
                    name: item.name,
                    email: item.email,
                  });
                  const clientAvatar = item.avatar_url ?? item.avatarUrl ?? clientAvatarFallback;

                  return (
                    <tr key={item.id} className={`border-b border-gray-800/70 align-middle ${!isClientActive ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 px-3 md:px-4 text-white font-medium">
                        <button
                          type="button"
                          onClick={() => onView(item)}
                          className="text-left hover:text-brand-orange transition-colors flex items-center gap-2 group"
                        >
                          <img
                            src={clientAvatar}
                            alt={item.name}
                            className="h-8 w-8 rounded-full border border-gray-700 object-cover shrink-0"
                            onError={(e) => {
                              if (e.currentTarget.src !== clientAvatarFallback) {
                                e.currentTarget.src = clientAvatarFallback;
                                return;
                              }
                              e.currentTarget.onerror = null;
                            }}
                          />
                          <span className="truncate">{item.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      </td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs">{item.email}</td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300 hidden lg:table-cell text-xs">{item.phone || '—'}</td>
                      <td className="py-2.5 px-3 md:px-4 hidden sm:table-cell">
                        <StatusBadge isActive={isClientActive} />
                      </td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300">{item.bookingCount}</td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-400 hidden xl:table-cell text-xs">
                        {item.lastBookingAt ? new Date(item.lastBookingAt).toLocaleDateString() : '—'}
                      </td>
                      {canManageUsers ? (
                        <td className="py-2.5 px-3 md:px-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button type="button"
                              onClick={() => handleEditClient(item)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white text-xs font-semibold whitespace-nowrap transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Details
                            </button>
                            <button type="button" onClick={() => onView(item)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white text-xs font-semibold whitespace-nowrap transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                              View Client 360
                            </button>
                            <button type="button" disabled={isTogglingThis}
                              onClick={() => handleToggleStatus(item.id, isClientActive, item.name)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-xs font-semibold whitespace-nowrap disabled:opacity-60 transition-colors ${
                                isClientActive
                                  ? 'border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200'
                                  : 'border-green-900/60 text-green-300 hover:border-green-500 hover:text-green-200'
                              }`}>
                              {isTogglingThis
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Updating...</span></>
                                : isClientActive
                                  ? <><Ban className="w-3.5 h-3.5" /><span>Disable</span></>
                                  : <><CheckCircle2 className="w-3.5 h-3.5" /><span>Enable</span></>}
                            </button>
                            <button
                              type="button"
                              disabled={isDeletingThis}
                              onClick={() => handleDeleteClient(item.id, item.name)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200 text-xs font-semibold whitespace-nowrap disabled:opacity-60 transition-colors"
                            >
                              {isDeletingThis
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Deleting...</span></>
                                : <><Trash2 className="w-3.5 h-3.5" /><span>Delete</span></>}
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="py-2.5 px-3 md:px-4">
                          <button type="button" onClick={() => onView(item)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white text-xs font-semibold whitespace-nowrap transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Client 360
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pager page={clientsPage} totalPages={clientsTotalPages} totalItems={filteredClients.length} onPageChange={setClientsPage} />
          </div>
        )}
      </section>

      {/* Edit Client Modal */}
      {editingClientId !== null && (() => {
        const editingClient = clients.find(c => c.id === editingClientId);
        const isSavingThis = savingClientId === editingClientId;
        return (
          <ModalShell
            title="Edit Client Details"
            description="Update the client's contact information. Changes will be saved to their account."
            onClose={() => { if (!isSavingThis) handleCancelClientEdit(); }}
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={clientEditDraft.name}
                  onChange={e => setClientEditDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Client name"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  value={clientEditDraft.email}
                  type="email"
                  onChange={e => setClientEditDraft(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Phone Number <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  value={clientEditDraft.phone}
                  onChange={e => setClientEditDraft(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-brand-orange"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleCancelClientEdit}
                  disabled={isSavingThis}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingThis}
                  onClick={() => handleSaveClientEdit(editingClientId, editingClient?.name ?? '')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {isSavingThis
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
