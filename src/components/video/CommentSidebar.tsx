'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  CheckCircle2,
  Check,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  Pencil,
  Send,
  ChevronDown,
  Search,
  X,
  Square,
  Circle as CircleIcon,
  ArrowUpRight,
} from 'lucide-react';
import { CommentData, UserProfile } from '@/lib/types';
import { formatTimecode } from '@/lib/timecode';
import { MentionTextarea, MentionMember, renderWithMentions } from '@/components/common/MentionTextarea';
import type { ActiveTool } from './VideoPlayer';

const QUICK_DRAW_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

interface CommentSidebarProps {
  comments: CommentData[];
  currentTimestamp: number;
  currentVersionNumber: number;
  activeCommentId?: string | null;
  currentUser?: UserProfile | null;
  filter?: 'all' | 'active' | 'resolved';
  onFilterChange?: (filter: 'all' | 'active' | 'resolved') => void;
  onSeekTo: (timestamp: number, commentId?: string) => void;
  onAddComment: (
    text: string,
    timestamp: number,
    parentCommentId?: string,
    authorName?: string,
    x?: number,
    y?: number,
    drawingData?: string,
    timestampEnd?: number
  ) => Promise<void>;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
  allowGuestComments?: boolean;
  draftPin?: { x: number; y: number; timestamp: number; drawingData?: string } | null;
  onClearDraftPin?: () => void;
  projectId?: string;
  /** Full-bleed cinema layout: fills parent height, no card border/rounding. */
  theaterMode?: boolean;
  /** Controlled annotation tool, shared with the video player's own toolbar. */
  activeTool?: ActiveTool;
  onActiveToolChange?: (tool: ActiveTool) => void;
  drawColor?: string;
  onDrawColorChange?: (color: string) => void;
  /** Called the moment the user focuses the quick comment box — pauses playback so the timestamp freezes. */
  onRequestPause?: () => void;
  /** Anchors the start of a possible time-range comment — set as soon as composing begins, pin/drawing or not. */
  rangeStart?: number | null;
  /** The range end, dragged independently on the video's own mini-track (not tied to the playhead). */
  rangeEnd?: number | null;
  onClearRangeStart?: () => void;
  /** Callback to switch active version when clicking a comment belonging to a different cut */
  onSelectVersion?: (versionNumber: number) => void;
}

