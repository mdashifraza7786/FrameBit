'use client';

import React, { useEffect, useState, use, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronRight,
  Share2,
  Film,
  Sparkles,
  ArrowLeft,
  Info,
  Calendar,
  Layers,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { CommentSidebar } from '@/components/video/CommentSidebar';
import { StatusBadge } from '@/components/video/StatusBadge';
import { VersionSelector } from '@/components/video/VersionSelector';
import { UploadModal } from '@/components/video/UploadModal';
import { ShareModal } from '@/components/video/ShareModal';
import { VersionComparison } from '@/components/video/VersionComparison';
import { VideoAssetData, VideoVersionData, CommentData, ProjectData, ReviewStatus } from '@/lib/types';

function VideoReviewContent({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id: projectId, videoId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [asset, setAsset] = useState<VideoAssetData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [versions, setVersions] = useState<VideoVersionData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>('reviewer');
  const [loading, setLoading] = useState(true);

  const [uploadVersionModalOpen, setUploadVersionModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number; timestamp: number; drawingData?: string } | null>(null);
  const [annotationFilter, setAnnotationFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(true);

  const fetchVideoDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      if (res.ok) {
        const data = await res.json();
        setAsset(data.asset);
        setProject(data.project);
        setVersions(data.versions || []);
        setComments(data.comments || []);
        setUserRole(data.userRole || 'reviewer');

        // Automatically default to the highest / latest available version number
        const versionList: VideoVersionData[] = data.versions || [];
        const latestVer =
          versionList.length > 0
            ? Math.max(...versionList.map((v) => v.versionNumber))
            : data.asset?.currentVersionNumber || 1;

        const vParam = searchParams.get('v');
        const initialVer = vParam ? parseInt(vParam, 10) : latestVer;
        setCurrentVersionNumber(initialVer);

        // Check timestamp in url (?t=12.5)
        const tParam = searchParams.get('t');
        if (tParam) {
          setSeekToTime(parseFloat(tParam));
        }
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      console.error('Error fetching video details:', err);
    } finally {
      setLoading(false);
    }
  }, [videoId, projectId, router, searchParams]);

  useEffect(() => {
    fetchVideoDetails();
  }, [fetchVideoDetails]);

  // Setup Real-time SSE listener for this video asset
  useEffect(() => {
    const eventSource = new EventSource(`/api/realtime?channel=asset:${videoId}`);

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'comment:created') {
          setComments((prev) => {
            const exists = prev.some((c) => c._id === payload.data._id);
            if (exists) return prev;
            return [...prev, payload.data];
          });
        } else if (payload.type === 'comment:updated' || payload.type === 'comment:resolved') {
          setComments((prev) =>
            prev.map((c) => (c._id === payload.data._id ? payload.data : c))
          );
        } else if (payload.type === 'comment:deleted') {
          setComments((prev) => prev.filter((c) => c._id !== payload.data.commentId && c.parentCommentId !== payload.data.commentId));
        } else if (payload.type === 'status:changed') {
          setAsset((prev) => (prev ? { ...prev, status: payload.data.status } : null));
        } else if (payload.type === 'version:created') {
          if (payload.data?.version?.versionNumber) {
            setCurrentVersionNumber(payload.data.version.versionNumber);
          }
          fetchVideoDetails();
        }
      } catch {
        // SSE heartbeat
      }
    };

    return () => eventSource.close();
  }, [videoId, fetchVideoDetails]);

  // Handlers for comments
  const handleAddComment = async (
    text: string,
    timestamp: number,
    parentCommentId?: string,
    authorName?: string,
    x?: number,
    y?: number,
    drawingData?: string,
    timestampEnd?: number
  ) => {
    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          timestamp,
          timestampEnd,
          versionNumber: currentVersionNumber,
          parentCommentId,
          authorName,
          x,
          y,
          drawingData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => {
          const exists = prev.some((c) => c._id === data.comment._id);
          if (exists) return prev;
          return [...prev, data.comment];
        });
      }
    } catch (err) {
      console.error('Error adding comment:', err);
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
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? data.comment : c))
        );
      }
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c._id !== commentId && c.parentCommentId !== commentId));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleEditComment = async (commentId: string, text: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? data.comment : c))
        );
      }
    } catch (err) {
      console.error('Error editing comment:', err);
    }
  };

  const handleStatusChange = async (newStatus: ReviewStatus) => {
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAsset(data.asset);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleSelectComment = (commentId: string, timestamp: number) => {
    setActiveCommentId(commentId);
    setSeekToTime(timestamp);
  };

  const handleAddCommentAtTime = (timestamp: number) => {
    setSeekToTime(timestamp);
  };

  const handleDeleteVersion = async (versionNumber: number) => {
    try {
      const res = await fetch(`/api/videos/${videoId}?version=${versionNumber}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deletedAsset) {
          router.push(`/projects/${projectId}`);
        } else {
          fetchVideoDetails();
        }
      }
    } catch (err) {
      console.error('Error deleting version:', err);
    }
  };

  const handleDeleteAsset = async () => {
    if (!confirm(`Are you sure you want to delete "${asset?.name}" and all its versions from Google Drive?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      console.error('Error deleting asset:', err);
    }
  };

  const canUpload = userRole === 'owner' || userRole === 'editor';
  const canChangeStatus = userRole === 'owner' || userRole === 'reviewer';
  const canShare = userRole === 'owner' || userRole === 'reviewer';
  const streamSrc = `/api/videos/${videoId}/stream?version=${currentVersionNumber}`;
  const displayTitle =
    asset && currentVersionNumber >= 2 ? `${asset.name} - v${currentVersionNumber}` : asset?.name;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!asset) return null;

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-5 animate-in fade-in duration-200">
        {/* Top Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          {/* Breadcrumbs & Title */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">
              <Link href={`/projects/${projectId}`} className="hover:text-teal-600 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{project?.name || 'Project'}</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-800 dark:text-zinc-300 font-semibold truncate">{displayTitle}</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {displayTitle}
              </h1>

              {/* Version Switcher */}
              <VersionSelector
                versions={versions}
                currentVersionNumber={currentVersionNumber}
                onSelectVersion={(ver) => setCurrentVersionNumber(ver)}
                onUploadNewVersion={() => setUploadVersionModalOpen(true)}
                onDeleteVersion={handleDeleteVersion}
                onDeleteAsset={handleDeleteAsset}
                canManage={canUpload}
              />
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Compare Versions Button (only if 2+ versions) */}
            {versions.length >= 2 && (
              <button
                onClick={() => setCompareModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700/80 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-2 transition-all shadow-sm"
              >
                <SlidersHorizontal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Compare</span>
              </button>
            )}

            {/* Review Status & Actions (Only for Owner & Reviewer) */}
            <StatusBadge
              status={asset.status}
              canChangeStatus={canChangeStatus}
              onStatusChange={handleStatusChange}
            />

            {/* Share Button (Only for Owner & Reviewer) */}
            {canShare && (
              <button
                onClick={() => setShareModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700/80 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-2 transition-all shadow-sm"
              >
                <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Share</span>
              </button>
            )}
          </div>
        </div>

        {/* Workspace Layout: Left Player + Right Comments (collapsible sidebar) */}
        <div className="flex gap-6 items-start relative">
          {/* Main Video Review Player */}
          <div className={`flex-1 min-w-0 space-y-4 transition-all duration-300`}>
            <VideoPlayer
              src={streamSrc}
              comments={comments.filter((c) => c.versionNumber === currentVersionNumber)}
              activeCommentId={activeCommentId}
              annotationFilter={annotationFilter}
              onFilterChange={setAnnotationFilter}
              onSelectComment={handleSelectComment}
              onAddCommentAtTime={handleAddCommentAtTime}
              onAddComment={handleAddComment}
              seekToTime={seekToTime}
              draftPin={draftPin}
              onDraftPinChange={setDraftPin}
              currentUser={user}
              onResolveComment={handleResolveComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>

          {/* Collapsible Comment Sidebar */}
          <div className={`relative flex-shrink-0 transition-all duration-300 ease-in-out ${commentSidebarOpen ? 'w-80 xl:w-96' : 'w-0'}`}>
            {/* Toggle button */}
            <button
              onClick={() => setCommentSidebarOpen(!commentSidebarOpen)}
              title={commentSidebarOpen ? 'Collapse comments' : 'Expand comments'}
              className={`absolute top-0 z-20 flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-md text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 hover:border-teal-500/40 transition-all ${commentSidebarOpen ? '-left-3.5' : '-left-8'}`}
            >
              {commentSidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>

            {/* Sidebar content */}
            {commentSidebarOpen && (
              <div className="h-[420px] lg:h-[450px] xl:h-[480px] max-h-[500px] flex flex-col min-w-0 w-full">
                <CommentSidebar
                  comments={comments}
                  currentTimestamp={seekToTime || 0}
                  currentVersionNumber={currentVersionNumber}
                  activeCommentId={activeCommentId}
                  currentUser={user}
                  filter={annotationFilter}
                  onFilterChange={setAnnotationFilter}
                  draftPin={draftPin}
                  onClearDraftPin={() => setDraftPin(null)}
                  projectId={projectId}
                  onSeekTo={(t, id) => {
                    setSeekToTime(t);
                    if (id) setActiveCommentId(id);
                  }}
                  onAddComment={handleAddComment}
                  onResolveComment={handleResolveComment}
                  onDeleteComment={handleDeleteComment}
                  onEditComment={handleEditComment}
                />
              </div>
            )}

            {/* Comment count badge when collapsed */}
            {!commentSidebarOpen && (
              <div className="absolute -left-12 top-10 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 bg-teal-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
                  <MessageSquare className="w-3 h-3" />
                  {comments.filter(c => c.versionNumber === currentVersionNumber && !c.parentCommentId).length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload New Version Modal */}
        <UploadModal
          isOpen={uploadVersionModalOpen}
          onClose={() => setUploadVersionModalOpen(false)}
          projectId={projectId}
          assetId={videoId}
          existingAssetName={asset.name}
          onSuccess={fetchVideoDetails}
        />

        {/* Share Link Modal */}
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          videoId={videoId}
          videoTitle={asset.name}
        />

        {/* Version Comparison Modal */}
        {compareModalOpen && versions.length >= 2 && (
          <VersionComparison
            versions={versions}
            videoId={videoId}
            onClose={() => setCompareModalOpen(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function VideoReviewPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      }
    >
      <VideoReviewContent params={params} />
    </Suspense>
  );
}

