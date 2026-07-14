# Dataset #2 — Road Safety (MoRTH) spec

The deliberate engine stress-test: **rates not percentages**, a **multi-year series**, and a
**state + city** geography instead of the district spine. Records the user brief
(2026-07-14) plus corrections found during source verification.

## Scope (locked)
- **State choropleth** defaulting to **severity** (deaths per 100 accidents — a rate),
  year slider 2019–2024, plus a polarity-aware **Change 2019→24** view.
- **Per-state trend** sparkline (state vs national) + metric card + narration.
- **Million-plus cities** tier as a ranked, sortable view (2022–2024).
- **Black spots deferred to a later phase** (separate docs; chainage→coordinate geocoding
  is the real cost).

## Corrections to the brief (verified against the real files)
1. **State join is by NAME, not code.** The DataMeet state boundary file has *only*
   `ST_NM` (no code) and misspells some names. Join on a **canonical-name crosswalk**
   (6 aliases: Arunachal↔Arunanchal, Andaman Islands↔Island, Dadra & Nagar Haveli↔Dadara
   & Nagar Havelli, Delhi↔NCT of Delhi, J & K↔Jammu & Kashmir). 36/36 polygons join.
2. **State-level rates are NOT in the data — only severity is derivable in-hand.** The
   opencity tables give state **counts** (accidents, deaths) by year; deaths-per-lakh and
   per-10,000-vehicles need state population / vehicle denominators the CSVs don't carry.
   **Severity = deaths/accidents×100** is computed directly and is the default metric.
   Per-lakh / per-10k are a documented **fast-follow** (avoid a stale-population per-lakh
   that would mis-rank fast-growing states).
3. **Unmapped states shown, never faked:** **Ladakh** (no 2011 polygon) and the merged
   **Dadra & Nagar Haveli and Daman & Diu** UT (2024 edition merged what 2011 boundaries
   keep separate) appear in lists/tables but not on the choropleth. "All India" total dropped.
4. **Multi-year assembly:** 2019–2023 from the 2023 edition + 2024 from the 2024 edition,
   merged by (state, year). Numbers carry commas; tables are wide-by-year → melted to long.

## Engine reuse vs. new
- **Reused unchanged:** `engine/change.py` (unit-aware + polarity — every road metric is a
  count/rate with polarity −1), the DuckDB/Parquet + mapshaper patterns, the map/panel/
  legend/tooltip/theme UI patterns, the diverging BrBG change ramp.
- **New (the intended generalisation):** a `regions` model with a `tier` (`state`|`city`),
  a **year** dimension + per-region time series, a **sequential Reds** by-year value ramp,
  a **year slider**, a **trend sparkline**, and a **cities ranked view**.

## Data model (export `web/roadsafety/data/road.json`)
```
meta{years, cityYears, defaultIndicator:"severity", defaultYear, attribution, note}
indicators[] / cityIndicators[]  {id,label,unit,polarity,category}
states[]  {key(=ST_NM), name, mapped, series{ind:{year:value}}, change{ind:{fromYear,toYear,from,to,change,improved}}}
cities[]  {key, name, series{...}, change{...}}
unmapped[]  (Ladakh, merged D&N+D&D)
```
`change` = latest−earliest year via the shared change logic; `improved = sign(change)·polarity>0`.

## Build
```bash
bash scripts/fetch_roadsafety.sh
python scripts/build_roadsafety.py
bash scripts/boundary_prep.sh          # also writes states.topo.json
cd web && python -m http.server 8795   # open http://localhost:8795/roadsafety/
```

## Known limitations
- Pre-2019 trend needs PDF extraction (opencity CSVs start 2019); the series is 2019–2024.
- Cities have no coordinates → ranked table, not map points (points join the black-spot phase).
- Tiny UTs (Daman & Diu, D&N, Lakshadweep) miss some 2024 values → rendered as no-data, not zero.
