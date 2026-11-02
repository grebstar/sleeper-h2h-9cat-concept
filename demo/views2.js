
// ------------------------------------------------------------------ TEAM
function statCellsFor(league, p) {
  const pj = p && p.proj;
  return league.settings.cats.map((c) => {
    if (!pj) return `<td class="hide-sm dim">—</td>`;
    const def = CL[c];
    const v = def.type === "pct" ? pct(pj[def.num], pj[def.den]) : def.type === "ratio" ? (pj.to ? (pj.ast / pj.to).toFixed(2) : "—") : c === "dd" ? "—" : f1(pj[def.stat]);
    return `<td class="hide-sm">${v}</td>`;
  }).join("");
}

function viewTeam(league) {
  const team = S.ui.teamView ? E.teamById(league, S.ui.teamView) : ME();
  const mine = team.isUser;
  const slots = league.settings.slots;
  const day = league.currentDay;
  const vals = E.valuesFor(league);
  const cats = league.settings.cats;
  const moveFrom = S.ui.moveFrom;
  const fromP = moveFrom != null ? P(team.lineup[moveFrom]) : null;
  const row = (i) => {
    const slot = slots[i];
    const id = team.lineup[i];
    const p = id ? P(id) : null;
    const ok = fromP && i !== moveFrom && (slot === "BN" || E.canPlaySlot(fromP, slot)) && (!p || slots[moveFrom] === "BN" || E.canPlaySlot(p, slots[moveFrom]));
    const opp = p ? oppOn(p, day) : null;
    const inelig = p && E.isStarterSlot(slot) && !E.canPlaySlot(p, slot);
    let badgeAct = "";
    if (mine) {
      if (moveFrom == null && p) badgeAct = `data-act="move-from" data-v="${i}" role="button" tabindex="0" title="Move ${esc(p.name)}"`;
      else if (moveFrom === i) badgeAct = `data-act="move-cancel" role="button" tabindex="0" title="Cancel move"`;
      else if (ok) badgeAct = `data-act="move-to" data-v="${i}" role="button" tabindex="0" title="Move here"`;
    }
    const badgeStyle = moveFrom === i ? "box-shadow:0 0 0 2px #fff" : ok ? "box-shadow:0 0 0 2px var(--teal);cursor:pointer" : badgeAct ? "cursor:pointer" : "";
    const dimmed = moveFrom != null && !ok && i !== moveFrom;
    return `<tr style="${dimmed ? "opacity:.4" : ""}">
      <td class="l" style="width:52px">${posBadge(slot, "", `${badgeAct} style="${badgeStyle}"`)}</td>
      <td class="l" style="min-width:190px">${p ? `<div class="prow-t">${pav(p)}<div class="who"><span class="pname" data-act="player" data-v="${id}">${esc(shortName(p))}</span><span>${pposLine(p)}${league.type === "dynasty" ? `<span class="ppos"> · ${p.age ?? "—"} yrs</span>` : ""}</span>
        <span class="today ${opp ? "" : "no"}">${inelig ? `<span class="inelig">Not eligible at ${slot} · counts as bench</span>` : opp ? `Today ${esc(opp)}` : "No game today"}</span></div></div>` : `<span class="dim">${slot === "IR" ? "Empty · OUT/IR players only" : "Empty"}</span>`}</td>
      ${p ? statCellsFor(league, p) : cats.map(() => `<td class="hide-sm"></td>`).join("")}
      <td class="hl" style="font-weight:700">${p && vals.get(id) ? vals.get(id).total.toFixed(1) : ""}</td></tr>`;
  };
  const head = `<thead><tr><th class="l"></th><th class="l"></th>${cats.map((c) => `<th class="hide-sm">${CL[c].label}</th>`).join("")}<th class="hl">VALUE</th></tr></thead>`;
  const idx = (pred) => slots.map((s, i) => (pred(s) ? i : -1)).filter((i) => i >= 0);
  const starters = idx(E.isStarterSlot), bench = idx((s) => s === "BN"), ir = idx((s) => s === "IR");
  const weak = E.weakestCategories(league, team.id);
  const n = league.teams.length;
  const strength = weak.slice().sort((a, b) => a.rank - b.rank).map((w) => {
    const pctw = Math.round(((n - w.rank) / (n - 1)) * 100);
    const color = w.rank <= 3 ? "var(--teal)" : w.rank >= n - 2 ? "var(--pink)" : "var(--blue)";
    return `<div class="zrow"><span class="lab">${CL[w.cat].label}</span><div class="ztrack"><div class="fill" style="left:0;width:${Math.max(4, pctw)}%;background:${color}"></div></div><span style="text-align:right;font-weight:700">${ordinal(w.rank)}</span></div>`;
  }).join("");
  const puntIdea = weak.filter((w) => w.rank >= n - 1).map((w) => CL[w.cat].label);
  const myPicks = league.type === "dynasty" ? league.picks.filter((p) => p.owner === team.id) : [];
  return `
  <div class="row nowrap">${av(team, "lg")}<div style="min-width:0"><div class="h-label" style="font-weight:600">${esc(team.name)}</div><div class="ppos" style="font-size:11px">${esc(sideName(team))} · ${recordOf(league, team.id)}</div></div>
    <span class="spacer"></span>
    ${!mine ? `<button class="btn ghost" data-act="viewteam" data-v="">MY TEAM</button><button class="btn teal" data-act="trade-with" data-v="${team.id}">PROPOSE TRADE</button>` : `
    <label class="check hide-sm"><input type="checkbox" id="autostart" data-act="autostart" ${team.autoStart ? "checked" : ""}> Auto-start</label>
    <button class="btn" data-act="optimize">OPTIMIZE TODAY</button>`}
  </div>
  <div class="box">
    <div class="box-pad" style="padding-bottom:0"><div class="h-label" style="font-size:14px">STARTERS · ${esc(E.fmtDay(Math.min(day, E.lastDay())).toUpperCase())}</div><div class="note">${mine ? (moveFrom != null ? "Tap a highlighted position to move the player there." : "Click on position buttons to update your lineup. Daily lock: each player locks at tip-off.") : "Projected per-game stats."}</div></div>
    <div class="scroll-x" style="padding:6px 8px 8px"><table class="tbl">${head}<tbody>${starters.map(row).join("")}</tbody></table></div>
    <div class="box-pad" style="padding:6px 16px 0"><div class="h-label" style="font-size:14px">BENCH</div></div>
    <div class="scroll-x" style="padding:0 8px 8px"><table class="tbl"><tbody>${bench.map(row).join("")}${ir.map(row).join("")}</tbody></table></div>
  </div>
  ${league.type === "dynasty" ? taxiBox(league, team, mine) : ""}
  <div class="grid2">
    <div class="box box-pad stack" style="gap:10px"><div class="sec-h"><h2>Category build</h2><span class="note">rank of ${n}</span></div>${strength}
      ${puntIdea.length ? `<div class="callout"><b>Punt idea</b> &nbsp;You're near the bottom in ${puntIdea.join(" & ")}. Punt ${puntIdea.length > 1 ? "them" : "it"} in Players to re-rank targets around your build.</div>` : ""}</div>
    ${league.type === "dynasty"
      ? `<div class="box box-pad stack" style="gap:10px"><div class="sec-h"><h2>Draft picks</h2></div><div class="row">${myPicks.length ? myPicks.map((p) => `<span class="pickchip">${esc(E.pickLabel(league, p.id))}</span>`).join("") : `<span class="muted">No future picks owned.</span>`}</div></div>`
      : `<div class="box box-pad stack" style="gap:10px"><div class="sec-h"><h2>Recent moves</h2></div>${league.transactions.filter((t) => t.teamId === team.id || (t.teams && t.teams.includes(team.id))).slice(0, 6).map((t) => txLine(league, t)).join("") || `<span class="muted">No moves yet.</span>`}</div>`}
  </div>`;
}

function taxiBox(league, team, mine) {
  const elig = E.rosterOf(team).filter((id) => P(id).exp <= league.settings.taxiMaxExp);
  return `<div class="box box-pad stack" style="gap:10px">
    <div class="sec-h"><h2>Taxi squad</h2><span class="note">${team.taxi.length}/${league.settings.taxiSlots} · rookies & 2nd-year players · don't score</span></div>
    ${team.taxi.map((id) => { const p = P(id); return `<div class="row nowrap">${posBadge("TX")}${pav(p)}<div class="who" style="display:flex;flex-direction:column;min-width:0"><span class="pname" data-act="player" data-v="${id}">${esc(shortName(p))}</span>${pposLine(p)}</div><span class="note hide-sm">${esc(p.note || "")}</span><span class="spacer"></span>${mine ? `<button class="btn sm" data-act="promote" data-v="${id}">PROMOTE</button>` : ""}</div>`; }).join("") || `<span class="muted" style="font-size:12px">Empty.</span>`}
    ${mine && elig.length && team.taxi.length < league.settings.taxiSlots ? `<div class="row"><span class="note">Stash:</span>${elig.map((id) => `<button class="pill" data-act="to-taxi" data-v="${id}">${esc(shortName(P(id)))} → taxi</button>`).join("")}</div>` : ""}
  </div>`;
}

// ------------------------------------------------------------------ PLAYERS
function viewPlayers(league) {
  const f = S.ui.pf;
  const punt = new Set(f.punt);
  const vals = E.valuesFor(league, punt.size ? punt : null, f.basis);
  const rostered = E.allRostered(league);
  let list = PLAYERS.filter((p) => {
    if (f.status === "FA" && rostered.has(p.id)) return false;
    if (f.status === "ROOK" && p.exp > 0) return false;
    if (f.pos === "G" && !p.pos.some((x) => x === "PG" || x === "SG")) return false;
    if (f.pos === "F" && !p.pos.some((x) => x === "SF" || x === "PF")) return false;
    if (!["ALL", "G", "F", "UTIL"].includes(f.pos) && !p.pos.includes(f.pos)) return false;
    if (f.q && !p.name.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
  const lineOf = (p) => (f.basis === "proj" ? p.proj : p[f.basis]);
  const sortKey = (p) => {
    const l = lineOf(p);
    if (f.sort === "value") return vals.get(p.id) ? vals.get(p.id).total : -99;
    if (!l) return -1e9;
    const c = CL[f.sort];
    if (c) return c.type === "pct" ? (l[c.den] ? l[c.num] / l[c.den] : 0) : c.stat === "to" ? -l.to : l[c.stat] ?? 0;
    return l[f.sort] ?? 0;
  };
  list.sort((a, b) => (sortKey(b) - sortKey(a)) * (f.dir === -1 ? 1 : -1));
  const total = list.length;
  list = list.slice(0, f.limit);
  const cats = league.settings.cats.filter((c) => c !== "dd" && c !== "ato");
  const th = (key, label, cls = "") => `<th class="sort ${cls} ${f.sort === key ? "on" : ""}" data-act="psort" data-v="${key}">${label}${f.sort === key ? (f.dir === -1 ? " ↓" : " ↑") : ""}</th>`;
  const heat = (z) => {
    if (z == null) return "";
    const a = Math.min(0.5, Math.abs(z) * 0.2);
    return z > 0 ? `background:rgba(0,206,184,${a})` : `background:rgba(255,42,109,${a})`;
  };
  const rows = list.map((p, i) => {
    const l = lineOf(p);
    const v = vals.get(p.id);
    const z = v ? v.z : {};
    const cells = cats.map((c) => {
      const def = CL[c];
      if (!l) return `<td class="dim">—</td>`;
      const val = def.type === "pct" ? pct(l[def.num], l[def.den]) : f1(l[def.stat]);
      return `<td class="${punt.has(c) ? "punted" : ""}"><span class="zc" style="${punt.has(c) ? "" : heat(z[c])}">${val}</span></td>`;
    }).join("");
    const owner = E.ownerOf(league, p.id);
    const action = !owner && league.status === "inseason" ? `<button class="addbtn" data-act="add" data-v="${p.id}" aria-label="Add ${esc(p.name)}" title="Add">+</button>` : owner && !owner.isUser ? `<button class="addbtn" data-act="trade-for" data-v="${p.id}" aria-label="Trade for ${esc(p.name)}" title="Trade for" style="font-size:13px">⇄</button>` : `<span style="display:inline-block;width:26px"></span>`;
    return `<tr class="${i % 2 ? "alt" : ""}"><td class="l" style="width:34px">${action}</td>
      <td class="l" style="min-width:180px"><div class="prow-t">${pav(p)}<div class="who"><span class="pname" data-act="player" data-v="${p.id}">${esc(shortName(p))}</span>${pposLine(p)}<span class="ppos">${p.age ?? "—"} yrs · ${ownerLabel(league, p.id)}</span></div></div></td>
      <td class="dim">${v && v.rank < 9999 ? v.rank : "—"}</td>
      <td class="hide-sm hide-md">${l && l.g != null ? l.g : f.basis === "proj" && p.s2627 ? p.s2627.g : "—"}</td>
      <td class="hide-sm hide-md">${l ? f1(l.min) : "—"}</td>
      ${cells}
      <td class="hl" style="font-weight:700">${v && v.total > -90 ? v.total.toFixed(1) : "—"}</td></tr>`;
  }).join("");
  const basisLabel = { proj: "Projection", s2627: "2026-27", s2526: "2025-26" };
  return `
  <div class="stack filters-wrap" style="gap:12px">
    <div class="row">
      <div class="pills">${["ALL", "PG", "SG", "SF", "PF", "C", "G", "F"].map((k) => `<button class="pill ${f.pos === k ? "on" : ""}" data-act="ppos" data-v="${k}">${k}</button>`).join("")}</div>
      <input class="search" id="pq" type="search" placeholder="Find player" value="${esc(f.q)}" data-act="pq" aria-label="Search players">
    </div>
    <div class="row">
      <div class="pills">${Object.entries(basisLabel).map(([k, l]) => `<button class="pill ${f.basis === k ? "on" : ""}" data-act="pbasis" data-v="${k}">${l}</button>`).join("")}</div>
      ${[["FA", "Free agents"], ["ALL", "All players"], ["ROOK", "Rookies"]].map(([k, l]) => `<label class="check"><input type="radio" name="pstatus" data-act="pstatus" data-v="${k}" ${f.status === k ? "checked" : ""}> ${l}</label>`).join("")}
    </div>
    <div class="row"><span class="cap" style="color:var(--fg)">Punt builder</span>
      <div class="pills">${league.settings.cats.map((c) => `<button class="pill punt ${punt.has(c) ? "on" : ""}" data-act="punt" data-v="${c}">${CL[c].label}</button>`).join("")}</div>
      ${punt.size ? `<button class="btn sm ghost" data-act="punt-clear">CLEAR</button>` : `<span class="note">Tap categories to punt — value re-ranks without them.</span>`}
    </div>
  </div>
  <div class="box" style="padding:4px 8px 8px"><div class="scroll-x"><table class="tbl">
    <thead><tr><th class="l"></th><th class="l">PLAYER</th>${th("value", "RK")}<th class="hide-sm hide-md">GP</th>${th("min", "MIN", "hide-sm hide-md")}${cats.map((c) => th(c, CL[c].label)).join("")}${th("value", "VALUE", "hl")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="20"><div class="empty">No players match.</div></td></tr>`}</tbody></table></div>
    ${total > f.limit ? `<div style="padding:12px;text-align:center"><button class="btn" data-act="pmore">SHOW MORE (${total - f.limit})</button></div>` : ""}
  </div>
  <p class="note">Per-game stats: ${esc(PLAYER_META.source)} (fetched ${esc(PLAYER_META.fetched)}). Projection blends 2025-26 with 2026-27 to date. Value = sum of category z-scores (FG%/FT% volume-weighted); cell shading shows each category's z-score.</p>`;
}

// ------------------------------------------------------------------ LEAGUE
function viewLeague(league) {
  const sub = S.ui.leagueSub;
  const subs = [["standings", "Standings"], ["schedule", "Schedule"], ["transactions", "Transactions"], ["settings", "Settings"]];
  let body = "";
  if (sub === "standings") body = standingsView(league);
  else if (sub === "schedule") body = scheduleView(league);
  else if (sub === "transactions") body = `<div class="box box-pad stack" style="gap:14px">${league.transactions.slice(0, 60).map((t) => txLine(league, t)).join("") || `<span class="muted">No transactions yet.</span>`}</div>`;
  else body = settingsView(league);
  return `<div class="pills">${subs.map(([k, l]) => `<button class="pill ${sub === k ? "on" : ""}" data-act="lsub" data-v="${k}">${l}</button>`).join("")}</div>${body}`;
}

function standingsView(league) {
  if (league.status !== "inseason") return `<div class="empty">Standings appear after the draft.</div>`;
  const cur = E.currentWeek(league);
  const st = E.standings(league);
  const roto = league.settings.scoring === "roto";
  const po = league.settings.playoffTeams;
  const pairs = !roto && cur <= league.settings.regularSeasonWeeks ? (league.matchups[cur] || []) : [];
  return `${pairs.length ? `<div class="sec-h"><h2>Matchups</h2><span class="spacer"></span><div class="wk">Wk. ${cur}</div></div><div class="stack" style="gap:10px">${pairs.map(([a, b]) => miniMatch(league, cur, a, b)).join("")}</div>` : ""}
  <div class="sec-h"><h2>Standings</h2><span class="note">${roto ? "Roto points" : esc(E.SCORING_TYPES[league.settings.scoring].label)} · top ${po} make playoffs</span></div>
  <div class="box">${st.map((r, i) => `<div class="stand ${i === po - 1 ? "cut" : ""}"><span class="rk">${r.rank}</span>
    <div class="row nowrap" style="min-width:0">${av(r.team)}<div style="min-width:0"><div class="pname" data-act="viewteam" data-v="${r.team.isUser ? "" : r.team.id}" style="font-family:var(--font-head);font-weight:700">${esc(r.team.name)}${league.champion === r.team.id ? " 🏆" : ""}</div><div class="ppos">${esc(sideName(r.team))}${r.team.isUser ? " · you" : ""}</div></div></div>
    <span class="form hide-sm">${(r.results || []).slice(-6).map((x) => `<i style="background:${x === "W" ? "var(--teal)" : x === "L" ? "var(--pink)" : "var(--gold)"}" title="${x}"></i>`).join("")}</span>
    <span style="text-align:right"><div class="rec">${roto ? r.roto : `${r.w}-${r.l}-${r.t}`}</div>${roto ? "" : `<div class="ppos">${r.pct.toFixed(3).replace(/^0/, "")} · GB ${r.gb}</div>`}</span></div>`).join("")}</div>
  <p class="note">${roto ? "Teams earn points by rank in each category." : `${esc(E.SCORING_TYPES[league.settings.scoring].desc)}`} Dashed line = playoff cut.</p>`;
}

function scheduleView(league) {
  const cur = E.currentWeek(league);
  const w = Math.min(S.ui.schedWeek || cur, league.settings.regularSeasonWeeks);
  const pairs = league.matchups[w] || [];
  return `<div class="sec-h"><div class="wk"><button data-act="sweek" data-v="${w - 1}" ${w <= 1 ? "disabled" : ""} aria-label="Previous week">‹</button>Wk. ${w}<button data-act="sweek" data-v="${w + 1}" ${w >= league.settings.regularSeasonWeeks ? "disabled" : ""} aria-label="Next week">›</button></div><span class="note">${E.weekRange(w).end < league.currentDay ? "Final" : w === cur ? "In progress" : "Upcoming"}</span></div>
    <div class="stack" style="gap:10px">${pairs.map(([a, b]) => w <= cur ? miniMatch(league, w, a, b) : `<div class="lmatch">${ownerCard(league, E.teamById(league, a), false, 0, 0.5, "Upcoming")}<div class="vs">VS</div>${ownerCard(league, E.teamById(league, b), true, 0, 0.5, "Upcoming")}</div>`).join("")}</div>`;
}

function settingsView(league) {
  const s = league.settings;
  const rows = [
    ["League type", league.type === "dynasty" ? "Dynasty — rosters carry over, rookie drafts, taxi squads, tradeable future picks" : "Redraft — fresh draft every season"],
    ["Scoring", `${E.SCORING_TYPES[s.scoring].label} — ${E.SCORING_TYPES[s.scoring].desc}`],
    ["Categories", s.cats.map((c) => CL[c].label).join(" · ")],
    ["Roster", `${s.slots.filter((x) => E.isStarterSlot(x)).join(", ")} · ${s.slots.filter((x) => x === "BN").length} BN · ${s.slots.filter((x) => x === "IR").length} IR`],
    ["Lineup lock", "Daily — each player locks at his own tip-off"],
    ["Acquisitions", `${s.maxAcqPerWeek} per matchup week · ${s.waiverType} waivers`],
    ["Regular season", `${s.regularSeasonWeeks} weeks (Week 1 = opening night through Sunday)`],
    ["Playoffs", `${s.playoffTeams} teams, ${E.SEASON.playoffWeeks} weeks${s.playoffTeams === 6 ? ", top-2 seeds get byes" : ""}; ties go to the higher seed`],
    ["Trade deadline", `Week ${s.tradeDeadlineWeek}`],
    ["Draft", s.draftType === "snake" ? "Snake" : "Linear"],
  ];
  if (league.type === "dynasty") rows.push(["Taxi squad", `${s.taxiSlots} slots · rookies & 2nd-year players`], ["Rookie draft", `${s.rookieDraftRounds} rounds, linear, reverse standings`], ["Future picks", `${s.futurePickYears} seasons tradeable`]);
  return `<div class="box kv">${rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`).join("")}</div>
    <p class="note">Every option above is configuration in the engine (defaultSettings), not code: 8/9/10/11-cat, H2H each / most / roto, roster shape, playoff size.</p>`;
}

function playerEvent(id, sign) {
  const p = P(id);
  return `<div class="pl"><span class="sign" style="color:${sign === "+" ? "var(--teal)" : "var(--pink)"}">${sign === "+" ? "+" : "−"}</span>${pav(p, "sm")}<div style="display:flex;flex-direction:column"><b>${esc(p.name)}</b>${pposLine(p)}</div></div>`;
}
function txLine(league, t) {
  const day = esc(E.fmtDay(Math.max(0, t.day), { month: "short", day: "numeric" }));
  const lab = (a) => (a.startsWith("pick:") ? `<div class="pl"><span class="sign teal">+</span><span class="pickchip">${esc(E.pickLabel(league, a.slice(5)))}</span></div>` : playerEvent(a, "+"));
  if (t.type === "trade") {
    const [a, b] = t.teams.map((id) => E.teamById(league, id));
    return `<div class="event"><span class="lead2"><b style="color:var(--fg)">Trade</b> · <span class="dim">${day}</span></span><span class="ppos">${esc(a.name)} receive</span>${t.get.map(lab).join("")}<span class="ppos">${esc(b.name)} receive</span>${t.give.map(lab).join("")}</div>`;
  }
  const team = E.teamById(league, t.teamId);
  return `<div class="event"><span class="lead2">${esc(team.owner)} made a free agent move. <span class="dim">${day}</span></span>${t.adds.map((id) => playerEvent(id, "+")).join("")}${t.drops.map((id) => playerEvent(id, "-")).join("")}</div>`;
}

// ------------------------------------------------------------------ TRADES
function assetChip(league, a) {
  if (a.startsWith("pick:")) return `<span class="pickchip">${esc(E.pickLabel(league, a.slice(5)))}</span>`;
  const p = P(a);
  return `<span class="assetchip" data-act="player" data-v="${a}">${pav(p, "sm")}<span style="display:flex;flex-direction:column"><b>${esc(shortName(p))}</b>${pposLine(p)}</span></span>`;
}
function impactBars(league, delta) {
  return `<div class="stack" style="gap:7px">${league.settings.cats.map((c) => {
    const d = delta[c] || 0;
    const w = Math.min(50, Math.abs(d) * 18);
    return `<div class="zrow"><span class="lab">${CL[c].label}</span><div class="ztrack"><div class="mid"></div><div class="fill" style="${d >= 0 ? `left:50%;width:${w}%;background:var(--teal)` : `right:50%;width:${w}%;background:var(--pink)`}"></div></div><span style="text-align:right;font-weight:700;color:${d > 0.05 ? "var(--teal)" : d < -0.05 ? "var(--pink)" : "var(--muted)"}">${d > 0 ? "+" : ""}${d.toFixed(1)}</span></div>`;
  }).join("")}</div>`;
}

function viewTrades(league) {
  const me = ME();
  const offers = league.tradeOffers.filter((o) => o.to === me.id && o.status === "pending");
  const partner = S.ui.tradeWith ? E.teamById(league, S.ui.tradeWith) : null;
  const offersHtml = offers.map((o) => {
    const from = E.teamById(league, o.from);
    const imp = E.tradeImpact(league, me.id, o.get, o.give);
    return `<div class="sec-h"><h2>Trade offer</h2><span class="note">from ${esc(from.owner)}</span></div>
      <div class="box box-pad grid2">
        <div class="stack" style="gap:12px;min-width:0">
          <div class="row nowrap">${av(from, "lg")}<div><div class="h-label" style="font-size:14px;font-weight:600">${esc(from.name)}</div><div class="ppos">${esc(sideName(from))}</div></div></div>
          ${o.note ? `<div class="callout">“${esc(o.note)}”</div>` : ""}
          <div><div class="cap" style="margin-bottom:8px">You receive</div><div class="row">${o.give.map((a) => assetChip(league, a)).join("")}</div></div>
          <div><div class="cap" style="margin-bottom:8px">You send</div><div class="row">${o.get.map((a) => assetChip(league, a)).join("")}</div></div>
          <div class="row"><button class="btn teal" data-act="offer-accept" data-v="${o.id}">ACCEPT</button><button class="btn" data-act="offer-counter" data-v="${o.id}">COUNTER</button><button class="btn pinkb" data-act="offer-decline" data-v="${o.id}">DECLINE</button></div>
        </div>
        <div style="min-width:0"><div class="cap" style="margin-bottom:10px">Your category impact (z)</div>${impactBars(league, imp.delta)}</div>
      </div>`;
  }).join("");
  const builder = `<div class="sec-h"><h2>Propose a trade</h2><span class="spacer"></span>
      <select id="tradepartner" data-act="trade-partner" aria-label="Trade partner" style="height:32px;background:var(--raise);border:0;border-radius:8px;padding:0 10px;font-family:var(--font-data);font-size:12px">
        <option value="">Choose a team…</option>${league.teams.filter((t) => !t.isUser).map((t) => `<option value="${t.id}" ${partner && partner.id === t.id ? "selected" : ""}>${esc(t.name)} (${esc(t.owner)})</option>`).join("")}
      </select></div>
    ${partner ? tradeBuilderBody(league, me, partner) : `<div class="box empty">Pick a trade partner to start. Tip: tap ⇄ next to any rostered player in Players.</div>`}`;
  const hist = league.transactions.filter((t) => t.type === "trade").slice(0, 10);
  return `${offersHtml}${builder}
    <div class="sec-h"><h2>Trade history</h2></div><div class="box box-pad stack" style="gap:14px">${hist.map((t) => txLine(league, t)).join("") || `<span class="muted">No trades yet.</span>`}</div>`;
}

function tradeBuilderBody(league, me, partner) {
  const give = S.ui.tradeGive, get = S.ui.tradeGet;
  const assets = (team, sel, actName) => {
    const players = [...E.rosterOf(team), ...team.taxi].sort((a, b) => E.valueOf(league, b) - E.valueOf(league, a));
    const picks = league.type === "dynasty" ? league.picks.filter((p) => p.owner === team.id) : [];
    return `<div style="display:flex;flex-direction:column;gap:2px;max-height:380px;overflow-y:auto">
      ${players.map((id) => { const p = P(id); return `<label class="asset"><input type="checkbox" data-act="${actName}" data-v="${id}" ${sel.includes(id) ? "checked" : ""}>${pav(p, "sm")}<span style="display:flex;flex-direction:column;min-width:0"><span class="pname">${esc(shortName(p))}</span>${pposLine(p)}</span><span class="val">${E.valueOf(league, id).toFixed(1)}</span></label>`; }).join("")}
      ${picks.map((pk) => `<label class="asset"><input type="checkbox" data-act="${actName}" data-v="pick:${pk.id}" ${sel.includes("pick:" + pk.id) ? "checked" : ""}><span class="pickchip">${esc(E.pickLabel(league, pk.id))}</span><span class="val">${E.pickValue(league, pk).toFixed(1)}</span></label>`).join("")}
    </div>`;
  };
  const imp = E.tradeImpact(league, me.id, give, get);
  const ev = give.length || get.length ? E.evaluateTrade(league, me.id, partner.id, give, get) : null;
  return `<div class="box box-pad grid2">
      <div style="min-width:0"><div class="row nowrap" style="margin-bottom:8px">${av(me)}<span class="cap">You send</span></div>${assets(me, give, "tg-give")}</div>
      <div style="min-width:0"><div class="row nowrap" style="margin-bottom:8px">${av(partner)}<span class="cap">${esc(partner.owner)} sends</span></div>${assets(partner, get, "tg-get")}</div>
    </div>
    <div class="box box-pad grid2">
      <div style="min-width:0"><div class="cap" style="margin-bottom:10px">Your category impact (z)</div>${impactBars(league, imp.delta)}</div>
      <div class="stack" style="gap:12px;min-width:0">
        ${ev ? `<div class="callout">Value you send <b>${ev.giveValue.toFixed(1)}</b> · value you get <b>${ev.getValue.toFixed(1)}</b><br>${league.type === "dynasty" ? "Dynasty value includes an age curve and draft-pick value." : "Redraft value = rest-of-season category z-scores."}</div>` : `<div class="callout">Select players${league.type === "dynasty" ? " or picks" : ""} on both sides to preview the category impact before you send.</div>`}
        <div class="row"><button class="btn teal" data-act="trade-propose" ${give.length && get.length ? "" : "disabled"}>PROPOSE TRADE</button><button class="btn ghost" data-act="trade-clear">CLEAR</button></div>
        <p class="note">The other managers are simulated in this demo and answer instantly based on value and category fit.</p>
      </div>
    </div>`;
}

// ------------------------------------------------------------------ DRAFT
function viewDraft(league) {
  const d = league.draft;
  if (d) return draftRoom(league);
  const hist = league.draftHistory || [];
  const isDyn = league.type === "dynasty";
  const main = isDyn ? hist.find((h) => h.kind === "rookie") : hist.find((h) => h.kind === "startup");
  let html = `<div class="box box-pad otc"><div><div class="t">${isDyn ? "Rookie drafts & future picks" : "Draftboard"}</div><div class="note">${isDyn ? "Linear rookie drafts each summer (2 rounds), plus a taxi squad for stashes." : "Snake draft with live board, queue and autopick."}</div></div><span class="spacer"></span>
    <button class="btn teal" data-act="mock" data-v="${isDyn ? "rookie" : "startup"}">${isDyn ? "MOCK ROOKIE DRAFT" : "MOCK DRAFT"}</button></div>
    <p class="note" style="margin-top:-8px">Mocks run in a sandbox and don't change league rosters.</p>`;
  if (main) html += `<div class="sec-h"><h2>${isDyn ? "2026 Rookie Draft" : "2026-27 Draft"}</h2><span class="note">Results</span></div><div class="box scroll-x" style="padding:12px">${board(league, main.order, main.picks, null)}</div>`;
  if (isDyn) html += picksGrid(league);
  return html;
}

