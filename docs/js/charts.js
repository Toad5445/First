// Small SVG charts: one series per chart (small multiples), so nothing depends on telling colors apart.
import { STAT_KEYS, STATS } from './data.js';
import { parse, MONTHS } from './core.js';

const W = 300, H = 110, PL = 30, PR = 8, PT = 8, PB = 18;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = d => { const x = parse(d); return `${MONTHS[x.getMonth()]} ${x.getDate()}`; };

function niceMax(v) { if (v <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 2) / 2 * p; }

// pts: [{d, y, tip}]; kind: 'line' | 'bar'
export function chart({ title, value = '', pts, color = 'var(--a)', kind = 'line', min = null, max = null, unit = '' }) {
  if (!pts.length) return `<div class="chart"><div class="ct"><b>${esc(title)}</b></div><div class="empty">No data yet.</div></div>`;
  const ys = pts.map(p => p.y).filter(v => v != null);
  const lo = min != null ? min : Math.min(0, ...ys), hi = max != null ? max : niceMax(Math.max(...ys, 1));
  const iw = W - PL - PR, ih = H - PT - PB;
  const X = i => PL + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1));
  const Y = v => PT + ih - (v - lo) / ((hi - lo) || 1) * ih;
  let g = '';
  for (const t of [lo, (lo + hi) / 2, hi]) g += `<line class="gl" x1="${PL}" x2="${W - PR}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${PL - 5}" y="${Y(t) + 3}" text-anchor="end">${Math.round(t)}</text>`;
  g += `<text x="${PL}" y="${H - 3}">${short(pts[0].d)}</text><text x="${W - PR}" y="${H - 3}" text-anchor="end">${short(pts[pts.length - 1].d)}</text>`;
  let marks = '';
  if (kind === 'bar') {
    const bw = Math.max(2, Math.min(14, iw / pts.length - 2));
    pts.forEach((p, i) => {
      if (p.y == null || p.y <= 0) return;
      const x = (pts.length === 1 ? X(0) : PL + (i + 0.5) * iw / pts.length) - bw / 2, y = Y(p.y), h = Y(lo) - y;
      marks += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1, h)}" rx="${Math.min(2, bw / 2)}" fill="${color}"/>`;
    });
  } else {
    let dpath = '', open = false;
    pts.forEach((p, i) => { if (p.y == null) { open = false; return; } dpath += (open ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1); open = true; });
    marks = `<path d="${dpath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p.y != null).pop();
    if (last) marks += `<circle cx="${X(last[1])}" cy="${Y(last[0].y)}" r="4" fill="${color}" stroke="var(--panel)" stroke-width="2"/>`;
  }
  const data = esc(JSON.stringify({ x: pts.map((p, i) => kind === 'bar' && pts.length > 1 ? PL + (i + 0.5) * iw / pts.length : X(i)), tip: pts.map(p => p.tip || `${short(p.d)} · ${p.y == null ? '—' : p.y + unit}`), y: pts.map(p => p.y == null ? null : Y(p.y)) }));
  return `<div class="chart" data-c="${data}"><div class="ct"><b style="color:var(--text)">${esc(title)}</b><span>${esc(value)}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${g}${marks}<line class="xh" x1="0" x2="0" y1="${PT}" y2="${PT + ih}" stroke="var(--dim)" stroke-width="1" stroke-dasharray="2 2" visibility="hidden"/></svg></div>`;
}

// Crosshair + tooltip on every chart under root.
export function attachHover(root) {
  root.querySelectorAll('.chart[data-c]').forEach(el => {
    const c = JSON.parse(el.dataset.c), svg = el.querySelector('svg'), xh = svg.querySelector('.xh');
    let tip = null;
    const move = e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      let bi = 0; c.x.forEach((x, i) => { if (Math.abs(x - sx) < Math.abs(c.x[bi] - sx)) bi = i; });
      xh.setAttribute('x1', c.x[bi]); xh.setAttribute('x2', c.x[bi]); xh.setAttribute('visibility', 'visible');
      if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; el.appendChild(tip); }
      tip.textContent = c.tip[bi];
      const er = el.getBoundingClientRect();
      tip.style.left = Math.min(er.width - 60, Math.max(60, r.left - er.left + c.x[bi] / W * r.width)) + 'px';
      tip.style.top = (r.top - er.top + ((c.y[bi] != null ? c.y[bi] : PT) / H) * r.height) + 'px';
    };
    const leave = () => { xh.setAttribute('visibility', 'hidden'); if (tip) { tip.remove(); tip = null; } };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
  });
}

export function radar(stats, size = 300) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const max = Math.max(50, Math.ceil(Math.max(...Object.values(stats)) * 1.15 / 10) * 10);
  const ang = i => -Math.PI / 2 + i * Math.PI * 2 / 6;
  const P = (i, v) => [cx + Math.cos(ang(i)) * R * v / max, cy + Math.sin(ang(i)) * R * v / max];
  let g = '';
  for (const f of [0.25, 0.5, 0.75, 1]) g += `<polygon class="grid" points="${STAT_KEYS.map((_, i) => P(i, max * f).join(',')).join(' ')}"/>`;
  STAT_KEYS.forEach((_, i) => { const [x, y] = P(i, max); g += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; });
  const area = `<polygon class="area" points="${STAT_KEYS.map((k, i) => P(i, stats[k]).join(',')).join(' ')}"/>`;
  let labels = '', pts = '';
  STAT_KEYS.forEach((k, i) => {
    const [x, y] = P(i, max * 1.2), [px, py] = P(i, stats[k]);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
    labels += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"><tspan font-weight="600" style="fill:var(--${k})">${k}</tspan><tspan class="v" dx="5">${stats[k]}</tspan></text>`;
    pts += `<circle class="pt" cx="${px}" cy="${py}" r="4.5" style="stroke:var(--${k})"><title>${STATS[k].name}: ${stats[k]}</title></circle>`;
  });
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Stat radar">${g}${area}${pts}${labels}</svg>`;
}
