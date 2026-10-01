"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-white">
      <AlertTriangle className="h-10 w-10 text-accent" aria-hidden="true" />
      <div>
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted">
          {message || "The replay dashboard hit an unexpected error. This is usually recoverable."}
        </p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-4 py-2 text-sm font-bold hover:bg-accent hover:border-accent"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        )}
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-4 py-2 text-sm font-bold hover:bg-accent hover:border-accent"
        >
          <Home className="h-4 w-4" /> Back to race selector
        </Link>
      </div>
    </div>
  );
}
