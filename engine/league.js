// League state machine: creation, daily simulation, matchups, standings, transactions, trades, drafts.
// State is a plain JSON-serializable object so it can live in a DB row / Redux store / localStorage.
import { PRESETS, emptyTotals, addInto, compareTotals } from "./categories.js";
import { DEFAULT_SLOTS, isStarterSlot, optimizeLineup, moveInLineup, canPlaySlot } from "./lineup.js";
import { teamsPlayingOn, weekRange, weekOfDay, SEASON, totalWeeks } from "./calendar.js";
import { gameLog, expectedLine } from "./sim.js";
import { computeValues, dynastyValue } from "./rankings.js";
import { rngFor, shuffle } from "./rng.js";

export const SCHEDULE_SEED = "nba-2026-27";

// ---------------------------------------------------------------- player index / values (cached)
let PLAYERS = [];
let BY_ID = new Map();
const valueCache = new Map();

export function setPlayerUniverse(players) {
  PLAYERS = players;
  BY_ID = new Map(players.map((p) => [p.id, p]));
  valueCache.clear();
}
export const allPlayers = () => PLAYERS;
export const playerById = (id) => BY_ID.get(id);

export function valuesFor(league, punt = null, basis = "proj") {
  const key = league.settings.cats.join(",") + "|" + (punt ? [...punt].sort().join(",") : "") + "|" + basis + "|" + league.settings.teams;
  if (!valueCache.has(key)) {
    const poolSize = league.settings.teams * 13;
    valueCache.set(key, computeValues(PLAYERS, league.settings.cats, { poolSize, punt: punt || new Set(), basis }));
  }
  return valueCache.get(key);
}
export function valueOf(league, id) {
  const v = valuesFor(league).get(id);
  const base = v ? v.total : -99;
  if (league.type === "dynasty") return dynastyValue(BY_ID.get(id), v);
  return base;
}

// ---------------------------------------------------------------- creation
const COLORS = ["#00ceb8", "#7b61ff", "#ff6b6b", "#ffb020", "#3aa0ff", "#ff7ad9", "#46d160", "#f2c94c", "#a0aec0", "#ff8a3d",
  "#5ee7df", "#c084fc", "#fb7185", "#facc15", "#60a5fa", "#34d399"];

export function defaultSettings(type = "dynasty", teams = 10) {
  return {
    teams,
    cats: PRESETS["9cat"].cats.slice(),
    preset: "9cat",
    scoring: "h2h_each",
    slots: DEFAULT_SLOTS.slice(),
    taxiSlots: type === "dynasty" ? 3 : 0,
    taxiMaxExp: 1,
    playoffTeams: teams >= 10 ? 6 : 4,
    regularSeasonWeeks: SEASON.regularSeasonWeeks,
    lineupLock: "daily",
    maxAcqPerWeek: 4,
    tradeDeadlineWeek: 16,
    draftType: "snake",
    rookieDraftRounds: type === "dynasty" ? 2 : 0,
    futurePickYears: type === "dynasty" ? 2 : 0,
    waiverType: "rolling",
  };
}

/**
 * @param cfg { id, name, type: 'dynasty'|'redraft', settings, teams: [{name, owner, isUser}], todayDay, predrafted }
 */
export function createLeague(cfg) {
  const settings = { ...defaultSettings(cfg.type, cfg.teams.length), ...(cfg.settings || {}) };
  settings.teams = cfg.teams.length;
  const league = {
    id: cfg.id,
    name: cfg.name,
    type: cfg.type,
    season: "2026-27",
    seed: cfg.seed || cfg.id,
    settings,
    teams: cfg.teams.map((t, i) => ({
      id: "t" + (i + 1),
      name: t.name,
      owner: t.owner,
      isUser: !!t.isUser,
      color: COLORS[i % COLORS.length],
      lineup: new Array(settings.slots.length).fill(null),
      taxi: [],
      autoStart: true,
      manualDays: [],
      acq: {},
    })),
    matchups: {},
    currentDay: 0,
    started: {},
    transactions: [],
    chat: [],
    picks: [],
    tradeOffers: [],
    draft: null,
    status: "predraft",
  };
  league.matchups = buildFantasySchedule(league);
  if (league.type === "dynasty") league.picks = buildFuturePicks(league, 2027);
  return league;
}

