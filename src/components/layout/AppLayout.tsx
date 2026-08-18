'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  HardDrive,
  Search,
  LogOut,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { NotificationDrawer } from '../common/NotificationDrawer';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { ThemeToggle } from '../common/ThemeToggle';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
          <span className="text-xs text-zinc-500 font-medium">Loading FrameBit Workspace...</span>
        </div>
      </div>
    );
  }

  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/review')) {
    router.push('/login');
    return null;
  }

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', href: '/projects', icon: FolderKanban },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 selection:bg-teal-500/30 selection:text-teal-600 dark:selection:text-teal-300 transition-colors duration-200">
      {/* Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Left Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/70 backdrop-blur-xl flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200 dark:border-zinc-800/60">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg bg-gradient-to-r from-slate-900 via-slate-700 to-teal-700 dark:from-white dark:via-zinc-200 dark:to-teal-300 bg-clip-text text-transparent">
                Frame<span className="text-teal-600 dark:text-teal-400">Bit</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-teal-500/10 dark:bg-teal-600/15 text-teal-700 dark:text-teal-400 border border-teal-500/20 shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel: Google Drive Status & User Profile */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800/60 space-y-3 bg-slate-100/50 dark:bg-zinc-950/40">
          {/* Drive Status Badge */}
          <Link
            href="/settings"
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
              user?.googleDriveConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 shrink-0" />
              <div className="leading-tight">
                <span className="font-semibold block">Google Drive</span>
                <span className="text-[10px] opacity-80">
                  {user?.googleDriveConnected ? 'Connected (FrameBit/)' : 'Not Connected'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </Link>

          {/* User Profile */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-600/15 dark:bg-teal-600/30 border border-teal-500/40 flex items-center justify-center font-bold text-teal-700 dark:text-teal-300 text-xs">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{user?.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-600 dark:text-teal-400 inline" /> {user?.role}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* Quick search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 text-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span className="hidden sm:inline">Search anything...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-zinc-800 rounded border border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark / Light Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationDrawer />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#090a0f] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
