"""Summarizes a Time Profiler trace for the main thread: where the time goes overall, and the
longest busy bursts (runs of samples less than 3 ms apart) with their heaviest frames. A burst is
what the person sees as a hitch; the overall table says which code to change."""
import collections
import subprocess
import sys
import xml.etree.ElementTree as ET

raw = subprocess.run(["xcrun", "xctrace", "export", "--input", sys.argv[1], "--xpath",
                      '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]'],
                     capture_output=True, check=True).stdout
root = ET.fromstring(raw)
ids = {e.get("id"): e for e in root.iter() if e.get("id")}

def resolve(e):
    return ids[e.get("ref")] if e.get("ref") is not None else e

samples = []
for row in root.iter("row"):
    t = thread = trace = None
    for c in row:
        if c.tag == "sample-time":
            t = int(resolve(c).text)
        elif c.tag == "thread":
            thread = resolve(c)
        elif c.tag in ("backtrace", "tagged-backtrace"):
            trace = resolve(c)
    if trace is None or thread is None or "Main Thread" not in thread.get("fmt", ""):
        continue
    samples.append((t, [resolve(f).get("name") or "?" for f in trace.findall("frame")]))
if not samples:
    sys.exit("no main-thread samples")
samples.sort()
generic = ("NSApplication", "runApp", "main", "start", "CFRunLoop", "_DPS", "RunCurrentEventLoop",
           "ReceiveNextEvent", "_BlockUntil", "deduplicated", "0x1")
ours = ("AstryxKit", "AppModel", "ClientHost", "WebPane", "JSONValue", "Template", "Model")

inclusive = collections.Counter()
first_own = collections.Counter()
for _, frames in samples:
    for f in set(frames):
        if not any(g in f for g in generic):
            inclusive[f] += 1
    for f in frames:
        if any(o in f for o in ours):
            first_own[f] += 1
            break
print(f"main thread: {len(samples)} ms busy (1 ms samples)")
print("heaviest frames, inclusive:")
for f, n in inclusive.most_common(20):
    print(f"  {n:5} {f[:120]}")
print("deepest frame of our own code:")
for f, n in first_own.most_common(15):
    print(f"  {n:5} {f[:120]}")

bursts, current = [], [samples[0]]
for s in samples[1:]:
    if s[0] - current[-1][0] < 3_000_000:
        current.append(s)
    else:
        bursts.append(current)
        current = [s]
bursts.append(current)
for burst in sorted(bursts, key=len, reverse=True)[:5]:
    c = collections.Counter(f for _, frames in burst for f in set(frames) if not any(g in f for g in generic))
    print(f"burst at {burst[0][0] / 1e9:.2f} s: {len(burst)} ms")
    for f, n in c.most_common(8):
        print(f"  {n:5} {f[:120]}")
