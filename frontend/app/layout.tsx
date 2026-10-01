import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { CommandPalette } from "@/components/command/CommandPalette";

export const metadata: Metadata = {
  title: "F1 Race Replay",
  description: "Interactive Formula 1 race replay and telemetry analysis, built on real FastF1 data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background font-sans text-white antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[300] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <Providers>
          <div id="main-content">{children}</div>
          <ToastViewport />
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
