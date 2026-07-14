"""Build the Maharashtra district-industry surface data.
Run: python scripts/build_mhindustry.py
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datasets.mhindustry import adapter
from datasets.mhindustry.indicators import METRICS, STUNTING

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "web", "mh-industry", "data")


def main():
    os.makedirs(OUT, exist_ok=True)
    data = adapter.load()
    d = data["districts"]
    with_both = [x for x in d if x.get("est_per_lakh") is not None and x.get("stunting") is not None]

    print("== MH district-industry ingest ==")
    print(f"districts matched to 2011 census code : {len(d)}")
    print(f"unmapped (no 2011 polygon / footnote) : {data['unmapped']}")
    print(f"with BOTH establishments/lakh + stunting (scatter-ready): {len(with_both)}")

    doc = dict(
        region="Maharashtra",
        metrics=[{k: m[k] for k in ("id", "label", "unit", "polarity")} for m in METRICS],
        health={k: STUNTING[k] for k in ("id", "label", "unit", "polarity")},
        attribution="Industry & economy: Economic Survey of Maharashtra (state govt open data). "
                    "Child stunting: NFHS-5, IIPS/MoHFW. Boundaries: DataMeet, CC-BY.",
        note="A 35-district slice of one state. 'Establishments per lakh' is Economic Census 2013 "
             "vintage; all metrics are descriptive economic geography, not a good/bad league table. "
             "Palghar (created 2014) has no 2011 boundary and is omitted.",
        districts=sorted(d, key=lambda x: (x.get("est_per_lakh") is None, -(x.get("est_per_lakh") or 0))),
    )
    path = os.path.join(OUT, "mh_industry.json")
    json.dump(doc, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {os.path.relpath(path, ROOT)} ({os.path.getsize(path)} bytes)")

    if with_both:
        xs = [x["est_per_lakh"] for x in with_both]
        ys = [x["stunting"] for x in with_both]
        n = len(with_both)
        mx, my = sum(xs) / n, sum(ys) / n
        cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
        vx = sum((a - mx) ** 2 for a in xs) ** 0.5
        vy = sum((b - my) ** 2 for b in ys) ** 0.5
        r = cov / (vx * vy) if vx and vy else 0
        print(f"establishments/lakh range: {min(xs):.0f}–{max(xs):.0f} | stunting range: {min(ys):.1f}–{max(ys):.1f}%")
        print(f"Pearson r (est/lakh vs stunting) across {n} districts: {r:+.2f}")
        top = sorted(with_both, key=lambda x: -x["est_per_lakh"])[:3]
        print("most industrial:", [(x["name"], round(x["est_per_lakh"]), x["stunting"]) for x in top])


if __name__ == "__main__":
    main()
