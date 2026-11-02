// Box-score simulator. Produces internally consistent lines (PTS = 2*FGM + 3PM + FTM, makes <= attempts)
// from a player's real per-game averages. In production, this module is simply not used — real box
// scores from Sleeper's stat feed flow into the same {fgm, fga, tpm, ...} shape.
import { rngFor, normal, poisson, binomial } from "./rng.js";
import { teamsPlayingOn } from "./calendar.js";

const DNP_RATE = 0.06;

const memo = new Map();
export function gameLog(player, day, seed = "nba-2026-27") {
  if (!player || !player.team || !player.proj) return null;
  const k = player.id + "|" + player.team + "|" + day + "|" + seed;
  if (memo.has(k)) return memo.get(k);
  const out = simulateGame(player, day, seed);
  memo.set(k, out);
  return out;
}

function simulateGame(player, day, seed) {
  const game = teamsPlayingOn(day, seed).get(player.team);
  if (!game) return null;
  const rand = rngFor(seed, "box", player.id, day);
  const opp = (game.home ? "vs " : "@ ") + game.opp;
  if (rand() < DNP_RATE) return { dnp: true, opp, gp: 0 };
  const p = player.proj;
  const m = Math.min(1.5, Math.max(0.45, normal(rand, 1, 0.17)));
  const fga = Math.max(0, Math.round(normal(rand, p.fga * m, Math.sqrt(Math.max(p.fga, 0.5)) * 0.9)));
  const fgPct = p.fga > 0 ? p.fgm / p.fga : 0.45;
  const tpaRate = p.fga > 0 ? Math.min(0.85, p.tpm / 0.36 / p.fga) : 0;
  const tpa = Math.min(fga, binomial(rand, fga, tpaRate));
  const twa = fga - tpa;
  const tpPct = 0.36;
  // solve 2PT% so expected FGM matches the player's real FG%
  const twPct = twa > 0 ? Math.min(0.85, Math.max(0.2, (fgPct * fga - tpPct * tpa) / Math.max(twa, 1))) : 0;
  const tpm = binomial(rand, tpa, tpPct);
  const twm = binomial(rand, twa, twPct);
  const fgm = tpm + twm;
  const fta = poisson(rand, p.fta * m);
  const ftPct = p.fta > 0 ? p.ftm / p.fta : 0.75;
  const ftm = binomial(rand, fta, ftPct);
  const line = {
    opp,
    gp: 1,
    min: Math.round((p.min || 28) * m),
    fgm, fga, tpm, ftm, fta,
    pts: 2 * fgm + tpm + ftm,
    reb: poisson(rand, p.reb * m),
    ast: poisson(rand, p.ast * m),
    stl: poisson(rand, p.stl * m),
    blk: poisson(rand, p.blk * m),
    to: poisson(rand, p.to * m),
  };
  const tens = ["pts", "reb", "ast", "stl", "blk"].filter((k) => line[k] >= 10).length;
  line.dd = tens >= 2 ? 1 : 0;
  return line;
}

/** Expected per-game line used for projections (dd approximated from averages). */
export function expectedLine(player) {
  const p = player && player.proj;
  if (!p) return null;
  const tens = ["pts", "reb", "ast"].filter((k) => p[k] >= 9).length;
  return { ...p, gp: 1, dd: tens >= 2 ? 0.55 : tens === 1 && (p.reb >= 7 || p.ast >= 6) ? 0.2 : 0.03 };
}
