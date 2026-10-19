#!/bin/sh
# Records an Instruments trace of the running Mac app while a scenario plays, then summarizes it.
#
#   trace.sh APP_BUNDLE TEMPLATE [SCENARIO] [SECONDS]
#     APP_BUNDLE  .../AstryxSwift.app (a Release build)
#     TEMPLATE    "Animation Hitches" or "Time Profiler"
#     SCENARIO    e.g. inbox:native (default)
#     SECONDS     recording length (default 30)
#
# Needs Developer Mode (DevToolsSecurity -status says enabled) and the desktop session. Never kill
# `xctrace record` before it prints "Output file saved": a trace cut off while saving cannot be
# exported ("Document Missing Template Error").
set -eu
app=${1:?app bundle}
template=${2:?Animation Hitches or Time Profiler}
scenario=${3:-inbox:native}
seconds=${4:-30}
out=$(mktemp -d -t trace)/run.trace
open -n "$app" --args -AXScreen "t.${scenario%%:*}" -AXSurface native -AXScenario "$scenario"
sleep 4
pid=$(pgrep -nx AstryxSwift)
xcrun xctrace record --template "$template" --attach "$pid" --time-limit "${seconds}s" --output "$out" >/dev/null
kill "$pid" 2>/dev/null || true
here=$(dirname "$0")
case $template in
  "Animation Hitches") python3 "$here/hitches.py" "$out" ;;
  "Time Profiler") python3 "$here/profile.py" "$out" ;;
esac
echo "trace: $out"
