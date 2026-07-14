"""Build the GST consumption-flows dataset: parse GSTN Table 2 -> producer/consumer metrics
-> web JSON. Prints a join-check report. Run: python scripts/build_gst.py"""
import sys, os, json, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datasets.gst import adapter
from datasets.gst.indicators import METRICS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "web", "gst", "data")


def main():
    os.makedirs(WEB, exist_ok=True)
    d = adapter.load()
    mapped = [s for s in d["states"] if s["mapped"]]
    print("== GST ingest + join check ==")
    print(f"FY {d['fy_prev']} vs {d['fy']} (annual, cumulative settlement)")
    print(f"states parsed : {len(d['states'])}  | mapped to polygon : {len(mapped)}")
    print(f"unmapped (shown, not on map): {d['unmapped']}")
    print(f"national uplift (post/pre): {d['national']['uplift']}  "
          f"(pre ₹{d['national']['pre']:,.0f} cr  post ₹{d['national']['post']:,.0f} cr)")

    # reuse MoRTH state boundary
    src = os.path.join(ROOT, "web", "roadsafety", "data", "states.topo.json")
    shutil.copyfile(src, os.path.join(WEB, "states.topo.json"))

    doc = dict(
        meta=dict(fy=d["fy"], fy_prev=d["fy_prev"], defaultMetric="uplift",
                  nationalUplift=d["national"]["uplift"],
                  attribution="Data: Ministry of Finance / GSTN — approved monthly GST data (Table 2, "
                              "SGST settlement), FY 2024-25. Boundaries: DataMeet, CC-BY. Population: Census 2011.",
                  notes=[
                      "Remittance geography ≠ where activity happened: large firms register centrally, so HQ "
                      "states (Maharashtra, Karnataka, Delhi) are over-credited on own-SGST vs. where production/"
                      "consumption physically occurred — the biggest caveat.",
                      "Settlement figures are fiscal-year cumulative (to March), not a monthly series.",
                      "Producer↔consumer uses the SGST portion only; the uplift ratio needs no population.",
                      "Per-capita metrics use Census-2011 population (states have grown since), so treat as approximate.",
                  ]),
        metrics=METRICS,
        states=[{k: s[k] for k in ("key", "name", "mapped", "pre", "post", "net_settled",
                                   "uplift", "yoy_post", "net_settled_percap", "accrued_percap",
                                   "own_percap")} for s in d["states"]],
        unmapped=d["unmapped"],
    )
    json.dump(doc, open(os.path.join(WEB, "gst.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote web/gst/data/gst.json + states.topo.json")

    prod = sorted([s for s in mapped if s["uplift"]], key=lambda s: s["uplift"])[:4]
    cons = sorted([s for s in mapped if s["uplift"]], key=lambda s: -s["uplift"])[:4]
    print("net PRODUCERS:", [(s["name"], s["uplift"]) for s in prod])
    print("net CONSUMERS:", [(s["name"], s["uplift"]) for s in cons])


if __name__ == "__main__":
    main()
