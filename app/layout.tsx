import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Montserrat } from "next/font/google";
import Providers from "@/app/providers";
import { NavShell } from "@/components/nav-shell";
import "@/app/globals.css";

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "QueueOps Console",
  description: "Mock UI for Job Queue LLM Orchestrator"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <div className="noise" />
          <main className="app-shell">
            <NavShell />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
