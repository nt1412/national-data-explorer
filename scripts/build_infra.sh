#!/usr/bin/env bash
# Fetch + build the Maharashtra infrastructure overlay (OSM industrial+malls, OurAirports).
# Usage: bash scripts/build_infra.sh   (region fixed to Maharashtra / IN-MH for v1)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/infra

REGION="IN-MH"
Q="[out:json][timeout:170];area[\"ISO3166-2\"=\"$REGION\"]->.a;way[\"landuse\"=\"industrial\"](area.a);out center tags;nwr[\"shop\"=\"mall\"](area.a);out center tags;"
echo "Overpass pull (industrial + malls) for $REGION ..."
curl -s -m 200 "https://overpass-api.de/api/interpreter" --data-urlencode "data=$Q" -o data/raw/infra/osm.json
echo "OurAirports CSV ..."
curl -sL -m 60 "https://davidmegginson.github.io/ourairports-data/airports.csv" -o data/raw/infra/airports.csv

python3 scripts/build_infra.py
