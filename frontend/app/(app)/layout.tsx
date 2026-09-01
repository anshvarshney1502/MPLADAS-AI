"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { useRole } from "@/lib/role-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !role) router.replace("/login");
  }, [hydrated, role, router]);

  if (!hydrated || !role) {
    return <div className="flex h-screen items-center justify-center bg-background text-sm text-text-muted">Loading…</div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      <NavBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
