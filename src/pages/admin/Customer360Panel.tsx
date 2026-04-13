import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, RefreshCw, Search, CarFront, CalendarDays, ShoppingBag, MessageSquare, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchAdminClientsApi, fetchAdminCustomer360Api } from '../../services/api';
import type { ClientAdminSummary, Customer360Data } from '../../types';
import { Breadcrumbs } from './_sharedComponents';

export default function Customer360Panel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [clients, setClients] = useState<ClientAdminSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Customer360Data | null>(null);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [clients, search]);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const loadClients = async () => {
    if (!token) return;
    setLoadingClients(true);
    try {
      const res = await fetchAdminClientsApi(token, {});
      setClients(res.clients ?? []);
      if (!selectedClientId && res.clients?.length) {
        setSelectedClientId(res.clients[0].id);
      }
    } catch (e) {
      showToast((e as Error).message || 'Failed to load clients.', 'error');
    } finally {
      setLoadingClients(false);
    }
  };

  const loadCustomer360 = async (clientId: number) => {
    if (!token || !clientId) return;
    setLoadingCustomer(true);
    try {
      const res = await fetchAdminCustomer360Api(token, clientId);
      setData(res.customer360 ?? null);
    } catch (e) {
      showToast((e as Error).message || 'Failed to load customer 360.', 'error');
    } finally {
      setLoadingCustomer(false);
    }
  };

  useEffect(() => { void loadClients(); }, [token]);
  useEffect(() => {
    if (selectedClientId) {
      void loadCustomer360(selectedClientId);
    }
  }, [selectedClientId, token]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Customers 360' }]} />

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">CRM</p>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wide text-white">Customer 360</h2>
            <p className="text-sm text-gray-300 mt-1">Single view of profile, vehicles, bookings, orders, spend, reviews, and communication history.</p>
          </div>
          <button
            type="button"
            onClick={() => { if (selectedClientId) void loadCustomer360(selectedClientId); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-700 rounded-sm text-gray-300 hover:border-brand-orange hover:text-white"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-4 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers"
              className="w-full bg-brand-darker border border-gray-700 pl-9 pr-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {loadingClients ? (
              <div className="py-8 flex items-center justify-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading customers...</div>
            ) : filteredClients.length === 0 ? (
              <p className="text-sm text-gray-500">No customers found.</p>
            ) : filteredClients.map(client => {
              const active = selectedClientId === client.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left rounded-sm border px-3 py-2 transition-colors ${active ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-800 bg-brand-darker/50 hover:border-gray-600'}`}
                >
                  <p className="text-sm font-semibold text-white truncate">{client.name}</p>
                  <p className="text-xs text-gray-400 truncate">{client.email}</p>
                  <p className="text-[11px] text-gray-500 mt-1">Bookings: {client.bookingCount}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="xl:col-span-8 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-4">
          {loadingCustomer ? (
            <div className="py-14 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading customer 360...</div>
          ) : !data ? (
            <div className="py-14 text-center text-gray-500">Select a customer to view details.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-sm border border-gray-800 bg-brand-darker/60 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-gray-500">Profile</p>
                  <p className="text-white font-semibold mt-1">{data.profile.name}</p>
                  <p className="text-xs text-gray-400">{data.profile.email}</p>
                  <p className="text-xs text-gray-400">{data.profile.phone || 'No phone'}</p>
                  <p className="text-xs text-gray-500 mt-1">Joined: {new Date(data.profile.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-sm border border-gray-800 bg-brand-darker/60 p-3 grid grid-cols-2 gap-2">
                  <Metric label="Lifetime Spend" value={`PHP ${data.spend.lifetimeSpend.toFixed(2)}`} />
                  <Metric label="Spend 90D" value={`PHP ${data.spend.spend90d.toFixed(2)}`} />
                  <Metric label="Orders" value={String(data.spend.totalOrders)} />
                  <Metric label="Bookings" value={String(data.spend.totalBookings)} />
                </div>
              </div>

              <SectionCard title="Vehicles" icon={<CarFront className="w-4 h-4" />}>
                {data.vehicles.length === 0 ? <EmptyLine text="No vehicles yet." /> : data.vehicles.slice(0, 5).map(v => (
                  <div key={v.id} className="text-sm text-gray-300">{v.year} {v.make} {v.model}</div>
                ))}
              </SectionCard>

              <SectionCard title="Bookings" icon={<CalendarDays className="w-4 h-4" />}>
                {data.bookings.length === 0 ? <EmptyLine text="No bookings yet." /> : data.bookings.slice(0, 5).map(b => (
                  <div key={b.id} className="text-sm text-gray-300">{b.serviceName} • {b.appointmentDate} {b.appointmentTime} • {b.status}</div>
                ))}
              </SectionCard>

              <SectionCard title="Orders" icon={<ShoppingBag className="w-4 h-4" />}>
                {data.orders.length === 0 ? <EmptyLine text="No orders yet." /> : data.orders.slice(0, 5).map(o => (
                  <div key={o.id} className="text-sm text-gray-300">{o.orderNumber} • {o.status} • PHP {o.totalAmount.toFixed(2)}</div>
                ))}
              </SectionCard>

              <SectionCard title="Reviews" icon={<Star className="w-4 h-4" />}>
                {data.reviews.length === 0 ? <EmptyLine text="No reviews yet." /> : data.reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="text-sm text-gray-300">{r.serviceName} • {r.rating}/5 {r.review ? `• ${r.review}` : ''}</div>
                ))}
              </SectionCard>

              <SectionCard title="Communication History" icon={<MessageSquare className="w-4 h-4" />}>
                {data.communications.length === 0 ? <EmptyLine text="No communication history yet." /> : data.communications.slice(0, 8).map((c, idx) => (
                  <div key={`${c.createdAt}-${idx}`} className="text-sm text-gray-300">
                    {c.source.toUpperCase()} • {c.title || c.event} • {new Date(c.createdAt).toLocaleString()}
                  </div>
                ))}
              </SectionCard>
            </>
          )}
        </section>
      </div>

      {selectedClient && !data && !loadingCustomer ? (
        <div className="text-sm text-gray-500">Selected: {selectedClient.name}</div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-gray-800 bg-brand-darker/60 p-3 space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-gray-500 inline-flex items-center gap-1.5">{icon}{title}</p>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm text-gray-500">{text}</p>;
}
