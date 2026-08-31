'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Send,
  X,
  Crosshair,
  CheckCircle2,
  Pencil,
  RotateCcw,
  MessageSquare,
  Square,
  Circle as CircleIcon,
  ArrowUpRight,
  Sparkles,
  Clock,
  Trash2,
  Check,
} from 'lucide-react';
import { formatSMPTETimecode, formatTimecode, formatDuration } from '@/lib/timecode';
import { CommentData, UserProfile } from '@/lib/types';

interface Point {
  x: number;
  y: number;
}

export interface DraftPinData {
  x: number;
  y: number;
  timestamp: number;
  drawingData?: string;
}

interface VideoPlayerProps {
  src: string;
  comments: CommentData[];
  activeCommentId?: string | null;
  annotationFilter?: 'all' | 'active' | 'resolved';
  onFilterChange?: (filter: 'all' | 'active' | 'resolved') => void;
  onSelectComment?: (commentId: string, timestamp: number) => void;
  onAddCommentAtTime?: (timestamp: number, frameNumber: number) => void;
  onAddComment?: (
    text: string,
    timestamp: number,
    parentCommentId?: string,
    authorName?: string,
    x?: number,
    y?: number,
    drawingData?: string,
    timestampEnd?: number
  ) => Promise<void>;
  seekToTime?: number | null;
  allowGuestComments?: boolean;
  draftPin?: DraftPinData | null;
  onDraftPinChange?: (pin: DraftPinData | null) => void;
  currentUser?: UserProfile | null;
  onResolveComment?: (commentId: string, resolved: boolean) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  /** Full-bleed cinema layout: fills parent height, no card border/rounding, no fixed aspect ratio. */
  theaterMode?: boolean;
  /** Controlled annotation tool — lets an external composer (e.g. the comment sidebar) drive the same tool state. */
  activeTool?: ActiveTool;
  onActiveToolChange?: (tool: ActiveTool) => void;
  drawColor?: string;
  onDrawColorChange?: (color: string) => void;
  drawStrokeWidth?: number;
  onDrawStrokeWidthChange?: (width: number) => void;
  /** Reports the live playhead time (native timeupdate cadence, not per-frame). */
  onTimeUpdate?: (time: number) => void;
  /** Fires every time playback actually pauses (any cause), with the exact time it paused at. */
  onPlaybackPause?: (time: number) => void;
  /** Controlled time-range mode — lets an external composer (e.g. the comment sidebar) start/stop it. */
  isRangeMode?: boolean;
  onRangeModeChange?: (on: boolean) => void;
  /** Theater mode: anchors the start of a possible time-range comment, independent of any pin/drawing. */
  rangeStart?: number | null;
  /** Mirrors the range-end drag value for an external composer's own display (e.g. the comment sidebar). */
  onRangeEndChange?: (time: number | null) => void;
}

export interface VideoPlayerHandle {
  /** Pauses playback immediately (synchronous — safe to read currentTime right after). */
  pause: () => void;
  /** Current playhead time, read synchronously straight off the <video> element. */
  getCurrentTime: () => number;
}

const DRAW_COLORS = [
  { name: 'Cyan', hex: '#06b6d4', ring: 'ring-cyan-500' },
  { name: 'Emerald', hex: '#10b981', ring: 'ring-emerald-500' },
  { name: 'Amber', hex: '#f59e0b', ring: 'ring-amber-500' },
  { name: 'Rose', hex: '#f43f5e', ring: 'ring-rose-500' },
  { name: 'Purple', hex: '#a855f7', ring: 'ring-purple-500' },
];

// One consistent marker color per commenter (not per comment type) — same account always gets the same badge color.
const AUTHOR_MARKER_COLORS = [
  'bg-teal-600 border-teal-300',
  'bg-purple-600 border-purple-300',
  'bg-amber-600 border-amber-300',
  'bg-rose-600 border-rose-300',
  'bg-cyan-600 border-cyan-300',
  'bg-emerald-600 border-emerald-300',
  'bg-indigo-600 border-indigo-300',
  'bg-pink-600 border-pink-300',
];

function getAuthorMarkerColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AUTHOR_MARKER_COLORS[hash % AUTHOR_MARKER_COLORS.length];
}

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

// Calculate safe clamped on-screen box positioning within the video viewport bounds (never overflowing screen)
const getClampedPopoverStyle = (x: number, y: number) => {
  // Clamp X between 20% and 80% to ensure a 280-320px box never crosses left or right edges
  const clampedX = Math.max(20, Math.min(80, x));

  // Flip vertically: if pin is in lower half (y > 55%), put the box ABOVE the pin; otherwise BELOW the pin
  const isLowerHalf = y > 55;
  const clampedY = isLowerHalf ? Math.max(8, y - 3) : Math.min(90, y + 3);
  const transform = isLowerHalf ? 'translate(-50%, -100%)' : 'translate(-50%, 0%)';

  return {
    left: `${clampedX}%`,
    top: `${clampedY}%`,
    transform,
  };
};

export type ActiveTool = 'pin' | 'draw' | 'rectangle' | 'circle' | 'arrow' | null;

// Helper to generate SVG path for various shapes
const generateShapeSvgPath = (tool: ActiveTool, points: Point[]): string => {
  if (points.length === 0) return '';
  if (tool === 'draw') {
    if (points.length < 2) return '';
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += ` Q ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}, ${xc.toFixed(2)} ${yc.toFixed(2)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    return d;
  }

  if (points.length < 2) return '';
  const start = points[0];
  const end = points[points.length - 1];

  if (tool === 'rectangle') {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return `M ${minX.toFixed(2)} ${minY.toFixed(2)} H ${maxX.toFixed(2)} V ${maxY.toFixed(2)} H ${minX.toFixed(2)} Z`;
  }

  if (tool === 'circle') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.max(0.5, Math.abs(end.x - start.x) / 2);
    const ry = Math.max(0.5, Math.abs(end.y - start.y) / 2);
    return `M ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} a ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0 a ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0`;
  }

  if (tool === 'arrow') {
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const headLen = 3.5; // % of viewBox
    const hx1 = x2 - headLen * Math.cos(angle - 0.45);
    const hy1 = y2 - headLen * Math.sin(angle - 0.45);
    const hx2 = x2 - headLen * Math.cos(angle + 0.45);
    const hy2 = y2 - headLen * Math.sin(angle + 0.45);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} M ${hx1.toFixed(2)} ${hy1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} L ${hx2.toFixed(2)} ${hy2.toFixed(2)}`;
  }

  return '';
};

