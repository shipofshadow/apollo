import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Loader2, RefreshCw, ShieldAlert, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
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
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-mono font-bold',
  failure: 'text-red-400 bg-red-500/10 border-red-500/30 font-mono font-bold',
  blocked: 'text-amber-400 bg-amber-500/10 border-amber-500/30 font-mono font-bold',
  warning: 'text-sky-400 bg-sky-500/10 border-sky-500/30 font-mono font-bold',
};

function formatEvent(text: string): string {
  return text.toUpperCase().replace(/[_-]+/g, '_');
}

export default function SecurityAuditPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<'all' | 'success' | 'failure' | 'blocked' | 'warning'>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchSecurityAuditLogsApi(token, 500);
      setLogs(res.logs as AuditLog[]);
      setCurrentPage(1);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [query, outcome]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportSecurityAuditCsvApi(token, 1000);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `sys_security_audit_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      showToast('Security audit log export downloaded.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to export syslogs.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-20">
      
      {/* Top Hero Header Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Core Infrastructure</p>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Telemetry Active
                </span>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Security &amp; Ingress Audit Log</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 bg-brand-darker border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-orange' : 'text-brand-orange'}`} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || logs.length === 0}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Dump CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Data Container */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-800/80 bg-brand-dark/50 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter IP address, user identity, event payload, user agent..."
              className="w-full bg-brand-darker border border-gray-800 text-white pl-9 pr-4 py-2.5 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange transition-colors"
            />
          </div>

          <div className="w-full md:w-56 relative">
            <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as typeof outcome)}
              className="w-full bg-brand-darker border border-gray-800 text-white pl-9 pr-8 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider appearance-none focus:outline-none focus:border-brand-orange cursor-pointer"
            >
              <option value="all">All Event Outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="blocked">Blocked</option>
              <option value="warning">Warning</option>
            </select>
          </div>
        </div>

        {/* Telemetry Table Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-xs font-mono text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin text-brand-orange" />
            <span>Fetching security telemetry records…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500 font-mono space-y-2">
            <ShieldAlert className="w-10 h-10 opacity-40 text-gray-600" />
            <p className="text-xs uppercase tracking-widest">No telemetry records match current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-black/40 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800/80">
                  <th className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Event Key</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Outcome</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Identity</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Origin IP</th>
                  <th className="px-5 py-3.5 w-full">Telemetry Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors align-top group">
                    <td className="px-5 py-3.5 whitespace-nowrap text-gray-400">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-white bg-black/40 border border-gray-800 px-2 py-0.5 rounded text-[11px]">
                        {formatEvent(log.eventType)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 text-[9px] uppercase tracking-wider rounded-full border ${OUTCOME_BADGE[log.outcome] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs text-white font-bold">{log.userName ?? 'Anonymous'}</span>
                        <span className="text-[10px] text-gray-500">{log.email || 'No auth email'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/30 font-bold">
                        {log.ipAddress || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 min-w-[320px]">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-gray-200 leading-relaxed">{log.detail ?? 'No additional detail payload'}</p>
                        {log.userAgent && (
                          <p className="text-[10px] text-gray-500 truncate max-w-md group-hover:text-gray-400 transition-colors" title={log.userAgent}>
                            UA: {log.userAgent}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-800/80 bg-brand-dark/50 flex items-center justify-between font-mono text-xs">
            <p className="text-gray-400">
              Showing <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="text-brand-orange font-bold">{filtered.length}</span> Records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="px-3 py-1 bg-brand-darker border border-gray-800 rounded-lg text-xs font-bold text-gray-300">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}