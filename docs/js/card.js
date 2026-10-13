// Shareable status card (1080x1350 PNG) drawn on a canvas in the current theme's colors.
import { STAT_KEYS, STATS } from './data.js';

export async function statusCard(info) {
  await document.fonts.ready;
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const accent = v('--a'), text = v('--text'), dim = v('--dim'), gold = v('--gold'), bg = v('--html-bg') || '#05070f';
  const head = v('--f-head'), mono = v('--f-mono'), body = v('--f-body');
  const aRgb = v('--a-rgb');

  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, 0, 50, W / 2, 0, H);
  grd.addColorStop(0, `rgba(${aRgb},.28)`); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);

  // window frame with corner brackets
  const m = 60;
  g.strokeStyle = `rgba(${aRgb},.45)`; g.lineWidth = 2; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.strokeStyle = accent; g.lineWidth = 6;
  g.beginPath(); g.moveTo(m - 3, m + 50); g.lineTo(m - 3, m - 3); g.lineTo(m + 50, m - 3); g.stroke();
  g.beginPath(); g.moveTo(W - m + 3, H - m - 50); g.lineTo(W - m + 3, H - m + 3); g.lineTo(W - m - 50, H - m + 3); g.stroke();

  g.textBaseline = 'alphabetic';
  g.fillStyle = accent; g.font = `600 26px ${mono}`;
  g.fillText('[ STATUS WINDOW ]', m + 50, m + 80);

  // rank box + name
  g.strokeStyle = accent; g.lineWidth = 3; g.strokeRect(m + 50, m + 120, 84, 84);
  g.fillStyle = accent; g.font = `700 48px ${body}`; g.textAlign = 'center'; g.fillText(info.rank, m + 92, m + 180);
  g.textAlign = 'left'; g.fillStyle = text; g.font = `700 64px ${head}`;
  g.fillText(info.name, m + 160, m + 188, W - 2 * m - 220);
  g.fillStyle = dim; g.font = `500 32px ${body}`;
  g.fillText(`${info.cls}  ·  ${info.title}`, m + 50, m + 260, W - 2 * m - 100);

  // level / streak
  g.fillStyle = dim; g.font = `600 30px ${body}`; g.fillText('LEVEL', m + 50, m + 340);
  g.fillStyle = text; g.font = `700 110px ${body}`; g.fillText(String(info.level), m + 50, m + 445);
  g.textAlign = 'right'; g.fillStyle = dim; g.font = `600 30px ${body}`; g.fillText('STREAK', W - m - 50, m + 340);
  g.fillStyle = gold; g.font = `700 110px ${body}`; g.fillText(String(info.streak), W - m - 50, m + 445);
  g.textAlign = 'left';
  // xp bar
  const bx = m + 50, by = m + 480, bw = W - 2 * m - 100;
  g.fillStyle = `rgba(${aRgb},.15)`; g.fillRect(bx, by, bw, 16);
  g.fillStyle = accent; g.fillRect(bx, by, bw * info.pct, 16);

  // radar
  const cx = W / 2, cy = m + 820, R = 230;
  const max = Math.max(50, Math.ceil(Math.max(...Object.values(info.stats)) * 1.15 / 10) * 10);
  const ang = i => -Math.PI / 2 + i * Math.PI * 2 / 6;
  const P = (i, val) => [cx + Math.cos(ang(i)) * R * val / max, cy + Math.sin(ang(i)) * R * val / max];
  g.strokeStyle = `rgba(${aRgb},.22)`; g.lineWidth = 2;
  for (const f of [0.25, 0.5, 0.75, 1]) { g.beginPath(); STAT_KEYS.forEach((_, i) => { const [x, y] = P(i, max * f); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke(); }
  g.beginPath(); STAT_KEYS.forEach((k, i) => { const [x, y] = P(i, info.stats[k]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
  g.fillStyle = `rgba(${aRgb},.22)`; g.fill(); g.strokeStyle = accent; g.lineWidth = 4; g.stroke();
  STAT_KEYS.forEach((k, i) => {
    const [x, y] = P(i, max * 1.24);
    g.textAlign = Math.abs(x - cx) < 5 ? 'center' : x > cx ? 'left' : 'right';
    g.fillStyle = v('--' + k) || text; g.font = `700 32px ${mono}`; g.fillText(k, x, y);
    g.fillStyle = text; g.font = `600 30px ${body}`; g.fillText(String(info.stats[k]), x, y + 36);
  });
  g.textAlign = 'center'; g.fillStyle = dim; g.font = `500 26px ${mono}`;
  g.fillText(`BEST STREAK ${info.best}  ·  ${info.quests} QUESTS CLEARED`, W / 2, H - m - 90);
  g.fillStyle = accent; g.font = `600 24px ${mono}`;
  g.fillText('THE SYSTEM', W / 2, H - m - 45);

  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'status.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Status Window' }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'status-window.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
