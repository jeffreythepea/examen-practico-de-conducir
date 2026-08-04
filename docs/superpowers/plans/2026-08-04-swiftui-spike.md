# SwiftUI Simulator Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while executing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a native SwiftUI app in the iOS Simulator that decodes the real production catalog, displays one real command, and plays one bundled Spanish MP3.

**Architecture:** XcodeGen produces a reproducible Xcode project from a tracked YAML specification. A small resource-sync script copies the production catalog and one manifest-selected recording into the app bundle; focused Swift types decode, select, display, and play those resources.

**Tech Stack:** Xcode, iOS Simulator, Swift 6, SwiftUI, Observation/Foundation, AVFoundation, XCTest, XcodeGen.

## Global Constraints

- Hard spike timebox: two to three hours beginning immediately before Xcode preflight; setup and downloads count.
- `/Applications/Xcode.app` is currently absent; installing it is the one known manual prerequisite.
- Use `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` per command; do not change the Mac's global `xcode-select` path.
- Target iOS 17 or later.
- Use production command `c-recto`, phrasing `c-recto-canonical`, and the Roger `0.9` recording selected from the manifest.
- No signing, physical-device install, persistence, scoring, backup import, or production-game changes.
- No credentials, network TTS, generated command text, or fabricated audio.

---

### Task 1: Toolchain and Reproducible Project Scaffold

**Files:**
- Create: `experiments/swiftui-spike/project.yml`
- Create: `experiments/swiftui-spike/README.md`
- Create: `experiments/swiftui-spike/scripts/select-ipad-simulator.mjs`
- Create: `experiments/swiftui-spike/scripts/select-ipad-simulator.test.mjs`
- Generate: `experiments/swiftui-spike/ExamenPracticoSpike.xcodeproj/`

**Interfaces:**
- Produces: Xcode scheme `ExamenPracticoSpike`, bundle ID `com.jeffreypease.ExamenPracticoSpike`, test target `ExamenPracticoSpikeTests`

- [ ] **Step 1: Satisfy the unavoidable Xcode prerequisite**

Verify:

```bash
test -d /Applications/Xcode.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -version
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl list devices available
```

If absent, stop and have Jeffrey install Xcode from the Mac App Store. Record the install/download as setup burden. Do not substitute a macOS Swift executable because the approved proof requires iOS Simulator.

- [ ] **Step 2: Install or verify XcodeGen**

Run:

```bash
command -v xcodegen || brew install xcodegen
xcodegen --version
```

This developer-tool installation may require one macOS/network approval. Record its elapsed time. Do not add XcodeGen to production dependencies.

- [ ] **Step 3: Create the project specification**

Create `project.yml`:

```yaml
name: ExamenPracticoSpike
options:
  bundleIdPrefix: com.jeffreypease
  deploymentTarget:
    iOS: "17.0"
settings:
  base:
    SWIFT_VERSION: "6.0"
targets:
  ExamenPracticoSpike:
    type: application
    platform: iOS
    sources:
      - path: ExamenPracticoSpike
        excludes:
          - Resources
    resources:
      - ExamenPracticoSpike/Resources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.jeffreypease.ExamenPracticoSpike
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
  ExamenPracticoSpikeTests:
    type: bundle.unit-test
    platform: iOS
    hostApplication: ExamenPracticoSpike
    sources:
      - ExamenPracticoSpikeTests
    dependencies:
      - target: ExamenPracticoSpike
```

- [ ] **Step 4: Add deterministic simulator selection**

Create `scripts/select-ipad-simulator.mjs` that:

1. runs no subprocess itself;
2. accepts the JSON from `xcrun simctl list devices available --json` on stdin;
3. selects the first available device whose name contains `iPad`;
4. prints its UDID; and
5. exits nonzero with `No available iPad simulator` when none exists.

Test it with a small inline JSON fixture using `node --test` in
`experiments/swiftui-spike/scripts/select-ipad-simulator.test.mjs`.

- [ ] **Step 5: Generate and inspect the project**

Run:

```bash
cd /Users/jeffreypease/Projects/examen-practico-de-conducir/experiments/swiftui-spike
xcodegen generate
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -list -project ExamenPracticoSpike.xcodeproj
```

Expected: app and test targets plus shared scheme `ExamenPracticoSpike`.

- [ ] **Step 6: Document exact recovery commands**

`README.md` must include absolute-path commands for resource sync, project generation, simulator selection, test, build, boot, install, launch, and screenshot. It must state that the prototype is experimental and excluded from the production runtime.

---

### Task 2: Production Resource Sync

