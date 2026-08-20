'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AtSign } from 'lucide-react';

export interface MentionMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  members?: MentionMember[];
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Renders comment text with @Name highlighted as teal pills */
export function renderWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-brand-600 dark:text-teal-400 font-semibold bg-brand-500/10 dark:bg-teal-500/10 rounded px-0.5">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Write a comment... Type @ to mention someone',
  rows = 2,
  members = [],
  className = '',
  disabled = false,
  autoFocus = false,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  const insertMention = useCallback(
    (member: MentionMember) => {
      if (mentionStart < 0) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(mentionStart + 1 + query.length); // +1 for '@'
      const newVal = `${before}@${member.name}${after.startsWith(' ') ? '' : ' '}${after}`;
      onChange(newVal);
      setShowDropdown(false);
      setQuery('');
      setMentionStart(-1);
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = before.length + member.name.length + 2;
          textareaRef.current.setSelectionRange(pos, pos);
          textareaRef.current.focus();
        }
      }, 0);
    },
    [value, mentionStart, query, onChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursor = e.target.selectionStart;
    // Find last @ before cursor
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const after = before.slice(atIdx + 1);
      // Only trigger if no space in query and members available
      if (!after.includes(' ') && members.length > 0) {
        setMentionStart(atIdx);
        setQuery(after);
        setShowDropdown(true);
        setSelectedIdx(0);
        return;
      }
    }
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const close = () => setShowDropdown(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative w-full" onMouseDown={(e) => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={className}
      />

      {/* @mentions dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-full max-w-[260px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-100 dark:border-zinc-800 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
            <AtSign className="w-3 h-3" /> Mention a team member
          </div>
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                i === selectedIdx
                  ? 'bg-brand-500/10 dark:bg-teal-600/15'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-brand-600/15 dark:bg-teal-600/15 border border-brand-500/30 dark:border-teal-500/30 flex items-center justify-center text-brand-700 dark:text-teal-300 text-[10px] font-bold shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{m.name}</div>
                {m.role && (
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize">{m.role}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
