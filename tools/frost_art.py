# Frostbound: frost ferns grown irregularly in from every edge, under a frosted-glass sheen.
# python3 tools/frost_art.py   (prints the glass-sheen CSS for docs/app.css; the frost itself is tools/frost_needle.py)
import random, math, urllib.parse
def uri(s): return 'url("data:image/svg+xml,' + urllib.parse.quote(s, safe=" =:/'(),;-.") + '")'
X = "xmlns='http://www.w3.org/2000/svg'"
W, H = 600, 1000

def fern(x, y, ang, L, w, depth, rnd, out):
    """A spine that wanders as it grows and thins to a point; branches sprout at uneven angles and spacing."""
    segs = max(3, int(L / rnd.uniform(9, 16)))
    pts = [(x, y)]; a = ang; bend = rnd.uniform(-2.5, 2.5)
    for i in range(segs):
        a += bend + rnd.uniform(-7, 7); step = L / segs * rnd.uniform(.8, 1.2)
        x += math.cos(math.radians(a)) * step; y += math.sin(math.radians(a)) * step; pts.append((x, y))
    left, right = [], []
    for i, (px, py) in enumerate(pts):
        nx, ny = (pts[min(i + 1, segs)][0] - pts[max(i - 1, 0)][0]), (pts[min(i + 1, segs)][1] - pts[max(i - 1, 0)][1])
        n = math.hypot(nx, ny) or 1; ww = w * (1 - i / segs) ** .75 * rnd.uniform(.8, 1.15)
        left.append((px - ny / n * ww, py + nx / n * ww)); right.append((px + ny / n * ww, py - nx / n * ww))
    poly = left + right[::-1]
    out.append(f"<path d='M{' '.join(f'{p:.0f} {q:.0f}' for p, q in poly)}z'/>")
    if depth == 0: return
    for i in range(1, segs):
        if rnd.random() > rnd.uniform(.38, .78): continue
        t = i / segs; bl = L * (1 - t) * rnd.uniform(.25, .75)
        if bl < 14: continue
        da = math.degrees(math.atan2(pts[i+1][1] - pts[i][1], pts[i+1][0] - pts[i][0]))
        side = rnd.choice((-1, 1)) if rnd.random() < .45 else 0
        for sd in ((side,) if side else (-1, 1)):
            fern(pts[i][0], pts[i][1], da + sd * rnd.uniform(35, 80), bl * rnd.uniform(.7, 1.1), w * (1 - t) ** .6 * rnd.uniform(.55, .85), depth - 1, rnd, out)

