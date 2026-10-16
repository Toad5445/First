# Four experimental icy display fonts, each built by reshaping every outline of Cinzel Bold (SIL OFL).
import math, random, sys
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables.ttProgram import Program
from shapely.geometry import Polygon, MultiPolygon, LineString, Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity

SRC = sys.argv[1]; OUT = sys.argv[2]
CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

class Flat(BasePen):
    """Collects outlines as point rings, sampling curves finely."""
    def __init__(self, gs):
        super().__init__(gs); self.rings = []; self.cur = []
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _curveToOne(self, a, b, c):
        p0 = self.cur[-1]
        for i in range(1, 13):
            t = i / 12; mt = 1 - t
            self.cur.append((mt**3*p0[0] + 3*mt*mt*t*a[0] + 3*mt*t*t*b[0] + t**3*c[0], mt**3*p0[1] + 3*mt*mt*t*a[1] + 3*mt*t*t*b[1] + t**3*c[1]))
    def _qCurveToOne(self, a, b):
        p0 = self.cur[-1]
        for i in range(1, 9):
            t = i / 8; mt = 1 - t
            self.cur.append((mt*mt*p0[0] + 2*mt*t*a[0] + t*t*b[0], mt*mt*p0[1] + 2*mt*t*a[1] + t*t*b[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.rings.append(self.cur)
        self.cur = []
    _endPath = _closePath

def shape_of(font, g):
    pen = Flat(font.getGlyphSet()); font.getGlyphSet()[g].draw(pen)
    # The source has its overlapping contours merged first (cinzel-merged.ttf), so even-odd is exact here.
    geom = Polygon()
    for r in pen.rings:
        geom = geom.symmetric_difference(Polygon(r).buffer(0))
    return geom.buffer(0)

def polys(geom):
    return [geom] if isinstance(geom, Polygon) else [p for p in getattr(geom, 'geoms', []) if isinstance(p, Polygon)]

def segments(geom):
    for p in polys(geom):
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)
            for i in range(len(c) - 1): yield c[i], c[i + 1]

# A · Icicles: icicles hang from every downward-facing edge, long ones on the baseline, short drips on overhangs.
# Each icicle is rooted on the edge itself (following its slope, overlapping into the letter) with a flared,
# melted root, then tapers smoothly to a point. Along an edge they are longest in the middle, shorter at the ends.
def icicle(x0, y0, x1, y1, ln, rnd):
    """An icicle whose root spans the edge from (x0, y0) to (x1, y1) and hangs ln units down."""
    cx = (x0 + x1) / 2 + rnd.uniform(-.15, .15) * (x1 - x0); w = abs(x1 - x0)
    lean = rnd.uniform(-.06, .06) * ln; kink = rnd.uniform(.25, .6)
    left, right = [], []
    for i in range(11):
        t = i / 10
        half = w / 2 * (1 - t) ** 1.7 * (1 + .25 * math.sin(t * math.pi * 3 + kink * 9) * (1 - t))   # uneven, drips thin out
        ytop = y0 + (y1 - y0) * .5
        y = ytop - t * ln; x = cx + lean * t * t
        left.append((x - half, y)); right.append((x + half, y))
    root = [(x0 - w * .35, y0 + 14), (x0, y0 + 14), *left, *reversed(right), (x1, y1 + 14), (x1 + w * .35, y1 + 14)]
    tip = (cx + lean, y0 + (y1 - y0) * .5 - ln - rnd.uniform(4, 10))
    return Polygon(root[:len(root) // 2 + 1] + [tip] + root[len(root) // 2 + 1:]).buffer(0)

def icicles(geom, rnd):
    hang = []
    for (x1, y1), (x2, y2) in segments(geom):
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 10 or abs(y2 - y1) > L * .5: continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if geom.contains(Point(mx, my - 6)) or not geom.contains(Point(mx, my + 6)): continue   # only edges with ink above
        if any(geom.contains(Point(mx + dx, my - 34)) for dx in (-8, 0, 8)): continue          # not into a crack or a narrow gap
        if x1 > x2: x1, y1, x2, y2 = x2, y2, x1, y1
        edge_y = lambda x: y1 + (y2 - y1) * (x - x1) / ((x2 - x1) or 1)
        on_base = my < 40
        x = x1 + rnd.uniform(0, 16)
        while x < x2 - 10:
            w = rnd.uniform(15, 30); xe = min(x + w, x2)
            if xe - x < 9: break
            u = ((x + xe) / 2 - x1) / ((x2 - x1) or 1)
            env = .45 + .55 * math.sin(math.pi * u)              # longer in the middle of the edge
            ln = (rnd.uniform(60, 230) if on_base else rnd.uniform(22, 90)) * env * rnd.choice([.35, .6, .85, 1, 1.2])
            hang.append(icicle(x, edge_y(x), xe, edge_y(xe), ln, rnd))
            x = xe + rnd.uniform(6, 44)
    return unary_union([geom, *hang]).buffer(0)

# B · Shattered: the letter is a slab of ice cracked into shards, the shards nudged slightly apart
def shattered(geom, rnd):
    minx, miny, maxx, maxy = geom.bounds; cracks = []
    for _ in range(rnd.choice([2, 3, 3])):
        a = rnd.uniform(0, math.pi); cx, cy = rnd.uniform(minx, maxx), rnd.uniform(miny + 100, maxy - 100)
        pts = []
        for k in range(-6, 7):
            t = k * 130; j = rnd.uniform(-22, 22)
            pts.append((cx + math.cos(a) * t - math.sin(a) * j, cy + math.sin(a) * t + math.cos(a) * j))
        cracks.append(LineString(pts).buffer(rnd.uniform(7, 11), cap_style=2, join_style=2))
    pieces = polys(geom.difference(unary_union(cracks)).buffer(0))
    out = []
    for p in pieces:
        if p.area < 900: continue        # drop crumbs
        dx, dy = rnd.uniform(-7, 7), rnd.uniform(-7, 7)
        out.append(affinity.rotate(affinity.translate(p, dx, dy), rnd.uniform(-1.5, 1.5), origin='centroid'))
    return unary_union(out).buffer(0)

# C · Faceted: every curve recut as flat crystal facets, corners sharpened to points
def faceted(geom, rnd):
    g = geom.simplify(26, preserve_topology=True)
    return g.buffer(-6, join_style=2).buffer(6, join_style=2, mitre_limit=8).buffer(0)

# D · Hoarfrost: the edges bristle with small sharp frost crystals, a few longer spikes among them
def hoarfrost(geom, rnd):
    spikes = []
    for p in polys(geom):
        for ring, outward in [(p.exterior, 1), *[(i, 1) for i in p.interiors]]:
            L = ring.length; d = rnd.uniform(0, 12)
            while d < L:
                a, b = ring.interpolate(d), ring.interpolate(min(L, d + 1.5))
                tx, ty = b.x - a.x, b.y - a.y; n = math.hypot(tx, ty) or 1; tx, ty = tx / n, ty / n
                for nx, ny in ((ty, -tx), (-ty, tx)):
                    if not geom.contains(Point(a.x + nx * 4, a.y + ny * 4)): break
                ln = rnd.expovariate(1 / 16) + 6
                if rnd.random() < .06: ln += rnd.uniform(30, 60)
                ang = rnd.uniform(-.5, .5); cs, sn = math.cos(ang), math.sin(ang)
                ox, oy = nx * cs - ny * sn, nx * sn + ny * cs
                w = rnd.uniform(4, 8)
                spikes.append(Polygon([(a.x - tx * w - nx * 3, a.y - ty * w - ny * 3), (a.x + tx * w - nx * 3, a.y + ty * w - ny * 3), (a.x + ox * ln, a.y + oy * ln)]))
                d += rnd.uniform(9, 20)
    return unary_union([geom, *spikes]).buffer(0)

# Natural cracks: each crack starts on the letter's edge and wanders inward, wide at its origin and thinning to a
# hairline tip. It forks now and then, and many stop partway. Only cracks that run right through split a shard
# off, and those shards barely shift.
def crack_path(x, y, ang, length, width, rnd, depth, out):
    pts = [(x, y)]; widths = [width]; travelled = 0
    while travelled < length:
        step = rnd.uniform(14, 40); ang += rnd.gauss(0, .38)
        x += math.cos(ang) * step; y += math.sin(ang) * step; travelled += step
        pts.append((x, y)); widths.append(max(1.6, width * max(0, 1 - travelled / length) ** .8))
        if depth and rnd.random() < .16 and travelled < length * .75:
            crack_path(x, y, ang + rnd.choice((-1, 1)) * rnd.uniform(.45, 1.0), (length - travelled) * rnd.uniform(.35, .7),
                       widths[-1] * .8, rnd, depth - 1, out)
    for i in range(len(pts) - 1):   # each segment a wedge from its start width to its end width
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]; w1, w2 = widths[i] / 2, widths[i + 1] / 2
        dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy) or 1; nx, ny = -dy / n, dx / n
        out.append(Polygon([(x1 + nx * w1, y1 + ny * w1), (x2 + nx * w2, y2 + ny * w2), (x2 - nx * w2, y2 - ny * w2), (x1 - nx * w1, y1 - ny * w1)]).buffer(w2 * .6))

def cracked(geom, rnd):
    minx, miny, maxx, maxy = geom.bounds; size = max(maxx - minx, maxy - miny); cracks = []
    ring = max(polys(geom), key=lambda p: p.area).exterior
    for _ in range(rnd.choice((1, 2, 2, 3))):
        o = ring.interpolate(rnd.uniform(0, ring.length)); c = geom.centroid
        ang = math.atan2(c.y - o.y, c.x - o.x) + rnd.gauss(0, .5)      # head roughly into the letter
        crack_path(o.x, o.y, ang, size * rnd.uniform(.35, 1.1), rnd.uniform(9, 15), rnd, 2, cracks)
    cut = geom.difference(unary_union(cracks)).buffer(0)
    out = []
    for p in polys(cut):
        if p.area < 500: continue
        out.append(affinity.translate(p, rnd.uniform(-3, 3), rnd.uniform(-3, 3)) if p.area < geom.area * .6 else p)
    return unary_union(out).buffer(0)

# --- fracture models (crack width matches v1: 14-22 units) ---
def separate(geom, cracks, rnd, nudge=5):
    # cut the cracks out, drop crumbs, nudge each shard a little like v1
    out = []
    for p in polys(geom.difference(unary_union(cracks)).buffer(0)):
        if p.area < 700: continue
        out.append(affinity.rotate(affinity.translate(p, rnd.uniform(-nudge, nudge), rnd.uniform(-nudge, nudge)), rnd.uniform(-1.2, 1.2), origin='centroid'))
    return unary_union(out).buffer(0)

def crackline(pts, w):
    return LineString(pts).buffer(w / 2, cap_style=2, join_style=2, mitre_limit=3)

def jagged(a, b, rnd, step=55, amp=10):
    # a straight crack, with the small zig-zag real fractures have along their length
    (x1, y1), (x2, y2) = a, b; L = math.hypot(x2 - x1, y2 - y1); n = max(1, int(L / step))
    nx, ny = -(y2 - y1) / (L or 1), (x2 - x1) / (L or 1)
    return [(x1 + (x2 - x1) * i / n + (nx * rnd.uniform(-amp, amp) if 0 < i < n else 0),
             y1 + (y2 - y1) * i / n + (ny * rnd.uniform(-amp, amp) if 0 < i < n else 0)) for i in range(n + 1)]

# 1 · Voronoi fracture: random seeds split the slab into cells; the cell walls are the cracks.
#     Some walls are left closed (cells fused) so not every boundary is a crack.
def voronoi_fracture(geom, rnd):
    from shapely.ops import voronoi_diagram
    from shapely.geometry import MultiPoint
    minx, miny, maxx, maxy = geom.bounds; seeds = []
    target = max(3, int(geom.area / 32000))
    while len(seeds) < target:      # Poisson-disc-ish: keep seeds apart so shards are chunky
        p = Point(rnd.uniform(minx, maxx), rnd.uniform(miny, maxy))
        if geom.contains(p) and all(p.distance(q) > 120 for q in seeds): seeds.append(p)
        elif rnd.random() < .002: break
    if len(seeds) < 2: return geom
    cells = voronoi_diagram(MultiPoint(seeds), envelope=geom.envelope.buffer(200))
    walls = []
    for c in cells.geoms:
        for (a, b) in zip(c.exterior.coords[:-1], c.exterior.coords[1:]):
            if rnd.random() < .7: walls.append(crackline(jagged(a, b, rnd, 45, 7), rnd.uniform(14, 20)))
    return separate(geom, walls, rnd)

# 2 · Gilbert tessellation: cracks nucleate at random points, run straight both ways, and stop when they hit an
#     earlier crack or the edge of the letter (the T-junctions of drying mud and lake ice).
def gilbert_fracture(geom, rnd):
    minx, miny, maxx, maxy = geom.bounds; lines = []
    n = max(2, int(geom.area / 50000)) + rnd.choice((0, 1))
    for _ in range(n):
        for _try in range(40):
            p = Point(rnd.uniform(minx, maxx), rnd.uniform(miny, maxy))
            if geom.contains(p): break
        ang = rnd.uniform(0, math.pi); ends = []
        for sgn in (1, -1):
            far = (p.x + sgn * math.cos(ang) * 2000, p.y + sgn * math.sin(ang) * 2000)
            ray = LineString([(p.x, p.y), far]); stop = far; best = 1e9
            for l in lines:
                hit = ray.intersection(l)
                for h in getattr(hit, 'geoms', [hit]):
                    if not h.is_empty and h.geom_type == 'Point' and 1 < p.distance(h) < best: best, stop = p.distance(h), (h.x, h.y)
            ends.append(stop)
        lines.append(LineString([ends[1], (p.x, p.y), ends[0]]))
    cracks = [crackline(jagged(l.coords[0], l.coords[-1], rnd, 60, 6), rnd.uniform(14, 20)) for l in lines]
    return separate(geom, cracks, rnd)

# 3 · Impact fracture: radial cracks shoot out from a strike point; ring cracks join neighbouring radials.
def impact_fracture(geom, rnd):
    minx, miny, maxx, maxy = geom.bounds
    for _try in range(60):
        o = Point(rnd.uniform(minx, maxx), rnd.uniform(miny + (maxy - miny) * .3, maxy))
        if geom.contains(o): break
    k = rnd.choice((5, 6, 7)); base = rnd.uniform(0, math.tau)
    angs = [base + i * math.tau / k + rnd.uniform(-.25, .25) for i in range(k)]
    R = max(maxx - minx, maxy - miny) * 1.2; cracks = []
    for a in angs:
        cracks.append(crackline(jagged((o.x, o.y), (o.x + math.cos(a) * R, o.y + math.sin(a) * R), rnd, 50, 8), rnd.uniform(13, 19)))
    for r in (rnd.uniform(80, 130), rnd.uniform(190, 260)):
        for i in range(k):
            if rnd.random() < .55:
                a1, a2 = angs[i], angs[(i + 1) % k] + (math.tau if i == k - 1 else 0)
                p1 = (o.x + math.cos(a1) * r * rnd.uniform(.9, 1.1), o.y + math.sin(a1) * r * rnd.uniform(.9, 1.1))
                p2 = (o.x + math.cos(a2) * r * rnd.uniform(.9, 1.1), o.y + math.sin(a2) * r * rnd.uniform(.9, 1.1))
                cracks.append(crackline(jagged(p1, p2, rnd, 40, 5), rnd.uniform(11, 16)))   # chords, as in struck glass
    return separate(geom, cracks, rnd, nudge=4)

def frost_voronoi(geom, rnd): return icicles(voronoi_fracture(faceted(geom, rnd), rnd), rnd)
def frost_gilbert(geom, rnd): return icicles(gilbert_fracture(faceted(geom, rnd), rnd), rnd)
def frost_impact(geom, rnd): return icicles(impact_fracture(faceted(geom, rnd), rnd), rnd)

def frostcut2(geom, rnd):
    return icicles(cracked(faceted(geom, rnd), rnd), rnd)

def frostcut(geom, rnd):
    # facet, crack into shards, then grow icicles on the finished shards so every icicle is rooted on ice
    return icicles(shattered(faceted(geom, rnd), rnd), rnd)

STYLES = {'A': ('Rime Icicle', icicles), 'B': ('Rime Shatter', shattered), 'C': ('Rime Facet', faceted), 'D': ('Rime Hoarfrost', hoarfrost), 'M': ('Rime', frostcut), 'N': ('Rime', frostcut2), 'V': ('Rime', frost_voronoi), 'G': ('Rime', frost_gilbert), 'I': ('Rime', frost_impact)}

def build(key):
    name, fn = STYLES[key]
    font = TTFont(SRC); cmap = font.getBestCmap(); glyf = font['glyf']
    for ch in CHARS + CHARS.lower():
        g = cmap.get(ord(ch))
        if not g or g in ('space',): continue
        rnd = random.Random(f'{key}{ch}')
        geom = fn(shape_of(font, g), rnd)
        pen = TTGlyphPen(None)
        for p in polys(geom):
            p = orient(p, sign=-1.0)
            for ring in [p.exterior, *p.interiors]:
                c = [(round(x), round(y)) for x, y in list(ring.coords)[:-1]]
                if len(c) < 3: continue
                pen.moveTo(c[0]); [pen.lineTo(q) for q in c[1:]]; pen.closePath()
        glyf[g] = pen.glyph()
    for g in font.getGlyphOrder():      # recompute bounds; drop hinting that no longer matches the outlines
        gl = glyf[g]; gl.recalcBounds(glyf)
        if hasattr(gl, 'program'):
            gl.program = Program(); gl.program.fromBytecode(b'')
    for t in ('fpgm', 'prep', 'cvt ', 'hdmx', 'LTSH', 'VDMX', 'gasp'):
        if t in font: del font[t]
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16): rec.string = name
        if rec.nameID == 6: rec.string = name.replace(' ', '') + '-Bold'
    font['head'].yMin = min(font['head'].yMin, -320); font['hhea'].descent = min(font['hhea'].descent, -320)
    font.flavor = 'woff2'; font.save(f'{OUT}/rime-{key}.woff2')

for k in (sys.argv[3] if len(sys.argv) > 3 else STYLES): build(k); print('built', k)
