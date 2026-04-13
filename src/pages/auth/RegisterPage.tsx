import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TurnstileWidget from '../../components/TurnstileWidget';

/** Returns a score 0–4 for password strength. */
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw))    score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS  = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-400', 'bg-green-500'];
const STRENGTH_TEXT    = ['', 'text-red-400', 'text-yellow-400', 'text-blue-400', 'text-green-400'];

export default function RegisterPage() {
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const redirect  = params.get('redirect') ?? '';

  const { user, status, error, register, clearError } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    name:    params.get('name')  ?? '',
    email:   params.get('email') ?? '',
    phone:   params.get('phone') ?? '',
    password: '', confirm: '',
  });
  const [showPw,   setShowPw]   = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey,   setTurnstileKey]   = useState(0);
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (user) {
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        showToast('Account created! Welcome to 1625 Auto Lab.', 'success');
      }
      navigate(redirect || '/client/dashboard', { replace: true });
    }
  }, [user, navigate, redirect, showToast]);

  useEffect(() => () => { clearError(); }, []);

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
    if (!consentGiven) {
      setLocalErr('Please accept the privacy policy to continue.');
      return;
    }
    if (!turnstileToken) {
      setLocalErr('Please complete the CAPTCHA challenge.');
      return;
    }
    register({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      cfTurnstileToken: turnstileToken,
      consentGiven: true,
    } as Parameters<typeof register>[0])
      .then(() => {
        showToast('Registration successful. Verify your email before signing in.', 'success');
        const q = new URLSearchParams();
        q.set('verify_notice', '1');
        q.set('email', form.email);
        if (redirect) q.set('redirect', redirect);
        navigate(`/login?${q.toString()}`, { replace: true });
      })
      .catch(() => setTurnstileKey(k => k + 1));
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
                placeholder="Please enter your phone number."
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
              {/* Password strength meter */}
              {form.password && (() => {
                const score = passwordStrength(form.password);
                return (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(n => (
                        <div
                          key={n}
                          className={`h-1 flex-1 rounded-full transition-colors ${n <= score ? STRENGTH_COLORS[score] : 'bg-gray-700'}`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-semibold ${STRENGTH_TEXT[score]}`}>{STRENGTH_LABELS[score]}</p>
                  </div>
                );
              })()}
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

            {/* Privacy Consent */}
            <div className="flex items-start gap-3 p-3 bg-brand-darker border border-gray-700 rounded-sm">
              <input
                type="checkbox"
                id="consent"
                checked={consentGiven}
                onChange={e => setConsentGiven(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-orange cursor-pointer shrink-0"
              />
              <label htmlFor="consent" className="text-xs text-gray-400 cursor-pointer leading-relaxed">
                I agree to the collection and processing of my personal data (bookings, vehicle info, contact details) by 1625 Auto Lab for service delivery purposes. You may export or delete your data anytime from your profile.
              </label>
            </div>

            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              resetKey={turnstileKey}
            />

            <button
              type="submit"
              disabled={status === 'loading' || !turnstileToken}
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
