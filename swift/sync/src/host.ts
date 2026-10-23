/**
 * A host's side of signing in (docs/SYNC.md, "Signing in, and signing out"), the same in the
 * Apple apps' Hermes runtime and the standalone web page: it starts and stops sync as the host's
 * sign-in says, keeps the device's own copy while signed out, and tells the core who is signed in
 * and the sync status.
 *
 * - Signed out, each change the core saves goes to the device copy (`writeDeviceDoc`).
 * - Signed in, `startSync` sends each change to Zero, and the device copy is not written: it stays
 *   as it was, for when the person signs out.
 * - Signing out stops sync and puts the device copy back into the core (`{type: "doc"}`).
 * - The token reaches this file and Zero, never the core, a snapshot or a log: the core is told
 *   the token's email and the sync status.
 */
import { readDoc, type Action, type Client, type Doc } from "@astryx-native/core";
import type { ZeroOptions } from "@rocicorp/zero";
import { readToken, startSync, type SyncHandle } from "./client.ts";

/** What the host's sign-in hands over: a token and where sync is, or null to sign out. */
export type Auth = {
  token: string;
  /** zero-cache's URL; the API's /native/login is on the same host. */
  syncURL: string;
  /** True on an actual sign-in (not a relaunch while signed in): the device's work may be uploaded to an empty account. */
  firstSignIn?: boolean;
} | null;

export type SyncHost = {
  client: Pick<Client, "dispatch" | "onSave">;
  /** Keeps the device's own copy (signed out only). */
  writeDeviceDoc(json: string): void;
  /** Zero's local store: op-sqlite on Apple platforms, "idb" in a browser, "mem" in tests. Made at each sign-in. */
  kvStore(): ZeroOptions["kvStore"];
  /** Diagnostics; never given a token. */
  log(message: string): void;
  /** More of Zero's options. */
  zeroOptions?: Partial<ZeroOptions>;
};

type Started = { sub: string; syncURL: string; token: string; handle: SyncHandle };

/**
 * Connects a host's core to its device copy and, while signed in, to Zero. `deviceDoc` is the
 * device copy the host started with (unchecked: the core reads it as a stored doc).
 */
export function connectSync(host: SyncHost, deviceDoc: unknown) {
  const { client } = host;
  let device: unknown = deviceDoc;
  let current: Started | null = null;
  const dispatch = (action: Action) => client.dispatch(action);

  client.onSave((_mutations, doc) => {
    if (current) return;
    device = doc;
    host.writeDeviceDoc(JSON.stringify(doc));
  });

  function start(token: string, sub: string, syncURL: string, upload: Doc | undefined): Started {
    const started: Started = { sub, syncURL, token, handle: null as unknown as SyncHandle };
    started.handle = startSync({
      client,
      cacheURL: syncURL,
      auth: token,
      userID: sub,
      kvStore: host.kvStore(),
      onStatus: (s) => current === started && dispatch({ type: "account", event: "status", state: s.state, pending: s.pending }),
      ...(upload ? { deviceDoc: upload, onFirstSignIn: (r: { seeded: string[]; kept: string[] }) => current === started && dispatch({ type: "account", event: "firstSignIn", seeded: r.seeded, kept: r.kept }) } : {}),
      onRefused: (name, message) => host.log(`sync: the server refused ${name}: ${message}`),
      zeroOptions: {
        logLevel: "error",
        ...host.zeroOptions,
        // Zero's defaults reload the page, which a Hermes runtime does not have.
        onUpdateNeeded: (reason: { type: string }) => host.log(`sync: Zero says this client is out of date (${reason.type})`),
        onClientStateNotFound: () => {
          // The server has forgotten this client: start again from what it has (no upload; the account's data wins).
          if (current !== started) return;
          host.log("sync: the server no longer knows this client; starting sync again");
          current = null;
          void started.handle.stop().then(() => {
            if (current === null) current = start(started.token, sub, syncURL, undefined);
          });
        },
      },
    });
    return started;
  }

  async function stop(): Promise<void> {
    const was = current;
    if (!was) return;
    current = null;
    await was.handle.stop();
    // The device's own copy again, as it was before signing in.
    dispatch({ type: "doc", doc: device });
  }

  return {
    /** The host's sign-in changed: a token (sign in, a relaunch while signed in, or a renewal), or null (sign out). */
    async auth(arg: Auth): Promise<void> {
      if (arg === null) {
        if (!current) return;
        await stop();
        dispatch({ type: "account", event: "signedOut", why: "requested" });
        return;
      }
      const claims = readToken(arg.token);
      if (!claims) throw new Error("auth: that is not a token");
      if (!/^https?:\/\/[^/?#]+(\/[^?#]*)?$/.test(arg.syncURL)) throw new Error("auth: syncURL is not a URL");
      if (current && current.sub === claims.sub && current.syncURL === arg.syncURL) {
        // A renewed token for the same person: Zero takes it at once.
        current.token = arg.token;
        dispatch({ type: "account", event: "signedIn", email: claims.email });
        await current.handle.setAuth(arg.token);
        return;
      }
      await stop();
      dispatch({ type: "account", event: "signedIn", email: claims.email });
      current = start(arg.token, claims.sub, arg.syncURL, arg.firstSignIn ? readDoc(device) : undefined);
    },
    /** Whether sync is running. */
    signedIn: () => current !== null,
  };
}
