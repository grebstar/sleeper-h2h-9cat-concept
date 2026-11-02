// Interactive demo shell. Everything league-related goes through ../engine — this file is only UI.
// Visual language follows the host app's web client (palette, type and component shapes sampled from its computed styles).
import { PLAYERS, PLAYER_META } from "../data/players.js";
import * as E from "../engine/index.js";

E.setPlayerUniverse(PLAYERS);
const P = (id) => E.playerById(id);
const CL = E.CATEGORY_LIBRARY;

// ------------------------------------------------------------------ integration hooks for the platform team
/** Brand slot: set `logo` to your own logo asset URL to show it in the sidebar. Left empty in this fan build. */
const BRAND = { logo: null, name: "Basketball", tagline: "H2H Categories · concept" };
/** Player headshots: return your licensed headshot URL for a player (e.g. keyed by p.sleeper_id). Null = team-color avatar. */
const headshotUrl = (p) => null;

// NBA team colors (primary, secondary) for player avatars
const TEAM_COLORS = {
  ATL: ["#E03A3E", "#C1D32F"], BOS: ["#007A33", "#BA9653"], BKN: ["#2a2a2a", "#ffffff"], CHA: ["#1D1160", "#00788C"], CHI: ["#CE1141", "#1a1a1a"],
  CLE: ["#860038", "#FDBB30"], DAL: ["#00538C", "#B8C4CA"], DEN: ["#0E2240", "#FEC524"], DET: ["#C8102E", "#1D42BA"], GSW: ["#1D428A", "#FFC72C"],
  HOU: ["#CE1141", "#C4CED4"], IND: ["#002D62", "#FDBB30"], LAC: ["#C8102E", "#1D428A"], LAL: ["#552583", "#FDB927"], MEM: ["#5D76A9", "#12173F"],
  MIA: ["#98002E", "#F9A01B"], MIL: ["#00471B", "#EEE1C6"], MIN: ["#0C2340", "#78BE20"], NOP: ["#0C2340", "#C8102E"], NYK: ["#006BB6", "#F58426"],
  OKC: ["#007AC1", "#EF3B24"], ORL: ["#0077C0", "#C4CED4"], PHI: ["#006BB6", "#ED174C"], PHX: ["#1D1160", "#E56020"], POR: ["#E03A3E", "#1a1a1a"],
  SAC: ["#5A2D81", "#63727A"], SAS: ["#2b2b2b", "#C4CED4"], TOR: ["#CE1141", "#1a1a1a"], UTA: ["#3E1175", "#F9A01B"], WAS: ["#002B5C", "#E31837"],
};

// ------------------------------------------------------------------ icons (simple line glyphs)
const ic = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  matchup: ic('<rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/>'),
  team: ic('<path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.4 2-4 2s-3-.5-4-2z"/>'),
  league: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  players: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  trades: ic('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'),
  draft: ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  shield: ic('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" stroke-width="1.4"/>'),
  send: ic('<path d="M4 12l16-8-6 16-2-7-8-1z"/>'),
  chat: ic('<path d="M4 5h16v11H9l-5 4V5z"/>'),
  mock: ic('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18M15 3v18M3 15h18"/>'),
  info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
};

// ------------------------------------------------------------------ state & persistence
const STORE_KEY = "h2h9cat-concept-v4";
const S = {
  leagues: {},
  order: [],
  active: "dyn-demo",
  tab: "matchup",
  ui: {
    week: null, day: null, matchupMode: "live", leagueSub: "standings", schedWeek: null,
    pf: { q: "", pos: "ALL", status: "FA", basis: "proj", punt: [], sort: "value", dir: -1, limit: 60 },
    moveFrom: null, tradeWith: null, tradeGive: [], tradeGet: [], draftQ: "", draftPos: "ALL", draftAuto: false,
    teamView: null, chatOpen: false,
  },
  modal: null,
  toast: null,
};

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ leagues: S.leagues, order: S.order, active: S.active }));
  } catch (e) { /* storage unavailable: demo still works in-memory */ }
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.leagues || !d.order || !d.order.length) return false;
    S.leagues = d.leagues;
    S.order = d.order;
    S.active = d.active && d.leagues[d.active] ? d.active : d.order[0];
    return true;
  } catch (e) { return false; }
}
function seed() {
  const dyn = E.buildDynastyDemo();
  const red = E.buildRedraftDemo();
  S.leagues = { [dyn.id]: dyn, [red.id]: red };
  S.order = [dyn.id, red.id];
  S.active = dyn.id;
}
const L = () => S.leagues[S.active];
const ME = () => E.userTeam(L());

