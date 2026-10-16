# Ossuary: four skull-and-bone display fonts, built by reshaping the outlines of open-licensed fonts
# (Cinzel Black and Bebas Neue, both SIL OFL). Run:
#   python3 ossuary.py <cinzel-black-merged.ttf> <bebas-merged.ttf> <out dir> [ABCD]
# Both sources must have their overlapping contours merged first (fontTools.ttLib.removeOverlaps).
import math, random, sys
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables.ttProgram import Program
from shapely import affinity
from shapely.geometry import Point, Polygon, LineString, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, polylabel

CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

# ---------- outline plumbing ----------
class Flat(BasePen):
    """Collects a glyph's contours as point rings, sampling curves finely."""
    def __init__(self, gs):
        super().__init__(gs); self.rings, self.cur = [], []
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _curveToOne(self, a, b, c):
        p0 = self.cur[-1]
        for i in range(1, 17):
            t = i / 16; m = 1 - t
            self.cur.append((m**3*p0[0] + 3*m*m*t*a[0] + 3*m*t*t*b[0] + t**3*c[0], m**3*p0[1] + 3*m*m*t*a[1] + 3*m*t*t*b[1] + t**3*c[1]))
    def _qCurveToOne(self, a, b):
        p0 = self.cur[-1]
        for i in range(1, 11):
            t = i / 10; m = 1 - t
            self.cur.append((m*m*p0[0] + 2*m*t*a[0] + t*t*b[0], m*m*p0[1] + 2*m*t*a[1] + t*t*b[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.rings.append(self.cur)
        self.cur = []
    _endPath = _closePath

def shape_of(font, name):
    pen = Flat(font.getGlyphSet()); font.getGlyphSet()[name].draw(pen)
    g = Polygon()
    for r in pen.rings:                      # overlaps are merged in the source, so even-odd is exact
        g = g.symmetric_difference(Polygon(r).buffer(0))
    return g.buffer(0)

def polys(g):
    return [g] if isinstance(g, Polygon) else [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]

def smooth(g, r):
    """Opening then closing: rounds sharp corners and fillets inside corners, like carved bone."""
    return g.buffer(-r, join_style=1).buffer(r, join_style=1).buffer(r, join_style=1).buffer(-r, join_style=1)

# ---------- the skull ----------
def ellipse(cx, cy, rx, ry, rot=0):
    return affinity.rotate(affinity.scale(Point(cx, cy).buffer(1, 48), rx, ry), rot, origin=(cx, cy))

def skull_features(cx, cy, r):
    """One skull face, designed in a unit circle and scaled to radius r: glaring sockets under a V brow,
    an inverted-heart nasal cavity, and a row of teeth drawn as a mouth line with separators."""
    u = lambda x, y: (cx + x * r, cy + y * r)
    parts = []
    for s in (-1, 1):
        ex, ey = cx + s * .37 * r, cy + .14 * r
        sock = ellipse(ex, ey, .29 * r, .25 * r, s * -8)
        brow = Polygon([u(s * .02, .16), u(s * .75, .40), u(s * .75, 1.2), u(s * .02, 1.2)])   # drops toward the nose
        sock = sock.difference(brow)
        parts.append(sock.buffer(-.03 * r).buffer(.03 * r))
    heart = unary_union([ellipse(*u(-.065, -.2), .085 * r, .075 * r, 35), ellipse(*u(.065, -.2), .085 * r, .075 * r, -35),
                         Polygon([u(-.14, -.21), u(.14, -.21), u(0, -.4)])])
    parts.append(heart.buffer(.01 * r))
    top, bot, half = -.5, -.74, .44                       # the teeth: one mouth line and six gaps
    gap = .065 * r
    parts.append(LineString([u(-half, (top + bot) / 2), u(half, (top + bot) / 2)]).buffer(gap / 2, cap_style=1))
    for i in range(7):
        x = -half + i * 2 * half / 6
        parts.append(LineString([u(x, top), u(x, bot)]).buffer(gap / 2, cap_style=1))
    return unary_union(parts)

def head_half_width(head, c):
    """Half the width of the letter along a horizontal line through c."""
    line = LineString([(c.x - 3000, c.y), (c.x + 3000, c.y)]).intersection(head)
    segs = [l for l in getattr(line, 'geoms', [line]) if l.geom_type == 'LineString' and l.distance(c) < 1]
    return segs[0].length / 2 if segs else 0

def skull_site(p, min_head):
    """Where one letter's skull goes: its roomiest counter, the face sized to the head around it."""
    head = Polygon(p.exterior); best = None
    for ring in p.interiors:
        h = Polygon(ring); c = polylabel(h, tolerance=2)
        if h.exterior.distance(c) < 40: continue
        R = min(head.exterior.distance(c) * .92, head_half_width(head, c) * .74)
        if R >= min_head * .92 and (best is None or R > best[2]): best = (h, c, R)
    return head, best

def skull_counters(g, min_head=115):
    """Fill one counter per letter and carve a skull face into the letter around it, so every skull matches."""
    out = g
    for p in polys(g):
        head, site = skull_site(p, min_head)
        if not site: continue
        h, c, R = site
        face = skull_features(c.x, c.y + R * .02, R).intersection(head.buffer(-max(18, R * .13)))
        out = unary_union([out, h]).difference(face)
    return out.buffer(0)

# ---------- bones ----------
def stroke_ends(g, min_len=60, max_len=175):
    """Short outline edges flanked by two convex corners: the ends of strokes."""
    ends = []
    for p in polys(g.simplify(3)):
        c = list(p.exterior.coords)[:-1]; n = len(c)
        def convex(i):
            a, b, d = c[i - 1], c[i], c[(i + 1) % n]
            cross = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0])
            ccw = Polygon(c).exterior.is_ccw
            v1 = (a[0] - b[0], a[1] - b[1]); v2 = (d[0] - b[0], d[1] - b[1])
            l1, l2 = math.hypot(*v1), math.hypot(*v2)
            ang = math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / ((l1 * l2) or 1)))))
            return ((cross > 0) == ccw) and 45 < ang < 135
        for i in range(n):
            a, b = c[i], c[(i + 1) % n]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            if min_len <= L <= max_len and convex(i) and convex((i + 1) % n):
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                nx, ny = -dy, dx
                if g.contains(Point(mx + nx * 4, my + ny * 4)): nx, ny = -nx, -ny     # outward
                ends.append(((mx, my), (dx, dy), (nx, ny), L))
    return ends

