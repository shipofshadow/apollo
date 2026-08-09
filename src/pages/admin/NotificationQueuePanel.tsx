import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert, Workflow, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchNotificationQueueApi,
  fetchNotificationQueueHealthApi,
  replayFailedNotificationJobsApi,
  replayNotificationJobApi,
  runNotificationQueueWorkerApi,
} from '../../services/api';
import type { NotificationQueueHealth, NotificationQueueJob, NotificationQueueSummary } from '../../types';

function fmtAge(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_OPTIONS = ['', 'queued', 'retry', 'failed', 'processing', 'done'] as const;

export default function NotificationQueuePanel() {
  const { token, hasPermission } = useAuth();

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [replayBusy, setReplayBusy] = useState(false);
  const [cronBusy, setCronBusy] = useState(false);
  const [jobReplayBusyId, setJobReplayBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [cronNotice, setCronNotice] = useState('');

  const [summary, setSummary] = useState<NotificationQueueSummary | null>(null);
  const [health, setHealth] = useState<NotificationQueueHealth | null>(null);
  const [jobs, setJobs] = useState<NotificationQueueJob[]>([]);

  const canManage = hasPermission('settings:manage');

  const failedJobs = useMemo(() => jobs.filter(j => j.status === 'failed'), [jobs]);

  const QUEUE_PAGE_SIZE = 10;
  const [queuePage, setQueuePage] = useState(0);
  const totalQueuePages = Math.max(1, Math.ceil(jobs.length / QUEUE_PAGE_SIZE));
  const pagedJobs = jobs.slice(queuePage * QUEUE_PAGE_SIZE, (queuePage + 1) * QUEUE_PAGE_SIZE);

  const loadData = async () => {
    if (!token || !canManage) return;
    setLoading(true);
    setError('');
    try {
      const [queueRes, healthRes] = await Promise.all([
        fetchNotificationQueueApi(token, {
          status: statusFilter || undefined,
          limit,
        }),
        fetchNotificationQueueHealthApi(token),
      ]);
      setSummary(queueRes.summary);
      setJobs(queueRes.jobs);
      setHealth(healthRes.health);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load queue monitor data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !canManage) return;
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canManage, statusFilter, limit]);

  const replayFailed = async () => {
    if (!token || !canManage) return;
    setReplayBusy(true);
    setError('');
    try {
      await replayFailedNotificationJobsApi(token, 100);
      await loadData();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to replay failed jobs.');
    } finally {
      setReplayBusy(false);
    }
  };

  const replayOne = async (id: number) => {
    if (!token || !canManage) return;
    setJobReplayBusyId(id);
    setError('');
    try {
      await replayNotificationJobApi(token, id);
      await loadData();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to replay job.');
    } finally {
      setJobReplayBusyId(null);
    }
  };

  const runCronNow = async () => {
    if (!token || !canManage) return;
    setCronBusy(true);
    setError('');
    setCronNotice('');
    try {
      const { stats } = await runNotificationQueueWorkerApi(token, limit);
      setCronNotice(`Queue worker finished: processed ${stats.processed}, retried ${stats.retried}, failed ${stats.failed}.`);
      await loadData();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to run queue worker.');
    } finally {
      setCronBusy(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-8 text-center space-y-3 font-sans shadow-2xl">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-display font-black uppercase tracking-tight text-red-200">Access Restricted</h3>
        <p className="text-xs font-mono text-red-300/80 max-w-md mx-auto">
          You do not have permission to access the Notification Queue Monitor.
        </p>
      </div>
    );
  }

  const counts = summary?.counts ?? { queued: 0, retry: 0, processing: 0, failed: 0, done: 0 };

  return (
    <div className="space-y-6 w-full max-w-7xl font-sans pb-20">
      {/* Top Hero Header Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <Workflow className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Background Services</p>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">Notification Queue Monitor</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => { void runCronNow(); }}
              disabled={cronBusy || loading}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {cronBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
              <span>Run Cron Now</span>
            </button>

            <button
              type="button"
              onClick={() => { void replayFailed(); }}
              disabled={replayBusy || cronBusy || loading || failedJobs.length === 0}
              className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
            >
              {replayBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span>Replay Failed ({failedJobs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { void loadData(); }}
              disabled={loading || cronBusy}
              className="flex items-center gap-2 bg-brand-darker border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-orange' : 'text-brand-orange'}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* Warning Banners */}
      {health?.warning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/50 p-4 text-xs font-mono text-amber-200 shadow-xl">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">Worker Health Warning</p>
            <p className="mt-0.5">{health.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-xs font-mono text-red-300 shadow-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {cronNotice && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-4 text-xs font-mono text-emerald-300 shadow-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{cronNotice}</span>
        </div>
      )}

      {/* Queue Stat Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {[
          { label: 'Queued', value: counts.queued, color: 'text-sky-400' },
          { label: 'Retry', value: counts.retry, color: 'text-amber-400' },
          { label: 'Processing', value: counts.processing, color: 'text-brand-orange' },
          { label: 'Failed', value: counts.failed, color: 'text-red-400' },
          { label: 'Done', value: counts.done, color: 'text-emerald-400' },
          { label: 'Total Pending', value: (counts.queued + counts.retry), color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Worker Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Last Processed</p>
          <p className="mt-1 text-base font-bold text-white">{fmtAge(summary?.lastProcessedAt ?? null)}</p>
        </div>
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Oldest Pending</p>
          <p className="mt-1 text-base font-bold text-white">{fmtAge(summary?.oldestPendingAt ?? null)}</p>
        </div>
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Worker Status</p>
          <p className={`mt-1 text-sm font-bold truncate ${health?.warning ? 'text-amber-300' : 'text-emerald-400'}`}>
            {health?.message ?? 'No health data available.'}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-4 shadow-xl flex flex-wrap items-center gap-4 font-mono text-xs">
        <div className="flex items-center gap-2">
          <label className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number]); setQueuePage(0); }}
            className="bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-brand-orange cursor-pointer"
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value === '' ? 'All Statuses' : value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Fetch Limit:</label>
          <select
            value={String(limit)}
            onChange={(e) => { setLimit(Number(e.target.value) || 100); setQueuePage(0); }}
            className="bg-brand-darker border border-gray-800 text-white px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-brand-orange cursor-pointer"
          >
            {[50, 100, 200, 500].map(v => <option key={v} value={v}>{v} records</option>)}
          </select>
        </div>
      </div>

      {/* Queue Jobs Table Container */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-4">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-orange" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Queue Jobs Log</h3>
          </div>
          <span className="text-[10px] font-mono text-gray-500">{jobs.length} Jobs Fetched</span>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-xs font-mono text-gray-400 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
            <span>Loading notification queue records…</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-20 text-xs font-mono text-gray-500 text-center">No queue jobs found for current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800/80 bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Job ID</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Attempts</th>
                  <th className="py-3.5 px-4">Run After</th>
                  <th className="py-3.5 px-4">Last Error Payload</th>
                  <th className="py-3.5 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {pagedJobs.map((job) => {
                  const isFailed = job.status === 'failed';
                  const statusTone = isFailed
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : job.status === 'retry'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : job.status === 'done'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-800 text-gray-300 border-gray-700';

                  return (
                    <tr key={job.id} className="hover:bg-gray-800/30 transition-colors align-top">
                      <td className="px-4 py-3.5 text-white font-bold">#{job.id}</td>
                      <td className="px-4 py-3.5 text-white font-bold whitespace-nowrap">{job.event}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${statusTone}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-300">{job.attempts} / {job.maxAttempts}</td>
                      <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">{fmtAge(job.runAfter)}</td>
                      <td className="px-4 py-3.5 text-gray-400 max-w-xs leading-relaxed">
                        <span className="line-clamp-2">{job.lastError || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isFailed ? (
                          <button
                            type="button"
                            onClick={() => { void replayOne(job.id); }}
                            disabled={jobReplayBusyId === job.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            {jobReplayBusyId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>Replay</span>
                          </button>
                        ) : (
                          <span className="text-gray-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && jobs.length > QUEUE_PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/80 bg-brand-dark/50 font-mono text-xs">
            <p className="text-gray-400">
              Page <span className="text-white font-bold">{queuePage + 1}</span> of <span className="text-white font-bold">{totalQueuePages}</span> &bull; <span className="text-brand-orange font-bold">{jobs.length}</span> Total Jobs
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQueuePage(p => Math.max(0, p - 1))}
                disabled={queuePage === 0}
                className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setQueuePage(p => Math.min(totalQueuePages - 1, p + 1))}
                disabled={queuePage >= totalQueuePages - 1}
                className="p-1.5 rounded-lg border border-gray-800 bg-brand-darker text-gray-400 hover:text-white hover:border-brand-orange disabled:opacity-40 transition-colors cursor-pointer"
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
