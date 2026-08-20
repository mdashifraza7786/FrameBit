'use client';

import React, { useState } from 'react';
import { ChevronDown, History, Plus, Check, Trash2, AlertTriangle, Film } from 'lucide-react';
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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:border-brand-500/40 dark:hover:border-teal-500/40 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-teal-400 animate-pulse" />
        <span>Version {currentVersionNumber}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setConfirmDeleteVersion(null);
            }}
          />
          <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium bg-slate-50 dark:bg-zinc-900/90">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                <History className="w-3.5 h-3.5 text-brand-600 dark:text-teal-400" /> Version History
              </span>
              <span className="text-[11px] font-mono">{versions.length} cut{versions.length > 1 ? 's' : ''}</span>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100 dark:divide-zinc-800/40">
              {versions.map((ver) => {
                const isSelected = ver.versionNumber === currentVersionNumber;
                const isConfirming = confirmDeleteVersion === ver.versionNumber;

                return (
                  <div
                    key={ver._id}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-teal-600/20 border border-brand-500/30 dark:border-teal-500/30'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
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
                        <span className={`font-semibold text-xs font-mono ${isSelected ? 'text-brand-700 dark:text-teal-300 font-bold' : 'text-slate-800 dark:text-zinc-200'}`}>
                          v{ver.versionNumber}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/20 dark:bg-teal-500/20 text-brand-600 dark:text-teal-400 font-medium">
                            Active
                          </span>
                        )}
                        {ver.changeNotes && (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-400 truncate max-w-[110px]">
                            • {ver.changeNotes}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                        {formatFileSize(ver.size)} • {new Date(ver.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Right actions: Checkmark or Delete Button */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && !isConfirming && (
                        <Check className="w-4 h-4 text-brand-600 dark:text-teal-400 mr-1" />
                      )}

                      {isAuthorized && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(ver.versionNumber, e)}
                          title={isConfirming ? 'Click again to confirm delete' : `Delete version v${ver.versionNumber}`}
                          className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                            isConfirming
                              ? 'bg-rose-500 text-white font-bold animate-pulse px-2'
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
            <div className="p-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 space-y-1.5">
              {isAuthorized && onUploadNewVersion && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onUploadNewVersion();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 dark:shadow-teal-600/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Upload New Version
                </button>
              )}

              {isAuthorized && onDeleteAsset && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onDeleteAsset();
                  }}
                  className="w-full py-1.5 px-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete entire video asset
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
