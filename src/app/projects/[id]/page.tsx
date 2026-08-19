'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  FolderKanban,
  Film,
  Plus,
  Users,
  HardDrive,
  Trash2,
  ChevronRight,
  UserPlus,
  X,
  Play,
  ListChecks,
  CheckSquare,
  Square,
} from 'lucide-react';
import { StatusBadge } from '@/components/video/StatusBadge';
import { UploadModal } from '@/components/video/UploadModal';
import { VideoAssetData, ProjectData, UserRole, ReviewStatus } from '@/lib/types';

const BULK_STATUS_OPTIONS: ReviewStatus[] = ['Draft', 'In Review', 'Changes Requested', 'Approved'];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [videoAssets, setVideoAssets] = useState<VideoAssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('reviewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ReviewStatus>('In Review');
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setVideoAssets(data.videoAssets || []);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isInviting) return;

    setIsInviting(true);
    setInviteError('');

    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || 'Failed to add member');
      } else {
        setInviteEmail('');
        await fetchProjectData();
      }
    } catch (err: any) {
      setInviteError(err.message || 'Error adding member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchProjectData();
      }
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project and its video asset metadata?')) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleDeleteVideo = async (videoId: string, videoName: string) => {
    if (!confirm(`Are you sure you want to delete "${videoName}" and all its versions from Google Drive?`)) return;

    try {
      const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjectData();
      }
    } catch (err) {
      console.error('Error deleting video:', err);
    }
  };

  const toggleSelect = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === videoAssets.length ? new Set() : new Set(videoAssets.map((v) => v._id))
    );
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isBulkWorking) return;
    if (!confirm(`Delete ${selectedIds.size} selected video(s) and all their versions from Google Drive? This cannot be undone.`)) return;

    setIsBulkWorking(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((videoId) => fetch(`/api/videos/${videoId}`, { method: 'DELETE' }))
      );
      exitSelectMode();
      await fetchProjectData();
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0 || isBulkWorking) return;

    setIsBulkWorking(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((videoId) =>
          fetch(`/api/videos/${videoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: bulkStatus }),
          })
        )
      );
      exitSelectMode();
      await fetchProjectData();
    } catch (err) {
      console.error('Bulk status change error:', err);
    } finally {
      setIsBulkWorking(false);
    }
  };

  const isOwner = project?.userRole === 'owner';
  const canUpload = ['owner', 'editor'].includes(project?.userRole || '');
  const canChangeStatus = ['owner', 'reviewer'].includes(project?.userRole || '');

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!project) return null;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">
          <Link href="/projects" className="hover:text-teal-600 dark:hover:text-zinc-300 transition-colors">
            Projects
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-zinc-300 font-semibold">{project.name}</span>
        </div>

        {/* Project Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm shadow-xl">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {project.name}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-teal-700 dark:text-teal-400 border border-slate-200 dark:border-zinc-700 font-semibold uppercase tracking-wider shrink-0">
                {project.userRole}
              </span>
            </div>
            {project.description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-2xl">{project.description}</p>
            )}
            <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-zinc-500 pt-1">
              <span>Owner: {project.owner?.name || 'Owner'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Stored in Google Drive
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Team Members Button */}
            <button
              onClick={() => setMembersModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-2 transition-all shadow-sm"
            >
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Team ({project.members?.length ? project.members.length + 1 : 1})</span>
            </button>

            {/* Upload Video Button */}
            {canUpload && (
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> Upload Video
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleDeleteProject}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 transition-colors"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video Assets Gallery */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Film className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Video Assets ({videoAssets.length})
            </h2>

            {videoAssets.length > 0 && (canUpload || canChangeStatus) && (
              <button
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  selectMode
                    ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-600'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}
          </div>

          {/* Bulk Action Bar */}
          {selectMode && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 hover:underline shrink-0"
              >
                {selectedIds.size === videoAssets.length ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === videoAssets.length ? 'Deselect All' : 'Select All'}
              </button>

              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                {selectedIds.size} selected
              </span>

              <div className="flex-1" />

              {canChangeStatus && (
                <div className="flex items-center gap-2">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as ReviewStatus)}
                    className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none"
                  >
                    {BULK_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkStatusChange}
                    disabled={selectedIds.size === 0 || isBulkWorking}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-semibold disabled:opacity-40 transition-all"
                  >
                    Set Status
                  </button>
                </div>
              )}

              {canUpload && (
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || isBulkWorking}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          )}

          {videoAssets.length === 0 ? (
            <div className="py-20 rounded-3xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 text-center space-y-3 shadow-sm">
              <Film className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-zinc-300">No videos in this project yet</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
                Upload your first video cut. It will stream and upload directly into your Google Drive folder.
              </p>
              {canUpload && (
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Upload Video
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {videoAssets.map((vid) => {
                const isSelected = selectedIds.has(vid._id);
                return (
                <Link
                  key={vid._id}
                  href={selectMode ? '#' : `/projects/${id}/videos/${vid._id}`}
                  onClick={(e) => {
                    if (selectMode) {
                      e.preventDefault();
                      toggleSelect(vid._id);
                    }
                  }}
                  className={`group flex flex-col justify-between p-5 rounded-3xl bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border transition-all shadow-xl hover:shadow-teal-500/5 space-y-4 ${
                    isSelected
                      ? 'border-teal-500 ring-2 ring-teal-500/40'
                      : 'border-slate-200 dark:border-zinc-800/80 hover:border-teal-500/40'
                  }`}
                >
                  {/* Thumbnail / Video Preview */}
                  <div className="aspect-video w-full rounded-2xl bg-slate-900 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800/80 flex items-center justify-center relative overflow-hidden group-hover:border-teal-500/40 transition-all shadow-inner">
                    <img
                      src={vid.thumbnailUrl || `/api/videos/${vid._id}/thumbnail`}
                      alt={vid.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback to thumbnail API or film icon
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />

                    {/* Gradient Overlay & Hover Play Button */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-60 group-hover:opacity-80 transition-opacity flex items-center justify-center">
                      {!selectMode && (
                        <div className="w-12 h-12 rounded-full bg-teal-600/90 text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200">
                          <Play className="w-5 h-5 fill-white translate-x-0.5" />
                        </div>
                      )}
                    </div>

                    {selectMode && (
                      <div className="absolute top-3 left-3 z-10">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-teal-400 bg-black/60 rounded" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-200 bg-black/60 rounded" />
                        )}
                      </div>
                    )}

                    {!selectMode && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-zinc-200 border border-zinc-700 font-mono font-semibold">
                          v{vid.currentVersionNumber}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-3 right-3 z-10">
                      <StatusBadge status={vid.status} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
                        {vid.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono block mt-0.5">
                        Updated {new Date(vid.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {canUpload && !selectMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteVideo(vid._id, vid.name);
                        }}
                        className="p-2 rounded-xl text-slate-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                        title="Delete video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          projectId={id}
          onSuccess={fetchProjectData}
        />

        {/* Team Members Modal */}
        {membersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">Project Members</h3>
                </div>
                <button
                  onClick={() => setMembersModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Add Member Form (Owner only) */}
              {isOwner && (
                <form onSubmit={handleInviteMember} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Add Collaborator
                  </span>

                  {inviteError && (
                    <p className="text-xs text-rose-500">{inviteError}</p>
                  )}

                  <div className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                    />

                    <div className="flex gap-2">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-zinc-300 focus:outline-none"
                      >
                        <option value="reviewer">Reviewer (Watch & Comment)</option>
                        <option value="editor">Editor (Upload & Manage Versions)</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isInviting || !inviteEmail.trim()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50 transition-all shrink-0"
                      >
                        {isInviting ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Members List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Owner */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-500/40">
                      {project.owner?.name?.charAt(0).toUpperCase() || 'O'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{project.owner?.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{project.owner?.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-500/40 text-teal-700 dark:text-teal-300 font-semibold uppercase">
                    Owner
                  </span>
                </div>

                {/* Team Members */}
                {project.members?.map((m) => (
                  <div
                    key={m.userId._id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-zinc-700">
                        {m.userId.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{m.userId.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">{m.userId.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 capitalize font-medium">
                        {m.role}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.userId._id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
