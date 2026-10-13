#!/usr/bin/env bash
# Rebuilds the poster (SVG -> 150dpi PNG + PDF + preview JPG) into the parent folder.
# Optional: PHONE="০১৭XX-XXXXXX" ADDRESS="..." ./build.sh
set -e
cd "$(dirname "$0")"
cat > fonts.conf <<CONF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$PWD/fonts</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>/tmp/century-link-fc-cache</cachedir>
</fontconfig>
CONF
OUT=.. python3 gen_poster.py
FONTCONFIG_FILE="$PWD/fonts.conf" node make_print.js
[ -d node_modules/ag-psd ] || npm install --silent --no-audit --no-fund
FONTCONFIG_FILE="$PWD/fonts.conf" node make_psd.js
rm -f fonts.conf
