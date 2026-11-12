"""Render the chrome chain for Ledger's Cybercore theme (docs/ledger/art/chain.webp).

A small numpy ray marcher: interlocking stadium-shaped links (a circle swept along a rounded
rectangle), polished chrome reflecting a dark studio with a blue-violet light band, two bounces so
links reflect each other where they cross. Run: python3 tools/chain_render.py [out.webp]
"""
import sys, math
import numpy as np
from PIL import Image

import os
W, H, SS = int(os.environ.get("CW", 640)), int(os.environ.get("CH", 1400)), int(os.environ.get("CSS", 2))   # output size, supersampling
TUBE, RAD, HALF = 0.155, 0.33, 0.19    # tube radius, end radius (to tube centre), half straight length
PITCH = 2 * (HALF + RAD) - 2 * TUBE   # links pulled tight

def norm(v): return v / np.linalg.norm(v, axis=-1, keepdims=True)

# ---- chain layout: links follow a gently bending path that weaves toward and away from the camera
def build_links(n=21):
    links, rng = [], np.random.default_rng(4)
    pos = np.array([-1.55, 6.6, 0.0]); ang = math.radians(-17)
    up = np.array([0.0, 0.0, 1.0])
    for i in range(n):
        tdir = np.array([math.sin(ang) * -1, -math.cos(ang), 0.32 * math.cos(i * .55)])
        tdir = tdir / np.linalg.norm(tdir)
        twist = math.radians(rng.uniform(-14, 14)) + (math.pi / 2 if i % 2 else 0)
        # ring-plane normal: start from the camera axis, made perpendicular to the tangent, then twisted
        nz = up - tdir * np.dot(up, tdir); nz /= np.linalg.norm(nz)
        nx = np.cross(tdir, nz)
        nrm = nz * math.cos(twist) + nx * math.sin(twist)
        side = np.cross(tdir, nrm)
        links.append((pos.copy(), side, tdir, nrm))
        pos = pos + tdir * PITCH
        ang += math.radians(3.2 if i % 3 else -3.4)
    return links

LINKS = build_links()

def sdf_link(p, L):
    c, ax, ay, az = L
    q = p - c
    x, y, z = q @ ax, q @ ay, q @ az
    yy = np.maximum(np.abs(y) - HALF, 0)
    d2 = np.sqrt(x * x + yy * yy) - RAD
    return np.sqrt(d2 * d2 + z * z) - TUBE

def sdf(p, links):
    d = np.full(p.shape[0], 1e9)
    for L in links: d = np.minimum(d, sdf_link(p, L))
    return d

def normal(p, links):
    e = 1e-3; k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = sum(k[i] * sdf(p + k[i] * e, links)[:, None] for i in range(4))
    return norm(n)

def march(o, d, links, tmax, steps=140):
    t = np.zeros(o.shape[0]); hit = np.zeros(o.shape[0], bool); act = np.arange(o.shape[0])
    for _ in range(steps):
        if act.size == 0: break
        ds = sdf(o[act] + d[act] * t[act, None], links)
        h = ds < 4e-4
        hit[act[h]] = True
        t[act] += ds
        act = act[~h & (t[act] < tmax)]
    return t, hit

# ---- environment: black studio, a cold blue-violet band at the horizon, a big soft key light above-left
STYLE = os.environ.get('CSTYLE', 'neon')

def env(r):
    x, y, z = r[:, 0], r[:, 1], r[:, 2]
    c = np.zeros_like(r)
    c += np.array([.010, .011, .024]) * (1 + y[:, None])                      # deep navy black
    # horizon band sweeping cyan -> electric blue -> violet -> magenta across the room
    u = np.clip((x + 1) / 2, 0, 1)
    stops = np.array([[0.1, 1.0, 1.6], [0.15, 0.32, 2.0], [0.75, 0.22, 1.9], [1.9, 0.18, 1.1]])
    f = u * 3; i = np.minimum(f.astype(int), 2); fr = (f - i)[:, None]
    hue = stops[i] * (1 - fr) + stops[i + 1] * fr
    band = np.exp(-((y - .02) / .055) ** 2)[:, None] * 1.3
    c += band * hue * (.6 + .4 * np.exp(-(z - .5) ** 2 / .6))[:, None]
    key = np.exp(-np.sum((r - norm(np.array([-.45, .72, .55]))) ** 2, 1) / .05)[:, None]
    c += key * np.array([5.0, 5.8, 8.0])                                      # cool white key, top left
    glint = np.exp(-np.sum((r - norm(np.array([.2, .3, 1.]))) ** 2, 1) / .012)[:, None]
    c += glint * np.array([2.4, 2.6, 3.2])
    left = np.exp(-np.sum((r - norm(np.array([-1., .1, .25]))) ** 2, 1) / .06)[:, None]
    c += left * np.array([.15, .95, 2.6])                                     # electric cyan-blue panel, left
    rim = np.exp(-np.sum((r - norm(np.array([.95, -.05, -.2]))) ** 2, 1) / .05)[:, None]
    c += rim * np.array([2.8, .25, 1.8])                                      # hot magenta rim, right
    strip = (np.exp(-((x - .55) / .05) ** 2) * np.clip(y + .3, 0, 1) * (z > -.2))[:, None]
    c += strip * np.array([1.3, .45, 2.6])                                    # violet strip light
    sky = np.clip(y - .25, 0, 1)[:, None]
    c += sky * np.array([.02, .025, .07])
    floor = np.clip(-y - .25, 0, 1)[:, None]
    c = c * (1 - floor * .8) + floor * np.array([.005, .01, .06])              # blue bounce from below
    return c

