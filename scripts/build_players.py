"""Build data/players.js from Basketball-Reference per-game exports.

Sources (copied from basketball-reference.com league per-game tables, fetched 2026-10-31):
  data/raw/bbref_2025-26_per_game.csv   full 2025-26 regular season
  data/raw/bbref_2026-27_per_game.csv   2026-27 season to date (~4-6 games per player)
  data/raw/bbref_2024-25_fallback.csv   2024-25 lines for players who missed most of 2025-26

Projection used by the engine (per game):
  base  = 2025-26 line if G >= 25, else 2024-25 fallback, else 2025-26
  proj  = blend(base, 2026-27) with weight w = G27 / (G27 + 12) on 2026-27
  rookies (no prior NBA line) use their 2026-27 line as-is.
"""
import csv, json, re, unicodedata, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
KEYS = ["g", "min", "fgm", "fga", "tpm", "ftm", "fta", "reb", "ast", "stl", "blk", "to", "pts"]
COLS = ["G", "MP", "FG", "FGA", "3P", "FT", "FTA", "TRB", "AST", "STL", "BLK", "TOV", "PTS"]
TEAM_FIX = {"CHO": "CHA", "BRK": "BKN", "PHO": "PHX"}  # bbref -> common/Sleeper abbreviations

DRAFT_2026 = [  # NBA.com "Every pick from the 2026 NBA Draft First Round" (team = original pick owner)
    ("AJ Dybantsa", "BYU"), ("Darryn Peterson", "Kansas"), ("Cameron Boozer", "Duke"),
    ("Caleb Wilson", "North Carolina"), ("Keaton Wagler", "Illinois"), ("Mikel Brown Jr.", "Louisville"),
    ("Darius Acuff Jr.", "Arkansas"), ("Kingston Flemings", "Houston"), ("Morez Johnson Jr.", "Michigan"),
    ("Brayden Burries", "Arizona"), ("Yaxel Lendeborg", "Michigan"), ("Aday Mara", "Michigan"),
    ("Nate Ament", "Tennessee"), ("Hannes Steinbach", "Washington"), ("Dailyn Swain", "Texas"),
    ("Bennett Stirtz", "Iowa"), ("Ebuka Okorie", "Stanford"), ("Christian Anderson", "Texas Tech"),
    ("Allen Graves", "Santa Clara"), ("Jayden Quaintance", ""), ("Karim López", "New Zealand Breakers"),
    ("Labaron Philon Jr.", "Alabama"), ("Zuby Ejiofor", "St. John's"), ("Cameron Carr", "Baylor"),
    ("Sergio De Larrea", "Valencia"), ("Tarris Reed Jr.", "Connecticut"), ("Chris Cenac Jr.", "Houston"),
    ("Joshua Jefferson", "Iowa State"), ("Alex Karaban", "Connecticut"), ("Koa Peat", "Arizona"),
]
CLASS_2025 = {"Cooper Flagg", "Dylan Harper", "VJ Edgecombe", "Kon Knueppel", "Ace Bailey", "Tre Johnson",
              "Jeremiah Fears", "Egor Dëmin", "Cedric Coward", "Derik Queen", "Nolan Traoré",
              "Kasparas Jakučionis", "Will Riley", "Maxime Raynaud"}
PROSPECT_POS = {"AJ Dybantsa": ["SF"], "Kingston Flemings": ["PG"], "Morez Johnson Jr.": ["PF", "C"],
                "Brayden Burries": ["SG"], "Aday Mara": ["C"], "Nate Ament": ["SF", "PF"],
                "Hannes Steinbach": ["PF", "C"], "Dailyn Swain": ["SF"], "Bennett Stirtz": ["PG"],
                "Ebuka Okorie": ["PG"], "Christian Anderson": ["PG"], "Allen Graves": ["PF"],
                "Jayden Quaintance": ["C"], "Karim López": ["SF"], "Labaron Philon Jr.": ["PG"],
                "Zuby Ejiofor": ["PF", "C"], "Cameron Carr": ["SG"], "Sergio De Larrea": ["PG"],
                "Tarris Reed Jr.": ["C"], "Chris Cenac Jr.": ["PF", "C"], "Joshua Jefferson": ["PF"],
                "Alex Karaban": ["PF"], "Koa Peat": ["PF"]}


