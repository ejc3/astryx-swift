/**
 * The native module, as React Native's codegen reads it: the bridge of core/src/app.ts
 * carried over a module. `connected` and `changed` go out by a method; `getSnapshot` and
 * `dispatch` come in as an `onCall` event and are answered with `answered`. A native
 * module is called by JavaScript and never the other way, so an inbound operation is an
 * event with an id, and its answer a call with that id.
 */
import type { TurboModule } from "react-native";
import type { EventEmitter } from "react-native/Libraries/Types/CodegenTypes";
// By its own path: `react-native`'s index names every component, and the bundle would
// carry them all for a host that draws nothing.
import * as TurboModuleRegistry from "react-native/Libraries/TurboModule/TurboModuleRegistry";

export type BridgeCall = {
  /** Echoed in `answered`. */
  callId: number;
  /** "getSnapshot" or "dispatch". */
  operation: string;
  /** The store's name, or the action as JSON. */
  argument: string;
};

export interface Spec extends TurboModule {
  connected(bridgeVersion: number): void;
  changed(storeName: string, snapshotJSON: string): void;
  answered(callId: number, result: string | null, error: string | null): void;
  readonly onCall: EventEmitter<BridgeCall>;
  /** `{ screen?, theme? }` as JSON to start somewhere other than the first screen (the screen tour), or null. */
  start(): string | null;
}

export default TurboModuleRegistry.getEnforcing<Spec>("AXClient");
