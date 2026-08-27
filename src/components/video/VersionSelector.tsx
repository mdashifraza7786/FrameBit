'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, History, Plus, Check, Trash2, X } from 'lucide-react';
import { VideoVersionData } from '@/lib/types';
import { formatFileSize } from '@/lib/timecode';

interface VersionSelectorProps {
  versions: VideoVersionData[];
  currentVersionNumber: number;
  onSelectVersion: (versionNumber: number) => void;
  onUploadNewVersion?: () => void;
  onDeleteVersion?: (versionNumber: number) => void;
  onDeleteAsset?: () => void;
  canManage?: boolean;
  canUpload?: boolean;
}

export function VersionSelector({
  versions,
  currentVersionNumber,
  onSelectVersion,
  onUploadNewVersion,
  onDeleteVersion,
  onDeleteAsset,
  canManage = false,
  canUpload = false,
}: VersionSelectorProps) {
  const isAuthorized = canManage || canUpload;
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = (versionNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteVersion === versionNumber) {
      if (onDeleteVersion) {
        onDeleteVersion(versionNumber);
      }
      setConfirmDeleteVersion(null);
    } else {
      setConfirmDeleteVersion(versionNumber);
    }
  };

  return (
    <>
      <div className="relative shrink-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:border-brand-500/40 dark:hover:border-teal-500/40 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors shadow-sm shrink-0"
          title={`Current Version: v${currentVersionNumber}`}
        >
          <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-teal-400 animate-pulse shrink-0" />
          <span className="hidden sm:inline">Version</span>
          <span className="font-mono">v{currentVersionNumber}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Centered Modal with Portal attached directly to document.body */}
      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => {
            setIsOpen(false);
            setConfirmDeleteVersion(null);
          }}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium bg-slate-50 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                  <History className="w-4 h-4 text-brand-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Version History</h3>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    {versions.length} cut{versions.length > 1 ? 's' : ''} available
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setConfirmDeleteVersion(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Version List */}
            <div className="max-h-72 sm:max-h-80 overflow-y-auto p-2.5 sm:p-3 space-y-1.5 custom-scrollbar">
              {versions.map((ver) => {
                const isSelected = ver.versionNumber === currentVersionNumber;
                const isConfirming = confirmDeleteVersion === ver.versionNumber;

                return (
                  <div
                    key={ver._id}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl transition-all ${
                      isSelected
                        ? 'bg-brand-50/80 dark:bg-teal-600/20 border border-brand-500/30 dark:border-teal-500/40 shadow-sm'
                        : 'bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/60 dark:border-zinc-800/60 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    {/* Version Details (Click to Switch) */}
                    <div
                      onClick={() => {
                        onSelectVersion(ver.versionNumber);
                        setIsOpen(false);
                      }}
                      className="flex-1 min-w-0 cursor-pointer pr-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs sm:text-sm font-mono ${isSelected ? 'text-brand-700 dark:text-teal-300 font-bold' : 'text-slate-800 dark:text-zinc-200'}`}>
                          v{ver.versionNumber}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-500/20 dark:bg-teal-500/20 text-brand-600 dark:text-teal-400 font-bold">
                            Current
                          </span>
                        )}
                        {ver.changeNotes && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-400 truncate max-w-[140px] sm:max-w-[200px]">
                            • {ver.changeNotes}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-1">
                        {formatFileSize(ver.size)} • {new Date(ver.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Right actions: Checkmark or Delete Button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && !isConfirming && (
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 dark:bg-teal-500/20 flex items-center justify-center mr-1">
                          <Check className="w-3.5 h-3.5 text-brand-600 dark:text-teal-400" />
                        </div>
                      )}

                      {isAuthorized && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(ver.versionNumber, e)}
                          title={isConfirming ? 'Click again to confirm delete' : `Delete version v${ver.versionNumber}`}
                          className={`p-1.5 sm:p-2 rounded-xl transition-colors text-xs flex items-center gap-1 ${
                            isConfirming
                              ? 'bg-rose-500 text-white font-bold animate-pulse px-2.5'
                              : 'text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isConfirming && <span>Confirm</span>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions: Upload New Cut or Delete Entire Asset */}
            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/60 space-y-2">
              {isAuthorized && onUploadNewVersion && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onUploadNewVersion();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 dark:shadow-teal-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Upload New Version
                </button>
              )}

              {isAuthorized && onDeleteAsset && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onDeleteAsset();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete entire video asset
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
