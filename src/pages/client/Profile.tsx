import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Phone, Mail, Lock, AlertCircle, Eye, EyeOff, Bell, Loader2, CheckCircle2, Upload, Trash2, Monitor, RefreshCw, Shield, MessageSquare } from 'lucide-react';
import { updateProfileAsync, clearAuthError } from '../../store/authSlice';
import type { AppDispatch } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getNotificationPrefsApi,
  saveNotificationPrefsApi,
  uploadProfileAvatarApi,
  fetchAuthSessionsApi,
  revokeAuthSessionApi,
  revokeOtherAuthSessionsApi,
  exportMyDataApi,
  deleteMyAccountApi,
} from '../../services/api';
import type { NotificationPreferences } from '../../types';

const UPLOAD_MAX_MB = 10;

function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

type AuthSession = {
  id: number;
  userId: number;
  ipAddress: string;
  userAgent: string;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  isCurrent: boolean;
  isActive: boolean;
};

export default function Profile() {
  const dispatch               = useDispatch<AppDispatch>();
  const { user, token, status, error } = useAuth();
  const { showToast }          = useToast();

  const [info,     setInfo]    = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw,       setPw]      = useState({ newPw: '', confirm: '' });
  const [showPw,   setShowPw]  = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Notification preferences
  const [prefs,      setPrefs]      = useState<NotificationPreferences | null>(null);
  const [prefsBusy,  setPrefsBusy]  = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusyId, setSessionBusyId] = useState<number | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmPw, setDeleteConfirmPw] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false);

  useEffect(() => {
    if (user) setInfo({ name: user.name, phone: user.phone });
  }, [user]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  useEffect(() => {
    if (!token) return;
    getNotificationPrefsApi(token)
      .then(r => r.preferences && setPrefs(r.preferences))
      .catch(() => {});
  }, [token]);

  const loadSessions = async () => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const res = await fetchAuthSessionsApi(token);
      setSessions(res.sessions as AuthSession[]);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to load active sessions.', 'error');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handlePrefsToggle = (key: keyof NotificationPreferences) => {
    setPrefs(prev => prev ? { ...prev, [key]: !prev[key] } : null);
  };

  const handlePrefsSave = async () => {
    if (!token || !prefs) return;
    setPrefsBusy(true);
    try {
      // Map camelCase → snake_case for the API
      const payload: Record<string, boolean> = {
        email_new_booking:    prefs.emailNewBooking,
        email_order_created:  prefs.emailOrderCreated,
        email_order_status:   prefs.emailOrderStatus,
        email_order_tracking: prefs.emailOrderTracking,
        email_status_changed: prefs.emailStatusChanged,
        email_build_update:   prefs.emailBuildUpdate,
        email_parts_update:   prefs.emailPartsUpdate,
        inapp_order_created:  prefs.inappOrderCreated,
        inapp_order_status:   prefs.inappOrderStatus,
        inapp_order_tracking: prefs.inappOrderTracking,
        inapp_status_changed: prefs.inappStatusChanged,
        inapp_build_update:   prefs.inappBuildUpdate,
        inapp_parts_update:   prefs.inappPartsUpdate,
        inapp_slot_available: prefs.inappSlotAvailable,
        sms_status_changed:   prefs.smsStatusChanged,
      };
      const r = await saveNotificationPrefsApi(token, payload);
      setPrefs(r.preferences);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (!token) return;
    dispatch(updateProfileAsync({ token, data: { name: info.name, phone: info.phone } }))
      .unwrap()
      .then(() => showToast('Profile updated successfully.', 'success'))
      .catch(() => {});
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (pw.newPw !== pw.confirm) { setLocalErr('Passwords do not match.'); return; }
    if (pw.newPw.length < 8)     { setLocalErr('Password must be at least 8 characters.'); return; }
    if (!token) return;
    dispatch(updateProfileAsync({
      token,
      data: { password: pw.newPw, password_confirmation: pw.confirm },
    }))
      .unwrap()
      .then(() => { showToast('Password updated successfully.', 'success'); setPw({ newPw: '', confirm: '' }); })
      .catch(() => {});
  };

  const displayError = localErr || error;

  return (
    <div className="space-y-6 w-full">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-br from-brand-darker via-brand-dark to-[#151515] px-6 py-6 md:px-7 md:py-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-20 h-32 w-32 rounded-full bg-red-400/10 blur-2xl" />
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange/90 mb-2">Client Portal</p>
        <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight">
          My Profile
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Manage your account details, security settings, and alerts.</p>
      </div>

      {/* Avatar card */}
      <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl px-6 py-5 flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0 overflow-hidden">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="Profile"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-brand-orange font-black text-xl uppercase">
              {user?.name?.[0] ?? '?'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-base truncate">{user?.name}</p>
          <p className="text-gray-500 text-sm truncate flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {user?.email}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white transition-colors cursor-pointer ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Change Image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingAvatar || !token}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file || !token) return;

                const sizeErr = validateImageFile(file);
                if (sizeErr) {
                  setLocalErr(sizeErr);
                  e.target.value = '';
                  return;
                }

                setLocalErr('');
                setUploadingAvatar(true);
                try {
                  const url = await uploadProfileAvatarApi(token, file);
                  await dispatch(updateProfileAsync({ token, data: { avatar_url: url } })).unwrap();
                  showToast('Profile image updated successfully.', 'success');
                } catch (err: unknown) {
                  setLocalErr((err as Error)?.message ?? 'Failed to upload profile image.');
                } finally {
                  setUploadingAvatar(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!token || !user?.avatar_url) return;
              setLocalErr('');
              setRemovingAvatar(true);
              dispatch(updateProfileAsync({ token, data: { avatar_url: null } }))
                .unwrap()
                .then(() => showToast('Profile image removed.', 'success'))
                .catch(() => {})
                .finally(() => setRemovingAvatar(false));
            }}
            disabled={!user?.avatar_url || removingAvatar}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-40"
          >
            {removingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Remove</span>
          </button>
          <span className="shrink-0 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-md border border-brand-orange/30 text-brand-orange bg-brand-orange/10">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {displayError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {displayError}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column: Personal info + Change password */}
        <div className="space-y-6">

          {/* Personal info */}
          <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-xs font-bold text-white uppercase tracking-widest">Personal Information</h2>
            </div>
            <form onSubmit={handleInfoSubmit} className="p-6 space-y-5">
              {/* Email – read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input
                  type="email" value={user?.email ?? ''} disabled
                  className="w-full bg-brand-darker border border-gray-800 text-gray-600 px-4 py-2.5 rounded-md cursor-not-allowed text-sm"
                />
                <p className="text-[11px] text-gray-700">Email cannot be changed.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name</label>
                  <input
                    type="text" required value={info.name}
                    onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-md text-sm"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Phone Number
                  </label>
                  <input
                    type="tel" value={info.phone}
                    onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-md text-sm"
                    placeholder="Please enter your phone number."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit" disabled={status === 'loading'}
                  className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-md"
                >
                  {status === 'loading' ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-brand-orange" /> Change Password
              </h2>
            </div>
            <form onSubmit={handlePwSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pw.newPw}
                      onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
                      autoComplete="new-password"
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 pr-10 focus:outline-none focus:border-brand-orange transition-colors rounded-md text-sm"
                      placeholder="At least 8 characters"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pw.confirm}
                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                    autoComplete="new-password"
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit" disabled={status === 'loading' || !pw.newPw}
                  className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-md"
                >
                  {status === 'loading' ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

        </div>{/* end left column */}

        {/* Right column: Notification Preferences */}
        <div className="space-y-6">
        {prefs && (
          <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-orange" /> Notification Preferences
            </h2>

            {prefsSaved && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-3 py-2 rounded-md">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Preferences saved!
              </div>
            )}

            <div className="space-y-4">
              {/* Email channel */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email Notifications
                </p>
                <div className="space-y-3">
                  {([
                    ['emailOrderCreated', 'Order received confirmation'],
                    ['emailOrderStatus',  'Order status changes'],
                    ['emailOrderTracking','Order tracking updates'],
                    ['emailStatusChanged', 'Booking status changes'],
                    ['emailBuildUpdate',   'Build progress updates'],
                    ['emailPartsUpdate',   'Parts availability updates'],
                  ] as [keyof NotificationPreferences, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs[key] as boolean}
                        onClick={() => handlePrefsToggle(key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${prefs[key] ? 'bg-brand-orange' : 'bg-gray-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* In-app channel */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> In-App Notifications
                </p>
                <div className="space-y-3">
                  {([
                    ['inappOrderCreated', 'Order received confirmation'],
                    ['inappOrderStatus',  'Order status changes'],
                    ['inappOrderTracking','Order tracking updates'],
                    ['inappStatusChanged', 'Booking status changes'],
                    ['inappBuildUpdate',   'Build progress updates'],
                    ['inappPartsUpdate',   'Parts availability updates'],
                    ['inappSlotAvailable', 'Waitlist slot available'],
                  ] as [keyof NotificationPreferences, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs[key] as boolean}
                        onClick={() => handlePrefsToggle(key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${prefs[key] ? 'bg-brand-orange' : 'bg-gray-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* SMS channel */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> SMS Notifications
                </p>
                {!user?.phone && (
                  <p className="text-xs text-yellow-500/80 mb-3 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    Add a phone number above to receive SMS alerts.
                  </p>
                )}
                <div className="space-y-3">
                  {([
                    ['smsStatusChanged', 'Booking status changes'],
                  ] as [keyof NotificationPreferences, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={prefs[key] as boolean}
                        onClick={() => handlePrefsToggle(key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${prefs[key] ? 'bg-brand-orange' : 'bg-gray-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handlePrefsSave}
                disabled={prefsBusy}
                className="flex items-center gap-2 bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-md"
              >
                {prefsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Active sessions */}
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-brand-orange" /> Active Sessions
            </h2>
            <button
              type="button"
              onClick={loadSessions}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                setRevokeOthersBusy(true);
                try {
                  const r = await revokeOtherAuthSessionsApi(token);
                  showToast(`Revoked ${r.revoked} other session${r.revoked === 1 ? '' : 's'}.`, 'success');
                  await loadSessions();
                } catch (e: unknown) {
                  showToast((e as Error).message ?? 'Failed to revoke other sessions.', 'error');
                } finally {
                  setRevokeOthersBusy(false);
                }
              }}
              disabled={revokeOthersBusy || sessionsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-md border border-red-900/70 text-red-300 hover:border-red-500 hover:text-red-200 transition-colors disabled:opacity-60"
            >
              {revokeOthersBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              Revoke Others
            </button>
          </div>

          {sessionsLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className={`border rounded-md px-3 py-3 ${s.isCurrent ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-gray-800 bg-black/20'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-300">
                        {s.isCurrent ? 'Current Device' : 'Signed-in Device'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">{s.ipAddress || 'Unknown IP'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.isCurrent ? (
                        <span className="text-[10px] px-2 py-1 rounded-md border border-brand-orange/30 text-brand-orange bg-brand-orange/10 font-bold uppercase tracking-widest">
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token) return;
                            setSessionBusyId(s.id);
                            try {
                              await revokeAuthSessionApi(token, s.id);
                              showToast('Session revoked.', 'success');
                              await loadSessions();
                            } catch (e: unknown) {
                              showToast((e as Error).message ?? 'Failed to revoke session.', 'error');
                            } finally {
                              setSessionBusyId(null);
                            }
                          }}
                          disabled={sessionBusyId === s.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border border-red-900/70 text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-60"
                        >
                          {sessionBusyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2 truncate">{s.userAgent || 'Unknown device agent'}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Signed in: {new Date(s.issuedAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

      </div>{/* end two-column grid */}

      {/* ── Data Privacy ───────────────────────────────────────────────── */}
      <div className="mt-8 bg-[#111] border border-gray-800 rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-orange" /> Data Privacy
        </h3>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Export Data */}
          <button
            disabled={exportingData}
            onClick={async () => {
              if (!token) return;
              setExportingData(true);
              try {
                await exportMyDataApi(token);
                showToast('Your data export has started downloading.', 'success');
              } catch (e) {
                showToast((e as Error).message ?? 'Export failed.', 'error');
              } finally { setExportingData(false); }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-darker border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50"
          >
            {exportingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
            Export My Data
          </button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-950/40 border border-red-900/60 text-red-400 hover:border-red-500 hover:text-red-300 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete My Account
          </button>
        </div>

        <p className="text-[11px] text-gray-600 leading-relaxed">
          Exporting downloads a JSON file with your profile, bookings, vehicles, and reviews.
          Account deletion permanently removes all your personal data and cannot be undone.
        </p>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm bg-[#111] border border-red-900/60 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-red-400 uppercase tracking-widest">Delete Account</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              This will permanently delete your account and all associated data. This action <strong className="text-white">cannot be undone</strong>.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Confirm Password</label>
              <input
                type="password"
                value={deleteConfirmPw}
                onChange={e => setDeleteConfirmPw(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 rounded-sm focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmPw(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deletingAccount || !deleteConfirmPw}
                onClick={async () => {
                  if (!token) return;
                  setDeletingAccount(true);
                  try {
                    await deleteMyAccountApi(token, deleteConfirmPw);
                    showToast('Account deleted. Goodbye!', 'success');
                    setShowDeleteModal(false);
                    // Log out
                    window.location.href = '/';
                  } catch (e) {
                    showToast((e as Error).message ?? 'Deletion failed.', 'error');
                  } finally { setDeletingAccount(false); }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

