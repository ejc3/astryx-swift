"""Summarizes the hitches in an Animation Hitches trace: count, total and worst duration, and each
hitch with Instruments' own reason ("Potentially expensive app update(s)", "...render", "...GPU
work"). App updates are main-thread work in this app; renders and GPU work are drawing."""
import re
import subprocess
import sys

xml = subprocess.run(["xcrun", "xctrace", "export", "--input", sys.argv[1], "--xpath",
                      '/trace-toc/run[@number="1"]/data/table[@schema="hitches"]'],
                     capture_output=True, text=True, check=True).stdout
ids = {m.group(1): m.group(2) for m in re.finditer(r' id="(\d+)" fmt="([^"]*)"', xml)}

def cells(row):
    out = []
    for m in re.finditer(r'<([\w-]+)(?: id="\d+")?(?: fmt="([^"]*)")?(?: ref="(\d+)")?', row):
        tag, fmt, ref = m.groups()
        out.append((tag, ids.get(ref) if ref else fmt))
    return out

hitches = []
for row in re.findall(r"<row>(.*?)</row>", xml, re.S):
    values = [v for _, v in cells(row) if v]
    duration = next((v for v in values if re.fullmatch(r"[\d.]+ ms", v)), "0 ms")
    why = ", ".join(v for v in values if v.startswith("Potentially"))
    hitches.append((values[0] if values else "?", float(duration.split()[0]), why))
if not hitches:
    sys.exit("no hitches recorded")
print(f"{len(hitches)} hitches; {sum(h[1] for h in hitches):.0f} ms in all; worst {max(h[1] for h in hitches):.0f} ms; "
      f">50 ms: {sum(h[1] > 50 for h in hitches)}")
for start, ms, why in sorted(hitches, key=lambda h: -h[1])[:15]:
    print(f"  {ms:6.1f} ms at {start}  {why}")
