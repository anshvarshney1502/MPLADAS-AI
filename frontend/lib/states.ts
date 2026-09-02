// Single reusable canonical state-name mapping, shared by every part of the
// app that needs to match a state name against the backend's real `State`
// column (the India Risk Map, and the Works/Risk Intelligence state
// filters). The boundary/topojson dataset and the backend dataset spell a
// handful of states differently (e.g. "Orissa" vs "Odisha") — normalizing
// both sides through the same key here means any UI that resolves a name
// through it agrees on one identity instead of drifting apart.

export function normalizeStateKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

const STATE_ALIASES: Record<string, string> = {
  odisha: "orissa",
  puducherry: "pondicherry",
  uttarakhand: "uttaranchal",
  delhi: "nctofdelhi",
  andamanandnicobarislands: "andamanandnicobar",
};

export function stateKeyFor(name: string): string {
  const n = normalizeStateKey(name);
  return STATE_ALIASES[n] ?? n;
}

/**
 * Resolves any spelling of a state name to the exact string the backend
 * actually uses (from `knownStates`, the real list returned by
 * /api/geo/risk-by-state). Falls back to the raw input unchanged if no
 * known state shares its key — never invents a state that isn't real.
 */
export function canonicalStateName(rawName: string, knownStates: string[]): string {
  const key = stateKeyFor(rawName);
  return knownStates.find((s) => stateKeyFor(s) === key) ?? rawName;
}
