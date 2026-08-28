'use client';

import React, { useEffect, useState, useRef, use, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronRight,
  Share2,
  Home,
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';
import { VideoPlayer, type ActiveTool, type VideoPlayerHandle } from '@/components/video/VideoPlayer';
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
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const [asset, setAsset] = useState<VideoAssetData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [versions, setVersions] = useState<VideoVersionData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>('reviewer');
  const [ownerDriveConnected, setOwnerDriveConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  const [uploadVersionModalOpen, setUploadVersionModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [draftPin, setDraftPin] = useState<{ x: number; y: number; timestamp: number; drawingData?: string } | null>(null);
  const [annotationFilter, setAnnotationFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(true);

  // Shared annotation tool state — driven by either the video's own toolbar or the comment composer's pen icon
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [drawColor, setDrawColor] = useState('#06b6d4');
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(0.8);
  const [livePlayheadTime, setLivePlayheadTime] = useState(0);
  // Anchors the start of a possible time-range comment — set the moment composing begins (pin/drawing dropped,
  // or the plain comment box is focused), independent of whether a pin/drawing exists at all.
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  // Mirrors the video's own range-end drag value, purely for the sidebar's display + submit logic.
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  // Pause playback and read the exact frozen time synchronously — called when the comment composer is focused
  const handleRequestPause = useCallback(() => {
    videoPlayerRef.current?.pause();
    const t = videoPlayerRef.current?.getCurrentTime() ?? 0;
    setLivePlayheadTime(t);
    setRangeStart(t);
  }, []);

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
        setOwnerDriveConnected(data.ownerDriveConnected !== false);

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
    setActiveCommentId((prev) => (prev === commentId ? null : commentId));
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

  const canUpload = ownerDriveConnected && (userRole === 'owner' || userRole === 'editor');
  const canChangeStatus = userRole === 'owner' || userRole === 'reviewer';
  const canShare = userRole === 'owner' || userRole === 'reviewer';
  const streamSrc = `/api/videos/${videoId}/stream?version=${currentVersionNumber}`;
  const displayTitle =
    asset && currentVersionNumber >= 2 ? `${asset.name} - v${currentVersionNumber}` : asset?.name;

  if (loading || authLoading || !user) {
    return (
      <div className="dark fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="dark fixed inset-0 h-[100dvh] max-h-[100dvh] z-40 bg-black text-zinc-100 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Bar: Breadcrumb + Actions */}
      <header className="h-12 sm:h-14 shrink-0 flex items-center justify-between gap-1.5 sm:gap-4 px-2 sm:px-4 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm z-30">
        {/* Left: Home + Breadcrumb + Version */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <Link
            href="/dashboard"
            title="Back to Dashboard"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-teal-400 hover:bg-zinc-900 transition-colors shrink-0"
          >
            <Home className="w-4 h-4" />
          </Link>

          <div className="w-px h-4 sm:h-5 bg-zinc-800 shrink-0" />

          <Link
            href={`/projects/${projectId}`}
            className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{project?.name || 'Project'}</span>
          </Link>
          <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-zinc-700 shrink-0" />

          <span className="text-xs sm:text-sm font-semibold text-zinc-200 truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[220px] md:max-w-[340px]">
            {displayTitle}
          </span>

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

        {/* Right: Compare / Status / Share / Collapse toggle */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {versions.length >= 2 && (
            <button
              onClick={() => setCompareModalOpen(true)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-all shrink-0"
              title="Compare versions"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden md:inline">Compare</span>
            </button>
          )}

          <StatusBadge status={asset.status} canChangeStatus={canChangeStatus} onStatusChange={handleStatusChange} />

          {canShare && (
            <button
              onClick={() => setShareModalOpen(true)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all shrink-0"
              title="Share video"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <button
            onClick={() => setCommentSidebarOpen((v) => !v)}
            title={commentSidebarOpen ? 'Hide comments' : 'Show comments'}
            className="hidden md:flex p-1.5 rounded-lg text-zinc-400 hover:text-teal-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors relative shrink-0"
          >
            {commentSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            {!commentSidebarOpen && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-teal-600 text-white text-[9px] font-bold">
                {comments.filter((c) => c.versionNumber === currentVersionNumber && !c.parentCommentId).length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Workspace: Video Stage + Comments Panel — stacked on mobile with pinned video, side-by-side on md+ screens */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Video Stage: Fixed height ratio on mobile so it never jumps or gets pushed off-screen when typing comments */}
        <div className="w-full md:flex-1 md:min-w-0 md:min-h-0 h-[38vh] sm:h-[44vh] md:h-full shrink-0 md:shrink flex flex-col bg-black overflow-hidden relative z-10">
          {!ownerDriveConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Lock className="w-5 h-5 text-zinc-500" />
              </div>
              {userRole === 'owner' ? (
                <>
                  <p className="text-sm font-semibold text-zinc-200">Google Drive not connected</p>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Connect your Google Drive to view or upload videos — it&apos;s where this project&apos;s videos are stored.
                  </p>
                  <Link
                    href="/settings"
                    className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                  >
                    Connect Google Drive
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-zinc-200">Video unavailable</p>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Contact the project owner ({project?.owner?.name || 'the owner'}) to connect their Google Drive
                    account to access this project.
                  </p>
                </>
              )}
            </div>
          ) : (
          <VideoPlayer
            ref={videoPlayerRef}
            theaterMode
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
            onDraftPinChange={(pin) => {
              setDraftPin(pin);
              if (pin) setRangeStart(pin.timestamp);
            }}
            currentUser={user}
            onResolveComment={handleResolveComment}
            onDeleteComment={handleDeleteComment}
            activeTool={activeTool}
            onActiveToolChange={setActiveTool}
            drawColor={drawColor}
            onDrawColorChange={setDrawColor}
            drawStrokeWidth={drawStrokeWidth}
            onDrawStrokeWidthChange={setDrawStrokeWidth}
            onTimeUpdate={setLivePlayheadTime}
            onPlaybackPause={(t) => {
              // A pin/drawing already anchors its own range start — don't let an unrelated pause drift it.
              if (!draftPin) setRangeStart(t);
            }}
            rangeStart={rangeStart}
            onRangeEndChange={setRangeEnd}
          />
          )}
        </div>

        {/* Comments Panel */}
        {commentSidebarOpen && (
          <div className="flex-1 md:flex-none min-h-0 w-full md:w-[360px] lg:w-[380px] xl:w-[420px] border-t md:border-t-0 md:border-l border-zinc-800/80 flex flex-col overflow-hidden bg-zinc-950 relative z-20">
            <CommentSidebar
              theaterMode
              comments={comments}
              currentTimestamp={livePlayheadTime}
              currentVersionNumber={currentVersionNumber}
              activeCommentId={activeCommentId}
              currentUser={user}
              filter={annotationFilter}
              onFilterChange={setAnnotationFilter}
              draftPin={draftPin}
              onClearDraftPin={() => {
                setDraftPin(null);
                setRangeStart(null);
                setRangeEnd(null);
              }}
              projectId={projectId}
              onSeekTo={(t, id) => {
                setSeekToTime(t);
                if (id) setActiveCommentId((prev) => (prev === id ? null : id));
              }}
              onAddComment={handleAddComment}
              onResolveComment={handleResolveComment}
              onDeleteComment={handleDeleteComment}
              onEditComment={handleEditComment}
              activeTool={activeTool}
              onActiveToolChange={setActiveTool}
              drawColor={drawColor}
              onDrawColorChange={setDrawColor}
              onRequestPause={handleRequestPause}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onClearRangeStart={() => {
                setRangeStart(null);
                setRangeEnd(null);
              }}
            />
          </div>
        )}
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
        <VersionComparison versions={versions} videoId={videoId} onClose={() => setCompareModalOpen(false)} />
      )}
    </div>
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
        <div className="min-h-screen bg-[var(--background)] dark:bg-[#090a0f] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 dark:border-teal-500/30 dark:border-t-teal-500 rounded-full animate-spin" />
        </div>
      }
    >
      <VideoReviewContent params={params} />
    </Suspense>
  );
}

