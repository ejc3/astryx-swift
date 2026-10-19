# Astryx Swift: rules for coding agents

Read `README.md` first.

- **One state, in the core.** Everything a screen shows (every word, number, sort, filter,
  validation message, open menu, selection) is computed in `core/`. The web page and the Swift
  apps draw a view model and send actions; they decide nothing. If you find logic or English in
  a host, move it into the core's view model.
- **The core is portable.** `core/src` runs in Node, browsers and Hermes: no Node or DOM APIs,
  no `Intl`, no clock (`now` is an argument), no randomness. `npx eslint` in `core/` enforces it.
- **Stock Astryx is the specification.** A refactored template (`web/src/templates/<id>.tsx`)
  keeps Astryx's JSX and must match its stock copy pixel for pixel:
  `npm run parity -w web -- <id>` must report every comparison identical. Don't change the stock
  copies; change the refactored copy or the core until they match.
- **Scenarios are recorded, not written.** Change a template's parity steps
  (`web/scripts/parity-steps/<id>.mjs`), then `npm run record -w web` and `npm run replay -w web`.
- **Swift:** one filename per target (SwiftPM refuses duplicates); prefix a template's types
  and files with its name. Draw from the model; send its action ids exactly.
- **Performance:** for frame rate, hitches or anything that changes how snapshots reach SwiftUI,
  follow the `swift-perf-hill-climb` skill (`.agents/skills/swift-perf-hill-climb/SKILL.md`; Claude
  Code finds it through `.claude/skills`): measure, one change, measure again, log it in its
  `results.md`.
- **Checks before committing:** `npm test`, `npx tsc --noEmit -p core/tsconfig.test.json`,
  `npx eslint` in `core/`, `npm run typecheck -w web`, and for template changes the parity run
  for that template. On the Mac: `swift build` and `swift test` in `apps/native/apple/AstryxKit`.
- **Public repository:** no personal names, emails, hostnames, account or team ids, local paths
  or secrets in files, commits or PR text. Sample data uses `.example` domains.
- **Astryx:** `@astryxdesign/core` and `@astryxdesign/cli` are pinned exactly; upgrade both in a
  pull request of their own with Astryx's codemods. The unscoped `astryx` npm package is
  someone else's: run `npx astryx` only where `@astryxdesign/cli` is installed.