function board(league, order, picks, clockPick, lastPick) {
  const n = new Set(order.map((o) => o.teamId)).size;
  const rounds = Math.max(...order.map((o) => o.round));
  const byPick = new Map(picks.map((p) => [p.pick, p]));
  const r1 = order.filter((o) => o.round === 1);
  let cells = `<div class="board" style="grid-template-columns:repeat(${n},minmax(72px,1fr))">`;
  cells += r1.map((o) => { const t = E.teamById(league, o.teamId); return `<div class="hd" title="${esc(t.name)}">${esc(t.owner)}</div>`; }).join("");
  for (let r = 1; r <= rounds; r++) {
    const row = order.filter((o) => o.round === r);
    cells += r1.map((o1) => {
      const o = row.find((x) => x.teamId === o1.teamId);
      if (!o) return `<div></div>`;
      const pk = byPick.get(o.pick);
      const t = E.teamById(league, o.teamId);
      const p = pk ? P(pk.pid) : null;
      const no = `${r}.${String(((o.pick - 1) % n) + 1).padStart(2, "0")}`;
      if (p) {
        const parts = p.name.split(" ");
        return `<div class="pk f-${p.pos[0]} ${t.isUser ? "me" : ""} ${lastPick === o.pick ? "new" : ""}" data-act="player" data-v="${p.id}" style="cursor:pointer"><span>${esc(parts[0])}</span><b>${esc(parts.slice(1).join(" ") || parts[0])}</b><span>${esc(p.pos.join("/"))} - ${esc(teamStr(p))}</span><span class="no">${no}</span></div>`;
      }
      return `<div class="pk ${clockPick === o.pick ? "clock" : "empty"}">${clockPick === o.pick ? `<b>On the clock</b>` : ""}<span class="no">${no}</span></div>`;
    }).join("");
  }
  return cells + `</div>`;
}

