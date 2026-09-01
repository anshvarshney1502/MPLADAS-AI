"use client";

import { useCallback, useEffect, useState } from "react";

const SCALES = [0.9, 1, 1.1, 1.2] as const;
const STORAGE_KEY = "mplads-ai-text-scale";

export function useTextScale() {
  const [index, setIndex] = useState(1); // default 1.0

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    const parsed = saved ? Number(saved) : NaN;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < SCALES.length) setIndex(parsed);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--a11y-scale", String(SCALES[index]));
    try {
      window.localStorage.setItem(STORAGE_KEY, String(index));
    } catch {
      // ignore
    }
  }, [index]);

  const decrease = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const reset = useCallback(() => setIndex(1), []);
  const increase = useCallback(() => setIndex((i) => Math.min(SCALES.length - 1, i + 1)), []);

  return { decrease, reset, increase, scale: SCALES[index] };
}
