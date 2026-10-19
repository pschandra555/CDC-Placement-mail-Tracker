"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { CalendarDays, KanbanSquare, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { AuthGate } from "./AuthGate";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/applications", label: "Applications", Icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { student, ready, auth } = useStore();
  const active = (href: string) => path === href || (href === "/dashboard" && path.startsWith("/opportunity"));

  return (
    <div className="min-h-screen lg:pl-64">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-ink-950/60 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="mt-10 space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={clsx("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active(href) ? "text-white" : "text-white/50 hover:bg-white/5 hover:text-white")}>
              {active(href) && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-cyan-400/10 shadow-glow" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto glass p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-semibold">{ready ? student.name[0] : "·"}</div>
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{ready ? student.name : "Loading…"}</div>
              <div className="truncate text-xs text-white/40">{ready ? `${student.regNo || "No reg. no."} · CGPA ${student.cgpa}` : ""}</div>
            </div>
            {supabase && auth === "ok" && (
              <button onClick={() => supabase!.auth.signOut()} className="ml-auto rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-white/5 bg-ink-950/70 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
        <AuthGate>{children}</AuthGate>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border border-white/10 bg-ink-900/80 p-1.5 backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={clsx("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px]", active(href) ? "bg-violet-500/20 text-white" : "text-white/50")}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