def chrome(n, v):
    cos = np.clip(-np.sum(n * v, 1), 0, 1)[:, None]
    base = np.array([.78, .80, .90])
    F = base + (1 - base) * (1 - cos) ** 5
    # thin-film sheen: the colour drifts with viewing angle, like anodised / oil-slick chrome
    ph = 1.6 * (1 - cos) + .18 * n[:, 1:2]
    film = .62 + .38 * np.cos(2 * np.pi * (ph + np.array([0, .33, .67])))
    return F * (film * .55 + .45)

def render():
    w, h = W * SS, H * SS
    cam = np.array([0.0, 0.0, 26.0]); fov = math.radians(23)
    aspect = w / h
    img = np.zeros((h, w, 3)); alpha = np.zeros((h, w))
    strip_rows = 64
    for y0 in range(0, h, strip_rows):
        ys = (np.arange(y0, min(h, y0 + strip_rows)) + .5) / h
        xs = (np.arange(w) + .5) / w
        X, Y = np.meshgrid((xs * 2 - 1) * math.tan(fov / 2) * aspect, (1 - ys * 2) * math.tan(fov / 2))
        d = norm(np.stack([X.ravel(), Y.ravel(), -np.ones(X.size)], 1))
        o = np.repeat(cam[None], d.shape[0], 0)
        # links whose centre projects near this strip
        yc = (Y.max() + Y.min()) / 2 * 26; span = (Y.max() - Y.min()) / 2 * 26 + 1.4
        near = [L for L in LINKS if abs(L[0][1] - yc) < span]
        if not near: continue
        t0 = 26 - 3.0
        o = o + d * t0
        t, hit = march(o, d, near, 6.5)
        col = np.zeros((d.shape[0], 3))
        if hit.any():
            idx = np.where(hit)[0]
            p = o[idx] + d[idx] * t[idx, None]
            n = normal(p, near)
            v = d[idx]
            r = norm(v - 2 * np.sum(v * n, 1, keepdims=True) * n)
            F = chrome(n, v)
            refl = env(r)
            # second bounce: where the reflection lands on another link, show that link's reflection
            o2 = p + n * 3e-3
            t2, h2 = march(o2, r, LINKS, 4.0, 90)
            if h2.any():
                j = np.where(h2)[0]
                p2 = o2[j] + r[j] * t2[j, None]
                n2 = normal(p2, LINKS)
                r2 = norm(r[j] - 2 * np.sum(r[j] * n2, 1, keepdims=True) * n2)
                refl[j] = env(r2) * chrome(n2, r[j]) * .85
            # cheap ambient occlusion in the crevices where links meet
            ao = np.ones(idx.size)
            for k, wgt in ((.04, 2.5), (.1, 1.2), (.2, .5)):
                ao -= np.clip(k - sdf(p + n * k, LINKS), 0, None) * wgt
            ao = np.clip(ao, .25, 1)[:, None]
            col[idx] = refl * F * ao
        img[y0:y0 + Y.shape[0]] = col.reshape(Y.shape[0], w, 3)
        alpha[y0:y0 + Y.shape[0]] = hit.reshape(Y.shape[0], w)
    # filmic-ish tone curve, then sRGB
    img = 1 - np.exp(-img * 1.6)
    img = np.clip(img, 0, 1) ** (1 / 2.2)
    rgba = np.dstack([img * alpha[..., None], alpha])            # premultiplied for clean downsampling
    im = Image.fromarray((rgba * 255 + .5).astype(np.uint8), 'RGBA').resize((W, H), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    al = a[..., 3:4] / 255
    rgb = np.where(al > 0, a[..., :3] / np.maximum(al, 1e-6), 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a[..., 3]]).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'docs/ledger/art/chain.webp'
    im = render()
    im.save(out, quality=90, method=6) if out.endswith('.webp') else im.save(out)
    print('wrote', out, im.size)
