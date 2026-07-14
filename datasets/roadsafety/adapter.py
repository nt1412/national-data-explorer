"""Road-safety ingest adapter (per-dataset).

Reads the opencity state + city CSVs (MoRTH "Road Accidents in India", 2023 + 2024
editions), normalises to a per-region multi-year series, derives severity, and maps
each state to a DataMeet boundary polygon via a canonical-name crosswalk (the state
boundary file has no code — join is by name).

Output shape (generic enough for the engine's store):
  states : [{key, name, tier:'state', mapped, series:{indicator_id:{year:value}}}]
  cities : [{key, name, tier:'city',  series:{...}}]
  years  : sorted state years ;  city_years : sorted city years
  unmapped : state names with no 2011 polygon (e.g. Ladakh) — shown, never faked
"""
from __future__ import annotations
import csv, re, struct, os

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "data", "raw", "roadsafety")
STATES_DBF = os.path.join(ROOT, "data", "raw", "boundaries", "India-States.dbf")

# accident-data state name -> DataMeet boundary ST_NM (verified 2026-07-14)
ALIAS = {
    "Arunachal Pradesh": "Arunanchal Pradesh",
    "Andaman & Nicobar Islands": "Andaman & Nicobar Island",
    "Dadra & Nagar Haveli": "Dadara & Nagar Havelli",
    "Delhi": "NCT of Delhi",
    "J & K": "Jammu & Kashmir",
}
DROP = {"All India"}


def _canon(name):
    n = re.sub(r"[\*#]", "", name or "").strip()
    return ALIAS.get(n, n)


def _num(s):
    s = (s or "").replace(",", "").strip()
    if s in ("", "-", "NA", "na", "*"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _boundary_states():
    d = open(STATES_DBF, "rb").read()
    nr = struct.unpack("<I", d[4:8])[0]; hd = struct.unpack("<H", d[8:10])[0]; rs = struct.unpack("<H", d[10:12])[0]
    fs, p = [], 32
    while d[p] != 0x0D:
        fs.append((d[p:p + 11].split(b"\x00")[0].decode("latin1"), d[p + 16])); p += 32
    names = set()
    for i in range(nr):
        off = hd + i * rs; rec = d[off:off + rs]; q = 1; v = {}
        for nm, ln in fs:
            v[nm] = rec[q:q + ln].decode("latin1").strip(); q += ln
        names.add(v["ST_NM"])
    return names


def _read_wide_year(path, name_col, value_suffix):
    """A wide-by-year table -> {canonical_name: {year:int -> value}}."""
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    year_cols = {}
    for col in rows[0].keys() if rows else []:
        m = re.match(r"^(\d{4})\s+" + re.escape(value_suffix) + r"$", col.strip())
        if m:
            year_cols[int(m.group(1))] = col
    out = {}
    for r in rows:
        raw = r.get(name_col, "").strip()
        if not raw or raw in DROP:
            continue
        key = _canon(raw)
        d = out.setdefault(key, {})
        for yr, col in year_cols.items():
            v = _num(r.get(col))
            if v is not None:
                d[yr] = v
    return out


def _merge(a, b):
    """Merge two {name:{year:val}} dicts; later dict wins on year overlap."""
    out = {k: dict(v) for k, v in a.items()}
    for k, v in b.items():
        out.setdefault(k, {}).update(v)
    return out


def load():
    bset = _boundary_states()

    # states: accidents & deaths from both editions (2019-2023 + 2024)
    acc = _merge(_read_wide_year(os.path.join(RAW, "2023_state_acc.csv"), "State", "Accidents"),
                 _read_wide_year(os.path.join(RAW, "2024_state_acc.csv"), "State", "Accidents"))
    dth = _merge(_read_wide_year(os.path.join(RAW, "2023_state_fat.csv"), "State", "Killed"),
                 _read_wide_year(os.path.join(RAW, "2024_state_fat.csv"), "State", "Killed"))

    names = sorted(set(acc) | set(dth))
    years = sorted({y for d in acc.values() for y in d} | {y for d in dth.values() for y in d})

    states, unmapped = [], []
    for nm in names:
        a, d = acc.get(nm, {}), dth.get(nm, {})
        sev = {y: round(d[y] / a[y] * 100, 1) for y in a if y in d and a.get(y)}
        rec = dict(key=nm, name=nm, tier="state", mapped=nm in bset,
                   series=dict(accidents=a, deaths=d, severity=sev))
        states.append(rec)
        if nm not in bset:
            unmapped.append(nm)

    # cities (million-plus tier): accidents / killed / injured across editions
    cacc = _merge(_read_wide_year(os.path.join(RAW, "2023_cities.csv"), "City", "Accidents"),
                  _read_wide_year(os.path.join(RAW, "2024_cities.csv"), "City", "Accidents"))
    ckil = _merge(_read_wide_year(os.path.join(RAW, "2023_cities.csv"), "City", "Killed"),
                  _read_wide_year(os.path.join(RAW, "2024_cities.csv"), "City", "Killed"))
    cinj = _merge(_read_wide_year(os.path.join(RAW, "2023_cities.csv"), "City", "Injured"),
                  _read_wide_year(os.path.join(RAW, "2024_cities.csv"), "City", "Injured"))
    city_years = sorted({y for d in cacc.values() for y in d})
    cities = []
    for nm in sorted(set(cacc) | set(ckil)):
        a, k, inj = cacc.get(nm, {}), ckil.get(nm, {}), cinj.get(nm, {})
        sev = {y: round(k[y] / a[y] * 100, 1) for y in a if y in k and a.get(y)}
        cities.append(dict(key=nm, name=nm, tier="city",
                           series=dict(accidents=a, deaths=k, injured=inj, severity=sev)))

    return dict(states=states, cities=cities, years=years, city_years=city_years, unmapped=unmapped)
