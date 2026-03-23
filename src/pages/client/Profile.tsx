import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { User, Phone, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { updateProfileAsync, clearAuthError } from '../../store/authSlice';
import type { AppDispatch, RootState } from '../../store';

export default function Profile() {
  const dispatch               = useDispatch<AppDispatch>();
  const { user, token, status, error } = useSelector((s: RootState) => s.auth);

  const [info,    setInfo]    = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw,      setPw]      = useState({ current: '', newPw: '', confirm: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [saved,   setSaved]   = useState(false);

  // Sync if user updates externally
  useEffect(() => {
    if (user) setInfo({ name: user.name, phone: user.phone });
  }, [user]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (!token) return;
    dispatch(updateProfileAsync({ token, data: { name: info.name, phone: info.phone } }))
      .unwrap()
      .then(() => setSaved(true))
      .catch(() => {});
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setSaved(false);
    if (pw.newPw !== pw.confirm) { setLocalErr('Passwords do not match.'); return; }
    if (pw.newPw.length < 8)     { setLocalErr('Password must be at least 8 characters.'); return; }
    if (!token) return;
    dispatch(updateProfileAsync({
      token,
      data: { password: pw.newPw, password_confirmation: pw.confirm },
    }))
      .unwrap()
      .then(() => { setSaved(true); setPw({ current: '', newPw: '', confirm: '' }); })
      .catch(() => {});
  };

  const displayError = localErr || error;

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
        My <span className="text-brand-orange">Profile</span>
      </h1>

      {/* Feedback banners */}
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
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-6">
        <h2 className="text-lg font-bold text-white uppercase tracking-wide mb-5 flex items-center gap-2">
          <User className="w-5 h-5 text-brand-orange" /> Personal Information
        </h2>

        <form onSubmit={handleInfoSubmit} className="space-y-5">
          {/* Email – read-only */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Email Address
            </label>
            <input
              type="email" value={user?.email ?? ''} disabled
              className="w-full bg-brand-darker border border-gray-800 text-gray-500 px-4 py-3 rounded-sm cursor-not-allowed"
            />
            <p className="text-xs text-gray-600">Email cannot be changed.</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Full Name</label>
            <input
              type="text" required value={info.name}
              onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> Phone Number
            </label>
            <input
              type="tel" value={info.phone}
              onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
              placeholder="09XXXXXXXXX"
            />
          </div>

          <button
            type="submit" disabled={status === 'loading'}
            className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
          >
            {status === 'loading' ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-6">
        <h2 className="text-lg font-bold text-white uppercase tracking-wide mb-5 flex items-center gap-2">
          <Lock className="w-5 h-5 text-brand-orange" /> Change Password
        </h2>

        <form onSubmit={handlePwSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pw.newPw}
              onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
              autoComplete="new-password"
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Confirm New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)}
              className="accent-brand-orange" />
            Show passwords
          </label>

          <button
            type="submit" disabled={status === 'loading' || !pw.newPw}
            className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
          >
            {status === 'loading' ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
