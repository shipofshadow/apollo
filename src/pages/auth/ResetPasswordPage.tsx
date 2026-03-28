import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { resetPasswordApi } from '../../services/api';

export default function ResetPasswordPage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const token        = params.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message,   setMessage]   = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No reset token found. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const data = await resetPasswordApi(token, password, confirm);
      setStatus('success');
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex items-center justify-center px-4 pt-24 pb-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-2">
            Reset <span className="text-brand-orange">Password</span>
          </h1>
          <p className="text-gray-400">
            Choose a new password for your account.
          </p>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 shadow-2xl">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-gray-300">{message}</p>
              <p className="text-gray-500 text-sm">Redirecting to sign-in…</p>
              <Link
                to="/login"
                className="inline-block text-brand-orange hover:text-orange-400 font-bold transition-colors text-sm"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm mb-6 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                      placeholder="Min. 8 characters"
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

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCf ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showCf ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading' || !token}
                  className="w-full bg-brand-orange text-white font-bold uppercase tracking-widest py-4 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-sm mt-2"
                >
                  {status === 'loading' ? (
                    <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5" /> Update Password
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-gray-500 text-sm mt-6">
                Need a new link?{' '}
                <Link
                  to="/forgot-password"
                  className="text-brand-orange hover:text-orange-400 font-bold transition-colors"
                >
                  Request Reset
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
