"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useRole } from "@/lib/role-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Close the mobile slide-over on route change — adjusted during render
  // (comparing the previous pathname) rather than in an effect, per React's
  // "you might not need an effect" guidance for derived UI state.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
  }

  useEffect(() => {
    if (hydrated && !role) router.replace("/login");
  }, [hydrated, role, router]);

  if (!hydrated || !role) {
    return <div className="flex h-screen items-center justify-center bg-background text-sm text-text-muted">Loading…</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-6 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
