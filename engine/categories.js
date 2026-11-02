// Category definitions + comparison logic. A league's scoring is just an ordered list of category ids,
// so 8-cat, 9-cat, 10-cat (+DD) and A/TO variants are all configuration, not code.

export const STAT_KEYS = ["fgm", "fga", "tpm", "ftm", "fta", "pts", "reb", "ast", "stl", "blk", "to", "dd", "gp"];

export const CATEGORY_LIBRARY = {
  fg: { id: "fg", label: "FG%", type: "pct", num: "fgm", den: "fga", higherBetter: true, digits: 3 },
  ft: { id: "ft", label: "FT%", type: "pct", num: "ftm", den: "fta", higherBetter: true, digits: 3 },
  tpm: { id: "tpm", label: "3PM", type: "count", stat: "tpm", higherBetter: true },
  pts: { id: "pts", label: "PTS", type: "count", stat: "pts", higherBetter: true },
  reb: { id: "reb", label: "REB", type: "count", stat: "reb", higherBetter: true },
  ast: { id: "ast", label: "AST", type: "count", stat: "ast", higherBetter: true },
  stl: { id: "stl", label: "STL", type: "count", stat: "stl", higherBetter: true },
  blk: { id: "blk", label: "BLK", type: "count", stat: "blk", higherBetter: true },
  to: { id: "to", label: "TO", type: "count", stat: "to", higherBetter: false },
  dd: { id: "dd", label: "DD", type: "count", stat: "dd", higherBetter: true },
  ato: { id: "ato", label: "A/TO", type: "ratio", num: "ast", den: "to", higherBetter: true, digits: 2 },
};

export const PRESETS = {
  "9cat": { label: "9-Cat (standard)", cats: ["fg", "ft", "tpm", "pts", "reb", "ast", "stl", "blk", "to"] },
  "8cat": { label: "8-Cat (no TO)", cats: ["fg", "ft", "tpm", "pts", "reb", "ast", "stl", "blk"] },
  "10cat": { label: "10-Cat (+DD)", cats: ["fg", "ft", "tpm", "pts", "reb", "ast", "stl", "blk", "to", "dd"] },
  "11cat": { label: "11-Cat (+DD, A/TO)", cats: ["fg", "ft", "tpm", "pts", "reb", "ast", "stl", "blk", "to", "dd", "ato"] },
};

export const SCORING_TYPES = {
  h2h_each: { label: "H2H Each Category", desc: "Every category is a W/L/T in the standings (e.g. a 6-3 week = 6 wins, 3 losses)." },
  h2h_most: { label: "H2H Most Categories", desc: "Win the majority of categories to earn one win for the week." },
  roto: { label: "Rotisserie", desc: "Season-long totals ranked per category; no weekly matchups." },
};

export function emptyTotals() {
  const t = {};
  for (const k of STAT_KEYS) t[k] = 0;
  return t;
}

export function addInto(t, line, mult = 1) {
  for (const k of STAT_KEYS) t[k] += (line[k] || 0) * mult;
  return t;
}

export function catValue(cat, totals) {
  const c = typeof cat === "string" ? CATEGORY_LIBRARY[cat] : cat;
  if (c.type === "pct" || c.type === "ratio") {
    const den = totals[c.den] || 0;
    return den > 0 ? totals[c.num] / den : null;
  }
  return totals[c.stat] || 0;
}

export function formatCat(cat, v) {
  const c = typeof cat === "string" ? CATEGORY_LIBRARY[cat] : cat;
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (c.type === "pct") return v.toFixed(3).replace(/^0/, "");
  if (c.type === "ratio") return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Returns 1 if A wins the category, -1 if B wins, 0 for a tie. Percentages are compared at 3 decimals,
 *  matching how every major host displays/ties them. A side with zero attempts loses a pct category
 *  to a side with attempts. */
export function compareCat(cat, a, b) {
  const c = typeof cat === "string" ? CATEGORY_LIBRARY[cat] : cat;
  let va = catValue(c, a);
  let vb = catValue(c, b);
  if (va === null && vb === null) return 0;
  if (va === null) return -1;
  if (vb === null) return 1;
  if (c.type === "pct") {
    va = Math.round(va * 1000);
    vb = Math.round(vb * 1000);
  } else if (c.type === "ratio") {
    va = Math.round(va * 100);
    vb = Math.round(vb * 100);
  } else {
    va = Math.round(va * 10);
    vb = Math.round(vb * 10);
  }
  if (va === vb) return 0;
  return (va > vb) === c.higherBetter ? 1 : -1;
}

export function compareTotals(cats, a, b) {
  const rows = cats.map((id) => {
    const r = compareCat(id, a, b);
    return { id, a: catValue(id, a), b: catValue(id, b), result: r };
  });
  const wins = rows.filter((r) => r.result === 1).length;
  const losses = rows.filter((r) => r.result === -1).length;
  return { rows, wins, losses, ties: rows.length - wins - losses };
}
