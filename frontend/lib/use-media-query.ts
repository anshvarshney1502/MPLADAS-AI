"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Syncing from the viewport (an external system) is exactly what this
    // effect is for — can't be a lazy useState initializer without a
    // hydration mismatch, since matchMedia doesn't exist during SSR.
    const mql = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches);
    setHydrated(true);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return hydrated && matches;
}