**Files:**
- Create: `experiments/swiftui-spike/scripts/sync-resources.mjs`
- Create: `experiments/swiftui-spike/scripts/sync-resources.test.mjs`
- Generate and track: `experiments/swiftui-spike/ExamenPracticoSpike/Resources/commands.json`
- Generate and track: `experiments/swiftui-spike/ExamenPracticoSpike/Resources/c-recto-canonical-roger-0.9.mp3`

**Interfaces:**
- Produces: exact production catalog plus one checksum-verified selected recording in the application bundle

- [ ] **Step 1: Write failing sync tests**

Use a temporary destination and assert:

- copied `commands.json` bytes equal `data/commands.json`;
- chosen manifest record has ID `c-recto--c-recto-canonical--CwhRBWXzGAHq8TQ4Fs17--0.9`;
- copied MP3 bytes equal `25539`;
- copied MP3 SHA-256 equals `4abfa0afe52ad8126515a559da7c110c5f5d25f385ac2264886be17361d0a106`;
- no other audio file is copied; and
- missing/mismatched manifest integrity fails before replacing existing resources.

- [ ] **Step 2: Run sync tests to verify RED**

Run:

```bash
node --test experiments/swiftui-spike/scripts/sync-resources.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement atomic resource sync**

Export:

```js
export async function syncSwiftResources({
  root,
  destination,
  commandId = 'c-recto',
  phrasingId = 'c-recto-canonical',
  voiceId = 'CwhRBWXzGAHq8TQ4Fs17',
  speed = 0.9
}) {}
```

Read and validate both production arrays, verify bytes and SHA-256 from the manifest, copy into a sibling temporary directory, then replace the destination only after every check passes. The CLI calls this function using repository-relative paths derived from `import.meta.url`.

- [ ] **Step 4: Run sync and tests**

Run:

```bash
node --test experiments/swiftui-spike/scripts/sync-resources.test.mjs
node experiments/swiftui-spike/scripts/sync-resources.mjs
```

Expected: tests PASS and exactly two resource files exist.

---

### Task 3: Catalog Decoder and View Model

**Files:**
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/CatalogModels.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/CatalogLoader.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/CommandViewModel.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpikeTests/CatalogLoaderTests.swift`

**Interfaces:**
- Produces: `CatalogCommand`, `CatalogPhrasing`, `CatalogLoader.load(bundle:)`, `CommandViewModel.init(commands:commandID:phrasingID:)`

- [ ] **Step 1: Write failing XCTest cases**

Tests must assert:

```swift
let commands = try CatalogLoader.load(bundle: .main)
XCTAssertEqual(commands.count, 36)

let model = try CommandViewModel(
    commands: commands,
    commandID: "c-recto",
    phrasingID: "c-recto-canonical"
)
XCTAssertEqual(model.spanish, "Siga todo recto")
XCTAssertEqual(model.english, "continue straight ahead")
XCTAssertEqual(model.acceptedResult, "continue-forward")
```

Also assert unknown command/phrasing IDs throw typed `CatalogError` cases and no source text is rewritten.

- [ ] **Step 2: Run tests to verify RED**

After generating the project and choosing an available iPad UDID:

```bash
SIM_JSON="$(DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl list devices available --json)"
UDID="$(printf '%s' "$SIM_JSON" | node experiments/swiftui-spike/scripts/select-ipad-simulator.mjs)"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild test \
  -project experiments/swiftui-spike/ExamenPracticoSpike.xcodeproj \
  -scheme ExamenPracticoSpike \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath /tmp/examen-practico-swiftui-derived
```

Expected: FAIL because the app types are absent.

- [ ] **Step 3: Implement minimal decoding**

Use:

```swift
struct CatalogPhrasing: Decodable, Equatable {
    let id: String
    let es: String
    let en: String
}

struct CatalogCommand: Decodable, Equatable, Identifiable {
    let id: String
    let acceptedResult: String
    let phrasings: [CatalogPhrasing]
}

enum CatalogError: Error, Equatable {
    case missingResource
    case commandNotFound(String)
    case phrasingNotFound(String)
}
```

`CatalogLoader` resolves `commands.json` with `bundle.url(forResource:withExtension:)`, reads `Data`, and decodes `[CatalogCommand]`. `CommandViewModel` stores immutable `spanish`, `english`, and `acceptedResult`.

- [ ] **Step 4: Run XCTest to verify GREEN**

Run the exact `xcodebuild test` command from Step 2.

Expected: catalog and view-model tests PASS.

---

### Task 4: SwiftUI Display and Bundled Audio

