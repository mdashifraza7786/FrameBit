'use client';

import React, { useEffect, useState, use } from 'react';
import { Sparkles, Lock, ShieldCheck } from 'lucide-react';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { CommentSidebar } from '@/components/video/CommentSidebar';
import { StatusBadge } from '@/components/video/StatusBadge';
import { VersionSelector } from '@/components/video/VersionSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { VideoAssetData, VideoVersionData, CommentData, ProjectData, ReviewStatus } from '@/lib/types';

export default function GuestReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [asset, setAsset] = useState<VideoAssetData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [versions, setVersions] = useState<VideoVersionData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [shareLink, setShareLink] = useState<any>(null);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReviewData = async () => {
    try {
      const res = await fetch(`/api/review/${token}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Invalid or expired review link');
        return;
      }

      const data = await res.json();
      setAsset(data.asset);
      setProject(data.project);
      setVersions(data.versions || []);
      setComments(data.comments || []);
      setShareLink(data.shareLink);
      setCurrentVersionNumber(data.asset.currentVersionNumber || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load video review');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewData();
  }, [token]);

  // Real-time EventSource listener
  useEffect(() => {
    if (!asset?._id) return;
    const es = new EventSource('/api/realtime');

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'comment_added' && payload.data?.assetId === asset._id) {
          setComments((prev) => {
            if (prev.some((c) => c._id === payload.data._id)) return prev;
            return [...prev, payload.data];
          });
        } else if (payload.type === 'comment_updated' && payload.data?.assetId === asset._id) {
          setComments((prev) =>
            prev.map((c) => (c._id === payload.data._id ? { ...c, ...payload.data } : c))
          );
        } else if (payload.type === 'comment_deleted') {
          setComments((prev) => prev.filter((c) => c._id !== payload.data.commentId));
        } else if (payload.type === 'status_changed' && payload.data?.assetId === asset._id) {
          setAsset((prev) => (prev ? { ...prev, status: payload.data.status } : null));
        }
      } catch (e) {
        console.error('Error handling SSE event:', e);
      }
    };

    return () => {
      es.close();
    };
  }, [asset?._id]);

  const handleStatusChange = async (newStatus: ReviewStatus, notes?: string) => {
    if (!asset) return;
    try {
      const res = await fetch(`/api/videos/${asset._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, statusNotes: notes }),
      });
      if (res.ok) {
        setAsset((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error('Error updating review status:', err);
    }
  };

  const handleAddComment = async (
    text: string,
    timestamp: number,
    parentCommentId?: string,
    authorName?: string
  ) => {
    if (!asset) return;
    try {
      const res = await fetch(`/api/videos/${asset._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          timestamp,
          versionNumber: currentVersionNumber,
          parentCommentId,
          authorName: authorName || 'Guest Reviewer',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => {
          if (prev.some((c) => c._id === data.comment._id)) return prev;
          return [...prev, data.comment];
        });
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? { ...c, resolved } : c))
        );
      }
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium">Loading Review Workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <Lock className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Review Link Unavailable</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{error || 'This link has expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  const streamSrc = `/api/videos/${asset._id}/stream?version=${currentVersionNumber}&token=${token}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 flex flex-col selection:bg-teal-500/30 selection:text-teal-600 dark:selection:text-teal-300 transition-colors">
      {/* Guest Review Header */}
      <header className="h-16 border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-sm text-slate-800 dark:text-zinc-200">
              FrameBit<span className="text-teal-600 dark:text-teal-400">.Review</span>
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">Secure Client Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            status={asset.status}
            canChangeStatus={true}
            onStatusChange={handleStatusChange}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Review Area */}
      <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800/80">
          <div className="space-y-1 min-w-0">
            <div className="text-xs text-teal-600 dark:text-teal-400 font-semibold">{project?.name}</div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{asset.name}</h1>
              <VersionSelector
                versions={versions}
                currentVersionNumber={currentVersionNumber}
                onSelectVersion={(ver) => setCurrentVersionNumber(ver)}
                canUpload={false}
              />
            </div>
          </div>

          <div className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
            {shareLink?.expiresAt && (
              <span>Expires: {new Date(shareLink.expiresAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Layout: Video + Comments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <VideoPlayer
              src={streamSrc}
              comments={comments.filter((c) => c.versionNumber === currentVersionNumber)}
              activeCommentId={activeCommentId}
              onSelectComment={(id, t) => {
                setActiveCommentId(id);
                setSeekToTime(t);
              }}
              onAddCommentAtTime={(t) => setSeekToTime(t)}
              seekToTime={seekToTime}
            />
          </div>

          <div className="h-[680px]">
            <CommentSidebar
              comments={comments}
              currentTimestamp={seekToTime || 0}
              currentVersionNumber={currentVersionNumber}
              activeCommentId={activeCommentId}
              onSeekTo={(t, id) => {
                setSeekToTime(t);
                if (id) setActiveCommentId(id);
              }}
              onAddComment={handleAddComment}
              onResolveComment={handleResolveComment}
              onDeleteComment={async () => {}}
              onEditComment={async () => {}}
              allowGuestComments={shareLink?.allowComments ?? true}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