function buildFantasySchedule(league) {
  const ids = league.teams.map((t) => t.id);
  const n = ids.length;
  const list = n % 2 ? [...ids, null] : ids.slice();
  const rounds = [];
  for (let r = 0; r < list.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  const out = {};
  for (let w = 1; w <= league.settings.regularSeasonWeeks; w++) out[w] = rounds[(w - 1) % rounds.length];
  return out;
}

function buildFuturePicks(league, firstSeason) {
  const picks = [];
  for (let y = 0; y < league.settings.futurePickYears; y++)
    for (let r = 1; r <= Math.max(1, league.settings.rookieDraftRounds); r++)
      for (const t of league.teams) picks.push({ id: `${firstSeason + y}-${r}-${t.id}`, season: firstSeason + y, round: r, originalTeam: t.id, owner: t.id });
  return picks;
}

// ---------------------------------------------------------------- roster helpers
export const teamById = (league, id) => league.teams.find((t) => t.id === id);
export const userTeam = (league) => league.teams.find((t) => t.isUser);
export function rosterOf(team) {
  return team.lineup.filter(Boolean);
}
export function allRostered(league) {
  const s = new Set();
  for (const t of league.teams) {
    for (const id of t.lineup) if (id) s.add(id);
    for (const id of t.taxi) s.add(id);
  }
  return s;
}
export function ownerOf(league, pid) {
  return league.teams.find((t) => t.lineup.includes(pid) || t.taxi.includes(pid)) || null;
}
export function freeAgents(league) {
  const r = allRostered(league);
  return PLAYERS.filter((p) => !r.has(p.id));
}
function openSlotIndex(league, team) {
  const { slots } = league.settings;
  let i = team.lineup.findIndex((x, k) => !x && slots[k] === "BN");
  if (i < 0) i = team.lineup.findIndex((x, k) => !x && slots[k] !== "IR");
  return i;
}
export function rosterSpace(league, team) {
  const { slots } = league.settings;
  return team.lineup.filter((x, k) => !x && slots[k] !== "IR").length;
}
function placeOnRoster(league, team, pid) {
  const i = openSlotIndex(league, team);
  if (i < 0) throw new Error("Roster is full");
  team.lineup[i] = pid;
}
function removeFromTeam(team, pid) {
  team.lineup = team.lineup.map((x) => (x === pid ? null : x));
  team.taxi = team.taxi.filter((x) => x !== pid);
}

// ---------------------------------------------------------------- simulation
export function playingSet(league, day) {
  const games = teamsPlayingOn(day, SCHEDULE_SEED);
  const s = new Set();
  for (const p of PLAYERS) if (p.team && p.proj && games.has(p.team)) s.add(p.id);
  return s;
}

export function autoSetLineup(league, team, day) {
  const vf = (id) => valueOf(league, id);
  team.lineup = optimizeLineup(league.settings.slots, team.lineup, BY_ID, playingSet(league, day), vf);
}

/** Lock today's lineups, record starters, maybe let bots make a waiver move, advance the day. */
export function simulateDay(league, opts = {}) {
  const day = league.currentDay;
  const rand = rngFor(league.seed, "bots", day);
  for (const t of league.teams) {
    if (!t.isUser && !opts.quiet) maybeBotPickup(league, t, rand, day);
    const manual = t.manualDays.includes(day);
    if (t.autoStart && !manual) autoSetLineup(league, t, day);
  }
  league.started[day] = {};
  for (const t of league.teams) {
    // only eligible starters count (an overflow player parked in an open slot they can't play is treated as bench)
    league.started[day][t.id] = t.lineup.filter((id, i) => id && isStarterSlot(league.settings.slots[i]) && canPlaySlot(BY_ID.get(id), league.settings.slots[i]));
  }
  league.currentDay = day + 1;
  // pre-set tomorrow's lineups so managers see who is starting "today"
  for (const t of league.teams) if (t.autoStart) autoSetLineup(league, t, league.currentDay);
  // week rollover hooks
  const wkEnded = weekOfDay(day) !== weekOfDay(day + 1);
  if (wkEnded) onWeekEnd(league, weekOfDay(day));
  return day;
}

export function simulateTo(league, targetDay, opts = {}) {
  while (league.currentDay < targetDay) simulateDay(league, opts);
}

function onWeekEnd(league, week) {
  for (const t of league.teams) t.acq[week + 1] = 0;
  const reg = league.settings.regularSeasonWeeks;
  if (week === reg) seedPlayoffs(league);
  if (week > reg && week < totalWeeks()) advancePlayoffs(league, week);
  if (week === totalWeeks() && league.playoffs && league.matchups[week]) {
    const [a, b] = league.matchups[week][0];
    league.champion = winnerOf(league, week, a, b);
  }
  if (league.settings.scoring !== "roto" && league.matchups[week]) {
    const res = league.matchups[week].map(([a, b]) => {
      const r = matchupResult(league, week, a, b);
      return `${teamById(league, a).name} ${r.wins}-${r.losses}-${r.ties} ${teamById(league, b).name}`;
    });
    if (!league._quietChat) league.chat.push({ kind: "system", day: weekRange(week).end, text: `Week ${week} final: ` + res.join(" · ") });
  }
  if (league.champion && week === totalWeeks()) league.chat.push({ kind: "system", day: league.currentDay, text: `🏆 ${teamById(league, league.champion).name} are your 2026-27 champions!` });
}

function maybeBotPickup(league, team, rand, day) {
  if (rand() > 0.035) return;
  const wk = weekOfDay(day);
  if ((team.acq[wk] || 0) >= league.settings.maxAcqPerWeek) return;
  const fa = freeAgents(league).filter((p) => p.team && p.proj);
  if (!fa.length) return;
  fa.sort((a, b) => valueOf(league, b.id) - valueOf(league, a.id));
  const best = fa[Math.floor(rand() * Math.min(3, fa.length))];
  const roster = rosterOf(team).filter((id) => !team.lineup.slice(-1).includes(id));
  const worst = roster.slice().sort((a, b) => valueOf(league, a) - valueOf(league, b))[0];
  if (!worst || valueOf(league, best.id) <= valueOf(league, worst) + 0.4) return;
  if (league.type === "dynasty" && BY_ID.get(worst).age <= 22) return; // bots don't cut young dynasty assets
  addDrop(league, team.id, best.id, worst, { day, silent: false });
}

// ---------------------------------------------------------------- matchups & standings
const totalsCache = new WeakMap();
export function teamTotalsForDays(league, teamId, start, end) {
  const complete = end < league.currentDay;
  let cache = totalsCache.get(league.started);
  if (!cache) totalsCache.set(league.started, (cache = new Map()));
  const ck = teamId + "|" + start + "|" + end;
  if (complete && cache.has(ck)) return { ...cache.get(ck) };
  const t = emptyTotals();
  for (let d = start; d <= end && d < league.currentDay; d++) {
    const ids = (league.started[d] && league.started[d][teamId]) || [];
    for (const id of ids) {
      const g = gameLog(BY_ID.get(id), d, SCHEDULE_SEED);
      if (g && !g.dnp) addInto(t, g);
    }
  }
  if (complete) cache.set(ck, { ...t });
  return t;
}
export function teamWeekTotals(league, teamId, week) {
  const { start, end } = weekRange(week);
  return teamTotalsForDays(league, teamId, start, end);
}

/** Expected totals for the rest of the week, assuming optimal daily lineups from the current roster. */
export function projectRestOfWeek(league, teamId, week) {
  const team = teamById(league, teamId);
  const { start, end } = weekRange(week);
  const t = emptyTotals();
  let games = 0;
  let lineup = team.lineup.slice();
  for (let d = Math.max(start, league.currentDay); d <= end; d++) {
    const playing = playingSet(league, d);
    const manual = d === league.currentDay && (team.manualDays.includes(d) || !team.autoStart);
    if (!manual) lineup = optimizeLineup(league.settings.slots, lineup, BY_ID, playing, (id) => valueOf(league, id));
    lineup.forEach((id, i) => {
      if (id && isStarterSlot(league.settings.slots[i]) && playing.has(id) && canPlaySlot(BY_ID.get(id), league.settings.slots[i])) {
        addInto(t, expectedLine(BY_ID.get(id)), 0.94);
        games++;
      }
    });
  }
  return { totals: t, games };
}

export function gamesPlayedInWeek(league, teamId, week) {
  const { start, end } = weekRange(week);
  let n = 0;
  for (let d = start; d <= end && d < league.currentDay; d++) {
    for (const id of (league.started[d] && league.started[d][teamId]) || []) {
      const g = gameLog(BY_ID.get(id), d, SCHEDULE_SEED);
      if (g && !g.dnp) n++;
    }
  }
  return n;
}

export function matchupResult(league, week, a, b) {
  return compareTotals(league.settings.cats, teamWeekTotals(league, a, week), teamWeekTotals(league, b, week));
}

export function projectedMatchup(league, week, a, b) {
  const ta = addInto(teamWeekTotals(league, a, week), projectRestOfWeek(league, a, week).totals);
  const tb = addInto(teamWeekTotals(league, b, week), projectRestOfWeek(league, b, week).totals);
  return compareTotals(league.settings.cats, ta, tb);
}

export function matchupFor(league, week, teamId) {
  const pairs = league.matchups[week] || [];
  const p = pairs.find(([a, b]) => a === teamId || b === teamId);
  if (!p) return null;
  return p[0] === teamId ? { me: p[0], opp: p[1] } : { me: p[1], opp: p[0] };
}

export function currentWeek(league) {
  return Math.min(weekOfDay(league.currentDay), totalWeeks());
}

export function standings(league) {
  const rows = new Map(league.teams.map((t) => [t.id, { team: t, w: 0, l: 0, t: 0, catW: 0, catL: 0, catT: 0, weeks: 0, streak: "" , results: [] }]));
  const reg = league.settings.regularSeasonWeeks;
  if (league.settings.scoring === "roto") return rotoStandings(league);
  for (let w = 1; w <= reg; w++) {
    const { end } = weekRange(w);
    if (end >= league.currentDay) break;
    for (const [a, b] of league.matchups[w] || []) {
      const r = matchupResult(league, w, a, b);
      const A = rows.get(a);
      const B = rows.get(b);
      A.catW += r.wins; A.catL += r.losses; A.catT += r.ties;
      B.catW += r.losses; B.catL += r.wins; B.catT += r.ties;
      A.weeks++; B.weeks++;
      if (league.settings.scoring === "h2h_each") {
        A.w += r.wins; A.l += r.losses; A.t += r.ties;
        B.w += r.losses; B.l += r.wins; B.t += r.ties;
      } else {
        if (r.wins > r.losses) { A.w++; B.l++; } else if (r.wins < r.losses) { A.l++; B.w++; } else { A.t++; B.t++; }
      }
      A.results.push(r.wins > r.losses ? "W" : r.wins < r.losses ? "L" : "T");
      B.results.push(r.wins < r.losses ? "W" : r.wins > r.losses ? "L" : "T");
    }
  }
  const list = [...rows.values()].map((r) => {
    const g = r.w + r.l + r.t;
    const last = r.results[r.results.length - 1];
    let n = 0;
    for (let i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) n++;
    return { ...r, pct: g ? (r.w + r.t / 2) / g : 0, streak: last ? last + n : "—" };
  });
  list.sort((x, y) => y.pct - x.pct || y.catW - x.catW || x.team.name.localeCompare(y.team.name));
  const top = list[0];
  list.forEach((r, i) => {
    r.rank = i + 1;
    r.gb = i === 0 ? "—" : (((top.w - r.w) + (r.l - top.l)) / 2).toFixed(1);
  });
  return list;
}

function rotoStandings(league) {
  const totals = league.teams.map((t) => {
    const tot = teamTotalsForDays(league, t.id, 0, league.currentDay - 1);
    return { team: t, tot };
  });
  const cats = league.settings.cats;
  const pts = new Map(totals.map((x) => [x.team.id, 0]));
  for (const c of cats) {
    const sorted = totals.slice().sort((a, b) => compareTotals([c], a.tot, b.tot).wins - compareTotals([c], b.tot, a.tot).wins);
    sorted.forEach((x, i) => pts.set(x.team.id, pts.get(x.team.id) + i + 1));
  }
  return totals
    .map((x) => ({ team: x.team, roto: pts.get(x.team.id), w: 0, l: 0, t: 0, catW: pts.get(x.team.id), pct: 0, gb: "", streak: "" }))
    .sort((a, b) => b.roto - a.roto)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------------------------------------------------------------- playoffs
function seedPlayoffs(league) {
  const st = standings(league);
  const n = league.settings.playoffTeams;
  const seeds = st.slice(0, n).map((r) => r.team.id);
  league.playoffs = { seeds, rounds: [] };
  const w = league.settings.regularSeasonWeeks + 1;
  if (n === 6) league.matchups[w] = [[seeds[2], seeds[5]], [seeds[3], seeds[4]]];
  else league.matchups[w] = [[seeds[0], seeds[3]], [seeds[1], seeds[2]]];
  league.playoffs.byes = n === 6 ? [seeds[0], seeds[1]] : [];
  league.chat.push({ kind: "system", day: league.currentDay, text: `Playoffs set! Seeds: ${seeds.map((id, i) => `${i + 1}. ${teamById(league, id).name}`).join(", ")}` });
}
function winnerOf(league, week, a, b) {
  const r = matchupResult(league, week, a, b);
  if (r.wins !== r.losses) return r.wins > r.losses ? a : b;
  const sa = league.playoffs.seeds.indexOf(a);
  const sb = league.playoffs.seeds.indexOf(b);
  return sa < sb ? a : b; // higher seed wins ties
}
function advancePlayoffs(league, week) {
  const winners = (league.matchups[week] || []).map(([a, b]) => winnerOf(league, week, a, b));
  const next = week + 1;
  const seeds = league.playoffs.seeds;
  let field = [...league.playoffs.byes, ...winners];
  league.playoffs.byes = [];
  field.sort((x, y) => seeds.indexOf(x) - seeds.indexOf(y));
  if (field.length === 1) return;
  const pairs = [];
  while (field.length >= 2) pairs.push([field.shift(), field.pop()]);
  league.matchups[next] = pairs;
  if (next === totalWeeks()) league.chat.push({ kind: "system", day: league.currentDay, text: `🏆 Championship: ${teamById(league, pairs[0][0]).name} vs ${teamById(league, pairs[0][1]).name}` });
}

// ---------------------------------------------------------------- transactions
export function addDrop(league, teamId, addId, dropId, opts = {}) {
  const team = teamById(league, teamId);
  const day = opts.day ?? league.currentDay;
  const wk = weekOfDay(day);
  if (addId) {
    if (allRostered(league).has(addId)) throw new Error("Player is already rostered");
    if ((team.acq[wk] || 0) >= league.settings.maxAcqPerWeek) throw new Error(`Weekly acquisition limit (${league.settings.maxAcqPerWeek}) reached`);
  }
  if (dropId) removeFromTeam(team, dropId);
  if (addId) {
    if (rosterSpace(league, team) <= 0) throw new Error("Roster is full — choose a player to drop");
    placeOnRoster(league, team, addId);
    team.acq[wk] = (team.acq[wk] || 0) + 1;
  }
  const tx = { type: "add_drop", day, teamId, adds: addId ? [addId] : [], drops: dropId ? [dropId] : [] };
  league.transactions.unshift(tx);
  if (!opts.silent) {
    const parts = [];
    if (addId) parts.push(`added ${BY_ID.get(addId).name}`);
    if (dropId) parts.push(`dropped ${BY_ID.get(dropId).name}`);
    league.chat.push({ kind: "tx", day, text: `${team.name} ${parts.join(", ")}`, teamId, adds: addId ? [addId] : [], drops: dropId ? [dropId] : [] });
  }
  return tx;
}

export function setLineup(league, teamId, fromIdx, toIdx) {
  const team = teamById(league, teamId);
  team.lineup = moveInLineup(league.settings.slots, team.lineup, BY_ID, fromIdx, toIdx);
  if (!team.manualDays.includes(league.currentDay)) team.manualDays.push(league.currentDay);
}

export function moveToTaxi(league, teamId, pid) {
  const team = teamById(league, teamId);
  const p = BY_ID.get(pid);
  if (league.type !== "dynasty") throw new Error("Taxi squads are a dynasty feature");
  if (p.exp > league.settings.taxiMaxExp) throw new Error(`${p.name} isn't taxi-eligible (rookies & 2nd-year players only)`);
  if (team.taxi.length >= league.settings.taxiSlots) throw new Error("Taxi squad is full");
  removeFromTeam(team, pid);
  team.taxi.push(pid);
}
export function promoteFromTaxi(league, teamId, pid) {
  const team = teamById(league, teamId);
  if (rosterSpace(league, team) <= 0) throw new Error("No open roster spot — drop or move someone first");
  team.taxi = team.taxi.filter((x) => x !== pid);
  placeOnRoster(league, team, pid);
}

// ---------------------------------------------------------------- trades
export function pickValue(league, pick, st = standings(league)) {
  // Earlier projected pick = more value, based on the original team's current standing.
  const idx = st.findIndex((r) => r.team.id === pick.originalTeam);
  const n = league.teams.length;
  const slot = n - idx; // worst record -> pick 1
  const yearsOut = pick.season - 2027;
  const base = pick.round === 1 ? 4.2 - (slot - 1) * 0.28 : 0.9 - (slot - 1) * 0.05;
  return Math.round(base * (yearsOut ? 0.85 : 1) * 100) / 100;
}
export const assetValue = (league, a, st) => (a.startsWith("pick:") ? pickValue(league, league.picks.find((p) => p.id === a.slice(5)), st || standings(league)) : valueOf(league, a));

/** Category impact of a trade for one side: z-score sums per category before/after (current-season view). */
export function tradeImpact(league, teamId, giving, getting) {
  const vals = valuesFor(league);
  const team = teamById(league, teamId);
  const before = rosterOf(team);
  const after = before.filter((id) => !giving.includes(id)).concat(getting.filter((x) => !x.startsWith("pick:")));
  const sum = (ids) => {
    const o = {};
    for (const c of league.settings.cats) o[c] = 0;
    for (const id of ids) {
      const v = vals.get(id);
      if (v) for (const c of league.settings.cats) o[c] += v.z[c] || 0;
    }
    return o;
  };
  const b = sum(before);
  const a = sum(after);
  const delta = {};
  for (const c of league.settings.cats) delta[c] = Math.round((a[c] - b[c]) * 100) / 100;
  return { before: b, after: a, delta };
}

export function evaluateTrade(league, fromId, toId, give, get) {
  const st = standings(league);
  const giveV = give.reduce((s, a) => s + Math.max(assetValue(league, a, st), -1), 0);
  const getV = get.reduce((s, a) => s + Math.max(assetValue(league, a, st), -1), 0);
  // the AI is the receiving team: it gets `give`, sends `get`
  const margin = giveV - getV;
  const fair = margin >= -0.35;
  const impact = tradeImpact(league, toId, get, give);
  const catsHelped = Object.values(impact.delta).filter((d) => d > 0.15).length;
  const accept = fair || (margin > -1.2 && catsHelped >= 5);
  let reason;
  if (accept) reason = margin > 1.5 ? "Smashed accept. That's a lot of value." : catsHelped >= 5 ? "Fills our category holes — deal." : "Fair deal. Accepted.";
  else reason = margin < -3 ? "Not even close — we'd lose too much value." : "Close, but we need a little more.";
  return { accept, margin: Math.round(margin * 100) / 100, giveValue: Math.round(giveV * 100) / 100, getValue: Math.round(getV * 100) / 100, reason };
}

export function executeTrade(league, fromId, toId, give, get, opts = {}) {
  const A = teamById(league, fromId);
  const B = teamById(league, toId);
  const move = (assets, src, dst) => {
    for (const a of assets) {
      if (a.startsWith("pick:")) {
        const p = league.picks.find((x) => x.id === a.slice(5));
        p.owner = dst.id;
      } else {
        removeFromTeam(src, a);
      }
    }
  };
  move(give, A, B);
  move(get, B, A);
  const place = (assets, dst) => {
    for (const a of assets) {
      if (a.startsWith("pick:")) continue;
      if (rosterSpace(league, dst) <= 0) {
        // overflow: release lowest-value non-incoming player (production: prompt the manager)
        const victims = rosterOf(dst).filter((id) => !assets.includes(id)).sort((x, y) => valueOf(league, x) - valueOf(league, y));
        const v = victims[0];
        removeFromTeam(dst, v);
        if (!opts.silent) league.chat.push({ kind: "tx", day: league.currentDay, text: `${dst.name} released ${BY_ID.get(v).name} to make room` });
      }
      placeOnRoster(league, dst, a);
    }
  };
  place(get, A);
  place(give, B);
  const label = (assets) => assets.map((a) => (a.startsWith("pick:") ? pickLabel(league, a.slice(5)) : BY_ID.get(a).name)).join(", ");
  league.transactions.unshift({ type: "trade", day: league.currentDay, teams: [fromId, toId], give, get });
  if (!opts.silent) league.chat.push({ kind: "trade", day: league.currentDay, text: `TRADE ✅ ${A.name} receive ${label(get)} · ${B.name} receive ${label(give)}`, teams: [fromId, toId], give, get });
}

export function pickLabel(league, pickId) {
  const p = league.picks.find((x) => x.id === pickId);
  const orig = teamById(league, p.originalTeam);
  const rd = p.round === 1 ? "1st" : p.round === 2 ? "2nd" : p.round + "th";
  return `${p.season} ${rd}${p.owner !== p.originalTeam ? ` (via ${orig.name})` : ""}`;
}

// ---------------------------------------------------------------- drafts
export function draftOrder(teamIds, rounds, type = "snake") {
  const order = [];
  for (let r = 0; r < rounds; r++) {
    const row = type === "snake" && r % 2 ? teamIds.slice().reverse() : teamIds.slice();
    for (const t of row) order.push({ round: r + 1, teamId: t });
  }
  return order.map((o, i) => ({ ...o, pick: i + 1 }));
}

/**
 * kind: 'startup' (full rosters, everyone eligible) | 'rookie' (2026 rookies only, linear)
 */
export function startDraft(league, kind, opts = {}) {
  const ids = opts.order || league.teams.map((t) => t.id);
  const rounds = opts.rounds || (kind === "rookie" ? league.settings.rookieDraftRounds : league.settings.slots.filter((s) => s !== "IR").length);
  league.draft = {
    kind,
    status: "live",
    order: draftOrder(ids, rounds, kind === "rookie" ? "linear" : league.settings.draftType),
    picks: [],
    queue: [],
    sandbox: !!opts.sandbox,
    excludeRookies: !!opts.excludeRookies,
    startedAt: Date.now(),
  };
  return league.draft;
}
export function draftPool(league) {
  const taken = new Set(league.draft.picks.map((p) => p.pid));
  const rostered = league.draft.sandbox ? new Set() : allRostered(league);
  return PLAYERS.filter((p) => !taken.has(p.id) && !(rostered.has(p.id) && !league.draft.sandbox) && (league.draft.kind !== "rookie" || p.exp === 0) && !(league.draft.excludeRookies && p.exp === 0));
}
export function onTheClock(league) {
  const d = league.draft;
  if (!d || d.status !== "live") return null;
  return d.order[d.picks.length] || null;
}
export function makePick(league, pid) {
  const d = league.draft;
  const slot = onTheClock(league);
  if (!slot) throw new Error("Draft is complete");
  if (!draftPool(league).some((p) => p.id === pid)) throw new Error("Player not available");
  d.picks.push({ ...slot, pid });
  d.queue = d.queue.filter((x) => x !== pid);
  if (!d.sandbox) {
    const team = teamById(league, slot.teamId);
    if (d.kind === "rookie" && rosterSpace(league, team) <= 0 && team.taxi.length < league.settings.taxiSlots) team.taxi.push(pid);
    else if (rosterSpace(league, team) > 0) placeOnRoster(league, team, pid);
    else team.taxi.push(pid);
  }
  if (d.picks.length >= d.order.length) d.status = "done";
  return slot;
}
export function botPick(league, rand = Math.random) {
  const slot = onTheClock(league);
  if (!slot) return null;
  const pool = draftPool(league);
  const team = teamById(league, slot.teamId);
  const mine = league.draft.picks.filter((p) => p.teamId === slot.teamId).map((p) => BY_ID.get(p.pid));
  const need = (p) => {
    const cnt = (pos) => mine.filter((m) => m.pos.includes(pos)).length;
    let bonus = 0;
    if (p.pos.includes("C") && cnt("C") === 0 && slot.round > 4) bonus += 0.6;
    if ((p.pos.includes("PG") || p.pos.includes("SG")) && cnt("PG") + cnt("SG") < 2 && slot.round > 5) bonus += 0.4;
    return bonus;
  };
  const scored = pool
    .map((p) => ({ p, s: valueOf(league, p.id) + need(p) + (rand() - 0.5) * (league.draft.kind === "rookie" ? 1.2 : 0.9) }))
    .sort((a, b) => b.s - a.s);
  const choice = scored[0];
  if (!choice) return null;
  makePick(league, choice.p.id);
  return choice.p.id;
}

// ---------------------------------------------------------------- free-agent / trade-target helpers
export function weakestCategories(league, teamId) {
  const vals = valuesFor(league);
  const sums = league.teams.map((t) => {
    const o = {};
    for (const c of league.settings.cats) o[c] = 0;
    for (const id of rosterOf(t)) {
      const v = vals.get(id);
      if (v) for (const c of league.settings.cats) o[c] += v.z[c] || 0;
    }
    return { id: t.id, o };
  });
  const me = sums.find((s) => s.id === teamId);
  return league.settings.cats
    .map((c) => ({ cat: c, rank: 1 + sums.filter((s) => s.o[c] > me.o[c]).length, z: Math.round(me.o[c] * 10) / 10 }))
    .sort((a, b) => b.rank - a.rank);
}

export { canPlaySlot, isStarterSlot, shuffle, rngFor };
