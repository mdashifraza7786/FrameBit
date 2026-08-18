'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  Sparkles,
  MapPin,
  Pencil,
  MessageSquare,
  Clock,
  Share2,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  LayoutDashboard,
  Zap,
  Layers,
  Send,
  HardDrive,
  Folder,
  FileVideo,
  ExternalLink,
  Ban,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GridBackground } from './GridBackground';
import { TiltCard } from './TiltCard';

const Hero3DScene = dynamic(() => import('./Hero3DScene'), { ssr: false });

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const FEATURES = [
  {
    icon: MapPin,
    color: 'text-teal-400',
    title: 'Pinpoint Annotations',
    desc: 'Drop precise pins directly on any frame. Feedback lands exactly where it matters, not lost in a text thread.',
  },
  {
    icon: Pencil,
    color: 'text-purple-400',
    title: 'Draw & Sketch',
    desc: 'Freehand pen, shapes, arrows — mark up the frame like a whiteboard, right on top of the video.',
  },
  {
    icon: Clock,
    color: 'text-amber-400',
    title: 'Time-Range Comments',
    desc: 'Flag a moment or an entire range. Feedback stays visible for exactly as long as it matters.',
  },
  {
    icon: MessageSquare,
    color: 'text-cyan-400',
    title: 'Threaded Discussion',
    desc: '@mention teammates, reply in threads, resolve when done. Every conversation stays attached to its frame.',
  },
  {
    icon: Share2,
    color: 'text-emerald-400',
    title: 'Guest Review Links',
    desc: 'Share a secure link with clients — no account needed. They comment, you stay in control.',
  },
  {
    icon: ShieldCheck,
    color: 'text-rose-400',
    title: 'Private by Default',
    desc: 'Every project is access-controlled. Nothing is public unless you explicitly share it.',
  },
];

