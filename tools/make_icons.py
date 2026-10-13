# Draws the app icons (the quest-star on a dark status-window background).
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'icons')

def star(cx, cy, r, inner):
    pts = []
    for i in range(8):
        import math
        a = -math.pi / 2 + i * math.pi / 4
        rr = r if i % 2 == 0 else inner
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts

def icon(size, pad=0.0, maskable=False):
    S = size * 4
    img = Image.new('RGB', (S, S), (5, 7, 15))
    # radial blue glow
    glow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(glow).ellipse([S * .1, -S * .25, S * .9, S * .65], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(S * .12))
    img = Image.composite(Image.new('RGB', (S, S), (16, 48, 110)), img, glow)
    c = S / 2
    r = S * (0.36 if not maskable else 0.27)
    # soft halo behind the star
    halo = Image.new('L', (S, S), 0)
    ImageDraw.Draw(halo).polygon(star(c, c, r * 1.05, r * 0.28), fill=200)
    halo = halo.filter(ImageFilter.GaussianBlur(S * .04))
    img = Image.composite(Image.new('RGB', (S, S), (255, 200, 90)), img, halo.point(lambda v: int(v * .55)))
    d = ImageDraw.Draw(img)
    d.polygon(star(c, c, r, r * 0.24), fill=(255, 214, 112))
    d.polygon(star(c, c, r * 0.42, r * 0.1), fill=(255, 246, 214))
    # status-window corner brackets
    if not maskable:
        w, m, L = int(S * .02), S * .14, S * .14
        col = (31, 182, 255)
        d.line([(m, m + L), (m, m), (m + L, m)], fill=col, width=w)
        d.line([(S - m, S - m - L), (S - m, S - m), (S - m - L, S - m)], fill=col, width=w)
    return img.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
print('ok')
