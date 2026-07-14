# National Data Explorer

A reusable engine for turning **government open data into honest, interactive maps** —
choropleths, multi-year trends, and geodata overlays — built so a new dataset (or a new
country) is a new *adapter*, not a new product. Nothing here is India-specific by design:
the same engine maps any boundary set; **India is just the first country wired up**, and the
roadmap is to extend worldwide (any admin-boundary source + open dataset drops in).

**Datasets live today (India):**
- **NFHS Health** (`web/nfhs/`) — district health & living conditions, NFHS-4 (2015–16) → NFHS-5 (2019–21). Spec: [`spec.md`](spec.md).
- **Road Safety** (`web/roadsafety/`) — MoRTH state & city crash trends, 2019–2024. Spec: [`spec-roadsafety.md`](spec-roadsafety.md).
- **Industrial & Infrastructure** — Maharashtra geodata overlay (OSM industrial/malls + airports), toggleable on both maps. Spec: [`spec-infra.md`](spec-infra.md).
- **Maharashtra: Industry vs Health** (`web/mh-industry/`) — district scatter of establishments/lakh (Economic Census 2013) against NFHS-5 child stunting (r ≈ −0.5, descriptive). Spec: [`spec-mhindustry.md`](spec-mhindustry.md).
- **GST: Producers vs Consumers** (`web/gst/`) — net producer/consumer states from IGST settlement (pre- vs post-settlement SGST), FY 2024-25. Spec: [`spec-gst.md`](spec-gst.md).

Static, client-side, zero-backend — deployable to any static host. The section below documents
the first dataset (NFHS) in detail; the other two follow the same engine.

---

## What it shows
- **Change view** (default): polarity-adjusted — green = improved, brown = worsened,
  *always*, whether the raw number rose or fell (child anaemia rising is red, not green).
  Colour-blind-safe BrBG diverging ramp.
- **Single-round views** (2015–16 / 2019–21): sequential magnitude.
- Click / search a district → NFHS-4 → NFHS-5 card for all indicators, with an auto
  one-line read. Hover for a quick tooltip. Table view for the full sortable list.
- 627 comparable districts; 78 post-2011 districts shown as **"new · no baseline"** (grey
  hatch), never imputed.

## Data sources
- **NFHS district factsheets** (both rounds), IIPS/MoHFW via `rchiips.org`, community
  extract `github.com/SaiSiddhardhaKalla/NFHS` (already Census-coded, long form).
- **Boundaries**: `github.com/datameet/maps` — Census-2011 district polygons (CC-BY).

### Two corrections vs. the original brief (verified against the real files)
1. **Join key is composite.** The NFHS CSV has no national census code — its `DT_CEN_CD`
   is state-relative. Join on **`(ST_CEN_CD, DT_CEN_CD)`** (shared by both files) and carry
   DataMeet's national `censuscode` through as the primary key. Direct-code join hits 72/641.
2. **Indicator set adjusted.** IMR / TFR / women's-bank-account are not in the district
   extract (state-level in NFHS). Substituted to keep the spread and still exercise the
   unit-aware path via a ratio indicator (sex ratio at birth). See `datasets/nfhs/indicators.py`.

`low_sample` (25–49 unweighted cases) markers were already stripped by this extract; the
field is kept in the schema for a future factsheet source.

## Build & run
```bash
pip install -r requirements.txt
bash scripts/fetch_data.sh        # download NFHS CSVs + DataMeet shapefile → data/raw/
python scripts/build.py           # ingest + join check + district_change + web JSON
bash scripts/boundary_prep.sh     # shapefile → simplified TopoJSON (needs Node/npx)
python scripts/test_change.py     # unit tests for the change/polarity logic
cd web && python -m http.server 8795   # landing → http://localhost:8795/  · NFHS → /nfhs/
```
Deploy: the `web/` folder is fully static (landing page + `nfhs/`, `roadsafety/`, shared
`vendor/` & `shared/`) — push to GitHub Pages / Netlify / S3 as-is. All paths are relative,
so it works under any base path (e.g. `user.github.io/national-data-explorer/`).

