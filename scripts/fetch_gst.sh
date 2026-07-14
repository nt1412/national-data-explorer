#!/usr/bin/env bash
# Fetch the official GSTN monthly GST data PDF (contains Table 2: pre/post-settlement SGST).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/gst
MONTH="${1:-mar_2025}"   # e.g. mar_2025, jan_2025, dec_2024
URL="https://tutorial.gst.gov.in/downloads/news/approved_monthly_gst_data_for_publishing_${MONTH}.pdf"
curl -sL -m 60 -o "data/raw/gst/gstn_${MONTH}.pdf" "$URL"
echo "Fetched data/raw/gst/gstn_${MONTH}.pdf ($(wc -c < data/raw/gst/gstn_${MONTH}.pdf) bytes)"
echo "Note: build_gst.py reads gstn_mar_2025.pdf by default (edit datasets/gst/adapter.py PDF path for another month)."
