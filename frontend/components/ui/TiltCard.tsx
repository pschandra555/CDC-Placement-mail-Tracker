"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import clsx from "clsx";
import type { ReactNode } from "react";

/** Card that tilts toward the cursor in 3D with a moving glare highlight. */
export function TiltCard({ children, className, intensity = 10 }: { children: ReactNode; className?: string; intensity?: number }) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 20 });
  const gx = useTransform(x, (v) => `${v * 100}%`);
  const gy = useTransform(y, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(500px circle at ${gx} ${gy}, rgba(255,255,255,0.10), transparent 40%)`;

  return (
    <div style={{ perspective: 1000 }} className="h-full w-full">
      <motion.div
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          x.set((e.clientX - r.left) / r.width);
          y.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          x.set(0.5);
          y.set(0.5);
        }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className={clsx("glass glow-border group h-full", className)}
      >
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare }} />
        <div style={{ transform: "translateZ(30px)" }} className="relative h-full">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
