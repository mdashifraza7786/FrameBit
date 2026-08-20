'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderKanban, Film, MessageSquare, X, ArrowRight } from 'lucide-react';
import { formatTimecode } from '@/lib/timecode';

interface SearchResultProject {
  id: string;
  name: string;
  description: string;
}

interface SearchResultVideo {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  version: number;
}

interface SearchResultComment {
  id: string;
  text: string;
  timestamp: number;
  assetId: string;
  assetName: string;
  author: string;
}

interface SearchResults {
  projects: SearchResultProject[];
  videos: SearchResultVideo[];
  comments: SearchResultComment[];
}

export function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ projects: [], videos: [], comments: [] });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ projects: [], videos: [], comments: [] });
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ projects: [], videos: [], comments: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error('Search query error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults = results.projects.length + results.videos.length + results.comments.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90">
          <Search className="w-5 h-5 text-slate-400 dark:text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, video files, comments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 text-base focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-slate-500 dark:text-zinc-400 bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-400">Searching workspace...</div>
          )}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400 dark:text-zinc-400">No results found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {/* Projects Category */}
          {results.projects.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-3 mb-1.5 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-brand-600 dark:text-teal-400" /> Projects ({results.projects.length})
              </div>
              <div className="space-y-1">
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onClose();
                      router.push(`/projects/${p.id}`);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors group"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-teal-400">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="text-xs text-slate-500 dark:text-zinc-500 truncate max-w-md">{p.description}</div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos Category */}
          {results.videos.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-3 mb-1.5 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-brand-600 dark:text-teal-400" /> Videos ({results.videos.length})
              </div>
              <div className="space-y-1">
                {results.videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onClose();
                      router.push(`/projects/${v.projectId}/videos/${v.id}`);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors group"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-teal-400 flex items-center gap-2">
                        {v.name}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                          v{v.version}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-500">In {v.projectName}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments Category */}
          {results.comments.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-3 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand-600 dark:text-teal-400" /> Comments ({results.comments.length})
              </div>
              <div className="space-y-1">
                {results.comments.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onClose();
                      router.push(`/projects/unknown/videos/${c.assetId}?t=${c.timestamp}`);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors group"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                        <span>{c.author}</span>
                        <span className="text-brand-600 dark:text-teal-400 font-mono">@{formatTimecode(c.timestamp)}</span>
                        <span className="text-slate-400 dark:text-zinc-600">• on {c.assetName}</span>
                      </div>
                      <div className="text-sm text-slate-800 dark:text-zinc-200 line-clamp-1 mt-0.5">&ldquo;{c.text}&rdquo;</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