function picksGrid(league) {
  const seasons = [...new Set(league.picks.map((p) => p.season))];
  const rounds = [...new Set(league.picks.map((p) => p.round))];
  return `<div class="sec-h"><h2>Future pick ownership</h2><span class="note">gold = traded</span></div>
  <div class="box scroll-x" style="padding:4px 8px 8px"><table class="tbl">
    <thead><tr><th class="l">ORIGINAL TEAM</th>${seasons.flatMap((s) => rounds.map((r) => `<th>${s} R${r}</th>`)).join("")}</tr></thead><tbody>
    ${league.teams.map((t) => `<tr><td class="l"><div class="row nowrap">${av(t)}<span style="font-family:var(--font-head);font-weight:600">${esc(t.name)}</span></div></td>${seasons.flatMap((s) => rounds.map((r) => {
      const pk = league.picks.find((p) => p.season === s && p.round === r && p.originalTeam === t.id);
      return `<td>${pk.owner === t.id ? `<span class="dim">Own</span>` : `<span class="pickchip">→ ${esc(E.teamById(league, pk.owner).owner)}</span>`}</td>`;
    })).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}

function draftRoom(league) {
  const d = league.draft;
  const slot = E.onTheClock(league);
  const me = ME();
  const myTurn = slot && slot.teamId === me.id;
  const pool = E.draftPool(league);
  const vals = E.valuesFor(league);
  let list = pool.filter((p) => (S.ui.draftPos === "ALL" || p.pos.includes(S.ui.draftPos)) && (!S.ui.draftQ || p.name.toLowerCase().includes(S.ui.draftQ.toLowerCase())));
  list.sort((a, b) => E.valueOf(league, b.id) - E.valueOf(league, a.id));
  list = list.slice(0, 80);
  const myPicks = d.picks.filter((p) => p.teamId === me.id).map((p) => P(p.pid));
  const last = d.picks[d.picks.length - 1];
  const otcTeam = slot ? E.teamById(league, slot.teamId) : null;
  return `
  <div class="box box-pad otc">
    ${d.status === "done" ? `<div><div class="t">Draft complete</div><div class="note">${d.sandbox ? "This was a mock — rosters are unchanged." : "Rosters are set. The season catches up to today with auto-lineups."}</div></div><span class="spacer"></span>
      <button class="btn teal" data-act="draft-finish">${d.sandbox ? "CLOSE MOCK" : "START THE SEASON"}</button>` : `
      ${av(otcTeam, "lg")}<div><div class="cap">On the clock · pick ${slot.round}.${String(((slot.pick - 1) % league.teams.length) + 1).padStart(2, "0")}</div><div class="t">${esc(otcTeam.name)}${myTurn ? ` <span class="teal">— you're up</span>` : ""}</div>
      ${last ? `<div class="note">Last pick: ${esc(E.teamById(league, last.teamId).owner)} took <b style="color:var(--fg)">${esc(P(last.pid).name)}</b></div>` : ""}</div>
      <span class="spacer"></span>
      <label class="check"><input type="checkbox" id="draftauto" data-act="draft-auto" ${S.ui.draftAuto ? "checked" : ""}> Autopick</label>
      ${!myTurn ? `<button class="btn" data-act="draft-advance">SKIP TO MY PICK</button>` : ""}
      ${d.sandbox ? `<button class="btn ghost" data-act="draft-finish">EXIT MOCK</button>` : ""}`}
  </div>
  <div class="box scroll-x" style="padding:12px">${board(league, d.order, d.picks, slot && slot.pick, last && last.pick)}</div>
  <div class="grid2">
    <div class="box" style="padding:12px 8px 8px;min-width:0"><div class="row" style="padding:0 8px 8px"><span class="h-label" style="font-size:14px">Available</span><span class="spacer"></span>
      <input class="search" id="dq" type="search" placeholder="Find player" value="${esc(S.ui.draftQ)}" data-act="dq" aria-label="Search draft pool" style="width:140px"></div>
      <div class="pills" style="padding:0 8px 8px">${["ALL", "PG", "SG", "SF", "PF", "C"].map((k) => `<button class="pill ${S.ui.draftPos === k ? "on" : ""}" data-act="dpos" data-v="${k}">${k}</button>`).join("")}</div>
      <div class="scroll-x" style="max-height:440px;overflow-y:auto"><table class="tbl"><thead><tr><th class="l">PLAYER</th><th>RK</th><th class="hl">${league.type === "dynasty" ? "DYN" : "VAL"}</th><th></th></tr></thead><tbody>
      ${list.map((p, i) => `<tr class="${i % 2 ? "alt" : ""}"><td class="l"><div class="prow-t">${pav(p, "sm")}<div class="who"><span class="pname" data-act="player" data-v="${p.id}">${esc(shortName(p))}</span>${pposLine(p)}</div></div></td><td class="dim">${vals.get(p.id) && vals.get(p.id).rank < 9999 ? vals.get(p.id).rank : "—"}</td><td class="hl" style="font-weight:700">${E.valueOf(league, p.id).toFixed(1)}</td>
        <td>${myTurn ? `<button class="btn sm teal" data-act="draft-pick" data-v="${p.id}">DRAFT</button>` : `<button class="btn sm ghost" data-act="queue" data-v="${p.id}">${d.queue.includes(p.id) ? "QUEUED" : "QUEUE"}</button>`}</td></tr>`).join("")}
      </tbody></table></div></div>
    <div class="box box-pad stack" style="gap:8px;align-self:start"><div class="sec-h"><h2>My picks</h2><span class="note">${myPicks.length}</span></div>
      ${myPicks.map((p) => `<div class="row nowrap">${posBadge(p.pos[0])}${pav(p, "sm")}<span class="pname" data-act="player" data-v="${p.id}">${esc(shortName(p))}</span><span class="ppos">${esc(teamStr(p))}</span></div>`).join("") || `<span class="muted" style="font-size:12px">No picks yet.</span>`}
      ${d.queue.length ? `<div class="cap" style="margin-top:8px">Queue</div>${d.queue.map((id) => `<div class="row nowrap"><span class="pname">${esc(shortName(P(id)))}</span><span class="spacer"></span><button class="btn sm ghost" data-act="queue" data-v="${id}">REMOVE</button></div>`).join("")}` : ""}
    </div>
  </div>`;
}

let draftTimer = null;
function runDraftBots(stepMs = 170) {
  clearTimeout(draftTimer);
  const league = L();
  const d = league.draft;
  if (!d || d.status !== "live") return;
  const slot = E.onTheClock(league);
  if (!slot) return;
  if (slot.teamId === ME().id && !S.ui.draftAuto) return;
  draftTimer = setTimeout(() => {
    const lg = L();
    if (!lg.draft || lg.draft.status !== "live") return;
    const s = E.onTheClock(lg);
    if (s.teamId === ME().id) {
      const q = lg.draft.queue.find((id) => E.draftPool(lg).some((p) => p.id === id));
      if (q) E.makePick(lg, q); else E.botPick(lg);
    } else E.botPick(lg);
    save();
    render();
    runDraftBots(stepMs);
  }, stepMs);
}

// ------------------------------------------------------------------ CHAT
function chatEvent(league, m) {
  const when = esc(E.fmtDay(Math.max(0, m.day), { month: "short", day: "numeric" }));
  let body = `<span class="lead2">${esc(m.text)}</span>`;
  const lab = (a) => (a.startsWith("pick:") ? `<div class="pl"><span class="sign teal">+</span><span class="pickchip">${esc(E.pickLabel(league, a.slice(5)))}</span></div>` : playerEvent(a, "+"));
  if (m.kind === "tx" && m.adds) {
    const t = E.teamById(league, m.teamId);
    body = `<span class="lead2">${esc(t.owner)} made a free agent move.</span>${m.adds.map((id) => playerEvent(id, "+")).join("")}${m.drops.map((id) => playerEvent(id, "-")).join("")}`;
  } else if (m.kind === "trade" && m.teams) {
    const [a, b] = m.teams.map((id) => E.teamById(league, id));
    body = `<span class="lead2">${esc(a.owner)} and ${esc(b.owner)} completed a trade.</span><span class="ppos">${esc(a.name)} receive</span>${m.get.map(lab).join("")}<span class="ppos">${esc(b.name)} receive</span>${m.give.map(lab).join("")}`;
  }
  return `<div class="msg"><span class="sysav">${ICON.shield}</span><div style="min-width:0"><div class="meta">${when}</div><div class="event">${body}</div></div></div>`;
}
function renderChat(league) {
  const msgs = league.chat.slice(-80);
  return `<aside class="chat" aria-label="League chat"><div class="chat-in">
    <div class="chat-h"><h3>League Chat</h3><span class="spacer"></span><button class="x chatbtn" data-act="chat-toggle" aria-label="Close chat" style="width:28px;height:28px;margin:0">×</button></div>
    <div class="msgs">${msgs.map((m) => {
      if (m.kind !== "msg") return chatEvent(league, m);
      const t = E.teamById(league, m.from);
      return `<div class="msg">${av(t)}<div style="min-width:0"><div class="meta"><b>${esc(t.owner)}</b>${esc(E.fmtDay(Math.max(0, m.day), { month: "short", day: "numeric" }))}</div><div class="txt">${esc(m.text)}</div></div></div>`;
    }).join("")}</div>
    <form data-act="chat-send"><input id="chatin" placeholder="Enter Message" autocomplete="off" aria-label="Message"><button class="send" type="submit" aria-label="Send">${ICON.send.replace("<svg", '<svg style="width:20px;height:20px"')}</button></form>
  </div></aside>`;
}
const BOT_REPLIES = ["lol", "Bold strategy.", "Check your DMs 👀", "My FT% is fine, thanks for asking", "Who's streaming centers this week?", "That trade was robbery", "Wemby is a cheat code in this format", "Punt life 🤝", "Accept my offer"];

// ------------------------------------------------------------------ MODALS
function renderModal(league) {
  const m = S.modal;
  if (m.type === "player") return playerModal(league, m.id);
  if (m.type === "drop") return dropModal(league, m.addId);
  if (m.type === "wizard") return wizardModal();
  if (m.type === "about") return aboutModal();
  return "";
}

function playerModal(league, id) {
  const p = P(id);
  const vals = E.valuesFor(league);
  const v = vals.get(id);
  const owner = E.ownerOf(league, id);
  const mineP = owner && owner.isUser;
  const line = (label, l, src) => l ? `<tr><td class="l"><span style="font-weight:700;color:var(--fg)">${label}</span><div class="ppos">${src}</div></td><td>${l.g ?? "—"}</td><td>${f1(l.min)}</td><td>${pct(l.fgm, l.fga)}</td><td>${pct(l.ftm, l.fta)}</td><td>${f1(l.tpm)}</td><td>${f1(l.pts)}</td><td>${f1(l.reb)}</td><td>${f1(l.ast)}</td><td>${f1(l.stl)}</td><td>${f1(l.blk)}</td><td>${f1(l.to)}</td></tr>` : "";
  const wk = E.currentWeek(league);
  const { start, end } = E.weekRange(wk);
  let logs = "";
  for (let d = start; d <= end; d++) {
    const opp = oppOn(p, d);
    if (!opp) continue;
    logs += `<div class="mcell"><span class="cap">${esc(E.fmtDay(d, { weekday: "short", month: "short", day: "numeric" }))}</span>${d < league.currentDay ? gameStat(E.gameLog(p, d, E.SCHEDULE_SEED)) : `<span class="stat"><span class="opp">${esc(opp)}</span>Upcoming</span>`}</div>`;
  }
  const zs = league.settings.cats.map((c) => {
    const z = v && v.z ? v.z[c] || 0 : 0;
    const w = Math.min(50, Math.abs(z) * 16);
    return `<div class="zrow"><span class="lab">${CL[c].label}</span><div class="ztrack"><div class="mid"></div><div class="fill" style="${z >= 0 ? `left:50%;width:${w}%;background:var(--teal)` : `right:50%;width:${w}%;background:var(--pink)`}"></div></div><span style="text-align:right;font-weight:700">${z > 0 ? "+" : ""}${z.toFixed(1)}</span></div>`;
  }).join("");
  const canTaxi = mineP && league.type === "dynasty" && p.exp <= league.settings.taxiMaxExp && !owner.taxi.includes(id);
  return `<div class="mh">${pav(p, "xl")}<div style="min-width:0"><h2>${esc(p.name)}</h2>
      <div style="margin-top:2px">${pposLine(p)} <span class="ppos">· Age ${p.age ?? "—"}${p.note ? " · " + esc(p.note) : ""}</span></div>
      <div class="note" style="margin-top:4px">${owner ? `Rostered by <b style="color:var(--fg)">${esc(owner.name)}</b>` : `<b class="teal">Free agent</b>`} · ${v && v.rank < 9999 ? `#${v.rank} in ${league.settings.cats.length}-cat value` : "Unranked"}${league.type === "dynasty" ? ` · dynasty value ${E.valueOf(league, id).toFixed(1)}` : ""}</div></div>
      <button class="x" data-act="close-modal" aria-label="Close">×</button></div>
    <div class="mb">
      <div class="row">
        ${!owner && league.status === "inseason" ? `<button class="btn teal" data-act="add" data-v="${id}">+ ADD</button>` : ""}
        ${mineP ? `<button class="btn pinkb" data-act="drop" data-v="${id}">DROP</button>` : ""}
        ${canTaxi ? `<button class="btn" data-act="to-taxi" data-v="${id}">MOVE TO TAXI</button>` : ""}
        ${owner && !owner.isUser ? `<button class="btn" data-act="trade-for" data-v="${id}">TRADE FOR ${esc(p.name.split(" ").slice(-1)[0].toUpperCase())}</button>` : ""}
      </div>
      <div class="box scroll-x" style="padding:4px 8px 8px"><table class="tbl"><thead><tr><th class="l">PER GAME</th><th>GP</th><th>MIN</th><th>FG%</th><th>FT%</th><th>3PM</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th></tr></thead><tbody>
        ${line("2026-27", p.s2627, "To date · Basketball-Reference")}
        ${line("2025-26", p.s2526, "Basketball-Reference")}
        ${line("2024-25", p.s2425, "Basketball-Reference")}
        ${line("Projection", p.proj, esc(p.projSource))}
      </tbody></table>
      ${!p.s2627 && !p.s2526 && !p.s2425 ? `<p class="note" style="padding:8px">No NBA stat line in the source extract yet.</p>` : ""}
      ${p.teamSource && p.teamSource !== "2026-27" ? `<p class="note" style="padding:8px">Team shown per ${esc(p.teamSource)}; this player's 2026-27 line wasn't in the extract.</p>` : ""}</div>
      <div class="grid2">
        <div><div class="cap" style="margin-bottom:10px">Category profile (z-score)</div><div class="stack" style="gap:7px">${zs}</div></div>
        <div style="min-width:0"><div class="cap" style="margin-bottom:10px">Week ${wk} games · simulated</div><div class="stack" style="gap:6px">${logs || `<span class="muted" style="font-size:12px">No games this week.</span>`}</div></div>
      </div>
    </div>`;
}

function dropModal(league, addId) {
  const me = ME();
  const p = P(addId);
  const roster = E.rosterOf(me).sort((a, b) => E.valueOf(league, a) - E.valueOf(league, b));
  return `<div class="mh">${pav(p, "")}<h2>Add ${esc(p.name)}</h2><button class="x" data-act="close-modal" aria-label="Close">×</button></div>
    <div class="mb"><div class="callout">Your roster is full. Choose a player to drop.</div>
    <div class="stack" style="gap:4px">${roster.map((id) => { const q = P(id); return `<div class="asset">${pav(q, "sm")}<span style="display:flex;flex-direction:column"><span class="pname">${esc(q.name)}</span>${pposLine(q)}</span><span class="val">${E.valueOf(league, id).toFixed(1)}</span><button class="btn sm pinkb" data-act="add-drop" data-v="${addId}|${id}">DROP</button></div>`; }).join("")}</div></div>`;
}

const WIZ = { name: "My 9-Cat League", type: "redraft", teams: 12, scoring: "h2h_each", preset: "9cat", playoffs: 6, draftType: "snake", taxi: 3, rookieRounds: 2 };
function wizardModal() {
  const w = WIZ;
  const opt = (key, val, title, sub) => `<button class="opt ${w[key] === val ? "on" : ""}" data-act="wiz" data-k="${key}" data-v="${val}" type="button"><b>${title}</b><span>${sub}</span></button>`;
  return `<div class="mh"><span class="brand-mark"></span><h2>Create a basketball league</h2><button class="x" data-act="close-modal" aria-label="Close">×</button></div>
  <div class="mb">
    <div class="field"><label for="wizname">League name</label><input type="text" id="wizname" value="${esc(w.name)}" maxlength="40"></div>
    <div class="field"><label>League type</label><div class="opts">${opt("type", "redraft", "Redraft", "Draft a new team every season")}${opt("type", "dynasty", "Dynasty", "Keep your roster · rookie drafts · taxi")}</div></div>
    <div class="field"><label>Scoring</label><div class="opts">${Object.entries(E.SCORING_TYPES).map(([k, v]) => opt("scoring", k, v.label, v.desc)).join("")}</div></div>
    <div class="field"><label>Categories</label><div class="opts">${Object.entries(E.PRESETS).map(([k, v]) => opt("preset", k, v.label, v.cats.map((c) => CL[c].label).join(" "))).join("")}</div></div>
    <div class="grid2">
      <div class="field"><label for="wizteams">Teams</label><select id="wizteams" data-act="wizsel" data-k="teams">${[8, 10, 12, 14, 16].map((n) => `<option ${w.teams === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field"><label for="wizpo">Playoff teams</label><select id="wizpo" data-act="wizsel" data-k="playoffs">${[4, 6].map((n) => `<option ${w.playoffs === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field"><label for="wizdraft">Draft order</label><select id="wizdraft" data-act="wizsel" data-k="draftType"><option value="snake" ${w.draftType === "snake" ? "selected" : ""}>Snake</option><option value="linear" ${w.draftType === "linear" ? "selected" : ""}>Linear</option></select></div>
      ${w.type === "dynasty" ? `<div class="field"><label for="wiztaxi">Taxi squad slots</label><select id="wiztaxi" data-act="wizsel" data-k="taxi">${[0, 2, 3, 4, 5].map((n) => `<option ${w.taxi === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>` : ""}
    </div>
    <div class="callout">Roster: PG, SG, SF, PF, C, G, F, UTIL ×3 · 3 BN · 1 IR (standard 9-cat). Daily lineups. Other managers are bots so you can try the whole flow solo.</div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-act="close-modal">CANCEL</button><button class="btn teal" data-act="wiz-create">CREATE & DRAFT</button></div>
  </div>`;
}

function aboutModal() {
  return `<div class="mh"><span class="brand-mark"></span><h2>About this concept</h2><button class="x" data-act="close-modal" aria-label="Close">×</button></div>
  <div class="mb" style="font-family:var(--font-data);font-size:13px;line-height:1.6;color:var(--soft)">
    <p style="margin:0">A fan-built, working prototype of head-to-head category fantasy basketball (redraft and dynasty), designed to slot into Sleeper's existing league model: chat, trades, taxi squads, rookie drafts and future picks. It also fills the web panels that currently say "not yet available for NBA fantasy": Matchup, Team and Trade.</p>
    <p style="margin:0"><b style="color:var(--fg)">Real data:</b> ${esc(PLAYER_META.source)}, fetched ${esc(PLAYER_META.fetched)} (${PLAYER_META.count} players). <b style="color:var(--fg)">Simulated:</b> the day-by-day NBA schedule and box scores, generated from those real per-game averages so the season can be played forward.</p>
    <p style="margin:0"><b style="color:var(--fg)">Not affiliated with Sleeper.</b> No Sleeper logos, player photos or other assets are included; the code has one-line hooks for the brand logo and licensed headshots.</p>
    <div class="row"><button class="btn ghost" data-act="reset">RESET DEMO DATA</button></div>
  </div>`;
}
