"""Maharashtra district-industry metric config (per-dataset).

All descriptive economic geography — polarity 0 (display, don't grade): more industry is
neither good nor bad. Columns are matched by normalised header tokens (the source headers
carry embedded newlines), never by position.
"""

# id -> (label, unit, tokens that must all appear in the normalised source header)
METRICS = [
    dict(id="est_per_lakh", label="Establishments per lakh (Econ. Census 2013)",
         unit="per lakh", polarity=0, tokens=["establishments", "perlakh"]),
    dict(id="ind_elec_pc", label="Industrial electricity per capita",
         unit="kWh", polarity=0, tokens=["industrial", "electricity"]),
    dict(id="pci", label="Per-capita income (current prices)",
         unit="₹", polarity=0, tokens=["percapitaincome"]),
]

# child stunting is joined in from NFHS-5 (not in this source) as the health axis
STUNTING = dict(id="stunting", label="Children under 5 stunted (NFHS-5)", unit="%", polarity=-1)
