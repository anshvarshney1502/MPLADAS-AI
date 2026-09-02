"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Hammer,
  Wallet,
  BarChart3,
  ClipboardList,
  Network,
  FileText,
  X,
} from "lucide-react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/risk-intelligence", label: "Risk Intelligence", icon: ShieldAlert },
  { href: "/works", label: "Works", icon: Hammer },
  { href: "/funds", label: "Fund & Payments", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/inspection", label: "Inspection Queue", icon: ClipboardList },
  { href: "/network", label: "Network", icon: Network },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  // Tailwind v4's translate utilities compile to the native CSS `translate`
  // property with dev-mode layer ordering that isn't reliably overridable by
  // class-based `!important` at this breakpoint boundary — computing the
  // "should slide open" state in JS and applying it as inline style sidesteps
  // that cascade entirely instead of fighting it.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const open = isDesktop || mobileOpen;
  const navRef = useRef<HTMLElement>(null);

  function onNavHover(e: React.MouseEvent<HTMLSpanElement>) {
    gsap.to(e.currentTarget, { x: 2, duration: 0.15, ease: "power1.out" });
  }
  function onNavLeave(e: React.MouseEvent<HTMLSpanElement>) {
    gsap.to(e.currentTarget, { x: 0, duration: 0.15, ease: "power1.out" });
  }

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      ) : null}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-64 flex-none flex-col border-r border-border bg-surface transition-transform duration-200 lg:static lg:z-auto"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-6">
          <Image src="/logo.png" alt="MPLADS AI — Risk & Monitoring Intelligence" width={2172} height={724} priority className="h-12 w-auto" />
          <button onClick={onClose} className="rounded-[var(--radius-sm)] p-1 text-text-muted hover:bg-surface-soft lg:hidden">
            <X size={16} />
          </button>
        </div>
        <nav ref={navRef} className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-2">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onClose}>
                <span
                  onMouseEnter={onNavHover}
                  onMouseLeave={onNavLeave}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-sm)] px-3.5 py-2.5 text-[14.5px] font-normal tracking-[-0.01em] transition-colors",
                    active ? "bg-accent-soft font-medium text-accent" : "text-text-secondary hover:bg-surface-soft hover:text-text-primary"
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} className={active ? "text-accent" : "text-text-muted"} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
