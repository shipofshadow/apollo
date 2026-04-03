import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { forgotPasswordApi } from '../../services/api';
import TurnstileWidget from '../../components/TurnstileWidget';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey,   setTurnstileKey]   = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const data = await forgotPasswordApi(email, turnstileToken);
      setStatus('success');
      setMessage(data.message);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setTurnstileKey(k => k + 1);
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex items-center justify-center px-4 pt-24 pb-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-2">
            Forgot <span className="text-brand-orange">Password</span>
          </h1>
          <p className="text-gray-400">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 shadow-2xl">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-gray-300">{message}</p>
              <Link
                to="/login"
                className="inline-block text-brand-orange hover:text-orange-400 font-bold transition-colors text-sm"
              >
                Back to Sign In
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
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                    placeholder="you@example.com"
                  />
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
                      <Mail className="w-5 h-5" /> Send Reset Link
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-gray-500 text-sm mt-6">
                Remembered it?{' '}
                <Link
                  to="/login"
                  className="text-brand-orange hover:text-orange-400 font-bold transition-colors"
                >
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
