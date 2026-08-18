'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  FolderKanban,
  Plus,
  Search,
  HardDrive,
  Film,
  Users,
  X,
} from 'lucide-react';
import { ProjectData } from '@/lib/types';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || creating) return;

    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
        }),
      });

      if (res.ok) {
        setNewProjectName('');
        setNewProjectDesc('');
        setModalOpen(false);
        await fetchProjects();
      }
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setCreating(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <FolderKanban className="w-7 h-7 text-teal-600 dark:text-teal-400" />
              Projects
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Each project synchronizes as a dedicated subfolder on your Google Drive workspace.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2" />
          <input
            type="text"
            placeholder="Filter projects by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 dark:text-zinc-500">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-20 rounded-3xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 text-center space-y-3 shadow-sm">
            <FolderKanban className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-zinc-300">No projects found</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
              Create your first project to organize cuts and begin collaborating with your team.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col justify-between p-6 rounded-3xl bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 hover:border-teal-500/30 transition-all shadow-xl hover:shadow-teal-500/5 space-y-5"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-500/10 dark:bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 font-semibold uppercase tracking-wider">
                      {p.userRole || 'Member'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mb-1.5 line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 min-h-[32px]">
                    {p.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Film className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" /> {p.videoCount || 0} videos
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" /> {p.membersCount || 1}
                    </span>
                  </div>
                  <span className="font-mono">{new Date(p.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">Create New Project</h3>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/20 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 shrink-0" />
                <span>
                  A dedicated folder will be auto-created under <code>FrameBit/{newProjectName || '...'}</code> on Google Drive.
                </span>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Client XYZ - Brand Film"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Provide context or guidelines for the review team..."
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newProjectName.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
