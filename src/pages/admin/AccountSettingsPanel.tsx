import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Bell, Mail, MessageSquare, Phone, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Upload, Trash2, Loader2, CheckCircle2, UserCheck, Shield } from 'lucide-react';
import { updateProfileAsync, clearAuthError } from '../../store/authSlice';
import type { AppDispatch } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { uploadProfileAvatarApi, getNotificationPrefsApi, saveNotificationPrefsApi } from '../../services/api';
import type { NotificationPreferences } from '../../types';
import { getDicebearAvatarDataUri } from '../../utils/avatar';

const UPLOAD_MAX_MB = 10;

function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

export default function AccountSettingsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, token, error } = useAuth();
  const fallbackAvatar = getDicebearAvatarDataUri({ id: user?.id, name: user?.name, email: user?.email });

  const [info, setInfo] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (user) setInfo({ name: user.name, email: user.email, phone: user.phone ?? '' });
  }, [user]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  useEffect(() => {
    if (!token) return;
    getNotificationPrefsApi(token)
      .then(data => { if (data.preferences) setPrefs(data.preferences); })
      .catch(() => {});
  }, [token]);

  const handlePrefsToggle = (key: keyof NotificationPreferences) => {
    setPrefs(prev => prev ? { ...prev, [key]: !prev[key] } : prev);
    setPrefsSaved(false);
  };

  const handlePrefsSave = async () => {
    if (!token || !prefs) return;
    setPrefsBusy(true);
    setPrefsSaved(false);
    try {
      const updated = await saveNotificationPrefsApi(token, prefs);
      setPrefs(updated.preferences);
      setPrefsSaved(true);
    } catch {
      // non-critical
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (!token) return;
    setSavingInfo(true);
    dispatch(updateProfileAsync({ token, data: { name: info.name, email: info.email, phone: info.phone } }))
      .unwrap()
      .then(() => setSaved(true))
      .catch(() => {})
      .finally(() => setSavingInfo(false));
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (pw.newPw !== pw.confirm) { setLocalErr('Passwords do not match.'); return; }
    if (pw.newPw.length < 8) { setLocalErr('Password must be at least 8 characters.'); return; }
    if (!token) return;
    setSavingPw(true);
    dispatch(updateProfileAsync({
      token,
      data: { password: pw.newPw, password_confirmation: pw.confirm },
    }))
      .unwrap()
      .then(() => { setSaved(true); setPw({ newPw: '', confirm: '' }); })
      .catch(() => {})
      .finally(() => setSavingPw(false));
  };

  const displayError = localErr || error;

  return (
    <div className="space-y-6 w-full max-w-5xl font-sans pb-20">
      {/* Hero Profile Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0 overflow-hidden shadow-xl">
              <img
                src={user?.avatar_url || fallbackAvatar}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={e => {
                  const img = e.currentTarget;
                  if (img.src !== fallbackAvatar) {
                    img.src = fallbackAvatar;
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white truncate">{user?.name}</h2>
                <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase bg-brand-orange/10 text-brand-orange border border-brand-orange/30 rounded-full font-bold">
                  {user?.role}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-400 mt-1 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-brand-orange shrink-0" /> {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
            <label className={`flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-orange-600 text-white font-bold uppercase tracking-wider rounded-lg shadow-lg transition-all cursor-pointer ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`}>
              {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Upload Photo</span>
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
                  setSaved(false);
                  setUploadingAvatar(true);
                  try {
                    const url = await uploadProfileAvatarApi(token, file);
                    await dispatch(updateProfileAsync({ token, data: { avatar_url: url } })).unwrap();
                    setSaved(true);
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
                setSaved(false);
                setRemovingAvatar(true);
                dispatch(updateProfileAsync({ token, data: { avatar_url: null } }))
                  .unwrap()
                  .then(() => setSaved(true))
                  .catch(() => {})
                  .finally(() => setRemovingAvatar(false));
              }}
              disabled={!user?.avatar_url || removingAvatar}
              className="flex items-center gap-2 bg-brand-darker border border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400 px-4 py-2.5 font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
            >
              {removingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>Remove</span>
            </button>
          </div>
        </div>
      </section>

      {/* Global Feedback Alerts */}
      {saved && !displayError && (
        <div className="flex items-center gap-3 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 px-5 py-4 rounded-xl text-xs font-mono shadow-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Account changes updated successfully.</span>
        </div>
      )}
      {displayError && (
        <div className="flex items-center gap-3 bg-red-950/50 border border-red-500/40 text-red-300 px-5 py-4 rounded-xl text-xs font-mono shadow-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Personal Info Form */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-4">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-brand-orange" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Personal &amp; Contact Details</h3>
        </div>
        <form onSubmit={handleInfoSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-brand-orange" /> Email Address
            </label>
            <input
              type="email"
              value={info.email}
              onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm font-sans"
            />
            <p className="text-[11px] font-mono text-gray-500">
              {user?.email_verified
                ? '✓ Verified account email address.'
                : '⚠ Email is unverified. Please check your inbox for a confirmation link.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Full Name</label>
              <input
                type="text"
                required
                value={info.name}
                onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm font-sans"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand-orange" /> Phone Number
              </label>
              <input
                type="tel"
                value={info.phone}
                onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-brand-orange text-sm font-sans"
                placeholder="+63 9XX XXX XXXX"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingInfo}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
            >
              {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{savingInfo ? 'Saving…' : 'Save Details'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security & Password Card */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-4">
        <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-orange" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Security &amp; Password Update</h3>
        </div>
        <form onSubmit={handlePwSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.newPw}
                  onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
                  autoComplete="new-password"
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 pr-10 focus:outline-none focus:border-brand-orange transition-colors rounded-lg text-sm font-sans"
                  placeholder="At least 8 characters..."
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-lg text-sm font-sans"
                placeholder="Repeat password..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPw || !pw.newPw}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
            >
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{savingPw ? 'Saving…' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Notification Preferences */}
      {prefs && (() => {
        const role = user?.role;
        const isAdminType = role === 'admin' || role === 'owner' || role === 'manager';
        const isStaffType = role === 'staff' || role === 'manager';
        const canManageOrders = Boolean(user?.permissions?.includes('products:manage')) || role === 'owner' || role === 'admin';

        const emailPrefs: [keyof NotificationPreferences, string][] = [
          ...(isAdminType ? [['emailNewBooking', 'New booking alerts'] as [keyof NotificationPreferences, string]] : []),
          ...(canManageOrders ? [['emailNewOrder', 'New order alerts'] as [keyof NotificationPreferences, string]] : []),
          ['emailStatusChanged', 'Booking status changes'],
          ['emailBuildUpdate',   'Build progress updates'],
          ['emailPartsUpdate',   'Parts availability updates'],
        ];

        const inappPrefs: [keyof NotificationPreferences, string][] = [
          ...(isAdminType ? [['inappNewBooking', 'New booking alerts'] as [keyof NotificationPreferences, string]] : []),
          ...(canManageOrders ? [['inappNewOrder', 'New order alerts'] as [keyof NotificationPreferences, string]] : []),
          ['inappStatusChanged', 'Booking status changes'],
          ['inappBuildUpdate',   'Build progress updates'],
          ['inappPartsUpdate',   'Parts availability updates'],
          ...(isStaffType ? [['inappAssignment', 'Assignment updates'] as [keyof NotificationPreferences, string]] : []),
          ...(isAdminType ? [['inappSecurityAlert', 'Security alerts'] as [keyof NotificationPreferences, string]] : []),
        ];

        const smsPrefs: [keyof NotificationPreferences, string][] = [
          ...(isAdminType ? [['smsNewBooking', 'New booking alerts'] as [keyof NotificationPreferences, string]] : []),
          ...(isStaffType ? [['smsAssignment', 'Assignment to booking'] as [keyof NotificationPreferences, string]] : []),
        ];

        const ToggleRow = ({ prefKey, label }: { prefKey: keyof NotificationPreferences; label: string }) => (
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-brand-darker/60 hover:border-gray-700 cursor-pointer transition-all">
            <span className="text-xs font-mono font-bold text-gray-300">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[prefKey] as boolean}
              onClick={() => handlePrefsToggle(prefKey)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${prefs[prefKey] ? 'bg-emerald-500' : 'bg-gray-800'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[prefKey] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        );

        return (
          <div className="bg-[#121212] border border-gray-800/80 rounded-xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-6 py-4 border-b border-gray-800/80 bg-brand-dark/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-orange" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Notification Preferences</h3>
              </div>
              {prefsSaved && (
                <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Preferences saved!
                </span>
              )}
            </div>

            <div className="p-6 space-y-6 font-sans">
              {/* Email Notifications */}
              <div className="space-y-3">
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-orange" /> Email Channels
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {emailPrefs.map(([key, label]) => (
                    <ToggleRow key={key} prefKey={key} label={label} />
                  ))}
                </div>
              </div>

              {/* In-App Notifications */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-orange" /> In-App Alert Channels
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inappPrefs.map(([key, label]) => (
                    <ToggleRow key={key} prefKey={key} label={label} />
                  ))}
                </div>
              </div>

              {/* SMS Notifications */}
              {smsPrefs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-orange" /> SMS Alert Channels
                  </p>
                  {!user?.phone && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300 flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Please register a valid phone number above to enable SMS delivery.</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {smsPrefs.map(([key, label]) => (
                      <ToggleRow key={key} prefKey={key} label={label} />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => void handlePrefsSave()}
                  disabled={prefsBusy}
                  className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-7 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all rounded-lg shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {prefsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Notification Preferences</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