export function CommentSidebar({
  comments,
  currentTimestamp,
  currentVersionNumber,
  activeCommentId,
  currentUser,
  filter: externalFilter,
  onFilterChange,
  onSeekTo,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onEditComment,
  allowGuestComments = false,
  draftPin,
  onClearDraftPin,
  projectId,
  theaterMode = false,
  activeTool,
  onActiveToolChange,
  drawColor,
  onDrawColorChange,
  onRequestPause,
  rangeStart = null,
  rangeEnd = null,
  onClearRangeStart,
  onSelectVersion,
}: CommentSidebarProps) {
  const [internalFilter, setInternalFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [versionScope, setVersionScope] = useState<'current' | 'all'>('current');
  const filter = externalFilter || internalFilter;

  const handleFilterChange = (f: 'all' | 'active' | 'resolved') => {
    setInternalFilter(f);
    if (onFilterChange) onFilterChange(f);
  };
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<MentionMember[]>([]);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickText, setQuickText] = useState('');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(false);

  const activeCardRef = useRef<HTMLDivElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch project members for @mentions
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        const proj = data.project;
        if (!proj) return;
        const all: MentionMember[] = [
          { id: proj.owner._id, name: proj.owner.name, email: proj.owner.email, role: 'owner' },
          ...(proj.members || []).map((m: any) => ({
            id: m.userId._id,
            name: m.userId.name,
            email: m.userId.email,
            role: m.role,
          })),
        ];
        // Deduplicate by id, exclude self
        const seen = new Set<string>();
        const filtered = all.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return m.id !== currentUser?.id;
        });
        setMembers(filtered);
      })
      .catch(() => {});
  }, [projectId, currentUser?.id]);

  // Auto-scroll to active comment when clicked on timeline
  useEffect(() => {
    if (activeCommentId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  // Focus the search box the moment it's revealed
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // A pin/drawing was just placed on the video — hand off straight to the composer instead of an on-video popup
  useEffect(() => {
    if (draftPin) quickInputRef.current?.focus();
  }, [draftPin]);

  // Live range end — dragged independently on the video's own range mini-track (not the playhead/scrub bar),
  // mirrored down here purely for display + submit. No separate "range mode" toggle needed.
  const liveRangeEnd = rangeStart !== null ? rangeEnd : null;
  // A meaningful gap is required to actually attach a range on submit (the server also rejects timestampEnd <= timestamp).
  const hasValidRange = rangeStart !== null && liveRangeEnd !== null && Math.abs(liveRangeEnd - rangeStart) > 0.15;

  const handleQuickComment = async () => {
    if (!quickText.trim() || isQuickSubmitting) return;
    setIsQuickSubmitting(true);
    try {
      const anchor = rangeStart ?? (draftPin ? draftPin.timestamp : currentTimestamp);
      if (hasValidRange && liveRangeEnd !== null) {
        const start = Math.min(anchor, liveRangeEnd);
        const end = Math.max(anchor, liveRangeEnd);
        await onAddComment(quickText.trim(), start, undefined, undefined, draftPin?.x, draftPin?.y, draftPin?.drawingData, end);
      } else {
        await onAddComment(quickText.trim(), anchor, undefined, undefined, draftPin?.x, draftPin?.y, draftPin?.drawingData);
      }
      if (draftPin) onClearDraftPin?.();
      onClearRangeStart?.();
      setQuickText('');
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  // Pause playback every time the composer is (re)focused so the attached timestamp freezes at that instant
  const handleQuickComposerFocus = () => {
    // Only anchor on the *first* focus of a composing session — re-focusing later (e.g. after dragging the
    // range end, which also moves the live playhead for its preview) must not stomp the already-set start.
    if (!draftPin && rangeStart === null) onRequestPause?.();
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const parent = comments.find((c) => c._id === parentCommentId);
      const timestamp = parent ? parent.timestamp : currentTimestamp;
      await onAddComment(replyText.trim(), timestamp, parentCommentId);
      setReplyText('');
      setReplyingToId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onEditComment(commentId, editText.trim());
      setEditingId(null);
      setEditText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter top-level comments with optional version scope
  const topLevelComments = comments.filter((c) => {
    if (c.parentCommentId) return false;
    if (versionScope === 'current' && c.versionNumber && c.versionNumber !== currentVersionNumber) {
      return false;
    }
    return true;
  });

  const filteredComments = topLevelComments.filter((c) => {
    if (filter === 'active' && c.resolved) return false;
    if (filter === 'resolved' && !c.resolved) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const author = (c.userId?.name || c.guestName || '').toLowerCase();
      if (!c.text.toLowerCase().includes(q) && !author.includes(q)) return false;
    }
    return true;
  });

  const filterLabel = filter === 'all' ? 'All status' : filter === 'active' ? 'Unresolved' : 'Resolved';

  return (
    <div
      className={
        theaterMode
          ? 'flex flex-col h-full max-h-full min-h-0 bg-zinc-950'
          : 'flex flex-col h-full max-h-full min-h-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl'
      }
    >
      {/* Header & Filter Tabs */}
      {theaterMode ? (
        <div className="border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            {/* Filter Dropdown + Version Scope Toggle */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="relative">
                <button
                  onClick={() => setFilterMenuOpen((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-900 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  <span className="truncate max-w-[85px]">{filterLabel}</span>
                  <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${filterMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {filterMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setFilterMenuOpen(false)} />
                    <div className="absolute left-0 mt-1 w-40 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl z-40 overflow-hidden py-1">
                      {(['all', 'active', 'resolved'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => {
                            handleFilterChange(tab);
                            setFilterMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-between ${
                            filter === tab ? 'text-teal-400' : 'text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <span>{tab === 'all' ? 'All status' : tab === 'active' ? 'Unresolved' : 'Resolved'}</span>
                          {filter === tab && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Version Scope Toggle (Current Cut vs All Cuts) */}
              <div className="flex items-center bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 text-[10px] shrink-0">
                <button
                  onClick={() => setVersionScope('current')}
                  className={`px-1.5 py-0.5 rounded-md font-mono font-medium transition-all ${
                    versionScope === 'current'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={`Show feedback for v${currentVersionNumber} only`}
                >
                  v{currentVersionNumber}
                </button>
                <button
                  onClick={() => setVersionScope('all')}
                  className={`px-1.5 py-0.5 rounded-md font-medium transition-all ${
                    versionScope === 'all'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Show feedback across all versions"
                >
                  All cuts
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 text-[11px] font-mono text-zinc-500">{topLevelComments.length}</span>
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setSearchQuery('');
                }}
                title="Search comments"
                className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-zinc-800 text-teal-400' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="px-3 pb-2.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 focus-within:border-teal-500/60">
                <Search className="w-3 h-3 text-zinc-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search comments..."
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-slate-800 dark:text-zinc-200">Comments</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                {topLevelComments.length}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-200 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-300/50 dark:border-zinc-800 text-xs">
              {(['all', 'active', 'resolved'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleFilterChange(tab)}
                  className={`px-2.5 py-0.5 rounded-md font-medium capitalize transition-all ${
                    filter === tab
                      ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comment List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {filteredComments.length === 0 ? (
          searchQuery ? (
            <div className="p-6 text-center text-slate-400 dark:text-zinc-600 text-xs">
              No comments match &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-zinc-600 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30 text-teal-400" />
              <p className="text-xs">
                {filter === 'all'
                  ? versionScope === 'current'
                    ? `No comments on cut v${currentVersionNumber} yet.`
                    : 'No comments yet on any version.'
                  : `No ${filter} comments found.`}
              </p>
            </div>
          )
        ) : (
          filteredComments.map((comment) => {
            const replies = comments.filter((c) => c.parentCommentId === comment._id);
            const isToggledOn = activeCommentId === comment._id;
            const isActive =
              isToggledOn &&
              (!theaterMode ||
                (comment.timestampEnd && comment.timestampEnd > comment.timestamp
                  ? currentTimestamp >= comment.timestamp - 1.0 && currentTimestamp <= comment.timestampEnd + 1.0
                  : Math.abs(currentTimestamp - comment.timestamp) <= 1.0));
            const authorName = comment.userId?.name || comment.guestName || 'Reviewer';
            const isAuthor =
              currentUser &&
              (comment.userId?._id === currentUser.id ||
                (comment.userId as any) === currentUser.id ||
                (comment.userId as any)?._id === currentUser.id);

            return (
              <div
                key={comment._id}
                ref={isToggledOn ? activeCardRef : null}
                onClick={() => {
                  if (comment.versionNumber && comment.versionNumber !== currentVersionNumber) {
                    onSelectVersion?.(comment.versionNumber);
                  }
                  onSeekTo(comment.timestamp, comment._id);
                }}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-50/70 dark:bg-teal-950/20 border-brand-500 ring-2 ring-brand-500/20 dark:border-teal-500 dark:ring-teal-500/20 shadow-md'
                    : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    {/* Timestamp Jump Button — shows range if available */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (comment.versionNumber && comment.versionNumber !== currentVersionNumber) {
                          onSelectVersion?.(comment.versionNumber);
                        }
                        onSeekTo(comment.timestamp, comment._id);
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-brand-500/10 dark:bg-teal-600/20 hover:bg-brand-500/20 dark:hover:bg-teal-500/20 text-brand-700 dark:text-teal-300 font-mono text-[10px] font-semibold border border-brand-500/30 dark:border-teal-500/30 flex items-center gap-1 transition-colors shrink-0"
                      title="Jump to video timestamp"
                    >
                      <Clock className="w-2.5 h-2.5 text-brand-600 dark:text-teal-400" />
                      {comment.timestampEnd
                        ? `${formatTimecode(comment.timestamp)} → ${formatTimecode(comment.timestampEnd)}`
                        : formatTimecode(comment.timestamp)}
                    </button>

                    {comment.versionNumber && (
                      <span
                        onClick={(e) => {
                          if (comment.versionNumber && comment.versionNumber !== currentVersionNumber) {
                            e.stopPropagation();
                            onSelectVersion?.(comment.versionNumber);
                            onSeekTo(comment.timestamp, comment._id);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 transition-colors ${
                          comment.versionNumber === currentVersionNumber
                            ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-teal-500/50 hover:text-teal-300'
                        }`}
                        title={
                          comment.versionNumber === currentVersionNumber
                            ? `Current cut: v${comment.versionNumber}`
                            : `Click to switch to Cut v${comment.versionNumber}`
                        }
                      >
                        v{comment.versionNumber}
                      </span>
                    )}

                    <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate">
                      {authorName}
                    </span>

                    {comment.drawingData ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[9px] font-mono flex items-center gap-0.5 border border-purple-500/30 shrink-0">
                        <Pencil className="w-2 h-2" />
                        <span>Drawing</span>
                      </span>
                    ) : comment.x !== undefined && comment.y !== undefined ? (
                      <span className="px-1.5 py-0.2 rounded bg-brand-500/10 dark:bg-teal-500/20 text-brand-600 dark:text-teal-400 text-[9px] font-mono flex items-center gap-0.5 border border-brand-500/30 dark:border-teal-500/30 shrink-0">
                        <MapPin className="w-2 h-2" />
                        <span>Pin ({Math.round(comment.x)}%, {Math.round(comment.y)}%)</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Actions: Resolve & Edit/Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Resolve / Reopen Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolveComment(comment._id, !comment.resolved);
                      }}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-medium border transition-all ${
                        comment.resolved
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500'
                          : 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900/60 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                      }`}
                      title={comment.resolved ? 'Click to reopen feedback' : 'Mark feedback as resolved'}
                    >
                      {comment.resolved ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                          <span>Resolved</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-2.5 h-2.5" />
                          <span>Resolve</span>
                        </>
                      )}
                    </button>

                    {/* Edit/Delete Actions */}
                    {isAuthor && (
                      <div className="flex items-center gap-0.5 text-slate-400 dark:text-zinc-500">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(comment._id);
                            setEditText(comment.text);
                          }}
                          className="p-0.5 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteComment(comment._id);
                          }}
                          className="p-0.5 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comment Content */}
                {editingId === comment._id ? (
                  <div className="space-y-2 my-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(comment._id)}
                        className="px-2.5 py-1 text-[11px] bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={`text-xs leading-relaxed ${
                      comment.resolved
                        ? 'text-slate-400 dark:text-zinc-500 line-through'
                        : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {renderWithMentions(comment.text)}
                  </p>
                )}

                {/* Reply trigger button */}
                <div className="mt-2 flex items-center gap-3 text-[11px]" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setReplyingToId(replyingToId === comment._id ? null : comment._id)}
                    className="text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-teal-400 flex items-center gap-1 font-medium transition-colors"
                  >
                    <CornerDownRight className="w-3 h-3" /> Reply {replies.length > 0 && `(${replies.length})`}
                  </button>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-600">
                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Threaded Replies */}
                {replies.length > 0 && (
                  <div className="mt-2.5 pl-3 border-l border-slate-200 dark:border-zinc-800/80 space-y-2">
                    {replies.map((reply) => {
                      const replyAuthor = reply.userId?.name || reply.guestName || 'Guest';
                      return (
                        <div key={reply._id} className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900/40 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                            <span>{replyAuthor}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
                              {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-zinc-300">{renderWithMentions(reply.text)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Reply Input */}
                {replyingToId === comment._id && (
                  <div
                    className="mt-2.5 pl-3 border-l border-brand-500/40 dark:border-teal-500/40 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MentionTextarea
                      value={replyText}
                      onChange={setReplyText}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitReply(comment._id)}
                      placeholder="Reply... type @ to mention someone"
                      rows={2}
                      members={members}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setReplyingToId(null)}
                        className="px-2.5 py-1 text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSubmitReply(comment._id)}
                        disabled={isSubmitting || !replyText.trim()}
                        className="px-3 py-1 text-[11px] bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Comment Composer, pinned to current playhead time */}
      {theaterMode && (
        <div className="shrink-0 border-t border-zinc-800/80 p-2.5 space-y-2">
          {/* Inline annotation tool row — revealed by the pen icon, shared state with the video's own toolbar */}
          {showQuickTools && !draftPin && (
            <div className="flex items-center justify-between gap-2 px-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
              <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-0.5">
                {(
                  [
                    ['pin', MapPin, 'Pin'],
                    ['draw', Pencil, 'Pen'],
                    ['rectangle', Square, 'Rect'],
                    ['circle', CircleIcon, 'Circle'],
                    ['arrow', ArrowUpRight, 'Arrow'],
                  ] as const
                ).map(([tool, Icon, label]) => (
                  <button
                    key={tool}
                    type="button"
                    title={label}
                    onClick={() => onActiveToolChange?.(activeTool === tool ? null : tool)}
                    className={`p-1.5 rounded-lg transition-all ${
                      activeTool === tool
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
                {QUICK_DRAW_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onDrawColorChange?.(hex)}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      drawColor?.toLowerCase() === hex.toLowerCase()
                        ? 'scale-125 ring-2 ring-white'
                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {rangeStart !== null && liveRangeEnd !== null && (
            <div className="flex items-center gap-1.5 px-1 text-[10px] text-zinc-500">
              <span className={`font-mono ${hasValidRange ? 'text-amber-400' : 'text-zinc-500'}`}>
                Range {formatTimecode(Math.min(rangeStart, liveRangeEnd))} → {formatTimecode(Math.max(rangeStart, liveRangeEnd))}
              </span>
              {!hasValidRange && <span>— drag the timeline to extend it</span>}
              {hasValidRange && !draftPin && (
                <button
                  type="button"
                  title="Clear range"
                  onClick={() => onClearRangeStart?.()}
                  className="text-zinc-500 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 px-1">
            {draftPin ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-teal-950/40 border border-teal-500/40 font-mono text-[11px] font-semibold text-teal-400 shrink-0">
                {draftPin.drawingData ? <Pencil className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                {formatTimecode(draftPin.timestamp)}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-[11px] font-semibold text-amber-400 shrink-0">
                {formatTimecode(rangeStart ?? currentTimestamp)}
              </span>
            )}

            {draftPin ? (
              <button
                type="button"
                title="Cancel"
                onClick={() => {
                  onClearDraftPin?.();
                  setQuickText('');
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                title="Annotation tools"
                onClick={() => setShowQuickTools((v) => !v)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  showQuickTools || activeTool ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              ref={quickInputRef}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              onFocus={handleQuickComposerFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickComment();
                }
              }}
              placeholder={
                draftPin
                  ? draftPin.drawingData
                    ? 'Add feedback for your drawing...'
                    : 'Add feedback for this pinned point...'
                  : 'Leave your comment...'
              }
              className="flex-1 min-w-0 bg-transparent text-base sm:text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none py-1"
            />
            <button
              onClick={handleQuickComment}
              disabled={!quickText.trim() || isQuickSubmitting}
              title="Send"
              className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
