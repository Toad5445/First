# Frostbound: frost ferns grown irregularly in from every edge, under a frosted-glass sheen.
# python3 tools/frost_art.py   (writes docs/art/frost.svg and prints the sheen CSS for docs/app.css)
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
        n = math.hypot(nx, ny) or 1; ww = w * (1 - i / segs) ** 1.2 * rnd.uniform(.8, 1.15)
        left.append((px - ny / n * ww, py + nx / n * ww)); right.append((px + ny / n * ww, py - nx / n * ww))
    poly = left + right[::-1]
    out.append(f"<path d='M{' '.join(f'{p:.0f} {q:.0f}' for p, q in poly)}z'/>")
    if depth == 0: return
    for i in range(1, segs):
        if rnd.random() > rnd.uniform(.45, .9): continue
        t = i / segs; bl = L * (1 - t) * rnd.uniform(.25, .75)
        if bl < 6: continue
        da = math.degrees(math.atan2(pts[i+1][1] - pts[i][1], pts[i+1][0] - pts[i][0]))
        side = rnd.choice((-1, 1)) if rnd.random() < .45 else 0
        for sd in ((side,) if side else (-1, 1)):
            fern(pts[i][0], pts[i][1], da + sd * rnd.uniform(35, 80), bl * rnd.uniform(.7, 1.1), w * (1 - t) * rnd.uniform(.5, .8), depth - 1, rnd, out)

def frost(seed=21):
    rnd = random.Random(seed); big, small = [], []
    def edge_seed():
        e = rnd.choices('lrtb', weights=(5, 5, 3, 4))[0]
        if e == 'l': return -5, rnd.uniform(-50, H + 50), rnd.uniform(-60, 60)
        if e == 'r': return W + 5, rnd.uniform(-50, H + 50), 180 + rnd.uniform(-60, 60)
        if e == 't': return rnd.uniform(-50, W + 50), -5, 90 + rnd.uniform(-60, 60)
        return rnd.uniform(-50, W + 50), H + 5, -90 + rnd.uniform(-60, 60)
    per = (W + H) / 1600                         # more ferns on a bigger pane
    for _ in range(int(34 * per)):
        x, y, a = edge_seed(); fern(x, y, a, rnd.uniform(70, 260), rnd.uniform(2.2, 5), 2, rnd, big)
    for _ in range(int(40 * per)):     # small stray crystals scattered in from the edges
        x, y, a = edge_seed()
        d = abs(rnd.gauss(0, 80)); x += math.cos(math.radians(a)) * d; y += math.sin(math.radians(a)) * d
        fern(x, y, rnd.uniform(0, 360), rnd.uniform(14, 50), rnd.uniform(1, 2), 1, rnd, small)
    rime = ''
    for _ in range(int(320 * per)):
        e = rnd.choice('lrtb'); dpt = abs(rnd.gauss(0, 34))
        x = dpt if e == 'l' else W - dpt if e == 'r' else rnd.uniform(0, W)
        y = dpt if e == 't' else H - dpt if e == 'b' else rnd.uniform(0, H)
        rime += f"<circle cx='{x:.0f}' cy='{y:.0f}' r='{rnd.uniform(.5,1.6):.1f}' fill-opacity='{rnd.uniform(.2,.75):.2f}'/>"
    B = ''.join(big); Sm = ''.join(small)
    d = ("<radialGradient id='vg' cx='.5' cy='.5' r='.72'><stop offset='.58' stop-color='#bfe6ff' stop-opacity='0'/><stop offset='.85' stop-color='#bfe6ff' stop-opacity='.13'/><stop offset='1' stop-color='#e6f7ff' stop-opacity='.34'/></radialGradient>"
         "<filter id='h' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='6'/></filter>"
         "<filter id='m' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='1.6'/></filter>"
         "<filter id='c' x='-.1' y='-.1' width='1.2' height='1.2'><feGaussianBlur stdDeviation='.55'/></filter>")
    return uri(f"<svg {X} viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'><defs>{d}</defs>"
               f"<rect width='{W}' height='{H}' fill='url(#vg)'/>"
               f"<defs><g id='B'>{B}</g><g id='S'>{Sm}</g></defs>"
               "<use href='#B' fill='#a9dcff' opacity='.42' filter='url(#h)'/>"       # cold glow around the frost
               "<g fill='#d6f0ff' opacity='.32' filter='url(#m)'><use href='#B'/><use href='#S'/></g>"   # soft body
               "<g fill='#f2fbff' opacity='.5' filter='url(#c)'><use href='#B'/><use href='#S'/></g>"
               f"<g fill='#eef9ff' filter='url(#c)'>{rime}</g></svg>")

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
    raw = uri
    globals()['uri'] = lambda svg: svg          # the frost art is a standalone file, not a data URI
    open('docs/art/frost.svg', 'w').write(frost())
    W, H = 1600, 1000                           # landscape version for wide screens, so the frost isn't scaled up
    open('docs/art/frost-wide.svg', 'w').write(frost())
    W, H = 600, 1000
    globals()['uri'] = raw
    print('--frost-sheen:' + sheen() + ';')
