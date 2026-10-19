---
name: swift-perf-hill-climb
description: Measure and improve the frame rate of the Astryx Swift apps (the SwiftUI drawing of the shared core, Mac and iPhone) one measured change at a time. Use when asked about fps, hitches, jank, stutter, slow updates or scrolling, Instruments, or "make the Swift side faster", and before and after any change to AppModel, ClientHost, NodeView, the template views or how snapshots reach SwiftUI.
---

# Swift perf hill climb

A hill climb: measure, form one hypothesis, make one change, measure again the same way, keep it
only if the numbers moved, and write the result down in `results.md` next to this file. Never
batch two changes into one measurement; never keep a change on a hunch.

## What is measured

Each update from the core (a JSON snapshot of the whole app, about 40 kB) reaches
`ClientHost.deliver` → `AppModel.receive` → `@Published app` → SwiftUI re-evaluates the screen.
The scenarios (Scenarios menu, or `-AXScenario <id>:native` at launch) replay a template's
recorded steps at a steady pace, so the same run can be repeated before and after a change.

Two instruments, used together:

1. **The frame meter** (`apps/native/apple/Host/FrameMeter.swift`, on with `-AXFrameMeter YES`).
   A display link on the main run loop: each second it prints refreshes served, late frames and
   the longest gap; it also prints each gap over 50 ms and each snapshot's arrival, size,
   handling time and scenario step. A main thread that is busy, or blocked, shows here.
   `scripts/frames.sh APP_BINARY inbox:native` runs a scenario and prints the summary and every
   long gap next to the step that caused it.
2. **Instruments, from the command line** (`scripts/trace.sh APP_BUNDLE "Animation Hitches"` or
   `"Time Profiler"`). Hitches gives Apple's own verdict per late frame (app update, render, GPU);
   Time Profiler gives where the main thread's time went and its longest busy bursts. Needs
   Developer Mode (`DevToolsSecurity -status`). Export and summaries are in `scripts/hitches.py`
   and `scripts/profile.py`.

## The loop

1. **Build Release** for measuring (`xcodebuild -configuration Release`, ad-hoc signing is
   enough to run locally). Debug numbers are not comparable with the shipped app.
2. **Baseline**: `frames.sh` three times, and one `Animation Hitches` trace. Record mean fps,
   gaps over 50 and 100 ms, max gap, and hitches over 50 ms.
3. **Find the step**: read the per-gap lines. A gap right after a step's snapshot is that step's
   update. Gaps that appear only on sheet or overlay steps are presentation animations (below).
4. **Find the code**: a Time Profiler trace of the same scenario; read the longest bursts and
   "deepest frame of our own code".
5. **One change**, one hypothesis written down first ("decoding is the cost" / "the whole tree
   re-renders").
6. **Measure exactly as in 2.** Keep the change if gaps or hitches dropped beyond run-to-run noise
   (repeat runs differ by about ±1 gap over 100 ms); otherwise revert it.
7. **Write a row in `results.md`**: date, change, before, after, kept or reverted, and why.
8. Run the kit's tests (`swift build --build-tests`, then the xctest bundle) and an iOS compile
   check before keeping anything.

## What is already known (see results.md for the numbers)

- Idle is a steady 120 fps on a 120 Hz display; the cost is in updates.
- Handling a snapshot (decode plus handing it to the web panes) is 5–15 ms: not the hitch.
- Main-thread time during updates is SwiftUI's attribute graph (`AG::Graph::UpdateStack::update`),
  AppKit layout (`NSView _layoutSubtreeWithOldSize`) and Core Animation commits.
- On macOS, opening or closing a `.sheet` stops the app's frames for about 300–450 ms while
  AppKit animates it (`NSSheetMoveHelper`); the frame meter shows it, Hitches mostly does not.
  Measure sheet steps separately from content steps.
- Debug and Release measured the same here; the cost is not unoptimized code.
- Skipping a byte-identical snapshot is free and kept. An `Equatable` cut-off on the template view
  made no measurable difference (the template is the part that changes) and was reverted.

## Ideas not yet tried, roughly by expected value

- Diff snapshots in the core and publish only the stores and subtrees that changed, so SwiftUI
  observes small models (`@Observable` per template) instead of one `@Published` root.
- Decode a template's typed model once per snapshot in `AppModel`, not in each template's `body`
  (`JSONValue.decode` round-trips through `JSONEncoder` and `JSONDecoder`).
- Lazy stacks (`LazyVStack`) for long lists, stable `id`s everywhere, no `AnyView` in rows.
- First-open costs (the first thread opened): pre-warm or keep the pane's view alive.
- Sheets: measure whether an inline overlay is smoother; a sheet is the Mac convention, so only
  change it with the owner's agreement.

## Rules

- The numbers in `results.md` come from runs you did; never estimate one.
- Same machine, same build configuration, same scenario, the app frontmost, nothing else heavy
  running (check the load average) for every before and after.
- Never kill `xctrace record` before it prints "Output file saved"; the trace is lost.
- A change that makes the native drawing differ from the web one is not a perf win: the parity
  rules in `AGENTS.md` still hold.
