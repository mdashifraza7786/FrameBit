'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await register(name, email, password);
        if (!res.success) {
          setError(res.error || 'Registration failed');
        } else {
          router.push('/dashboard');
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Login failed');
        } else {
          router.push('/dashboard');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google?direct=true';
  };

  const handleDemoLogin = async (demoRole: 'owner' | 'editor' | 'reviewer') => {
    setError('');
    setLoading(true);
    const demoEmail = `${demoRole}@frame.drive`;
    const demoPassword = 'password123';

    // Try login first
    let res = await login(demoEmail, demoPassword);
    if (!res.success) {
      // Auto-create demo user if not existing
      const regRes = await register(`${demoRole.charAt(0).toUpperCase() + demoRole.slice(1)} Demo`, demoEmail, demoPassword, demoRole);
      if (regRes.success) {
        router.push('/dashboard');
      } else {
        setError(regRes.error || 'Demo login failed');
      }
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] dark:bg-[#090a0f] flex items-center justify-center p-4 selection:bg-brand-500/30 selection:text-brand-700 dark:selection:bg-teal-500/30 dark:selection:text-teal-300 relative transition-colors">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 dark:from-teal-500 dark:to-cyan-700 shadow-xl shadow-brand-600/20 dark:shadow-teal-500/20 mb-2">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-brand-700 dark:from-white dark:via-zinc-200 dark:to-teal-300 bg-clip-text text-transparent">
            Frame<span className="text-brand-600 dark:text-teal-400">Bit</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Private Video Review & Collaboration Platform backed by Google Drive
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => {
                setIsRegister(false);
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                !isRegister
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                isRegister
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2.5 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
            <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">OR</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/25 dark:shadow-teal-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2">
            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 block text-center">
              Quick 1-Click Demo Accounts:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['owner', 'editor', 'reviewer'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleDemoLogin(r)}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 hover:border-brand-500/40 dark:hover:border-teal-500/40 text-center transition-colors group"
                >
                  <span className="text-xs font-semibold capitalize text-slate-700 dark:text-zinc-300 group-hover:text-brand-600 dark:group-hover:text-teal-400 block">
                    {r}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Demo</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
