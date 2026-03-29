import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { exportSecurityAuditCsvApi, fetchSecurityAuditLogsApi } from '../../services/api';

type AuditLog = {
  id: number;
  userId: number | null;
  userName: string | null;
  email: string;
  ipAddress: string;
  userAgent: string;
  eventType: string;
  outcome: string;
  detail: string | null;
  createdAt: string;
};

const OUTCOME_BADGE: Record<string, string> = {
  success: 'bg-green-500/10 text-green-400 border-green-500/30',
  failure: 'bg-red-500/10 text-red-400 border-red-500/30',
  blocked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  warning: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

function titleCase(text: string): string {
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function SecurityAuditPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<'all' | 'success' | 'failure' | 'blocked' | 'warning'>('all');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchSecurityAuditLogsApi(token, 300);
      setLogs(res.logs as AuditLog[]);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to load security audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(log => {
      if (outcome !== 'all' && log.outcome !== outcome) return false;
      if (q === '') return true;

      const haystack = [
        log.email,
        log.userName ?? '',
        log.ipAddress,
        log.eventType,
        log.outcome,
        log.detail ?? '',
        log.userAgent,
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }, [logs, outcome, query]);

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportSecurityAuditCsvApi(token, 1000);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `auth-security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      showToast('Security audit export started.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to export audit logs.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Security</p>
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mt-1">Authentication Audit</h2>
            <p className="text-gray-400 text-sm mt-2 max-w-2xl">
              Review login behavior, suspicious patterns, and export audit evidence for incident review.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || logs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-brand-orange/50 text-brand-orange hover:bg-brand-orange/10 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="bg-brand-dark border border-gray-800 rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Search</label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Email, IP, event, user agent..."
              className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-brand-orange"
            />
          </div>
          <div className="w-full md:w-56">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Outcome</label>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value as typeof outcome)}
                className="w-full bg-brand-darker border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-brand-orange"
              >
                <option value="all">All outcomes</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="blocked">Blocked</option>
                <option value="warning">Warning</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No matching audit entries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-[10px] font-bold uppercase tracking-widest border-b border-gray-800">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">IP</th>
                  <th className="py-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-gray-800/70 align-top">
                    <td className="py-3 pr-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 pr-3 text-gray-200 font-semibold">
                      {titleCase(log.eventType)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border ${OUTCOME_BADGE[log.outcome] ?? 'bg-gray-700/30 text-gray-300 border-gray-600'}`}>
                        {titleCase(log.outcome)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-300">{log.userName ?? '-'}</td>
                    <td className="py-3 pr-3 text-gray-400">{log.email || '-'}</td>
                    <td className="py-3 pr-3 text-gray-400 font-mono text-xs">{log.ipAddress || '-'}</td>
                    <td className="py-3 pr-3 text-gray-400 max-w-[420px]">
                      <p className="line-clamp-2">{log.detail ?? '-'}</p>
                      {log.userAgent && (
                        <p className="text-[11px] text-gray-600 mt-1 line-clamp-1">UA: {log.userAgent}</p>
                      )}
                    </td>
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
