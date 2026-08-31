'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  CheckCircle2,
  Film,
  UserPlus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { NotificationData } from '@/lib/types';

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  return date.toLocaleDateString();
}

export function NotificationDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Setup SSE listener for realtime notifications
    const eventSource = new EventSource('/api/realtime?channel=all');
    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (
          payload.type === 'notification:created' ||
          payload.type === 'comment:created' ||
          payload.type === 'comment:resolved' ||
          payload.type === 'status:changed' ||
          payload.type === 'version:created'
        ) {
          fetchNotifications();
        }
      } catch {
        // Ping
      }
    };

    return () => eventSource.close();
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = (n: any) => {
    setIsOpen(false);
    if (!n.read) {
      markAsRead(n._id);
    }

    const projectId = typeof n.projectId === 'object' ? n.projectId?._id : n.projectId;
    const assetId = typeof n.assetId === 'object' ? n.assetId?._id : n.assetId;
    const commentId = typeof n.commentId === 'object' ? n.commentId?._id : n.commentId;

    if (projectId && assetId) {
      if (commentId) {
        router.push(`/projects/${projectId}/videos/${assetId}?commentId=${commentId}`);
      } else {
        router.push(`/projects/${projectId}/videos/${assetId}`);
      }
    } else if (projectId) {
      router.push(`/projects/${projectId}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment_added':
      case 'comment_reply':
      case 'mention':
        return <MessageSquare className="w-4 h-4 text-brand-600 dark:text-teal-400" />;
      case 'comment_resolved':
      case 'status_changed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'version_uploaded':
        return <Film className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'member_added':
        return <UserPlus className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400 dark:text-zinc-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 dark:bg-teal-600 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800 dark:text-zinc-200">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 dark:bg-teal-500/20 text-brand-700 dark:text-teal-400 font-semibold font-mono">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark read
                </button>
              )}
            </div>

            {/* Fixed-size box — always the same height, content scrolls inside it */}
            <div className="h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
              {notifications.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-slate-400 dark:text-zinc-500 text-xs">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors ${
                      !n.read ? 'bg-brand-50/60 dark:bg-teal-950/20' : ''
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 mt-0.5 shrink-0 group-hover:border-brand-500/40 dark:group-hover:border-teal-500/40 transition-colors">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      <p
                        className={`text-xs leading-relaxed break-words ${
                          !n.read ? 'text-slate-900 dark:text-zinc-100 font-semibold' : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        <span className="text-[10px] font-medium text-brand-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <span>Open</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-brand-500 dark:bg-teal-500 shrink-0 mt-2 self-center ring-4 ring-brand-500/20 dark:ring-teal-500/20" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
