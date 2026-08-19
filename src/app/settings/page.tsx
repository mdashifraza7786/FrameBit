'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Settings,
  HardDrive,
  User,
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

function SettingsContent() {
  const { user, refreshUser, disconnectDrive } = useAuth();
  const searchParams = useSearchParams();

  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('reviewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const driveConnectedQuery = searchParams.get('drive_connected');
  const errorQuery = searchParams.get('error');

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/team');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error fetching team:', err);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteMsg('');

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteEmail('');
        setInviteMsg(`Successfully added ${data.member.email} as ${data.member.role}!`);
        await fetchTeamMembers();
        setTimeout(() => setInviteMsg(''), 4000);
      } else {
        setInviteMsg(data.error || 'Failed to add member');
      }
    } catch (err: any) {
      setInviteMsg(err.message || 'Error adding member');
    } finally {
      setInviting(false);
    }
  };

  const fetchDriveStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
      }
    } catch (err) {
      console.error('Error fetching drive status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchDriveStatus();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const handleConnectDrive = async () => {
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('OAuth initiation error:', err);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Drive account?')) return;
    try {
      await disconnectDrive();
      await fetchDriveStatus();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || savingProfile) return;

    setSavingProfile(true);
    setProfileSuccess(false);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        setProfileSuccess(true);
        refreshUser();
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-teal-600 dark:text-teal-400" /> Settings & Integrations
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage your account profile and Google Drive video storage integration.
          </p>
        </div>

        {/* Query alerts */}
        {driveConnectedQuery === 'true' && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold">Google Drive Connected Successfully!</p>
              <p className="opacity-90">
                Your dedicated root folder <code>FrameBit</code> is ready. All project video cuts will be stored in your Drive account.
              </p>
            </div>
          </div>
        )}

        {errorQuery && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="font-semibold">Connection Error</p>
              <p className="opacity-90">{decodeURIComponent(errorQuery)}</p>
            </div>
          </div>
        )}

        {/* Section 1: Google Drive Storage Integration */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 dark:bg-teal-600/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">Google Drive Video Storage</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Direct-to-Drive zero server storage backend</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {driveStatus?.connected ? (
                <div className="flex flex-wrap items-center gap-2">
                  {driveStatus.folderUrl && (
                    <a
                      href={driveStatus.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Open FrameBit Folder</span>
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-500/20 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectDrive}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-teal-600/25 flex items-center gap-2 transition-all"
                >
                  <HardDrive className="w-4 h-4" /> Connect Google Drive
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800/80 space-y-3 text-xs text-slate-600 dark:text-zinc-400">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 dark:text-zinc-200">How Google Drive storage works:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-zinc-400">
                  <li>Videos are uploaded directly from your browser to your Google Drive via resumable upload sessions.</li>
                  <li>Our application server never stores or retains binary video files.</li>
                  <li>Folder hierarchy is maintained as <code>FrameBit / &lt;Project Name&gt; / ...</code></li>
                </ul>
              </div>
            </div>

            {driveStatus?.connected && (
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {driveStatus.googleAccountId && (
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 dark:text-zinc-500">Connected Account:</span>
                    <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">{driveStatus.googleAccountId}</span>
                  </div>
                )}

                {driveStatus.folderUrl && (
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-slate-500 dark:text-zinc-500">Drive Storage Folder:</span>
                    <a
                      href={driveStatus.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 dark:text-teal-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>FrameBit/</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: User Profile */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">User Profile</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Your account identity and workspace role</p>
            </div>
          </div>

          {profileSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Profile updated successfully</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full bg-slate-100 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800/60 rounded-xl p-2.5 text-xs text-slate-400 dark:text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Assigned Role</label>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4" /> {user?.role}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile || !name.trim()}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-md disabled:opacity-50 transition-all"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 3: Team Members Management */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-sm space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/10 dark:bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100">Team & Collaborators</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Invite Editors and Reviewers to collaborate across your workspace</p>
              </div>
            </div>
          </div>

          {/* Add Team Member Form */}
          {user?.role === 'owner' && (
            <form onSubmit={handleInviteMember} className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 space-y-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Add New Member
              </span>

              {inviteMsg && (
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs">
                  {inviteMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  required
                  placeholder="team.member@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                />

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-zinc-300 focus:outline-none"
                >
                  <option value="editor">Editor (Uploads & Versions)</option>
                  <option value="reviewer">Reviewer (Feedback & Approvals)</option>
                </select>

                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{inviting ? 'Adding...' : 'Invite Member'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Members List */}
          <div className="space-y-2">
            {teamMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                No external collaborators added yet. Use the form above or project team modals to invite editors & reviewers.
              </div>
            ) : (
              teamMembers.map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center">
                      {m.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{m.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{m.email}</p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-teal-700 dark:text-teal-400 capitalize font-semibold">
                    {m.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
          </div>
        </AppLayout>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
