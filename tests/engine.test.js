import test from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "../data/players.js";
import * as E from "../engine/index.js";

E.setPlayerUniverse(PLAYERS);

test("category comparison: counting, turnovers (lower wins), pct rounding ties", () => {
  const a = { ...E.emptyTotals(), pts: 500, to: 60, fgm: 200, fga: 400, ftm: 80, fta: 100 };
  const b = { ...E.emptyTotals(), pts: 480, to: 70, fgm: 2001, fga: 4000, ftm: 79, fta: 100 };
  assert.equal(E.compareCat("pts", a, b), 1);
  assert.equal(E.compareCat("to", a, b), 1, "fewer turnovers wins");
  assert.equal(E.compareCat("fg", a, b), 0, ".500 vs .50025 ties at 3 decimals");
  assert.equal(E.compareCat("ft", a, b), 1);
  const r = E.compareTotals(E.PRESETS["9cat"].cats, a, b);
  assert.equal(r.wins + r.losses + r.ties, 9);
});

test("simulated box scores are internally consistent", () => {
  let checked = 0;
  for (const p of PLAYERS.filter((x) => x.team && x.proj).slice(0, 80)) {
    for (let d = 0; d < 30; d++) {
      const g = E.gameLog(p, d);
      if (!g || g.dnp) continue;
      checked++;
      assert.equal(g.pts, 2 * g.fgm + g.tpm + g.ftm);
      assert.ok(g.fgm <= g.fga && g.ftm <= g.fta && g.tpm <= g.fgm);
    }
  }
  assert.ok(checked > 500);
});

test("schedule: realistic games per team per week, no 3-in-3", () => {
  const { start, end } = E.weekRange(3);
  for (const t of E.NBA_TEAMS) {
    const n = E.teamGamesInRange(t, start, end);
    assert.ok(n >= 2 && n <= 5, `${t} plays ${n}`);
  }
  for (let d = 2; d < 120; d++)
    for (const t of E.NBA_TEAMS)
      assert.ok(!(E.teamsPlayingOn(d).has(t) && E.teamsPlayingOn(d - 1).has(t) && E.teamsPlayingOn(d - 2).has(t)));
});

test("lineup optimizer starts every playable player when slots allow", () => {
  const lg = E.buildRedraftDemo();
  const team = E.userTeam(lg);
  const day = lg.currentDay;
  const playing = E.playingSet(lg, day);
  E.autoSetLineup(lg, team, day);
  const slots = lg.settings.slots;
  const starters = team.lineup.filter((id, i) => id && E.isStarterSlot(slots[i]));
  const benchPlaying = team.lineup.filter((id, i) => id && slots[i] === "BN" && playing.has(id));
  const startersIdle = starters.filter((id) => !playing.has(id));
  // if a playing player sits, it must be because no eligible starter slot was free
  if (benchPlaying.length) assert.equal(startersIdle.length === 0 || benchPlaying.every((id) => {
    const p = E.playerById(id);
    return !team.lineup.some((sid, i) => E.isStarterSlot(slots[i]) && !playing.has(sid) && E.canPlaySlot(p, slots[i]));
  }), true);
  // an ineligible placement is only allowed as overflow when every bench slot is already full
  const benchFull = slots.every((s, i) => s !== "BN" || team.lineup[i]);
  team.lineup.forEach((id, i) => { if (id && !E.canPlaySlot(E.playerById(id), slots[i])) assert.ok(benchFull, "overflow only when bench is full"); });
});

test("standings: category records are zero-sum across the league", () => {
  const lg = E.buildDynastyDemo();
  E.simulateTo(lg, E.weekRange(8).end + 1, { quiet: true });
  const st = E.standings(lg);
  const w = st.reduce((s, r) => s + r.w, 0);
  const l = st.reduce((s, r) => s + r.l, 0);
  assert.equal(w, l);
  assert.equal(st[0].rank, 1);
});

test("trades move players and picks and keep rosters legal", () => {
  const lg = E.buildDynastyDemo();
  const [a, b] = lg.teams;
  const give = [E.rosterOf(a)[0]];
  const pick = lg.picks.find((p) => p.owner === b.id);
  const get = [E.rosterOf(b)[0], "pick:" + pick.id];
  E.executeTrade(lg, a.id, b.id, give, get);
  assert.ok(E.rosterOf(b).includes(give[0]));
  assert.ok(E.rosterOf(a).includes(get[0]));
  assert.equal(lg.picks.find((p) => p.id === pick.id).owner, a.id);
  for (const t of lg.teams) assert.ok(E.rosterOf(t).length <= lg.settings.slots.length - 1 + 0);
  const all = lg.teams.flatMap((t) => [...E.rosterOf(t), ...t.taxi]);
  assert.equal(new Set(all).size, all.length, "no player on two teams");
});

test("snake draft order and full draft completes", () => {
  const order = E.draftOrder(["a", "b", "c"], 3, "snake").map((o) => o.teamId).join("");
  assert.equal(order, "abccbaabc");
  const lg = E.createLeague({ id: "t", name: "t", type: "redraft", teams: Array.from({ length: 8 }, (_, i) => ({ name: "T" + i, owner: "o" + i, isUser: i === 0 })) });
  E.startDraft(lg, "startup");
  while (lg.draft.status === "live") E.botPick(lg);
  assert.equal(lg.draft.picks.length, 8 * 13);
  for (const t of lg.teams) assert.equal(E.rosterOf(t).length, 13);
});

test("full season incl. playoffs produces a champion", () => {
  const lg = E.buildRedraftDemo();
  E.simulateTo(lg, E.lastDay() + 1, { quiet: true });
  assert.ok(lg.champion, "champion crowned");
});
