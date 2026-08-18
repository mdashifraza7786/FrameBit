'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Loader2,
} from 'lucide-react';
import { formatSMPTETimecode, formatTimecode, formatDuration } from '@/lib/timecode';
import { CommentData } from '@/lib/types';

interface VideoPlayerProps {
  src: string;
  comments: CommentData[];
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string, timestamp: number) => void;
  onAddCommentAtTime?: (timestamp: number, frameNumber: number) => void;
  seekToTime?: number | null;
}

export function VideoPlayer({
  src,
  comments,
  activeCommentId,
  onSelectComment,
  onAddCommentAtTime,
  seekToTime,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

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
  const [showSMPTE, setShowSMPTE] = useState(true);
  const [fps] = useState(30);

  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    setIsBuffering(false);
  }, []);

  // Safe play helper to avoid AbortError when unmounted or paused
  const safePlay = useCallback(() => {
    if (!videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          clearBuffering();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  // Sync seekToTime from props
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime);
      safePause();
    }
  }, [seekToTime, safePause]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      safePlay();
    } else {
      safePause();
    }
  }, [safePlay, safePause]);

  const stepFrames = useCallback(
    (direction: 1 | -1) => {
      if (!videoRef.current) return;
      safePause();
      const frameDelta = 1 / fps;
      const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + direction * frameDelta));
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration, fps, safePause]
  );

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts (Space, J/K/L, Left/Right arrows, F, M, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepFrames(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrames(1);
          break;
        case 'KeyJ':
          e.preventDefault();
          if (videoRef.current) {
            setIsBuffering(true);
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 2);
          }
          break;
        case 'KeyK':
          e.preventDefault();
          safePause();
          break;
        case 'KeyL':
          e.preventDefault();
          if (videoRef.current) {
            setIsBuffering(true);
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 2);
          }
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted((prev) => !prev);
          break;
        case 'KeyC':
          e.preventDefault();
          if (onAddCommentAtTime) {
            const currentFrame = Math.floor(currentTime * fps);
            onAddCommentAtTime(currentTime, currentFrame);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, safePause, stepFrames, toggleFullscreen, duration, currentTime, fps, onAddCommentAtTime]);

  // Calculate time from horizontal clientX position on timeline
  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || duration === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pos * duration;
    },
    [duration]
  );

  // Pointer Down (Press, hold & slide tracker)
  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    wasPlayingBeforeScrubRef.current = !videoRef.current.paused;

    safePause();
    setIsBuffering(true);

    const targetTime = getTimeFromClientX(e.clientX);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Pointer Move (Scrubbing / Dragging tracker)
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
    }
  };

  // Pointer Up (Release scrubber)
  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    isScrubbingRef.current = false;
    setIsScrubbing(false);

    if (wasPlayingBeforeScrubRef.current && videoRef.current) {
      safePlay();
    }
  };

  const handleTimelineMouseLeave = () => {
    if (!isScrubbingRef.current) {
      setHoverTime(null);
      setHoverX(null);
    }
  };

  const currentFrame = Math.floor(currentTime * fps);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl group select-none"
    >
      {/* Video Viewport */}
      <div
        className="relative aspect-video bg-black flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          playsInline
          className="w-full h-full object-contain"
          onTimeUpdate={() => {
            if (videoRef.current && !isScrubbingRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              clearBuffering();
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              videoRef.current.volume = volume;
              videoRef.current.muted = isMuted;
              videoRef.current.playbackRate = playbackSpeed;
              clearBuffering();
            }
          }}
          onWaiting={() => triggerBuffering(250)}
          onSeeking={() => triggerBuffering(200)}
          onSeeked={() => clearBuffering()}
          onCanPlay={() => clearBuffering()}
          onCanPlayThrough={() => clearBuffering()}
          onPlaying={() => {
            clearBuffering();
            setIsPlaying(true);
          }}
          onPause={() => {
            clearBuffering();
            setIsPlaying(false);
          }}
          onEnded={() => {
            clearBuffering();
            setIsPlaying(false);
          }}
        />

        {/* Buffering & Seeking Spinner Overlay */}
        {isBuffering && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30 animate-in fade-in duration-150">
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-teal-500/30 shadow-2xl flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              <span className="text-xs font-mono font-medium text-zinc-200">Buffering video...</span>
            </div>
          </div>
        )}

        {/* Center Play/Pause Overlay indicator on click */}
        {!isPlaying && !isBuffering && (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none transition-opacity">
            <div className="w-16 h-16 rounded-full bg-teal-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transform transition hover:scale-110">
              <Play className="w-7 h-7 fill-white translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Control Bar & Timeline */}
      <div className="bg-zinc-950/95 border-t border-zinc-800/80 p-3.5 space-y-3">
        {/* Interactive Timeline Track with Hold & Slide Scrubber */}
        <div
          ref={timelineRef}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onPointerCancel={handleTimelinePointerUp}
          onMouseLeave={handleTimelineMouseLeave}
          className="relative h-7 flex items-center cursor-pointer group/timeline touch-none"
        >
          {/* Track background */}
          <div className="w-full h-2 bg-zinc-800/90 rounded-full overflow-hidden relative group-hover/timeline:h-2.5 transition-all">
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-cyan-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Playhead Handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-xl border-2 border-teal-500 -ml-2 pointer-events-none transition-transform ${
              isScrubbing ? 'scale-150 ring-4 ring-teal-500/30' : 'group-hover/timeline:scale-125'
            }`}
            style={{ left: `${progressPercent}%` }}
          />

          {/* Comment Markers on Timeline */}
          {duration > 0 &&
            comments.map((comment) => {
              const markerPos = (comment.timestamp / duration) * 100;
              const isActive = activeCommentId === comment._id;
              const isResolved = comment.resolved;

              return (
                <div
                  key={comment._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectComment) onSelectComment(comment._id, comment.timestamp);
                  }}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group/marker transition-transform cursor-pointer ${
                    isActive ? 'scale-150 z-30' : 'hover:scale-125'
                  }`}
                  style={{ left: `${markerPos}%` }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 border-zinc-950 shadow-md ${
                      isResolved
                        ? 'bg-emerald-500'
                        : isActive
                        ? 'bg-cyan-400 ring-2 ring-teal-400/50'
                        : 'bg-amber-400'
                    }`}
                  />

                  {/* Marker Tooltip Preview on hover */}
                  <div className="hidden group-hover/marker:block absolute bottom-6 left-1/2 -translate-x-1/2 w-48 p-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-[11px] text-zinc-200 pointer-events-none z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between font-semibold text-[10px] text-zinc-400 mb-1">
                      <span>{comment.userId?.name || comment.guestName || 'Reviewer'}</span>
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

        {/* Lower Controller Bar */}
        <div className="flex items-center justify-between gap-4">
          {/* Left Controls: Play, Step Frames, Timecode */}
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/20 transition-all"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            {/* Frame Step Back */}
            <button
              onClick={() => stepFrames(-1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Previous Frame (Left Arrow / J)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Frame Step Forward */}
            <button
              onClick={() => stepFrames(1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Next Frame (Right Arrow / L)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Timecode and Frame Number Display */}
            <button
              onClick={() => setShowSMPTE(!showSMPTE)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:border-zinc-700 transition-colors"
              title="Click to toggle SMPTE timecode / standard"
            >
              <span className="font-semibold text-teal-400">
                {showSMPTE ? formatSMPTETimecode(currentTime, fps) : formatTimecode(currentTime)}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500">
                {showSMPTE ? formatSMPTETimecode(duration, fps) : formatDuration(duration)}
              </span>
              <span className="text-[10px] text-zinc-500 ml-1">({currentFrame}f)</span>
            </button>
          </div>

          {/* Center: Quick Add Comment at current frame */}
          {onAddCommentAtTime && (
            <button
              onClick={() => onAddCommentAtTime(currentTime, currentFrame)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-teal-600/20 border border-zinc-800 hover:border-teal-500/40 text-xs font-semibold text-zinc-300 hover:text-teal-300 transition-all shadow-sm"
              title="Leave timestamped comment (C)"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-teal-400" />
              <span>Comment at {formatTimecode(currentTime)}</span>
            </button>
          )}

          {/* Right Controls: Speed, Volume, Fullscreen */}
          <div className="flex items-center gap-2.5">
            {/* Speed Selector */}
            <div className="relative group/speed">
              <button className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors">
                {playbackSpeed}x
              </button>
              <div className="hidden group-hover/speed:flex absolute bottom-full right-0 mb-1 flex-col bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-2xl z-50">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (videoRef.current) videoRef.current.playbackRate = spd;
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded-lg text-left transition-colors ${
                      playbackSpeed === spd ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
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
                className="w-16 h-1 bg-zinc-800 accent-teal-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
