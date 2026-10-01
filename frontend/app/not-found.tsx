import Link from "next/link";
import { FlagOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-white">
      <FlagOff className="h-10 w-10 text-accent" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-black">404</h1>
        <p className="mt-1 max-w-md text-sm text-muted">
          This page doesn&apos;t exist — like a race that never made the calendar.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg border border-border bg-panel px-4 py-2 text-sm font-bold hover:bg-accent hover:border-accent"
      >
        Back to race selector
      </Link>
    </div>
  );
}
