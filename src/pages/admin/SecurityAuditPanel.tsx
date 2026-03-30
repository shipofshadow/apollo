import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Loader2, RefreshCw, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
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
  success: 'text-green-400 bg-green-500/10 border-green-500/30',
  failure: 'text-red-400 bg-red-500/10 border-red-500/30',
  blocked: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  warning: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
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
      // Fetch a large buffer (e.g., 500) for local pagination/filtering
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

  // Reset to page 1 when filters change
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

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
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
      a.download = `sys_audit_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      showToast('Syslog export initiated.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to export syslogs.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ── Header ── */}
      <div className="bg-[#121212] border border-gray-800 rounded-lg p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange mb-2">
            // Core System
          </p>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Security Telemetry</h2>
          <p className="text-gray-400 text-xs font-mono mt-2">
            MONITORING: AUTHENTICATION & INGRESS EVENTS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded border border-gray-700 bg-[#151515] text-gray-400 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-30"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded border border-brand-orange/50 bg-[#151515] text-brand-orange hover:bg-brand-orange/10 transition-colors disabled:opacity-30"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Dump CSV
          </button>
        </div>
      </div>

      {/* ── Data Panel ── */}
      <div className="bg-[#121212] border border-gray-800 rounded-lg overflow-hidden flex flex-col">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-800 bg-[#151515] flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Query parameters (IP, User, Agent)..."
              className="w-full bg-[#121212] border border-gray-700 text-white px-3 py-2.5 rounded text-sm font-mono focus:outline-none focus:border-brand-orange transition-colors"
            />
          </div>
          <div className="w-full md:w-48 relative">
            <Filter className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as typeof outcome)}
              className="w-full bg-[#121212] border border-gray-700 text-white pl-9 pr-3 py-2.5 rounded text-xs font-bold uppercase tracking-widest appearance-none focus:outline-none focus:border-brand-orange transition-colors"
            >
              <option value="all">ALL OUTCOMES</option>
              <option value="success">SUCCESS</option>
              <option value="failure">FAILURE</option>
              <option value="blocked">BLOCKED</option>
              <option value="warning">WARNING</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500">
            <ShieldAlert className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-xs font-mono uppercase tracking-widest">Query returned zero records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#181818] text-gray-500 text-[9px] font-bold uppercase tracking-widest border-b border-gray-800">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">SYS_TIME</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">EVENT_ID</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">STATE</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">IDENTITY</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">ORIGIN_IP</th>
                  <th className="px-4 py-3 font-medium w-full">TELEMETRY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#151515] transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[10px] font-mono text-gray-400">
                        {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}Z
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[10px] font-bold text-gray-300">
                        {formatEvent(log.eventType)}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded border ${OUTCOME_BADGE[log.outcome] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-300 font-bold">{log.userName ?? 'UNKNOWN'}</span>
                        <span className="text-[10px] font-mono text-gray-500">{log.email || 'NO_AUTH_ADDR'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] font-mono text-brand-orange/80 bg-brand-orange/5 px-1.5 py-0.5 rounded border border-brand-orange/20">
                        {log.ipAddress || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[300px]">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-gray-400">{log.detail ?? 'NULL'}</p>
                        {log.userAgent && (
                          <p className="text-[9px] font-mono text-gray-600 truncate max-w-md group-hover:text-gray-400 transition-colors" title={log.userAgent}>
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

        {/* Pagination Controls */}
        {!loading && filtered.length > 0 && (
          <div className="p-4 border-t border-gray-800 bg-[#151515] flex items-center justify-between">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              Showing <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-white">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="text-white">{filtered.length}</span> Records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-[#121212] text-gray-400 hover:text-brand-orange hover:border-brand-orange disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-700 transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="px-3 py-1 bg-[#121212] border border-gray-800 rounded text-[10px] font-mono text-gray-300">
                PG {currentPage} / {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-[#121212] text-gray-400 hover:text-brand-orange hover:border-brand-orange disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-700 transition-colors"
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