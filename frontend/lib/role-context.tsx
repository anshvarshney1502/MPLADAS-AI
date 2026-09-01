"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Role } from "./types";

export interface RoleScope {
  state?: string;
  constituency?: string;
  mp?: string;
}

interface RoleContextValue {
  role: Role | null;
  scope: RoleScope;
  hydrated: boolean;
  setRole: (role: Role) => void;
  setScope: (scope: RoleScope) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const STORAGE_KEY = "mplads-ai-role";
const SCOPE_KEY = "mplads-ai-scope";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [scope, setScopeState] = useState<RoleScope>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time hydration from localStorage after mount — required because
    // localStorage doesn't exist during SSR, so this can't be a lazy
    // useState initializer without causing a hydration mismatch.
    try {
      const storedRole = window.localStorage.getItem(STORAGE_KEY) as Role | null;
      const storedScope = window.localStorage.getItem(SCOPE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (storedRole) setRoleState(storedRole);
      if (storedScope) setScopeState(JSON.parse(storedScope));
    } catch {
      // localStorage unavailable — proceed unauthenticated
    }
    setHydrated(true);
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const setScope = useCallback((next: RoleScope) => {
    setScopeState(next);
    try {
      window.localStorage.setItem(SCOPE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    setScopeState({});
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SCOPE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <RoleContext.Provider value={{ role, scope, hydrated, setRole, setScope, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  ministry: "Ministry",
  state: "State Nodal Authority",
  district: "District Authority",
  mp: "MP",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ministry: "National oversight across all states",
  state: "Manages districts within one state",
  district: "Reviews and inspects flagged works",
  mp: "Views own constituency works",
};
