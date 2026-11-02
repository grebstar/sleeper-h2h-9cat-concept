// Roster slots, positional eligibility and the daily lineup optimizer.

export const SLOT_ELIGIBILITY = {
  PG: ["PG"],
  SG: ["SG"],
  G: ["PG", "SG"],
  SF: ["SF"],
  PF: ["PF"],
  F: ["SF", "PF"],
  C: ["C"],
  UTIL: ["PG", "SG", "SF", "PF", "C"],
  BN: ["PG", "SG", "SF", "PF", "C"],
  IR: [], // requires an injury designation (OUT/IR) from the injury feed
};

// ESPN/Yahoo standard 9-cat roster: 10 starters, 3 bench, 1 IR
export const DEFAULT_SLOTS = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL", "UTIL", "UTIL", "BN", "BN", "BN", "IR"];

export const isStarterSlot = (s) => s !== "BN" && s !== "IR";

export function canPlaySlot(player, slot) {
  if (!player) return false;
  if (slot === "IR") return !!player.injury && /OUT|IR/.test(player.injury);
  return player.pos.some((p) => SLOT_ELIGIBILITY[slot].includes(p));
}

/** Kuhn's augmenting-path bipartite matching: assign as many `players` as possible to starter slots,
 *  trying higher-priority players first. Returns Map<slotIndex, playerId>. */
function matchToSlots(players, slots, slotIdxs) {
  const slotOwner = new Map();
  const tryAssign = (p, seen) => {
    for (const si of slotIdxs) {
      if (seen.has(si) || !canPlaySlot(p, slots[si])) continue;
      seen.add(si);
      const cur = slotOwner.get(si);
      if (!cur || tryAssign(cur, seen)) {
        slotOwner.set(si, p);
        return true;
      }
    }
    return false;
  };
  for (const p of players) tryAssign(p, new Set());
  const out = new Map();
  for (const [si, p] of slotOwner) out.set(si, p.id);
  return out;
}

/**
 * Best lineup for one day: start as many players with a game as possible (by value), then fill
 * empty starter slots with remaining players, then bench. IR assignments are preserved.
 * @param lineup  current array of playerIds aligned with slots
 * @param byId    Map(id -> player)
 * @param playingToday  Set of player ids with a game
 * @param valueOf (id) -> number
 */
export function optimizeLineup(slots, lineup, byId, playingToday, valueOf) {
  const next = new Array(slots.length).fill(null);
  const irIdx = slots.map((s, i) => (s === "IR" ? i : -1)).filter((i) => i >= 0);
  const kept = new Set();
  for (const i of irIdx) if (lineup[i]) { next[i] = lineup[i]; kept.add(lineup[i]); }
  const pool = lineup.filter((id) => id && !kept.has(id)).map((id) => byId.get(id)).filter(Boolean);
  const starterIdx = slots.map((s, i) => (isStarterSlot(s) ? i : -1)).filter((i) => i >= 0);
  const byVal = (a, b) => valueOf(b.id) - valueOf(a.id);
  const playing = pool.filter((p) => playingToday.has(p.id)).sort(byVal);
  const m1 = matchToSlots(playing, slots, starterIdx);
  const used = new Set(m1.values());
  for (const [si, id] of m1) next[si] = id;
  const openStarters = starterIdx.filter((i) => !next[i]);
  const rest = pool.filter((p) => !used.has(p.id)).sort(byVal);
  const m2 = matchToSlots(rest, slots, openStarters);
  for (const [si, id] of m2) { next[si] = id; used.add(id); }
  const benchIdx = slots.map((s, i) => (s === "BN" ? i : -1)).filter((i) => i >= 0);
  const leftovers = pool.filter((p) => !used.has(p.id)).sort(byVal);
  // any leftover goes to a bench slot, or to any empty slot as a last resort (keeps roster intact)
  for (const p of leftovers) {
    const bi = benchIdx.find((i) => !next[i]);
    if (bi !== undefined) next[bi] = p.id;
    else {
      const anyIdx = next.findIndex((x, i) => !x && slots[i] !== "IR");
      if (anyIdx >= 0) next[anyIdx] = p.id;
    }
  }
  return next;
}

/** Validate a manual move. Returns the new lineup or throws with a user-facing message. */
export function moveInLineup(slots, lineup, byId, fromIdx, toIdx) {
  const next = lineup.slice();
  const a = next[fromIdx];
  const b = next[toIdx];
  const pa = byId.get(a);
  const pb = b ? byId.get(b) : null;
  if (pa && !canPlaySlot(pa, slots[toIdx]) && slots[toIdx] !== "BN") throw new Error(`${pa.name} isn't eligible at ${slots[toIdx]}`);
  if (pb && !canPlaySlot(pb, slots[fromIdx]) && slots[fromIdx] !== "BN") throw new Error(`${pb.name} isn't eligible at ${slots[fromIdx]}`);
  next[fromIdx] = b || null;
  next[toIdx] = a;
  return next;
}

export function rosterIds(team) {
  return team.lineup.filter(Boolean);
}
