"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/workers", label: "Workers" },
  { href: "/dlq", label: "DLQ" },
  { href: "/settings/tenants", label: "Tenant Limits" }
] satisfies ReadonlyArray<{ href: Route; label: string }>;

export const NavShell = () => {
  const pathname = usePathname();

  return (
    <header className="top-shell">
      <div>
        <h1>QueueOps Console</h1>
        <p>Job Queue LLM Orchestrator v1 mock operator panel</p>
      </div>
      <nav>
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : ""}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};
