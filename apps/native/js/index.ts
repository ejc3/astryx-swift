/**
 * The bundle's entry. Nothing is rendered here: loading the bundle creates the core's
 * client, connects it to the native module, and tells the host it is there. SwiftUI
 * draws what the stores hold.
 */
// First: what Hermes lacks for Zero (polyfills.ts), then the runtime's own set-up (timers,
// console). With no React renderer in the bundle, nothing else would bring it in.
import "./polyfills.ts";
import "react-native/Libraries/Core/InitializeCore";

import { connectBridge, createClient, type ClientStart, type Now } from "../../../core/src/index.ts";
import AXClient from "./specs/NativeAXClient";
import { connectSync, type Auth } from "@astryx-native/sync/host";

const now = (): Now => ({ epochMs: Date.now(), utcOffsetMinutes: -new Date().getTimezoneOffset() });

/** What the host starts the core with; signed in, the device copy comes as `deviceDoc`, and the core starts without it. */
type Start = ClientStart & { deviceDoc?: unknown };

function main(): void {
  const raw = AXClient.start();
  const start: Start = raw === null ? {} : (JSON.parse(raw) as Start);
  const { deviceDoc, ...clientStart } = start;
  const client = createClient(now, clientStart);
  // Signed out, the device copy is kept by the host (docs/SYNC.md); it arrives as the store "doc".
  // Signed in, Zero keeps the account's data on SQLite.
  const sync = connectSync({
    client,
    writeDeviceDoc: (json) => AXClient.changed("doc", json),
    kvStore: opSQLite,
    log: (message) => console.warn(`[astryx] ${message}`),
  }, deviceDoc ?? clientStart.doc);
  // The host's calls are answered from the moment the bridge exists; it asks for the
  // stores as soon as it hears `connected`, which connectBridge says last.
  let bridge: ReturnType<typeof connectBridge> | null = null;
  const failed = (callId: number, error: unknown) => AXClient.answered(callId, null, error instanceof Error ? error.message : String(error));
  AXClient.onCall(({ callId, operation, argument }) => {
    try {
      if (bridge === null) throw new Error("The bridge is not connected yet");
      if (operation === "getSnapshot") AXClient.answered(callId, bridge.getSnapshot(argument), null);
      else if (operation === "dispatch") {
        bridge.dispatch(argument);
        AXClient.answered(callId, null, null);
      } else if (operation === "auth") {
        // Sign in (a token and where sync is) or out (null). The token stays here and in Zero.
        sync.auth(JSON.parse(argument) as Auth).then(() => AXClient.answered(callId, null, null), (error: unknown) => failed(callId, error));
      } else throw new Error(`No bridge operation is named ${JSON.stringify(operation)}`);
    } catch (error) {
      failed(callId, error);
    }
  });
  bridge = connectBridge(client, {
    connected: (version) => AXClient.connected(version),
    changed: (store, json) => AXClient.changed(store, json),
  });
}

/**
 * Zero's store on SQLite (op-sqlite), loaded at the first sign-in: op-sqlite installs its native
 * half when its module is first run, which a person who never signs in never needs.
 */
function opSQLite() {
  const { opSQLiteStoreProvider } = require("@rocicorp/zero/op-sqlite") as typeof import("@rocicorp/zero/op-sqlite");
  return opSQLiteStoreProvider();
}
declare function require(name: string): unknown;

try {
  main();
} catch (error) {
  console.error(`[astryx] The core did not start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
}
