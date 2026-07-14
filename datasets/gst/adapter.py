"""GST ingest adapter (per-dataset).

Parses Table 2 (pre/post-settlement SGST, FY 2023-24 & 2024-25) from the official GSTN
monthly PDF, maps each state to a DataMeet boundary polygon by canonical name, and derives
the producer<->consumer metrics. Source: GSTN "approved monthly GST data for publishing"
(Ministry of Finance). The settlement table is fiscal-year cumulative, not monthly.
"""
from __future__ import annotations
import re, os, json
import pdfplumber

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PDF = os.path.join(ROOT, "data", "raw", "gst", "gstn_mar_2025.pdf")
STATES_TOPO = os.path.join(ROOT, "web", "roadsafety", "data", "states.topo.json")

# accident/GST name -> DataMeet boundary ST_NM
ALIAS = {
    "Jammu and Kashmir": "Jammu & Kashmir",
    "Arunachal Pradesh": "Arunanchal Pradesh",
    "Andaman and Nicobar Islan": "Andaman & Nicobar Island",
    "Andaman and Nicobar Islands": "Andaman & Nicobar Island",
    "Delhi": "NCT of Delhi",
}
DROP = {"Grand Total", "Other Territory", "Total", "Centre", "Center", "State/UT"}

# Census 2011 population (persons). Used only for the per-capita (secondary) metrics;
# the headline uplift ratio is population-free. Labelled as Census-2011 in the UI.
POP_2011 = {
    "Uttar Pradesh": 199812341, "Maharashtra": 112374333, "Bihar": 104099452,
    "West Bengal": 91276115, "Madhya Pradesh": 72626809, "Tamil Nadu": 72147030,
    "Rajasthan": 68548437, "Karnataka": 61095297, "Gujarat": 60439692,
    "Andhra Pradesh": 49577103, "Odisha": 41974218, "Telangana": 35003674,
    "Kerala": 33406061, "Jharkhand": 32988134, "Assam": 31205576, "Punjab": 27743338,
    "Chhattisgarh": 25545198, "Haryana": 25351462, "NCT of Delhi": 16787941,
    "Jammu & Kashmir": 12267013, "Uttarakhand": 10086292, "Himachal Pradesh": 6864602,
    "Tripura": 3673917, "Meghalaya": 2966889, "Manipur": 2855794, "Nagaland": 1978502,
    "Goa": 1458545, "Arunanchal Pradesh": 1383727, "Mizoram": 1097206, "Sikkim": 610577,
    "Chandigarh": 1055450, "Puducherry": 1247953, "Andaman & Nicobar Island": 380581,
    "Lakshadweep": 64473, "Ladakh": 274000, "Goa ": 1458545,
}


def _canon(name):
    n = re.sub(r"\s+", " ", (name or "").replace("\n", " ")).strip()
    return ALIAS.get(n, n)


def _num(s):
    s = (s or "").replace(",", "").strip()
    return float(s) if re.fullmatch(r"-?\d+(\.\d+)?", s) else None


def _boundary_states():
    topo = json.load(open(STATES_TOPO))
    obj = list(topo["objects"].keys())[0]
    return set(str(g["properties"]["ST_NM"]) for g in topo["objects"][obj]["geometries"])


def load():
    bset = _boundary_states()
    with pdfplumber.open(PDF) as pdf:
        rows = pdf.pages[2].extract_tables()[0]

    states, unmapped = [], []
    nat_pre = nat_post = 0.0
    for r in rows:
        name = re.sub(r"\s+", " ", (r[0] or "").replace("\n", " ")).strip()
        if not name or name in DROP:
            continue
        pre_prev, pre = _num(r[1]), _num(r[2])     # pre-settlement 2023-24, 2024-25
        post_prev, post = _num(r[4]), _num(r[5])   # post-settlement 2023-24, 2024-25
        if pre is None or post is None:
            continue
        key = _canon(name)
        nat_pre += pre; nat_post += post
        pop = POP_2011.get(key)
        rec = dict(key=key, name=key, mapped=key in bset,
                   pre=pre, post=post, pre_prev=pre_prev, post_prev=post_prev,
                   net_settled=round(post - pre, 1), uplift=round(post / pre, 3) if pre else None,
                   yoy_post=round((post / post_prev - 1) * 100, 1) if post_prev else None,
                   pop=pop,
                   net_settled_percap=round((post - pre) * 1e7 / pop, 0) if pop else None,
                   accrued_percap=round(post * 1e7 / pop, 0) if pop else None,
                   own_percap=round(pre * 1e7 / pop, 0) if pop else None)
        states.append(rec)
        if key not in bset:
            unmapped.append(key)

    national = dict(pre=round(nat_pre, 0), post=round(nat_post, 0),
                    uplift=round(nat_post / nat_pre, 3))
    return dict(states=states, unmapped=unmapped, national=national,
                fy="2024-25", fy_prev="2023-24")
