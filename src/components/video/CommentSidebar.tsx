'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  CheckCircle2,
  Check,
  RotateCcw,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  Pencil,
  Send,
} from 'lucide-react';
import { CommentData, UserProfile } from '@/lib/types';
import { formatTimecode } from '@/lib/timecode';
import { MentionTextarea, MentionMember, renderWithMentions } from '@/components/common/MentionTextarea';

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
    drawingData?: string
  ) => Promise<void>;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
  allowGuestComments?: boolean;
  draftPin?: { x: number; y: number; timestamp: number; drawingData?: string } | null;
  onClearDraftPin?: () => void;
  projectId?: string;
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
  projectId,
}: CommentSidebarProps) {
  const [internalFilter, setInternalFilter] = useState<'all' | 'active' | 'resolved'>('all');
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

  const activeCardRef = useRef<HTMLDivElement>(null);

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

  // Filter top-level comments
  const topLevelComments = comments.filter((c) => !c.parentCommentId);

  const filteredComments = topLevelComments.filter((c) => {
    if (filter === 'active') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header & Filter Tabs */}
      <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
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
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Comment Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {filteredComments.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 text-slate-400 dark:text-zinc-600">
            <MessageSquare className="w-7 h-7 mb-2 stroke-1" />
            <p className="text-xs font-medium">No comments found in this view.</p>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
              Select <span className="text-teal-500 font-semibold">Pin</span> or{' '}
              <span className="text-cyan-500 font-semibold">Draw</span> tool on video to add precise feedback.
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const replies = comments.filter((c) => c.parentCommentId === comment._id);
            const isActive = activeCommentId === comment._id;
            const authorName = comment.userId?.name || comment.guestName || 'Reviewer';
            const isAuthor =
              currentUser &&
              (comment.userId?._id === currentUser.id ||
                (comment.userId as any) === currentUser.id ||
                (comment.userId as any)?._id === currentUser.id);

            return (
              <div
                key={comment._id}
                ref={isActive ? activeCardRef : null}
                className={`p-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                    : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    {/* Timestamp Jump Button — shows range if available */}
                    <button
                      onClick={() => onSeekTo(comment.timestamp, comment._id)}
                      className="px-1.5 py-0.5 rounded-md bg-teal-500/10 dark:bg-teal-600/20 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-mono text-[10px] font-semibold border border-teal-500/30 flex items-center gap-1 transition-colors shrink-0"
                      title="Jump to video timestamp"
                    >
                      <Clock className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                      {comment.timestampEnd
                        ? `${formatTimecode(comment.timestamp)} → ${formatTimecode(comment.timestampEnd)}`
                        : formatTimecode(comment.timestamp)}
                    </button>
                    <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate">
                      {authorName}
                    </span>

                    {comment.drawingData ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[9px] font-mono flex items-center gap-0.5 border border-purple-500/30 shrink-0">
                        <Pencil className="w-2 h-2" />
                        <span>Drawing</span>
                      </span>
                    ) : comment.x !== undefined && comment.y !== undefined ? (
                      <span className="px-1.5 py-0.2 rounded bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[9px] font-mono flex items-center gap-0.5 border border-teal-500/30 shrink-0">
                        <MapPin className="w-2 h-2" />
                        <span>Pin ({Math.round(comment.x)}%, {Math.round(comment.y)}%)</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Actions: Resolve & Edit/Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Resolve / Reopen Button */}
                    <button
                      onClick={() => onResolveComment(comment._id, !comment.resolved)}
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
                          onClick={() => {
                            setEditingId(comment._id);
                            setEditText(comment.text);
                          }}
                          className="p-0.5 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => onDeleteComment(comment._id)}
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
                  <div className="space-y-2 my-2">
                    <textarea
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl p-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-teal-500"
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
                        className="px-2.5 py-1 text-[11px] bg-teal-600 hover:bg-teal-500 text-white rounded-lg"
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
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <button
                    onClick={() => setReplyingToId(replyingToId === comment._id ? null : comment._id)}
                    className="text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 font-medium transition-colors"
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
                          <p className="text-slate-600 dark:text-zinc-300">{reply.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Reply Input */}
                {replyingToId === comment._id && (
                  <div className="mt-2.5 pl-3 border-l border-teal-500/40 space-y-2">
                    <MentionTextarea
                      value={replyText}
                      onChange={setReplyText}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitReply(comment._id)}
                      placeholder="Reply... type @ to mention someone"
                      rows={2}
                      members={members}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500"
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
                        className="px-3 py-1 text-[11px] bg-teal-600 hover:bg-teal-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
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
    </div>
  );
}
