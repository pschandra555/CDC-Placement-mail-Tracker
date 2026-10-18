"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => <Fallback /> });

function Fallback() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="h-64 w-64 rounded-full bg-gradient-to-br from-violet-600/40 via-cyan-500/20 to-fuchsia-500/30 blur-2xl animate-pulse" />
    </div>
  );
}

/** Loads WebGL only in the browser; falls back to a glow when WebGL or motion is unavailable. */
export function HeroCanvas() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gl = false;
    try {
      gl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      gl = false;
    }
    setOk(gl && !reduce);
  }, []);
  if (!ok) return <Fallback />;
  return (
    <div className="absolute inset-0">
      <HeroScene />
    </div>
  );
}