// ------------------------------------------------------------------ helpers
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (name) => name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const pInitials = (p) => { const w = p.name.replace(/\b(Jr\.?|Sr\.?|II|III|IV)\b/g, "").replace(/[^\p{L} '-]/gu, "").trim().split(/\s+/); return ((w[0] || "")[0] + (w[w.length - 1] || "")[0]).toUpperCase(); };
const shortName = (p) => { const w = p.name.split(" "); return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(" ")}` : p.name; };
const av = (team, cls = "") => `<span class="av ${cls}" style="background:${team.color}" aria-hidden="true">${esc(initials(team.name))}</span>`;
function pav(p, cls = "") {
  const [c1, c2] = TEAM_COLORS[p.team] || ["#3a465b", "#a3bbd3"];
  const src = headshotUrl(p);
  return `<span class="pav ${cls}" style="--c1:${c1};--c2:${c2}" aria-hidden="true">${src ? `<img src="${esc(src)}" alt="">` : esc(pInitials(p))}</span>`;
}
const posBadge = (slot, extra = "", attrs = "") => `<span class="pos pos-${slot} ${extra}" ${attrs}>${slot}</span>`;
const pposLine = (p) => `<span class="ppos">${p.pos.map((x) => `<span class="t-${x}">${x}</span>`).join("/")} - ${esc(teamStr(p))}${p.exp === 0 ? '<span class="rook" title="Rookie">R</span>' : ""}</span>`;
const f1 = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toFixed(1));
const pct = (n, d) => (d > 0 ? (n / d).toFixed(3).replace(/^0/, "") : "—");
const teamStr = (p) => (p.team ? p.team : p.exp === 0 ? "Rookie" : "—");
const recordOf = (league, teamId) => {
  if (league.status !== "inseason") return "0-0-0";
  const r = E.standings(league).find((x) => x.team.id === teamId);
  return r ? (league.settings.scoring === "roto" ? `${r.roto} roto pts` : `${r.w}-${r.l}-${r.t}`) : "";
};
const ordinal = (n) => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
function toast(msg, kind = "") {
  S.toast = { msg, kind, t: Date.now() };
  renderToast();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { S.toast = null; renderToast(); }, 3200);
}
function act(fn, okMsg) {
  try {
    const r = fn();
    if (okMsg) toast(okMsg, "ok");
    save();
    render();
    return r;
  } catch (e) {
    toast(e.message || String(e), "err");
    render();
  }
}
function gameStat(g) {
  if (!g) return `<span class="stat dnp">No game</span>`;
  if (g.dnp) return `<span class="stat dnp"><span class="opp">${esc(g.opp)}</span>DNP</span>`;
  return `<span class="stat"><span class="opp">${esc(g.opp)}</span>${g.pts} PTS, ${g.reb} REB, ${g.ast} AST, ${g.tpm} 3PM, ${g.stl} STL, ${g.blk} BLK, ${g.to} TO, ${g.fgm}/${g.fga} FG, ${g.ftm}/${g.fta} FT</span>`;
}
function oppOn(p, day) {
  if (!p.team) return null;
  const g = E.teamsPlayingOn(day, E.SCHEDULE_SEED).get(p.team);
  return g ? (g.home ? "vs " : "@ ") + g.opp : null;
}
function ownerLabel(league, pid) {
  const t = E.ownerOf(league, pid);
  if (!t) return `<span class="teal" style="font-weight:700">FA</span>`;
  return `<span class="muted">${esc(t.isUser ? "You" : t.owner)}${t.taxi.includes(pid) ? " · taxi" : ""}</span>`;
}
const sideName = (team) => `@${team.owner.toLowerCase().replace(/\s+/g, "")}`;

// ------------------------------------------------------------------ routing (#league-tab)
const TABS = [["matchup", "MATCHUP"], ["team", "TEAM"], ["league", "LEAGUE"], ["players", "PLAYERS"], ["trades", "TRADES"], ["draft", "DRAFT"]];
function routeFromHash() {
  const h = (location.hash || "").slice(1);
  const m = h.match(/^(dyn|red|lg\d+)-([a-z]+)$/);
  if (!m) return;
  const key = { dyn: "dyn-demo", red: "red-demo" }[m[1]] || m[1];
  if (S.leagues[key]) S.active = key;
  if (TABS.some(([t]) => t === m[2])) S.tab = m[2];
}
function setHash() {
  const key = S.active === "dyn-demo" ? "dyn" : S.active === "red-demo" ? "red" : S.active;
  const h = `#${key}-${S.tab}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

// ------------------------------------------------------------------ top-level render
const $app = document.getElementById("app");
function render() {
  const league = L();
  setHash();
  const viewEl = document.getElementById("view");
  const keepScroll = viewEl && S._lastTab === S.tab && S._lastLeague === S.active ? viewEl.scrollTop : 0;
  const pendingOffers = league.tradeOffers.filter((o) => o.status === "pending" && o.to === ME().id).length;
  const live = league.draft && league.draft.status === "live";
  $app.innerHTML = `
  <div class="shell ${S.ui.chatOpen ? "chat-open" : ""}">
    ${renderSide()}
    <main class="center">
      ${renderHead(league)}
      <section class="panel">
        <nav class="tabs" role="tablist">
          ${TABS.map(([id, label]) => `<button role="tab" class="tab ${S.tab === id ? "on" : ""}" data-act="tab" data-v="${id}">${ICON[id]}${label}${id === "trades" && pendingOffers ? `<span class="badge">${pendingOffers}</span>` : ""}${id === "draft" && live ? `<span class="badge">LIVE</span>` : ""}</button>`).join("")}
        </nav>
        <div class="view" id="view"><div class="stack">${renderView(league)}</div></div>
      </section>
    </main>
    ${renderChat(league)}
  </div>
  <nav class="mnav">
    ${S.order.map((id) => `<button class="${id === S.active ? "on" : ""}" data-act="league" data-v="${id}">${esc(S.leagues[id].name)}</button>`).join("")}
    <button data-act="wizard">+ New league</button>
  </nav>
  ${S.modal ? `<div class="scrim" data-act="close-modal-bg"><div class="modal" role="dialog" aria-modal="true">${renderModal(league)}</div></div>` : ""}
  <div id="toast-host"></div>`;
  renderToast();
  const msgs = document.querySelector(".msgs");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
  const v2 = document.getElementById("view");
  if (v2 && keepScroll) v2.scrollTop = keepScroll;
  S._lastTab = S.tab;
  S._lastLeague = S.active;
}
function renderToast() {
  const host = document.getElementById("toast-host");
  if (!host) return;
  host.innerHTML = S.toast ? `<div class="toast ${S.toast.kind}" role="status">${esc(S.toast.msg)}</div>` : "";
}

function renderSide() {
  const leagues = S.order.map((id) => {
    const lg = S.leagues[id];
    const me = E.userTeam(lg);
    let mini = `<span>${lg.status === "inseason" ? "" : "Draft is live"}</span><span></span>`;
    if (lg.status === "inseason" && lg.settings.scoring !== "roto") {
      const wk = E.currentWeek(lg);
      const mu = E.matchupFor(lg, wk, me.id);
      if (mu) {
        const r = E.matchupResult(lg, wk, mu.me, mu.opp);
        const opp = E.teamById(lg, mu.opp);
        mini = `<span>${esc(me.name)}</span><b>${r.wins}</b><span>vs. ${esc(opp.name)}</span><b>${r.losses}</b>`;
      }
    }
    return `<button class="nav-item ${id === S.active ? "on" : ""}" data-act="league" data-v="${id}">
      <span class="lav" style="background:${lg.type === "dynasty" ? "var(--gold)" : "var(--teal)"}">${esc(initials(lg.name))}</span>
      <span style="min-width:0;flex:1"><div class="nm">${esc(lg.name)}</div><div class="mini">${mini}</div></span></button>`;
  }).join("");
  return `<aside class="side" aria-label="Navigation">
    <div class="brand">${BRAND.logo ? `<img src="${esc(BRAND.logo)}" alt="">` : `<span class="brand-mark"></span>`}<span class="brand-txt">${esc(BRAND.name)}<small>${esc(BRAND.tagline)}</small></span></div>
    <div class="side-scroll">
      <button class="nav-simple" data-act="mockdraft">${ICON.mock.replace("<svg", '<svg style="width:20px;height:20px;color:var(--muted)"')}MOCK DRAFTS</button>
      <div class="side-h"><span class="cap">Leagues</span><button class="side-add" data-act="wizard" aria-label="Create a league" title="Create a league">+</button></div>
      ${leagues}
      ${clockCard(L())}
      <div class="side-h"><span class="cap">About</span></div>
      <button class="nav-simple" data-act="about">${ICON.info.replace("<svg", '<svg style="width:20px;height:20px;color:var(--muted)"')}Fan concept · not affiliated</button>
    </div>
    <div class="me-bar">${av(ME(), "")}<b>Cory</b><span class="spacer"></span><button class="gear" data-act="about" aria-label="About this demo">${ICON.gear}</button></div>
  </aside>`;
}

function clockCard(league) {
  if (league.status !== "inseason") return "";
  const wk = E.currentWeek(league);
  const done = league.currentDay > E.lastDay();
  return `<div class="promo"><div class="promo-t">Demo clock</div>
    <div class="promo-b">${done ? "Season complete" : esc(E.fmtDay(Math.min(league.currentDay, E.lastDay()), { weekday: "long", month: "short", day: "numeric" }))} · ${wk > league.settings.regularSeasonWeeks ? "Playoffs " : ""}Week ${wk}<br>Play the season forward with simulated games.</div>
    <div class="promo-a"><button class="btn sm" data-act="sim-week" ${done ? "disabled" : ""}>SIM WEEK</button><button class="btn sm teal" data-act="sim-day" ${done ? "disabled" : ""}>SIM DAY</button></div></div>`;
}

function renderHead(league) {
  const wk = E.currentWeek(league);
  const inSeason = league.status === "inseason";
  const done = league.currentDay > E.lastDay();
  const sub = `2026-27 ${league.teams.length}-Team ${league.type === "dynasty" ? "Dynasty" : "Redraft"} · ${league.settings.cats.length}-Cat ${league.settings.scoring === "h2h_most" ? "H2H Most" : league.settings.scoring === "roto" ? "Roto" : "H2H"}`;
  return `<header class="lg-head">
    <span class="lav" style="background:${league.type === "dynasty" ? "var(--gold)" : "var(--teal)"}">${esc(initials(league.name))}</span>
    <h1>${esc(league.name)}</h1><span class="subt">${esc(sub)}</span>
    <button class="gear" data-act="settings" aria-label="League settings" title="League settings">${ICON.gear}</button>
    <button class="gear chatbtn" data-act="chat-toggle" aria-label="League chat" title="League chat">${ICON.chat}</button>
    ${inSeason ? `<div class="clock mclock" title="Demo controls: advance the simulated season">
      <div class="when"><b>${done ? "Season complete" : esc(E.fmtDay(Math.min(league.currentDay, E.lastDay())))}</b>${wk > league.settings.regularSeasonWeeks ? "Playoffs · " : ""}Week ${wk}</div>
      <button class="btn teal" data-act="sim-day" ${done ? "disabled" : ""}>SIM DAY</button>
      <button class="btn" data-act="sim-week" ${done ? "disabled" : ""}>SIM WEEK</button>
    </div>` : `<div class="clock"><span class="pill" style="color:var(--gold)">PRE-DRAFT</span></div>`}
  </header>`;
}

function renderView(league) {
  if (league.status === "predraft" && S.tab !== "draft" && S.tab !== "league")
    return `<div class="empty"><p style="font-family:var(--font-head);font-size:16px;color:var(--fg)">This league hasn't drafted yet.</p><p>Head to the Draft tab to run the draft room.</p><button class="btn teal" data-act="tab" data-v="draft">GO TO DRAFT</button></div>`;
  switch (S.tab) {
    case "matchup": return viewMatchup(league);
    case "team": return viewTeam(league);
    case "players": return viewPlayers(league);
    case "league": return viewLeague(league);
    case "trades": return viewTrades(league);
    case "draft": return viewDraft(league);
    default: return "";
  }
}

// ------------------------------------------------------------------ MATCHUP
function ownerCard(league, team, right, wins, share, extra) {
  const color = share >= 0.5 ? "var(--teal)" : "var(--pink)";
  const pctTxt = `${Math.round(share * 100)}%`;
  const head = `<div style="min-width:0"><div class="un">${esc(sideName(team))}</div><div class="tn">${esc(team.name)}</div></div>`;
  const sc = `<div class="sc">${wins}</div>`;
  return `<div class="ocard ${right ? "r" : ""}" data-act="viewteam" data-v="${team.isUser ? "" : team.id}">
    ${right ? `${sc}${head}${av(team, "lg")}` : `${av(team, "lg")}${head}${sc}`}
    <div class="bar"><i style="width:${Math.round(share * 100)}%;background:${color}"></i></div>
    <div class="meta">${right ? `<span class="hide-sm">${esc(extra)}</span><b>${recordOf(league, team.id)}</b><b>${pctTxt}</b>` : `<b>${pctTxt}</b><b>${recordOf(league, team.id)}</b><span class="hide-sm">${esc(extra)}</span>`}</div>
  </div>`;
}

function viewMatchup(league) {
  const cur = E.currentWeek(league);
  const week = Math.min(S.ui.week || cur, E.totalWeeks());
  if (league.settings.scoring === "roto") return `<div class="empty">Rotisserie leagues have no weekly matchups. See <b>League</b> for category ranks.</div>`;
  const mu = E.matchupFor(league, week, ME().id);
  const header = `<div class="sec-h">
      <div class="wk"><button data-act="week" data-v="${week - 1}" ${week <= 1 ? "disabled" : ""} aria-label="Previous week">‹</button>${week > league.settings.regularSeasonWeeks ? "Playoffs " : ""}Wk. ${week}<button data-act="week" data-v="${week + 1}" ${week >= E.totalWeeks() ? "disabled" : ""} aria-label="Next week">›</button></div>
      <span class="note hide-sm">${esc(E.fmtDay(E.weekRange(week).start, { month: "short", day: "numeric" }))} – ${esc(E.fmtDay(E.weekRange(week).end, { month: "short", day: "numeric" }))}</span>
      <span class="spacer"></span>
      ${week === cur ? `<div class="pills" role="group" aria-label="Score mode"><button class="pill ${S.ui.matchupMode === "live" ? "on" : ""}" data-act="mmode" data-v="live">Live</button><button class="pill ${S.ui.matchupMode === "proj" ? "on" : ""}" data-act="mmode" data-v="proj">Projected</button></div>` : ""}
    </div>`;
  if (!mu) return header + `<div class="empty">${league.playoffs && week > league.settings.regularSeasonWeeks ? "No playoff matchup this week (bye or eliminated)." : "No matchup scheduled."}</div>` + leagueMatchups(league, week, ME().id);
  const A = E.teamById(league, mu.me);
  const B = E.teamById(league, mu.opp);
  const { start, end } = E.weekRange(week);
  const proj = week === cur && S.ui.matchupMode === "proj";
  const ta = E.teamWeekTotals(league, A.id, week);
  const tb = E.teamWeekTotals(league, B.id, week);
  const restA = E.projectRestOfWeek(league, A.id, week);
  const restB = E.projectRestOfWeek(league, B.id, week);
  const fa = E.addInto({ ...ta }, restA.totals);
  const fb = E.addInto({ ...tb }, restB.totals);
  const finalProj = E.compareTotals(league.settings.cats, fa, fb);
  const showProj = proj || league.currentDay < start;
  const pa = showProj ? fa : ta;
  const pb = showProj ? fb : tb;
  const res = E.compareTotals(league.settings.cats, pa, pb);
  const n = league.settings.cats.length;
  const done = league.currentDay > end;
  const shareA = done ? (res.wins > res.losses ? 1 : res.wins < res.losses ? 0 : 0.5) : (finalProj.wins + finalProj.ties / 2) / n;
  const status = done ? "Final" : league.currentDay < start ? "Upcoming" : showProj ? "Projected" : `Live · day ${league.currentDay - start + 1}/${end - start + 1}`;
  const gpA = E.gamesPlayedInWeek(league, A.id, week);
  const gpB = E.gamesPlayedInWeek(league, B.id, week);
  const catRows = res.rows.map((r) => {
    const c = CL[r.id];
    const fmt = (v) => E.formatCat(r.id, v == null ? null : c.type === "count" && showProj ? Math.round(v) : v);
    const mk = (t) => (c.type === "pct" ? `<span class="mk">${Math.round(t[c.num])}/${Math.round(t[c.den])}</span>` : "");
    return `<div class="mrow">
      <div class="mcell"><div class="cval ${r.result === 1 ? "win" : r.result === 0 ? "tie" : ""}">${fmt(r.a)}${mk(pa)}</div></div>
      <div class="mcircle">${c.label}</div>
      <div class="mcell r"><div class="cval ${r.result === -1 ? "win" : r.result === 0 ? "tie" : ""}">${mk(pb)}${fmt(r.b)}</div></div></div>`;
  }).join("");
  const dayDefault = Math.min(Math.max(league.currentDay < start ? start : league.currentDay - 1, start), end);
  const day = S.ui.day != null && S.ui.day >= start && S.ui.day <= end ? S.ui.day : dayDefault;
  return `${header}
  <div class="owners">
    ${ownerCard(league, A, false, res.wins, shareA, status)}
    <div class="vs">VS</div>
    ${ownerCard(league, B, true, res.losses, 1 - shareA, status)}
  </div>
  <div class="yet"><span>Games played <b>${gpA}</b> · left <b>${restA.games}</b></span><span>${res.ties ? `${res.ties} tied` : ""}</span><span>Games played <b>${gpB}</b> · left <b>${restB.games}</b></span></div>
  ${week === cur && !proj && !done ? swingCats(league, ta, tb, fa, fb) : ""}
  <div class="sec-h"><h2>Categories</h2><span class="note">${showProj ? "Projected final totals" : "Week totals"} · winner in teal</span></div>
  <div class="stack" style="gap:6px">${catRows}</div>
  <div class="sec-h"><h2>Starters</h2><span class="spacer"></span><div class="days">${dayChips(league, start, end, day)}</div></div>
  <div class="stack" style="gap:6px">${starterRows(league, A, B, day)}</div>
  <p class="note">Box scores are simulated from each player's real per-game averages (Basketball-Reference). In production they come from the live stat feed.</p>
  ${leagueMatchups(league, week, ME().id)}`;
}

function swingCats(league, ta, tb, fa, fb) {
  const out = [];
  for (const id of league.settings.cats) {
    const now = E.compareCat(id, ta, tb);
    const fin = E.compareCat(id, fa, fb);
    if (now !== fin) out.push({ id, now, fin });
  }
  if (!out.length) return "";
  const lab = (r) => (r === 1 ? "you" : r === -1 ? "them" : "tied");
  return `<div class="callout"><b>Swing categories</b> &nbsp;${out.map((o) => `${CL[o.id].label}: ${lab(o.now)} now → ${lab(o.fin)} projected`).join(" · ")}. Stream a player with games left to flip these.</div>`;
}

function dayChips(league, start, end, sel) {
  let s = "";
  for (let d = start; d <= end; d++)
    s += `<button class="day ${d === sel ? "on" : ""} ${d === league.currentDay ? "today" : ""}" data-act="day" data-v="${d}" title="${E.gamesOn(d, E.SCHEDULE_SEED).length} NBA games">${esc(E.fmtDay(d, { weekday: "short" }))} ${esc(E.fmtDay(d, { day: "numeric" }))}</button>`;
  return s;
}

function starterCell(league, team, id, slot, day, right) {
  if (!id) return `<div class="mcell ${right ? "r" : ""}"><span class="dim" style="font-size:12px">Empty</span></div>`;
  const p = P(id);
  const played = day < league.currentDay;
  const startedSet = played ? new Set((league.started[day] || {})[team.id] || []) : null;
  const starter = played ? startedSet.has(id) : E.isStarterSlot(slot) && E.canPlaySlot(p, slot);
  let line;
  if (played) {
    const g = E.gameLog(p, day, E.SCHEDULE_SEED);
    line = starter ? gameStat(g) : `<span class="stat dnp">${g ? esc(g.opp || "") + " · on bench" : "No game"}</span>`;
  } else {
    const opp = oppOn(p, day);
    line = opp ? `<span class="stat"><span class="opp">${esc(opp)}</span>${day === league.currentDay ? "Today" : "Upcoming"}</span>` : `<span class="stat dnp">No game</span>`;
  }
  return `<div class="mcell ${right ? "r" : ""} ${starter ? "" : "bench"}"><div class="prow">${pav(p, "sm")}<div class="who"><span class="pname" data-act="player" data-v="${id}">${esc(shortName(p))}</span>${pposLine(p)}</div></div>${line}</div>`;
}

function starterRows(league, A, B, day) {
  const slots = league.settings.slots;
  return slots.map((slot, i) => {
    if (slot === "IR" && !A.lineup[i] && !B.lineup[i]) return "";
    const color = { PG: "var(--c-pg)", SG: "var(--c-sg)", SF: "var(--c-sf)", PF: "var(--c-pf)", C: "var(--c-c)", BN: "var(--muted)", IR: "var(--pink)" }[slot] || "var(--teal)";
    return `<div class="mrow">${starterCell(league, A, A.lineup[i], slot, day, false)}<div class="mcircle" style="color:${color}">${slot}</div>${starterCell(league, B, B.lineup[i], slot, day, true)}</div>`;
  }).join("");
}

function leagueMatchups(league, week, meId) {
  const pairs = (league.matchups[week] || []).filter(([a, b]) => a !== meId && b !== meId);
  if (!pairs.length) return "";
  return `<div class="sec-h" style="margin-top:6px"><h2>League matchups</h2></div><div class="stack" style="gap:10px">${pairs.map(([a, b]) => miniMatch(league, week, a, b)).join("")}</div>`;
}
function miniMatch(league, week, a, b) {
  const A = E.teamById(league, a), B = E.teamById(league, b);
  const r = E.matchupResult(league, week, a, b);
  const n = league.settings.cats.length;
  const share = (r.wins + r.ties / 2) / n;
  const st = E.weekRange(week).end < league.currentDay ? "Final" : "Live";
  return `<div class="lmatch" data-act="goweek" data-v="${week}">${ownerCard(league, A, false, r.wins, share, st)}<div class="vs">VS</div>${ownerCard(league, B, true, r.losses, 1 - share, st)}</div>`;
}
