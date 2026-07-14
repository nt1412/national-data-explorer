"""GST consumption-flow metrics (per-dataset).

All descriptive economic geography — polarity 0 (display, don't grade). The headline is the
producer<->consumer axis from IGST settlement, which is a *ratio* and needs no population.

Metric definitions (SGST portion only):
  pre  = pre-settlement SGST  = tax a state collected on its OWN intra-state supplies.
  post = post-settlement SGST = pre + SGST-share of IGST settled to it (goods/services made
         elsewhere but consumed there).
  uplift = post/pre  -> >national ratio = net CONSUMER; <national = net PRODUCER/origin.
"""

METRICS = [
    dict(id="uplift", label="Producer ↔ Consumer (settlement uplift)", unit="×",
         mode="diverging", polarity=0,
         desc="post-settlement SGST ÷ pre-settlement SGST. Higher = pulls in more revenue on "
              "goods made elsewhere (net consumer); lower = its output is consumed elsewhere (net producer)."),
    dict(id="net_settled_percap", label="Net IGST settled, per capita", unit="₹/person",
         mode="sequential", polarity=0,
         desc="(post − pre) SGST settled into the state, per person (Census-2011 population)."),
    dict(id="accrued_percap", label="SGST accrued (post-settlement), per capita", unit="₹/person",
         mode="sequential", polarity=0, desc="Total SGST accruing to the state per person."),
    dict(id="own_percap", label="Own SGST (pre-settlement), per capita", unit="₹/person",
         mode="sequential", polarity=0, desc="Tax on the state's own intra-state supplies, per person."),
]
