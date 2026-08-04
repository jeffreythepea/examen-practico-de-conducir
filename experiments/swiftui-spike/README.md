# SwiftUI Simulator Spike

This is an experimental, simulator-only native proof. It is excluded from the
production web runtime and does not add signing, persistence, scoring, network
TTS, or physical-device installation.

## Prerequisites

- Xcode at `/Applications/Xcode.app`
- an installed iOS Simulator runtime
- XcodeGen installed with Homebrew

All commands below use the repository at:

`/Users/jeffreypease/Projects/examen-practico-de-conducir`

## Reproduce

Sync the exact production catalog and the checksum-verified Roger recording:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
node experiments/swiftui-spike/scripts/sync-resources.mjs
```

Generate the Xcode project:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir/experiments/swiftui-spike
xcodegen generate
```

Select the first available iPad Simulator:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl list devices available --json \
  | node experiments/swiftui-spike/scripts/select-ipad-simulator.mjs
```

Set that printed value as `UDID`, then test and build:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
UDID="PASTE-IPAD-UDID"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test \
  -project experiments/swiftui-spike/ExamenPracticoSpike.xcodeproj \
  -scheme ExamenPracticoSpike \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath /tmp/examen-practico-swiftui-derived
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild build \
  -project experiments/swiftui-spike/ExamenPracticoSpike.xcodeproj \
  -scheme ExamenPracticoSpike \
  -sdk iphonesimulator \
  -derivedDataPath /tmp/examen-practico-swiftui-derived
```

Boot, install, and launch:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
UDID="PASTE-IPAD-UDID"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl boot "$UDID"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl install "$UDID" \
  /tmp/examen-practico-swiftui-derived/Build/Products/Debug-iphonesimulator/ExamenPracticoSpike.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl launch "$UDID" com.jeffreypease.ExamenPracticoSpike
open -a Simulator
```

Capture evidence:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
mkdir -p docs/experiments/evidence/2026-08-04-swiftui
UDID="PASTE-IPAD-UDID"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl io "$UDID" screenshot \
  docs/experiments/evidence/2026-08-04-swiftui/simulator-portrait.png
```

Rotate the device with the Simulator toolbar, verify the interface again, then
capture:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir
UDID="PASTE-IPAD-UDID"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl io "$UDID" screenshot \
  docs/experiments/evidence/2026-08-04-swiftui/simulator-landscape.png
```
