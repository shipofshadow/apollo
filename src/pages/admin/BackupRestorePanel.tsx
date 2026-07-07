import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Database, Download, HardDrive, Loader2, RefreshCw, Save } from 'lucide-react';
import {
  createAdminBackupApi,
  fetchAdminBackupsApi,
  getAdminBackupDownloadUrl,
  restoreAdminBackupApi,
  type AdminBackupEntry,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function fmtDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function fmtBytes(value?: number | null): string {
  if (!value || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupRestorePanel() {
  const { token } = useAuth();
  const [storage, setStorage] = useState<'server' | 's3'>('server');
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [restoreDatabase, setRestoreDatabase] = useState(true);
  const [restoreFiles, setRestoreFiles] = useState(true);
  const [rows, setRows] = useState<AdminBackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminBackupsApi(token);
      setRows(res.backups ?? []);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load backups.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createBackup = async () => {
    if (!token) return;
    if (!includeDatabase && !includeFiles) {
      setError('Select at least one source to backup.');
      return;
    }

    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      await createAdminBackupApi(token, { storage, includeDatabase, includeFiles });
      setMessage('Backup created successfully.');
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to create backup.');
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (id: string) => {
    if (!token) return;
    if (!restoreDatabase && !restoreFiles) {
      setError('Select at least one target to restore.');
      return;
    }

    const ok = window.confirm('Restore will overwrite current data/files. Continue?');
    if (!ok) return;

    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await restoreAdminBackupApi(token, id, { restoreDatabase, restoreFiles });
      setMessage(`Backup ${id} restored.`);
    } catch (err) {
      setError((err as Error)?.message ?? 'Restore failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-display text-white uppercase tracking-widest">Owner Backup & Restore</h2>
        <p className="text-sm text-gray-400 mt-1">Create full backups (database and uploaded files) and restore them when needed.</p>
      </header>

      <div className="bg-amber-900/20 border border-amber-700/40 text-amber-300 px-4 py-3 rounded-sm text-sm flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Restore is destructive: it replaces current database records and/or uploaded files.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Create backup</h3>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-widest text-gray-400">Where should we save it?</span>
            <select
              value={storage}
              onChange={(e) => setStorage(e.target.value as 'server' | 's3')}
              className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 rounded-sm"
            >
              <option value="server">Server storage</option>
              <option value="s3">S3 / R2 object storage</option>
            </select>
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={includeDatabase} onChange={(e) => setIncludeDatabase(e.target.checked)} />
              <Database className="w-4 h-4" /> Database
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} />
              <HardDrive className="w-4 h-4" /> Uploaded files
            </label>
          </div>

          <button
            type="button"
            onClick={createBackup}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-black font-bold uppercase text-xs tracking-wider rounded-sm disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create backup
          </button>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Restore options</h3>
          <p className="text-xs text-gray-500">These options apply when you click Restore on any row below.</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={restoreDatabase} onChange={(e) => setRestoreDatabase(e.target.checked)} />
              <Database className="w-4 h-4" /> Restore database
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={restoreFiles} onChange={(e) => setRestoreFiles(e.target.checked)} />
              <HardDrive className="w-4 h-4" /> Restore uploaded files
            </label>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 hover:text-white rounded-sm text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCw className="w-4 h-4" /> Refresh list
          </button>
        </div>
      </div>

      {error && <div className="text-sm bg-red-900/30 border border-red-600/40 rounded-sm p-3 text-red-300">{error}</div>}
      {message && <div className="text-sm bg-green-900/30 border border-green-600/40 rounded-sm p-3 text-green-300">{message}</div>}

      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Backups</h3>
          {loading && <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-darker text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-left px-4 py-2">Storage</th>
                <th className="text-left px-4 py-2">Contents</th>
                <th className="text-left px-4 py-2">Size</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-800">
                  <td className="px-4 py-2 text-gray-200">
                    <div>{fmtDate(row.createdAt)}</div>
                    <div className="text-xs text-gray-500">by {row.createdBy || '—'}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-300 uppercase">{row.storage}</td>
                  <td className="px-4 py-2 text-gray-300">
                    {row.includeDatabase ? 'DB' : ''}{row.includeDatabase && row.includeFiles ? ' + ' : ''}{row.includeFiles ? 'Files' : ''}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{fmtBytes(row.sizeBytes)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={getAdminBackupDownloadUrl(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-700 text-gray-300 hover:text-white rounded-sm text-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                      <button
                        type="button"
                        onClick={() => void restoreBackup(row.id)}
                        disabled={busyId === row.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-900/40 border border-red-700/40 text-red-200 rounded-sm text-xs disabled:opacity-60"
                      >
                        {busyId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Restore
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No backups yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
