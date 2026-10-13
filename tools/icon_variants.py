# Renders candidate app icons. `python3 tools/icon_variants.py OUTDIR` writes each variant plus a preview sheet;
# `python3 tools/icon_variants.py --install NAME` writes that variant as the app's icons.
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def star(cx, cy, r, inner, rot=0.0, n=4):
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + rot + i * math.pi / n
        rr = r if i % 2 == 0 else inner
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts

def glow_layer(S, draw_fn, blur, color, strength=1.0):
    m = Image.new('L', (S, S), 0); draw_fn(ImageDraw.Draw(m))
    m = m.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(min(255, v * strength)))
    return Image.new('RGB', (S, S), color), m

def radial(S, inner, outer, cx=.5, cy=.3, rad=.9):
    img = Image.new('RGB', (S, S), outer)
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).ellipse([S * (cx - rad / 2), S * (cy - rad / 2), S * (cx + rad / 2), S * (cy + rad / 2)], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(S * .18))
    return Image.composite(Image.new('RGB', (S, S), inner), img, m)

def brackets(d, S, col, w=.02, m=.14, L=.14, four=False):
    w, m, L = int(S * w), S * m, S * L
    d.line([(m, m + L), (m, m), (m + L, m)], fill=col, width=w)
    d.line([(S - m, S - m - L), (S - m, S - m), (S - m - L, S - m)], fill=col, width=w)
    if four:
        d.line([(S - m - L, m), (S - m, m), (S - m, m + L)], fill=col, width=w)
        d.line([(m + L, S - m), (m, S - m), (m, S - m - L)], fill=col, width=w)

def v_system(S):
    img = radial(S, (16, 48, 110), (5, 7, 15)); c = S / 2; r = S * .36
    col, m = glow_layer(S, lambda d: d.polygon(star(c, c, r * 1.05, r * .28), fill=200), S * .04, (255, 200, 90), .55)
    img = Image.composite(col, img, m); d = ImageDraw.Draw(img)
    d.polygon(star(c, c, r, r * .24), fill=(255, 214, 112)); d.polygon(star(c, c, r * .42, r * .1), fill=(255, 246, 214))
    brackets(d, S, (31, 182, 255)); return img

def v_demon(S):
    img = radial(S, (90, 8, 22), (10, 2, 4)); c = S / 2; r = S * .37
    col, m = glow_layer(S, lambda d: d.polygon(star(c, c, r * 1.08, r * .3), fill=255), S * .05, (255, 30, 55), .8)
    img = Image.composite(col, img, m); d = ImageDraw.Draw(img)
    d.polygon(star(c, c, r, r * .22), fill=(255, 224, 214)); d.polygon(star(c, c, r * .4, r * .09), fill=(255, 255, 255))
    brackets(d, S, (255, 59, 78)); return img

def v_sigil(S):
    img = radial(S, (36, 22, 90), (6, 4, 18), cy=.5, rad=1.0); c = S / 2; d = ImageDraw.Draw(img)
    gold = (243, 212, 138)
    R = S * .36
    d.ellipse([c - R, c - R, c + R, c + R], outline=gold, width=int(S * .012))
    R2 = S * .315
    d.ellipse([c - R2, c - R2, c + R2, c + R2], outline=(150, 130, 220), width=int(S * .005))
    for i in range(24):   # rune ticks
        a = i * math.pi / 12; l = .03 if i % 3 else .055
        d.line([(c + math.cos(a) * R, c + math.sin(a) * R), (c + math.cos(a) * (R - S * l), c + math.sin(a) * (R - S * l))], fill=gold, width=int(S * .008))
    r = S * .27
    col, m = glow_layer(S, lambda dd: dd.polygon(star(c, c, r, r * .28), fill=220), S * .03, (255, 230, 160), .6)
    img = Image.composite(col, img, m); d = ImageDraw.Draw(img)
    d.polygon(star(c, c, r, r * .22), fill=(255, 236, 180))
    d.polygon(star(c, c, r * .55, r * .14, rot=math.pi / 4), fill=(255, 250, 230))
    return img

