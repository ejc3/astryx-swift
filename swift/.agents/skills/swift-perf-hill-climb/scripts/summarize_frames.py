"""Summarizes a frame-meter log (lines starting "AXFrameMeter").

Prints one summary line (mean fps, late frames, long gaps) and then each gap over 50 ms with the
scenario step whose snapshot came just before it, so a gap can be pinned on a step."""
import re
import sys

lines = [l.split("AXFrameMeter ", 1)[1].strip() for l in open(sys.argv[1]) if "AXFrameMeter " in l]
seconds = [l for l in lines if l.startswith("fps ")][1:]  # the first second includes launch
if not seconds:
    sys.exit("no frame-meter output: was the app built with FrameMeter and run with -AXFrameMeter YES?")
fps = [float(re.search(r"fps (\d+)", l).group(1)) for l in seconds]
late = [int(re.search(r"late (\d+)", l).group(1)) for l in seconds]
worst = [float(re.search(r"worst ([\d.]+) ms", l).group(1)) for l in seconds]
refresh = next((l for l in lines if l.startswith("refresh")), "refresh ?")
print(f"{refresh}; {len(fps)} s; mean fps {sum(fps) / len(fps):.1f}; late frames {sum(late)}; "
      f"gaps >50 ms {sum(w > 50 for w in worst)}, >100 ms {sum(w > 100 for w in worst)}; max gap {max(worst):.0f} ms")
step = "(before the first snapshot)"
for l in lines:
    m = re.search(r"\[(.*)\]", l)
    if l.startswith("snapshot") and m:
        step = m.group(1)
    g = re.match(r"gap (\d+) ms", l)
    if g:
        print(f"  {g.group(1):>4} ms  after: {step}")
