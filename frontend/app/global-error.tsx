"use client";

import { ErrorFallback } from "@/components/layout/ErrorFallback";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0b0b" }}>
        <ErrorFallback message={error.message} onRetry={reset} />
      </body>
    </html>
  );
}
