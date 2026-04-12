import { useState, useEffect } from 'react';
import { WalletCards, RefreshCw, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
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
          fetchSemaphoreMessagesApi(token, { limit: 20 }),
        ]);
        if (!active) return;
        setSemaphoreConfigured(accountRes.configured);
        setSemaphoreSenderName(accountRes.sender_name);
        setSemaphoreAccount(accountRes.account);
        setSemaphoreMessages(messagesRes.messages);
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
        fetchSemaphoreMessagesApi(token, { limit: 20, refresh: true }),
      ]);
      setSemaphoreConfigured(accountRes.configured);
      setSemaphoreSenderName(accountRes.sender_name);
      setSemaphoreAccount(accountRes.account);
      setSemaphoreMessages(messagesRes.messages);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to refresh Semaphore account data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide flex items-center gap-3">
            <WalletCards className="w-6 h-6 text-brand-orange" />
            Semaphore SMS Account
          </h2>
          <p className="mt-1 text-sm text-gray-500">Cached account details and recent sent messages.</p>
        </div>
        <button
          type="button"
          onClick={() => { void refresh(); }}
          disabled={loading || !token}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Not configured warning */}
      {!error && !semaphoreConfigured && !loading && (
        <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Semaphore is not configured. Set <code className="font-mono text-amber-200">SEMAPHORE_API_KEY</code> in the backend environment to load account data.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Account ID',     value: semaphoreAccount?.account_id ?? '—' },
          { label: 'Account Name',   value: semaphoreAccount?.account_name || '—' },
          { label: 'Status',         value: semaphoreAccount?.status || '—' },
          { label: 'Credit Balance', value: semaphoreAccount?.credit_balance ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-sm border border-gray-800 bg-brand-dark px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-white truncate">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Sender name */}
      <div className="rounded-sm border border-gray-800 bg-brand-dark px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Sender Name</p>
        <p className="mt-2 text-sm font-semibold text-white">{semaphoreSenderName || '—'}</p>
      </div>

      {/* Messages table */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-orange" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white">Recent Sent Messages</h3>
        </div>

        {loading ? (
          <div className="px-4 py-16 text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading messages…
          </div>
        ) : semaphoreMessages.length === 0 ? (
          <div className="px-4 py-16 text-sm text-gray-500 text-center">No sent messages found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-darker text-gray-500 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="text-left px-5 py-3">Recipient</th>
                  <th className="text-left px-5 py-3">Message</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Network</th>
                  <th className="text-left px-5 py-3">Sent</th>
                </tr>
              </thead>
              <tbody>
                {semaphoreMessages.map((msg) => (
                  <tr key={msg.message_id} className="border-t border-gray-800 align-top hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">{msg.recipient || '—'}</td>
                    <td className="px-5 py-3 text-white min-w-[320px]">{msg.message || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm ${
                        msg.status === 'Sent'      ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                        msg.status === 'Pending'   ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' :
                        msg.status === 'Failed'    ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                        'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>{msg.status || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{msg.network || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{msg.created_at || '—'}</td>
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
