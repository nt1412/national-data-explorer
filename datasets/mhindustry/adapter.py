"""Maharashtra district-industry ingest adapter (per-dataset).

Reads the Economic Survey of Maharashtra "District-wise Indicators" CSV, joins each
district to its 2011 census code (name crosswalk — the state renamed districts in 2023),
and attaches NFHS-5 child stunting so the surface can plot industry vs. health.
"""
from __future__ import annotations
import csv, json, os, re, struct
from .indicators import METRICS

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
IND_CSV = os.path.join(ROOT, "data", "raw", "maharashtra", "mh_district_indicators_2023-24.csv")
DBF = os.path.join(ROOT, "data", "raw", "boundaries", "India-Districts-2011Census.dbf")
NFHS = os.path.join(ROOT, "web", "nfhs", "data", "district_change.json")

# Economic-Survey district name -> DataMeet 2011 census name (2023 renamings + spellings).
# Palghar was carved out in 2014 -> no 2011 polygon -> dropped (reported as unmapped).
ALIAS = {
    "Mumbai City": "Mumbai", "Ahilyanagar": "Ahmadnagar",
    "Chhatrapti Sambhajinagar": "Aurangabad", "Chhatrapati Sambhajinagar": "Aurangabad",
    "Beed": "Bid", "Dharashiv": "Osmanabad", "Buldhana": "Buldana",
    "Raigad": "Raigarh", "Gadchiroli": "Garhchiroli",
}
DROP = {"Palghar"}


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _num(s):
    s = re.sub(r"[,\^\#\$\*]", "", (s or "")).strip()
    if s in ("", "-", "NA", "na"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _mh_codes():
    d = open(DBF, "rb").read()
    nr = struct.unpack("<I", d[4:8])[0]; hd = struct.unpack("<H", d[8:10])[0]; rs = struct.unpack("<H", d[10:12])[0]
    fs, q = [], 32
    while d[q] != 0x0D:
        fs.append((d[q:q + 11].split(b"\x00")[0].decode("latin1"), d[q + 16])); q += 32
    out = {}
    for i in range(nr):
        o = hd + i * rs; rec = d[o:o + rs]; v = {}; p = 1
        for nm, ln in fs:
            v[nm] = rec[p:p + ln].decode("latin1").strip(); p += ln
        if v["ST_CEN_CD"] == "27":
            out[_norm(v["DISTRICT"])] = (v["censuscode"], v["DISTRICT"])
    return out


def _stunting_by_code():
    d = json.load(open(NFHS))
    out = {}
    for dist in d["districts"]:
        c = dist.get("cells", {}).get("stunting", {})
        if c.get("v5") is not None:
            out[str(dist["code"])] = c["v5"]
    return out


def load():
    rows = list(csv.DictReader(open(IND_CSV, encoding="utf-8-sig")))
    headers = rows[0].keys() if rows else []
    # resolve each metric to its actual source column via normalised token match
    colmap = {}
    for m in METRICS:
        match = next((h for h in headers if all(t in _norm(h) for t in m["tokens"])), None)
        if match is None:
            raise SystemExit(f"column not found for {m['id']} (tokens {m['tokens']})")
        colmap[m["id"]] = match

    codes = _mh_codes()
    stunting = _stunting_by_code()
    districts, unmapped = [], []
    for r in rows:
        name = (r.get("District") or "").strip()
        if not name or name in DROP or "includes" in name.lower():
            if name in DROP:
                unmapped.append(name)
            continue
        dm = ALIAS.get(name, name)
        hit = codes.get(_norm(dm))
        if not hit:
            unmapped.append(name)
            continue
        code, dm_name = hit
        rec = dict(name=name, census_code=code)
        for m in METRICS:
            rec[m["id"]] = _num(r.get(colmap[m["id"]]))
        rec["stunting"] = stunting.get(str(code))
        districts.append(rec)

    return dict(districts=districts, unmapped=unmapped, metrics=METRICS, colmap=colmap)
