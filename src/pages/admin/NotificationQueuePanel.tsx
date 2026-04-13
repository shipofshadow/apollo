import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert, Workflow } from 'lucide-react';
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
      <div className="w-full max-w-4xl rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        You do not have permission to access Notification Queue Monitor.
      </div>
    );
  }

  const counts = summary?.counts ?? { queued: 0, retry: 0, processing: 0, failed: 0, done: 0 };

  return (
    <div className="space-y-6 w-full max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide flex items-center gap-3">
            <Workflow className="w-6 h-6 text-brand-orange" />
            Notification Queue Monitor
          </h2>
          <p className="mt-1 text-sm text-gray-500">Track queued/retry/failed jobs and replay dead-letter failures.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { void runCronNow(); }}
            disabled={cronBusy || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-brand-orange/60 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white disabled:opacity-50 transition-colors"
          >
            {cronBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Workflow className="w-3.5 h-3.5" />}
            Run Cron Now
          </button>
          <button
            type="button"
            onClick={() => { void replayFailed(); }}
            disabled={replayBusy || cronBusy || loading || failedJobs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 hover:text-yellow-200 disabled:opacity-50 transition-colors"
          >
            {replayBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Replay Failed
          </button>
          <button
            type="button"
            onClick={() => { void loadData(); }}
            disabled={loading || cronBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {health?.warning && (
        <div className="flex items-start gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Worker Health Warning</p>
            <p>{health.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {cronNotice && (
        <div className="flex items-center gap-2 rounded-sm border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {cronNotice}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ['Queued', counts.queued],
          ['Retry', counts.retry],
          ['Processing', counts.processing],
          ['Failed', counts.failed],
          ['Done', counts.done],
          ['Pending', (counts.queued + counts.retry)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Last Processed</p>
          <p className="mt-1 text-sm text-white">{fmtAge(summary?.lastProcessedAt ?? null)}</p>
        </div>
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Oldest Pending</p>
          <p className="mt-1 text-sm text-white">{fmtAge(summary?.oldestPendingAt ?? null)}</p>
        </div>
        <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Worker Message</p>
          <p className={`mt-1 text-sm ${health?.warning ? 'text-yellow-200' : 'text-green-300'}`}>
            {health?.message ?? 'No health data yet.'}
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-gray-800 bg-brand-dark px-4 py-3 flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-widest text-gray-500 font-bold">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])}
          className="bg-brand-darker border border-gray-700 text-sm text-white px-3 py-2 rounded-sm"
        >
          {STATUS_OPTIONS.map((value) => (
            <option key={value || 'all'} value={value}>
              {value === '' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>

        <label className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-2">Limit</label>
        <select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value) || 100)}
          className="bg-brand-darker border border-gray-700 text-sm text-white px-3 py-2 rounded-sm"
        >
          {[50, 100, 200, 500].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-orange" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white">Queue Jobs</h3>
        </div>

        {loading ? (
          <div className="px-4 py-16 text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading queue jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-16 text-sm text-gray-500 text-center">No jobs found for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-darker text-gray-500 uppercase text-[11px] tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Event</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Attempts</th>
                  <th className="text-left px-4 py-3">Run After</th>
                  <th className="text-left px-4 py-3">Last Error</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const isFailed = job.status === 'failed';
                  const statusTone = isFailed
                    ? 'bg-red-500/15 text-red-300 border-red-500/30'
                    : job.status === 'retry'
                    ? 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30'
                    : job.status === 'done'
                    ? 'bg-green-500/15 text-green-300 border-green-500/30'
                    : 'bg-gray-800 text-gray-300 border-gray-700';

                  return (
                    <tr key={job.id} className="border-t border-gray-800 align-top hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-300">{job.id}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap">{job.event}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest rounded-sm border ${statusTone}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{job.attempts}/{job.maxAttempts}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtAge(job.runAfter)}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[420px]">
                        <span className="line-clamp-2">{job.lastError || '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isFailed ? (
                          <button
                            type="button"
                            onClick={() => { void replayOne(job.id); }}
                            disabled={jobReplayBusyId === job.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-sm border border-yellow-600/40 text-yellow-300 hover:border-yellow-400 hover:text-yellow-200 disabled:opacity-50 transition-colors"
                          >
                            {jobReplayBusyId === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Replay
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
