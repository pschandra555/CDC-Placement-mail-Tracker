"use client";

import { useId } from "react";
import Link from "next/link";

export function BrandMark({ size = 32 }: { size?: number }) {
  // Unique gradient id per copy: the logo appears twice (sidebar + mobile header) and a
  // hidden copy's <defs> can't be referenced, which left the mobile icon blank.
  const id = `bm-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset=".55" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${id})`} opacity=".18" />
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke={`url(#${id})`} strokeWidth="1.5" />
      <path d="M8 11.5 16 17l8-5.5M8 11h16v10H8z" fill="none" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="24" cy="10" r="3" fill="#22d3ee" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-lg font-semibold tracking-tight">
        CDC<span className="text-gradient">Tracker</span>
      </span>
    </Link>
  );
}

/** Generated monogram tile for a company (no real logos needed). */
export function OrgTile({ name, hue, size = 44 }: { name: string; hue: number; size?: number }) {
  const initials = name
    .split(/[\s×—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl font-display font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 85% 60% / .9), hsl(${(hue + 60) % 360} 85% 45% / .9))`,
        boxShadow: `0 8px 24px -8px hsl(${hue} 90% 60% / .7), inset 0 1px 0 rgba(255,255,255,.35)`,
      }}
    >
      {initials}
    </div>
  );
}
