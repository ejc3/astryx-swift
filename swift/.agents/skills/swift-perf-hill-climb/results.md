# Swift perf hill climb: results

Mac app, Release build, 120 Hz built-in display, the inbox scenario driven natively
(`inbox:native`, 27 steps), native drawing alone unless noted. "Gaps" are frame-meter gaps;
"hitches" are Instruments Animation Hitches.

| Date | Change | Before | After | Kept? | Note |
|---|---|---|---|---|---|
| 2026-10-19 | Baseline (Debug) | | 105 fps mean; 10 gaps >100 ms; max 532 ms | n/a | Native and "Native and web" measured the same. |
| 2026-10-19 | Baseline (Release) | | 105 fps mean; 10 gaps >100 ms; max 392 ms; 50 hitches, 12 >50 ms, worst 225 ms | n/a | Debug ≈ Release. Snapshot handling 5–15 ms each. |
| 2026-10-19 | Skip byte-identical snapshots; `Equatable` cut-off on `TemplateView` | 10 gaps >100 ms, max 392 | 11 gaps >100 ms, max 427 | Skip kept, cut-off reverted | No measurable change: the template is what changes. |
| 2026-10-19 | Per-step attribution (no code change) | | Gaps of 290–450 ms follow sheet and overlay steps (viewer open and close, composer open, close, discard); content steps cost 40–90 ms; first thread open 449 ms | n/a | Sheet gaps are AppKit's sheet animation on the main thread. |
