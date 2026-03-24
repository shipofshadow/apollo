import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Phone, Mail, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { updateProfileAsync, clearAuthError } from '../../store/authSlice';
import type { AppDispatch } from '../../store';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const dispatch               = useDispatch<AppDispatch>();
  const { user, token, status, error } = useAuth();

  const [info,     setInfo]    = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw,       setPw]      = useState({ newPw: '', confirm: '' });
  const [showPw,   setShowPw]  = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [saved,    setSaved]   = useState(false);

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
      .then(() => { setSaved(true); setPw({ newPw: '', confirm: '' }); })
      .catch(() => {});
  };

  const displayError = localErr || error;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">Client Portal</p>
        <h1 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-tighter">
          My Profile
        </h1>
      </div>

      {/* Avatar card */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-orange/20 border-2 border-brand-orange/50 flex items-center justify-center shrink-0">
          <span className="text-brand-orange font-black text-xl uppercase">
            {user?.name?.[0] ?? '?'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-base truncate">{user?.name}</p>
          <p className="text-gray-500 text-sm truncate flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {user?.email}
          </p>
        </div>
        <span className="ml-auto shrink-0 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border border-brand-orange/30 text-brand-orange bg-brand-orange/10">
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
              className="w-full bg-brand-darker border border-gray-800 text-gray-600 px-4 py-2.5 rounded-sm cursor-not-allowed text-sm"
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
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
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
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-2.5 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={status === 'loading'}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {status === 'loading' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
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
              type="submit" disabled={status === 'loading' || !pw.newPw}
              className="bg-brand-orange text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {status === 'loading' ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