## Layout
```
engine/     change.py (unit-aware + polarity, tested) · store.py (DuckDB build + JSON export)   SHARED
datasets/nfhs/  indicators.py (metric config) · adapter.py (CSV → long + composite join)        PER-DATASET
scripts/    build.py · fetch_data.sh · boundary_prep.sh · test_change.py
web/        index.html · style.css · app.js · vendor/ (d3, topojson) · data/ (shipped artifacts)
data/       raw/ (fetched)  out/ (parquet + duckdb)      [both git-ignored, regenerable]
```

## Dataset #2 — Road Safety (MoRTH), at `web/roadsafety/`
The engine stress-test: **rates not %**, a **2019–2024 time series**, and a **state + city**
geography instead of districts. Map defaults to **severity** (deaths per 100 accidents — a
rate that surfaces *lethal* roads, not merely busy ones); year slider, Change 2019→24 view,
per-state trend sparkline, and a million-plus-cities ranked view. Full design + the verified
corrections (state join by **name** not code; only severity is in-hand while per-lakh/per-10k
are a fast-follow; Ladakh + merged D&N/D&D unmapped) are in [`spec-roadsafety.md`](spec-roadsafety.md).

```bash
bash scripts/fetch_roadsafety.sh
python scripts/build_roadsafety.py     # ingest + join check + road.json
bash scripts/boundary_prep.sh          # also writes states.topo.json
cd web && python -m http.server 8795   # http://localhost:8795/roadsafety/
```

**What was reused vs. new:** `engine/change.py` (unit-aware + polarity), the DuckDB/mapshaper
patterns, and the map/panel/legend/theme UI patterns were reused unchanged. The new shared
capability is the `region`+`tier` model, a **year** dimension + time series, a sequential
by-year ramp, a year slider, a trend sparkline, and a cities view — i.e. the engine bent to
fit and generalised, as intended.

## Dataset #3 — Industrial & Infrastructure geodata overlay (Maharashtra)
The geodata layer: **points/polygons, not regional counts**, rendered as a **toggleable
overlay on both** the NFHS district map and the MoRTH state map (Industrial areas · Malls ·
Airports). This is the cross-dataset payoff the engine was built for — infrastructure
geodata read against child-health or road-safety choropleths. Design + the verified
correction (**ASI is state-level, not district** — the "free district overlay" premise fails;
Economic Census is the substitute, deferred to a follow-up) are in [`spec-infra.md`](spec-infra.md).

```bash
bash scripts/build_infra.sh    # Overpass (industrial+malls) + OurAirports -> web/shared/data/mh_infra.json
# open either explorer — the "MH infra (OSM)" toggles appear on both maps
```

Sources: OpenStreetMap/Overpass (industrial `landuse`, `shop=mall`), OurAirports (airports).
**Licence isolation:** all OSM-derived data lives in `web/shared/data/mh_infra.json` +
`web/shared/overlay.js`, so the **ODbL share-alike** obligation stays separable from the
MOSPI/MoRTH/DataMeet layers. The overlay note flags OSM's metro-biased completeness — these
are *locations*, not an economic-intensity measure. A district industrial-intensity layer
awaits the Economic Census follow-up.

## Adding dataset #4
Write `datasets/<name>/{indicators,adapter}.py` (regions + a per-period series, or the
district `{districts,observations,indicators}` shape), or — for a geodata layer — a points
file + a reuse of `web/shared/overlay.js`. Reuse `engine/change.py`, the boundary-prep +
DuckDB patterns, and whichever UI fits the geography.

## Attribution
Data: IIPS/MoHFW — NFHS-4 & NFHS-5 district factsheets. Boundaries: DataMeet (Census 2011), CC-BY.
