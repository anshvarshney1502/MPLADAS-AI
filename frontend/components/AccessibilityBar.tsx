"use client";

import { useTextScale } from "@/lib/use-text-scale";

export function AccessibilityBar() {
  const { decrease, reset, increase } = useTextScale();

  return (
    <div className="flex h-7 flex-none items-center justify-end gap-3 bg-utility-bar-bg px-5 text-[11px] font-semibold text-white/80">
      <span className="hidden sm:inline text-white/50">Text size</span>
      <button onClick={decrease} className="hover:text-white" aria-label="Decrease text size">
        A-
      </button>
      <span className="text-white/30">|</span>
      <button onClick={reset} className="hover:text-white" aria-label="Reset text size">
        A
      </button>
      <span className="text-white/30">|</span>
      <button onClick={increase} className="hover:text-white" aria-label="Increase text size">
        A+
      </button>
    </div>
  );
}
