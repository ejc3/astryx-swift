# Draws the app icon: Astryx's accent blue, a white "A" made of two strokes and a bar.
# 1024 px, no alpha (iOS rounds the corners itself).
# Run: python3 apps/native/scripts/icon.py <output.png>. The iPhone takes the 1024 px image; the
# Mac's asset catalog needs every size from 16 to 512 pt at 1x and 2x (App Store Connect refuses
# a Mac build whose icon lacks 512 pt @2x), resized from it.
import sys
from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGB", (S, S))
d = ImageDraw.Draw(img)
top, bottom = (0x26, 0x94, 0xFE), (0x00, 0x52, 0xC4)
for y in range(S):
    t = y / (S - 1)
    d.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
w = 92
d.line([(512, 210), (290, 800)], fill="white", width=w)
d.line([(512, 210), (734, 800)], fill="white", width=w)
d.line([(370, 590), (654, 590)], fill="white", width=int(w * 0.8))
for x, y in [(512, 210), (290, 800), (734, 800)]:
    r = w // 2
    d.ellipse([(x - r, y - r), (x + r, y + r)], fill="white")
img.save(sys.argv[1])