def bone_ends(g, ends, R_max=50):
    """A bone's end: two rounded condyles side by side, blended into the shaft. Same size on every stroke."""
    caps = []
    for (mx, my), (dx, dy), (nx, ny), L in ends:
        R = min(L * .42 + 10, R_max)
        pair = [Point(mx + dx * s * L * .36 + nx * R * .35, my + dy * s * L * .36 + ny * R * .35).buffer(R, 48) for s in (-1, 1)]
        elsewhere = g.difference(Point(mx, my).buffer(R * 1.5))
        if any(c.intersects(elsewhere) for c in pair): continue      # would collide with the letter's other strokes
        caps += pair
    g = unary_union([g, *caps]).buffer(0)
    return g.buffer(18, join_style=1).buffer(-18, join_style=1)   # fillet where the condyles meet the shaft

CURRENT = ''
SKIP_ENDS = {}   # per-letter stroke ends to leave plain, set in build(): the G's inner hook would read as a 6

def bones(g):
    ends = stroke_ends(g)
    if CURRENT in SKIP_ENDS: ends = [e for e in ends if not SKIP_ENDS[CURRENT](e, g)]
    return bone_ends(smooth(g, 6), ends)

def _inner_end(e, g):
    (mx, my), _, _, _ = e; minx, miny, maxx, maxy = g.bounds
    return miny + (maxy - miny) * .15 < my < miny + (maxy - miny) * .85

SKIP_ENDS.update({'G': _inner_end, 'g': _inner_end})

# ---------- teeth ----------
def bottom_edges(g, min_len=90):
    """Long downward-facing outer edges: nothing of the letter below them."""
    for p in polys(g.simplify(2)):
        c = list(p.exterior.coords)
        for (x1, y1), (x2, y2) in zip(c[:-1], c[1:]):
            L = math.hypot(x2 - x1, y2 - y1)
            if L < min_len or abs(y2 - y1) > L * .25: continue
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            if g.contains(Point(mx, my - 5)) or not g.contains(Point(mx, my + 5)): continue
            if g.intersects(LineString([(mx, my - 10), (mx, my - 1400)])): continue
            if x1 > x2: x1, y1, x2, y2 = x2, y2, x1, y1
            yield x1, y1, x2, y2

def tooth(x0, x1, top, ln, fang):
    """A tooth: wide at the gum, tapering slightly, with a rounded crown (or a point, for a fang)."""
    w = x1 - x0; cx = (x0 + x1) / 2; pts = [(x0, top + 22), (x0 + w * .03, top - ln * .7)]
    if fang:
        pts += [(x0 + w * .2, top - ln * .85), (cx, top - ln), (x1 - w * .2, top - ln * .85)]
    else:
        for i in range(13):                          # rounded crown
            a = math.pi + i * math.pi / 12
            pts.append((cx + math.cos(a) * w * .47, top - ln * .82 + math.sin(a) * ln * .18))
    pts += [(x1 - w * .03, top - ln * .7), (x1, top + 22)]
    return Polygon(pts).buffer(3).buffer(-3)

