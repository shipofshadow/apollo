import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, ExternalLink, Filter, Loader2, Pencil, Save, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminClientsApi,
  updateAdminUserInfoApi,
  updateAdminUserStatusApi,
} from '../../services/api';
import type { ClientAdminSummary } from '../../types';
import {
  TABLE_PAGE_SIZE,
  StatusBadge,
  ConfirmDialog,
  Pager,
} from './_sharedComponents';
import { type ConfirmDialogState } from './_sharedUtils';

type Props = {
  onView: (client: ClientAdminSummary) => void;
};

export default function ManageClientsPanel({ onView }: Props) {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const canManageUsers = user?.role === 'admin';

  const [clients, setClients] = useState<ClientAdminSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientEditDraft, setClientEditDraft] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });
  const [savingClientId, setSavingClientId] = useState<number | null>(null);

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

  return (
    <div className="space-y-6">
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
              placeholder="Search clients"
              className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 rounded-sm text-xs md:text-sm focus:outline-none focus:border-brand-orange flex-1 xs:flex-none min-w-0 xs:min-w-40" />
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <select value={clientStatusFilter} onChange={e => setClientStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
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
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
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
                  <tr><td colSpan={7} className="py-8 text-center text-xs text-gray-500">No clients found.</td></tr>
                ) : pagedClients.map(item => {
                  const isClientActive = item.is_active !== false;
                  const isEditingThis = editingClientId === item.id;
                  const isSavingThis = savingClientId === item.id;
                  const isTogglingThis = togglingStatusId === item.id;

                  return (
                    <tr key={item.id} className={`border-b border-gray-800/70 align-top ${!isClientActive ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 px-3 md:px-4 text-white font-medium">
                        {isEditingThis ? (
                          <input value={clientEditDraft.name}
                            onChange={e => setClientEditDraft(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-28"
                            placeholder="Name" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onView(item)}
                            className="text-left hover:text-brand-orange transition-colors flex items-center gap-1 group"
                          >
                            {item.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300 hidden md:table-cell text-xs">
                        {isEditingThis ? (
                          <input value={clientEditDraft.email} type="email"
                            onChange={e => setClientEditDraft(prev => ({ ...prev, email: e.target.value }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-36"
                            placeholder="Email" />
                        ) : item.email}
                      </td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300 hidden lg:table-cell text-xs">
                        {isEditingThis ? (
                          <input value={clientEditDraft.phone}
                            onChange={e => setClientEditDraft(prev => ({ ...prev, phone: e.target.value }))}
                            className="bg-brand-darker border border-gray-700 text-white px-2 py-1 rounded-sm text-xs w-full min-w-28"
                            placeholder="Phone" />
                        ) : (item.phone || '—')}
                      </td>
                      <td className="py-2.5 px-3 md:px-4 hidden sm:table-cell">
                        <StatusBadge isActive={isClientActive} />
                      </td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-300">{item.bookingCount}</td>
                      <td className="py-2.5 px-3 md:px-4 text-gray-400 hidden xl:table-cell text-xs">
                        {item.lastBookingAt ? new Date(item.lastBookingAt).toLocaleDateString() : '—'}
                      </td>
                      {canManageUsers ? (
                        <td className="py-2.5 px-3 md:px-4">
                          <div className="flex items-center gap-1">
                            {isEditingThis ? (
                              <>
                                <button type="button" disabled={isSavingThis}
                                  onClick={() => handleSaveClientEdit(item.id, item.name)}
                                  className="p-1.5 rounded-sm border border-gray-700 text-gray-200 hover:border-brand-orange hover:text-white disabled:opacity-60"
                                  title="Save">
                                  {isSavingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                                <button type="button" onClick={handleCancelClientEdit}
                                  className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-gray-500"
                                  title="Cancel">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => handleEditClient(item)}
                                className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white"
                                title="Edit client info">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button type="button" onClick={() => onView(item)}
                              className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white"
                              title="View client details">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" disabled={isTogglingThis}
                              onClick={() => handleToggleStatus(item.id, isClientActive, item.name)}
                              className={`p-1.5 rounded-sm border text-xs disabled:opacity-60 transition-colors ${
                                isClientActive
                                  ? 'border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200'
                                  : 'border-green-900/60 text-green-300 hover:border-green-500 hover:text-green-200'
                              }`}
                              title={isClientActive ? 'Disable account' : 'Enable account'}>
                              {isTogglingThis
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : isClientActive
                                  ? <Ban className="w-3.5 h-3.5" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="py-2.5 px-3 md:px-4">
                          <button type="button" onClick={() => onView(item)}
                            className="p-1.5 rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white"
                            title="View client details">
                            <ExternalLink className="w-3.5 h-3.5" />
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
