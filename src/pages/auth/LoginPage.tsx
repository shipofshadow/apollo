import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TurnstileWidget from '../../components/TurnstileWidget';
import { verifyEmailApi, resendVerificationApi } from '../../services/api';

export default function LoginPage() {
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const redirect   = params.get('redirect') ?? '';

  const { user, status, error, login, clearError } = useAuth();
  const { showToast } = useToast();

  const [email,    setEmail]    = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey,   setTurnstileKey]   = useState(0);
  const [resendBusy, setResendBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const hasShownToast = useRef(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      }
      navigate(redirect || (user.role === 'client' ? '/client/dashboard' : '/admin'), { replace: true });
    }
  }, [user, navigate, redirect, showToast]);

  // Clean error on unmount
  useEffect(() => () => { clearError(); }, []);

  useEffect(() => {
    const token = params.get('verifyToken') ?? '';
    if (token === '') return;

    verifyEmailApi(token)
      .then((res) => {
        setVerifyMsg(res.message || 'Email verified successfully. You can now sign in.');
        showToast('Email verified. You can now sign in.', 'success');
        navigate('/login', { replace: true });
      })
      .catch((e: unknown) => {
        const msg = (e as Error).message || 'Verification link is invalid or has expired.';
        setVerifyMsg(msg);
      });
  }, [params, navigate, showToast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password, turnstileToken)
      .catch(() => setTurnstileKey(k => k + 1));
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      showToast('Enter your email address first.', 'error');
      return;
    }
    setResendBusy(true);
    try {
      const res = await resendVerificationApi(email.trim());
      showToast(res.message, 'success');
    } catch (e: unknown) {
      showToast((e as Error).message || 'Failed to resend verification email.', 'error');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex items-center justify-center px-4 pt-24 pb-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-2">
            Sign <span className="text-brand-orange">In</span>
          </h1>
          <p className="text-gray-400">Welcome back. Enter your credentials to continue.</p>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 shadow-2xl">
          {(verifyMsg || params.get('verify_notice') === '1') && (
            <div className="flex items-center justify-between gap-3 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-sm mb-6 text-sm">
              <span>{verifyMsg || 'Registration complete. Please verify your email before signing in.'}</span>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendBusy}
                className="shrink-0 text-xs font-bold uppercase tracking-wider text-brand-orange hover:text-orange-300 disabled:opacity-50"
              >
                {resendBusy ? 'Sending...' : 'Resend'}
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="Please enter your email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-brand-orange hover:text-orange-400 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                  placeholder="Please enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
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
                <>
                  <LogIn className="w-5 h-5" /> Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link
              to={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
              className="text-brand-orange hover:text-orange-400 font-bold transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
