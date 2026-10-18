/**
 * Scenarios: scripted walks through a template, shipped in the app so anyone can watch one
 * play, driven from the native side or from the web side, with the other drawings following.
 *
 * Each scenario is recorded (web/scripts/record-scenarios.mjs) from the template's parity
 * steps, which drive the web page as a person would. A step keeps both halves of what
 * happened: where the person acted (a locator chain any web drawing can resolve: Hermes web,
 * own-core web, stock) and what the core received (the actions the native driver sends
 * itself). Playback is state in the core, so every drawing shows it.
 */
import type { Action } from "./ui.ts";

/**
 * One link of a locator chain, as Playwright names it; a web driver resolves it in the page
 * (web/public/astryx-drive.js). A `name` or `text` written "/source/flags" is a regular
 * expression; any other string matches as Playwright does (case-insensitive substring, or
 * equal when `exact`).
 */
export type LocatorOp =
  | { by: "role"; role: string; name?: string; exact?: boolean }
  | { by: "label"; text: string; exact?: boolean }
  | { by: "text"; text: string; exact?: boolean }
  | { by: "placeholder"; text: string; exact?: boolean }
  | { by: "css"; selector: string }
  | { by: "nth"; index: number };

/** What the person did there. */
export type Gesture =
  | { kind: "click" }
  | { kind: "fill"; text: string }
  | { kind: "check" }
  | { kind: "uncheck" }
  | { kind: "select"; value: string }
  | { kind: "press"; key: string }
  | { kind: "hover" }
  /** Press on the target, move to `to`, release just above or below it (a card dragged between cards). */
  | { kind: "drag"; to: LocatorOp[]; edge: "above" | "below" | "center" };

export type ScenarioStep = {
  caption: string;
  /** Each gesture of the step, where it happened; empty for a step that only waits. */
  gestures: { target: LocatorOp[]; gesture: Gesture }[];
  /** What the core received during the step, in order: the native driver sends exactly these. */
  actions: Action[];
};

export type Scenario = { id: string; template: string; title: string; steps: ScenarioStep[] };

export type Driver = "native" | "web";

export type Playback = {
  scenario: string;
  driver: Driver;
  step: number;
  status: "playing" | "paused" | "done";
};

/** What a host needs to show the scenarios and play the current step. */
export type ScenariosSnapshot = {
  label: string;
  list: { id: string; title: string; template: string; steps: string }[];
  drivers: { value: Driver; label: string; description: string }[];
  playing: null | {
    id: string;
    title: string;
    driver: Driver;
    status: Playback["status"];
    progress: string;
    caption: string;
    /** The step to perform now (null when paused or done). The host reports `scenario.done:<n>`. */
    step: null | { index: number } & ScenarioStep;
    controls: { pauseId: string; resumeId: string; stopId: string; pauseLabel: string; resumeLabel: string; stopLabel: string };
  };
};
