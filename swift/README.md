# Astryx Swift

A spike: Astryx's design system on the web **and** natively on Apple platforms, from **one
state**. A TypeScript core holds every screen's state, data and logic; it runs in Hermes inside
the Mac and iPhone apps, and two UIs draw it at once: SwiftUI (AstryxKit) and the Astryx web
page. Tap in one, and the other follows, because there is nothing else to follow.

```
                         ┌──────────── the app ─────────────┐
 SwiftUI (AstryxKit) ◄── snapshots ── core in Hermes ── snapshots ──► Astryx web page (WKWebView)
        │                              ▲       ▲                              │
        └─────────── actions ──────────┘       └────────── actions ───────────┘
```

The starting point is Astryx as it is today: its own page templates (`npx astryx template`),
with their state in React. Ten of them are **refactored** onto the core, and the refactor is
held to one rule: the refactored web template must look **pixel for pixel** like the stock
one, at rest and after every interaction, in Chromium and WebKit, light and dark, desktop and
phone (`npm run parity -w web`: 1216 of 1216 comparisons identical).

## Four drawings, side by side

The apps show each screen four ways, and on a wide Mac (or a large iPad) all four at once:

| Drawing | UI | State |
|---|---|---|
| Native | SwiftUI, painted with Astryx's own tokens | the shared core, in Hermes |
| Web on Hermes | the refactored Astryx web page | the same shared core |
| Web, own core | the refactored web page, standalone | a core of its own, in the page (no Hermes) |
| Stock Astryx | Astryx's template as generated | its own React state |

## Scenarios

Each template ships with a scenario, recorded from its parity steps: where a person acted
(a locator by role and accessible name) and what the core received. In the app, pick one from
**Scenarios** and a driver:

- **Drive from native**: each step does what the SwiftUI control does; the web drawings follow.
- **Drive from web**: each step clicks and types in the web page on Hermes; the native side follows.

The panes with state of their own (web on its own core, stock) replay the same gestures in
parallel. Playback is state in the core, so every drawing shows it.

## Layout

```
core/            the portable core (TypeScript, run by Node, browsers and Hermes; no platform APIs)
  src/templates/   one folder per refactored Astryx template: state, data, logic, view model
  src/screens/     demo screens built from a generic node vocabulary (ui.ts)
  src/scenarios*   scenario types, playback, and the recorded scenarios
web/             the Astryx web host (Vite + React 19 + @astryxdesign/core)
  src/stock/       Astryx's templates as generated, on their own state (stock.html)
  src/templates/   the same templates refactored: Astryx's JSX drawing the core's view model
  public/astryx-drive.js  the in-page scenario driver
  scripts/         parity, scenario recording and replay, screenshots
apps/native/     the Apple apps
  js/              the Hermes bundle's entry and the native module's spec
  apple/AstryxKit  SwiftUI drawing of every node and template, painted with Astryx's tokens
  apple/Host       the headless React Native runtime, the native module, the web views
  apple/iOS, apple/macOS   the apps (XcodeGen + CocoaPods)
```

## Running it

Node 22.18 or later.

```sh
npm install
npm test                      # the core's tests
npm run build -w web          # the web page, and the copy the apps embed
npm run dev -w web            # the web page alone, on its own core
npm run parity -w web         # stock vs refactored, pixel for pixel (Playwright)
npm run record -w web         # re-record the scenarios from the parity steps
npm run replay -w web         # replay them on fresh pages and compare
node core/scripts/themes.mjs  # regenerate the theme tokens from Astryx's resolver
```

The apps, on a Mac with Xcode 26, xcodegen and CocoaPods:

```sh
cd apps/native && npm ci
cd apple/macOS && xcodegen generate && pod install   # or apple/iOS
open AstryxSwift.xcworkspace
```

Launch arguments: `-AXScreen t.inbox`, `-AXSurface all`, `-AXTheme ocean`,
`-AXScenario inbox:web`. `scripts/testflight.sh ios|macos` archives and uploads a build
(`TEAM_ID` in the environment; run it in the desktop session, where signing can reach the
keychain).

## Status

A spike. What is known to be rough is listed in the issues.

Astryx is © Meta Platforms, Inc. and affiliates, MIT licensed; its templates under
`web/src/stock/templates` are as `npx astryx template` generated them.
