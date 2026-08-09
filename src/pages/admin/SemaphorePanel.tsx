import { useState, useEffect, useMemo } from 'react';
import { WalletCards, RefreshCw, MessageSquare, AlertCircle, Loader2, ChevronLeft, ChevronRight, Hash, User, Activity, CreditCard, Send, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchSemaphoreAccountApi, fetchSemaphoreMessagesApi } from '../../services/api';
import type { SemaphoreAccountDetails, SemaphoreMessage } from '../../types';

export default function SemaphorePanel() {
  const { token, hasPermission } = useAuth();

  const [semaphoreAccount,    setSemaphoreAccount]    = useState<SemaphoreAccountDetails | null>(null);
  const [semaphoreConfigured, setSemaphoreConfigured] = useState(false);
  const [semaphoreSenderName, setSemaphoreSenderName] = useState('');
  const [semaphoreMessages,   setSemaphoreMessages]   = useState<SemaphoreMessage[]>([]);
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState('');
  const [search,              setSearch]              = useState('');
  const [currentPage,         setCurrentPage]         = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (!token || !hasPermission('settings:manage')) {
      setSemaphoreAccount(null);
      setSemaphoreConfigured(false);
      setSemaphoreSenderName('');
      setSemaphoreMessages([]);
      setError('');
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [accountRes, messagesRes] = await Promise.all([
          fetchSemaphoreAccountApi(token),
          fetchSemaphoreMessagesApi(token, {}),
        ]);
        if (!active) return;
        setSemaphoreConfigured(accountRes.configured);
        setSemaphoreSenderName(accountRes.sender_name);
        setSemaphoreAccount(accountRes.account);
        setSemaphoreMessages(messagesRes.messages);
        setCurrentPage(1);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message ?? 'Failed to load Semaphore account data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => { active = false; };
  }, [token, hasPermission]);

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [accountRes, messagesRes] = await Promise.all([
        fetchSemaphoreAccountApi(token, true),
        fetchSemaphoreMessagesApi(token, { refresh: true }),
      ]);
      setSemaphoreConfigured(accountRes.configured);
      setSemaphoreSenderName(accountRes.sender_name);
      setSemaphoreAccount(accountRes.account);
      setSemaphoreMessages(messagesRes.messages);
      setCurrentPage(1);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to refresh Semaphore account data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return semaphoreMessages;
    return semaphoreMessages.filter(
      (m) =>
        (m.recipient ?? '').toLowerCase().includes(q) ||
        (m.message ?? '').toLowerCase().includes(q) ||
        (m.status ?? '').toLowerCase().includes(q) ||
        (m.network ?? '').toLowerCase().includes(q)
    );
  }, [semaphoreMessages, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / itemsPerPage));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMessages.slice(start, start + itemsPerPage);
  }, [filteredMessages, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 w-full max-w-6xl font-sans pb-20">
      {/* Hero Header Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <WalletCards className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">SMS Integration</p>
                {semaphoreConfigured ? (
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full font-bold">
                    Not Configured
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Semaphore Gateway Control</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { void refresh(); }}
            disabled={loading || !token}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Account Data</span>
          </button>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/40 text-red-400 px-5 py-4 rounded-xl text-sm shadow-xl font-mono">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Not Configured Warning */}
      {!error && !semaphoreConfigured && !loading && (
        <div className="flex items-center gap-3 bg-amber-950/50 border border-amber-500/40 text-amber-300 px-5 py-4 rounded-xl text-xs font-mono shadow-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            Semaphore SMS API key is not configured. Please define <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-200 font-bold">SEMAPHORE_API_KEY</code> in the backend environment.
          </span>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl flex items-start gap-4">
          <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Hash className="w-5 h-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Account ID</p>
            <p className="text-white font-mono font-bold text-base truncate mt-0.5">{semaphoreAccount?.account_id ?? '—'}</p>
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl flex items-start gap-4">
          <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Account Name</p>
            <p className="text-white font-mono font-bold text-sm truncate mt-0.5">{semaphoreAccount?.account_name || '—'}</p>
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl flex items-start gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Gateway Status</p>
            <p className="text-emerald-400 font-mono font-bold text-sm truncate mt-0.5 uppercase">{semaphoreAccount?.status || '—'}</p>
          </div>
        </div>

        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl flex items-start gap-4">
          <div className="w-10 h-10 bg-brand-orange/10 border border-brand-orange/20 rounded-lg flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">SMS Credit Balance</p>
            <p className="text-white font-mono font-black text-lg truncate mt-0.5">{semaphoreAccount?.credit_balance ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Sender Name Banner */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-darker border border-gray-800 rounded-lg text-brand-orange">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">Registered Sender Name (Sender ID)</p>
            <p className="text-white font-mono font-bold text-base mt-0.5">{semaphoreSenderName || 'Default System Sender'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-darker border border-gray-800 rounded-lg text-xs font-mono text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verified SMS Channel
        </div>
      </div>

      {/* Recent Sent Messages Table */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-4">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-orange" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Recent Sent Messages Log</h3>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search recipient, text, network..."
                className="w-full rounded-lg border border-gray-800 bg-brand-darker py-2 pl-9 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-brand-orange focus:outline-none font-mono"
              />
            </div>

            {filteredMessages.length > 0 && !loading && (
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400 shrink-0">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-xs font-mono text-gray-400 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
            <span>Fetching Semaphore message history…</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="px-6 py-20 text-xs font-mono text-gray-500 text-center">No sent message logs found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800/80 bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Recipient Phone</th>
                  <th className="py-3 px-5">Message Payload</th>
                  <th className="py-3 px-5">Delivery Status</th>
                  <th className="py-3 px-5">Network</th>
                  <th className="py-3 px-5">Sent Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {pageItems.map((msg) => (
                  <tr key={msg.message_id} className="hover:bg-gray-800/30 transition-colors align-top">
                    <td className="px-5 py-3.5 text-white font-bold whitespace-nowrap">{msg.recipient || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-200 leading-relaxed max-w-md">{msg.message || '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full ${
                        msg.status === 'Sent'      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        msg.status === 'Pending'   ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        msg.status === 'Failed'    ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                        'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>{msg.status || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-[9px] uppercase font-bold bg-black/40 border border-gray-800 rounded">
                        {msg.network || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">{msg.created_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
