// The Hermes TextDecoder (text-decoder.ts) against Node's, which implements the same standard.
//   node --test js/text-decoder.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { Utf8Decoder } from "./text-decoder.ts";

const encoder = new TextEncoder();
let seed = 7;
const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/** Bytes that mix valid text with every kind of trouble: stray continuations, overlongs, surrogates, cut sequences. */
function mixed(n: number): Uint8Array {
  const parts: number[] = [];
  const pieces = [
    () => [...encoder.encode("héllo, wörld — 日本語 🎉")],
    () => [0x80], () => [0xbf], () => [0xc0, 0xaf], () => [0xc1, 0xbf], () => [0xe0, 0x80, 0xaf], () => [0xed, 0xa0, 0x80],
    () => [0xf0, 0x8f, 0xbf, 0xbf], () => [0xf4, 0x90, 0x80, 0x80], () => [0xf5], () => [0xff], () => [0xe2, 0x82], () => [0xf0, 0x9f, 0x8e],
    () => [0xef, 0xbb, 0xbf], () => [Math.floor(random() * 256)],
  ];
  while (parts.length < n) parts.push(...pieces[Math.floor(random() * pieces.length)]!());
  return Uint8Array.from(parts);
}

test("decodes as Node's TextDecoder does, invalid bytes and byte order marks included", () => {
  for (let k = 0; k < 400; k++) {
    const bytes = mixed(1 + Math.floor(random() * 60));
    for (const ignoreBOM of [false, true]) {
      assert.equal(new Utf8Decoder("utf-8", { ignoreBOM }).decode(bytes), new TextDecoder("utf-8", { ignoreBOM }).decode(bytes), `bytes ${[...bytes]}`);
    }
  }
});

test("streams across chunk boundaries as Node's does, at every split", () => {
  for (let k = 0; k < 120; k++) {
    const bytes = mixed(4 + Math.floor(random() * 30));
    for (let cut = 0; cut <= bytes.length; cut++) {
      const ours = new Utf8Decoder();
      const node = new TextDecoder();
      const a = ours.decode(bytes.subarray(0, cut), { stream: true }) + ours.decode(bytes.subarray(cut));
      const b = node.decode(bytes.subarray(0, cut), { stream: true }) + node.decode(bytes.subarray(cut));
      assert.equal(a, b, `bytes ${[...bytes]} cut at ${cut}`);
    }
  }
});

test("fatal: valid text decodes, streamed or not; anything invalid throws a TypeError, as Node's does", () => {
  const text = "pokes: {\"rows\":[\"Zoë\",\"東京\",\"🎉\"]}";
  const bytes = encoder.encode(text);
  const d = new Utf8Decoder("utf-8", { fatal: true });
  let streamed = "";
  for (let i = 0; i < bytes.length; i += 3) streamed += d.decode(bytes.subarray(i, i + 3), { stream: true });
  streamed += d.decode();
  assert.equal(streamed, text);
  for (let k = 0; k < 300; k++) {
    const bad = mixed(1 + Math.floor(random() * 20));
    let nodeThrew = false;
    try { new TextDecoder("utf-8", { fatal: true }).decode(bad); } catch { nodeThrew = true; }
    if (nodeThrew) assert.throws(() => new Utf8Decoder("utf-8", { fatal: true }).decode(bad), TypeError, `bytes ${[...bad]}`);
    else assert.equal(new Utf8Decoder("utf-8", { fatal: true }).decode(bad), new TextDecoder("utf-8", { fatal: true }).decode(bad));
  }
});

test("takes ArrayBuffers and views, refuses other encodings and inputs", () => {
  const bytes = encoder.encode("abc");
  assert.equal(new Utf8Decoder().decode(bytes.buffer), "abc");
  assert.equal(new Utf8Decoder().decode(new DataView(bytes.buffer, 1, 2)), "bc");
  assert.equal(new Utf8Decoder().decode(), "");
  assert.equal(new Utf8Decoder("UTF8").encoding, "utf-8");
  assert.throws(() => new Utf8Decoder("latin1"), RangeError);
  assert.throws(() => new Utf8Decoder().decode("abc" as unknown as Uint8Array), TypeError);
});
