# Dataset #3 — Industrial & Infrastructure Geography spec

The geodata-heavy dataset: points/polygons, not regional counts, and it **pairs as an
overlay** on the NFHS district map and the MoRTH state map. Records the user brief
(2026-07-14) plus the corrections found during source verification.

## Scope (locked — path A3)
- **Layer B geodata only for v1**, region = **Maharashtra**, rendered as a **toggleable
  overlay on both** existing explorers (industrial areas, malls, airports).
- **Layer A (aggregate district intensity) deferred** — see correction below; a follow-up
  (A1) will attempt to source district-level Economic Census data.
- SEZ / state-IDC lists **deferred** (PDFs + village→coordinate geocoding).

## ⚠️ Correction to the brief — ASI is not published at district level
Verified (MOSPI ASI metadata + data.gov.in catalog): **ASI results are published at
state level**, not district. ASI's confidentiality rules **merge any industry with <3
units and suppress unit location** — so clean district×NIC tables don't exist publicly.
The brief's "ingest ASI by district exactly like NFHS" and the "free industrial-intensity-
vs-child-health overlay" therefore **cannot be built from ASI**.

- **The honest district substitute is the Economic Census** (MOSPI publishes establishment
  + employment counts at all-India → state → district → village), which *would* join the
  NFHS spine. But a clean machine-readable **district-level EC CSV was not confirmed**
  (data.gov.in blocks automated access; EC district data tends to be PDF / gated microdata).
  → **Follow-up A1**: timeboxed attempt to source it; until then no aggregate layer.
- An OSM-derived "factories per district" count is **not** an acceptable substitute — it
  measures where mappers are active (metro-biased), which the brief itself forbids
  presenting as economic reality.

## What was built (Layer B)
Confirmed reachable and clean:
- **Overpass API** → `landuse=industrial` centroids (3,175) + `shop=mall` (239) for Maharashtra.
- **OurAirports** → Maharashtra airports (16 large/medium; region code is **IN-MM**, not
  the ISO IN-MH — a gotcha). Public-domain, coordinates + IATA.

One shared file `web/shared/data/mh_infra.json` (points only) + a shared `web/shared/overlay.js`
module that renders the layers on either explorer's own map projection. Toggles for
Industrial / Malls / Airports on both the NFHS and MoRTH maps; a note shows counts +
attribution + the OSM-completeness caveat whenever a layer is on.

## Honesty & licence flags (implemented)
- Overlay note states these are **mapped locations, not economic intensity**, and that OSM
  coverage is metro-biased.
- **OSM layers kept isolable** — all OSM-derived data lives in the single `mh_infra.json`
  and the overlay module, so the **ODbL share-alike** obligation doesn't contaminate the
  NFHS/MoRTH layers (MOSPI/MoRTH/DataMeet/OurAirports are separately licensed & open).
- Airports (OurAirports) are separated from the OSM layers even within the file.

## Build
```bash
bash scripts/build_infra.sh     # Overpass + OurAirports -> web/shared/data/mh_infra.json
# then just open either explorer; the "MH infra (OSM)" toggles appear on both maps
cd web && python -m http.server 8795   # http://localhost:8795/  and  /roadsafety/
```

## Attribution
OpenStreetMap contributors (ODbL) — industrial & malls · OurAirports (public domain) —
airports · MOSPI (Economic Census / ASI, when Layer A lands) · DataMeet, CC-BY — boundaries.
