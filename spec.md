# India Data Explorer — NFHS-4 vs NFHS-5 District Change (v1 spec)

An interactive district choropleth of how India's health & living conditions changed
between **NFHS-4 (2015–16)** and **NFHS-5 (2019–21)**. Also **dataset #1** of a reusable
government-data explorer engine — dataset #2 (road accidents) should be a new *ingest
adapter*, not a new product.

Source brief: user-provided "NFHS-4 vs NFHS-5 District Explorer" (2026-07-14).
This spec records that brief **plus the corrections found during source verification**.

## The four honesty rules (non-negotiable)
1. **Join on codes, never names.** District name spellings vary across sources and
   silently drop rows.
2. **Only comparable districts are graded.** A district is *comparable* iff it has a
   Census-2011 boundary polygon. New/split post-2011 districts render as
   **"new · no baseline"** (neutral grey), never an imputed value.
3. **Change is polarity-adjusted.** Each indicator has a `polarity` (+1 up=better,
   −1 up=worse, 0 show-don't-grade). The Change map colours *improvement* with one hue
   regardless of whether the raw number rose or fell.
4. **Change is unit-aware.** Absolute difference in the indicator's native unit
   (percentage **points** for %, native diff for ratios) — **never** relative %.

## ⚠️ Correction to the brief — the join key is composite, not a single census code
Verified against the real files (see `data/raw/`):

- **DataMeet `.dbf`** carries `censuscode` = **national** 1–640, plus `ST_CEN_CD` + `DT_CEN_CD`.
- **NFHS CSV** (`India.csv`) has **no** national code; its `DT_CEN_CD` is **state-relative**
  (1–99). A direct `DT_CEN_CD ↔ censuscode` join hits only **72/641** — silently wrong.
- **Fix:** join on the **composite `(ST_CEN_CD, DT_CEN_CD)`** that both files share, and
  carry DataMeet's national `censuscode` through as the canonical primary key.

**Verified join result (composite key):**
- 627 / 641 districts matched cleanly · 25 NFHS districts with no polygon → "no baseline"
  · 14 polygons with no NFHS row (render grey). `India_Change.csv` = 641 comparable spine.

## ⚠️ Correction to the brief — indicator set (IMR/TFR/bank not in district extract)
Verified: the SaiSiddhardhaKalla district CSV does **not** contain Infant Mortality Rate,
Total Fertility Rate, or women's bank-account (NFHS keeps mortality/fertility at state
level). Substitutes preserve the intended spread and still exercise the unit-aware path
via a **ratio** indicator (sex ratio at birth):

| id | Indicator (exact factsheet string) | Unit | Polarity |
|----|-----------------------------------|------|----------|
| fullvax | Children 12–23 mo fully vaccinated (card or recall) | % | +1 |
| instbirth | Institutional births | % | +1 |
| anc4 | Mothers with ≥4 antenatal care visits | % | +1 |
| stunting | Children under 5 stunted (height-for-age) | % | −1 |
| childanaemia | Children 6–59 mo anaemic | % | −1 |
| sanitation | Improved sanitation facility | % | +1 |
| electricity | Households with electricity | % | +1 |
| womenedu | Women 6+ who ever attended school | % | +1 |
| sexratiobirth | Sex ratio at birth (females per 1,000 males) | per 1,000 | +1 |

Values are matched by **exact indicator string**, not row position; the adapter asserts
every configured string exists in the source.

## Known data limitations (documented, not hidden)
- **`low_sample` unavailable in this extract** — the community CSV already stripped the
  factsheet's parenthetical (25–49 unweighted cases) markers. Field kept in schema,
  defaults `false`; a future source (official factsheet CSV) can populate it.
- Community-CSV extraction errors exist → the pipeline prints per-state row counts and the
  unmatched code sets for spot-checking against official PDFs before publishing.
- 14 polygons lack NFHS rows (grey); some are name/code edge cases worth a later eyeball.

## Data model (DuckDB build-time)
```
districts(census_code PK, name, state, st_cen_cd, dt_cen_cd, comparable BOOL)
indicators(indicator_id PK, label, unit, polarity, category)     -- polarity ∈ {+1,-1,0}
observations(census_code, round, indicator_id, value DOUBLE, low_sample BOOL)
district_change(census_code, indicator_id, v4, v5, change, improved BOOL, comparable BOOL)
```
`change = v5 − v4` (absolute, native unit). `improved = sign(change)·polarity > 0`
(null when polarity 0). `comparable = census_code has a 2011 polygon`.

## Architecture — static, no backend (v1)
DuckDB is a **build-time** tool. ~640 districts × 9 indicators × 2 rounds is tiny:
precompute `district_change`, export **one JSON** + a simplified **TopoJSON** (mapshaper
`-simplify 8% keep-shapes`, keyed on `censuscode`), render entirely client-side. Static
hosting, zero running cost. DuckDB-WASM query/chat is a later phase.

## Engine layout (shared vs per-dataset)
```
engine/    change.py (unit-aware+polarity, tested) · store.py (DuckDB build+export)   SHARED
datasets/nfhs/  indicators.py (metric config) · adapter.py (CSV→long + composite join) PER-DATASET
scripts/   build.py (orchestrate) · boundary_prep.sh (mapshaper) · test_change.py
web/       index.html · app.js · style.css · data/{district_change.json,districts.topo.json}
```
Dataset #2 = new `datasets/<name>/{indicators,adapter}.py`; everything else reused.

## Colour & quality floor
- Change: **diverging** colourblind-safe ramp (BrBG teal↔brown, **not** red↔green),
  centred on zero, applied **after** polarity. Single-round: **sequential**. No-baseline:
  neutral grey, keyed in legend. Bin by quantiles.
- Responsive (map + tap panel), keyboard-navigable, honours `prefers-reduced-motion`.
- Permanent attribution: *"Data: IIPS/MoHFW (NFHS-4, NFHS-5). Boundaries: DataMeet, CC-BY."*

## Task order
1. Ingest CSV → long-form observations, composite-join to boundaries → censuscode PK.
2. Boundary prep: DataMeet shp → simplified TopoJSON keyed on censuscode.
3. Join check: assert coverage, print unmatched sets + per-state counts.
4. Metric config: 9 core indicators (above).
5. Materialise `district_change`; export one JSON.
6. Map UI (D3 + TopoJSON): Change view first, round toggle second, click→panel.
7. Narration: per-district one-liner from the change table.
8. Ship static; then dataset #2 via a new adapter only.