**Files:**
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/AudioPlayer.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/InterfaceCopy.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/ContentView.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpike/ExamenPracticoSpikeApp.swift`
- Create: `experiments/swiftui-spike/ExamenPracticoSpikeTests/AudioResourceTests.swift`

**Interfaces:**
- Produces: simulator UI with one real command and `AudioPlayer.play()`

- [ ] **Step 1: Write the failing audio resource test**

Assert:

```swift
XCTAssertEqual(
    AudioPlayer.recordingResourceName,
    "c-recto-canonical-roger-0.9"
)
let url = Bundle.main.url(
    forResource: AudioPlayer.recordingResourceName,
    withExtension: "mp3"
)
XCTAssertNotNil(url)
XCTAssertEqual(try Data(contentsOf: url!).count, 25539)
```

- [ ] **Step 2: Run XCTest to verify RED**

Run the Task 3 `xcodebuild test` command.

Expected: FAIL until the resource is included correctly in the generated target.

- [ ] **Step 3: Implement the audio wrapper**

Use:

```swift
import AVFoundation
import Combine

@MainActor
final class AudioPlayer: ObservableObject {
    static let recordingResourceName = "c-recto-canonical-roger-0.9"
    @Published private(set) var errorMessage: String?
    private var player: AVAudioPlayer?

    func play(copy: InterfaceCopy) {
        guard let url = Bundle.main.url(
            forResource: Self.recordingResourceName,
            withExtension: "mp3"
        ) else {
            errorMessage = copy.missingAudio
            return
        }
        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.prepareToPlay()
            player?.play()
            errorMessage = nil
        } catch {
            errorMessage = copy.playbackFailed
        }
    }
}
```

Both error strings must also have Spanish equivalents selected by a simple EN/ES UI locale state; do not expose raw framework errors.

- [ ] **Step 4: Implement the minimal SwiftUI app**

Use `@main` and `WindowGroup`. `ContentView`:

- loads catalog once and constructs the `c-recto` model;
- shows **Examen Práctico / Practical Exam**;
- shows `Siga todo recto`;
- shows catalog value `continue straight ahead` in both modes under **Meaning**
  in English and **Significado en inglés** in Spanish;
- provides EN/ES buttons;
- provides a 44px minimum **Play Spanish / Reproducir español** button;
- displays the bilingual AI-generated-voice disclosure; and
- displays localized, nontechnical loading/audio errors.

No persistence or navigation.

Use these exact localized strings:

```swift
struct InterfaceCopy {
    let title: String
    let meaningLabel: String
    let play: String
    let disclosure: String
    let missingAudio: String
    let playbackFailed: String
}

let english = InterfaceCopy(
    title: "Practical Exam",
    meaningLabel: "Meaning",
    play: "Play Spanish",
    disclosure: "This Spanish voice is AI-generated.",
    missingAudio: "The bundled Spanish recording is unavailable.",
    playbackFailed: "The bundled Spanish recording could not be played."
)

let spanish = InterfaceCopy(
    title: "Examen Práctico",
    meaningLabel: "Significado en inglés",
    play: "Reproducir español",
    disclosure: "Esta voz en español ha sido generada por IA.",
    missingAudio: "La grabación en español no está disponible.",
    playbackFailed: "No se pudo reproducir la grabación en español."
)
```

Place `InterfaceCopy`, `english`, and `spanish` in `InterfaceCopy.swift`.
`ContentView` passes its current copy value to `audioPlayer.play(copy:)`.

- [ ] **Step 5: Run tests and generic simulator build**

Run:

```bash
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

Expected: tests and build PASS.

- [ ] **Step 6: Install, launch, and review in Simulator**

Run:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl boot "$UDID" || true
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl install "$UDID" \
  /tmp/examen-practico-swiftui-derived/Build/Products/Debug-iphonesimulator/ExamenPracticoSpike.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl launch "$UDID" \
  com.jeffreypease.ExamenPracticoSpike
open -a Simulator
```

Verify:

- app launches;
- real Spanish and English text appear;
- Play Spanish plays the bundled recording;
- EN/ES changes interface copy without changing command;
- portrait and landscape do not clip;
- no crash or Xcode console error.

Capture:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl io "$UDID" screenshot \
  docs/experiments/evidence/2026-08-04-swiftui/simulator.png
```

- [ ] **Step 7: Commit the bounded Swift result**

Update the lab and `.superpowers/sdd/progress.md`, then run:

```bash
node --test experiments/swiftui-spike/scripts/*.test.mjs
npm test
git diff --check
git status --short
```

Commit and push:

```bash
git add experiments/swiftui-spike docs/experiments .superpowers/sdd/progress.md
git commit -m "Add SwiftUI coding spike"
git push origin main
```
