# Integration notes

How the prototype's engine would plug into a production fantasy platform. Module names refer to `engine/`.

## 1. Replace the two simulated inputs

| Prototype | Production replacement | Contract the engine expects |
|---|---|---|
| `calendar.js` → `buildSchedule()` / `teamsPlayingOn(day)` | NBA schedule feed | `teamsPlayingOn(day) → Map<teamAbbr, { opp, home }>` |
| `sim.js` → `gameLog(player, day)` | Live/final box scores from the stat feed | `{ gp, min, fgm, fga, tpm, ftm, fta, pts, reb, ast, stl, blk, to, dd }` per player per day, or `null` (no game) / `{ dnp: true }` |

Everything downstream (matchups, standings, projections, rankings) only consumes those shapes.

## 2. Player identity

`data/players.js` keys players by a name slug and carries a `sleeper_id: null` field. Join to the platform's NBA player table (e.g. the public `GET /v1/players/nba` map) by name + team and fill `sleeper_id`; the engine never relies on the slug format.

## 3. League settings schema

`defaultSettings(type, teams)` in `league.js` is the full settings object:

```js
{
  teams: 10,
  cats: ["fg","ft","tpm","pts","reb","ast","stl","blk","to"], // any subset of CATEGORY_LIBRARY
  scoring: "h2h_each" | "h2h_most" | "roto",
  slots: ["PG","SG","SF","PF","C","G","F","UTIL","UTIL","UTIL","BN","BN","BN","IR"],
  taxiSlots: 3, taxiMaxExp: 1,              // dynasty
  playoffTeams: 6, regularSeasonWeeks: 20,
  lineupLock: "daily", maxAcqPerWeek: 4, tradeDeadlineWeek: 16,
  draftType: "snake" | "linear", rookieDraftRounds: 2, futurePickYears: 2,
}
```

Redraft/keeper/dynasty already exist as league types on Sleeper; categories add `cats` + `scoring` and change how a matchup is decided.

## 4. Where category scoring differs from points

- A matchup result is a **vector** (wins/losses/ties per category), not a single number: `compareTotals(cats, a, b) → { rows, wins, losses, ties }`.
- H2H Each Category standings add every category result to W-L-T (a 6-3 week = 6 W, 3 L). H2H Most = one W/L/T per week. Roto ranks season totals per category.
- Percentages must be aggregated from makes/attempts (never averaged) and compared at 3 decimals.
- Turnovers are lower-is-better.
- Daily lineups matter more than in points leagues (games-played volume is a strategy), so the lineup optimizer and "games remaining" are first-class.

## 5. State

League state is a plain JSON object (see `createLeague`). `started[day][teamId]` (the locked starters per day) plus box scores is enough to recompute any matchup or standings table, which keeps the scoring auditable and easy to backfill after stat corrections.

## 6. Tests

`npm test` runs the engine suite with Node's built-in runner — no framework to adopt.
