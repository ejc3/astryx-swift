#!/bin/sh
# Plays one scenario in the Mac app with the frame meter on and prints a one-line summary plus
# every long gap next to the scenario step that caused it.
#
#   frames.sh APP_BINARY [SCENARIO] [SURFACE] [SECONDS]
#     APP_BINARY  .../AstryxSwift.app/Contents/MacOS/AstryxSwift (a Release build)
#     SCENARIO    a scenario id and driver, e.g. inbox:native (default)
#     SURFACE     native | web | compare | all (default native)
#     SECONDS     how long to run (default 45)
#
# Run it in the logged-in desktop session (the app needs a window server). The app prints the
# meter's lines on standard error; see apps/native/apple/Host/FrameMeter.swift.
set -eu
bin=${1:?app binary}
scenario=${2:-inbox:native}
surface=${3:-native}
seconds=${4:-45}
template=${scenario%%:*}
log=$(mktemp -t frames)
"$bin" -AXFrameMeter YES -AXScreen "t.$template" -AXSurface "$surface" -AXScenario "$scenario" 2>"$log" >/dev/null &
app=$!
sleep "$seconds"
kill "$app" 2>/dev/null || true
wait "$app" 2>/dev/null || true
python3 "$(dirname "$0")/summarize_frames.py" "$log"
rm -f "$log"
