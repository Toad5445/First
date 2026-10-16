# Frostbound frost: needle ferns grown in from the frame. Each fern is a gently curving spine with side branches
# at ice's 60 degrees (feather outline), sized to stay within a band around the edge. Fern weights vary: mostly
# fine, some medium, a few bold. Drawn in three soft layers (cold glow, out of focus, crisp).
#   python3 tools/frost_needle.py   (writes docs/art/frost.svg for phones and docs/art/frost-wide.svg for PCs)
import math, random, sys

X = "xmlns='http://www.w3.org/2000/svg'"
W, H = 600, 1000
PER = (W + H) / 1600

# ---------- shared ----------
def edge_seeds(rnd, spacing, jitter=.35):
    """Evenly spaced start points around the whole border (Poisson-like: fixed spacing plus jitter)."""
    per = 2 * (W + H); n = int(per / spacing); seeds = []
    off = rnd.uniform(0, spacing)
    for i in range(n):
        d = (off + i * spacing + rnd.uniform(-jitter, jitter) * spacing) % per
        if d < W: seeds.append((d, -4, 90))
        elif d < W + H: seeds.append((W + 4, d - W, 180))
        elif d < 2 * W + H: seeds.append((W - (d - W - H), H + 4, -90))
        else: seeds.append((-4, H - (d - 2 * W - H), 0))
    return seeds

class Grid:
    """Occupancy grid so growing frost stops where it meets other frost."""
    def __init__(self, cell=7):
        self.c = cell; self.g = {}
    def key(self, x, y): return (int(x // self.c), int(y // self.c))
    def free(self, x, y, owner):
        k = self.key(x, y)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                o = self.g.get((k[0] + dx, k[1] + dy))
                if o is not None and o != owner: return False
        return True
    def mark(self, x, y, owner): self.g.setdefault(self.key(x, y), owner)

def tapered(pts, w0, w1):
    """A polyline drawn as a closed shape that narrows from width w0 to w1."""
    if len(pts) < 2: return ''
    left, right = [], []; n = len(pts) - 1
    for i, (px, py) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n)]
        dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy) or 1
        w = (w0 + (w1 - w0) * i / n) / 2
        left.append((px - dy / l * w, py + dx / l * w)); right.append((px + dy / l * w, py - dx / l * w))
    tip = pts[-1]
    return "<path d='M" + ' '.join(f'{x:.0f} {y:.0f}' for x, y in left + [tip] + right[::-1]) + "z'/>"

def render(layers, mats=''):
    d = ("<radialGradient id='vg' cx='.5' cy='.5' r='.72'><stop offset='.58' stop-color='#bfe6ff' stop-opacity='0'/><stop offset='.85' stop-color='#bfe6ff' stop-opacity='.1'/><stop offset='1' stop-color='#e6f7ff' stop-opacity='.28'/></radialGradient>"
         "<radialGradient id='mat'><stop offset='0' stop-color='#cfeaff' stop-opacity='.26'/><stop offset='.45' stop-color='#9fd2f2' stop-opacity='.1'/><stop offset='1' stop-color='#bfe6ff' stop-opacity='0'/></radialGradient>"
         "<filter id='h' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='9'/></filter>"
         "<filter id='so' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='3.2'/></filter>"
         "<filter id='m' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='1.5'/></filter>"
         "<filter id='c' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='.7'/></filter>"
         "<filter id='mb' x='-.5' y='-.5' width='2' height='2'><feGaussianBlur stdDeviation='14'/></filter>")
    So, M, C = (''.join(layers[k]) for k in ('soft', 'mid', 'crisp'))
    return (f"<svg {X} viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'><defs>{d}<g id='So'>{So}</g><g id='M'>{M}</g><g id='C'>{C}</g></defs>"
            f"<rect width='{W}' height='{H}' fill='url(#vg)'/><g filter='url(#mb)'>{mats}</g>"
            "<g fill='#7fbce8' opacity='.35' filter='url(#h)'><use href='#So'/><use href='#M'/><use href='#C'/></g>"
            "<use href='#So' fill='#a9d6f5' opacity='.32' filter='url(#so)'/>"
            "<use href='#M' fill='#c4e4fa' opacity='.4' filter='url(#m)'/>"
            "<g fill='#e2f3ff' opacity='.52' filter='url(#c)'><use href='#C'/></g></svg>")

def depth_of(rnd): return rnd.choices(('soft', 'mid', 'crisp'), weights=(3, 3, 4))[0]

def inside(x, y, m=30): return -m < x < W + m and -m < y < H + m