def frost(seed=21):
    """Frost grows in uneven clumps from the edges: each clump has a thick frosted base and a handful of broad
    ferns, some crisp and some soft (out of focus), with wide gaps of clear glass between clumps."""
    rnd = random.Random(seed); layers = {'soft': [], 'mid': [], 'crisp': []}; mats = ''
    def on_edge(e, t):
        return {'l': (-8, t * H, 0), 'r': (W + 8, t * H, 180), 't': (t * W, -8, 90), 'b': (t * W, H + 8, -90)}[e]
    clumps = []
    per = (W + H) / 1600
    for e, n in (('l', 3), ('r', 3), ('t', 2), ('b', 2)):
        n = max(1, round(n * per * rnd.uniform(.8, 1.3)))
        for _ in range(n): clumps.append((e, rnd.uniform(.03, .97), rnd.uniform(.5, 1.6)))   # edge, position, size
    for e, t, size in clumps:
        x0, y0, inward = on_edge(e, t)
        r = 90 * size
        mats += f"<ellipse cx='{x0:.0f}' cy='{y0:.0f}' rx='{r * rnd.uniform(.9, 1.6):.0f}' ry='{r * rnd.uniform(.9, 1.6):.0f}' fill='url(#mat)'/>"
        for _ in range(int(rnd.uniform(2.6, 5.5) * size + 1)):
            jitter = rnd.uniform(-.09, .09)
            x, y, _ = on_edge(e, min(1, max(0, t + jitter)))
            L = rnd.uniform(50, 250) * (.6 + .5 * size)
            w = rnd.uniform(4, 8.5) * (.7 + .4 * size)
            depth = rnd.choices(('soft', 'mid', 'crisp'), weights=(3, 3, 4))[0]
            fern(x, y, inward + rnd.uniform(-55, 55), L, w, 2, rnd, layers[depth])
    d = ("<radialGradient id='vg' cx='.5' cy='.5' r='.72'><stop offset='.58' stop-color='#bfe6ff' stop-opacity='0'/><stop offset='.85' stop-color='#bfe6ff' stop-opacity='.1'/><stop offset='1' stop-color='#e6f7ff' stop-opacity='.28'/></radialGradient>"
         "<radialGradient id='mat'><stop offset='0' stop-color='#cfeaff' stop-opacity='.3'/><stop offset='.45' stop-color='#9fd2f2' stop-opacity='.12'/><stop offset='1' stop-color='#bfe6ff' stop-opacity='0'/></radialGradient>"
         "<filter id='h' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='9'/></filter>"
         "<filter id='so' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='3.2'/></filter>"
         "<filter id='m' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='1.6'/></filter>"
         "<filter id='c' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='.8'/></filter>"
         "<filter id='mb' x='-.5' y='-.5' width='2' height='2'><feGaussianBlur stdDeviation='14'/></filter>")
    So, M, C = (''.join(layers[k]) for k in ('soft', 'mid', 'crisp'))
    return uri(f"<svg {X} viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'><defs>{d}<g id='So'>{So}</g><g id='M'>{M}</g><g id='C'>{C}</g></defs>"
               f"<rect width='{W}' height='{H}' fill='url(#vg)'/><g filter='url(#mb)'>{mats}</g>"
               "<g fill='#7fbce8' opacity='.35' filter='url(#h)'><use href='#So'/><use href='#M'/><use href='#C'/></g>"   # cold glow
               "<use href='#So' fill='#a9d6f5' opacity='.32' filter='url(#so)'/>"                                  # out-of-focus frost
               "<use href='#M' fill='#c4e4fa' opacity='.38' filter='url(#m)'/>"
               "<g fill='#e2f3ff' opacity='.5' filter='url(#c)'><use href='#C'/></g>"                               # crisp frost
               "</svg>")

def sheen():
    # Glass reflections: one broad soft band with a brighter leading edge, a faint second band, and a gentle
    # top-left gloss. All heavily blurred so they read as light on glass, not shapes.
    d = ("<linearGradient id='b1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.32' stop-color='#eaf7ff' stop-opacity='.05'/>"
         "<stop offset='.5' stop-color='#f4fbff' stop-opacity='.15'/><stop offset='.56' stop-color='#ffffff' stop-opacity='.2'/><stop offset='.62' stop-color='#eaf7ff' stop-opacity='.07'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
         "<linearGradient id='b2' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#eaf7ff' stop-opacity='.1'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
         "<radialGradient id='gl' cx='.15' cy='.05' r='.8'><stop offset='0' stop-color='#dff3ff' stop-opacity='.12'/><stop offset='1' stop-color='#dff3ff' stop-opacity='0'/></radialGradient>"
         "<filter id='s' x='-.5' y='-.5' width='2' height='2'><feGaussianBlur stdDeviation='22'/></filter><filter id='s2' x='-.5' y='-.5' width='2' height='2'><feGaussianBlur stdDeviation='10'/></filter>")
    return uri(f"<svg {X} viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'><defs>{d}</defs>"
               f"<rect width='{W}' height='{H}' fill='url(#gl)'/>"
               "<g transform='rotate(-34 300 500)'><rect x='-400' y='250' width='1400' height='230' fill='url(#b1)' filter='url(#s)'/>"
               "<rect x='-400' y='520' width='1400' height='46' fill='url(#b2)' filter='url(#s2)'/></g></svg>")

if __name__ == '__main__':
    print('--frost-sheen:' + sheen() + ';')
