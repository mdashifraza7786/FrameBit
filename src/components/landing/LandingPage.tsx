'use client';

import React from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import {
  MapPin,
  Pencil,
  MessageSquare,
  Clock,
  Share2,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LayoutDashboard,
  Zap,
  Layers,
  Send,
  HardDrive,
  Folder,
  FileVideo,
  ExternalLink,
  UserCog,
  Film,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { TiltCard } from './TiltCard';
import { TimecodeRuler } from './TimecodeRuler';

const INK = '#14140F';
const PAPER = '#F7F5EF';
const HAIRLINE = '#E4DFD1';
const REC = '#E0361E';
const TEAL = '#0d7d73';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const Perforations = ({ className = '' }: { className?: string }) => (
  <div
    className={`h-2.5 w-full ${className}`}
    style={{
      backgroundColor: INK,
      backgroundImage: `radial-gradient(circle, ${PAPER} 2px, transparent 2.2px)`,
      backgroundSize: '16px 100%',
      backgroundPosition: 'center',
    }}
    aria-hidden="true"
  />
);

const FEATURES = [
  {
    icon: MapPin,
    tint: 'bg-[#FDEDEA] text-[#E0361E]',
    title: 'Pinpoint Annotations',
    desc: 'Drop precise pins directly on any frame. Feedback lands exactly where it matters, not lost in a text thread.',
  },
  {
    icon: Pencil,
    tint: 'bg-[#E7F5F3] text-[#0d7d73]',
    title: 'Draw & Sketch',
    desc: 'Freehand pen, shapes, arrows — mark up the frame like a whiteboard, right on top of the video.',
  },
  {
    icon: Clock,
    tint: 'bg-[#FBF1DE] text-[#B4790A]',
    title: 'Time-Range Comments',
    desc: 'Flag a moment or an entire range. Feedback stays visible for exactly as long as it matters.',
  },
  {
    icon: MessageSquare,
    tint: 'bg-[#E7F5F3] text-[#0d7d73]',
    title: 'Threaded Discussion',
    desc: '@mention teammates, reply in threads, resolve when done. Every conversation stays attached to its frame.',
  },
  {
    icon: Share2,
    tint: 'bg-[#FDEDEA] text-[#E0361E]',
    title: 'Guest Review Links',
    desc: 'Share a secure link with clients — no account needed. They comment, you stay in control.',
  },
  {
    icon: ShieldCheck,
    tint: 'bg-[#EFEDE4] text-[#14140F]',
    title: 'Private by Default',
    desc: 'Every project is access-controlled. Nothing is public unless you explicitly share it.',
  },
  {
    icon: Layers,
    tint: 'bg-[#FBF1DE] text-[#B4790A]',
    title: 'Version History',
    desc: 'Group every cut — v1, v2, v3 — under one asset. Comments stay isolated to the version they were made on.',
  },
  {
    icon: Zap,
    tint: 'bg-[#E7F5F3] text-[#0d7d73]',
    title: 'Live Sync',
    desc: 'New comments, status changes, and approvals broadcast instantly — everyone sees the same board, live.',
  },
];

const PROBLEMS = [
  {
    quote: '"around 0:45, near the end?"',
    problem: 'Timestamped feedback in a text thread is a guess, not a location.',
    fix: 'A pin lands on frame 0:45:12 — exactly, every time.',
  },
  {
    quote: '"see attached screenshot"',
    problem: "A screenshot can't show motion, timing, or a range.",
    fix: 'Draw over the footage and flag the exact range that needs work.',
  },
  {
    quote: '"wait — is this v2 or v3?"',
    problem: 'Cuts pile up in a chat thread with no history to follow.',
    fix: 'Every cut is versioned automatically, notes stay pinned to their version.',
  },
];

const STEPS = [
  { n: '01', title: 'Upload your cut', desc: 'Drop in any version — FrameBit tracks every revision automatically.' },
  { n: '02', title: 'Collect precise feedback', desc: 'Reviewers pin, draw, and comment directly on the timeline.' },
  { n: '03', title: 'Resolve & ship', desc: 'Track what’s addressed, compare versions, and move on with confidence.' },
];

const ROLES = [
  { icon: UserCog, title: 'Owner / Admin', desc: 'Full project control — invites, versions, approvals, deletion.' },
  { icon: Film, title: 'Editor', desc: 'Uploads cuts, adds versions, manages and resolves feedback.' },
  { icon: Eye, title: 'Reviewer', desc: 'Frame-accurate playback, timecoded comments, approve or request changes.' },
];

function LogoMark({ size = 'w-9 h-9' }: { size?: string }) {
  return (
    <div className={`${size} rounded-lg flex items-center justify-center shrink-0`} style={{ backgroundColor: INK }}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path
          d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"
          stroke={PAPER}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.75" fill={REC} />
      </svg>
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans" style={{ backgroundColor: PAPER, color: INK }}>
      {/* ===== Navbar ===== */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-12 h-[72px] backdrop-blur"
        style={{ backgroundColor: 'rgba(247,245,239,0.88)', borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display font-extrabold tracking-tight text-lg">
            Frame<span style={{ color: REC }}>Bit</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: '#57543F' }}>
          <a href="#features" className="hover:text-[#14140F] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-[#14140F] transition-colors">How it works</a>
          <a href="#storage" className="hover:text-[#14140F] transition-colors">Storage</a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: REC }}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold hover:opacity-70 transition-opacity"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: REC }}
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </header>

      <TimecodeRuler />

      {/* ===== Hero ===== */}
      <section className="relative px-6 lg:px-12 py-20 lg:py-28">
        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold"
              style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff', color: '#57543F' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-tally" style={{ backgroundColor: REC }} />
              FRAME-ACCURATE REVIEW
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="font-display mt-6 text-[2.75rem] sm:text-6xl xl:text-[4.25rem] font-black tracking-tight leading-[0.98]"
            >
              Pin the note
              <br />
              to the frame.
              <br />
              <span style={{ color: REC }}>Not the guesswork.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-7 text-lg leading-relaxed max-w-md"
              style={{ color: '#57543F' }}
            >
              FrameBit is where editors and clients review cuts together — pin comments to an
              exact frame, sketch over the footage, and thread every note to the timeline.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-9 flex items-center gap-3 flex-wrap"
            >
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-white font-semibold transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: REC }}
                >
                  Go to dashboard <LayoutDashboard className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-white font-semibold transition-transform hover:scale-[1.03]"
                    style={{ backgroundColor: REC }}
                  >
                    Start reviewing — free <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-semibold transition-colors hover:bg-white"
                    style={{ border: `1px solid ${HAIRLINE}` }}
                  >
                    Try a demo account
                  </Link>
                </>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="mt-6 text-xs font-mono"
              style={{ color: '#8C8874' }}
            >
              No credit card. Invite your first reviewer in under a minute.
            </motion.p>
          </div>

          {/* Right: review-frame mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              className="rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(20,20,15,0.25)]"
              style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff' }}
            >
              <Perforations />
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <span className="font-mono text-[10px] font-semibold" style={{ color: '#8C8874' }}>
                  live_review.mp4
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold" style={{ color: REC }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-tally" style={{ backgroundColor: REC }} /> REC
                </span>
              </div>

              <div className="relative aspect-[4/3]" style={{ backgroundColor: '#EDEAE0' }}>
                <Film className="absolute inset-0 m-auto w-16 h-16" style={{ color: '#D8D3C2' }} />

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="absolute top-[18%] left-[16%] w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: REC }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                  className="absolute top-[8%] left-[26%] w-40 p-2.5 rounded-lg shadow-xl"
                  style={{ backgroundColor: '#fff', border: `1px solid ${HAIRLINE}` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono text-[9px] font-bold" style={{ color: REC }}>00:00:12:04</span>
                  </div>
                  <p className="text-[11px] leading-snug font-medium">Logo pops too fast here</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.85, duration: 0.4 }}
                  className="absolute bottom-[28%] right-[18%] w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: TEAL }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1, duration: 0.4 }}
                  className="absolute bottom-[8%] right-[4%] w-40 p-2.5 rounded-lg shadow-xl"
                  style={{ backgroundColor: '#fff', border: `1px solid ${HAIRLINE}` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono text-[9px] font-bold" style={{ color: TEAL }}>00:01:04:12</span>
                  </div>
                  <p className="text-[11px] leading-snug font-medium">Trim 8 frames off the intro</p>
                </motion.div>
              </div>

              <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#EDEAE0' }}>
                  <div className="h-full w-2/5" style={{ backgroundColor: REC }} />
                </div>
                <span className="font-mono text-[9px]" style={{ color: '#8C8874' }}>00:01:04:12 / 00:02:31:00</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        className="relative px-6 lg:px-12 py-12"
        style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}`, backgroundColor: '#fff' }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: 'Frame', label: 'Accurate positioning' },
            { value: '0', label: 'Setup friction for guests' },
            { value: '∞', label: 'Version history' },
            { value: '100%', label: 'Private by default' },
          ].map((s) => (
            <motion.div key={s.label} variants={fadeUp}>
              <div className="font-display text-2xl sm:text-3xl font-black" style={{ color: REC }}>
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: '#8C8874' }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ===== Problem / solution ===== */}
      <section className="relative px-6 lg:px-12 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            The note that gets lost is the note that never gets fixed
          </h2>
          <p className="mt-4" style={{ color: '#57543F' }}>
            Feedback in a chat thread is a paraphrase. Feedback pinned to a frame is a fact.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {PROBLEMS.map((p) => (
            <motion.div
              key={p.quote}
              variants={fadeUp}
              className="rounded-2xl p-6 flex flex-col h-full"
              style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff' }}
            >
              <span className="font-mono text-[13px] px-3 py-2 rounded-md self-start" style={{ backgroundColor: '#EFEDE4', color: '#57543F' }}>
                {p.quote}
              </span>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: '#57543F' }}>{p.problem}</p>
              <div className="mt-auto pt-5 flex items-start gap-2" style={{ borderTop: `1px dashed ${HAIRLINE}`, marginTop: '1.25rem' }}>
                <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: REC }} />
                <p className="text-sm font-semibold leading-snug">{p.fix}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="relative px-6 lg:px-12 py-24" style={{ backgroundColor: '#fff', borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            Everything a review round needs
          </h2>
          <p className="mt-4" style={{ color: '#57543F' }}>
            Built for the back-and-forth of real production — not a generic comment box.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={fadeUp} className="h-full">
              <TiltCard
                className="p-6 h-full flex flex-col"
                glareColor="rgba(224,54,30,0.08)"
                style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER }}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.tint}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#57543F' }}>{f.desc}</p>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== Storage: Your own Google Drive ===== */}
      <section id="storage" className="relative px-6 lg:px-12 py-24 overflow-hidden">
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
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold mb-5"
              style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff', color: '#57543F' }}
            >
              <HardDrive className="w-3.5 h-3.5" /> STORAGE
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              Your videos live in
              <br />
              <span style={{ color: TEAL }}>your own Google Drive</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 leading-relaxed max-w-md" style={{ color: '#57543F' }}>
              Connect your Google account once. From then on, every upload streams straight from
              your browser into your Drive — FrameBit never stores or retains the binary video
              file on its own servers.
            </motion.p>

            <motion.ul variants={stagger} className="mt-7 space-y-4">
              {[
                { icon: HardDrive, title: 'Direct-to-Drive uploads', desc: 'Resumable uploads go browser → your Google Drive. No detour through our servers.' },
                { icon: ShieldCheck, title: 'Zero server-side storage', desc: 'We never keep a copy of your footage — nothing to leak, nothing to run out of.' },
                { icon: Folder, title: 'Auto-organized folders', desc: 'Every project gets its own folder under FrameBit / <Project Name> / — tidy by default.' },
              ].map((item) => (
                <motion.li key={item.title} variants={fadeUp} className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#E7F5F3', color: TEAL }}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#57543F' }}>{item.desc}</p>
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
            className="rounded-2xl p-5"
            style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff' }}
          >
            <div className="flex items-center justify-between gap-3 pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E7F5F3', color: TEAL }}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Google Drive Video Storage</p>
                  <p className="text-[10px]" style={{ color: '#8C8874' }}>Direct-to-Drive · zero server storage</p>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0"
                style={{ backgroundColor: '#E7F5F3', color: TEAL, border: `1px solid ${TEAL}40` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-tally" style={{ backgroundColor: TEAL }} /> Connected
              </span>
            </div>

            <div className="mt-4 rounded-xl p-3.5 font-mono text-xs space-y-1.5" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
              <div className="flex items-center gap-1.5" style={{ color: TEAL }}>
                <Folder className="w-3.5 h-3.5" /> FrameBit/
              </div>
              <div className="flex items-center gap-1.5 pl-4" style={{ color: '#57543F' }}>
                <Folder className="w-3.5 h-3.5" style={{ color: '#8C8874' }} /> Paper Jet Airplane/
              </div>
              <div className="flex items-center gap-1.5 pl-8" style={{ color: '#8C8874' }}>
                <FileVideo className="w-3.5 h-3.5" /> v1_draft.mp4
              </div>
              <div className="flex items-center gap-1.5 pl-8" style={{ color: INK }}>
                <FileVideo className="w-3.5 h-3.5" style={{ color: REC }} /> v2_final.mp4
                <span className="ml-auto text-[9px]" style={{ color: REC }}>current</span>
              </div>
              <div className="flex items-center gap-1.5 pl-4" style={{ color: '#57543F' }}>
                <Folder className="w-3.5 h-3.5" style={{ color: '#8C8874' }} /> Brand Launch Reel/
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5" style={{ color: '#8C8874' }}>
                <ExternalLink className="w-3.5 h-3.5" /> Open in Drive
              </span>
              <span style={{ color: '#B4AF9B' }}>owner@gmail.com</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Product showcase mockup ===== */}
      <section className="relative px-6 lg:px-12 py-10 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(20,20,15,0.2)]"
          style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: '#fff' }}
        >
          <Perforations />
          <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REC }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E8B23A' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TEAL }} />
            <span className="ml-3 font-mono text-[11px]" style={{ color: '#8C8874' }}>framebit.app/review</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="md:col-span-2 aspect-video relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#EDEAE0' }}>
              <Layers className="w-16 h-16" style={{ color: '#D8D3C2' }} />

              <div className="absolute top-[30%] left-[35%] w-6 h-6 rounded-full animate-pin-pop z-10" style={{ backgroundColor: REC, border: '2px solid white', boxShadow: '0 4px 14px rgba(224,54,30,0.35)' }} />
              <div className="absolute top-[55%] left-[62%] w-6 h-6 rounded-full animate-pin-pop z-10" style={{ backgroundColor: '#E8B23A', border: '2px solid white', boxShadow: '0 4px 14px rgba(232,178,58,0.35)', animationDelay: '0.15s' }} />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute top-[6%] left-[6%] w-44 p-2.5 rounded-xl shadow-xl z-20"
                style={{ backgroundColor: '#fff', border: `1px solid ${HAIRLINE}` }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: '#FDEDEA', color: REC }}>A</div>
                  <span className="text-[10px] font-semibold truncate">Ari M.</span>
                  <span className="ml-auto font-mono text-[9px] shrink-0" style={{ color: REC }}>0:12</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: '#57543F' }}>Logo pops too fast here</p>
                <div className="mt-1.5 flex items-center gap-1 text-[9px]" style={{ color: '#8C8874' }}>
                  <MessageSquare className="w-2.5 h-2.5" /> Reply
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: 0.75, duration: 0.4 }}
                className="absolute bottom-[14%] right-[4%] w-44 p-2.5 rounded-xl shadow-xl z-20"
                style={{ backgroundColor: '#fff', border: `1px solid ${HAIRLINE}` }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: '#FBF1DE', color: '#B4790A' }}>O</div>
                  <span className="text-[10px] font-semibold truncate">Owner Demo</span>
                  <span className="ml-auto font-mono text-[9px] shrink-0" style={{ color: '#B4790A' }}>1:04</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: '#57543F' }}>Trim 8 frames off the intro</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex-1 h-5 rounded-md px-1.5 flex items-center text-[9px]" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, color: '#B4AF9B' }}>
                    Reply…
                  </div>
                  <Send className="w-3 h-3 shrink-0" style={{ color: '#B4790A' }} />
                </div>
              </motion.div>

              <div className="absolute bottom-3 left-3 right-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(20,20,15,0.15)' }}>
                <div className="h-full w-2/5" style={{ backgroundColor: REC }} />
              </div>
            </div>
            <div className="p-4 space-y-3" style={{ backgroundColor: PAPER, borderTop: `1px solid ${HAIRLINE}`, borderLeft: `1px solid ${HAIRLINE}` }}>
              {[
                { name: 'Ari M.', text: 'Logo pops too fast here' },
                { name: 'Owner Demo', text: 'Trim 8 frames off the intro' },
                { name: 'Client Review', text: 'Approved — ship it' },
              ].map((c, i) => (
                <div key={i} className="p-2.5 rounded-xl text-xs" style={{ backgroundColor: '#fff', border: `1px solid ${HAIRLINE}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{c.name}</span>
                    <CheckCircle2 className="w-3 h-3" style={{ color: TEAL }} />
                  </div>
                  <p style={{ color: '#57543F' }}>{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== Roles ===== */}
      <section className="relative px-6 lg:px-12 py-20" style={{ backgroundColor: '#fff', borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">Built for every seat in the review</h2>
        </motion.div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5"
        >
          {ROLES.map((r) => (
            <motion.div key={r.title} variants={fadeUp} className="text-center rounded-2xl p-6" style={{ border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#EFEDE4', color: INK }}>
                <r.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#57543F' }}>{r.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how-it-works" className="relative px-6 lg:px-12 py-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10"
        >
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={fadeUp}>
              <div className="font-display text-5xl font-black" style={{ color: '#E4DFD1' }}>{s.n}</div>
              <h3 className="mt-3 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#57543F' }}>{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative px-6 lg:px-12 py-28 text-center overflow-hidden" style={{ backgroundColor: INK, color: PAPER }}>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="relative max-w-xl mx-auto"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            {user ? 'Pick up right where you left off' : 'Stop reviewing over text messages'}
          </h2>
          <p className="mt-4" style={{ color: '#B4AF9B' }}>
            {user
              ? 'Your projects and reviews are waiting in the dashboard.'
              : 'Free to start. No credit card. Invite your first reviewer in under a minute.'}
          </p>
          <Link
            href={user ? '/dashboard' : '/register'}
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-semibold transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: REC, color: '#fff' }}
          >
            {user ? 'Go to dashboard' : 'Create free account'} <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative px-6 lg:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: '#8C8874' }}>
        <div className="flex items-center gap-2">
          <LogoMark size="w-5 h-5" />
          <span>Frame<span style={{ color: REC }}>Bit</span> — Private Video Review & Collaboration</span>
        </div>
        <span>© {new Date().getFullYear()} FrameBit. All rights reserved.</span>
      </footer>
    </div>
  );
}
