"""App icon for Moked 106: a gold speech bubble (residents speak, the city listens)
with a white pulse line (the "Pulse" lens), on the navy of the dashboard and the public page.

One geometry, two outputs: icon.svg (sharp at any size) and PNGs drawn with Pillow.
Writes to app/static/icons/ (dashboard + admin) and transparency/icons/ (public page).

    python scripts/make_icons.py
"""
import os
import shutil
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'static', 'icons')
PUBLIC_OUT = os.path.join(ROOT, 'transparency', 'icons')

NAVY_TOP, NAVY_BOTTOM, GOLD, WHITE = (31, 69, 131), (18, 41, 79), (212, 175, 55), (255, 255, 255)

# Geometry on a 512 grid
CORNER = 112
BUBBLE = (96, 112, 416, 352)          # left, top, right, bottom
BUBBLE_R = 64
BUBBLE_W = 26
TAIL = [(328, 352), (356, 416), (264, 352)]   # opening on the bottom edge, point below
PULSE = [(140, 232), (200, 232), (228, 180), (270, 290), (300, 232), (372, 232)]
PULSE_W = 24

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f4583"/><stop offset="1" stop-color="#12294f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="{CORNER}" fill="url(#bg)"/>
  <path d="M160 112h192a64 64 0 0 1 64 64v112a64 64 0 0 1-64 64h-24l28 64-92-64H160a64 64 0 0 1-64-64V176a64 64 0 0 1 64-64z"
        fill="none" stroke="#d4af37" stroke-width="{BUBBLE_W}" stroke-linejoin="round"/>
  <polyline points="{' '.join(f'{x},{y}' for x, y in PULSE)}"
        fill="none" stroke="#ffffff" stroke-width="{PULSE_W}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


def bubble_outline(steps=24):
    """Points along the bubble path, starting mid-top so the closing joint is on a straight edge."""
    import math
    l, t, r, b = BUBBLE
    R = BUBBLE_R

    def arc(cx, cy, a0, a1):
        return [(cx + R * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
                 cy + R * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]

    mid = ((l + r) / 2, t)
    pts = [mid, (r - R, t)]
    pts += arc(r - R, t + R, -90, 0)
    pts += [(r, b - R)] + arc(r - R, b - R, 0, 90)
    pts += TAIL                                   # down to the point and back to the bottom edge
    pts += [(l + R, b)] + arc(l + R, b - R, 90, 180)
    pts += [(l, t + R)] + arc(l + R, t + R, 180, 270)
    pts += [mid]
    return pts


def gradient_at(y, size):
    t = y / size
    return tuple(round(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOTTOM))


def draw_icon(size, rounded=True, safe=1.0):
    """safe < 1 shrinks the artwork toward the center (maskable icons need an 80% safe zone)."""
    S = size * 4                                   # supersample, then downscale for smooth edges
    k = S / 512
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    bg = Image.new('RGBA', (S, S))
    bd = ImageDraw.Draw(bg)
    for y in range(S):
        bd.line([(0, y), (S, y)], fill=gradient_at(y, S) + (255,))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=CORNER * k if rounded else 0, fill=255)
    img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)
    c = S / 2
    p = lambda x, y: (c + (x * k - c) * safe, c + (y * k - c) * safe)
    w = lambda v: max(1, round(v * k * safe))

    # Bubble + tail as ONE continuous outline (same path as the SVG), so the tail joins cleanly
    d.line([p(*pt) for pt in bubble_outline()], fill=GOLD, width=w(BUBBLE_W), joint='curve')

    pts = [p(*pt) for pt in PULSE]
    d.line(pts, fill=WHITE, width=w(PULSE_W), joint='curve')
    rr = w(PULSE_W) / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(SVG)
    draw_icon(32).save(os.path.join(OUT, 'favicon-32.png'))
    draw_icon(192).save(os.path.join(OUT, 'icon-192.png'))
    draw_icon(512).save(os.path.join(OUT, 'icon-512.png'))
    # iPhone rounds the corners itself, and maskable icons are cropped by the phone: full bleed
    draw_icon(180, rounded=False).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    draw_icon(512, rounded=False, safe=0.8).save(os.path.join(OUT, 'icon-maskable-512.png'))
    shutil.copytree(OUT, PUBLIC_OUT, dirs_exist_ok=True)
    print('Icons written to app/static/icons/ and transparency/icons/')


if __name__ == '__main__':
    main()