// Helper to reliably parse drawing JSON or SVG path string
const parseDrawingData = (data: any): { path: string; color: string; width: number; shape?: string } | null => {
  if (!data) return null;
  if (typeof data === 'object') {
    if (data.path && typeof data.path === 'string') {
      return {
        path: data.path,
        color: data.color || '#06b6d4',
        width: typeof data.width === 'number' ? data.width : 0.8,
        shape: data.shape,
      };
    }
    return null;
  }
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && parsed.path) {
          return {
            path: parsed.path,
            color: parsed.color || '#06b6d4',
            width: typeof parsed.width === 'number' ? parsed.width : 0.8,
            shape: parsed.shape,
          };
        }
      } catch {
        // Fallback
      }
    } else if (trimmed.startsWith('M') || trimmed.startsWith('m')) {
      return {
        path: trimmed,
        color: '#06b6d4',
        width: 0.8,
      };
    }
  }
  return null;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer({
  src,
  comments,
  activeCommentId,
  annotationFilter,
  onFilterChange,
  onSelectComment,
  onAddCommentAtTime,
  onAddComment,
  seekToTime,
  allowGuestComments = false,
  draftPin: externalDraftPin,
  onDraftPinChange,
  currentUser,
  onResolveComment,
  onDeleteComment,
  theaterMode = false,
  activeTool: externalActiveTool,
  onActiveToolChange,
  drawColor: externalDrawColor,
  onDrawColorChange,
  drawStrokeWidth: externalDrawStrokeWidth,
  onDrawStrokeWidthChange,
  onTimeUpdate,
  onPlaybackPause,
  isRangeMode: externalRangeMode,
  onRangeModeChange,
  rangeStart = null,
  onRangeEndChange,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const isDraggingRangeRef = useRef(false);

  // Range end — dragged on its own dedicated mini-track (a few px below the main timeline), completely
  // separate from scrubbing/seeking the video itself, so setting a range never moves the playhead.
  const [dragRangeEnd, setDragRangeEnd] = useState<number | null>(null);
  const onRangeEndChangeRef = useRef(onRangeEndChange);
  useEffect(() => {
    onRangeEndChangeRef.current = onRangeEndChange;
  });
  useEffect(() => {
    setDragRangeEnd(rangeStart);
    onRangeEndChangeRef.current?.(rangeStart);
  }, [rangeStart]);

  // The actual on-screen rect of the video's pixels within the (possibly differently-shaped) viewport —
  // object-contain letterboxes/pillarboxes a video whose aspect ratio doesn't match the viewport's, so pins,
  // drawings and click coordinates must be measured against this rect, not the full viewport.
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null
  );

  const recalcVideoRect = useCallback(() => {
    const vp = viewportRef.current;
    const vid = videoRef.current;
    if (!vp || !vid || !vid.videoWidth || !vid.videoHeight) return;
    const cw = vp.clientWidth;
    const ch = vp.clientHeight;
    if (!cw || !ch) return;
    const videoAspect = vid.videoWidth / vid.videoHeight;
    const containerAspect = cw / ch;
    let width: number, height: number;
    if (videoAspect > containerAspect) {
      width = cw;
      height = cw / videoAspect;
    } else {
      height = ch;
      width = ch * videoAspect;
    }
    setVideoRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
  }, []);

  // Recompute whenever the viewport itself resizes (window resize, sidebar toggle, fullscreen, theater layout)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => recalcVideoRect());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [recalcVideoRect]);

  const [internalFilter, setInternalFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const currentFilter = annotationFilter || internalFilter;

  const handleFilterChange = (f: 'all' | 'active' | 'resolved') => {
    setInternalFilter(f);
    if (onFilterChange) onFilterChange(f);
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  // Theater mode defaults to a plain MM:SS readout (no frame count) — still toggleable by clicking the timecode.
  const [showSMPTE, setShowSMPTE] = useState(!theaterMode);
  const [fps] = useState(30);

  // Active Tool Mode: null (Normal Play Mode) | 'pin' | 'draw' | 'rectangle' | 'circle' | 'arrow'
  // Controlled/uncontrolled: falls back to local state unless an external composer (comment sidebar) drives it.
  const [internalActiveTool, setInternalActiveTool] = useState<ActiveTool>(null);
  const activeTool = externalActiveTool !== undefined ? externalActiveTool : internalActiveTool;
  // Mirrors `activeTool` for synchronous reads inside setActiveTool — resolving the updater against
  // this ref (rather than inside the setInternalActiveTool callback) avoids calling onActiveToolChange
  // from within a React state-updater function, which React rejects as a cross-component render-time update.
  const activeToolRef = useRef<ActiveTool>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  const setActiveTool = useCallback(
    (updater: ActiveTool | ((prev: ActiveTool) => ActiveTool)) => {
      const next = typeof updater === 'function' ? (updater as (p: ActiveTool) => ActiveTool)(activeToolRef.current) : updater;
      activeToolRef.current = next;
      setInternalActiveTool(next);
      onActiveToolChange?.(next);
    },
    [onActiveToolChange]
  );

  const [internalDrawColor, setInternalDrawColor] = useState<string>('#06b6d4');
  const drawColor = externalDrawColor !== undefined ? externalDrawColor : internalDrawColor;
  const setDrawColor = useCallback(
    (color: string) => {
      setInternalDrawColor(color);
      onDrawColorChange?.(color);
    },
    [onDrawColorChange]
  );

  const [internalDrawStrokeWidth, setInternalDrawStrokeWidth] = useState<number>(0.8);
  const drawStrokeWidth = externalDrawStrokeWidth !== undefined ? externalDrawStrokeWidth : internalDrawStrokeWidth;
  const setDrawStrokeWidth = useCallback(
    (width: number) => {
      setInternalDrawStrokeWidth(width);
      onDrawStrokeWidthChange?.(width);
    },
    [onDrawStrokeWidthChange]
  );

  const [showAnnotationTools, setShowAnnotationTools] = useState(false);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Range comment state — Start = pin timestamp, End = live playhead position while range mode is on.
  // Controlled/uncontrolled: an external composer (comment sidebar) can start/stop it too.
  const [internalRangeMode, setInternalRangeMode] = useState(false);
  const isRangeMode = externalRangeMode !== undefined ? externalRangeMode : internalRangeMode;
  const setIsRangeMode = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setInternalRangeMode((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: boolean) => boolean)(prev) : updater;
        onRangeModeChange?.(next);
        return next;
      });
    },
    [onRangeModeChange]
  );

  // Local draft pin state fallback if not passed externally
  const [internalDraftPin, setInternalDraftPin] = useState<DraftPinData | null>(null);
  const activeDraftPin = externalDraftPin !== undefined ? externalDraftPin : internalDraftPin;

  // Floating Composer local form state
  const [composerText, setComposerText] = useState('');
  const [composerGuestName, setComposerGuestName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setDraftPin = useCallback(
    (pin: DraftPinData | null) => {
      setInternalDraftPin(pin);
      if (onDraftPinChange) {
        onDraftPinChange(pin);
      }
      setComposerText('');
      setIsRangeMode(false);
    },
    [onDraftPinChange, setIsRangeMode]
  );

  // Dismissed active callout tracking
  const [dismissedCalloutId, setDismissedCalloutId] = useState<string | null>(null);

  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isRecoveringRef = useRef(false);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerBuffering = useCallback((delay = 200) => {
    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    bufferTimerRef.current = setTimeout(() => {
      setIsBuffering(true);
    }, delay);
  }, []);

  const clearBuffering = useCallback(() => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setIsBuffering(false);
  }, []);

  // Seamless auto-recovery handler when stream stalls or errors out from Google Drive drops
  const handleStreamRecovery = useCallback(() => {
    if (!videoRef.current || isRecoveringRef.current) return;
    isRecoveringRef.current = true;
    triggerBuffering(0);

    const vid = videoRef.current;
    const savedTime = vid.currentTime || 0;
    const wasPlaying = !vid.paused;

    console.warn(`[VideoPlayer] Auto-recovering stalled video stream at ${savedTime.toFixed(2)}s...`);

    // Reload stream without requiring a full page refresh
    vid.load();

    const onCanPlayResume = () => {
      if (!videoRef.current) return;
      videoRef.current.removeEventListener('canplay', onCanPlayResume);
      try {
        videoRef.current.currentTime = savedTime;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Error during stream auto-recovery resume:', err);
      } finally {
        clearBuffering();
        isRecoveringRef.current = false;
      }
    };

    vid.addEventListener('canplay', onCanPlayResume, { once: true });

    // Safety timeout in case canplay event is delayed
    setTimeout(() => {
      if (isRecoveringRef.current) {
        isRecoveringRef.current = false;
        clearBuffering();
      }
    }, 4000);
  }, [triggerBuffering, clearBuffering]);

  // Safe play helper
  const safePlay = useCallback(() => {
    if (!videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          clearBuffering();
          setCurrentStroke([]);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Playback error:', err);
          }
          setIsPlaying(false);
          clearBuffering();
        });
    }
  }, [clearBuffering]);

  const safePause = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    clearBuffering();
  }, [clearBuffering]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      safePlay();
    } else {
      safePause();
    }
  }, [safePlay, safePause]);

  // Imperative handle for the parent page: pause + read the exact current time synchronously,
  // so a caller (e.g. the comment composer, on focus) can lock in the right timestamp with no event-timing race.
  useImperativeHandle(
    ref,
    () => ({
      pause: () => safePause(),
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    }),
    [safePause]
  );

  const stepFrames = useCallback(
    (deltaFrames: number) => {
      if (!videoRef.current) return;
      safePause();
      const frameDuration = 1 / fps;
      const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaFrames * frameDuration));
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      onTimeUpdate?.(target);
    },
    [fps, duration, safePause, onTimeUpdate]
  );

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  // Keep isFullscreen in sync when the user exits via Esc (or any non-button path)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  // Sync seekToTime from props (e.g. clicked from sidebar)
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime);
      onTimeUpdate?.(seekToTime);
      safePause();
      setDismissedCalloutId(null);
    }
  }, [seekToTime, safePause, onTimeUpdate]);

  // Keyboard Shortcuts (J, K, L, Space, Arrow keys, C, P, D, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          stepFrames(-1);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          stepFrames(1);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyP':
          e.preventDefault();
          setActiveTool((prev) => (prev === 'pin' ? null : 'pin'));
          if (isPlaying) safePause();
          break;
        case 'KeyD':
          e.preventDefault();
          setActiveTool((prev) => (prev === 'draw' ? null : 'draw'));
          if (isPlaying) safePause();
          break;
        case 'KeyR':
          e.preventDefault();
          setActiveTool((prev) => (prev === 'rectangle' ? null : 'rectangle'));
          if (isPlaying) safePause();
          break;
        case 'KeyO':
          e.preventDefault();
          setActiveTool((prev) => (prev === 'circle' ? null : 'circle'));
          if (isPlaying) safePause();
          break;
        case 'KeyA':
          e.preventDefault();
          setActiveTool((prev) => (prev === 'arrow' ? null : 'arrow'));
          if (isPlaying) safePause();
          break;
        case 'KeyC':
          e.preventDefault();
          if (onAddCommentAtTime) {
            const currentFrame = Math.floor(currentTime * fps);
            onAddCommentAtTime(currentTime, currentFrame);
          }
          break;
        case 'Escape':
          setDraftPin(null);
          setCurrentStroke([]);
          setActiveTool(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, safePause, stepFrames, toggleFullscreen, duration, currentTime, fps, isPlaying, onAddCommentAtTime, setDraftPin, setActiveTool]);

  // Convert points array to smooth SVG path string (0-100% normalized)
  const pointsToSvgPath = (pts: Point[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}, ${xc.toFixed(2)} ${yc.toFixed(2)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    return d;
  };

  // Viewport Pointer Handlers for Drawing, Shapes & Pinning
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !videoRef.current) return;
    if ((e.target as HTMLElement).closest('.pin-interactive-element')) return;

    // Normal mode: click toggles play/pause
    if (!activeTool) {
      togglePlay();
      return;
    }

    // Annotation tool active: ensure paused
    if (!videoRef.current.paused) {
      safePause();
    }

    if (!videoRect) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - videoRect.left;
    const relY = e.clientY - rect.top - videoRect.top;
    // Ignore clicks that land in the letterbox/pillarbox bars — outside the video's own pixels
    if (relX < 0 || relX > videoRect.width || relY < 0 || relY > videoRect.height) return;

    const x = Math.max(3, Math.min(97, (relX / videoRect.width) * 100));
    const y = Math.max(3, Math.min(97, (relY / videoRect.height) * 100));

    if (activeTool === 'pin') {
      // Pin Mode: Direct click drops pin and opens on-screen floating composer
      const roundedX = Math.round(x * 10) / 10;
      const roundedY = Math.round(y * 10) / 10;
      setDraftPin({
        x: roundedX,
        y: roundedY,
        timestamp: currentTime,
      });
      setActiveTool(null);
    } else {
      // Shape / Drawing tools (draw, rectangle, circle, arrow)
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      currentStrokeRef.current = [{ x, y }];
      setCurrentStroke([{ x, y }]);
      setDraftPin(null);
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !videoRect) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - videoRect.left;
    const relY = e.clientY - rect.top - videoRect.top;
    const x = Math.max(0, Math.min(100, (relX / videoRect.width) * 100));
    const y = Math.max(0, Math.min(100, (relY / videoRect.height) * 100));

    if (isDrawingRef.current && activeTool) {
      if (activeTool === 'draw') {
        currentStrokeRef.current.push({ x, y });
      } else {
        // Shapes: keep origin point and update current end point
        currentStrokeRef.current = [currentStrokeRef.current[0], { x, y }];
      }
      setCurrentStroke([...currentStrokeRef.current]);
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingRef.current && activeTool) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      isDrawingRef.current = false;

      const pts = currentStrokeRef.current;
      if (pts.length >= 2 || (activeTool === 'draw' && pts.length > 1)) {
        const svgPath = generateShapeSvgPath(activeTool, pts);
        let centerX = pts[0].x;
        let centerY = pts[0].y;

        if (activeTool === 'draw') {
          const sumX = pts.reduce((acc, p) => acc + p.x, 0);
          const sumY = pts.reduce((acc, p) => acc + p.y, 0);
          centerX = Math.round((sumX / pts.length) * 10) / 10;
          centerY = Math.round((sumY / pts.length) * 10) / 10;
        } else {
          centerX = Math.round(((pts[0].x + pts[pts.length - 1].x) / 2) * 10) / 10;
          centerY = Math.round(((pts[0].y + pts[pts.length - 1].y) / 2) * 10) / 10;
        }

        setDraftPin({
          x: centerX,
          y: centerY,
          timestamp: currentTime,
          drawingData: JSON.stringify({
            path: svgPath,
            color: drawColor,
            width: drawStrokeWidth,
            shape: activeTool,
          }),
        });
        setActiveTool(null);
      }
      setCurrentStroke([]);
    }
  };

  // Submit on-screen floating composer comment
  const handleSubmitFloatingComposer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || isSubmitting || !onAddComment || !activeDraftPin) return;

    setIsSubmitting(true);
    try {
      // For range-based comments: the end is always the current playhead position
      // at submit time (live-tracked, no separate "confirm end" step to miss).
      // 0.5s minimum gap — the server also rejects timestampEnd <= timestamp.
      if (isRangeMode && Math.abs(currentTime - activeDraftPin.timestamp) >= 0.5) {
        const start = Math.min(activeDraftPin.timestamp, currentTime);
        const end = Math.max(activeDraftPin.timestamp, currentTime);
        await onAddComment(
          composerText.trim(),
          start,
          undefined,
          composerGuestName || undefined,
          activeDraftPin.x,
          activeDraftPin.y,
          activeDraftPin.drawingData,
          end // timestampEnd as 8th arg
        );
      } else {
        await onAddComment(
          composerText.trim(),
          activeDraftPin.timestamp,
          undefined,
          composerGuestName || undefined,
          activeDraftPin.x,
          activeDraftPin.y,
          activeDraftPin.drawingData
        );
      }
      setDraftPin(null);
    } catch (err) {
      console.error('Failed to post on-screen comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timeline scrubber handlers
  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || duration === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pos * duration;
    },
    [duration]
  );

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    wasPlayingBeforeScrubRef.current = !videoRef.current.paused;

    safePause();

    const targetTime = getTimeFromClientX(e.clientX);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    onTimeUpdate?.(targetTime);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const hoverOffset = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const timeAtCursor = (hoverOffset / rect.width) * duration;

    setHoverX(hoverOffset);
    setHoverTime(timeAtCursor);

    if (isScrubbingRef.current && videoRef.current) {
      videoRef.current.currentTime = timeAtCursor;
      setCurrentTime(timeAtCursor);
      onTimeUpdate?.(timeAtCursor);
    }
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    isScrubbingRef.current = false;
    setIsScrubbing(false);

    if (wasPlayingBeforeScrubRef.current) {
      safePlay();
    } else if (videoRef.current) {
      // Landed here paused (it was already paused before this scrub too) — the native 'pause' event won't
      // re-fire since there's no playing→paused transition, so report the new anchor point directly.
      onPlaybackPause?.(videoRef.current.currentTime);
    }
  };

  // Range end-handle drag — grabbing the small handle itself (not a separate background track) moves it.
  // The video frame previews live at that timestamp as you drag (so you can see what's there), but this
  // never touches `rangeStart` and — since the video stays paused throughout — never fires a pause event either.
  const handleRangeHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration === 0 || rangeStart === null) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRangeRef.current = true;
    const t = getTimeFromClientX(e.clientX);
    const clamped = Math.max(rangeStart, Math.min(duration, t));
    setDragRangeEnd(clamped);
    onRangeEndChangeRef.current?.(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);
    }
  };

  const handleRangeHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRangeRef.current || duration === 0 || rangeStart === null) return;
    e.stopPropagation();
    const t = getTimeFromClientX(e.clientX);
    const clamped = Math.max(rangeStart, Math.min(duration, t));
    setDragRangeEnd(clamped);
    onRangeEndChangeRef.current?.(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);
    }
  };

  const handleRangeHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRangeRef.current) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    isDraggingRangeRef.current = false;
  };

  const currentFrame = Math.floor(currentTime * fps);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Filter comments for timeline markers and viewport annotations based on the 3-way toggle (all / active / resolved)
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      // Exclude reply comments from having duplicate markers on timeline
      if (c.parentCommentId) return false;
      if (currentFilter === 'active') return !c.resolved;
      if (currentFilter === 'resolved') return !!c.resolved;
      return true; // 'all'
    });
  }, [comments, currentFilter]);

  // Spatial pin / drawing comments visible near current timestamp or active comment.
  const visibleComments = useMemo(() => {
    return comments.filter((c) => {
      if (c.parentCommentId) return false;

      // Filter check (activeCommentId can be viewed even if filter is different when clicked in sidebar)
      if (currentFilter === 'active' && c.resolved && activeCommentId !== c._id) return false;
      if (currentFilter === 'resolved' && !c.resolved && activeCommentId !== c._id) return false;

      const isActive = activeCommentId === c._id;
      if (theaterMode) {
        if (isActive) {
          // If the user actively clicked this comment from sidebar or timeline,
          // keep it rendered on screen while paused or within its range window so keyframe seek offsets never hide it.
          if (!isPlaying) return true;
          const EPSILON = 1.0;
          if (c.timestampEnd && c.timestampEnd > c.timestamp) {
            return currentTime >= c.timestamp - EPSILON && currentTime <= c.timestampEnd + EPSILON;
          }
          return Math.abs(currentTime - c.timestamp) <= EPSILON;
        }

        // Auto-reveal when scrubbing or playing near the annotation
        const windowEnd = c.timestampEnd && c.timestampEnd > c.timestamp ? c.timestampEnd : c.timestamp + 2.0;
        const isPlaybackActive = isPlaying && currentTime >= c.timestamp - 0.3 && currentTime <= windowEnd;
        const isPausedActive =
          !isPlaying &&
          (c.timestampEnd && c.timestampEnd > c.timestamp
            ? currentTime >= c.timestamp - 1.2 && currentTime <= c.timestampEnd + 1.2
            : Math.abs(currentTime - c.timestamp) <= 1.2);
        return isPlaybackActive || isPausedActive;
      }

      // Range comments stay visible for their full timestamp -> timestampEnd span
      const windowEnd = c.timestampEnd && c.timestampEnd > c.timestamp ? c.timestampEnd : c.timestamp + 2.8;
      const isPlaybackActive = isPlaying && currentTime >= c.timestamp - 0.2 && currentTime <= windowEnd;
      const isPausedActive =
        !isPlaying &&
        (c.timestampEnd && c.timestampEnd > c.timestamp
          ? currentTime >= c.timestamp - 1.5 && currentTime <= c.timestampEnd + 1.5
          : Math.abs(currentTime - c.timestamp) <= 1.5);
      return isActive || isPlaybackActive || isPausedActive;
    });
  }, [comments, currentFilter, currentTime, activeCommentId, isPlaying, theaterMode]);

  // Live range end. In theater mode there's no separate "range mode" toggle and no pin/drawing required —
  // `rangeStart` anchors the moment composing began (any comment, plain or pinned), and the end is dragged
  // independently on its own mini-track (dragRangeEnd) rather than by scrubbing the video's own playhead.
  // Outside theater mode the old explicit toggle (in the floating popup) still gates it.
  const liveRangeEnd = theaterMode
    ? rangeStart !== null
      ? dragRangeEnd
      : null
    : isRangeMode && activeDraftPin
    ? currentTime
    : null;
  const rangeStartTime = theaterMode ? rangeStart : activeDraftPin?.timestamp ?? null;

  // Find active comment details for the on-screen card popup
  const activeComment = useMemo(() => {
    if (!activeCommentId || activeCommentId === dismissedCalloutId) return null;
    return comments.find((c) => c._id === activeCommentId) || null;
  }, [activeCommentId, comments, dismissedCalloutId]);

  const isActiveCommentAuthor =
    !!currentUser &&
    !!activeComment &&
    (activeComment.userId?._id === currentUser.id ||
      (activeComment.userId as unknown as string) === currentUser.id);

  return (
    <div
      ref={containerRef}
      className={`${theaterMode ? 'h-full flex flex-col min-h-0' : 'space-y-3'} ${isFullscreen ? 'h-full w-full bg-zinc-950 flex flex-col justify-center p-3' : ''}`}
    >
      <div
        className={
          theaterMode
            ? 'relative flex flex-col flex-1 min-h-0 bg-black overflow-hidden group select-none'
            : 'relative flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800/80 shadow-2xl group select-none'
        }
      >
      {/* Video Viewport with Interactive Spatial Pin & Drawing Overlay */}
      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        className={`relative ${theaterMode ? 'flex-1 min-h-0' : 'aspect-video'} bg-black flex items-center justify-center overflow-hidden touch-none ${
          !isPlaying && activeTool
            ? 'cursor-crosshair'
            : 'cursor-pointer'
        }`}
      >
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          playsInline
          className="w-full h-full object-contain pointer-events-none"
          onTimeUpdate={() => {
            if (videoRef.current && !isScrubbingRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              onTimeUpdate?.(videoRef.current.currentTime);
              clearBuffering();
              if (stallTimerRef.current) {
                clearTimeout(stallTimerRef.current);
                stallTimerRef.current = null;
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              videoRef.current.volume = volume;
              videoRef.current.muted = isMuted;
              videoRef.current.playbackRate = playbackSpeed;
              clearBuffering();
              recalcVideoRect();
            }
          }}
          onError={(e) => {
            console.warn('[VideoPlayer] Video stream error event caught, auto-recovering...', e);
            if (retryCountRef.current < 4) {
              retryCountRef.current += 1;
              handleStreamRecovery();
            }
          }}
          onStalled={() => {
            triggerBuffering(300);
            if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
            stallTimerRef.current = setTimeout(() => {
              if (videoRef.current && !videoRef.current.paused && isPlaying) {
                handleStreamRecovery();
              }
            }, 3500);
          }}
          onWaiting={() => {
            triggerBuffering(200);
            if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
            stallTimerRef.current = setTimeout(() => {
              if (videoRef.current && isPlaying) {
                handleStreamRecovery();
              }
            }, 3500);
          }}
          onSeeking={() => triggerBuffering(200)}
          onSeeked={() => clearBuffering()}
          onCanPlay={() => clearBuffering()}
          onCanPlayThrough={() => clearBuffering()}
          onPlaying={() => {
            clearBuffering();
            setIsPlaying(true);
            if (stallTimerRef.current) {
              clearTimeout(stallTimerRef.current);
              stallTimerRef.current = null;
            }
          }}
          onPause={() => {
            clearBuffering();
            setIsPlaying(false);
            if (stallTimerRef.current) {
              clearTimeout(stallTimerRef.current);
              stallTimerRef.current = null;
            }
            if (videoRef.current) {
              onTimeUpdate?.(videoRef.current.currentTime);
              onPlaybackPause?.(videoRef.current.currentTime);
            }
          }}
          onEnded={() => {
            clearBuffering();
            setIsPlaying(false);
          }}
        />

        {/* Everything below is positioned relative to the video's own rendered pixels (not the full viewport),
            so pins/drawings/popovers never land in the black letterbox/pillarbox bars of a mismatched-aspect video. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: videoRect?.left ?? 0,
            top: videoRect?.top ?? 0,
            width: videoRect?.width ?? '100%',
            height: videoRect?.height ?? '100%',
          }}
        >
        {/* SVG Drawing Layer for Real-Time and Saved Drawings */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        >
          {/* 1. Saved drawings for visible comments */}
          {visibleComments.map((c) => {
            const parsed = parseDrawingData(c.drawingData);
            if (!parsed?.path) return null;

            const isActive = activeCommentId === c._id;
            const strokeW = parsed.width || 0.8;

            return (
              <g key={c._id} className="transition-all">
                {/* Glow outline when active */}
                {isActive && (
                  <path
                    d={parsed.path}
                    fill="none"
                    stroke={parsed.color || '#06b6d4'}
                    strokeWidth={strokeW * 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                    className="animate-pulse"
                  />
                )}
                {/* Dark high-contrast outer shadow stroke */}
                <path
                  d={parsed.path}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={strokeW * 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.75"
                />
                {/* Main colored stroke */}
                <path
                  d={parsed.path}
                  fill="none"
                  stroke={parsed.color || '#06b6d4'}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* 2. Draft drawing waiting for comment submission */}
          {activeDraftPin?.drawingData && (
            (() => {
              const parsed = parseDrawingData(activeDraftPin.drawingData);
              const strokeW = parsed?.width || drawStrokeWidth;
              return parsed?.path ? (
                <g>
                  <path
                    d={parsed.path}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={strokeW * 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  <path
                    d={parsed.path}
                    fill="none"
                    stroke={parsed.color || '#06b6d4'}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-pulse"
                  />
                </g>
              ) : null;
            })()
          )}

          {/* 3. Live active drawing / shape stroke in progress */}
          {currentStroke.length > 0 && activeTool && (
            <g>
              <path
                d={generateShapeSvgPath(activeTool, currentStroke)}
                fill={activeTool === 'rectangle' || activeTool === 'circle' ? drawColor : 'none'}
                fillOpacity={activeTool === 'rectangle' || activeTool === 'circle' ? '0.15' : '0'}
                stroke="#000000"
                strokeWidth={drawStrokeWidth * 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              <path
                d={generateShapeSvgPath(activeTool, currentStroke)}
                fill={activeTool === 'rectangle' || activeTool === 'circle' ? drawColor : 'none'}
                fillOpacity={activeTool === 'rectangle' || activeTool === 'circle' ? '0.15' : '0'}
                stroke={drawColor}
                strokeWidth={drawStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
        </svg>

        {/* Buffering Spinner Overlay */}
        {isBuffering && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-teal-500/30 shadow-2xl flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              <span className="text-xs font-mono font-medium text-zinc-200">Buffering video...</span>
            </div>
          </div>
        )}

        {/* Center Play/Resume Button when Paused and in Normal Mode */}
        {!isPlaying && !isBuffering && !activeTool && !activeDraftPin && currentStroke.length === 0 && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none z-20 transition-opacity">
            <button
              type="button"
              className="w-16 h-16 rounded-full bg-teal-600/90 hover:bg-teal-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transform transition hover:scale-110 pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePlay();
              }}
            >
              <Play className="w-7 h-7 fill-white translate-x-0.5" />
            </button>
          </div>
        )}

        {/* Draft Active Pin Marker on Video Frame */}
        {activeDraftPin && (
          <div
            style={{ left: `${activeDraftPin.x}%`, top: `${activeDraftPin.y}%` }}
            className="pin-interactive-element absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
          >
            {/* Pulsing Pin Head */}
            <div className="w-8 h-8 rounded-full bg-teal-500 text-zinc-950 flex items-center justify-center font-bold text-xs border-2 border-white shadow-2xl ring-4 ring-teal-500/40 animate-bounce">
              {activeDraftPin.drawingData ? (
                <Pencil className="w-4 h-4 fill-zinc-950" />
              ) : (
                <MapPin className="w-4 h-4 fill-zinc-950" />
              )}
            </div>
          </div>
        )}

        {/* Smart Clamped On-Screen Floating Composer for Draft Pin & Drawing — in theater mode the comment
            sidebar's own composer handles text entry instead, so this popup stays hidden there. */}
        {activeDraftPin && !theaterMode && (
          <div
            style={getClampedPopoverStyle(activeDraftPin.x, activeDraftPin.y)}
            className="pin-interactive-element absolute z-50 animate-in zoom-in-95 duration-150 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Card */}
            <div className="w-72 sm:w-80 p-3 rounded-2xl bg-zinc-900/98 border border-teal-500/60 shadow-2xl backdrop-blur-2xl z-50 text-xs space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5 font-semibold text-teal-400">
                  {liveRangeEnd !== null ? (
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  ) : activeDraftPin.drawingData ? (
                    <Pencil className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5 text-teal-400" />
                  )}
                  <span>
                    {liveRangeEnd !== null
                      ? `Range: ${formatTimecode(Math.min(activeDraftPin.timestamp, liveRangeEnd))} → ${formatTimecode(Math.max(activeDraftPin.timestamp, liveRangeEnd))}`
                      : activeDraftPin.drawingData
                      ? `Drawing at ${formatTimecode(activeDraftPin.timestamp)}`
                      : `Point at ${formatTimecode(activeDraftPin.timestamp)}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftPin(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitFloatingComposer} className="space-y-2">
                {/* Time Range Toggle */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsRangeMode((prev) => !prev)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                      isRangeMode
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {isRangeMode ? 'Time range on' : 'Add time range'}
                  </button>

                  {isRangeMode && (
                    <>
                      <span className="text-[10px] font-mono text-teal-400">
                        Start {formatTimecode(activeDraftPin.timestamp)}
                      </span>
                      <span className="text-zinc-600 text-[10px]">→</span>
                      <span className={`text-[10px] font-mono ${liveRangeEnd !== null ? 'text-amber-400' : 'text-zinc-500'}`}>
                        End {formatTimecode(currentTime)}
                      </span>
                    </>
                  )}
                </div>

                {isRangeMode && liveRangeEnd === null && (
                  <p className="text-[10px] text-zinc-500">
                    Move the playhead on the timeline below to set an end point — it will be saved as the range end automatically.
                  </p>
                )}

                {allowGuestComments && (
                  <input
                    type="text"
                    placeholder="Your Name (Optional)"
                    value={composerGuestName}
                    onChange={(e) => setComposerGuestName(e.target.value)}
                    className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500"
                  />
                )}

                <textarea
                  rows={2}
                  autoFocus
                  placeholder={
                    activeDraftPin.drawingData
                      ? 'Add feedback for your drawing...'
                      : 'Add feedback for this exact pinned point...'
                  }
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitFloatingComposer(e);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500 resize-none shadow-inner"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Press Enter ↵</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDraftPin(null)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!composerText.trim() || isSubmitting}
                      className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1 shadow-md shadow-teal-600/30 transition-all"
                    >
                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>Comment</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Saved Visual Pins on Video Frame — for a drawing, the stroke itself (SVG layer above) is the
            marker; in theater mode we skip the author badge/callout entirely so nothing sits on top of it. */}
        {visibleComments.map((pin) => {
          if (typeof pin.x !== 'number' || typeof pin.y !== 'number') return null;
          if (theaterMode && pin.drawingData) return null;
          const isActive = activeCommentId === pin._id;
          const authorInitial = (pin.userId?.name || pin.guestName || 'R')[0].toUpperCase();

          if (theaterMode) {
            // Just a small pin — no author badge, no callout bubble
            return (
              <div
                key={pin._id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectComment) onSelectComment(pin._id, pin.timestamp);
                  setDismissedCalloutId(null);
                }}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                className={`pin-interactive-element absolute -translate-x-1/2 -translate-y-full z-30 cursor-pointer transition-transform ${
                  isActive ? 'scale-125 z-40' : 'hover:scale-110'
                }`}
              >
                <MapPin
                  className={`w-6 h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                    pin.resolved ? 'text-emerald-400' : isActive ? 'text-cyan-300' : 'text-teal-400'
                  }`}
                  fill="currentColor"
                  strokeWidth={1.5}
                  stroke="black"
                />
              </div>
            );
          }

          return (
            <div
              key={pin._id}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectComment) onSelectComment(pin._id, pin.timestamp);
                setDismissedCalloutId(null);
              }}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              className={`pin-interactive-element absolute -translate-x-1/2 -translate-y-1/2 z-30 group/pin cursor-pointer transition-all duration-200 ${
                isActive ? 'scale-125 z-40' : 'hover:scale-110'
              }`}
            >
              {/* Pulsing ring for pin */}
              <div
                className={`absolute inset-0 rounded-full animate-ping opacity-60 pointer-events-none ${
                  isActive ? 'bg-cyan-400' : 'bg-teal-400'
                }`}
              />

              {/* Pin Badge Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xl border-2 transition-all ${
                  pin.resolved
                    ? 'bg-emerald-600 text-white border-white ring-4 ring-emerald-500/40'
                    : isActive
                    ? 'bg-cyan-500 text-zinc-950 border-white ring-4 ring-cyan-500/50 shadow-cyan-500/50'
                    : pin.drawingData
                    ? 'bg-purple-600 text-white border-white ring-4 ring-purple-500/40 shadow-purple-600/40'
                    : 'bg-teal-600 text-white border-white ring-4 ring-teal-500/40 shadow-teal-600/40'
                }`}
              >
                {pin.resolved ? <CheckCircle2 className="w-4 h-4" /> : <span>{authorInitial}</span>}
              </div>

              {/* Comment Callout Bubble (Visible both when paused and playing so reviewer can read immediately) */}
              {!isActive && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 min-w-[160px] max-w-[280px] p-2.5 rounded-2xl bg-zinc-900/98 border border-teal-500/80 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-xl text-xs animate-in fade-in duration-200 pointer-events-auto z-40 ${
                    pin.x > 60 ? 'right-full mr-3' : 'left-full ml-3'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectComment) onSelectComment(pin._id, pin.timestamp);
                  }}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
                    <span className="font-semibold text-teal-400 truncate max-w-[120px]">
                      {pin.userId?.name || pin.guestName || 'Reviewer'}
                    </span>
                    <span className="font-mono text-zinc-400">{formatTimecode(pin.timestamp)}</span>
                  </div>
                  <p className="text-zinc-100 line-clamp-3 text-xs font-normal leading-snug">{pin.text}</p>
                </div>
              )}
            </div>
          );
        })}


        {/* Active Comment On-Screen Popover Card (Opened from Sidebar / Pin Click) — theater mode shows the
            comment's details in the sidebar instead, so this on-video card stays hidden there. */}
        {!theaterMode && activeComment && (activeComment.x !== undefined || activeComment.drawingData) && (
          <div
            style={getClampedPopoverStyle(activeComment.x || 50, activeComment.y || 50)}
            className="pin-interactive-element absolute z-50 animate-in zoom-in-95 duration-200 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Card */}
            <div className="w-72 sm:w-80 p-3.5 rounded-2xl bg-zinc-900/98 border border-teal-500/60 shadow-2xl backdrop-blur-2xl z-50 text-xs space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-[10px]">
                    {(activeComment.userId?.name || activeComment.guestName || 'R')[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-zinc-200 truncate max-w-[120px]">
                    {activeComment.userId?.name || activeComment.guestName || 'Reviewer'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-teal-400">
                    {formatTimecode(activeComment.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedCalloutId(activeComment._id)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    title="Close popup"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Comment Text */}
              <p className="text-zinc-100 font-normal leading-relaxed">{activeComment.text}</p>

              {/* Footer status */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-500 border-t border-zinc-800/60">
                <span>{new Date(activeComment.createdAt).toLocaleDateString()}</span>
                {activeComment.resolved ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Resolved
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold">• Active Feedback</span>
                )}
              </div>

              {/* Actions: Resolve / Reopen & Delete (author only) */}
              {(onResolveComment || (isActiveCommentAuthor && onDeleteComment)) && (
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-800/60">
                  {onResolveComment && (
                    <button
                      type="button"
                      onClick={() => onResolveComment(activeComment._id, !activeComment.resolved)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                        activeComment.resolved
                          ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {activeComment.resolved ? (
                        <>
                          <RotateCcw className="w-2.5 h-2.5" /> Reopen
                        </>
                      ) : (
                        <>
                          <Check className="w-2.5 h-2.5" /> Resolve
                        </>
                      )}
                    </button>
                  )}
                  {isActiveCommentAuthor && onDeleteComment && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = activeComment._id;
                        setDismissedCalloutId(id);
                        onDeleteComment(id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Control Bar & Timeline */}
      <div className={`shrink-0 bg-white dark:bg-zinc-950/95 border-t border-slate-200 dark:border-zinc-800/80 p-2 sm:p-3.5 space-y-1.5 sm:space-y-3`}>
        {/* Interactive Timeline Track with Hold & Slide Scrubber. Wrapped in a plain (non-group) relative
            container so the range handles below can be absolutely positioned — never adding real layout
            height, so the video area doesn't shrink/grow every time they show or hide on pause/play. */}
        <div className="relative">
        <div
          ref={timelineRef}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onPointerCancel={handleTimelinePointerUp}
          onMouseLeave={() => {
            if (!isScrubbingRef.current) {
              setHoverTime(null);
              setHoverX(null);
            }
          }}
          className="relative h-7 flex items-center cursor-pointer group/timeline touch-none"
        >
          {/* Track background */}
          <div className="w-full h-2 bg-slate-200 dark:bg-zinc-800/90 rounded-full overflow-hidden relative group-hover/timeline:h-2.5 transition-all">
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-brand-400 dark:from-teal-600 dark:to-cyan-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Range Selection Highlight (from the anchor point → live playhead) — theater mode hides it while playing */}
            {(!theaterMode || !isPlaying) && rangeStartTime !== null && liveRangeEnd !== null && duration > 0 && (
              <div
                className="absolute top-0 h-full bg-brand-400/40 border-x-2 border-brand-400 dark:bg-teal-400/40 dark:border-teal-400"
                style={{
                  left: `${(Math.min(rangeStartTime, liveRangeEnd) / duration) * 100}%`,
                  width: `${(Math.abs(liveRangeEnd - rangeStartTime) / duration) * 100}%`,
                }}
              />
            )}

            {/* Range spans for existing range comments */}
            {filteredComments.map((c) => {
              if (!c.timestampEnd || duration === 0) return null;
              return (
                <div
                  key={`range-${c._id}`}
                  className={`absolute top-0 h-full opacity-50 ${
                    c.resolved ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{
                    left: `${(c.timestamp / duration) * 100}%`,
                    width: `${((c.timestampEnd - c.timestamp) / duration) * 100}%`,
                  }}
                />
              );
            })}
          </div>

          {/* Scrubber Playhead Handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-xl border-2 border-brand-500 dark:border-teal-500 -ml-2 pointer-events-none transition-transform ${
              isScrubbing ? 'scale-150 ring-4 ring-brand-500/30 dark:ring-teal-500/30' : 'group-hover/timeline:scale-125'
            }`}
            style={{ left: `${progressPercent}%` }}
          />

          {/* Comment Markers on Timeline (non-theater only — theater's markers live in their own row below,
              outside this group/timeline element, so hovering them can't trigger the track's own hover styles) */}
          {!theaterMode &&
            duration > 0 &&
            filteredComments.map((comment) => {
              const markerPos = (comment.timestamp / duration) * 100;
              const isActive = activeCommentId === comment._id;
              const isResolved = comment.resolved;
              const hasDrawing = !!comment.drawingData;
              const hasSpatialPin = comment.x !== undefined && comment.y !== undefined;

              return (
                <div
                  key={comment._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectComment) onSelectComment(comment._id, comment.timestamp);
                    setDismissedCalloutId(null);
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group/marker transition-transform cursor-pointer ${
                    isActive ? 'scale-150 z-30' : 'hover:scale-125'
                  }`}
                  style={{ left: `${markerPos}%` }}
                >
                  <div
                    className={`rounded-full shadow-md transition-all ${
                      hasDrawing
                        ? 'w-3.5 h-3.5 rotate-45 border-2 border-zinc-950 ' +
                          (isResolved ? 'bg-emerald-500' : isActive ? 'bg-purple-400 ring-2 ring-purple-400/50' : 'bg-purple-500')
                        : hasSpatialPin
                        ? 'w-3.5 h-3.5 rotate-45 border-2 border-zinc-950 ' +
                          (isResolved ? 'bg-emerald-500' : isActive ? 'bg-cyan-400 ring-2 ring-cyan-400/50' : 'bg-teal-400')
                        : 'w-3 h-3 border-2 border-zinc-950 ' +
                          (isResolved ? 'bg-emerald-500' : isActive ? 'bg-cyan-400 ring-2 ring-teal-400/50' : 'bg-amber-400')
                    }`}
                  />

                  {/* Marker Tooltip Preview on hover */}
                  <div className="hidden group-hover/marker:block absolute bottom-6 left-1/2 -translate-x-1/2 w-48 p-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-[11px] text-zinc-200 pointer-events-none z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between font-semibold text-[10px] text-zinc-400 mb-1">
                      <span className="flex items-center gap-1">
                        {hasDrawing ? (
                          <Pencil className="w-2.5 h-2.5 text-purple-400" />
                        ) : hasSpatialPin ? (
                          <MapPin className="w-2.5 h-2.5 text-teal-400" />
                        ) : null}
                        <span>{comment.userId?.name || comment.guestName || 'Reviewer'}</span>
                      </span>
                      <span className="font-mono text-teal-400">{formatTimecode(comment.timestamp)}</span>
                    </div>
                    <p className="line-clamp-2 text-zinc-300">{comment.text}</p>
                  </div>
                </div>
              );
            })}

          {/* Hover Timecode Tooltip */}
          {hoverTime !== null && hoverX !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-200 pointer-events-none shadow-lg z-40"
              style={{ left: `${hoverX}px` }}
            >
              {showSMPTE ? formatSMPTETimecode(hoverTime, fps) : formatTimecode(hoverTime)}
            </div>
          )}
        </div>

        {/* Range handles — no separate track bar, just two small thin marks a few px below the main timeline.
            Start is fixed; End is dragged directly (pointer capture on the handle itself), which moves the
            range without ever seeking/scrubbing the video. A tiny built-in offset keeps both visible even
            when they're at (or very near) the same instant, instead of one hiding behind the other. */}
        {theaterMode && !isPlaying && rangeStartTime !== null && duration > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 h-3 pointer-events-none">
            {liveRangeEnd !== null && Math.abs(liveRangeEnd - rangeStartTime) > 0.05 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-amber-400/60"
                style={{
                  left: `${(Math.min(rangeStartTime, liveRangeEnd) / duration) * 100}%`,
                  width: `${(Math.abs(liveRangeEnd - rangeStartTime) / duration) * 100}%`,
                }}
              />
            )}

            {/* Start handle — fixed at the anchor point */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_0_1.5px_rgba(0,0,0,0.9)]"
              style={{ left: `calc(${(rangeStartTime / duration) * 100}% - 4px)` }}
            />

            {/* End handle — grab and drag to extend the range. Identical size/centering to the start handle,
                just offset a few px so both stay visible instead of overlapping. */}
            {liveRangeEnd !== null && (
              <div
                onPointerDown={handleRangeHandlePointerDown}
                onPointerMove={handleRangeHandlePointerMove}
                onPointerUp={handleRangeHandlePointerUp}
                onPointerCancel={handleRangeHandlePointerUp}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_0_1.5px_rgba(0,0,0,0.9)] cursor-ew-resize touch-none pointer-events-auto"
                style={{ left: `calc(${(liveRangeEnd / duration) * 100}% + 4px)` }}
                title="Drag to set the range end"
              />
            )}
          </div>
        )}
        </div>

        {/* Theater-mode comment marker row — deliberately outside the timeline's own group/timeline element,
            so hovering a marker never triggers the track's hover styles (thicken bar / grow scrubber). */}
        {theaterMode && duration > 0 && (
          <div className="relative h-5">
            {filteredComments.map((comment) => {
              const markerPos = (comment.timestamp / duration) * 100;
              const isActive = activeCommentId === comment._id;
              const isResolved = comment.resolved;
              const hasDrawing = !!comment.drawingData;
              const hasSpatialPin = comment.x !== undefined && comment.y !== undefined;
              const authorKey = comment.userId?._id || comment.guestName || 'anon';
              const authorName = comment.userId?.name || comment.guestName || 'Reviewer';
              const authorInitial = authorName[0].toUpperCase();

              return (
                <div
                  key={comment._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectComment) onSelectComment(comment._id, comment.timestamp);
                    setDismissedCalloutId(null);
                  }}
                  className={`absolute top-0 -translate-x-1/2 z-20 group/tmarker transition-transform cursor-pointer ${
                    isActive ? 'scale-110 z-30' : 'hover:scale-110'
                  }`}
                  style={{ left: `${markerPos}%` }}
                >
                  <div className="relative">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 shadow-md transition-all ${getAuthorMarkerColor(
                        authorKey
                      )} ${isActive ? 'ring-2 ring-white' : ''}`}
                    />
                    {isResolved && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-950 flex items-center justify-center">
                        <Check className="w-1.5 h-1.5 text-white" strokeWidth={4} />
                      </div>
                    )}
                  </div>

                  {/* Rich hover preview card */}
                  <div className="hidden group-hover/tmarker:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-2xl bg-zinc-900/98 border border-zinc-700 shadow-2xl backdrop-blur-xl text-xs z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${getAuthorMarkerColor(
                          authorKey
                        )}`}
                      >
                        {authorInitial}
                      </div>
                      <span className="font-semibold text-zinc-100 truncate">{authorName}</span>
                      <span className="text-zinc-500 text-[10px] shrink-0">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-semibold">
                        {formatTimecode(comment.timestamp)}
                      </span>
                      {hasDrawing ? (
                        <Pencil className="w-3 h-3 text-purple-400" />
                      ) : hasSpatialPin ? (
                        <MapPin className="w-3 h-3 text-teal-400" />
                      ) : null}
                    </div>
                    <p className="text-zinc-300 line-clamp-3 leading-snug">{comment.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lower Controller Bar */}
        <div className="relative flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left Controls: Play, Step Frames, Timecode */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md shadow-brand-600/20 dark:shadow-teal-600/20 transition-all shrink-0 cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-white" /> : <Play className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-white" />}
            </button>

            {/* Frame Step Back */}
            <button
              onClick={() => stepFrames(-1)}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Previous Frame (Left Arrow / J)"
            >
              <ChevronLeft className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>

            {/* Frame Step Forward */}
            <button
              onClick={() => stepFrames(1)}
              className="p-1 sm:p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Next Frame (Right Arrow / L)"
            >
              <ChevronRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>

            {/* Timecode and Frame Number Display */}
            <button
              onClick={() => setShowSMPTE(!showSMPTE)}
              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] sm:text-xs font-mono text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shrink-0 cursor-pointer"
              title="Click to toggle SMPTE timecode / standard"
            >
              <span className="font-semibold text-brand-600 dark:text-teal-400">
                {showSMPTE ? formatSMPTETimecode(currentTime, fps) : formatTimecode(currentTime)}
              </span>
              <span className="text-slate-400 dark:text-zinc-600">/</span>
              <span className="text-slate-400 dark:text-zinc-500">
                {showSMPTE ? formatSMPTETimecode(duration, fps) : formatDuration(duration)}
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-zinc-500 ml-0.5">({currentFrame}f)</span>
            </button>

            {/* Annotation Tools Toggle — in theater mode the comment composer's own pen icon drives this instead */}
            {!theaterMode && (
              <button
                type="button"
                onClick={() => setShowAnnotationTools((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                  showAnnotationTools || activeTool
                    ? 'bg-brand-600 dark:bg-teal-600 border-brand-600 dark:border-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                    : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
                title="Annotation tools — pin, draw, shapes (P/D/R/O/A)"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Annotate</span>
              </button>
            )}
          </div>

          {/* Center 3-Way Annotation Filter Switch on Video Canvas — in theater mode this lives only in the comment sidebar's own dropdown */}
          {!theaterMode && (
            <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0 text-xs">
              {(['all', 'active', 'resolved'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleFilterChange(mode)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                    currentFilter === mode
                      ? mode === 'resolved'
                        ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                        : mode === 'active'
                        ? 'bg-amber-600 text-white shadow-sm font-semibold'
                        : 'bg-brand-600 dark:bg-teal-600 text-white shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                  title={`Show ${
                    mode === 'all'
                      ? 'all annotations'
                      : mode === 'active'
                      ? 'unresolved annotations only'
                      : 'resolved annotations only'
                  } on video`}
                >
                  {mode === 'all' ? 'All' : mode === 'active' ? 'Unresolved' : 'Resolved'}
                </button>
              ))}
            </div>
          )}

          {/* Right Controls: Speed, Volume, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Speed Selector */}
            <div className="relative group/speed shrink-0">
              <button className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] sm:text-xs font-mono text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                {playbackSpeed}x
              </button>
              <div className="hidden group-hover/speed:flex absolute bottom-full right-0 mb-1 flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-1 shadow-2xl z-50">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (videoRef.current) videoRef.current.playbackRate = spd;
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded-lg text-left transition-colors cursor-pointer ${
                      playbackSpeed === spd ? 'bg-brand-600 dark:bg-teal-600 text-white' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                }}
                className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = false;
                  }
                }}
                className="w-14 sm:w-16 h-1 bg-slate-200 dark:bg-zinc-800 accent-brand-500 dark:accent-teal-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 sm:p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Maximize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
            </button>
          </div>

          {/* Annotation Tools Popup */}
          {showAnnotationTools && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowAnnotationTools(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-2 z-40 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 shadow-2xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-150">
        {/* Left: Tools & Shapes Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 gap-0.5">
            {/* Point Pin */}
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === 'pin' ? null : 'pin'));
                if (isPlaying) safePause();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTool === 'pin'
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
              title="Point Pin Tool (P)"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pin</span>
            </button>

            {/* Freehand Pen */}
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === 'draw' ? null : 'draw'));
                if (isPlaying) safePause();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTool === 'draw'
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
              title="Freehand Pen (D)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>

            {/* Rectangle Box */}
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === 'rectangle' ? null : 'rectangle'));
                if (isPlaying) safePause();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTool === 'rectangle'
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
              title="Rectangle Box (R)"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Rect</span>
            </button>

            {/* Circle / Ellipse */}
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === 'circle' ? null : 'circle'));
                if (isPlaying) safePause();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTool === 'circle'
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
              title="Circle / Ellipse (O)"
            >
              <CircleIcon className="w-3.5 h-3.5" />
              <span>Circle</span>
            </button>

            {/* Arrow Pointer */}
            <button
              type="button"
              onClick={() => {
                setActiveTool((prev) => (prev === 'arrow' ? null : 'arrow'));
                if (isPlaying) safePause();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTool === 'arrow'
                  ? 'bg-brand-600 dark:bg-teal-600 text-white shadow-md shadow-brand-600/30 dark:shadow-teal-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
              title="Arrow Pointer (A)"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Arrow</span>
            </button>
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
            {DRAW_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setDrawColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  drawColor.toLowerCase() === c.hex.toLowerCase()
                    ? 'scale-125 ring-2 ring-slate-900 dark:ring-white z-10'
                    : 'hover:scale-110 opacity-70 hover:opacity-100'
                }`}
                title={c.name}
              />
            ))}

            {/* Custom RGB Color Spectrum Input */}
            <label
              className={`relative w-4 h-4 rounded-full cursor-pointer flex items-center justify-center overflow-hidden border border-slate-300 dark:border-zinc-700 hover:scale-110 transition-transform ${
                !DRAW_COLORS.some((c) => c.hex.toLowerCase() === drawColor.toLowerCase())
                  ? 'ring-2 ring-slate-900 dark:ring-white z-10'
                  : ''
              }`}
              title="Pick Custom RGB Color"
              style={{
                background:
                  'conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
            >
              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>

          {/* Stroke Width Slider & Presets */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-950 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Stroke:</span>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={drawStrokeWidth}
              onChange={(e) => setDrawStrokeWidth(parseFloat(e.target.value))}
              className="w-14 h-1 bg-slate-300 dark:bg-zinc-700 accent-brand-500 dark:accent-teal-500 rounded-lg cursor-pointer"
              title={`Thickness: ${drawStrokeWidth.toFixed(1)}`}
            />
            <div
              className="rounded-full shrink-0 border border-slate-900/20 dark:border-zinc-900 shadow-sm"
              style={{
                backgroundColor: drawColor,
                width: `${Math.max(3, Math.min(12, drawStrokeWidth * 6))}px`,
                height: `${Math.max(3, Math.min(12, drawStrokeWidth * 6))}px`,
              }}
            />
          </div>
        </div>

        {/* Right: Keyboard Shortcuts Reference */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-500 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">Space</kbd> Play</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">P</kbd> Pin</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">D</kbd> Pen</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">R</kbd> Rect</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">O</kbd> Circle</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 font-mono text-[9px]">A</kbd> Arrow</span>
          </div>
        </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
});
