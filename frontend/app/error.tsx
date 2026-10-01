"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/layout/ErrorFallback";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return <ErrorFallback message={error.message} onRetry={reset} />;
}
