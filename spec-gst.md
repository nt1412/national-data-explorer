# Dataset #4 — GST / Consumption Flows spec

Which states **produce** vs which **consume** — read off the GST IGST settlement. Reuses the
MoRTH **state spine + choropleth** patterns. Records the user brief (2026-07-14) + the
corrections found during source verification.

## ⚠️ Corrections to the brief (verified against real sources)
1. **The "monthly time-series" is really annual (cumulative).** The producer↔consumer signal
   is **Table 2 (pre/post-settlement SGST)** in the GSTN monthly PDF — but that table is
   **fiscal-year cumulative to the report month**, not a monthly flow. So v1 is the authoritative
   **annual FY 2023-24 vs 2024-25** picture, not a monthly series. A true monthly *collection*
   series would need parsing Table 1 across 12+ PDFs (messy layout) — deferred.
2. **dataful.in (the suggested shortcut) is gated/paid** — page loads but the tabular data isn't
   openly downloadable. **opencity has no GST data.** So the source in use is the **official GSTN
   PDF** directly (`tutorial.gst.gov.in/.../approved_monthly_gst_data_for_publishing_mar_2025.pdf`),
   parsed with `pdfplumber` — Table 2 extracts cleanly.

## The metric
- `pre`  = pre-settlement SGST (tax on a state's own intra-state supplies).
- `post` = post-settlement SGST (pre + SGST-share of IGST settled in for goods consumed there).
- **`uplift = post/pre`** — the population-free producer↔consumer index. Above the national
  ratio (**1.885** in FY24-25) = net **consumer**; below = net **producer**.
- Per-capita metrics (net settled / accrued / own, ÷ Census-2011 population) are secondary.

## What it shows (verified)
State choropleth, metric picker:
- **Producer ↔ Consumer** (default) — diverging on `uplift`, centred on the national 1.885×
  (teal = producer, brown = consumer; clamped so tiny-UT outliers like Lakshadweep 12.8× don't
  flatten it). Descriptive, **polarity 0** — not good/bad.
- **Net IGST settled / accrued / own SGST, per capita** — sequential.
Click a state → producer/consumer verdict + narration + full settlement numbers (₹ cr + per capita) + YoY.

**Sanity (FY24-25):** national own SGST ₹5.16L cr → accrued ₹9.73L cr (uplift 1.885). Net
**producers**: Odisha 1.44×, Maharashtra 1.52×, Jharkhand 1.59×, Gujarat 1.61× (India's
industrial/mining states). Net **consumers**: Lakshadweep 12.8×, Nagaland 3.64×, Mizoram 3.55×,
Arunachal 3.23×, plus Bihar/UP. 34/36 states mapped; Ladakh + merged D&N-&-D&D unmapped.

## Honesty flags (in the UI)
1. **Remittance geography ≠ where activity happened** — big firms register at HQ, so
   Maharashtra/Karnataka/Delhi are over-credited on own-SGST vs. physical production/consumption.
   The biggest caveat; stated in the footer.
2. Settlement is FY-cumulative, not monthly. 3. Pre/post = **SGST portion only**.
4. Per-capita uses **Census-2011** population (states have grown) → approximate.

## Not sourceable (by law)
Firm-to-firm goods movement (GSTR-1/2, e-way-bill records) is confidential, GSTN-only. Out of
scope by law, not choice — the aggregate settlement story is the better one anyway.

## Build
```bash
bash scripts/fetch_gst.sh          # download the GSTN monthly PDF
python scripts/build_gst.py        # parse Table 2 -> web/gst/data/gst.json (+ reuse state TopoJSON)
# open web/gst/ from the static site
```
Reuses `web/roadsafety/data/states.topo.json` (the MoRTH state boundary) — no new geography.
