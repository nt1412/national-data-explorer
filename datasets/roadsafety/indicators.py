"""Road-safety metric config (per-dataset).

All metrics are counts or rates (never %), all polarity -1 (up = worse) — this is the
dataset that exercises the engine's unit-aware change path.

`severity` is derived (deaths per 100 accidents) — a RATE that surfaces *dangerous*
roads rather than merely *busy* ones, and is fully computable from the two count tables
in hand. It is the default map metric.

Exposure rates (deaths per lakh population, per 10,000 vehicles) are deliberately NOT
here yet: the opencity CSVs carry no state-level denominators, and a per-lakh built on
stale/uneven population would mis-rank states. Deferred to a fast-follow with proper
projected population. See spec.
"""

STATE_INDICATORS = [
    dict(id="severity",  label="Accident severity", unit="per 100 accidents",
         polarity=-1, category="Rate", derived=True, default=True),
    dict(id="deaths",    label="Road deaths",    unit="deaths", polarity=-1, category="Count"),
    dict(id="accidents", label="Road accidents", unit="accidents", polarity=-1, category="Count"),
]

CITY_INDICATORS = [
    dict(id="severity",  label="Accident severity", unit="per 100 accidents", polarity=-1, category="Rate", derived=True, default=True),
    dict(id="deaths",    label="Road deaths",    unit="deaths",    polarity=-1, category="Count"),
    dict(id="accidents", label="Road accidents", unit="accidents", polarity=-1, category="Count"),
    dict(id="injured",   label="Persons injured", unit="injured",  polarity=-1, category="Count"),
]
