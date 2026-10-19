"use client";

import { Loader2, LogIn, ShieldAlert, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { ALLOWED_DOMAIN, signInWithVitGoogle, supabase } from "@/lib/supabase";

/** In API mode, show sign-in / wrong-account / offline states instead of the page. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode, ready, auth, error } = useStore();
  if (mode === "demo") return <>{children}</>;
  if (!ready)
    return (
      <div className="grid min-h-[50vh] place-items-center text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (auth === "signed-out" || auth === "forbidden") {
    const forbidden = auth === "forbidden";
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="glass glow-border p-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-glow">
            {forbidden ? <ShieldAlert className="h-7 w-7" /> : <LogIn className="h-7 w-7" />}
          </div>
          <h1 className="font-display text-2xl font-bold">{forbidden ? "VIT accounts only" : "Sign in to continue"}</h1>
          <p className="mt-2 text-sm text-white/55">
            {forbidden
              ? `Please sign in with your @${ALLOWED_DOMAIN} Google account.`
              : "Use your VIT Google account. We never read your inbox — only your academic profile."}
          </p>
          {supabase && (
            <button
              onClick={async () => {
                if (forbidden) await supabase!.auth.signOut();
                signInWithVitGoogle();
              }}
              className="btn-primary mt-6 w-full"
            >
              Sign in with VIT Google
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <WifiOff className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {children}
    </>
  );
}
