// Season calendar + NBA game schedule.
// In production this module is replaced by Sleeper's real NBA schedule feed; the rest of the engine
// only calls teamsPlayingOn(day) and the week helpers, so swapping it is a one-file change.
import { rngFor, shuffle } from "./rng.js";

export const NBA_TEAMS = ["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW", "HOU", "IND", "LAC", "LAL", "MEM",
  "MIA", "MIL", "MIN", "NOP", "NYK", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"];

export const SEASON = {
  startISO: "2026-10-20", // Tuesday — 2026-27 opening night
  regularSeasonWeeks: 20,
  playoffWeeks: 3,
};

const DAY_MS = 86400000;
const startDate = () => new Date(SEASON.startISO + "T12:00:00Z");

export function dayToDate(day) {
  return new Date(startDate().getTime() + day * DAY_MS);
}
export function dateToDay(date) {
  return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12) - startDate().getTime()) / DAY_MS);
}
export function fmtDay(day, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return dayToDate(day).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

// Week 1 runs opening night (Tue) through Sunday; every later week is Mon-Sun.
export function weekRange(week) {
  if (week === 1) return { start: 0, end: 5 };
  const start = 6 + (week - 2) * 7;
  return { start, end: start + 6 };
}
export function weekOfDay(day) {
  if (day <= 5) return 1;
  return 2 + Math.floor((day - 6) / 7);
}
export function totalWeeks() {
  return SEASON.regularSeasonWeeks + SEASON.playoffWeeks;
}
export function lastDay() {
  return weekRange(totalWeeks()).end;
}

// Games-per-day pattern by weekday (Sun..Sat) roughly matching a real NBA week (~3.7 games/team/week).
const GAMES_BY_WEEKDAY = [7, 6, 9, 11, 6, 10, 8];

let _cache = null;
let _cacheSeed = null;
/** Deterministic schedule: array indexed by day of [[home, away], ...]. No team plays 3 days in a row. */
export function buildSchedule(seed = "nba-2026-27") {
  if (_cache && _cacheSeed === seed) return _cache;
  const days = [];
  const last = lastDay();
  for (let d = 0; d <= last; d++) {
    const rand = rngFor(seed, "day", d);
    const weekday = dayToDate(d).getUTCDay();
    let n = GAMES_BY_WEEKDAY[weekday] + Math.floor(rand() * 3) - 1;
    if (d === 0) n = 2; // opening night double-header
    const tired = new Set();
    if (d >= 2) {
      const p1 = new Set(days[d - 1].flat());
      for (const t of days[d - 2].flat()) if (p1.has(t)) tired.add(t);
    }
    // prefer teams that have played the fewest games so far this week
    const pool = shuffle(rand, NBA_TEAMS.filter((t) => !tired.has(t)));
    const wk = weekOfDay(d);
    const { start } = weekRange(wk);
    const count = (t) => days.slice(start, d).reduce((s, g) => s + (g.flat().includes(t) ? 1 : 0), 0);
    pool.sort((a, b) => count(a) - count(b));
    const playing = pool.slice(0, Math.min(n * 2, pool.length - (pool.length % 2)));
    const games = [];
    const sh = shuffle(rand, playing);
    for (let i = 0; i + 1 < sh.length; i += 2) games.push([sh[i], sh[i + 1]]);
    days.push(games);
  }
  _cache = days;
  _cacheSeed = seed;
  return days;
}

export function gamesOn(day, seed) {
  const s = buildSchedule(seed);
  return s[day] || [];
}
const _dayCache = new Map();
export function teamsPlayingOn(day, seed = "nba-2026-27") {
  const key = seed + "#" + day;
  if (_dayCache.has(key)) return _dayCache.get(key);
  const m = new Map();
  _dayCache.set(key, m);
  for (const [h, a] of gamesOn(day, seed)) {
    m.set(h, { opp: a, home: true });
    m.set(a, { opp: h, home: false });
  }
  return m;
}
export function teamGamesInRange(team, start, end, seed) {
  let n = 0;
  for (let d = start; d <= end; d++) if (teamsPlayingOn(d, seed).has(team)) n++;
  return n;
}
