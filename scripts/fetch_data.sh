#!/usr/bin/env bash
# Fetch the raw sources the pipeline ingests. Re-runnable; writes into data/raw/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/nfhs data/raw/boundaries

NFHS_BR=$(curl -s https://api.github.com/repos/SaiSiddhardhaKalla/NFHS \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['default_branch'])")
echo "NFHS branch: $NFHS_BR"
curl -sL -o data/raw/nfhs/India.csv        "https://raw.githubusercontent.com/SaiSiddhardhaKalla/NFHS/$NFHS_BR/India.csv"
curl -sL -o data/raw/nfhs/India_Change.csv "https://raw.githubusercontent.com/SaiSiddhardhaKalla/NFHS/$NFHS_BR/India_Change.csv"

DM="https://raw.githubusercontent.com/datameet/maps/master/Survey-of-India-Index-Maps/Boundaries"
for ext in shp dbf shx prj; do
  curl -sL -o "data/raw/boundaries/India-Districts-2011Census.$ext" \
    "$DM/India-Districts-2011Census.$ext"
done
echo "Fetched NFHS CSVs (IIPS/MoHFW via rchiips) and DataMeet 2011 district shapefile."
