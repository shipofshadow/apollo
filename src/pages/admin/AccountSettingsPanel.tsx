import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Bell, Mail, MessageSquare, Phone, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Upload, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
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
  const dispatch                       = useDispatch<AppDispatch>();
  const { user, token, error } = useAuth();
  const fallbackAvatar = getDicebearAvatarDataUri({ id: user?.id, name: user?.name, email: user?.email });

  const [info,        setInfo]       = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw,          setPw]         = useState({ newPw: '', confirm: '' });
  const [showPw,      setShowPw]     = useState(false);
  const [localErr,    setLocalErr]   = useState('');
  const [saved,       setSaved]      = useState(false);
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [savingPw,    setSavingPw]    = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Notification preferences
  const [prefs,      setPrefs]      = useState<NotificationPreferences | null>(null);
  const [prefsBusy,  setPrefsBusy]  = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  useEffect(() => {
    if (user) setInfo({ name: user.name, phone: user.phone ?? '' });
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
    dispatch(updateProfileAsync({ token, data: { name: info.name, phone: info.phone } }))
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
    if (pw.newPw.length < 8)     { setLocalErr('Password must be at least 8 characters.'); return; }
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
    <div className="space-y-6 w-full max-w-6xl">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Account Settings</h2>

      {/* Avatar card */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0 overflow-hidden">
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
          <p className="text-white font-bold text-base truncate">{user?.name}</p>
          <p className="text-gray-500 text-sm truncate flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {user?.email}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-white transition-colors cursor-pointer ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`}>
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
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200 disabled:opacity-40"
          >
            {removingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Remove</span>
          </button>
        </div>
        <span className="shrink-0 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border border-brand-orange/30 text-brand-orange bg-brand-orange/10">
          {user?.role}
        </span>
      </div>

      {/* Feedback */}
      {saved && !displayError && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-sm text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> Changes saved successfully.
        </div>
      )}
      {displayError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {displayError}
        </div>
      )}

      {/* Personal info */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Personal Information</h3>
        </div>
        <form onSubmit={handleInfoSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email Address
            </label>
            <input
              type="email" value={user?.email ?? ''} disabled
              className="w-full bg-brand-darker border border-gray-800 text-gray-600 px-4 py-2.5 rounded-sm cursor-not-allowed text-sm"
            />
            <p className="text-[11px] text-gray-700">Email cannot be changed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name</label>
              <input
                type="text" required value={info.name}
                onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              <input
                type="tel" value={info.phone}
                onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
                placeholder="Please enter your phone number."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={savingInfo}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {savingInfo ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-brand-orange" /> Change Password
          </h3>
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
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 pr-10 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
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
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={savingPw || !pw.newPw}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {savingPw ? 'Saving…' : 'Update Password'}
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
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[prefKey] as boolean}
              onClick={() => handlePrefsToggle(prefKey)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${prefs[prefKey] ? 'bg-brand-orange' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[prefKey] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        );

        return (
          <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-brand-orange" /> Notification Preferences
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {prefsSaved && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-3 py-2 rounded-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Preferences saved!
                </div>
              )}

              {/* Email */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email Notifications
                </p>
                <div className="space-y-3">
                  {emailPrefs.map(([key, label]) => (
                    <ToggleRow key={key} prefKey={key} label={label} />
                  ))}
                </div>
              </div>

              {/* In-app */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> In-App Notifications
                </p>
                <div className="space-y-3">
                  {inappPrefs.map(([key, label]) => (
                    <ToggleRow key={key} prefKey={key} label={label} />
                  ))}
                </div>
              </div>

              {/* SMS — only if role has relevant prefs */}
              {smsPrefs.length > 0 && (
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
                    {smsPrefs.map(([key, label]) => (
                      <ToggleRow key={key} prefKey={key} label={label} />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handlePrefsSave()}
                  disabled={prefsBusy}
                  className="flex items-center gap-2 bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
                >
                  {prefsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
