'use client';

import React, { useMemo } from 'react';

interface TimecodeRulerProps {
  className?: string;
  ticks?: number;
}

function formatTC(seconds: number) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:00`;
}

/** Full-bleed timecode ruler with a drifting playhead — the app-chrome motif reused across the page */
export function TimecodeRuler({ className = '', ticks = 16 }: TimecodeRulerProps) {
  const marks = useMemo(() => Array.from({ length: ticks }, (_, i) => i), [ticks]);

  return (
    <div
      className={`relative h-8 w-full overflow-hidden border-y border-[#E4DFD1] bg-[#F7F5EF] select-none ${className}`}
      aria-hidden="true"
    >
      <div className="flex h-full items-stretch">
        {marks.map((i) => (
          <div key={i} className="flex flex-1 items-center border-l border-[#E4DFD1] first:border-l-0 pl-2">
            <span
              className={`font-mono text-[9px] tracking-tight text-[#8C8874] ${
                i % 4 !== 0 ? 'hidden sm:inline' : ''
              }`}
            >
              {formatTC(i * 2)}
            </span>
          </div>
        ))}
      </div>
      <div className="animate-playhead pointer-events-none absolute top-0 h-full w-px bg-[#E0361E]">
        <div className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#E0361E]" />
      </div>
    </div>
  );
}
