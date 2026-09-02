"use client";

import { gsap } from "gsap";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fast, subtle stagger reveal for a list of sibling elements — used for KPI
 * rows, card grids, and table rows settling into place. Skips entirely under
 * prefers-reduced-motion (final state applied instantly). */
export function staggerReveal(targets: Element[] | NodeListOf<Element>, opts?: { delay?: number }) {
  if (!targets || (targets as Element[]).length === 0) return;
  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    targets,
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.045, delay: opts?.delay ?? 0, overwrite: true }
  );
}

/**
 * Reveals a section once when it scrolls into view. Uses a plain
 * IntersectionObserver rather than GSAP's ScrollTrigger, since the app
 * shell scrolls inside a custom `<main>` container rather than the window —
 * ScrollTrigger's default window-based scroller would never fire in that
 * layout, leaving the section permanently at its `opacity: 0` starting
 * state. IntersectionObserver works against whichever ancestor actually
 * scrolls, with no configuration needed.
 */
export function sectionReveal(target: Element) {
  if (prefersReducedMotion()) {
    gsap.set(target, { opacity: 1, y: 0 });
    return () => {};
  }
  gsap.set(target, { opacity: 0, y: 16 });
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          gsap.to(target, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", overwrite: true });
          observer.unobserve(target);
        }
      }
    },
    { threshold: 0.15 }
  );
  observer.observe(target);
  return () => observer.disconnect();
}

/** Animates a number counting up to its final value, formatted with the
 * given formatter on every tick. Cancels cleanly on unmount/re-run. */
export function countUp(
  el: Element,
  target: number,
  format: (n: number) => string,
  opts?: { duration?: number }
): gsap.core.Tween {
  const counter = { n: 0 };
  if (prefersReducedMotion()) {
    (el as HTMLElement).textContent = format(target);
    return gsap.to(counter, { duration: 0 });
  }
  return gsap.to(counter, {
    n: target,
    duration: opts?.duration ?? 0.8,
    ease: "power2.out",
    overwrite: true,
    onUpdate: () => {
      (el as HTMLElement).textContent = format(counter.n);
    },
  });
}