# ---------- 1 · feather frost ----------
def fern_thickness(rnd):
    """Most ferns fine, some medium, a few bold, with a little spread inside each band."""
    band = rnd.choices((.75, 1.15, 1.9), weights=(55, 30, 15))[0]
    return band * rnd.uniform(.85, 1.15)

def feather(seed=7, spacing=44, wiggle=1.4, bend_max=.9, levels=2, width=(8, 13), length=(110, 300), branch_len=.42, thick=1.0, reach=None, reach_side=None, spread=42):
    """Dendritic ferns: a gently curving spine; side branches at ice's 60 degrees, evenly spaced and shorter toward
    the tip (a feather outline); smaller branches off those at 60 again. Growth stops where it meets other frost."""
    rnd = random.Random(seed); grid = Grid(6); layers = {'soft': [], 'mid': [], 'crisp': []}; owner = [0]

    fern_reach = [1.0]
    def grow(x, y, ang, L, w, level, layer, tag):
        pts = [(x, y)]; step = 6; bend = rnd.uniform(-bend_max, bend_max); n = int(L / step)
        for i in range(n):
            ang += bend + rnd.gauss(0, wiggle)
            nx_, ny_ = x + math.cos(math.radians(ang)) * step, y + math.sin(math.radians(ang)) * step
            if i > 2 and (not grid.free(nx_, ny_, tag) or not inside(nx_, ny_)): break
            if reach and min(nx_, W - nx_) > (reach_side or reach) * fern_reach[0] * 1.3 and min(ny_, H - ny_) > reach * fern_reach[0] * 1.3: break   # safety only
            x, y = nx_, ny_; pts.append((x, y))
        for (px, py) in pts: grid.mark(px, py, tag)
        if len(pts) < 3: return
        layers[layer].append(tapered(pts, w, max(1.1, w * .14)))
        if level == 0: return
        gap = max(9, w * 2.6) * rnd.uniform(.9, 1.1); s = gap * rnd.uniform(.4, 1); side = rnd.choice((-1, 1))
        total = (len(pts) - 1) * step
        while s < total * .92:
            i = int(s / step); px, py = pts[i]; a2 = pts[min(i + 1, len(pts) - 1)]
            base = math.degrees(math.atan2(a2[1] - py, a2[0] - px))
            t = s / total; envelope = math.sin(math.pi * min(1, t * 1.15 + .05)) ** .8   # feather outline
            bl = total * branch_len * envelope * rnd.uniform(.75, 1.15) * (1 if level == levels else .8)
            for sd in (side, -side) if rnd.random() < .82 else (side,):
                if bl > 10:
                    owner[0] += 1
                    grow(px, py, base + sd * rnd.gauss(60, 4), bl, w * (1 - t) ** .7 * .42 + 1.3, level - 1, layer, (tag, owner[0]))
            side = -side; s += gap * rnd.uniform(.85, 1.15)

    seeds = edge_seeds(rnd, spacing)
    rnd.shuffle(seeds)
    for k, (x, y, inward) in enumerate(seeds):
        L = rnd.uniform(*length) * (1.25 if rnd.random() < .2 else 1)
        fern_reach[0] = rnd.uniform(.65, 1.05)                    # each fern stops at its own depth: an uneven frost line
        dev = rnd.uniform(-spread, spread)                        # how far a fern may tilt from straight in
        if reach:                                                 # size the whole fern to fit the band, so it keeps its tapered shape
            r = (reach_side or reach) if inward in (0, 180) else reach      # side edges may reach further than top/bottom
            L = min(L, r * fern_reach[0] / max(.35, math.cos(math.radians(dev))))
        grow(x, y, inward + dev, L, rnd.uniform(*width) * fern_thickness(rnd), levels, depth_of(rnd), k)
    return render(layers)

VARIANTS = {
    'phone': dict(seed=5, spacing=36, wiggle=.35, bend_max=.15, width=(9, 14), length=(110, 260), branch_len=.36, reach=150),
    # PCs have wide side margins: denser, longer ferns, reaching further in from the sides than from top and bottom
    'pc':    dict(seed=5, spacing=26, wiggle=.35, bend_max=.15, width=(9, 14), length=(180, 460), branch_len=.38, reach=200, reach_side=360, spread=25),
}

if __name__ == '__main__':
    for name, (w, h), path in (('phone', (600, 1300), 'docs/art/frost.svg'), ('pc', (1600, 1000), 'docs/art/frost-wide.svg')):
        W, H = w, h; PER = (W + H) / 1600
        open(path, 'w').write(feather(**VARIANTS[name]))
