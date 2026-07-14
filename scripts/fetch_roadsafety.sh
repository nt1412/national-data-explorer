#!/usr/bin/env bash
# Fetch road-safety sources: opencity MoRTH tables (2023 + 2024 editions) + state boundary.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/roadsafety data/raw/boundaries

resolve() {  # $1=dataset id  $2=resource-name substring (lowercased) -> prints CSV url
  curl -s -m 30 "https://data.opencity.in/api/3/action/package_show?id=$1" \
   | python3 -c "import sys,json;r=json.load(sys.stdin)['result']['resources']
print(next((x['url'] for x in r if '$2' in x.get('name','').lower() and x.get('format','').upper()=='CSV'),''))"
}

for ds in 2023 2024; do
  id="road-accidents-in-india-$ds"
  curl -sL -o "data/raw/roadsafety/${ds}_state_acc.csv" "$(resolve "$id" 'state-wise road accidents')"
  curl -sL -o "data/raw/roadsafety/${ds}_state_fat.csv" "$(resolve "$id" 'state-wise road fatalities')"
  curl -sL -o "data/raw/roadsafety/${ds}_cities.csv"    "$(resolve "$id" 'large cities road accidents and fatalities')"
done

DM="https://raw.githubusercontent.com/datameet/maps/master/Survey-of-India-Index-Maps/Boundaries"
for ext in shp dbf shx prj; do
  curl -sL -o "data/raw/boundaries/India-States.$ext" "$DM/India-States.$ext"
done
echo "Fetched MoRTH state/city tables + DataMeet state boundary."
