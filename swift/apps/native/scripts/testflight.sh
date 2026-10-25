#!/bin/bash
# Archives the iPhone/iPad or the Mac app, signs it and uploads it to App Store Connect,
# where TestFlight gives it to internal testers once Apple has processed it.
#
#   TEAM_ID=<team> scripts/testflight.sh ios|macos
#
# Run it in the Mac's desktop session (signing needs the login keychain; over SSH, start it
# as a one-off LaunchAgent: see the README). Signing is automatic, with the account Xcode
# is signed in to. BUNDLE_ID (default io.github.ejc3.astryxswift) names the app record,
# made once by hand in App Store Connect: Apple's API cannot make one. BUILD_DIR takes the
# archive, the export and DerivedData (default build/). Build web/ first (pnpm --filter ./web build).
set -euo pipefail
: "${TEAM_ID:?set TEAM_ID to the Apple developer team}"
platform=${1:?ios or macos}
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
cd "$(dirname "$0")/.."
build=${BUILD_DIR:-build}/$platform
BUNDLE_ID=${BUNDLE_ID:-io.github.ejc3.astryxswift}
BUILD_NUMBER=${BUILD_NUMBER:-$(date -u +%Y%m%d%H%M)}
for tool in node xcodegen pod xcodebuild; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }; done
case $platform in
  ios) dir=apple/iOS; destination=generic/platform=iOS ;;
  macos) dir=apple/macOS; destination=generic/platform=macOS ;;
  *) echo "ios or macos, not $platform" >&2; exit 2 ;;
esac

pnpm install --frozen-lockfile
(cd "$dir" && xcodegen generate && pod install)

archive=$build/AstryxSwift.xcarchive
mkdir -p "$build" && rm -rf "$archive" "$build/export"
xcodebuild -workspace "$dir/AstryxSwift.xcworkspace" -scheme AstryxSwift -configuration Release \
  -destination "$destination" -derivedDataPath "$build/dd" -archivePath "$archive" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" archive
cat > "$build/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$archive" -exportPath "$build/export" -exportOptionsPlist "$build/ExportOptions.plist" -allowProvisioningUpdates
echo "Uploaded build $BUILD_NUMBER of $BUNDLE_ID for $platform. TestFlight shows it once Apple has processed it."
