/**
 * The bundle's entry. Nothing is rendered here: loading the bundle creates the core's
 * client, connects it to the native module, and tells the host it is there. SwiftUI
 * draws what the stores hold.
 */
// First: the runtime's own set-up (timers, console). With no React renderer in the
// bundle, nothing else would bring it in.
import "react-native/Libraries/Core/InitializeCore";

import { connectBridge, createClient, type Now } from "../../../core/src/index.ts";
import AXClient from "./specs/NativeAXClient";

const now = (): Now => ({ epochMs: Date.now(), utcOffsetMinutes: -new Date().getTimezoneOffset() });

function main(): void {
  const start = AXClient.start();
  const client = createClient(now, start === null ? undefined : JSON.parse(start));
  // The host's calls are answered from the moment the bridge exists; it asks for the
  // stores as soon as it hears `connected`, which connectBridge says last.
  let bridge: ReturnType<typeof connectBridge> | null = null;
  AXClient.onCall(({ callId, operation, argument }) => {
    try {
      if (bridge === null) throw new Error("The bridge is not connected yet");
      if (operation === "getSnapshot") AXClient.answered(callId, bridge.getSnapshot(argument), null);
      else if (operation === "dispatch") {
        bridge.dispatch(argument);
        AXClient.answered(callId, null, null);
      } else throw new Error(`No bridge operation is named ${JSON.stringify(operation)}`);
    } catch (error) {
      AXClient.answered(callId, null, error instanceof Error ? error.message : String(error));
    }
  });
  bridge = connectBridge(client, {
    connected: (version) => AXClient.connected(version),
    changed: (store, json) => AXClient.changed(store, json),
  });
}

try {
  main();
} catch (error) {
  console.error(`[astryx] The core did not start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
}
