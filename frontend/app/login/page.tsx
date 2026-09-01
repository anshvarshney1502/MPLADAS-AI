"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { AccessibilityBar } from "@/components/AccessibilityBar";
import { useRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/role-context";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["ministry", "state", "district", "mp"];

export default function LoginPage() {
  const { setRole } = useRole();
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("district");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power1.out" });
    }
  }, []);

  function continueAs(role: Role) {
    setRole(role);
    router.push("/overview");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      <AccessibilityBar />
      <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-primary bg-accent-soft font-heading text-lg font-bold text-primary">
          M
        </div>
        <div>
          <div className="text-[11px] font-medium text-text-muted">Independent Analysis Prototype</div>
          <div className="font-heading text-[17px] font-bold leading-tight text-primary">MPLADS AI</div>
          <div className="text-[12px] font-semibold leading-tight text-text-secondary">Risk &amp; Monitoring Intelligence</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div ref={cardRef} className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="px-6 py-6">
            <h1 className="font-heading text-base font-bold text-primary">Select access role</h1>
            <p className="mt-1 text-[12px] text-text-secondary">
              Choose how you&apos;d like to view the platform. Roles can be switched anytime from the header.
            </p>

            <div className="mt-4 space-y-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelected(r)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors ${
                    selected === r ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-soft"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-2 ${
                      selected === r ? "border-accent" : "border-border"
                    }`}
                  >
                    {selected === r ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  </span>
                  <span>
                    <span className={`block text-[12px] font-semibold ${selected === r ? "text-primary" : "text-text-secondary"}`}>
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="block text-[10.5px] text-text-muted">{ROLE_DESCRIPTIONS[r]}</span>
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => continueAs(selected)}
              className="mt-5 w-full rounded-[var(--radius-md)] bg-primary py-2.5 text-[13px] font-bold tracking-wide text-white transition-colors hover:bg-primary-secondary"
            >
              CONTINUE
            </button>
          </div>
          <div className="rounded-b-[var(--radius-lg)] border-t border-border bg-surface-soft px-6 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Demo Access · Prototype Dataset
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-surface px-6 py-3 text-center text-[10.5px] text-text-muted">
        MPLADS AI is an independent analysis prototype and is not affiliated with, endorsed by, or a replacement for
        MPLADS/eSAKSHI or any Government of India system.
      </div>
    </div>
  );
}
