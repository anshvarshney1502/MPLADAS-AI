"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { gsap } from "gsap";
import { LoginMapBackdrop } from "@/components/LoginMapBackdrop";
import { useRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/role-context";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["ministry", "state", "district", "mp"];

export default function LoginPage() {
  const { setRole } = useRole();
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("ministry");
  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    if (brandRef.current) {
      tl.fromTo(brandRef.current.children, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    }
    if (cardRef.current) {
      tl.fromTo(cardRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" }, "-=0.25");
    }
    if (optionsRef.current) {
      tl.fromTo(
        optionsRef.current.children,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: "power2.out" },
        "-=0.15"
      );
    }
  }, []);

  function continueAs(role: Role) {
    setRole(role);
    router.push("/overview");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col overflow-hidden bg-sidebar-bg px-14 py-12 text-white lg:flex">
        <LoginMapBackdrop />
        <div ref={brandRef} className="relative">
          <Image src="/logo-light.png" alt="MPLADS AI — Risk & Monitoring Intelligence" width={2172} height={724} priority className="h-9 w-auto" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-surface-soft px-4 py-10">
        <div ref={cardRef} className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-card-hover)]">
          <div className="px-7 py-7">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-primary font-heading text-sm font-bold text-white">M</div>
              <div>
                <div className="font-heading text-[14px] font-bold text-primary">MPLADS AI</div>
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Risk &amp; Monitoring Intelligence</div>
              </div>
            </div>
            <h2 className="font-heading text-lg font-bold text-primary">Select access role</h2>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              Choose how you&apos;d like to view the platform. Roles can be switched anytime from the top bar.
            </p>

            <div ref={optionsRef} className="mt-5 space-y-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelected(r)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors ${
                    selected === r ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-soft"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-2 transition-colors ${
                      selected === r ? "border-accent" : "border-border"
                    }`}
                  >
                    {selected === r ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  </span>
                  <span>
                    <span className={`block text-[12.5px] font-semibold ${selected === r ? "text-primary" : "text-text-secondary"}`}>
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="block text-[10.5px] text-text-muted">{ROLE_DESCRIPTIONS[r]}</span>
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => continueAs(selected)}
              className="mt-6 w-full rounded-[var(--radius-md)] bg-primary py-2.5 text-[13px] font-bold tracking-wide text-white transition-colors hover:bg-primary-secondary active:scale-[0.99]"
            >
              CONTINUE
            </button>
          </div>
          <div className="rounded-b-[var(--radius-lg)] border-t border-border bg-surface-soft px-7 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Demo Access
          </div>
        </div>
      </div>
    </div>
  );
}