const STEPS = [
  { n: '01', title: 'Upload your cut', desc: 'Drop in any version — FrameBit tracks every revision automatically.' },
  { n: '02', title: 'Collect precise feedback', desc: 'Reviewers pin, draw, and comment directly on the timeline.' },
  { n: '03', title: 'Resolve & ship', desc: 'Track what’s addressed, compare versions, and move on with confidence.' },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-[#090a0f] text-zinc-100 overflow-x-hidden">
      {/* ===== Navbar ===== */}
      <header className="relative z-30 flex items-center justify-between px-6 lg:px-12 h-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-lg">
            Frame<span className="text-teal-400">Bit</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-teal-600/25 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-teal-600/25 transition-all"
              >
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative min-h-[92vh] flex items-center px-6 lg:px-12 py-28 lg:py-0">
        <GridBackground />

        <div className="relative z-20 max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-8 items-center w-full">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-semibold mb-6"
            >
              <Zap className="w-3.5 h-3.5" /> Frame-accurate video review
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]"
            >
              Review video like you&apos;re
              <br />
              <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-300 bg-clip-text text-transparent animate-text-shimmer">
                in the room together
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-6 text-base sm:text-lg text-zinc-400 max-w-lg mx-auto lg:mx-0"
            >
              Pin feedback to the exact frame, sketch over the footage, and thread every
              conversation to the timeline. FrameBit is where editors and clients actually agree.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-9 flex items-center justify-center lg:justify-start gap-3 flex-wrap"
            >
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-teal-600/30 transition-all hover:scale-[1.03]"
                >
                  Go to Dashboard <LayoutDashboard className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-teal-600/30 transition-all hover:scale-[1.03]"
                  >
                    Start Reviewing Free <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 bg-zinc-900/60 backdrop-blur hover:bg-zinc-800 text-zinc-200 font-semibold transition-all"
                  >
                    <PlayCircle className="w-4 h-4" /> Sign In
                  </Link>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="mt-8 flex items-center justify-center lg:justify-start gap-2 text-xs text-zinc-500"
            >
              <div className="flex -space-x-2">
                {['bg-teal-500', 'bg-cyan-500', 'bg-amber-500'].map((c, i) => (
                  <div key={i} className={`w-6 h-6 rounded-full ${c} border-2 border-[#090a0f]`} />
                ))}
              </div>
              Trusted by editors reviewing frame-by-frame, every day
            </motion.div>
          </div>

          {/* Right: framed 3D visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="relative aspect-square lg:aspect-[4/5] rounded-3xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm shadow-2xl shadow-teal-950/40 overflow-hidden">
              <Suspense fallback={null}>
                <Hero3DScene />
              </Suspense>

              {/* Corner chip */}
              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/70 border border-zinc-800 backdrop-blur text-[10px] font-mono text-teal-300">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> live_review.mp4
              </div>
            </div>

            {/* Floating feature chips around the panel */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="hidden sm:flex absolute -left-6 bottom-10 items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/95 border border-teal-500/30 shadow-xl backdrop-blur text-xs font-medium text-zinc-200"
            >
              <MapPin className="w-3.5 h-3.5 text-teal-400" /> Pinned to frame 0:42
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.05 }}
              className="hidden sm:flex absolute -right-4 top-10 items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/95 border border-amber-500/30 shadow-xl backdrop-blur text-xs font-medium text-zinc-200"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Range 0:12 → 0:18
            </motion.div>
          </motion.div>
        </div>

        {/* Fade to next section */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent to-[#090a0f] z-20" />
      </section>

      {/* ===== Stats strip ===== */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        className="relative z-10 px-6 lg:px-12 py-14 border-y border-zinc-800/60 bg-zinc-950/40"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: 'Frame', label: 'Accurate positioning' },
            { value: '0', label: 'Setup friction for guests' },
            { value: '∞', label: 'Version history' },
            { value: '100%', label: 'Private by default' },
          ].map((s) => (
            <motion.div key={s.label} variants={fadeUp}>
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ===== Features ===== */}
      <section className="relative z-10 px-6 lg:px-12 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything a review round needs
          </h2>
          <p className="mt-4 text-zinc-400">
            Built for the back-and-forth of real production — not a generic comment box.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <TiltCard className="p-6 h-full hover:border-teal-500/40 transition-colors">
                <div className={`w-11 h-11 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-zinc-100 mb-1.5">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== Storage: Your own Google Drive ===== */}
      <section className="relative z-10 px-6 lg:px-12 py-24 bg-zinc-950/40 border-y border-zinc-800/60 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: copy */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-semibold mb-5"
            >
              <HardDrive className="w-3.5 h-3.5" /> Storage
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight">
              Your videos live in
              <br />
              <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent">
                your own Google Drive
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-zinc-400 leading-relaxed max-w-md">
              Connect your Google account once. From then on, every upload streams straight from
              your browser into your Drive — FrameBit never stores or retains the binary video
              file on its own servers.
            </motion.p>

            <motion.ul variants={stagger} className="mt-7 space-y-4">
              {[
                {
                  icon: HardDrive,
                  title: 'Direct-to-Drive uploads',
                  desc: 'Resumable uploads go browser → your Google Drive. No detour through our servers.',
                },
                {
                  icon: Ban,
                  title: 'Zero server-side storage',
                  desc: 'We never keep a copy of your footage — nothing to leak, nothing to run out of.',
                },
                {
                  icon: Folder,
                  title: 'Auto-organized folders',
                  desc: 'Every project gets its own folder under FrameBit / <Project Name> / — tidy by default.',
                },
                {
                  icon: ShieldCheck,
                  title: 'You stay in control',
                  desc: 'Open the folder in Drive anytime, or disconnect the account whenever you want.',
                },
              ].map((item) => (
                <motion.li key={item.title} variants={fadeUp} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-400 shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Right: Drive connection mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard className="p-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Google Drive Video Storage</p>
                    <p className="text-[10px] text-zinc-500">Direct-to-Drive · zero server storage</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-[10px] font-semibold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                </span>
              </div>

              {/* Folder tree visual */}
              <div className="mt-4 rounded-xl bg-zinc-950/70 border border-zinc-800 p-3.5 font-mono text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-teal-300">
                  <Folder className="w-3.5 h-3.5" /> FrameBit/
                </div>
                <div className="flex items-center gap-1.5 pl-4 text-zinc-400">
                  <Folder className="w-3.5 h-3.5 text-cyan-400" /> Paper Jet Airplane/
                </div>
                <div className="flex items-center gap-1.5 pl-8 text-zinc-500">
                  <FileVideo className="w-3.5 h-3.5" /> v1_draft.mp4
                </div>
                <div className="flex items-center gap-1.5 pl-8 text-zinc-300">
                  <FileVideo className="w-3.5 h-3.5 text-teal-400" /> v2_final.mp4
                  <span className="ml-auto text-[9px] text-teal-500">current</span>
                </div>
                <div className="flex items-center gap-1.5 pl-4 text-zinc-400">
                  <Folder className="w-3.5 h-3.5 text-cyan-400" /> Brand Launch Reel/
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-500">
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Drive
                </span>
                <span className="text-zinc-600">owner@gmail.com</span>
              </div>
            </TiltCard>
          </motion.div>
        </div>
      </section>

      {/* ===== Product showcase mockup ===== */}
      <section className="relative z-10 px-6 lg:px-12 py-10 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformPerspective: 1200 }}
          className="max-w-5xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-[11px] text-zinc-500 font-mono">framebit.app/review</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="md:col-span-2 aspect-video bg-gradient-to-br from-zinc-800 to-zinc-950 relative flex items-center justify-center overflow-hidden">
              <Layers className="w-16 h-16 text-zinc-700" />

              {/* Fake pin markers */}
              <div className="absolute top-[30%] left-[35%] w-6 h-6 rounded-full bg-teal-500 border-2 border-white/80 shadow-lg shadow-teal-500/40 animate-marker z-10" />
              <div className="absolute top-[55%] left-[62%] w-6 h-6 rounded-full bg-amber-500 border-2 border-white/80 shadow-lg shadow-amber-500/40 animate-marker z-10" />

              {/* Comment popover on pin 1 — mirrors the real on-video comment card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute top-[6%] left-[6%] w-44 p-2.5 rounded-xl bg-zinc-900/95 border border-teal-500/50 shadow-xl backdrop-blur-md z-20"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                    A
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-200 truncate">Ari M.</span>
                  <span className="ml-auto text-[9px] font-mono text-teal-400 shrink-0">0:12</span>
                </div>
                <p className="text-[10px] text-zinc-300 leading-snug">Logo pops too fast here</p>
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-zinc-500">
                  <MessageSquare className="w-2.5 h-2.5" /> Reply
                </div>
              </motion.div>

              {/* Comment popover on pin 2 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: 0.75, duration: 0.4 }}
                className="absolute bottom-[14%] right-[4%] w-44 p-2.5 rounded-xl bg-zinc-900/95 border border-amber-500/50 shadow-xl backdrop-blur-md z-20"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4.5 h-4.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                    O
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-200 truncate">Owner Demo</span>
                  <span className="ml-auto text-[9px] font-mono text-amber-400 shrink-0">1:04</span>
                </div>
                <p className="text-[10px] text-zinc-300 leading-snug">Trim 8 frames off the intro</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex-1 h-5 rounded-md bg-zinc-950 border border-zinc-800 px-1.5 flex items-center text-[9px] text-zinc-600">
                    Reply…
                  </div>
                  <Send className="w-3 h-3 text-amber-400 shrink-0" />
                </div>
              </motion.div>

              <div className="absolute bottom-3 left-3 right-3 h-1.5 rounded-full bg-zinc-700/80 overflow-hidden">
                <div className="h-full w-2/5 bg-gradient-to-r from-teal-500 to-cyan-400" />
              </div>
            </div>
            <div className="p-4 space-y-3 bg-zinc-950/40 border-t md:border-t-0 md:border-l border-zinc-800">
              {[
                { name: 'Ari M.', text: 'Logo pops too fast here', color: 'teal' },
                { name: 'Owner Demo', text: 'Trim 8 frames off the intro', color: 'amber' },
                { name: 'Client Review', text: 'Approved — ship it', color: 'emerald' },
              ].map((c, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-zinc-200">{c.name}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                  <p className="text-zinc-400">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== How it works ===== */}
      <section className="relative z-10 px-6 lg:px-12 py-24 bg-zinc-950/40 border-y border-zinc-800/60">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10"
        >
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={fadeUp} className="text-center sm:text-left">
              <div className="text-5xl font-bold text-zinc-800">{s.n}</div>
              <h3 className="mt-3 font-semibold text-lg text-zinc-100">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative z-10 px-6 lg:px-12 py-28 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(13,148,136,0.14),transparent_70%)]" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="relative max-w-xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {user ? 'Pick up right where you left off' : 'Stop reviewing over text messages'}
          </h2>
          <p className="mt-4 text-zinc-400">
            {user
              ? 'Your projects and reviews are waiting in the dashboard.'
              : 'Free to start. No credit card. Invite your first reviewer in under a minute.'}
          </p>
          <Link
            href={user ? '/dashboard' : '/register'}
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-teal-600/30 transition-all hover:scale-[1.03]"
          >
            {user ? 'Go to Dashboard' : 'Create Free Account'} <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 px-6 lg:px-12 py-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
          <span>Frame<span className="text-teal-400">Bit</span> — Private Video Review & Collaboration</span>
        </div>
        <span>© {new Date().getFullYear()} FrameBit. All rights reserved.</span>
      </footer>
    </div>
  );
}
