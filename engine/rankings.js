// Category value (z-score) rankings with punt support and a dynasty age curve.
// Percentages are weighted by volume ("impact"): (FG% - league FG%) * FGA, the standard approach,
// so a 60% shooter on 4 attempts is not ranked above a 52% shooter on 20.
import { CATEGORY_LIBRARY } from "./categories.js";
import { expectedLine } from "./sim.js";

function rawFor(catId, line, ctx) {
  const c = CATEGORY_LIBRARY[catId];
  if (c.type === "pct") return line[c.num] - ctx.pct[catId] * line[c.den];
  if (c.type === "ratio") return line[c.num] - ctx.pct[catId] * line[c.den];
  return line[c.stat] || 0;
}

/**
 * @param players  array of player objects (with .proj)
 * @param cats     category ids in the league
 * @param opts     { poolSize, punt: Set<catId>, basis: 'proj' | 's2627' | 's2526' }
 * @returns Map<playerId, { total, z: {catId: z}, rank }>
 */
export function computeValues(players, cats, opts = {}) {
  const poolSize = opts.poolSize || 150;
  const punt = opts.punt || new Set();
  const basis = opts.basis || "proj";
  const lineOf = (p) => {
    if (basis === "proj") return expectedLine(p);
    const l = p[basis];
    if (!l) return null;
    const tens = ["pts", "reb", "ast"].filter((k) => l[k] >= 9).length;
    return { ...l, dd: tens >= 2 ? 0.55 : 0.05 };
  };
  const withLines = players.map((p) => ({ p, l: lineOf(p) })).filter((x) => x.l);

  // pass 1: rough pool by simple production, pass 2: proper z pool
  let pool = withLines
    .slice()
    .sort((a, b) => b.l.pts + b.l.reb * 1.2 + b.l.ast * 1.5 + (b.l.stl + b.l.blk) * 3 - (a.l.pts + a.l.reb * 1.2 + a.l.ast * 1.5 + (a.l.stl + a.l.blk) * 3))
    .slice(0, poolSize);

  let stats = null;
  for (let pass = 0; pass < 2; pass++) {
    const ctx = { pct: {} };
    for (const id of cats) {
      const c = CATEGORY_LIBRARY[id];
      if (c.type === "pct" || c.type === "ratio") {
        const num = pool.reduce((s, x) => s + x.l[c.num], 0);
        const den = pool.reduce((s, x) => s + x.l[c.den], 0);
        ctx.pct[id] = den ? num / den : 0;
      }
    }
    const mean = {};
    const sd = {};
    for (const id of cats) {
      const vals = pool.map((x) => rawFor(id, x.l, ctx));
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      const v = vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length;
      mean[id] = m;
      sd[id] = Math.sqrt(v) || 1;
    }
    stats = { ctx, mean, sd };
    const scored = withLines.map((x) => ({ ...x, v: zTotal(x.l, cats, stats, punt).total }));
    pool = scored.sort((a, b) => b.v - a.v).slice(0, poolSize);
  }

  const out = new Map();
  const all = withLines.map((x) => ({ id: x.p.id, ...zTotal(x.l, cats, stats, punt) }));
  all.sort((a, b) => b.total - a.total);
  all.forEach((r, i) => out.set(r.id, { ...r, rank: i + 1 }));
  for (const p of players) if (!out.has(p.id)) out.set(p.id, { id: p.id, total: -99, z: {}, rank: 9999 });
  out.stats = stats;
  return out;
}

function zTotal(line, cats, stats, punt) {
  const z = {};
  let total = 0;
  for (const id of cats) {
    const c = CATEGORY_LIBRARY[id];
    let v = (rawFor(id, line, stats.ctx) - stats.mean[id]) / stats.sd[id];
    if (!c.higherBetter) v = -v;
    z[id] = Math.round(v * 100) / 100;
    if (!punt.has(id)) total += v;
  }
  return { z, total: Math.round(total * 100) / 100 };
}

/** Dynasty value: current value plus an age curve (peak ~ 24-28) and rookie upside. */
export function dynastyValue(player, value) {
  const age = player.age || 27;
  let adj = 0;
  if (age <= 21) adj = 1.8;
  else if (age <= 23) adj = 1.3;
  else if (age <= 25) adj = 0.7;
  else if (age <= 28) adj = 0;
  else if (age <= 30) adj = -0.8;
  else if (age <= 32) adj = -1.8;
  else if (age <= 34) adj = -3.0;
  else adj = -4.2;
  let base = value ? value.total : -6;
  if (base < -90) base = -6;
  if (player.exp === 0 && player.note && /Pick (\d+)/.test(player.note)) {
    const pick = Number(player.note.match(/Pick (\d+)/)[1]);
    base = Math.max(base, 2.2 - pick * 0.15); // draft capital as a floor for unproven rookies
  }
  return Math.round((base + adj) * 100) / 100;
}
