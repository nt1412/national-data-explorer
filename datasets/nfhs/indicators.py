"""NFHS core indicator config (per-dataset metric layer).

Each indicator maps a stable slug `id` to the EXACT factsheet string in the source CSV
(matched by meaning, never by row position). `polarity`: +1 up=better, -1 up=worse,
0 show-don't-grade. `unit`: drives the change label ('%' -> 'pts', else native).

Adjusted from the source brief: IMR / TFR / women's-bank-account are not present in the
district-level extract (NFHS keeps those at state level). Substitutes keep the spread and
still exercise the unit-aware path via a ratio indicator (sex ratio at birth).
"""

CORE = [
    dict(id="fullvax",       csv="Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall (%)",
         label="Children 12–23 mo fully vaccinated", unit="%", polarity=+1, category="Child Health"),
    dict(id="instbirth",     csv="Institutional births (%)",
         label="Institutional births", unit="%", polarity=+1, category="Maternal Health"),
    dict(id="anc4",          csv="Mothers who had at least 4 antenatal care visits (%)",
         label="Mothers with ≥4 antenatal visits", unit="%", polarity=+1, category="Maternal Health"),
    dict(id="stunting",      csv="Children under 5 years who are stunted (height for age) (%)",
         label="Children under 5 stunted", unit="%", polarity=-1, category="Nutrition"),
    dict(id="childanaemia",  csv="Children age 6-59 months who are anaemic ",  # trailing space is in the source
         label="Children 6–59 mo anaemic", unit="%", polarity=-1, category="Nutrition"),
    dict(id="sanitation",    csv="Population living in households that use an improved sanitation facility (%)",
         label="Improved sanitation", unit="%", polarity=+1, category="Living Conditions"),
    dict(id="electricity",   csv="Population living in households with electricity (%)",
         label="Households with electricity", unit="%", polarity=+1, category="Living Conditions"),
    dict(id="womenedu",      csv="Female population age 6 years and above who ever attended school (%)",
         label="Women who ever attended school", unit="%", polarity=+1, category="Women's Status"),
    dict(id="sexratiobirth", csv="Sex ratio at birth for children born in the last five years (females per 1,000 males)",
         label="Sex ratio at birth", unit="per 1,000", polarity=+1, category="Women's Status"),
]

# fast lookup: exact CSV string -> config
BY_CSV = {ind["csv"]: ind for ind in CORE}
