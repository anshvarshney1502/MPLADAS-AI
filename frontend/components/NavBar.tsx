"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/risk-intelligence", label: "Risk Intelligence" },
  { href: "/works", label: "Works" },
  { href: "/funds", label: "Fund & Payments" },
  { href: "/analytics", label: "Analytics" },
  { href: "/inspection", label: "Inspection Queue" },
  { href: "/network", label: "Network" },
  { href: "/reports", label: "Reports" },
];

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="flex-none border-b border-primary bg-primary">
      <div className="mx-auto flex max-w-[1400px] items-center px-5">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center gap-2 py-2.5 text-[12.5px] font-semibold text-white lg:hidden"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          Menu
        </button>
        <div className="hidden flex-wrap items-center lg:flex">
          {NAV.map((item, i) => {
            const active = pathname?.startsWith(item.href);
            return (
              <span key={item.href} className="flex items-center">
                {i > 0 ? <span className="text-white/25">|</span> : null}
                <Link
                  href={item.href}
                  className={cn(
                    "px-4 py-2.5 text-[12.5px] font-semibold transition-colors",
                    active ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              </span>
            );
          })}
        </div>
      </div>
      {mobileOpen ? (
        <div className="border-t border-white/10 bg-primary-secondary lg:hidden">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-5 py-2.5 text-[12.5px] font-semibold",
                  active ? "bg-white/10 text-white" : "text-white/70"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
