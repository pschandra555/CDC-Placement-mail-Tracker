"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroCanvas } from "@/components/three/HeroCanvas";

const word = {
  hidden: { opacity: 0, y: 40, rotateX: -60, filter: "blur(10px)" },
  show: (i: number) => ({ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { delay: 0.2 + i * 0.08, duration: 0.8, ease: [0.22, 1, 0.36, 1] } }),
};

export function Hero() {
  const line1 = ["Never", "miss", "a"];
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0 opacity-60 lg:left-[38%] lg:opacity-100">
        <HeroCanvas />
      </div>
      {/* fade the scene into the page on small screens so text stays readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950/40 via-ink-950/75 to-ink-950 lg:bg-gradient-to-r lg:from-ink-950 lg:via-ink-950/60 lg:to-transparent" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-4 sm:px-6">
        <div className="max-w-2xl py-16" style={{ perspective: 800 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="chip mb-6 border-violet-400/30 bg-violet-500/10 text-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered for VIT Vellore students
          </motion.div>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            {line1.map((w, i) => (
              <motion.span key={w} custom={i} variants={word} initial="hidden" animate="show" className="mr-[0.25em] inline-block">
                {w}
              </motion.span>
            ))}
            <br />
            <motion.span custom={3} variants={word} initial="hidden" animate="show" className="text-gradient inline-block">
              drive again.
            </motion.span>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
            Every CDC opportunity — jobs, internships, hackathons, workshops — read by AI, checked against <em className="not-italic text-white/90">your</em> CGPA and branch, with a reminder before it closes.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }} className="mt-9 flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-primary group">
              <GoogleG /> Sign in with VIT Google
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a href="#how" className="btn-ghost">See how it works</a>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/45">
            <Stat n="< 30 min" l="mail → alert" />
            <Stat n="98%" l="target recall" />
            <Stat n="0" l="access to your inbox" />
          </motion.div>
        </div>
      </div>

      <div className="relative flex justify-center pb-8">
        <div className="flex h-10 w-6 justify-center rounded-full border border-white/20 pt-2">
          <motion.div animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="h-2 w-1 rounded-full bg-white/70" />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold text-white">{n}</div>
      <div>{l}</div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#fff" opacity=".7" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
      <path fill="#fff" opacity=".9" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" />
    </svg>
  );
}
