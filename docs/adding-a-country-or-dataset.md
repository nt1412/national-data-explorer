# Adding a dataset or a country

The engine is deliberately thin: shared infrastructure + per-dataset **adapters**. Adding
data is a small, well-bounded job. This guide shows both moves with the patterns the three
existing datasets already follow.

## The shared parts you reuse (don't rewrite these)
- `engine/change.py` — unit-aware, polarity-adjusted change (`change_value`, `improved`,
  `format_change`). Pure + tested (`scripts/test_change.py`). Works for %, rates, ratios, counts.
- `engine/store.py` — DuckDB/Parquet build + JSON export (district-shaped datasets).
- `scripts/boundary_prep.sh` — shapefile → simplified TopoJSON (mapshaper).
- `web/vendor/` (d3, topojson) and `web/shared/overlay.js` (point/geodata overlay).
- The map/panel/legend/tooltip/theme UI patterns in `web/nfhs/` and `web/roadsafety/`.

## Add a new DATASET (same country)
The unit of work is `datasets/<name>/`:

1. **`indicators.py`** — a list of metric configs: `id`, exact source column/label, `unit`
   (`%` | a rate/ratio unit | count), `polarity` (`+1` up=good, `-1` up=bad, `0` show-don't-grade),
   `category`. Match by *meaning*, never row position.
2. **`adapter.py`** — read the raw source(s) → normalise to the engine's shape:
   - region-choropleth datasets → `{regions/districts, observations|series, indicators}`;
   - keep an **internal** join and **assert every configured indicator exists** (fail loud).
3. **A build script** (`scripts/build_<name>.py`) — run the adapter, materialise change via
   `engine/change.py`, export one JSON to `web/<name>/data/`. Print a **join-check report**
   (matched / unmatched / per-region counts) so silent drops are impossible.
4. **A boundary layer** — reuse `boundary_prep.sh` (add your shapefile), keyed on the join code.
5. **The UI** — copy the closest existing explorer (`web/nfhs/` for a district choropleth,
   `web/roadsafety/` for a region + year + secondary-tier view) and point it at your JSON.
6. **A `spec-<name>.md`** — record the sourcing + any data corrections you found while verifying.

Geodata layers (points/polygons) are even lighter: emit a points JSON and reuse
`web/shared/overlay.js` (see `datasets`-free `scripts/build_infra.py` + `web/shared/data/mh_infra.json`).

## Add a new COUNTRY
The engine has no India-specific logic — only the *data* is Indian. To add a country you
supply two things and reuse everything else:

1. **A boundary set** — admin polygons (district/state/whatever level) as a shapefile or
   GeoJSON, carrying a **stable code** field. Run it through `boundary_prep.sh` → TopoJSON.
2. **An entity-code spine** — the join key that ties data ↔ boundary. In India that's the
   census district/state code; elsewhere it's that country's statistical/admin code
   (GADM `GID_*`, Eurostat NUTS, US FIPS, etc.). Every adapter joins on this code, **not names**.

Then each dataset for that country is just a new `datasets/<name>/` adapter as above. The
change logic, store, boundary prep, overlay module, and map UIs are all country-agnostic.

## The honesty checklist (applies to every addition)
- [ ] Joined on **codes, not names** — printed the unmatched set and eyeballed it.
- [ ] Units/rates chosen so the map isn't a population map (normalise counts).
- [ ] `polarity` set per indicator; `0` where "more" isn't good or bad.
- [ ] New/uncovered units render as **"no baseline"**, never imputed.
- [ ] Colourblind-safe ramps; dark mode works.
- [ ] Source + **licence recorded** (keep share-alike/NC layers isolable — see `LICENSING`).
- [ ] `spec-<name>.md` documents real limits; the landing "honest scope" note updated if needed.
