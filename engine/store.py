"""Shared store: load normalised frames into DuckDB/Parquet, materialise the
`district_change` table (via the tested change logic), and export one web JSON.

Dataset-agnostic — it only knows the four table shapes, not NFHS specifics.
"""
from __future__ import annotations
import os, json
import duckdb
import pandas as pd
from .change import change_value, improved

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "data", "out")
WEB_DATA = os.path.join(ROOT, "web", "nfhs", "data")


def build(adapter_output, source_name):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WEB_DATA, exist_ok=True)

    districts = pd.DataFrame(adapter_output["districts"])
    observations = pd.DataFrame(adapter_output["observations"])
    indicators = pd.DataFrame(adapter_output["indicators"])[
        ["id", "label", "unit", "polarity", "category"]
    ].rename(columns={"id": "indicator_id"})

    con = duckdb.connect(os.path.join(OUT, "nfhs.duckdb"))
    con.execute("DROP TABLE IF EXISTS districts; DROP TABLE IF EXISTS observations; "
                "DROP TABLE IF EXISTS indicators; DROP TABLE IF EXISTS district_change;")
    con.register("d_df", districts); con.execute("CREATE TABLE districts AS SELECT * FROM d_df")
    con.register("o_df", observations); con.execute("CREATE TABLE observations AS SELECT * FROM o_df")
    con.register("i_df", indicators); con.execute("CREATE TABLE indicators AS SELECT * FROM i_df")

    # pivot rounds -> v4/v5 per (census_code, indicator_id)
    pivot = con.execute("""
        SELECT census_code, indicator_id,
               MAX(CASE WHEN round='nfhs4' THEN value END) AS v4,
               MAX(CASE WHEN round='nfhs5' THEN value END) AS v5
        FROM observations GROUP BY census_code, indicator_id
    """).df()

    polarity = {r.indicator_id: r.polarity for r in indicators.itertuples()}
    comparable = set(districts["census_code"])
    rows = []
    for r in pivot.itertuples():
        v4 = None if pd.isna(r.v4) else float(r.v4)
        v5 = None if pd.isna(r.v5) else float(r.v5)
        ch = change_value(v4, v5)
        rows.append(dict(census_code=r.census_code, indicator_id=r.indicator_id,
                         v4=v4, v5=v5, change=ch,
                         improved=improved(ch, polarity[r.indicator_id]),
                         comparable=r.census_code in comparable))
    change_df = pd.DataFrame(rows)
    con.register("c_df", change_df); con.execute("CREATE TABLE district_change AS SELECT * FROM c_df")

    # persist parquet (the reusable store artifacts)
    for t in ("districts", "observations", "indicators", "district_change"):
        con.execute(f"COPY {t} TO '{os.path.join(OUT, t + '.parquet')}' (FORMAT PARQUET)")

    _export_json(districts, indicators, change_df, source_name)
    con.close()
    return dict(n_districts=len(districts), n_obs=len(observations), n_cells=len(change_df))


def _export_json(districts, indicators, change_df, source_name):
    """One compact JSON the client renders directly. Districts keyed by census_code."""
    cells = {}
    for r in change_df.itertuples():
        cells.setdefault(r.census_code, {})[r.indicator_id] = dict(
            v4=None if r.v4 is None or pd.isna(r.v4) else round(float(r.v4), 1),
            v5=None if r.v5 is None or pd.isna(r.v5) else round(float(r.v5), 1),
            change=None if r.change is None or pd.isna(r.change) else float(r.change),
            improved=None if r.improved is None or (isinstance(r.improved, float) and pd.isna(r.improved)) else bool(r.improved),
        )
    out = dict(
        meta=dict(source=source_name, rounds=["nfhs4", "nfhs5"],
                  n_districts=int(len(districts)),
                  attribution="Data: IIPS/MoHFW (NFHS-4, NFHS-5). Boundaries: DataMeet, CC-BY."),
        indicators=[dict(id=r.indicator_id, label=r.label, unit=r.unit,
                         polarity=int(r.polarity), category=r.category)
                    for r in indicators.itertuples()],
        districts=[dict(code=r.census_code, name=r.name, state=r.state,
                        comparable=bool(r.comparable), cells=cells.get(r.census_code, {}))
                   for r in districts.itertuples()],
    )
    path = os.path.join(WEB_DATA, "district_change.json")
    json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    return path
