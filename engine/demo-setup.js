// Builds the two pre-loaded demo leagues (10-team dynasty, 12-team redraft) at "today" = Sat Oct 31, 2026.
import {
  createLeague, startDraft, botPick, simulateTo, valueOf, rosterOf, teamById, userTeam,
  executeTrade, evaluateTrade, weakestCategories, valuesFor, allPlayers, autoSetLineup,
} from "./league.js";
import { rngFor, shuffle } from "./rng.js";
import { dateToDay } from "./calendar.js";

export const DEMO_TODAY = dateToDay(new Date(Date.UTC(2026, 9, 31))); // Oct 31, 2026

export const DYNASTY_TEAMS = [
  { owner: "Cory", name: "Team Cory", isUser: true },
  { owner: "Joe", name: "All the King's Horses" },
  { owner: "Jesse", name: "Ant-Man, Batman, Superman" },
  { owner: "Tommy", name: "Metta World War" },
  { owner: "Brian", name: "Brian's Bricklayers" },
  { owner: "Justin", name: "Justin Time" },
  { owner: "Mike", name: "Trust the Process" },
  { owner: "Dre", name: "Wemby Wonderland" },
  { owner: "Sam", name: "Punt FT Gang" },
  { owner: "Nate", name: "Waiver Wire Warriors" },
];

export const REDRAFT_TEAMS = [
  { owner: "Cory", name: "Team Cory", isUser: true },
  { owner: "dimedropper", name: "Dime Droppers" },
  { owner: "glassclean", name: "Glass Cleaners" },
  { owner: "swatteam", name: "Swat Team" },
  { owner: "splashbros4ever", name: "Splash Zone" },
  { owner: "pickpocket", name: "Pickpockets" },
  { owner: "ftmerchant", name: "FT Merchants" },
  { owner: "tankcommander", name: "Tank Commanders" },
  { owner: "rimrunner", name: "Rim Runners" },
  { owner: "boardman", name: "Board Men Get Paid" },
  { owner: "nopuntintended", name: "No Punt Intended" },
  { owner: "lategamelou", name: "Late Game Lou" },
];

function runDraft(league, kind, opts, rand) {
  startDraft(league, kind, opts);
  while (league.draft.status === "live") botPick(league, rand);
  const d = league.draft;
  league.draftHistory = league.draftHistory || [];
  league.draftHistory.push({ kind, season: opts.season || "2026", order: d.order, picks: d.picks });
  league.draft = null;
}

export function buildDynastyDemo() {
  const league = createLeague({ id: "dyn-demo", name: "The Dynasty League", type: "dynasty", teams: DYNASTY_TEAMS, seed: "dyn-demo-v1" });
  const rand = rngFor(league.seed, "setup");
  league._quietChat = true;
  // 1) rosters as they'd exist after prior seasons: a 12-round veteran "startup" by dynasty value
  runDraft(league, "startup", { rounds: 12, excludeRookies: true, season: "Startup" }, rand);
  // 2) the 2026 rookie draft (2 rounds, linear, randomized lottery order)
  const order = shuffle(rand, league.teams.map((t) => t.id));
  runDraft(league, "rookie", { order, season: "2026" }, rand);
  // 3) a few future-pick trades so the pick grid has history
  pickTrade(league, rand);
  pickTrade(league, rand);
  for (const t of league.teams) autoSetLineup(league, t, 0);
  simulateTo(league, DEMO_TODAY, { quiet: true });
  league._quietChat = false;
  league.status = "inseason";
  seedChat(league, true);
  seedOffer(league, rand);
  return league;
}

export function buildRedraftDemo() {
  const league = createLeague({ id: "red-demo", name: "Redraft 9-Cat (12-team)", type: "redraft", teams: REDRAFT_TEAMS, seed: "red-demo-v1" });
  const rand = rngFor(league.seed, "setup");
  league._quietChat = true;
  runDraft(league, "startup", { season: "2026-27" }, rand);
  for (const t of league.teams) autoSetLineup(league, t, 0);
  simulateTo(league, DEMO_TODAY, { quiet: true });
  league._quietChat = false;
  league.status = "inseason";
  seedChat(league, false);
  seedOffer(league, rand);
  return league;
}

function pickTrade(league, rand) {
  const ts = shuffle(rand, league.teams.filter((t) => !t.isUser));
  const [a, b] = ts;
  const pick = league.picks.find((p) => p.owner === a.id && p.round === 1 && p.season === 2027);
  const theirs = rosterOf(b).sort((x, y) => valueOf(league, y) - valueOf(league, x));
  const target = theirs.find((id) => Math.abs(valueOf(league, id) - 3.2) < 1.5) || theirs[5];
  if (!pick || !target) return;
  executeTrade(league, a.id, b.id, ["pick:" + pick.id], [target], { silent: true });
  league.transactions[0].day = 0;
}

function seedChat(league, dynasty) {
  const t = (i) => league.teams[i];
  const msgs = dynasty
    ? [
        { kind: "system", text: "🏀 Welcome to H2H 9-Cat on Sleeper (concept). League imported with full rosters, taxi squads and future picks." },
        { kind: "msg", from: t(1).id, text: "Finally off ESPN. This chat alone is worth it." },
        { kind: "msg", from: t(3).id, text: "Who's selling a center? I'm bleeding boards and blocks." },
        { kind: "msg", from: t(2).id, text: "Punting FT% again this year, don't @ me" },
        { kind: "msg", from: t(5).id, text: "Rookie draft grades are in the pod this week 🎙️" },
      ]
    : [
        { kind: "system", text: "🏀 Welcome to H2H 9-Cat Redraft (concept). Draft complete — good luck!" },
        { kind: "msg", from: t(4).id, text: "That draft went way too fast. Gonna live on the waiver wire." },
        { kind: "msg", from: t(7).id, text: "Anyone want a guard for steals? Open to offers." },
      ];
  league.chat = msgs.map((m, i) => ({ ...m, day: league.currentDay - 3 + Math.floor(i / 2) })).concat(league.chat);
}

function seedOffer(league, rand) {
  const me = userTeam(league);
  const others = league.teams.filter((t) => !t.isUser);
  const from = others[1];
  const myRoster = rosterOf(me).sort((a, b) => valueOf(league, b) - valueOf(league, a));
  const weak = weakestCategories(league, from.id).slice(0, 3).map((x) => x.cat);
  const vals = valuesFor(league);
  const want = myRoster.slice(2, 8).sort((a, b) => weak.reduce((s, c) => s + (vals.get(b).z[c] || 0), 0) - weak.reduce((s, c) => s + (vals.get(a).z[c] || 0), 0))[0];
  const wv = valueOf(league, want);
  const theirs = rosterOf(from).filter((id) => Math.abs(valueOf(league, id) - wv) < 1.2).sort((a, b) => valueOf(league, b) - valueOf(league, a));
  const give = theirs[0] ? [theirs[0]] : [];
  if (!give.length || !want) return;
  if (league.type === "dynasty") {
    const p2 = league.picks.find((p) => p.owner === from.id && p.round === 2 && p.season === 2027);
    if (p2 && valueOf(league, give[0]) < wv) give.push("pick:" + p2.id);
  }
  league.tradeOffers.push({ id: "offer-1", from: from.id, to: me.id, give, get: [want], status: "pending", day: league.currentDay - 1,
    note: `Need help in ${weak.map((c) => c.toUpperCase()).join(", ")}. Thoughts?` });
}

export { evaluateTrade, teamById, allPlayers };