def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def read(path):
    """Return {name: {"line": stats, "team": latest team, "age": int, "pos": [..]}} using the
    combined row for multi-team players and the last split row for their latest team."""
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r["PTS"]:
                continue
            name = r["Player"]
            team = TEAM_FIX.get(r["Team"], r["Team"])
            line = {k: float(r[c]) for k, c in zip(KEYS, COLS)}
            line["g"] = int(line["g"])
            if name in out:  # split row of a multi-team player -> just update latest team
                out[name]["team"] = team
                if r["Pos"] not in out[name]["pos"]:
                    out[name]["pos"].append(r["Pos"])
                continue
            out[name] = {"line": line, "team": None if re.match(r"\dTM", team) else team,
                         "age": int(r["Age"]), "pos": [r["Pos"]]}
    return out


def blend(a, b, w):
    o = {k: round(a[k] * (1 - w) + b[k] * w, 2) for k in KEYS if k != "g"}
    return o


s25, s27, s24 = read(RAW / "bbref_2025-26_per_game.csv"), read(RAW / "bbref_2026-27_per_game.csv"), read(RAW / "bbref_2024-25_fallback.csv")
draft_idx = {n: i + 1 for i, (n, _) in enumerate(DRAFT_2026)}
schools = dict(DRAFT_2026)

players = []
for name in sorted(set(s25) | set(s27) | set(draft_idx)):
    a, b, c = s25.get(name), s27.get(name), s24.get(name)
    pos = []
    for src in (b, a, c):
        if src:
            for p in src["pos"]:
                if p not in pos:
                    pos.append(p)
    if not pos:
        pos = PROSPECT_POS.get(name, ["SF"])
    if name in draft_idx:
        exp, rookie_note = 0, f"2026 Draft · Pick {draft_idx[name]} · {schools[name] or '—'}"
    elif name in CLASS_2025:
        exp, rookie_note = 1, "2025 Draft class"
    elif b and not a and not c and b["age"] <= 21:
        exp, rookie_note = 0, "2026 rookie"
    else:
        exp, rookie_note = 2, None

    base, base_label = None, None
    if a and a["line"]["g"] >= 25:
        base, base_label = a["line"], "2025-26"
    elif c:
        base, base_label = c["line"], "2024-25"
    elif a:
        base, base_label = a["line"], "2025-26"
    if base and b:
        w = b["line"]["g"] / (b["line"]["g"] + 12)
        proj, proj_src = blend(base, b["line"], w), f"{base_label} blended with 2026-27 ({int(round(w*100))}% weight)"
    elif base:
        proj, proj_src = {k: base[k] for k in KEYS if k != "g"}, f"{base_label} per-game"
    elif b:
        proj, proj_src = {k: b["line"][k] for k in KEYS if k != "g"}, "2026-27 per-game to date"
    else:
        proj, proj_src = None, "No NBA stats in source yet"

    team = (b and b["team"]) or (a and a["team"]) or (c and c["team"]) or None
    team_src = "2026-27" if b and b["team"] else ("2025-26 (latest listed)" if team else None)
    age = (b["age"] if b else (a["age"] + 1 if a else (c["age"] + 2 if c else (19 if name in draft_idx else None))))
    players.append({
        "id": slug(name), "sleeper_id": None, "name": name, "team": team, "teamSource": team_src,
        "pos": pos, "age": age, "exp": exp, "note": rookie_note,
        "s2627": b["line"] if b else None, "s2526": a["line"] if a else None,
        "s2425": c["line"] if c else None, "proj": proj, "projSource": proj_src,
    })

meta = {
    "source": "Basketball-Reference.com league per-game tables (2024-25 fallback, 2025-26, 2026-27 to date) and NBA.com 2026 draft results",
    "fetched": "2026-10-31",
    "note": "Per-game averages are real. Day-by-day game logs in the demo are simulated from these averages.",
    "count": len(players),
}
js = "// AUTO-GENERATED by scripts/build_players.py — do not edit by hand.\n"
js += "export const PLAYER_META = " + json.dumps(meta, ensure_ascii=False) + ";\n"
js += "export const PLAYERS = " + json.dumps(players, ensure_ascii=False, separators=(",", ":")) + ";\n"
(ROOT / "data" / "players.js").write_text(js, encoding="utf-8")
(ROOT / "data" / "players.json").write_text(json.dumps({"meta": meta, "players": players}, ensure_ascii=False, indent=1), encoding="utf-8")
print(meta["count"], "players;", sum(1 for p in players if p["proj"]), "with projections;",
      sum(1 for p in players if p["exp"] == 0), "2026 rookies;", sum(1 for p in players if not p["team"]), "no team")
