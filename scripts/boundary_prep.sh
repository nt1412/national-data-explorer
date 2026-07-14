#!/usr/bin/env bash
# DataMeet 2011 district shapefile -> simplified TopoJSON keyed on censuscode.
# ~10x smaller; safe to ship to a browser. Requires Node.js (uses npx mapshaper).
set -euo pipefail
cd "$(dirname "$0")/.."
npx -y mapshaper data/raw/boundaries/India-Districts-2011Census.shp \
  -filter-fields censuscode,DISTRICT,ST_NM \
  -simplify 8% keep-shapes \
  -o format=topojson web/nfhs/data/districts.topo.json
echo "Wrote web/nfhs/data/districts.topo.json"

# States layer for the road-safety explorer (keyed on ST_NM — the states file has no code).
if [ -f data/raw/boundaries/India-States.shp ]; then
  mkdir -p web/roadsafety/data
  npx -y mapshaper data/raw/boundaries/India-States.shp \
    -filter-fields ST_NM -simplify 6% keep-shapes \
    -o format=topojson web/roadsafety/data/states.topo.json
  echo "Wrote web/roadsafety/data/states.topo.json"
fi
