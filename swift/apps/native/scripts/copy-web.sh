#!/bin/sh
# Copies the built web page (web/dist) into the app as `web/`, for the web drawing.
# Build it first: `npm run build -w web` at the repository root.
set -e
here=$(cd "$(dirname "$0")" && pwd)
dist="$here/../../../web/dist"
[ -f "$dist/index.html" ] || { echo "error: no web/dist/index.html. Run 'npm run build -w web' at the repository root first." >&2; exit 1; }
rm -rf "$1"
mkdir -p "$1"
cp -R "$dist/." "$1/"
