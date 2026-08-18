'use client';

import React from 'react';

/** Animated perspective floor grid + ambient glow orbs, sits behind the 3D hero canvas */
export function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(13,148,136,0.18),transparent_60%)]" />

      {/* Perspective grid floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{ perspective: '600px', perspectiveOrigin: '50% 0%' }}
      >
        <div
          className="absolute inset-0 grid-floor"
          style={{
            transform: 'rotateX(75deg)',
            transformOrigin: '50% 0%',
            backgroundImage:
              'linear-gradient(rgba(45,212,191,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.35) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          }}
        />
      </div>

      {/* Floating glow orbs */}
      <div className="absolute -top-24 left-1/4 w-72 h-72 rounded-full bg-teal-500/20 blur-3xl animate-glow-float" />
      <div className="absolute top-40 right-1/4 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl animate-glow-float-slow" />
      <div className="absolute top-1/3 left-1/2 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl animate-glow-float-alt" />

      {/* Top vignette to blend into page bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#090a0f] via-transparent to-[#090a0f]" />
    </div>
  );
}
