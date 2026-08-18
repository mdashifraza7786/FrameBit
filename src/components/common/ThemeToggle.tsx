'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl border transition-all ${
        theme === 'dark'
          ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/40 shadow-sm'
          : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-cyan-700 hover:border-cyan-500/40 shadow-sm'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-cyan-700 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
