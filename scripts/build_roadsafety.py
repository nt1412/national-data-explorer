"""Build the road-safety dataset: ingest -> per-region multi-year series + period change
(reusing the shared unit-aware change logic) -> one web JSON. Prints a join-check report.

Run: python scripts/build_roadsafety.py
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datasets.roadsafety import adapter
from datasets.roadsafety.indicators import STATE_INDICATORS, CITY_INDICATORS
from engine.change import change_value, improved

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "web", "roadsafety", "data")


def period_change(series, polarity):
    """Change from earliest to latest year present, via the shared change logic."""
    yrs = sorted(series)
    if len(yrs) < 2:
        return None
    y0, y1 = yrs[0], yrs[-1]
    ch = change_value(series[y0], series[y1])
    return dict(fromYear=y0, toYear=y1, **{"from": series[y0], "to": series[y1],
                "change": ch, "improved": improved(ch, polarity)})


def main():
    os.makedirs(WEB, exist_ok=True)
    data = adapter.load()
    pol = {i["id"]: i["polarity"] for i in STATE_INDICATORS}

    mapped = [s for s in data["states"] if s["mapped"]]
    print("== road-safety ingest + join check ==")
    print(f"years (states): {data['years']}   years (cities): {data['city_years']}")
    print(f"states total   : {len(data['states'])}")
    print(f"  mapped to polygon : {len(mapped)}")
    print(f"  unmapped (shown, not on map): {data['unmapped']}")
    print(f"cities         : {len(data['cities'])}")

    def pack(regions, inds):
        out = []
        for r in regions:
            ch = {}
            for ind in inds:
                s = r["series"].get(ind["id"], {})
                pc = period_change(s, pol.get(ind["id"], ind["polarity"]))
                if pc:
                    ch[ind["id"]] = pc
            out.append(dict(key=r["key"], name=r["name"], mapped=r.get("mapped", True),
                            series=r["series"], change=ch))
        return out

    doc = dict(
        meta=dict(
            years=data["years"], cityYears=data["city_years"],
            defaultIndicator="severity", defaultView="year", defaultYear=data["years"][-1],
            attribution="Data: MoRTH / Transport Research Wing — Road Accidents in India (2023, 2024). Boundaries: DataMeet, CC-BY.",
            note="Severity = road deaths per 100 accidents (a rate: dangerous, not merely busy). "
                 "Raw accident/death counts are NOT population- or vehicle-normalised — big states top count lists by size. "
                 "Per-lakh and per-10,000-vehicle rates are a planned fast-follow (need state denominators).",
        ),
        indicators=[{k: i[k] for k in ("id", "label", "unit", "polarity", "category")} for i in STATE_INDICATORS],
        cityIndicators=[{k: i[k] for k in ("id", "label", "unit", "polarity", "category")} for i in CITY_INDICATORS],
        states=pack(data["states"], STATE_INDICATORS),
        cities=pack(data["cities"], CITY_INDICATORS),
        unmapped=data["unmapped"],
    )
    path = os.path.join(WEB, "road.json")
    json.dump(doc, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {os.path.relpath(path, ROOT)}  ({os.path.getsize(path)} bytes)")

    # sample: national severity trend (sanity)
    tot_a = {y: 0 for y in data["years"]}; tot_d = {y: 0 for y in data["years"]}
    for s in data["states"]:
        for y, v in s["series"].get("accidents", {}).items(): tot_a[y] = tot_a.get(y, 0) + v
        for y, v in s["series"].get("deaths", {}).items(): tot_d[y] = tot_d.get(y, 0) + v
    print("national severity (deaths/100 accidents) by year:")
    for y in data["years"]:
        if tot_a.get(y):
            print(f"  {y}: {tot_d[y] / tot_a[y] * 100:.1f}   (acc {int(tot_a[y]):,}  deaths {int(tot_d[y]):,})")


if __name__ == "__main__":
    main()
