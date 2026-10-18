"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Logo } from "@/components/ui/Logo";

export function Navbar() {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 120], ["rgba(5,6,15,0)", "rgba(5,6,15,0.7)"]);
  const border = useTransform(scrollY, [0, 120], ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"]);
  return (
    <motion.header style={{ backgroundColor: bg, borderColor: border }} className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-8 text-sm text-white/60 md:flex">
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#categories" className="transition hover:text-white">Categories</a>
          <a href="#privacy" className="transition hover:text-white">Privacy</a>
        </div>
        <Link href="/dashboard" className="btn-primary !px-4 !py-2 text-sm">
          Open dashboard
        </Link>
      </nav>
    </motion.header>
  );
}
