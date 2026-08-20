'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Sparkles, Film, Image as ImageIcon } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  assetId?: string; // Optional: If provided, uploads as a new version to existing asset
  existingAssetName?: string;
  onSuccess: () => void;
}

async function extractVideoThumbnail(file: File): Promise<{ dataUrl: string; duration: number }> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        const duration = video.duration || 0;
        video.currentTime = Math.min(1.0, duration > 1 ? 1.0 : duration * 0.5);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = Math.round((640 * (video.videoHeight || 9)) / (video.videoWidth || 16));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            URL.revokeObjectURL(url);
            resolve({ dataUrl, duration: video.duration || 0 });
            return;
          }
        } catch {}
        URL.revokeObjectURL(url);
        resolve({ dataUrl: '', duration: video.duration || 0 });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ dataUrl: '', duration: 0 });
      };
    } catch {
      resolve({ dataUrl: '', duration: 0 });
    }
  });
}

export function UploadModal({
  isOpen,
  onClose,
  projectId,
  assetId,
  existingAssetName,
  onSuccess,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'initiating' | 'uploading' | 'finalizing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    if (!assetName && !assetId) {
      setAssetName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }

    // Extract real thumbnail preview from the video
    const { dataUrl, duration } = await extractVideoThumbnail(selectedFile);
    if (dataUrl) {
      setThumbnailPreview(dataUrl);
    }
    if (duration) {
      setVideoDuration(duration);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus('initiating');
      setErrorMessage('');
      setProgress(0);

      // Compute target filename preserving extension
      const fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4';
      const cleanTitle = (assetName?.trim() || existingAssetName?.trim() || file.name.replace(/\.[^/.]+$/, '')).trim();
      const targetDriveFilename = cleanTitle.endsWith(fileExt) ? cleanTitle : `${cleanTitle}${fileExt}`;

      // Generate or retrieve thumbnail
      let currentThumbnail = thumbnailPreview;
      let currentDuration = videoDuration;
      if (!currentThumbnail) {
        const extracted = await extractVideoThumbnail(file);
        currentThumbnail = extracted.dataUrl;
        currentDuration = extracted.duration;
      }

      // Step 1: Request Direct Resumable Upload Session from Google Drive (via API)
      const sessionRes = await fetch(`/api/projects/${projectId}/videos/upload-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: targetDriveFilename,
          mimeType: file.type || 'video/mp4',
          size: file.size,
        }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        throw new Error(err.error || 'Failed to initiate upload session');
      }

      const { uploadUrl, driveFolderId } = await sessionRes.json();

      // Step 2: Upload Direct to Google Drive using XHR for smooth progress tracking
      setUploadStatus('uploading');

      let driveFileId: string | null = null;
      let directSuccess = false;

      try {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        const resData = await new Promise<any>((resolve, reject) => {
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
              let parsed = null;
              try {
                parsed = JSON.parse(xhr.responseText);
              } catch {}
              resolve(parsed);
            } else {
              reject(new Error(`Direct Drive upload returned status: ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('CORS or network error during direct browser upload'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));

          xhr.send(file);
        });

        driveFileId = resData?.id || null;
        directSuccess = true;
      } catch (directErr: any) {
        console.warn('Direct upload error, falling back to server stream proxy:', directErr.message);

        // Fallback: Stream directly to Google Drive via server proxy
        const proxyFormData = new FormData();
        proxyFormData.append('file', file);
        if (assetId) proxyFormData.append('assetId', assetId);
        proxyFormData.append('assetName', cleanTitle);
        if (changeNotes) proxyFormData.append('changeNotes', changeNotes);
        if (currentThumbnail) proxyFormData.append('thumbnailUrl', currentThumbnail);

        const proxyXhr = new XMLHttpRequest();
        xhrRef.current = proxyXhr;

        proxyXhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        await new Promise<any>((resolve, reject) => {
          proxyXhr.open('POST', `/api/projects/${projectId}/videos/upload-proxy`, true);

          proxyXhr.onload = () => {
            if (proxyXhr.status >= 200 && proxyXhr.status < 300) {
              try {
                resolve(JSON.parse(proxyXhr.responseText));
              } catch {
                resolve({});
              }
            } else {
              try {
                const errData = JSON.parse(proxyXhr.responseText);
                reject(new Error(errData.error || 'Server stream proxy upload failed'));
              } catch {
                reject(new Error(`Proxy upload failed with status ${proxyXhr.status}`));
              }
            }
          };

          proxyXhr.onerror = () => reject(new Error('Network error during upload'));
          proxyXhr.onabort = () => reject(new Error('Upload cancelled'));

          proxyXhr.send(proxyFormData);
        });

        setUploadStatus('success');
        setProgress(100);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
        return;
      }

      // Step 3: Complete direct upload registration in MongoDB
      if (directSuccess) {
        setUploadStatus('finalizing');

        if (!driveFileId) {
          driveFileId = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        const completeRes = await fetch(`/api/projects/${projectId}/videos/complete-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId,
            assetName: cleanTitle,
            filename: targetDriveFilename,
            mimeType: file.type || 'video/mp4',
            size: file.size,
            duration: currentDuration,
            thumbnailUrl: currentThumbnail,
            driveFileId,
            driveFolderId,
            changeNotes,
          }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json();
          throw new Error(err.error || 'Failed to finalize video in database');
        }

        setUploadStatus('success');
        setProgress(100);

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Upload process error:', err);
      setUploadStatus('error');
      setErrorMessage(err.message || 'An error occurred during upload');
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploadStatus('idle');
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-brand-500/10 dark:bg-teal-600/20 text-brand-600 dark:text-teal-400 border border-brand-500/30 dark:border-teal-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">
                {assetId ? `Upload New Version (v+1)` : 'Upload Video to Google Drive'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {existingAssetName ? `For cut: "${existingAssetName}"` : 'Direct upload into project folder'}
              </p>
            </div>
          </div>
          {uploadStatus !== 'uploading' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Dropzone & Preview */}
        {!file && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
              isDragOver
                ? 'border-brand-500 bg-brand-500/10 dark:border-teal-500 dark:bg-teal-500/10'
                : 'border-slate-300 dark:border-zinc-800 hover:border-brand-500/50 dark:hover:border-teal-500/50 hover:bg-slate-50 dark:hover:bg-zinc-950/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 dark:bg-teal-600/15 border border-brand-500/30 dark:border-teal-500/30 flex items-center justify-center text-brand-600 dark:text-teal-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Click to upload or drag & drop</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">MP4, MOV, WebM, or MKV up to 5GB</p>
            </div>
          </div>
        )}

        {/* Selected File Details & Thumbnail Preview */}
        {file && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-16 h-10 object-cover rounded-lg border border-slate-300 dark:border-zinc-700 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-teal-600/20 text-brand-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Film className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB • {file.type || 'video'}
                  </p>
                </div>
              </div>
              {uploadStatus === 'idle' && (
                <button
                  onClick={() => {
                    setFile(null);
                    setThumbnailPreview('');
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Change
                </button>
              )}
            </div>

            {/* Asset Title (for new uploads) */}
            {!assetId && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                  Video Title (Displayed in App & Google Drive)
                </label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g. Hero Cut - Color Graded"
                  disabled={uploadStatus !== 'idle'}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500 disabled:opacity-50"
                />
              </div>
            )}

            {/* Version Change Notes (optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                Version Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="e.g. Adjusted audio mix and color timing on scenes 3-5"
                disabled={uploadStatus !== 'idle'}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-brand-500 dark:focus:border-teal-500 resize-none disabled:opacity-50"
              />
            </div>

            {/* Upload Progress & Status Feedback */}
            {uploadStatus !== 'idle' && (
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                    {uploadStatus === 'initiating' && 'Initiating Google Drive Session...'}
                    {uploadStatus === 'uploading' && 'Uploading directly to Google Drive...'}
                    {uploadStatus === 'finalizing' && 'Saving video metadata & thumbnail...'}
                    {uploadStatus === 'success' && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Upload Complete!
                      </span>
                    )}
                    {uploadStatus === 'error' && (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-500" /> Upload Error
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-brand-600 dark:text-teal-400">{progress}%</span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 to-brand-400 dark:from-teal-600 dark:to-cyan-500 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {errorMessage && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errorMessage}</p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {uploadStatus === 'uploading' ? (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-500/20 transition-colors"
                >
                  Cancel Upload
                </button>
              ) : uploadStatus === 'idle' ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={startUpload}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-lg shadow-brand-600/25 dark:shadow-teal-600/25 transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Start Upload
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