def jaw(g):
    teeth = []
    for x1, y1, x2, y2 in bottom_edges(g):
        L = x2 - x1; n = round(L / 50); w = L / max(n, 1); gap = 7
        if n < 3: continue
        top = (y1 + y2) / 2
        for i in range(n):
            fang = i in (0, n - 1)
            ln = (104 if fang else 64) - (5 if i % 2 else 0)
            teeth.append(tooth(x1 + i * w + gap / 2, x1 + (i + 1) * w - gap / 2, top, ln, fang))
    return unary_union([g, *teeth]).buffer(0)

# ---------- sutures ----------
def suture(cx, cy, r, half=.7):
    """The coronal suture: a fine interlocking zig-zag arcing over the top of the skull."""
    pts = []; n = 26
    for i in range(n + 1):
        t = -half + 2 * half * i / n; a = math.pi / 2 + t * 1.25
        rad = r * (.86 + (.07 if i % 2 else -.07))
        pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad * .92))
    return LineString(pts).buffer(r * .028, cap_style=1, join_style=2)

def catacomb(g):
    b = bones(g); out = skull_counters(b, min_head=95); sut = []
    for p in polys(b):
        head, site = skull_site(p, 95)
        if site:
            h, c, R = site
            sut.append(suture(c.x, c.y + R * .02, R).intersection(head.buffer(-max(18, R * .13))))
    return out.difference(unary_union(sut)).buffer(0) if sut else out

# ---------- the four ----------
STYLES = {
    'A': ('Ossuary Skull', 'cinzel', lambda g: skull_counters(g)),
    'B': ('Ossuary Bone', 'bebas', bones),
    'C': ('Ossuary Jaw', 'cinzel', jaw),
    'D': ('Ossuary Catacomb', 'bebas', catacomb),
}

def build(key, sources, out):
    name, base, fn = STYLES[key]
    font = TTFont(sources[base]); cmap = font.getBestCmap(); glyf = font['glyf']; hmtx = font['hmtx']
    done = set()
    for ch in CHARS + CHARS.lower():          # digits have no case: make sure each glyph is reshaped once
        gname = cmap.get(ord(ch))
        if not gname or gname in done: continue
        done.add(gname); globals()['CURRENT'] = ch
        orig = shape_of(font, gname); geom = fn(orig)
        # keep spacing: if a shape grew past the glyph's sides, widen its advance and shift it right
        adv, _ = hmtx[gname]; ominx, _, omaxx, _ = orig.bounds; minx, _, maxx, _ = geom.bounds
        shift = max(0, ominx - minx); geom = affinity.translate(geom, shift, 0)
        grow = max(0, geom.bounds[2] - (omaxx + shift))
        newadv = round(adv + shift + grow)
        pen = TTGlyphPen(None)
        for p in polys(geom):
            p = orient(p, sign=-1.0)
            for ring in [p.exterior, *p.interiors]:
                c = [(round(x), round(y)) for x, y in list(ring.coords)[:-1]]
                if len(c) >= 3: pen.moveTo(c[0]); [pen.lineTo(q) for q in c[1:]]; pen.closePath()
        glyf[gname] = pen.glyph(); hmtx[gname] = (newadv, round(geom.bounds[0]))
    for gname in font.getGlyphOrder():
        gl = glyf[gname]; gl.recalcBounds(glyf)
        if hasattr(gl, 'program'): gl.program = Program(); gl.program.fromBytecode(b'')
    for t in ('fpgm', 'prep', 'cvt ', 'hdmx', 'LTSH', 'VDMX', 'gasp', 'kern', 'GPOS'):
        if t in font: del font[t]                    # old kerning no longer matches the new widths
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16): rec.string = name
        if rec.nameID == 6: rec.string = name.replace(' ', '') + '-Regular'
    font['head'].yMin = min(font['head'].yMin, -320); font['hhea'].descent = min(font['hhea'].descent, -320)
    font['hhea'].advanceWidthMax = max(a for a, _ in hmtx.metrics.values())
    font.flavor = 'woff2'; font.save(f'{out}/ossuary-{key}.woff2')

if __name__ == '__main__':
    srcs = {'cinzel': sys.argv[1], 'bebas': sys.argv[2]}
    for k in (sys.argv[4] if len(sys.argv) > 4 else STYLES): build(k, srcs, sys.argv[3]); print('built', k)
