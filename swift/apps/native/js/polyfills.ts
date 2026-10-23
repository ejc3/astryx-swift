/**
 * What Zero needs of the runtime that Hermes does not have, each defined only when missing.
 * Hermes has TextEncoder, atob and btoa, WeakRef, AbortController, performance and
 * queueMicrotask; Zero takes its randomness from Math.random, so it needs no crypto.
 *
 * - `Symbol.asyncIterator`: Zero's classes are async iterable (`[Symbol.asyncIterator]()`), and
 *   Babel's `for await` helper looks the method up by that symbol. Hermes has no such symbol, so
 *   the method would be stored under the key "undefined" and every `for await` would throw.
 *   The well-known symbol is made once, as the standard's polyfills make it.
 * - `TextDecoder`: Zero decodes every poke from the server with it (text-decoder.ts).
 * - `URL` and `URLSearchParams`: React Native has its own, which is not the standard's: it adds a
 *   "/" to a path (Zero's `/sync/v53/connect` becomes `/sync/v53/connect/`, which zero-cache
 *   refuses), and its search parameters do not write back to the URL. Where it is that one, the
 *   standard's takes its place (react-native-url-polyfill, its URL module only, pinned).
 *
 * (`structuredClone`, also missing, is only in a method of Zero's that the client never calls.)
 * Runs first in the bundle (index.ts), before any module that defines such a class.
 */
import { URL as StandardURL, URLSearchParams as StandardURLSearchParams } from "react-native-url-polyfill/js/URL";
import { Utf8Decoder } from "./text-decoder.ts";

if (typeof Symbol.asyncIterator !== "symbol") {
  Object.defineProperty(Symbol, "asyncIterator", { value: Symbol.for("Symbol.asyncIterator"), writable: false, enumerable: false, configurable: false });
}

const scope = globalThis as { TextDecoder?: unknown };
if (typeof scope.TextDecoder === "undefined") {
  Object.defineProperty(globalThis, "TextDecoder", { value: Utf8Decoder, writable: true, enumerable: false, configurable: true });
}

/** Whether this runtime's URL is the standard's, as far as Zero relies on it. */
function standardURL(): boolean {
  try {
    // The global as React Native types it (its own, partial URL); checked against what Zero uses.
    const url = new URL("http://h.example/a/b") as unknown as InstanceType<typeof StandardURL>;
    url.searchParams.set("k", "v w");
    return url.toString() === "http://h.example/a/b?k=v+w" && url.pathname === "/a/b" && url.hostname === "h.example";
  } catch {
    return false;
  }
}
if (!standardURL()) {
  for (const [name, value] of [["URL", StandardURL], ["URLSearchParams", StandardURLSearchParams]] as const)
    Object.defineProperty(globalThis, name, { value, writable: true, enumerable: false, configurable: true });
}
