// ------------------------------------------------------------------ events
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  const v = el.dataset.v;
  const league = L();
  if (a === "close-modal-bg") { if (ev.target === el) { S.modal = null; render(); } return; }
  if (el.tagName === "INPUT" && el.type === "checkbox") return; // handled on change
  if (el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type !== "checkbox")) return;
  if (el.tagName === "FORM") return;
  switch (a) {
    case "tab": S.tab = v; S.ui.moveFrom = null; if (v !== "team") S.ui.teamView = null; S.ui.chatOpen = false; render(); document.getElementById("view").scrollTop = 0; break;
    case "league": S.active = v; S.ui.week = null; S.ui.day = null; S.ui.teamView = null; S.ui.tradeWith = null; S.ui.tradeGive = []; S.ui.tradeGet = []; S.ui.chatOpen = false; save(); render(); runDraftBots(); break;
    case "wizard": S.modal = { type: "wizard" }; render(); break;
    case "settings": S.tab = "league"; S.ui.leagueSub = "settings"; render(); break;
    case "mockdraft": {
      S.tab = "draft";
      if (!league.draft && league.status === "inseason") {
        const kind = league.type === "dynasty" ? "rookie" : "startup";
        const order = kind === "rookie" ? E.standings(league).map((r) => r.team.id).reverse() : league.teams.map((t) => t.id);
        E.startDraft(league, kind, { sandbox: true, order, rounds: kind === "rookie" ? league.settings.rookieDraftRounds : 13 });
        save();
      }
      render(); runDraftBots(); break;
    }
    case "about": S.modal = { type: "about" }; render(); break;
    case "close-modal": S.modal = null; render(); break;
    case "chat-toggle": S.ui.chatOpen = !S.ui.chatOpen; render(); break;
    case "sim-day": act(() => { E.simulateDay(league); S.ui.day = null; S.ui.week = null; }, `Simulated ${E.fmtDay(league.currentDay)}`); break;
    case "sim-week": act(() => { const wk = E.currentWeek(league); const end = E.weekRange(wk).end; E.simulateTo(league, Math.min(end + 1, E.lastDay() + 1)); S.ui.day = null; S.ui.week = null; }, "Simulated to the end of the week"); break;
    case "week": S.ui.week = Number(v); S.ui.day = null; render(); break;
    case "mmode": S.ui.matchupMode = v; render(); break;
    case "day": S.ui.day = Number(v); render(); break;
    case "viewteam": S.ui.teamView = v || null; S.tab = "team"; S.ui.moveFrom = null; render(); break;
    case "player": S.modal = { type: "player", id: v }; render(); break;
    case "move-from": S.ui.moveFrom = Number(v); render(); break;
    case "move-cancel": S.ui.moveFrom = null; render(); break;
    case "move-to": { const from = S.ui.moveFrom; S.ui.moveFrom = null; act(() => E.setLineup(league, ME().id, from, Number(v))); break; }
    case "optimize": act(() => { const t = ME(); E.autoSetLineup(league, t, league.currentDay); t.manualDays = t.manualDays.filter((d) => d !== league.currentDay); }, "Lineup optimized for today"); break;
    case "promote": act(() => E.promoteFromTaxi(league, ME().id, v), "Promoted to active roster"); break;
    case "to-taxi": S.modal = null; act(() => E.moveToTaxi(league, ME().id, v), "Moved to taxi squad"); break;
    case "add": {
      const me = ME();
      if (E.rosterSpace(league, me) <= 0) { S.modal = { type: "drop", addId: v }; render(); }
      else { S.modal = null; act(() => E.addDrop(league, me.id, v, null), `Added ${P(v).name}`); }
      break;
    }
    case "add-drop": { const [add, drop] = v.split("|"); S.modal = null; act(() => E.addDrop(league, ME().id, add, drop), `Added ${P(add).name}, dropped ${P(drop).name}`); break; }
    case "drop": S.modal = null; act(() => E.addDrop(league, ME().id, null, v), `Dropped ${P(v).name}`); break;
    case "ppos": S.ui.pf.pos = v; S.ui.pf.limit = 60; render(); break;
    case "pbasis": S.ui.pf.basis = v; render(); break;
    case "psort": if (S.ui.pf.sort === v) S.ui.pf.dir *= -1; else { S.ui.pf.sort = v; S.ui.pf.dir = -1; } render(); break;
    case "pmore": S.ui.pf.limit += 60; render(); break;
    case "punt": { const s = new Set(S.ui.pf.punt); s.has(v) ? s.delete(v) : s.add(v); S.ui.pf.punt = [...s]; render(); break; }
    case "punt-clear": S.ui.pf.punt = []; render(); break;
    case "lsub": S.ui.leagueSub = v; render(); break;
    case "sweek": S.ui.schedWeek = Number(v); render(); break;
    case "goweek": S.ui.week = Number(v); S.ui.teamView = null; S.tab = "matchup"; S.ui.day = null; render(); break;
    case "trade-with": S.ui.tradeWith = v; S.ui.tradeGive = []; S.ui.tradeGet = []; S.tab = "trades"; render(); break;
    case "trade-for": { const o = E.ownerOf(league, v); S.modal = null; S.ui.tradeWith = o.id; S.ui.tradeGive = []; S.ui.tradeGet = [v]; S.tab = "trades"; render(); break; }
    case "trade-clear": S.ui.tradeGive = []; S.ui.tradeGet = []; render(); break;
    case "trade-propose": {
      const partner = E.teamById(league, S.ui.tradeWith);
      const ev2 = E.evaluateTrade(league, ME().id, partner.id, S.ui.tradeGive, S.ui.tradeGet);
      if (ev2.accept) {
        act(() => { E.executeTrade(league, ME().id, partner.id, S.ui.tradeGive, S.ui.tradeGet); league.chat.push({ kind: "msg", from: partner.id, day: league.currentDay, text: ev2.reason }); S.ui.tradeGive = []; S.ui.tradeGet = []; }, `${partner.owner} accepted!`);
      } else {
        league.chat.push({ kind: "msg", from: partner.id, day: league.currentDay, text: `Re: your offer — ${ev2.reason}` });
        save(); toast(`${partner.owner} declined: ${ev2.reason}`, "err"); render();
      }
      break;
    }
    case "offer-accept": {
      const o = league.tradeOffers.find((x) => x.id === v);
      act(() => { E.executeTrade(league, o.to, o.from, o.get, o.give); o.status = "accepted"; }, "Trade accepted");
      break;
    }
    case "offer-decline": { const o = league.tradeOffers.find((x) => x.id === v); o.status = "declined"; league.chat.push({ kind: "tx", day: league.currentDay, text: `${ME().name} declined a trade offer from ${E.teamById(league, o.from).name}` }); save(); render(); break; }
    case "offer-counter": { const o = league.tradeOffers.find((x) => x.id === v); o.status = "countered"; S.ui.tradeWith = o.from; S.ui.tradeGive = o.get.slice(); S.ui.tradeGet = o.give.slice(); save(); render(); toast("Offer loaded into the builder — adjust and propose", "ok"); break; }
    case "mock": {
      const kind = v;
      // rookie drafts go in reverse order of the current standings (worst team picks first)
      const order = kind === "rookie" ? E.standings(league).map((r) => r.team.id).reverse() : league.teams.map((t) => t.id);
      E.startDraft(league, kind, { sandbox: true, order, rounds: kind === "rookie" ? league.settings.rookieDraftRounds : 13 });
      S.ui.draftQ = ""; S.ui.draftPos = "ALL";
      save(); render(); runDraftBots();
      break;
    }
    case "draft-pick": act(() => E.makePick(league, v)); runDraftBots(); break;
    case "draft-advance": {
      const lg = league;
      while (lg.draft.status === "live" && E.onTheClock(lg).teamId !== ME().id) E.botPick(lg);
      save(); render(); break;
    }
    case "queue": { const q = league.draft.queue; const i = q.indexOf(v); i >= 0 ? q.splice(i, 1) : q.push(v); save(); render(); break; }
    case "dpos": S.ui.draftPos = v; render(); break;
    case "draft-finish": {
      clearTimeout(draftTimer);
      if (league.draft && league.draft.sandbox) { league.draft = null; save(); render(); break; }
      if (league.draft && league.draft.status === "done") {
        league.draftHistory = [{ kind: league.draft.kind, order: league.draft.order, picks: league.draft.picks }];
        league.draft = null;
        league._quietChat = true;
        for (const t of league.teams) E.autoSetLineup(league, t, 0);
        E.simulateTo(league, E.DEMO_TODAY, { quiet: true });
        league._quietChat = false;
        league.status = "inseason";
        league.chat.push({ kind: "system", day: league.currentDay, text: "Draft complete. The season has caught up to today — set your lineup!" });
        S.tab = "matchup"; save(); render();
      }
      break;
    }
    case "wiz": WIZ.name = (document.getElementById("wizname") || {}).value || WIZ.name; WIZ[el.dataset.k] = v; S.modal = { type: "wizard" }; render(); break;
    case "wiz-create": createFromWizard(); break;
    case "reset": try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } seed(); S.modal = null; S.tab = "matchup"; save(); render(); toast("Demo reset", "ok"); break;
  }
});

