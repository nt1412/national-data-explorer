"""Build the Maharashtra infrastructure overlay layer from raw OSM + OurAirports.

Input : data/raw/infra/osm.json (Overpass), data/raw/infra/airports.csv (OurAirports)
Output: web/shared/data/mh_infra.json  (industrial centroids, malls, airports as points)

OSM (ODbL) layers are kept in this one file so the share-alike obligation stays isolable
from the rest of the project. Run scripts/build_infra.sh which fetches then calls this.
"""
import json, csv, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "data", "raw", "infra")
OUT = os.path.join(ROOT, "web", "shared", "data", "mh_infra.json")

# OurAirports codes Maharashtra as IN-MM (not the ISO IN-MH used by OSM).
AIRPORT_REGION = "IN-MM"
AIRPORT_TYPES = ("large_airport", "medium_airport")


def _pt(e):
    if "center" in e:
        return e["center"]["lon"], e["center"]["lat"]
    if "lon" in e:
        return e["lon"], e["lat"]
    return None


def main():
    osm = json.load(open(os.path.join(RAW, "osm.json")))
    industrial, malls = [], []
    for e in osm.get("elements", []):
        t = e.get("tags", {})
        c = _pt(e)
        if not c:
            continue
        rec = {"lon": round(c[0], 5), "lat": round(c[1], 5), "name": t.get("name", "")}
        if t.get("landuse") == "industrial":
            industrial.append(rec)
        elif t.get("shop") == "mall":
            malls.append(rec)

    airports = []
    for r in csv.DictReader(open(os.path.join(RAW, "airports.csv"), encoding="utf-8")):
        if r.get("iso_region") == AIRPORT_REGION and r["type"] in AIRPORT_TYPES:
            airports.append({"lon": round(float(r["longitude_deg"]), 5),
                             "lat": round(float(r["latitude_deg"]), 5),
                             "name": r["name"], "iata": r.get("iata_code", ""), "type": r["type"]})

    doc = dict(
        region="Maharashtra",
        attribution="Industrial areas & malls © OpenStreetMap contributors (ODbL). Airports: OurAirports (public domain).",
        note="OpenStreetMap coverage is uneven — denser where mappers are active (metros), thinner in small towns. "
             "These are mapped LOCATIONS, not a measure of economic intensity.",
        counts=dict(industrial=len(industrial), malls=len(malls), airports=len(airports)),
        industrial=industrial, malls=malls, airports=airports,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {os.path.relpath(OUT, ROOT)} — industrial {len(industrial)}, malls {len(malls)}, airports {len(airports)}")


if __name__ == "__main__":
    main()