def v_shadow(S):
    img = radial(S, (40, 26, 110), (4, 3, 10), cy=.75, rad=1.1); c = S / 2; r = S * .38
    col, m = glow_layer(S, lambda d: d.polygon(star(c, c, r, r * .25), fill=255), S * .06, (130, 100, 255), .9)
    img = Image.composite(col, img, m); d = ImageDraw.Draw(img)
    d.polygon(star(c, c, r, r * .2), fill=(244, 241, 255)); return img

def v_rank(S):
    img = Image.new('RGB', (S, S), (5, 9, 14)); c = S / 2; d = ImageDraw.Draw(img)
    cyan = (94, 241, 255)
    hexp = [(c + math.cos(math.pi / 6 + i * math.pi / 3) * S * .36, c + math.sin(math.pi / 6 + i * math.pi / 3) * S * .36) for i in range(6)]
    col, m = glow_layer(S, lambda dd: dd.polygon(hexp, outline=255, width=int(S * .03)), S * .03, cyan, .9)
    img = Image.composite(col, img, m); d = ImageDraw.Draw(img)
    d.polygon(hexp, outline=cyan, width=int(S * .014))
    r = S * .2
    d.polygon(star(c, c, r, r * .22), fill=(255, 255, 255))
    brackets(d, S, cyan, w=.012, m=.08, L=.1, four=True); return img

def v_dusk(S):
    img = Image.new('RGB', (S, S)); d = ImageDraw.Draw(img)
    stops = [(0, (242, 165, 94)), (.35, (217, 103, 123)), (.65, (122, 74, 140)), (1, (20, 16, 38))]
    for y in range(S):
        t = y / S
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0); d.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(c0, c1)))
    c = S / 2
    d.ellipse([c - S * .2, S * .2, c + S * .2, S * .6], fill=(255, 228, 190))
    mtn = [(0, S), (0, S * .72), (S * .2, S * .6), (S * .35, S * .68), (S * .55, S * .52), (S * .75, S * .66), (S, S * .58), (S, S)]
    d.polygon(mtn, fill=(18, 13, 34))
    r = S * .11; d.polygon(star(c, S * .4, r, r * .22), fill=(255, 196, 107))
    return img

VARIANTS = {'system': ('A · The System (current)', v_system), 'demon': ('B · Demon Lord', v_demon), 'sigil': ('C · Arcane Sigil', v_sigil),
            'shadow': ('D · Shadow Star', v_shadow), 'rank': ('E · VRMMO Hex', v_rank), 'dusk': ('F · Ronin at Dusk', v_dusk)}

def render(fn, size): return fn(size * 4).resize((size, size), Image.LANCZOS)

def rounded(im, rad):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], rad, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (0, 0), m); return out

if __name__ == '__main__':
    if sys.argv[1] == '--install':
        fn = VARIANTS[sys.argv[2]][1]; out = os.path.join(os.path.dirname(__file__), '..', 'docs', 'icons')
        for n, s in [('icon-192-v2.png', 192), ('icon-512-v2.png', 512), ('apple-touch-icon-v2.png', 180)]: render(fn, s).save(os.path.join(out, n))
        # maskable: same art scaled into the safe zone
        big = render(fn, 512); mk = Image.new('RGB', (512, 512), big.getpixel((4, 4))); mk.paste(big.resize((410, 410), Image.LANCZOS), (51, 51))
        mk.save(os.path.join(out, 'icon-maskable-512-v2.png')); print('installed', sys.argv[2]); sys.exit()
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    sheet = Image.new('RGB', (3 * 300, 2 * 330), (28, 28, 30)); d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except OSError: font = ImageFont.load_default()
    for i, (k, (label, fn)) in enumerate(VARIANTS.items()):
        im = render(fn, 220); im.save(os.path.join(out, f'icon-{k}.png'))
        x, y = (i % 3) * 300 + 40, (i // 3) * 330 + 30
        sheet.paste(rounded(im, 50), (x, y), rounded(im, 50))
        w = d.textlength(label, font=font); d.text((x + 110 - w / 2, y + 236), label, fill=(235, 235, 240), font=font)
    sheet.save(os.path.join(out, 'icon-options.png')); print('ok')
