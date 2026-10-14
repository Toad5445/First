# Generates the detailed background art for the Obsidian Forge and Void Rift themes as SVG data URIs.
# python3 tools/theme_art.py > /tmp/art.css   (the output is pasted into docs/app.css)
import math, random, urllib.parse

def uri(svg):
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=" =:/'(),;#%-.") + '")'

def jag(x1, y1, x2, y2, steps, amp, rnd):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = x1 + (x2 - x1) * t; y = y1 + (y2 - y1) * t
        if 0 < i < steps:
            nx, ny = -(y2 - y1), (x2 - x1); l = math.hypot(nx, ny)
            o = rnd.uniform(-amp, amp)
            x += nx / l * o; y += ny / l * o
        pts.append((x, y))
    return pts

def path(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)

# ---------- Obsidian Forge: branching lava cracks + glass facets ----------
def forge():
    rnd = random.Random(7)
    W, H = 600, 1000
    cracks = []
    def grow(x, y, ang, length, depth, width):
        if depth > 4 or length < 18: return
        nx = x + math.cos(ang) * length; ny = y + math.sin(ang) * length
        pts = jag(x, y, nx, ny, max(3, int(length / 14)), length * .12, rnd)
        cracks.append((path(pts), width))
        for _ in range(rnd.choice([1, 2, 2, 3])):
            grow(nx, ny, ang + rnd.uniform(-.9, .9), length * rnd.uniform(.5, .8), depth + 1, width * .7)
    for sx, sy, a in [(-20, 860, -.35), (620, 700, 3.4), (120, 1020, -1.3), (480, 1020, -1.9), (-20, 560, .15), (620, 960, 3.0)]:
        grow(sx, sy, a, rnd.uniform(140, 210), 0, 2.4)
    facets = ''
    for _ in range(9):
        cx, cy = rnd.uniform(0, W), rnd.uniform(0, H * .7)
        r = rnd.uniform(90, 180)
        pts = [(cx + math.cos(a) * r * rnd.uniform(.6, 1.1), cy + math.sin(a) * r * rnd.uniform(.6, 1.1)) for a in sorted(rnd.uniform(0, 6.28) for _ in range(5))]
        facets += f"<path d='{path(pts)} Z' fill='%23ffffff' fill-opacity='{rnd.uniform(.012, .03):.3f}'/>"
    glow = ''.join(f"<path d='{d}' stroke-width='{w * 5:.1f}'/>" for d, w in cracks)
    core = ''.join(f"<path d='{d}' stroke-width='{w:.1f}'/>" for d, w in cracks)
    hot = ''.join(f"<path d='{d}' stroke-width='{max(.5, w * .35):.1f}'/>" for d, w in cracks if w > 1.6)
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMax slice'>"
           f"<defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='6'/></filter></defs>{facets}"
           f"<g fill='none' stroke-linecap='round' stroke-linejoin='round'>"
           f"<g stroke='%23ff4d0a' stroke-opacity='.35' filter='url(%23b)'>{glow}</g>"
           f"<g stroke='%23ff7a1f'>{core}</g><g stroke='%23ffe0a3'>{hot}</g></g></svg>")
    return uri(svg)

# ---------- Void Rift: jagged tear, side fractures, nebula ----------
def rift():
    rnd = random.Random(11)
    W, H = 600, 1000
    # the main tear: a lens shape with jagged edges running corner to corner
    x1, y1, x2, y2 = -40, 640, 640, 300
    n = 46
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        x = x1 + (x2 - x1) * t; y = y1 + (y2 - y1) * t
        w = math.sin(math.pi * t) ** 1.4 * 9 + .8
        top.append((x + rnd.uniform(-3, 3), y - w * rnd.uniform(.6, 1.3)))
        bot.append((x + rnd.uniform(-3, 3), y + w * rnd.uniform(.6, 1.3)))
    lens = path(top + bot[::-1]) + ' Z'
    core = path([(x1 + (x2 - x1) * i / n + rnd.uniform(-1.5, 1.5), y1 + (y2 - y1) * i / n + rnd.uniform(-1.5, 1.5)) for i in range(n + 1)])
    branches = ''
    for _ in range(14):
        t = rnd.uniform(.12, .88)
        bx = x1 + (x2 - x1) * t; by = y1 + (y2 - y1) * t
        a = math.atan2(y2 - y1, x2 - x1) + rnd.choice([-1, 1]) * rnd.uniform(.6, 1.4)
        L = rnd.uniform(30, 110)
        pts = jag(bx, by, bx + math.cos(a) * L, by + math.sin(a) * L, 5, 7, rnd)
        branches += f"<path d='{path(pts)}' stroke-width='{rnd.uniform(.6, 1.3):.1f}'/>"
    neb = ''
    for col, cx, cy, rx, ry, op in [('%237a3cff', 220, 520, 260, 110, .22), ('%2300e5d0', 420, 410, 220, 90, .16), ('%23b06bff', 120, 700, 200, 120, .12), ('%2340a0ff', 520, 260, 180, 80, .1)]:
        neb += f"<ellipse cx='{cx}' cy='{cy}' rx='{rx}' ry='{ry}' fill='{col}' fill-opacity='{op}' transform='rotate(-27 {cx} {cy})'/>"
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'>"
           f"<defs><filter id='n' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='40'/></filter>"
           f"<filter id='g' x='-20%' y='-80%' width='140%' height='260%'><feGaussianBlur stdDeviation='13'/></filter>"
           f"<linearGradient id='l' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='%237a3cff' stop-opacity='0'/><stop offset='.25' stop-color='%23a77bff'/>"
           f"<stop offset='.5' stop-color='%23ffffff'/><stop offset='.75' stop-color='%234ff5e4'/><stop offset='1' stop-color='%2300e5d0' stop-opacity='0'/></linearGradient></defs>"
           f"<g filter='url(%23n)'>{neb}</g>"
           f"<path d='{lens}' fill='%238a5cff' fill-opacity='.9' filter='url(%23g)'/><path d='{lens}' fill='%234ff5e4' fill-opacity='.35' filter='url(%23g)' transform='translate(0 -3)'/>"
           f"<path d='{lens}' fill='%23020104' fill-opacity='.92'/>"
           f"<path d='{lens}' fill='none' stroke='url(%23l)' stroke-width='1.8'/>"
           f"<path d='{core}' fill='none' stroke='url(%23l)' stroke-width='.8' stroke-opacity='.8'/>"
           f"<g fill='none' stroke='%23c9b4ff' stroke-opacity='.55' stroke-linecap='round'>{branches}</g></svg>")
    return uri(svg)

print('/* generated by tools/theme_art.py */')
print('--forge-art:' + forge() + ';')
print('--rift-art:' + rift() + ';')
