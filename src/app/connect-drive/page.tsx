'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardDrive, Sparkles, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export default function ConnectDrivePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Someone who already connected (or isn't an owner) shouldn't be stuck here
  useEffect(() => {
    if (user && (user.googleDriveConnected || user.role !== 'owner')) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Could not start Google Drive connection');
        setConnecting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Could not start Google Drive connection');
      setConnecting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] dark:bg-[#090a0f] flex items-center justify-center transition-colors">
        <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 dark:border-teal-500/30 dark:border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] dark:bg-[#090a0f] flex items-center justify-center p-4 selection:bg-brand-500/30 selection:text-brand-700 dark:selection:bg-teal-500/30 dark:selection:text-teal-300 relative transition-colors">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 dark:from-teal-500 dark:to-cyan-700 shadow-xl shadow-brand-600/20 dark:shadow-teal-500/20 mb-2">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-brand-700 dark:from-white dark:via-zinc-200 dark:to-teal-300 bg-clip-text text-transparent">
            One more step
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Frame<span className="text-brand-600 dark:text-teal-400">Bit</span> stores every project&apos;s videos in
            your own Google Drive
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-800/60">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Connecting Google Drive is required before you can create projects or upload videos — it&apos;s where
              all your project videos actually live.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 dark:shadow-teal-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {connecting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <HardDrive className="w-4 h-4" />
                <span>Connect Google Drive</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="w-full py-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign in with a different account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
