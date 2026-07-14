"""NFHS ingest adapter (per-dataset).

Reads the both-rounds district CSV and the DataMeet 2011 boundary .dbf, then produces
normalised frames the shared engine can store:

  districts      : one row per NFHS district, with the national census_code attached
                   via the COMPOSITE (ST_CEN_CD, DT_CEN_CD) join, and a `comparable` flag.
  observations   : long form (census_code, round, indicator_id, value, low_sample).

Only the CORE indicators are kept. Every configured indicator string is asserted present
so a source change fails loudly instead of silently dropping a metric.
"""
from __future__ import annotations
import csv, struct, os
from .indicators import CORE, BY_CSV

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CSV_PATH = os.path.join(ROOT, "data", "raw", "nfhs", "India.csv")
DBF_PATH = os.path.join(ROOT, "data", "raw", "boundaries", "India-Districts-2011Census.dbf")


def _read_dbf(path):
    """Minimal DBF reader (no deps) → list of dict rows."""
    d = open(path, "rb").read()
    numrec = struct.unpack("<I", d[4:8])[0]
    hdr = struct.unpack("<H", d[8:10])[0]
    rs = struct.unpack("<H", d[10:12])[0]
    fields, p = [], 32
    while d[p] != 0x0D:
        name = d[p:p + 11].split(b"\x00")[0].decode("latin1")
        length = d[p + 16]
        fields.append((name, length))
        p += 32
    out = []
    for i in range(numrec):
        off = hdr + i * rs
        rec = d[off:off + rs]
        vals, q = {}, 1
        for name, length in fields:
            vals[name] = rec[q:q + length].decode("latin1").strip()
            q += length
        out.append(vals)
    return out


def _num(s):
    s = (s or "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load():
    # --- boundary spine: composite (ST_CEN_CD, DT_CEN_CD) -> national censuscode ---
    poly = {}
    for r in _read_dbf(DBF_PATH):
        poly[(r["ST_CEN_CD"], r["DT_CEN_CD"])] = r["censuscode"]

    rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))

    # assert every configured indicator string exists in the source
    present = set(r["Indicator"] for r in rows)
    missing = [ind["csv"] for ind in CORE if ind["csv"] not in present]
    if missing:
        raise SystemExit("Indicator string(s) not found in source CSV:\n  " + "\n  ".join(map(repr, missing)))

    districts = {}   # census_code -> district row  (comparable only)
    no_baseline = {} # (st,dt,name) -> state        (NFHS district with no 2011 polygon)
    observations = []

    for r in rows:
        ind = BY_CSV.get(r["Indicator"])
        if ind is None:
            continue  # not a core indicator
        st, dt = r["ST_CEN_CD"].strip(), r["DT_CEN_CD"].strip()
        code = poly.get((st, dt))
        name, state = r["District"].strip(), r["State"].strip()
        if code is None:
            no_baseline[(st, dt, name)] = state
            continue  # new/split district — carried separately, never graded
        districts.setdefault(code, dict(census_code=code, name=name, state=state,
                                        st_cen_cd=st, dt_cen_cd=dt, comparable=True))
        for rnd, col in (("nfhs4", "NFHS 4"), ("nfhs5", "NFHS 5")):
            v = _num(r.get(col))
            if v is not None:
                observations.append(dict(census_code=code, round=rnd,
                                         indicator_id=ind["id"], value=v, low_sample=False))

    return {
        "districts": list(districts.values()),
        "observations": observations,
        "indicators": CORE,
        "no_baseline": [dict(st_cen_cd=k[0], dt_cen_cd=k[1], name=k[2], state=v)
                        for k, v in no_baseline.items()],
        "poly_codes": set(poly.values()),
    }
