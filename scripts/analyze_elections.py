"""AI-psephologist analysis of the 2024 Lok Sabha result.

Computes a body of rigorous, cited findings from the candidate-level results
(data/raw/elections/results.csv, 8,902 rows) and the winners/runners-up table
(winners.csv, 543 seats). Prints a verifiable summary and writes findings.json.

Honesty rules: every number is computed from the data; alliance attribution is an
explicit, stated mapping (a few small parties are genuinely contested); we flag what
the data does NOT contain (turnout, electors, candidate gender/age).
"""
import csv, json, collections, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "data", "raw", "elections")
OUT = os.path.join(ROOT, "web", "psephology", "data")

def num(s):
    t = str(s).replace(",", "").strip()
    return int(t) if t.lstrip("-").isdigit() and t != "-" else 0
def f(s):
    try: return float(str(s).strip())
    except: return 0.0

R = list(csv.DictReader(open(os.path.join(RAW, "results.csv"), encoding="utf-8-sig")))
W = list(csv.DictReader(open(os.path.join(RAW, "winners.csv"), encoding="utf-8-sig")))

# alliance map (widely-reported 2024 classification → NDA 293 / INDIA 234 / Others 16)
NDA = {"Bharatiya Janata Party","Telugu Desam","Janata Dal  (United)","Shiv Sena",
 "Lok Janshakti Party(Ram Vilas)","Nationalist Congress Party","Janata Dal  (Secular)",
 "Rashtriya Lok Dal","Janasena Party","Asom Gana Parishad","Apna Dal (Soneylal)",
 "Hindustani Awam Morcha (Secular)","United People’s Party, Liberal","AJSU Party",
 "Sikkim Krantikari Morcha"}
INDIA = {"Indian National Congress","Samajwadi Party","All India Trinamool Congress",
 "Dravida Munnetra Kazhagam","Shiv Sena (Uddhav Balasaheb Thackrey)",
 "Nationalist Congress Party – Sharadchandra Pawar","Rashtriya Janata Dal",
 "Communist Party of India  (Marxist)","Indian Union Muslim League","Aam Aadmi Party",
 "Jharkhand Mukti Morcha","Communist Party of India  (Marxist-Leninist)  (Liberation)",
 "Viduthalai Chiruthaigal Katchi","Communist Party of India",
 "Jammu & Kashmir National Conference","Revolutionary Socialist Party","Kerala Congress",
 "Marumalarchi Dravida Munnetra Kazhagam","Bharat Adivasi Party","Rashtriya Loktantrik Party"}
def alliance(p): return "NDA" if p in NDA else ("INDIA" if p in INDIA else "OTH")

# ---- per-PC aggregates from candidate rows ----
pc = collections.defaultdict(list)
for r in R: pc[(r["State"], r["PC No"])].append(r)

pc_total = {}          # total votes per PC (incl NOTA)
pc_nota = {}           # NOTA votes per PC
for k, rows in pc.items():
    pc_total[k] = sum(num(x["Total Votes"]) for x in rows)
    nota = [x for x in rows if x["Candidate"].strip().upper() == "NOTA"]
    pc_nota[k] = num(nota[0]["Total Votes"]) if nota else 0

cand_rows = [x for x in R if x["Candidate"].strip().upper() != "NOTA"]  # real candidates

# ---- overview ----
overview = dict(
    seats=len(W), candidates=len(cand_rows),
    avg_cands=round(len(cand_rows)/len(W), 1),
    max_cands=max(len(v)-(1 if any(x["Candidate"].strip().upper()=="NOTA" for x in v) else 0) for v in pc.values()),
    uncontested=sum(1 for w in W if w["Results Status"].strip().lower()=="uncontested"),
    total_votes=sum(pc_total.values()),
)

# ---- alliance & party seat tallies ----
seats_by_party = collections.Counter(w["Winning Party"] for w in W)
seats_by_alliance = collections.Counter(alliance(w["Winning Party"]) for w in W)

# ---- national vote share by alliance vs seat share (disproportionality) ----
votes_by_alliance = collections.Counter()
votes_by_party = collections.Counter()
valid_total = 0
for x in cand_rows:
    v = num(x["Total Votes"]); votes_by_party[x["Party"]] += v
    votes_by_alliance[alliance(x["Party"])] += v; valid_total += v
disprop = {a: dict(seats=seats_by_alliance[a], seat_pct=round(100*seats_by_alliance[a]/len(W),1),
                   vote_pct=round(100*votes_by_alliance[a]/valid_total,1))
           for a in ("NDA","INDIA","OTH")}
# Gallagher least-squares index over alliances
gallagher = round((0.5*sum((disprop[a]["vote_pct"]-disprop[a]["seat_pct"])**2 for a in disprop))**0.5, 1)

# ---- margins (votes and % of PC total votes) ----
margins = []
for w in W:
    k = (w["State"], w["PC No"])
    m = num(w["Margin Votes"]); tot = pc_total.get(k, 0)
    margins.append(dict(state=w["State"], pc=w["PC Name"], winner=w["Winning Candidate"],
        party=w["Winning Party"], mvotes=m, mpct=round(100*m/tot,2) if tot else None,
        nota=pc_nota.get(k,0)))
