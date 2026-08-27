'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertCircle, Clock, FileText, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { ReviewStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ReviewStatus;
  canChangeStatus?: boolean;
  onStatusChange?: (newStatus: ReviewStatus, notes?: string) => Promise<void>;
}

export function StatusBadge({ status, canChangeStatus = false, onStatusChange }: StatusBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ReviewStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getStatusConfig = (st: ReviewStatus) => {
    switch (st) {
      case 'Approved':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
          dot: 'bg-emerald-500 dark:bg-emerald-400 shadow-emerald-400/50',
          icon: CheckCircle2,
        };
      case 'Changes Requested':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 text-amber-700 dark:text-amber-400',
          dot: 'bg-amber-500 dark:bg-amber-400 shadow-amber-400/50',
          icon: AlertCircle,
        };
      case 'Updated':
        return {
          bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500/40 text-cyan-700 dark:text-cyan-400',
          dot: 'bg-cyan-400 shadow-cyan-400/50 animate-pulse',
          icon: Sparkles,
        };
      case 'In Review':
        return {
          bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-500/40 text-teal-700 dark:text-teal-400',
          dot: 'bg-teal-500 dark:bg-teal-400 shadow-teal-400/50 animate-pulse',
          icon: Clock,
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-zinc-800/60 border-slate-300 dark:border-zinc-700/60 text-slate-600 dark:text-zinc-400',
          dot: 'bg-slate-400 dark:bg-zinc-400',
          icon: FileText,
        };
    }
  };

  const handleAction = async (newStatus: ReviewStatus) => {
    if (newStatus === 'Approved') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
      if (onStatusChange) {
        await onStatusChange('Approved');
      }
    } else {
      setTargetStatus(newStatus);
      setModalOpen(true);
    }
  };

  const submitModalStatus = async () => {
    if (!targetStatus || !onStatusChange) return;
    setSubmitting(true);
    try {
      await onStatusChange(targetStatus, notes);
      setModalOpen(false);
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      {/* Current Status Chip */}
      <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[11px] sm:text-xs font-semibold tracking-wide shrink-0 ${config.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <Icon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
        <span className="hidden xs:inline sm:inline">{status}</span>
      </div>

      {/* Reviewer Action Buttons */}
      {canChangeStatus && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-0.5 sm:p-1 rounded-xl shrink-0">
          <button
            onClick={() => handleAction('Changes Requested')}
            className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-colors flex items-center gap-1 ${
              status === 'Changes Requested'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
            }`}
            title="Request Changes"
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="hidden lg:inline">Request Changes</span>
          </button>
          <button
            onClick={() => handleAction('Approved')}
            className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-colors flex items-center gap-1 ${
              status === 'Approved'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
            }`}
            title="Approve"
          >
            <Check className="w-3 h-3 text-emerald-500" />
            <span className="hidden lg:inline">Approve</span>
          </button>
        </div>
      )}

      {/* Changes Request Note Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              Request Changes
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Summarize required changes for the editor or leave specific comments on the video timeline.
            </p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please update audio mix and reposition lower thirds..."
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitModalStatus}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
