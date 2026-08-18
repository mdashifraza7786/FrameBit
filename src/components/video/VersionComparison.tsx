'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Play, Pause, Columns2, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { VideoVersionData } from '@/lib/types';
import { formatTimecode } from '@/lib/timecode';

interface VersionComparisonProps {
  versions: VideoVersionData[];
  videoId: string;
  onClose: () => void;
}

type CompareMode = 'side-by-side' | 'wipe';

export function VersionComparison({ versions, videoId, onClose }: VersionComparisonProps) {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [versionA, setVersionA] = useState(versions[versions.length - 1]?.versionNumber ?? 1);
  const [versionB, setVersionB] = useState(
    versions.length >= 2 ? versions[versions.length - 2]?.versionNumber ?? 1 : versions[0]?.versionNumber ?? 1
  );
  const [mode, setMode] = useState<CompareMode>('side-by-side');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wipePosition, setWipePosition] = useState(50); // % from left
  const [isDraggingWipe, setIsDraggingWipe] = useState(false);
  const wipeContainerRef = useRef<HTMLDivElement>(null);

  const srcA = `/api/videos/${videoId}/stream?version=${versionA}`;
  const srcB = `/api/videos/${videoId}/stream?version=${versionB}`;

  // Sync videos
  const syncVideos = useCallback((time?: number) => {
    [videoARef.current, videoBRef.current].forEach((v) => {
      if (!v) return;
      if (time !== undefined) v.currentTime = time;
    });
  }, []);

  const togglePlay = useCallback(() => {
    const videos = [videoARef.current, videoBRef.current].filter(Boolean) as HTMLVideoElement[];
    if (isPlaying) {
      videos.forEach((v) => v.pause());
      setIsPlaying(false);
    } else {
      videos.forEach((v) => v.play().catch(() => {}));
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (videoARef.current) {
      setCurrentTime(videoARef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoARef.current) {
      setDuration(videoARef.current.duration);
    }
  };

  // Keep videos in sync when A updates
  useEffect(() => {
    const handleATimeUpdate = () => {
      if (videoARef.current && videoBRef.current) {
        if (Math.abs(videoARef.current.currentTime - videoBRef.current.currentTime) > 0.1) {
          videoBRef.current.currentTime = videoARef.current.currentTime;
        }
        setCurrentTime(videoARef.current.currentTime);
      }
    };
    const a = videoARef.current;
    a?.addEventListener('timeupdate', handleATimeUpdate);
    return () => a?.removeEventListener('timeupdate', handleATimeUpdate);
  }, [versionA, versionB]);

  // Wipe drag handlers
  const handleWipePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingWipe(true);
    updateWipeFromEvent(e);
  };
  const handleWipePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingWipe) return;
    updateWipeFromEvent(e);
  };
  const handleWipePointerUp = () => setIsDraggingWipe(false);

  const updateWipeFromEvent = (e: React.PointerEvent) => {
    if (!wipeContainerRef.current) return;
    const rect = wipeContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setWipePosition(pct);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-white">Version Comparison</h2>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode('side-by-side')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'side-by-side'
                  ? 'bg-teal-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" /> Side by Side
            </button>
            <button
              onClick={() => setMode('wipe')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'wipe'
                  ? 'bg-teal-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Wipe
            </button>
          </div>
        </div>

        {/* Version selectors */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 font-medium">Left:</span>
            <select
              value={versionA}
              onChange={(e) => setVersionA(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
            >
              {versions.map((v) => (
                <option key={v.versionNumber} value={v.versionNumber}>
                  v{v.versionNumber} — {v.filename}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 font-medium">Right:</span>
            <select
              value={versionB}
              onChange={(e) => setVersionB(Number(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-teal-500"
            >
              {versions.map((v) => (
                <option key={v.versionNumber} value={v.versionNumber}>
                  v{v.versionNumber} — {v.filename}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {mode === 'side-by-side' ? (
          <div className="flex-1 flex gap-2 p-3 min-h-0">
            {/* Video A */}
            <div className="flex-1 relative flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-semibold text-teal-400">v{versionA} (Left)</span>
                <span className="text-[10px] text-zinc-500 font-mono">{versions.find(v => v.versionNumber === versionA)?.filename}</span>
              </div>
              <div className="flex-1 min-h-0 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                <video
                  ref={videoARef}
                  src={srcA}
                  className="w-full h-full object-contain"
                  preload="auto"
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-zinc-700/60 self-stretch" />

            {/* Video B */}
            <div className="flex-1 relative flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-semibold text-amber-400">v{versionB} (Right)</span>
                <span className="text-[10px] text-zinc-500 font-mono">{versions.find(v => v.versionNumber === versionB)?.filename}</span>
              </div>
              <div className="flex-1 min-h-0 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                <video
                  ref={videoBRef}
                  src={srcB}
                  className="w-full h-full object-contain"
                  preload="auto"
                  playsInline
                />
              </div>
            </div>
          </div>
        ) : (
          /* Wipe Mode */
          <div className="flex-1 min-h-0 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs text-zinc-400">Drag the <span className="text-teal-400 font-semibold">wipe handle</span> to compare versions</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-teal-400 font-semibold">← v{versionA}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-amber-400 font-semibold">v{versionB} →</span>
              </div>
            </div>
            <div
              ref={wipeContainerRef}
              className="flex-1 min-h-0 relative bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 cursor-col-resize select-none"
              onPointerDown={handleWipePointerDown}
              onPointerMove={handleWipePointerMove}
              onPointerUp={handleWipePointerUp}
              onPointerCancel={handleWipePointerUp}
            >
              {/* Video B (underneath — right side) */}
              <video
                ref={videoBRef}
                src={srcB}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                preload="auto"
                playsInline
              />

              {/* Video A clipped (left side) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${wipePosition}%` }}
              >
                <video
                  ref={videoARef}
                  src={srcA}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ width: `${(100 / wipePosition) * 100}%`, maxWidth: 'none' }}
                  preload="auto"
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>

              {/* Wipe Handle Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none z-10"
                style={{ left: `${wipePosition}%` }}
              >
                {/* Drag handle */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-xl border-2 border-zinc-200 cursor-col-resize pointer-events-auto">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                {/* Version labels */}
                <div className="absolute top-2 -left-12 text-[10px] font-bold text-teal-400 bg-zinc-900/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                  v{versionA}
                </div>
                <div className="absolute top-2 left-2 text-[10px] font-bold text-amber-400 bg-zinc-900/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                  v{versionB}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shared Controls */}
        <div className="shrink-0 px-5 py-3 bg-zinc-950 border-t border-zinc-800 space-y-2">
          {/* Timeline */}
          <div className="relative h-5 flex items-center">
            <div
              className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                if (!wipeContainerRef.current) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const t = ((e.clientX - rect.left) / rect.width) * duration;
                  syncVideos(t);
                }
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-teal-600 to-cyan-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => syncVideos(0)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center shadow-lg transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-0.5" />}
            </button>
            <span className="text-xs font-mono text-zinc-400">{formatTimecode(currentTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
