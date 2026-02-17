"use client";

import { ReactNode } from "react";
import { MockSystemProvider } from "@/lib/mock-store";

export default function Providers({ children }: { children: ReactNode }) {
  return <MockSystemProvider>{children}</MockSystemProvider>;
}
