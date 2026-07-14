# Layer A — Maharashtra district industry (standalone) spec

Answers one question honestly: **do more-industrial Maharashtra districts have healthier
children?** A **scatter** (not a choropleth folded into NFHS) across ~35 districts:
industrial intensity vs NFHS-5 child stunting, on the shared census-district spine.

## Why standalone (not inside the NFHS explorer)
The advisor's steer: folding these into NFHS would *conflate layers* (industry isn't health,
isn't a 2015→2021 change, covers 35/640 districts → a 95%-grey map) — which the project's own
principles forbid. A standalone surface keeps the layers separate and answers the comparison
better with a scatter than two choropleths.

## Data (commercial-clean)
- **Economic Survey of Maharashtra 2024-25** (state-government open data, via opencity.in) —
  `data/raw/maharashtra/mh_district_indicators_2023-24.csv`:
  - `est_per_lakh` — establishments per lakh population (**Economic Census 2013** vintage)
  - `ind_elec_pc` — per-capita industrial electricity (kWh)
  - `pci` — per-capita income (current prices)
- **NFHS-5 child stunting** (`web/nfhs/data/district_change.json`) joined by census code as the
  health axis.
- All commercial-usable (govt open data). SHRUG was deliberately avoided (non-commercial) — see `LICENSING.md`.

## Crosswalk correction (district names → 2011 census codes)
Maharashtra renamed districts in 2023, so the survey names don't match the 2011 boundaries.
Alias map: Ahilyanagar→Ahmadnagar, Chhatrapati Sambhajinagar→Aurangabad, Dharashiv→Osmanabad,
Beed→Bid, Buldhana→Buldana, Raigad→Raigarh, Gadchiroli→Garhchiroli, Mumbai City→Mumbai.
**Palghar** (carved out 2014) has no 2011 polygon → omitted. **35/35** polygons matched;
**34** have both establishments/lakh and stunting (scatter-ready).

## Finding
Pearson **r ≈ −0.50** (establishments/lakh vs stunting, 34 districts): more-industrial
districts tend to have *lower* child stunting. Descriptive and correlational — **not causal**,
and a single-state 35-district slice. Metrics are polarity 0 (display, don't grade).

## Surface (`web/mh-industry/`)
Scatter (x = a switchable industry metric, y = stunting) with a linear-fit line + live
correlation r, extremes labelled, hover tooltips; a sortable district table; theme-aware,
reusing the shared design tokens and `../vendor/d3`. Honest-scope note + attribution in-page.

## Honest scope
35 districts, one state, one snapshot (EC 2013 vintage for establishments). Not a national
layer — the national district Economic Census is gated for commercial use (see `LICENSING.md`);
this Maharashtra state-survey slice is the commercial-clean substitute obtained.
