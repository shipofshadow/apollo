import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { registerAsync, clearAuthError } from '../../store/authSlice';
import type { AppDispatch, RootState } from '../../store';

export default function RegisterPage() {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const redirect  = params.get('redirect') ?? '';

  const { user, status, error } = useSelector((s: RootState) => s.auth);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm: '',
  });
  const [showPw,   setShowPw]   = useState(false);
  const [localErr, setLocalErr] = useState('');

  useEffect(() => {
    if (user) {
      navigate(redirect || '/client/dashboard', { replace: true });
    }
  }, [user, navigate, redirect]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    if (form.password !== form.confirm) {
      setLocalErr('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setLocalErr('Password must be at least 8 characters.');
      return;
    }
    dispatch(registerAsync({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
    }));
  };

  const displayError = localErr || error;

  return (
    <div className="min-h-screen bg-brand-darker flex items-center justify-center px-4 pt-24 pb-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-2">
            Create <span className="text-brand-orange">Account</span>
          </h1>
          <p className="text-gray-400">Register to book services and track your appointments.</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 shadow-2xl">
          {displayError && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Full Name *</label>
              <input
                type="text" required value={form.name} onChange={set('name')}
                autoComplete="name"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="Juan dela Cruz"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Email Address *</label>
              <input
                type="email" required value={form.email} onChange={set('email')}
                autoComplete="email"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="juan@example.com"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Phone Number</label>
              <input
                type="tel" value={form.phone} onChange={set('phone')}
                autoComplete="tel"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="09XXXXXXXXX"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Password *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required value={form.password} onChange={set('password')}
                  autoComplete="new-password"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">Confirm Password *</label>
              <input
                type={showPw ? 'text' : 'password'} required value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-brand-orange text-white font-bold uppercase tracking-widest py-4 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm mt-2"
            >
              {status === 'loading' ? (
                <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
              ) : (
                <><UserPlus className="w-5 h-5" /> Create Account</>
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link
              to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
              className="text-brand-orange hover:text-orange-400 font-bold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
