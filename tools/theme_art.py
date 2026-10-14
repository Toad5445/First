# Generates the background art for the Obsidian Forge and Void Rift themes as SVG data URIs.
# Everything is soft: fractal noise, blur and glow, no drawn outlines.
# python3 tools/theme_art.py   (prints CSS custom properties to paste into docs/app.css)
import urllib.parse


def uri(svg):
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=" =:/'(),;#%-.") + '")'


def forge():
    # Molten veins: fractal noise, keep only a narrow band around the noise midpoint (a "ridge"),
    # which gives organic veins of uneven thickness. A wide soft band makes the heat glow, a
    # narrow one the white-hot core.
    W, H = 600, 1000
    ridge = lambda width: ' '.join(['0'] * (10 - width) + ['.5', '1', '.5'] + ['0'] * (10 - width))
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMax slice'>"
           "<defs>"
           "<filter id='v' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>"
           "<feTurbulence type='fractalNoise' baseFrequency='.0038 .006' numOctaves='4' seed='9' result='n'/>"
           "<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='a'/>"
           f"<feComponentTransfer in='a' result='wide'><feFuncA type='table' tableValues='{' '.join(['0'] * 13 + ['.15', '.4', '.15'] + ['0'] * 13)}'/></feComponentTransfer>"
           f"<feComponentTransfer in='a' result='thin'><feFuncA type='table' tableValues='{' '.join(['0'] * 30 + ['.6'] + ['0'] * 30)}'/></feComponentTransfer>"
           "<feFlood flood-color='%23ff4a0a'/><feComposite in2='wide' operator='in' result='heat'/>"
           "<feGaussianBlur in='heat' stdDeviation='7' result='halo'/>"
           "<feFlood flood-color='%23ff8c2a'/><feComposite in2='thin' operator='in' result='vein'/>"
           "<feGaussianBlur in='vein' stdDeviation='1.2' result='veinS'/>"
           "<feFlood flood-color='%23ffc46b'/><feComposite in2='thin' operator='in'/><feGaussianBlur stdDeviation='.4' result='core'/>"
           "<feMerge><feMergeNode in='halo'/><feMergeNode in='veinS'/><feMergeNode in='core'/></feMerge>"
           "</filter>"
           # faint glassy sheen: very low-frequency noise, almost invisible
           "<filter id='s' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.003' numOctaves='2' seed='4'/>"
           "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0'/></filter>"
           "<linearGradient id='fade' x1='0' y1='0' x2='0' y2='1'><stop offset='.5' stop-color='%23fff' stop-opacity='0'/>"
           "<stop offset='.82' stop-color='%23fff' stop-opacity='.6'/><stop offset='1' stop-color='%23fff'/></linearGradient>"
           "<mask id='m'><rect width='100%' height='100%' fill='url(%23fade)'/></mask>"
           "</defs>"
           f"<rect width='{W}' height='{H}' filter='url(%23s)'/>"
           f"<rect width='{W}' height='{H}' filter='url(%23v)' mask='url(%23m)'/></svg>")
    return uri(svg)


def rift():
    # A tear of light: a long thin ellipse with its edges roughened by noise displacement, wrapped
    # in several blurred glows, sitting in a noise-textured nebula that hugs the tear.
    W, H = 600, 1000
    cx, cy, ang = 300, 470, -27
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'>"
           "<defs>"
           "<filter id='neb' x='-10%' y='-10%' width='120%' height='120%' color-interpolation-filters='sRGB'>"
           "<feTurbulence type='fractalNoise' baseFrequency='.006 .012' numOctaves='5' seed='21' result='n'/>"
           "<feColorMatrix in='n' values='1.3 0 0 0 -.35  0 .5 .4 0 -.1  .6 .4 1.2 0 -.2  0 0 0 1.6 -.55'/>"
           "<feGaussianBlur stdDeviation='3'/></filter>"
           "<radialGradient id='band'><stop offset='0' stop-color='%23fff'/><stop offset='.55' stop-color='%23fff' stop-opacity='.55'/><stop offset='1' stop-color='%23fff' stop-opacity='0'/></radialGradient>"
           "<mask id='bm'><ellipse cx='300' cy='470' rx='520' ry='230' fill='url(%23band)' transform='rotate(-27 300 470)'/></mask>"
           "<filter id='rough' x='-10%' y='-300%' width='120%' height='700%'>"
           "<feTurbulence type='fractalNoise' baseFrequency='.03 .09' numOctaves='3' seed='5' result='t'/>"
           "<feDisplacementMap in='SourceGraphic' in2='t' scale='14' xChannelSelector='R' yChannelSelector='G'/></filter>"
           "<filter id='b40' x='-50%' y='-800%' width='200%' height='1700%'><feGaussianBlur stdDeviation='34'/></filter>"
           "<filter id='b14' x='-50%' y='-800%' width='200%' height='1700%'><feGaussianBlur stdDeviation='13'/></filter>"
           "<filter id='b4' x='-50%' y='-800%' width='200%' height='1700%'><feGaussianBlur stdDeviation='3.5'/></filter>"
           "<filter id='b1' x='-50%' y='-800%' width='200%' height='1700%'><feGaussianBlur stdDeviation='1'/></filter>"
           "<linearGradient id='hue' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='%236a2cff'/><stop offset='.5' stop-color='%23b48cff'/><stop offset='1' stop-color='%2300e5d0'/></linearGradient>"
           "<linearGradient id='fadeEnds' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='%23fff' stop-opacity='0'/><stop offset='.2' stop-color='%23fff'/>"
           "<stop offset='.8' stop-color='%23fff'/><stop offset='1' stop-color='%23fff' stop-opacity='0'/></linearGradient>"
           f"<mask id='ends' maskUnits='userSpaceOnUse' x='-400' y='-400' width='1400' height='1800'><rect x='-120' y='{cy - 400}' width='840' height='800' fill='url(%23fadeEnds)' transform='rotate({ang} {cx} {cy})'/></mask>"
           "</defs>"
           f"<rect width='{W}' height='{H}' filter='url(%23neb)' mask='url(%23bm)'/>"
           f"<g transform='rotate({ang} {cx} {cy})' mask='url(%23ends)'>"
           f"<ellipse cx='{cx}' cy='{cy}' rx='420' ry='40' fill='url(%23hue)' fill-opacity='.45' filter='url(%23b40)'/>"
           f"<g filter='url(%23rough)'>"
           f"<ellipse cx='{cx}' cy='{cy}' rx='400' ry='11' fill='url(%23hue)' fill-opacity='.9' filter='url(%23b14)'/>"
           f"<ellipse cx='{cx}' cy='{cy}' rx='380' ry='4.5' fill='%23e9e0ff' filter='url(%23b4)'/>"
           f"<ellipse cx='{cx}' cy='{cy}' rx='340' ry='1.6' fill='%23ffffff' filter='url(%23b1)'/>"
           "</g></g></svg>")
    return uri(svg)


print('/* generated by tools/theme_art.py */')
print('--forge-art:' + forge() + ';')
print('--rift-art:' + rift() + ';')
