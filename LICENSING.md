# Data licensing — commercial-use status per layer

This project is a *tool*; each data layer keeps its own source licence. This table is the
record of what may be used commercially. **Not legal advice** — confirm against each
licence and your counsel before shipping a commercial product.

| Layer | Source | Licence | Commercial use |
|---|---|---|---|
| NFHS health (district) | IIPS / MoHFW (NFHS-4, NFHS-5) | Govt open data (NDSAP) | ✅ with attribution |
| Road safety (state/city) | MoRTH / Transport Research Wing, via opencity.in | Govt open data | ✅ with attribution |
| Boundaries (district/state) | DataMeet, Census 2011 | CC-BY 2.5 IN | ✅ with attribution |
| Airports | OurAirports | Public domain | ✅ |
| Industrial areas & malls (overlay) | OpenStreetMap contributors | **ODbL** | ✅ **but share-alike** on any derived *database* + attribution |
| MH district industry (Layer A, staged) | Economic Survey of Maharashtra (state govt) | Govt open data | ✅ with attribution |

## Notes that matter for going commercial
- **OpenStreetMap is ODbL (share-alike).** Commercial use is fine, but a *database* derived
  from OSM must be released under ODbL with OSM attributed. All OSM-derived data is isolated
  in `web/shared/data/mh_infra.json` + `web/shared/overlay.js` so this obligation does **not**
  contaminate the other layers. Keep it that way.
- **SHRUG (Development Data Lab) is deliberately NOT used.** It has clean district-level
  Economic Census data, but it is **CC BY-NC-SA 4.0 — non-commercial**, so it is excluded.
  The commercial-clean substitute in use is the state-government **Economic Survey of
  Maharashtra** (Economic Census 2013 establishments-per-lakh, pre-tabulated by district).
- **National district-industry data is blocked for commercial use at the national level.**
  MOSPI's district Economic Census isn't cleanly machine-readable/open via automation
  (NDAP unreachable, data.gov.in JS/API-gated); only state-level ASI is easily open. The
  Maharashtra state survey is the one commercial-clean district source obtained so far.

## Attribution string (shown in-context on each map)
> Data: IIPS/MoHFW (NFHS) · MoRTH/TRW (road safety) · OpenStreetMap contributors, ODbL
> (infrastructure) · OurAirports (public domain) · DataMeet, CC-BY (boundaries).
