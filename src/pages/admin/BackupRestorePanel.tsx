import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database, Cloud, Download, Upload, Trash2, RefreshCw,
  CheckCircle2, ShieldAlert, Archive,
  Loader2, Sparkles, X,
  AlertCircle, FileArchive
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { BackupSnapshot, BackupSystemStats, BackupInspectResult, BackupRestoreResult } from '../../types';
import {
  getBackupsApi,
  createBackupApi,
  deleteBackupApi,
  inspectBackupApi,
  restoreBackupApi,
  downloadBackupApi,
} from '../../services/api';

export default function BackupRestorePanel() {
  const { token } = useAuth();

  // Diagnostics & Snapshots State
  const [stats, setStats] = useState<BackupSystemStats | null>(null);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Backup Creation State
  const [backupScope, setBackupScope] = useState<'full' | 'db' | 'media'>('full');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [lastCreatedFile, setLastCreatedFile] = useState<string | null>(null);

  // Restore State
  const [restoreMethod, setRestoreMethod] = useState<'upload' | 'snapshot'>('upload');
  const [selectedSnapshotFilename, setSelectedSnapshotFilename] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspection, setInspection] = useState<BackupInspectResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore Execution Options
  const [restoreDb, setRestoreDb] = useState(true);
  const [restoreMedia, setRestoreMedia] = useState(true);
  const [restoreSettings, setRestoreSettings] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null);

  // Deletion State
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [deleteConfirmFilename, setDeleteConfirmFilename] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load Stats & Snapshots
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await getBackupsApi(token);
      if (data.success) {
        setSnapshots(data.snapshots || []);
        setStats(data.stats || null);
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load backup diagnostics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Create Backup
  // ---------------------------------------------------------------------------

  const handleCreateBackup = async () => {
    if (!token || creatingBackup) return;
    setCreatingBackup(true);
    setError(null);
    setSuccessMsg(null);
    setLastCreatedFile(null);

    try {
      const data = await createBackupApi(token, backupScope);
      if (!data.success) throw new Error('Failed to create backup.');
      setLastCreatedFile(data.filename);
      setSuccessMsg(`Backup archive created successfully: ${data.filename} (${data.sizeFormatted})`);
      await loadData(true);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Download Snapshot
  // ---------------------------------------------------------------------------

  const handleDownload = async (filename: string) => {
    if (!token) return;
    try {
      const blob = await downloadBackupApi(token, filename);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to download snapshot.');
    }
  };

  // ---------------------------------------------------------------------------
  // Delete Snapshot
  // ---------------------------------------------------------------------------

  const handleDeleteSnapshot = async (filename: string) => {
    if (!token || deletingFilename) return;
    setDeletingFilename(filename);
    setError(null);

    try {
      const data = await deleteBackupApi(token, filename);
      if (!data.success) throw new Error(data.message || 'Failed to delete snapshot.');
      setDeleteConfirmFilename(null);
      setSuccessMsg(`Snapshot "${filename}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData(true);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to delete snapshot.');
    } finally {
      setDeletingFilename(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Inspect Backup
  // ---------------------------------------------------------------------------

  const handleInspect = async () => {
    if (!token || inspecting) return;
    setInspecting(true);
    setError(null);
    setInspection(null);
    setRestoreResult(null);

    try {
      const source = restoreMethod === 'upload'
        ? (uploadedFile ?? (() => { throw new Error('Please select a backup .zip or .sql file to upload.'); })())
        : (selectedSnapshotFilename || (() => { throw new Error('Please choose a server snapshot to inspect.'); })());

      const data = await inspectBackupApi(token, source);
      setInspection(data.inspection);
      setRestoreDb(data.inspection.hasDatabase);
      setRestoreMedia(data.inspection.hasMedia);
      setRestoreSettings(data.inspection.hasSettings);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to inspect backup.');
    } finally {
      setInspecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Execute Restore
  // ---------------------------------------------------------------------------

  const handleExecuteRestore = async () => {
    if (!token || restoring || !inspection) return;
    setRestoring(true);
    setError(null);
    setRestoreResult(null);

    try {
      const payload: Parameters<typeof restoreBackupApi>[1] = {
        restoreDatabase: restoreDb,
        restoreMedia: restoreMedia,
        restoreSettings: restoreSettings,
      };

      if (inspection.tempToken) {
        payload.tempToken = inspection.tempToken;
      } else {
        payload.snapshotFilename = selectedSnapshotFilename || inspection.filename;
      }

      const data = await restoreBackupApi(token, payload);
      if (!data.success) throw new Error(data.message || 'Failed to execute system restore.');

      setRestoreResult(data);
      setShowConfirmModal(false);
      setConfirmInput('');
      setInspection(null);
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setSuccessMsg('System restore completed successfully!');
      await loadData(true);
    } catch (e: unknown) {
      setError((e as Error).message || 'System restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-brand-orange/15 border border-brand-orange/30 text-brand-orange">
              <Database className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wider text-white">
              Backup &amp; Disaster Recovery
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Generate full MySQL database dumps, Cloudflare R2 object storage archives, and restore system state.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="px-3.5 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 border border-gray-700 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-orange' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* ── Alert Messages ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="font-bold text-red-200">Error: </strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-300 text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="font-bold text-emerald-200">Success: </strong>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── System Health & Storage Overview Cards ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Diagnostic Card */}
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              <Database className="w-4 h-4 text-brand-orange" />
              <span>Database Storage</span>
            </div>
            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
              stats?.database.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {stats?.database.connected ? '● MySQL Connected' : '○ Disconnected'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/60 font-mono text-xs">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Database Name</p>
              <p className="font-bold text-white truncate">{stats?.database.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Database Host</p>
              <p className="font-bold text-gray-300 truncate">{stats?.database.host || 'localhost'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total Tables</p>
              <p className="font-bold text-brand-orange">{stats?.database.tableCount ?? '—'} Tables</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Estimated Size</p>
              <p className="font-bold text-gray-200">
                {stats?.database.sizeBytes ? BackupRestorePanel.formatBytes(stats.database.sizeBytes) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Media / Object Storage Diagnostic Card */}
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              <Cloud className="w-4 h-4 text-blue-400" />
              <span>Media &amp; Uploads</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/30 text-blue-400">
              {stats?.storage.disk === 's3' ? 'Cloudflare R2' : 'Local Disk'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/60 font-mono text-xs">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Storage Driver</p>
              <p className="font-bold text-white uppercase">{stats?.storage.disk || 'local'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">R2 Status</p>
              <p className={`font-bold ${stats?.storage.r2Configured ? 'text-emerald-400' : 'text-gray-400'}`}>
                {stats?.storage.r2Configured ? 'Configured' : 'Local Only'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">R2 Bucket</p>
              <p className="font-bold text-gray-300 truncate">{stats?.storage.r2Bucket || 'None'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Local Uploads</p>
              <p className="font-bold text-gray-200">{stats?.storage.localUploadsCount ?? 0} files</p>
            </div>
          </div>
        </div>

        {/* Server Snapshots Diagnostic Card */}
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              <Archive className="w-4 h-4 text-emerald-400" />
              <span>Server Snapshots</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              {snapshots.length} Available
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800/60 font-mono text-xs">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total Snapshots</p>
              <p className="font-bold text-white">{snapshots.length} Archives</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Storage Used</p>
              <p className="font-bold text-emerald-400">
                {stats?.backups.totalBackupBytes ? BackupRestorePanel.formatBytes(stats.backups.totalBackupBytes) : '0 B'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-gray-500 uppercase">Storage Directory</p>
              <p className="text-[11px] text-gray-400 truncate font-mono">backend/storage/backups/</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Actions Grid: Create Backup & Restore ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── 1. Create Backup Card ────────────────────────────────────────── */}
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Download className="w-4 h-4" /> Create System Backup
              </h3>
              <span className="text-[10px] font-mono text-gray-500">ZIP / SQL Archive</span>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-gray-400 font-mono">
                Select the backup scope. Full system backup captures all relational MySQL tables, structured JSON records, site configuration, and Cloudflare R2 uploaded media.
              </p>

              {/* Scope Selection Radios */}
              <div className="space-y-3">
                {/* Full Backup */}
                <label className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                  backupScope === 'full'
                    ? 'bg-brand-orange/10 border-brand-orange/40 shadow-lg shadow-brand-orange/5'
                    : 'bg-brand-darker border-gray-800 hover:border-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="backup_scope"
                    value="full"
                    checked={backupScope === 'full'}
                    onChange={() => setBackupScope('full')}
                    className="mt-1 text-brand-orange focus:ring-brand-orange accent-brand-orange cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">🌟 Full System Backup</span>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.2 rounded bg-brand-orange/20 text-brand-orange border border-brand-orange/30">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                      Complete MySQL SQL dump, JSON tables, Site Settings, plus all Cloudflare R2 / local uploaded media files in a single portable .zip archive.
                    </p>
                  </div>
                </label>

                {/* Database Only */}
                <label className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                  backupScope === 'db'
                    ? 'bg-brand-orange/10 border-brand-orange/40 shadow-lg shadow-brand-orange/5'
                    : 'bg-brand-darker border-gray-800 hover:border-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="backup_scope"
                    value="db"
                    checked={backupScope === 'db'}
                    onChange={() => setBackupScope('db')}
                    className="mt-1 text-brand-orange focus:ring-brand-orange accent-brand-orange cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">🗄️ Database Only</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                      All MySQL tables, schemas, user accounts, customer inquiries, bookings, orders, checklists, and site settings. Excludes media files.
                    </p>
                  </div>
                </label>

                {/* Media Only */}
                <label className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                  backupScope === 'media'
                    ? 'bg-brand-orange/10 border-brand-orange/40 shadow-lg shadow-brand-orange/5'
                    : 'bg-brand-darker border-gray-800 hover:border-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="backup_scope"
                    value="media"
                    checked={backupScope === 'media'}
                    onChange={() => setBackupScope('media')}
                    className="mt-1 text-brand-orange focus:ring-brand-orange accent-brand-orange cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">🖼️ Uploaded Media &amp; R2 Objects Only</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                      Archives all client vehicle photos, before/after showcase images, product photos, and inspection checklists from Cloudflare R2 / local disk.
                    </p>
                  </div>
                </label>
              </div>

              {lastCreatedFile && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-300 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{lastCreatedFile}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(lastCreatedFile)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-brand-dark/80 border-t border-gray-800/80 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
              Encrypted &amp; Protected Storage
            </span>

            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="px-5 py-2.5 bg-brand-orange hover:bg-orange-600 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-brand-orange/20"
            >
              {creatingBackup ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Packaging Backup...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate Snapshot</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── 2. Restore System Card ────────────────────────────────────────── */}
        <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Restore System State
              </h3>
              <span className="text-[10px] font-mono text-gray-500">Inspection &amp; Rollback</span>
            </div>

            <div className="p-6 space-y-5">
              {/* Method Switcher */}
              <div className="flex rounded-lg bg-brand-darker p-1 border border-gray-800 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => { setRestoreMethod('upload'); setInspection(null); }}
                  className={`flex-1 py-1.5 rounded-md font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    restoreMethod === 'upload'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Upload Backup File (.zip / .sql)
                </button>
                <button
                  type="button"
                  onClick={() => { setRestoreMethod('snapshot'); setInspection(null); }}
                  className={`flex-1 py-1.5 rounded-md font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    restoreMethod === 'snapshot'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  From Server Snapshot
                </button>
              </div>

              {/* Upload Dropzone */}
              {restoreMethod === 'upload' ? (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-800 hover:border-emerald-500/50 bg-brand-darker/60 hover:bg-brand-darker rounded-xl p-6 text-center cursor-pointer transition-all space-y-2"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".zip,.sql"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setUploadedFile(file);
                        setInspection(null);
                      }}
                      className="hidden"
                    />
                    <FileArchive className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div className="text-xs font-mono font-bold text-gray-200">
                      {uploadedFile ? uploadedFile.name : 'Click to select backup file'}
                    </div>
                    <p className="text-[11px] text-gray-500 font-mono">
                      Accepts Apollo .zip archives or standard MySQL .sql dumps (Up to 250MB)
                    </p>
                  </div>
                </div>
              ) : (
                /* Snapshot Selector */
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
                    Select Server Snapshot
                  </label>
                  <select
                    value={selectedSnapshotFilename}
                    onChange={e => {
                      setSelectedSnapshotFilename(e.target.value);
                      setInspection(null);
                    }}
                    className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-xs cursor-pointer"
                  >
                    <option value="">-- Choose a backup snapshot --</option>
                    {snapshots.map(snap => (
                      <option key={snap.filename} value={snap.filename}>
                        {snap.filename} ({snap.sizeFormatted} • {snap.createdAt})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Inspection Preview Box */}
              {inspection && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                    <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Inspection Summary
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase">{inspection.createdAt}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-brand-darker/80 p-2 rounded border border-gray-800 text-center">
                      <div className="text-gray-500 text-[9px] uppercase">Format</div>
                      <div className="font-bold text-white uppercase">{inspection.type}</div>
                    </div>
                    <div className="bg-brand-darker/80 p-2 rounded border border-gray-800 text-center">
                      <div className="text-gray-500 text-[9px] uppercase">File Size</div>
                      <div className="font-bold text-emerald-400">{inspection.sizeFormatted}</div>
                    </div>
                    <div className="bg-brand-darker/80 p-2 rounded border border-gray-800 text-center">
                      <div className="text-gray-500 text-[9px] uppercase">DB Tables</div>
                      <div className="font-bold text-brand-orange">{inspection.tableCount} Tables</div>
                    </div>
                    <div className="bg-brand-darker/80 p-2 rounded border border-gray-800 text-center">
                      <div className="text-gray-500 text-[9px] uppercase">Media Files</div>
                      <div className="font-bold text-blue-400">{inspection.mediaCount} Files</div>
                    </div>
                  </div>

                  {/* Selective Checkboxes */}
                  <div className="pt-2 space-y-2 border-t border-emerald-500/20">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Select Components to Restore:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2 p-2 rounded bg-brand-darker border border-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!inspection.hasDatabase}
                          checked={restoreDb}
                          onChange={e => setRestoreDb(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-500 accent-emerald-500 cursor-pointer"
                        />
                        <span className={`text-[11px] ${!inspection.hasDatabase ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                          Database Data
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-brand-darker border border-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!inspection.hasMedia}
                          checked={restoreMedia}
                          onChange={e => setRestoreMedia(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-500 accent-emerald-500 cursor-pointer"
                        />
                        <span className={`text-[11px] ${!inspection.hasMedia ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                          Media (R2 / Disk)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-brand-darker border border-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!inspection.hasSettings}
                          checked={restoreSettings}
                          onChange={e => setRestoreSettings(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-500 accent-emerald-500 cursor-pointer"
                        />
                        <span className={`text-[11px] ${!inspection.hasSettings ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                          Site Settings
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Restore Result Card */}
              {restoreResult && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase">
                    <CheckCircle2 className="w-4 h-4" /> System Restore Completed
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-brand-darker p-2 rounded">
                      <div className="text-gray-500">Tables Restored</div>
                      <div className="font-bold text-white">{restoreResult.tablesRestored}</div>
                    </div>
                    <div className="bg-brand-darker p-2 rounded">
                      <div className="text-gray-500">Media Uploaded</div>
                      <div className="font-bold text-white">{restoreResult.mediaRestoredCount}</div>
                    </div>
                    <div className="bg-brand-darker p-2 rounded">
                      <div className="text-gray-500">Duration</div>
                      <div className="font-bold text-emerald-400">{restoreResult.durationSeconds}s</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-brand-dark/80 border-t border-gray-800/80 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] font-mono text-gray-500">
              {inspection ? 'Ready to apply rollback' : 'Inspection required before restore'}
            </span>

            <div className="flex items-center gap-2">
              {!inspection ? (
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={inspecting || (restoreMethod === 'upload' ? !uploadedFile : !selectedSnapshotFilename)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-gray-700"
                >
                  {inspecting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
                  <span>{inspecting ? 'Inspecting...' : 'Inspect Backup'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={restoring || (!restoreDb && !restoreMedia && !restoreSettings)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Execute System Restore</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Server Snapshots History Table ───────────────────────────────────── */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-0">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-brand-orange" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              Server Snapshots Archive ({snapshots.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono text-gray-500">Stored on server</span>
        </div>

        {snapshots.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-mono text-xs space-y-2">
            <FileArchive className="w-8 h-8 text-gray-600 mx-auto" />
            <p>No backup snapshots found on the server.</p>
            <p className="text-[11px] text-gray-600">Click &ldquo;Generate Snapshot&rdquo; above to create your first system backup.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-brand-darker text-[10px] uppercase font-bold text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3.5">Filename</th>
                  <th className="px-4 py-3.5">Scope</th>
                  <th className="px-4 py-3.5">Size</th>
                  <th className="px-4 py-3.5">Date Created</th>
                  <th className="px-4 py-3.5">Contents</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {snapshots.map(snap => (
                  <tr key={snap.filename} className="hover:bg-gray-850/50 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-white flex items-center gap-2.5">
                      <FileArchive className="w-4 h-4 text-brand-orange shrink-0" />
                      <span className="truncate max-w-xs">{snap.filename}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        snap.scope === 'full'
                          ? 'bg-brand-orange/15 border-brand-orange/30 text-brand-orange'
                          : snap.scope === 'db'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {snap.scope}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-300">{snap.sizeFormatted}</td>
                    <td className="px-4 py-3.5 text-gray-400">{snap.createdAt}</td>
                    <td className="px-4 py-3.5 text-[11px] text-gray-400">
                      {snap.tableCount > 0 && <span className="mr-2 text-gray-300">{snap.tableCount} Tables</span>}
                      {snap.mediaCount > 0 && <span className="text-gray-300">{snap.mediaCount} Media</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Download */}
                        <button
                          type="button"
                          onClick={() => handleDownload(snap.filename)}
                          title="Download archive to PC"
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Inspect & Restore */}
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreMethod('snapshot');
                            setSelectedSnapshotFilename(snap.filename);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
                          title="Inspect and restore from this snapshot"
                          className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 hover:text-emerald-300 rounded border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        {deleteConfirmFilename === snap.filename ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap.filename)}
                              disabled={deletingFilename === snap.filename}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            >
                              {deletingFilename === snap.filename ? '...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmFilename(null)}
                              className="p-1 text-gray-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmFilename(snap.filename)}
                            title="Delete snapshot from server"
                            className="p-1.5 bg-gray-800 hover:bg-red-950/80 text-gray-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Restore Confirmation Modal ───────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-red-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl font-mono">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-gray-800">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Confirm System State Restoration
              </h3>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <p className="bg-red-950/40 border border-red-500/30 p-3 rounded-lg text-red-300 leading-relaxed">
                ⚠️ <strong>WARNING:</strong> Restoring this backup will overwrite current database records and site configurations with the state saved in this archive.
              </p>

              <div className="space-y-1.5 bg-brand-darker p-3 rounded-lg text-[11px] border border-gray-800">
                <div className="flex justify-between">
                  <span className="text-gray-500">Source Archive:</span>
                  <span className="font-bold text-white truncate">{inspection?.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Database Restore:</span>
                  <span className={restoreDb ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
                    {restoreDb ? 'YES (Full Overwrite)' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Media Restore:</span>
                  <span className={restoreMedia ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
                    {restoreMedia ? 'YES (Cloudflare R2 Sync)' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Settings Restore:</span>
                  <span className={restoreSettings ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
                    {restoreSettings ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Type <span className="text-red-400 font-black">RESTORE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder="RESTORE"
                  className="w-full bg-brand-darker border border-gray-800 focus:border-red-500 text-white px-4 py-2.5 rounded-lg font-mono text-xs uppercase tracking-widest placeholder:text-gray-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setConfirmInput(''); }}
                disabled={restoring}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={confirmInput !== 'RESTORE' || restoring}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg shadow-red-600/30"
              >
                {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{restoring ? 'Restoring System...' : 'Confirm & Overwrite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility formatting helper
BackupRestorePanel.formatBytes = (bytes: number, precision = 2): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, power)).toFixed(precision) + ' ' + units[power];
};
