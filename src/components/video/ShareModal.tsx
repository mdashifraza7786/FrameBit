'use client';

import React, { useState } from 'react';
import { Share2, Copy, Check, X, Shield, Lock, Calendar } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
}

export function ShareModal({ isOpen, onClose, videoId, videoTitle }: ShareModalProps) {
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateLink = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowComments,
          allowDownloads,
          expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedUrl(data.reviewUrl);
      }
    } catch (err) {
      console.error('Error creating share link:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 dark:bg-teal-600/20 text-brand-600 dark:text-teal-400 border border-brand-500/30 dark:border-teal-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">Share Video for Review</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-[240px]">&ldquo;{videoTitle}&rdquo;</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permissions Configuration */}
        <div className="space-y-3 bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">Allow Comments</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">Guests can add timecoded feedback</span>
            </div>
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-200 dark:bg-zinc-800 accent-brand-600 dark:accent-teal-600"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200 dark:border-zinc-900">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block">Allow Downloads</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500">Allow client to download video file</span>
            </div>
            <input
              type="checkbox"
              checked={allowDownloads}
              onChange={(e) => setAllowDownloads(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-200 dark:bg-zinc-800 accent-brand-600 dark:accent-teal-600"
            />
          </label>

          <div className="pt-2 border-t border-slate-200 dark:border-zinc-900 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Expires After</span>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-300 focus:outline-none"
            >
              <option value="1">1 Day</option>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="0">Never</option>
            </select>
          </div>
        </div>

        {/* Generate Link Button or Output */}
        {!generatedUrl ? (
          <button
            onClick={generateLink}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 dark:shadow-teal-600/20 transition-all disabled:opacity-50"
          >
            {isGenerating ? 'Generating Link...' : 'Create Secure Review Link'}
          </button>
        ) : (
          <div className="space-y-3 animate-in fade-in">
            <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-brand-500/30 dark:border-teal-500/30 rounded-2xl flex items-center justify-between gap-2">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="bg-transparent text-xs text-brand-700 dark:text-teal-400 font-mono flex-1 focus:outline-none truncate"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-600/20 dark:shadow-teal-600/20 transition-all shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 text-center">
              Anyone with this link can view the video and leave timecoded review notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
