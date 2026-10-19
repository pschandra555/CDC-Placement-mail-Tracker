import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — CDC Tracker" };

export default function Offline() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="glass glow-border max-w-sm p-8 text-center">
        <WifiOff className="mx-auto mb-4 h-10 w-10 text-violet-300" />
        <h1 className="font-display text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-white/55">Pages you opened before still work. New drives load when you&apos;re back online.</p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Try again
        </Link>
      </div>
    </main>
  );
}
