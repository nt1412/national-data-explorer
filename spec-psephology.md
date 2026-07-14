# Psephology — the 2024 Verdict in Numbers

An **automated psephologist**: computed, cited findings from the 2024 Lok Sabha result —
analysis, not a map. The value is insight, and the differentiator is honest method
(every number computed from the official count; nothing asserted the data can't support).

## Source
- Candidate-level results (8,902 rows: state, PC, candidate, party, EVM/postal/total votes,
  vote share) + winners/runners-up (543 seats: winner, runner-up, margin) — Election
  Commission of India 2024, via **opencity.in** CKAN (data.gov.in's own catalog is
  JS/API-gated and could not be pulled programmatically — same wall as earlier datasets).
- Staged in `data/raw/elections/` (gitignored). Fetch: the two CKAN CSV resources under
  opencity dataset `parliamentary-elections-2024-results`.

## Findings (computed by `scripts/analyze_elections.py` → `web/psephology/data/findings.json`)
1. **Disproportionality** — NDA 293 seats on 43.4% of votes; INDIA 234 on 41.5%; Others
   16 seats on 15.1% of votes. Gallagher index 11.5. A 1.9-pt vote gap → 59-seat gap.
2. **Knife-edge margins** — 257/543 seats decided by <10 pts, 131 by <5, 21 by <1;
   closest = Mumbai North West, 48 votes.
3. **NOTA** — 6.37M votes (0.99%); exceeded the winning margin in 20 seats; peak Indore 14%.
4. **Deposit forfeitures** — 86.1% of 8,360 candidates; 99.6% of independents.
5. **Postal decisiveness** — 13 seats where the margin was smaller than postal votes cast.
6. **Contest map** — NDA-vs-INDIA in 402 of 543 head-to-heads; 28 INDIA-vs-INDIA "friendly fights".

## Honest limits
- **Alliance attribution is an explicit editorial mapping** (reconciles to the reported
  NDA 293 / INDIA 234 / Others 16); a few small parties (RLP, BAP, TMC's bloc status) are
  genuinely contested — the mapping is stated in the analysis script.
- **Deposit-forfeit** uses vote share < 1/6 (16.67%) as a proxy for the "<1/6 of valid
  votes" rule.
- **No turnout/electors and no candidate gender/age** in this dataset — those analyses are
  out of scope (they live in the ECI "statistical report" tables, which are PDF/gated).
- Descriptive only — reports what the count says, never why voters chose it.

## Publish
`web/psephology/` — a data-driven article: `app.js` fetches `findings.json` and fills every
figure/table/bar, so the prose can never drift from the computed numbers. Deploys with the
site to GitHub Pages.
