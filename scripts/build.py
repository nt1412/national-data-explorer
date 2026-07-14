"""Orchestrate the NFHS data pipeline (task-order steps 1,3,4,5) and print a
join-check report so silent drops are impossible to miss.

Run: python scripts/build.py
"""
import sys, os, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from datasets.nfhs import adapter
from engine import store


def main():
    print("== NFHS ingest + join check ==")
    data = adapter.load()

    districts = data["districts"]
    nb = data["no_baseline"]
    poly_codes = data["poly_codes"]
    matched = set(d["census_code"] for d in districts)

    print(f"matched (comparable) districts : {len(matched)}")
    print(f"NFHS districts with NO polygon  : {len(nb)}  -> rendered 'new · no baseline'")
    print(f"polygons with NO NFHS row       : {len(poly_codes - matched)}  -> rendered grey")

    # per-state comparable counts (spot-check against official PDFs)
    by_state = collections.Counter(d["state"] for d in districts)
    print("\nper-state comparable district counts:")
    for st, n in sorted(by_state.items()):
        print(f"  {n:3d}  {st}")

    if nb:
        print("\nsample no-baseline (new/split) districts:")
        for d in nb[:10]:
            print(f"  {d['state']} · {d['name']}")

    print("\n== build store + district_change + export ==")
    summary = store.build(data, source_name="India.csv (SaiSiddhardhaKalla, rchiips-derived)")
    print(f"districts={summary['n_districts']}  observations={summary['n_obs']}  "
          f"change_cells={summary['n_cells']}")
    print("wrote: data/out/*.parquet, data/out/nfhs.duckdb, web/data/district_change.json")


if __name__ == "__main__":
    main()
