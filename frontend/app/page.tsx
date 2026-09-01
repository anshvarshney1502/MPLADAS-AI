"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";

export default function RootPage() {
  const { role, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(role ? "/overview" : "/login");
  }, [hydrated, role, router]);

  return <div className="flex h-screen items-center justify-center bg-background text-sm text-text-muted">Loading…</div>;
}
