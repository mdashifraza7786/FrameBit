'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CornerDownRight,
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Clock,
} from 'lucide-react';
import { CommentData, UserProfile } from '@/lib/types';
import { formatTimecode } from '@/lib/timecode';

interface CommentSidebarProps {
  comments: CommentData[];
  currentTimestamp: number;
  currentVersionNumber: number;
  activeCommentId?: string | null;
  currentUser?: UserProfile | null;
  onSeekTo: (timestamp: number, commentId?: string) => void;
  onAddComment: (text: string, timestamp: number, parentCommentId?: string, authorName?: string) => Promise<void>;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
  allowGuestComments?: boolean;
}

export function CommentSidebar({
  comments,
  currentTimestamp,
  currentVersionNumber,
  activeCommentId,
  currentUser,
  onSeekTo,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onEditComment,
  allowGuestComments = false,
}: CommentSidebarProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [newCommentText, setNewCommentText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active comment when clicked on timeline
  useEffect(() => {
    if (activeCommentId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  const handleSubmitTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(newCommentText.trim(), currentTimestamp, undefined, guestName);
      setNewCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(replyText.trim(), currentTimestamp, parentCommentId, guestName);
      setReplyText('');
      setReplyingToId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    await onEditComment(commentId, editText.trim());
    setEditingId(null);
    setEditText('');
  };

  // Filter top-level comments for current version
  const topLevelComments = comments.filter((c) => !c.parentCommentId && c.versionNumber === currentVersionNumber);

  const filteredComments = topLevelComments.filter((c) => {
    if (filter === 'active') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const getReplies = (parentId: string) => {
    return comments.filter((c) => c.parentCommentId === parentId);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md transition-colors">
      {/* Sidebar Header & Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/60 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="font-semibold text-sm text-slate-800 dark:text-zinc-100">Comments</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 font-mono">
              {topLevelComments.length}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-zinc-950 p-1 rounded-xl border border-slate-300 dark:border-zinc-800">
            {(['all', 'active', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-teal-600 text-white dark:bg-teal-600/30 dark:text-teal-300 font-semibold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-slate-100 dark:divide-zinc-800/40">
        {filteredComments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-zinc-500 text-xs space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto opacity-30 text-slate-400 dark:text-zinc-400" />
            <p>No comments found in this view.</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-600">Pause playback and type below to leave feedback.</p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isActive = activeCommentId === comment._id;
            const replies = getReplies(comment._id);
            const authorName = comment.userId?.name || comment.guestName || 'Guest';
            const isAuthor = currentUser && comment.userId?._id === currentUser.id;

            return (
              <div
                key={comment._id}
                ref={isActive ? activeCardRef : undefined}
                className={`pt-3 first:pt-0 rounded-xl transition-all ${
                  isActive ? 'p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-500/40 shadow-lg shadow-teal-500/5' : ''
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Timestamp Jump Button */}
                    <button
                      onClick={() => onSeekTo(comment.timestamp, comment._id)}
                      className="px-2 py-0.5 rounded-md bg-teal-500/10 dark:bg-teal-600/20 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-mono text-[11px] font-semibold border border-teal-500/30 flex items-center gap-1 transition-colors"
                      title="Jump to video timestamp"
                    >
                      <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      {formatTimecode(comment.timestamp)}
                    </button>
                    <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate">{authorName}</span>
                  </div>

                  {/* Resolve / Reopen Toggle */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onResolveComment(comment._id, !comment.resolved)}
                      className={`p-1 rounded-md transition-colors ${
                        comment.resolved
                          ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                          : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                      }`}
                      title={comment.resolved ? 'Reopen comment' : 'Mark as resolved'}
                    >
                      {comment.resolved ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </button>

                    {/* Edit/Delete Actions */}
                    {isAuthor && (
                      <div className="flex items-center gap-0.5 text-slate-400 dark:text-zinc-500">
                        <button
                          onClick={() => {
                            setEditingId(comment._id);
                            setEditText(comment.text);
                          }}
                          className="p-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteComment(comment._id)}
                          className="p-1 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
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
                  <p className={`text-xs leading-relaxed ${comment.resolved ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {comment.text}
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
                    <input
                      type="text"
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(comment._id)}
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
                        className="px-3 py-1 text-[11px] bg-teal-600 hover:bg-teal-500 text-white rounded-lg disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* New Top-Level Comment Input Form */}
      <form onSubmit={handleSubmitTopLevel} className="p-3.5 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/70 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>At: </span>
            <span className="font-bold text-teal-700 dark:text-teal-300">{formatTimecode(currentTimestamp)}</span>
          </div>

          {!currentUser && allowGuestComments && (
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-28 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-lg px-2 py-0.5 text-[11px] text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
            />
          )}
        </div>

        <div className="relative">
          <textarea
            rows={2}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add comment at current timestamp..."
            className="w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 pr-10 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500/50 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitTopLevel(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newCommentText.trim()}
            className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40 transition-all shadow-md"
            title="Post Comment"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
