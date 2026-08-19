'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  FolderKanban,
  Film,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { StatusBadge } from '@/components/video/StatusBadge';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const metrics = data?.metrics || {
    totalProjects: 0,
    totalVideos: 0,
    waitingForReview: 0,
    changesRequested: 0,
    approvedVideos: 0,
    unresolvedComments: 0,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900/20 via-slate-100 to-white dark:from-teal-950/40 dark:via-zinc-900/80 dark:to-zinc-950 border border-teal-500/20 p-8 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Workspace Overview
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back, {user?.name || 'Creator'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-xl">
                Collaborate on high-precision video cuts, gather timecoded notes, and store everything directly on your Google Drive.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/projects"
                className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-teal-600/25 flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> New Project
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Projects</span>
              <FolderKanban className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{metrics.totalProjects}</div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">Active workspaces</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">In Review</span>
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-mono">{metrics.waitingForReview}</div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">Awaiting feedback</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Changes Req.</span>
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400 font-mono">{metrics.changesRequested}</div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">Needs revision</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Approved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 font-mono">{metrics.approvedVideos}</div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">Ready for export</span>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-2 col-span-2 md:col-span-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Unresolved</span>
              <Film className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">{metrics.unresolvedComments}</div>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">Open timecode notes</span>
          </div>
        </div>

        {/* Section: Recent Projects & Review Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Column (1/3) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Recent Projects
              </h2>
              <Link href="/projects" className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold">
                View all →
              </Link>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                </div>
              ) : !data?.recentProjects || data.recentProjects.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 text-center space-y-2">
                  <FolderKanban className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">No projects created yet.</p>
                  <Link
                    href="/projects"
                    className="inline-block text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                  >
                    Create your first project
                  </Link>
                </div>
              ) : (
                data.recentProjects.map((proj: any) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="block p-4 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 hover:border-teal-500/40 dark:hover:border-teal-500/40 transition-all group shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm text-slate-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {proj.name}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 group-hover:text-slate-700 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    {proj.description && (
                      <p className="text-xs text-slate-500 dark:text-zinc-500 line-clamp-1 mb-2.5">{proj.description}</p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                      <span>{proj.membersCount} members</span>
                      <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Videos Review Queue Column (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Film className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Active Video Queue
              </h2>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                </div>
              ) : !data?.recentVideos || data.recentVideos.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 text-center space-y-2">
                  <Film className="w-10 h-10 text-slate-400 dark:text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No videos uploaded yet</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    Open a project to upload cuts directly to Google Drive.
                  </p>
                </div>
              ) : (
                data.recentVideos.map((vid: any) => (
                  <Link
                    key={vid.id}
                    href={`/projects/${vid.projectId}/videos/${vid.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 hover:border-teal-500/40 dark:hover:border-teal-500/40 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-9 rounded-xl bg-slate-900 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 overflow-hidden relative shadow-sm">
                        <img
                          src={vid.thumbnailUrl || `/api/videos/${vid.id}/thumbnail`}
                          alt={vid.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-teal-500/10 pointer-events-none flex items-center justify-center">
                          <Film className="w-4 h-4 text-teal-400 opacity-60" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                            {vid.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 font-mono">
                            v{vid.currentVersionNumber}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-zinc-500">In project &ldquo;{vid.projectName}&rdquo;</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <StatusBadge status={vid.status} />
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline">
                        {new Date(vid.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