document.addEventListener("change", (ev) => {
  const el = ev.target;
  const a = el.dataset && el.dataset.act;
  const league = L();
  if (a === "autostart") act(() => { ME().autoStart = el.checked; });
  else if (a === "pstatus") { S.ui.pf.status = el.dataset.v; S.ui.pf.limit = 60; render(); }
  else if (a === "tg-give" || a === "tg-get") {
    const key = a === "tg-give" ? "tradeGive" : "tradeGet";
    const s = new Set(S.ui[key]);
    el.checked ? s.add(el.dataset.v) : s.delete(el.dataset.v);
    S.ui[key] = [...s];
    render();
  } else if (a === "trade-partner") { S.ui.tradeWith = el.value || null; S.ui.tradeGive = []; S.ui.tradeGet = []; render(); }
  else if (a === "draft-auto") { S.ui.draftAuto = el.checked; render(); runDraftBots(); }
  else if (a === "wizsel") { const k = el.dataset.k; WIZ[k] = k === "draftType" ? el.value : Number(el.value); WIZ.name = (document.getElementById("wizname") || {}).value || WIZ.name; render(); }
});

let inputTimer = null;
document.addEventListener("input", (ev) => {
  const el = ev.target;
  const a = el.dataset && el.dataset.act;
  if (a !== "pq" && a !== "dq") return;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(() => {
    if (a === "pq") { S.ui.pf.q = el.value; S.ui.pf.limit = 60; } else S.ui.draftQ = el.value;
    render();
    const again = document.getElementById(a === "pq" ? "pq" : "dq");
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }, 160);
});