declared = [m for m in margins if m["mvotes"] > 0 or True]
closest = sorted([m for m in margins if m["mvotes"]>0], key=lambda x:x["mvotes"])[:12]
widest = sorted(margins, key=lambda x:-x["mvotes"])[:8]
under = lambda p: sum(1 for m in margins if m["mpct"] is not None and m["mpct"]<p and m["mvotes"]>0)
margin_bands = dict(under_1pct=under(1), under_5pct=under(5), under_10pct=under(10),
    under_1000_votes=sum(1 for m in margins if 0<m["mvotes"]<1000),
    under_100_votes=sum(1 for m in margins if 0<m["mvotes"]<100))

# ---- NOTA ----
total_nota = sum(pc_nota.values())
nota_share = round(100*total_nota/overview["total_votes"], 2)
nota_top = sorted([dict(state=w["State"],pc=w["PC Name"],nota=pc_nota[(w["State"],w["PC No"])],
    notapct=round(100*pc_nota[(w["State"],w["PC No"])]/pc_total[(w["State"],w["PC No"])],2)
            if pc_total[(w["State"],w["PC No"])] else 0)
    for w in W], key=lambda x:-x["nota"])[:10]
# seats where NOTA exceeded the victory margin
nota_gt_margin = sorted([m for m in margins if m["mvotes"]>0 and m["nota"]>m["mvotes"]],
    key=lambda x:x["mvotes"])

# ---- forfeited deposits (< 1/6 of valid votes ≈ vote share < 16.67%) ----
THR = 100/6
forfeits = [x for x in cand_rows if f(x["Vote Share"]) < THR]
forfeit_by_party = collections.Counter(x["Party"] for x in forfeits)
inds = [x for x in cand_rows if x["Party"].strip()=="Independent"]
ind_forfeit = sum(1 for x in inds if f(x["Vote Share"])<THR)

# ---- postal-ballot decisiveness: margin smaller than postal votes cast in the seat ----
pc_postal = {k: sum(num(x["Postal Votes"]) for x in rows) for k,rows in pc.items()}
postal_decisive = sorted([dict(state=w["State"],pc=w["PC Name"],margin=num(w["Margin Votes"]),
    postal=pc_postal[(w["State"],w["PC No"])])
    for w in W if 0<num(w["Margin Votes"])<pc_postal.get((w["State"],w["PC No"]),0)],
    key=lambda x:x["margin"])

# ---- winner-vs-runner alliance matchups ----
matchup = collections.Counter((alliance(w["Winning Party"]), alliance(w["Runner-up Party"])) for w in W)

findings = dict(
    overview=overview,
    seats_by_alliance=dict(seats_by_alliance), disproportionality=disprop, gallagher_index=gallagher,
    seats_by_party=seats_by_party.most_common(20),
    margin_bands=margin_bands, closest=closest, widest=widest,
    nota=dict(total=total_nota, share_pct=nota_share, top=nota_top,
              seats_nota_gt_margin=len(nota_gt_margin), nota_gt_margin=nota_gt_margin[:10]),
    deposits=dict(forfeited=len(forfeits), of_candidates=len(cand_rows),
        forfeit_pct=round(100*len(forfeits)/len(cand_rows),1),
        independents=len(inds), independents_forfeited=ind_forfeit,
        ind_forfeit_pct=round(100*ind_forfeit/len(inds),1),
        by_party=forfeit_by_party.most_common(8)),
    postal=dict(decisive_seats=len(postal_decisive), examples=postal_decisive[:8]),
    matchups=[(f"{a} beat {b}", n) for (a,b),n in matchup.most_common()],
    caveats=["Alliance attribution is an explicit editorial mapping (NDA 293 / INDIA 234 / Others 16); "
             "a few small parties (e.g. RLP, BAP, TMC's bloc status) are genuinely contested.",
             "Deposit-forfeit uses vote share < 1/6 (16.67%) as a proxy for the <1/6-of-valid-votes rule.",
             "This dataset has no turnout/electors or candidate gender/age — those analyses are out of scope here."])

os.makedirs(OUT, exist_ok=True)
json.dump(findings, open(os.path.join(OUT, "findings.json"), "w"), ensure_ascii=False, separators=(",",":"), default=str)

# ---- printed verification summary ----
p = print
p("=== OVERVIEW ==="); p(overview)
p("\n=== ALLIANCE (seats / seat% / vote%) ===")
for a in ("NDA","INDIA","OTH"): p(f"  {a}: {disprop[a]}")
p(f"  Gallagher disproportionality index: {gallagher}")
p("\n=== MARGIN BANDS ==="); p("  "+str(margin_bands))
p("  closest 5:"); [p(f"    {m['pc']} ({m['party'][:22]}) — {m['mvotes']:,} votes ({m['mpct']}%)") for m in closest[:5]]
p("\n=== NOTA ==="); p(f"  total {total_nota:,} ({nota_share}% of all votes); seats where NOTA > victory margin: {len(nota_gt_margin)}")
p(f"  highest NOTA: {nota_top[0]['pc']} {nota_top[0]['nota']:,} ({nota_top[0]['notapct']}%)")
p("\n=== DEPOSITS FORFEITED ==="); p(f"  {len(forfeits):,} of {len(cand_rows):,} candidates ({findings['deposits']['forfeit_pct']}%) lost deposits; "
  f"independents {ind_forfeit}/{len(inds)} ({findings['deposits']['ind_forfeit_pct']}%)")
p("\n=== POSTAL DECISIVE (margin < postal votes in seat): "+str(len(postal_decisive))+" seats ===")
p("\n=== MATCHUPS ==="); [p(f"  {k}: {n}") for k,n in findings['matchups']]
p("\nwrote web/psephology/data/findings.json")
