/**
 * `TextDecoder` for UTF-8, for Hermes, which has `TextEncoder` but no decoder. Zero decodes every
 * poke from the server with it (`new TextDecoder("utf-8", {fatal: true})`, then `decode(chunk,
 * {stream: true})` per chunk), so it is needed for sync to work at all.
 *
 * It is the Encoding Standard's UTF-8 decoder (https://encoding.spec.whatwg.org/#utf-8-decoder),
 * step for step: invalid input is U+FFFD per maximal subpart, or a TypeError when `fatal`; a
 * sequence cut at the end of a streamed chunk waits for the next; a leading byte order mark is
 * dropped unless `ignoreBOM`. Only UTF-8 is offered; any other label is a RangeError, as a
 * decoder that does not know a label must answer. Checked against Node's decoder
 * (text-decoder.test.ts).
 */
type Options = { fatal?: boolean; ignoreBOM?: boolean };

const LABELS = ["unicode-1-1-utf-8", "unicode11utf8", "unicode20utf8", "utf-8", "utf8", "x-unicode20utf8"];
const REPLACEMENT = 0xfffd;

function bytesOf(input: unknown): Uint8Array {
  if (input === undefined) return new Uint8Array(0);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("The input to decode must be an ArrayBuffer or a view of one");
}

export class Utf8Decoder {
  readonly encoding = "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  // The decoder's state between streamed chunks (the standard's names).
  private codePoint = 0;
  private bytesSeen = 0;
  private bytesNeeded = 0;
  private lowerBoundary = 0x80;
  private upperBoundary = 0xbf;
  private bomSeen = false;

  constructor(label = "utf-8", options: Options = {}) {
    if (!LABELS.includes(String(label).trim().toLowerCase())) throw new RangeError(`The encoding "${String(label)}" is not supported`);
    this.fatal = options.fatal === true;
    this.ignoreBOM = options.ignoreBOM === true;
  }

  decode(input?: unknown, options: { stream?: boolean } = {}): string {
    const bytes = bytesOf(input);
    const units: number[] = [];
    const out: string[] = [];
    const flush = () => {
      for (let i = 0; i < units.length; i += 8192) out.push(String.fromCharCode.apply(null, units.slice(i, i + 8192)));
      units.length = 0;
    };
    const emit = (cp: number) => {
      if (cp > 0xffff) {
        const c = cp - 0x10000;
        units.push(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
      } else units.push(cp);
      if (units.length >= 16384) flush();
    };
    const error = (): void => {
      if (this.fatal) {
        this.resetSequence();
        this.bomSeen = false;
        throw new TypeError("The encoded data was not valid UTF-8");
      }
      emit(REPLACEMENT);
    };

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!;
      if (this.bytesNeeded === 0) {
        if (byte <= 0x7f) emit(byte);
        else if (byte >= 0xc2 && byte <= 0xdf) { this.bytesNeeded = 1; this.codePoint = byte & 0x1f; }
        else if (byte >= 0xe0 && byte <= 0xef) {
          if (byte === 0xe0) this.lowerBoundary = 0xa0;
          if (byte === 0xed) this.upperBoundary = 0x9f;
          this.bytesNeeded = 2;
          this.codePoint = byte & 0xf;
        } else if (byte >= 0xf0 && byte <= 0xf4) {
          if (byte === 0xf0) this.lowerBoundary = 0x90;
          if (byte === 0xf4) this.upperBoundary = 0x8f;
          this.bytesNeeded = 3;
          this.codePoint = byte & 0x7;
        } else error();
        continue;
      }
      if (byte < this.lowerBoundary || byte > this.upperBoundary) {
        // The sequence so far is one error; this byte starts over (the standard's "prepend").
        this.resetSequence();
        error();
        i--;
        continue;
      }
      this.lowerBoundary = 0x80;
      this.upperBoundary = 0xbf;
      this.codePoint = (this.codePoint << 6) | (byte & 0x3f);
      this.bytesSeen++;
      if (this.bytesSeen !== this.bytesNeeded) continue;
      const cp = this.codePoint;
      this.codePoint = this.bytesNeeded = this.bytesSeen = 0;
      emit(cp);
    }
    if (options.stream !== true) {
      // The end of the input: a sequence still open is one error.
      if (this.bytesNeeded !== 0) {
        this.resetSequence();
        error();
      }
    }
    flush();
    let text = out.join("");
    if (!this.ignoreBOM && !this.bomSeen && text.length > 0) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      this.bomSeen = true;
    }
    if (options.stream !== true) this.bomSeen = false;
    return text;
  }

  /** Forgets a sequence in progress (the byte order mark's state is separate). */
  private resetSequence() {
    this.codePoint = this.bytesNeeded = this.bytesSeen = 0;
    this.lowerBoundary = 0x80;
    this.upperBoundary = 0xbf;
  }
}