document.addEventListener("submit", (ev) => {
  const form = ev.target.closest("[data-act='chat-send']");
  if (!form) return;
  ev.preventDefault();
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;
  const league = L();
  league.chat.push({ kind: "msg", from: ME().id, day: league.currentDay, text });
  save();
  render();
  const others = league.teams.filter((t) => !t.isUser);
  setTimeout(() => {
    const t = others[Math.floor(Math.random() * others.length)];
    league.chat.push({ kind: "msg", from: t.id, day: league.currentDay, text: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)] });
    save();
    render();
    const ci = document.getElementById("chatin");
    if (ci) ci.focus();
  }, 900);
  const ci = document.getElementById("chatin");
  if (ci) ci.focus();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && S.modal) { S.modal = null; render(); }
});
window.addEventListener("hashchange", () => { routeFromHash(); render(); });

function createFromWizard() {
  const name = ((document.getElementById("wizname") || {}).value || WIZ.name).trim() || "My 9-Cat League";
  const n = WIZ.teams;
  const botNames = ["Dime Droppers", "Glass Cleaners", "Swat Team", "Splash Zone", "Pickpockets", "FT Merchants", "Tank Commanders", "Rim Runners", "Board Men Get Paid", "No Punt Intended", "Late Game Lou", "Bench Mob", "Stocks & Blocks", "And-One Club", "Triple-Double Trouble"];
  const teams = [{ name: "Team Cory", owner: "Cory", isUser: true }, ...botNames.slice(0, n - 1).map((t, i) => ({ name: t, owner: "bot" + (i + 1) }))];
  const id = "lg" + Date.now().toString().slice(-6);
  const settings = { scoring: WIZ.scoring, cats: E.PRESETS[WIZ.preset].cats.slice(), preset: WIZ.preset, playoffTeams: WIZ.playoffs, draftType: WIZ.draftType };
  if (WIZ.type === "dynasty") Object.assign(settings, { taxiSlots: WIZ.taxi, rookieDraftRounds: WIZ.rookieRounds, futurePickYears: 2 });
  const lg = E.createLeague({ id, name, type: WIZ.type, teams, settings, seed: id });
  const order = E.shuffle(E.rngFor(id, "order"), lg.teams.map((t) => t.id));
  E.startDraft(lg, "startup", { order });
  lg.chat.push({ kind: "system", day: 0, text: `${name} created · ${E.SCORING_TYPES[WIZ.scoring].label} · ${E.PRESETS[WIZ.preset].label}. Draft is live!` });
  S.leagues[id] = lg;
  S.order.push(id);
  S.active = id;
  S.tab = "draft";
  S.modal = null;
  save();
  render();
  runDraftBots();
}

// ------------------------------------------------------------------ boot
if (!load()) seed();
routeFromHash();
render();
runDraftBots();
window.__h2h = { S, E, L };
