"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own "Install app" button
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Only in production builds: a caching worker in `next dev` serves stale pages.
  if (process.env.NODE_ENV !== "production") return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/** canInstall: the browser offered an install prompt. installed: already running as an app. ios: needs Share → Add to Home Screen. */
export function useInstall() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    return () => {
      listeners.delete(update);
    };
  }, []);
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    force((n) => n + 1);
    return outcome === "accepted";
  };
  return { canInstall: !!deferred, installed, ios, install };
}
