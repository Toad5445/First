// The four looks. Each theme supplies its backdrop (ART), the brand block, the side block, the panel header,
// and the small words it uses. Layout and behaviour live in ledger.js and ledger.css.
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const word = n => WORDS[n] || String(n);
export function roman(n) {
  if (!n) return '·';
  let s = ''; for (const [v, r] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; }
  return s;
}

// small seeded random so the art is the same on every visit
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z"/></svg>';
const MON3 = m => m.slice(0, 3);
const DOW3 = d => d.slice(0, 3);
const mmdd = c => `${String(c.now.getMonth() + 1).padStart(2, '0')}.${String(c.date).padStart(2, '0')}`;
const tabTitle = (c, tasks, wo, st, hist) => c.tab === 'workout' ? wo : c.tab === 'settings' ? st : c.tab === 'history' ? hist : tasks;

function barcode(seed, n = 38) {
  const r = rng(seed); let x = 0, s = '';
  for (let i = 0; i < n; i++) { const w = [1, 1, 2, 3][Math.floor(r() * 4)]; s += `<rect x="${x}" width="${w}" height="26"/>`; x += w + 1.6; }
  return `<svg class="barcode" viewBox="0 0 ${x.toFixed(0)} 26" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
}

// ==================================================================== AERO
function aeroArt() {
  const r = rng(7);
  const bubbles = Array.from({ length: 16 }, (_, i) => {
    const s = Math.round(14 + Math.pow(r(), 2.2) * 120);
    return `<i style="--s:${s}px;left:${(r() * 100).toFixed(1)}%;top:${(8 + r() * 80).toFixed(1)}%;--d:${(9 + r() * 10).toFixed(1)}s;--dl:-${(r() * 10).toFixed(1)}s;--dy:${(-14 - r() * 26).toFixed(0)}px"></i>`;
  }).join('');
  return `<div class="ae-sky"></div><div class="ae-sun"></div>
  <svg class="ae-clouds" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
    <filter id="aecl" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0028 .0062" numOctaves="6" seed="11"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -1.25"/><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="aecl2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0016 .004" numOctaves="5" seed="4"/>
      <feColorMatrix values="0 0 0 0 .95  0 0 0 0 .97  0 0 0 0 1  2.2 0 0 0 -1.05"/><feGaussianBlur stdDeviation="2"/></filter>
    <linearGradient id="aefade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient>
    <mask id="aem"><rect width="1440" height="900" fill="url(#aefade)"/></mask></defs>
    <g mask="url(#aem)"><rect width="1440" height="900" filter="url(#aecl2)"/><rect width="1440" height="900" filter="url(#aecl)"/></g></svg>
  <svg class="ae-swoosh" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="aesw" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff" stop-opacity=".9"/><stop offset=".7" stop-color="#d5f6ff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="aesw2" x1="0" x2="1"><stop offset="0" stop-color="#7cf0ff" stop-opacity="0"/><stop offset=".5" stop-color="#9ff7e6" stop-opacity=".55"/><stop offset="1" stop-color="#7cf0ff" stop-opacity="0"/></linearGradient>
    <filter id="aeblur"><feGaussianBlur stdDeviation="5"/></filter><filter id="aeblur2"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
    <path d="M-40 700 C 300 600 620 760 980 640 S 1380 520 1500 560" stroke="url(#aesw2)" stroke-width="70" fill="none" filter="url(#aeblur)"/>
    <path d="M-40 690 C 300 590 620 750 980 630 S 1380 510 1500 550" stroke="url(#aesw)" stroke-width="3" fill="none" filter="url(#aeblur2)"/>
    <path d="M-40 724 C 340 640 640 790 1000 668 S 1390 560 1500 600" stroke="url(#aesw)" stroke-width="1.4" fill="none" opacity=".8"/>
    <path d="M-40 742 C 360 668 660 812 1020 690 S 1400 590 1500 628" stroke="url(#aesw)" stroke-width="8" fill="none" opacity=".35" filter="url(#aeblur)"/></svg>
  <svg class="ae-hills" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="aeh1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be35b"/><stop offset=".5" stop-color="#4dbb2c"/><stop offset="1" stop-color="#1f8a2a"/></linearGradient>
    <linearGradient id="aeh2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bdf0a0"/><stop offset="1" stop-color="#5fc07b"/></linearGradient>
    <linearGradient id="aegl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="aehb"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <path d="M0 120 C 220 60 420 70 640 112 S 1060 150 1240 84 S 1420 70 1440 78 V260 H0Z" fill="url(#aeh2)" opacity=".85"/>
    <path d="M0 160 C 260 96 520 110 760 150 S 1180 196 1440 120 V260 H0Z" fill="url(#aeh1)"/>
    <path d="M0 160 C 260 96 520 110 760 150 S 1180 196 1440 120 V200 C 1180 236 960 210 760 196 S 260 150 0 206Z" fill="url(#aegl)"/>
    <path d="M0 160 C 260 96 520 110 760 150 S 1180 196 1440 120" stroke="#f4ffe6" stroke-width="2.4" fill="none" opacity=".9" filter="url(#aehb)"/></svg>
  <div class="ae-bubbles" aria-hidden="true">${bubbles}</div>`;
}
const aeroClock = () => `<svg viewBox="0 0 100 100" class="ae-clock" aria-hidden="true"><defs>
    <radialGradient id="aecf" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eaf4ff"/><stop offset="1" stop-color="#c7dcf6"/></radialGradient>
    <linearGradient id="aerim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9fb4d8"/><stop offset=".55" stop-color="#5d7299"/><stop offset="1" stop-color="#e4ecfa"/></linearGradient>
    <linearGradient id="aegls" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <circle cx="50" cy="50" r="48" fill="url(#aerim)"/><circle cx="50" cy="50" r="43" fill="url(#aecf)"/>
  ${Array.from({ length: 12 }, (_, i) => `<rect x="49.2" y="${i % 3 ? 10 : 9}" width="${i % 3 ? 1.6 : 2.4}" height="${i % 3 ? 4 : 7}" rx=".8" fill="${i % 3 ? '#8aa3cc' : '#2f54ff'}" transform="rotate(${i * 30} 50 50)"/>`).join('')}
  <text x="50" y="36" text-anchor="middle" class="ae-clock-brand">LEDGER</text>
  <rect class="hand-h" x="48.2" y="26" width="3.6" height="26" rx="1.8" fill="#16183a"/>
  <rect class="hand-m" x="49" y="15" width="2" height="37" rx="1" fill="#16183a"/>
  <g class="hand-s"><rect x="49.5" y="12" width="1" height="46" fill="#ff3e7d"/></g>
  <circle cx="50" cy="50" r="3.2" fill="#2f54ff" stroke="#fff" stroke-width="1"/>
  <path d="M10 46 A40 40 0 0 1 90 46 Q50 34 10 46Z" fill="url(#aegls)" opacity=".75"/></svg>`;

const aero = {
  name: 'Aero', color: '#2164f5', check: 'gel',
  tabNames: ['Tasks', 'Workout', 'History', '<svg viewBox="0 0 24 24" class="gear" aria-label="Settings"><path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 4.7.1-1.3-.1-1.3 2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-2.2-1.3L15.4 2.6h-4l-.4 2.7a8 8 0 0 0-2.2 1.3l-2.5-1-2 3.5L6.4 10.7l-.1 1.3.1 1.3-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 2.2 1.3l.4 2.7h4l.4-2.7a8 8 0 0 0 2.2-1.3l2.5 1 2-3.5Z"/></svg>'],
  placeholder: 'Add a task…', addLabel: 'Add', empty: 'Nothing on the list yet. Type above to add your first task.',
  num: i => String(i).padStart(2, '0'),
  count: c => c.total ? `<b>${c.done}</b> / ${c.total} done` : 'nothing yet',
  head: c => `<header class="ph">
      <div class="titlebar"><span class="orbs" aria-hidden="true"><i></i><i></i><i></i></span><span class="tb-title">Ledger</span><span class="tb-path">${tabTitle(c, 'today', 'workout', 'settings', 'history')}</span></div>
      <div class="ph-row"><h2>${tabTitle(c, 'Today', 'Workout', 'Settings', 'History')}</h2><div class="d">${c.dow.toLowerCase()}<br>${c.date} ${MON3(c.month).toLowerCase()} ${c.year}</div></div>
    </header>`,
  brand: c => `<div class="ae-brand">
      <svg class="spark s1" viewBox="0 0 24 24"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z"/></svg>
      <svg class="spark s2" viewBox="0 0 24 24"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z"/></svg>
      <div class="word">Ledger<sup>™</sup></div>
      <div class="under"><span class="chip">${DOW3(c.dow).toUpperCase()} ${mmdd(c)}</span><p>Write it down in the morning. Tick it off as the day goes. That’s the whole thing.</p></div></div>`,
  side: c => `<div class="ae-side">
      <div class="micro">Ledger® daily report<br>No. ${c.doy} — ${MON3(c.month)} ${c.year}</div>
      ${barcode(3)}<div class="gadgets">
        <div class="gadget g-clock">${aeroClock()}<span class="g-cap" data-clock="hm"></span></div>
        <div class="gadget g-orb"><div class="orb"><b>${c.done}</b><span>of ${c.total}</span></div><span class="g-cap">${c.total && c.done === c.total ? 'all done' : 'done today'}</span></div>
      </div></div>`,
  swatch: '<span class="sw sw-aero"><i></i><i></i><b>Ledger</b></span>'
};

// ==================================================================== CYBER
// a ray-traced chrome chain (tools/chain_render.py)
const chain = () => '<img class="cy-chain" src="art/chain.webp" alt="" decoding="async">';
const cyber = {
  name: 'Cybercore', color: '#070709', check: 'xbox',
  tabNames: ['Tasks', 'Workout', 'Archive', 'Settings'],
  placeholder: 'Add a task', addLabel: 'Enter ↵', addIcon: '<span class="plus" aria-hidden="true">+</span>',
  empty: 'No entries. The day is open.',
  num: (i, d) => d ? 'CLOSED' : String(i).padStart(2, '0'),
  count: c => `${c.done}<small>/${c.total}</small>`,
  head: c => `<header class="ph"><span class="reg" aria-hidden="true"></span>
      <div class="ph-row"><h2>${tabTitle(c, `${DOW3(c.dow).toUpperCase()} ${mmdd(c)}`, 'WORKOUT', 'SETTINGS', 'ARCHIVE')}</h2><span class="stamp">${c.year} · <span data-clock="hms"></span></span></div></header>`,
  brand: c => `<div class="cy-brand"><div class="word" aria-label="Ledger">LEDGER</div>
      <div class="tag"><span class="pill">TODAY ONLY</span><p>A record of what must be done before the day closes. Write it down. Cross it out. Begin again tomorrow.</p></div></div>`,
  side: c => `<div class="cy-side">
      <div class="micro">Ledger / Daily obligations<br>Unit ${String(c.doy).padStart(4, '0')} — <b>${c.total && c.done === c.total ? 'cleared' : 'active'}</b></div>
      <div class="micro r">Every task is recorded.<br>Nothing is forgotten.</div>
      <dl class="readout"><div><dt>Logged</dt><dd>${String(c.total).padStart(2, '0')}</dd></div><div><dt>Closed</dt><dd>${String(c.done).padStart(2, '0')}</dd></div><div><dt>Open</dt><dd>${String(c.total - c.done).padStart(2, '0')}</dd></div></dl>
      <div class="meter" aria-hidden="true"><i style="width:${c.total ? (c.done / c.total * 100).toFixed(0) : 0}%"></i></div>
      ${barcode(c.doy)}<div class="micro sm">${c.year}-${mmdd(c).replace('.', '-')} / <span data-clock="hms"></span></div></div>`,
  swatch: '<span class="sw sw-cyber"><i></i><b>LEDGER</b></span>'
};
function cyberArt() {
  return `<div class="cy-light"></div><div class="cy-smear"></div>${chain()}<div class="cy-cols" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="cy-noise"></div><div class="cy-vig"></div>`;
}

// ==================================================================== DARK ACADEMIA
function sigil() {
  const P = Math.PI, pt = (r, a) => [(Math.sin(a) * r).toFixed(2), (-Math.cos(a) * r).toFixed(2)];
  let ticks = '';
  for (let i = 0; i < 360; i += 2) { const a = i * P / 180, L = i % 30 === 0 ? 18 : i % 10 === 0 ? 11 : 6; const [x1, y1] = pt(282, a), [x2, y2] = pt(282 - L, a); ticks += `M${x1} ${y1}L${x2} ${y2}`; }
  const nums = Array.from({ length: 12 }, (_, i) => `<text transform="rotate(${i * 30 + 15}) translate(0 -238)">${roman(i + 1)}</text>`).join('');
  const hept = Array.from({ length: 7 }, (_, k) => pt(196, (k * 3 % 7) * 2 * P / 7)).map(p => p.join(' ')).join(' ');
  const nodes = Array.from({ length: 7 }, (_, k) => { const [x, y] = pt(196, k * 2 * P / 7); return `<circle cx="${x}" cy="${y}" r="10" class="node"/><circle cx="${x}" cy="${y}" r="2.4" class="fill"/>`; }).join('');
  const tri = [0, 1, 2].map(k => pt(118, k * 2 * P / 3).join(' ')).join(' ');
  const sq = [0, 1, 2, 3].map(k => pt(118, P / 4 + k * P / 2).join(' ')).join(' ');
  let rays = ''; for (let i = 0; i < 24; i++) { const a = i * P / 12, [x1, y1] = pt(40, a), [x2, y2] = pt(i % 2 ? 52 : 64, a); rays += `M${x1} ${y1}L${x2} ${y2}`; }
  const dots = Array.from({ length: 48 }, (_, i) => { const [x, y] = pt(212, i * P / 24 + P / 48); return `<circle cx="${x}" cy="${y}" r="${i % 4 ? 1 : 1.8}" class="fill"/>`; }).join('');
  return `<svg class="sigil" viewBox="-300 -300 600 600" aria-hidden="true"><defs>
    <linearGradient id="dkgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dfa2"/><stop offset=".3" stop-color="#c39a4e"/><stop offset=".55" stop-color="#7a5524"/><stop offset=".78" stop-color="#e2c27a"/><stop offset="1" stop-color="#8f6a30"/></linearGradient>
    <radialGradient id="dkfade" cx="0" cy="0" r="300" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></radialGradient>
    <mask id="dkm"><rect x="-300" y="-300" width="600" height="600" fill="url(#dkfade)"/></mask>
    <filter id="dkglow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g mask="url(#dkm)" filter="url(#dkglow)" class="gold">
      <g class="ring-outer"><circle r="290"/><circle r="282"/><path d="${ticks}"/><circle r="258"/><g class="nums">${nums}</g><circle r="222"/>${dots}</g>
      <g class="ring-mid"><polygon points="${hept}"/>${nodes}<circle r="196" class="thin"/></g>
      <g class="ring-inner"><circle r="118"/><polygon points="${tri}" class="thin"/><polygon points="${sq}" class="thin"/><circle r="72"/>
        <path d="${rays}"/><circle r="36"/><circle r="7" class="fill"/>
        <path class="moon" d="M-6 -150 a 14 14 0 1 0 0 28 a 11 11 0 1 1 0 -28Z"/></g>
    </g></svg>`;
}
function moon(now) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const p = (((now - ref) / 864e5 / syn) % 1 + 1) % 1, r = 30;
  const k = Math.cos(2 * Math.PI * p) * r, waxing = p < .5;
  // lit limb on the right while waxing, on the left while waning; the terminator is a half-ellipse
  const limb = waxing ? 1 : 0, term = (waxing ? (p < .25 ? 0 : 1) : (p < .75 ? 1 : 0));
  const lit = `M0 ${-r} A${r} ${r} 0 0 ${limb} 0 ${r} A${Math.abs(k).toFixed(2)} ${r} 0 0 ${term} 0 ${-r}Z`;
  const name = p < .03 || p > .97 ? 'Luna nova' : p < .22 ? 'Luna crescens' : p < .28 ? 'Quadratura prima' : p < .47 ? 'Luna gibbosa' : p < .53 ? 'Luna plena' : p < .72 ? 'Luna gibbosa decrescens' : p < .78 ? 'Quadratura ultima' : 'Luna decrescens';
  return { name, svg: `<svg class="moonph" viewBox="-36 -36 72 72" aria-hidden="true"><circle r="${r}" class="dark"/><path d="${lit}" class="lit"/><circle r="${r}" class="rim"/></svg>` };
}
const CORNER = '<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M2 58V20Q2 2 20 2h38M8 58V22Q8 8 22 8h36M2 2l12 12M14 4a10 10 0 0 0 10 10"/><circle cx="16" cy="16" r="2.4"/></svg>';
function darkArt() {
  const r = rng(13);
  const motes = Array.from({ length: 26 }, () => `<i style="left:${(r() * 100).toFixed(1)}%;--s:${(1 + r() * 2.4).toFixed(1)}px;--d:${(16 + r() * 22).toFixed(0)}s;--dl:-${(r() * 30).toFixed(0)}s;--x:${(-40 + r() * 80).toFixed(0)}px"></i>`).join('');
  return `<div class="dk-void"></div><div class="dk-candle"></div><div class="dk-candle c2"></div><div class="dk-motes" aria-hidden="true">${motes}</div><div class="dk-noise"></div>`;
}
const dark = {
  name: 'Dark Academia', color: '#0e0905', check: 'seal',
  tabNames: ['Tasks', 'Exercises', 'Records', 'Settings'],
  placeholder: 'Inscribe a task…', addLabel: 'Add', empty: 'The page is blank. Inscribe the day’s work above.',
  num: i => roman(i),
  count: c => `<span class="tw">${c.total ? `${word(c.done)[0].toUpperCase() + word(c.done).slice(1)} of ${word(c.total)} ${c.done === 1 ? 'is' : 'are'} done.` : 'Nothing yet set down.'}</span><b>${roman(c.done)} · ${roman(c.total)}</b>`,
  head: c => `<header class="ph"><span class="corner tl">${CORNER}</span><span class="corner tr">${CORNER}</span><span class="corner bl">${CORNER}</span><span class="corner br">${CORNER}</span>
      <div class="over">${tabTitle(c, 'THE LEDGER OF', 'THE EXERCISES OF', 'THE ORDERING OF', 'THE RECORDS OF')}</div>
      <h2>${tabTitle(c, c.dow, c.dow, 'the Ledger', 'Days Past')}</h2>
      <div class="date">the <em>${c.ord}</em> of ${c.month}, ${roman(c.year)}</div>
      <div class="fleuron" aria-hidden="true"><i></i>${STAR}<i></i></div></header>`,
  brand: c => `<div class="dk-brand">${sigil()}<div class="dk-title"><div class="over">LIBER · DIERUM</div><div class="word">Ledger</div><div class="sub">${roman(c.year)}</div></div></div>`,
  side: c => { const m = moon(c.now); return `<div class="dk-side">${m.svg}<div class="mname">${m.name}</div>
      <div class="dk-rule" aria-hidden="true"><i></i>${STAR}<i></i></div>
      <blockquote>“Festina lente.”<b>MAKE HASTE SLOWLY</b></blockquote>
      <div class="folio">FOLIO ${roman(c.doy)}</div></div>`; },
  swatch: '<span class="sw sw-dark"><svg viewBox="-50 -50 100 100"><circle r="44"/><circle r="38"/><polygon points="0.0,-32.0 13.9,28.8 -25.0,-20.0 31.2,7.1 -31.2,7.1 25.0,-20.0 -13.9,28.8"/><circle r="9"/></svg><b>Ledger</b></span>'
};

// ==================================================================== LIGHT ACADEMIA
// A torn edge, as two outlines: where the painted layer ends (inner) and where the paper fibres end (outer).
// The white rim between them changes width as it goes, wide where the paper split thick and thin where it
// broke clean, the way real torn paper looks; each outline wanders at a slow and a fast scale.
function tearEdges(seed, W, H, x0, x1) {
  const r = rng(seed);
  const side = (x, dir) => {
    const inner = [], outer = [];
    let y = 0, slow = 0, w = 4, bite = 0, fast = 0;
    while (y <= H) {
      slow = slow * .93 + (r() - .5) * 2.6;                     // long, lazy drift of the tear
      fast = fast * .55 + (r() - .5) * 1.1;                          // fine wobble, smoothed so it never saws
      w = Math.max(.6, Math.min(10, w * .88 + r() * 1.3 + (r() < .05 ? r() * 6 : 0)));  // rim thickness
      bite = bite * .82 + (r() < .025 ? (r() - .3) * 5 : 0);     // the odd chunk where more paper came away
      const xi = x + (slow * 2.2 + fast + bite) * dir * -1;
      inner.push([xi, y]); outer.push([xi + dir * w * (1 + r() * .35), y]);
      y += 2 + r() * 3.2;
    }
    return { inner, outer };
  };
  const L = side(x0, -1), R = side(x1, 1);
  const path = (l, rr) => 'M' + l.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + ' L' + rr.slice().reverse().map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + ' Z';
  return { inner: path(L.inner, R.inner), outer: path(L.outer, R.outer) };
}
// small birds far off: filled shapes, heavy at the body and tapering to fine wing tips
function bird(x, y, s, rot, flap) {
  const up = -4.2 * flap;
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0.6 C-2.2 ${up * .55 - .2} -5.6 ${up - .4} -10.5 ${up * .55 + .3} C-5.8 ${up * .9 + .9} -2.4 ${up * .45 + 1.4} 0 1.6 C2.4 ${up * .45 + 1.4} 5.8 ${up * .9 + .9} 10.5 ${up * .55 + .3} C5.6 ${up - .4} 2.2 ${up * .55 - .2} 0 0.6Z"/>`;
}
function fresco(id, seed, warm) {
  const W = 540, H = 828, edges = tearEdges(seed, W, H, 30, 510), tear = edges.inner;
  const sky = warm ? ['#8b97b4', '#c5b3b0', '#eac69a', '#d99a62'] : ['#7f9fc0', '#a9bccb', '#e6cfa8', '#d9a873'];
  return `<svg class="fresco-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".35" stop-color="${sky[1]}"/><stop offset=".62" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/></linearGradient>
    <radialGradient id="${id}sun" cx=".58" cy="${warm ? .62 : .42}" r=".5"><stop offset="0" stop-color="#fff4d6" stop-opacity=".95"/><stop offset=".35" stop-color="#ffdca0" stop-opacity=".5"/><stop offset="1" stop-color="#ffdca0" stop-opacity="0"/></radialGradient>
    <filter id="${id}cl" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".006 .011" numOctaves="6" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .88  2.3 0 0 0 -1.05"/><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="${id}cs" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".006 .011" numOctaves="6" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 .62  0 0 0 0 .52  0 0 0 0 .5  2.3 0 0 0 -1.05"/><feGaussianBlur stdDeviation="3"/><feOffset dy="9"/></filter>
    <filter id="${id}paint"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 .4  0 0 0 0 .3  0 0 0 0 .2  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="${id}haze"><feGaussianBlur stdDeviation="2.5"/></filter>
    <linearGradient id="${id}hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d98a6" stop-opacity=".55"/><stop offset="1" stop-color="#b9a07c" stop-opacity=".7"/></linearGradient>
    <linearGradient id="${id}hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f7568" stop-opacity=".55"/><stop offset="1" stop-color="#8e7350" stop-opacity=".85"/></linearGradient>
    <radialGradient id="${id}vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#3a2410" stop-opacity="0"/><stop offset="1" stop-color="#3a2410" stop-opacity=".45"/></radialGradient>
    <filter id="${id}fiber" x="-5%" y="-2%" width="110%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".55 .9" numOctaves="3" seed="${seed + 2}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${seed}" result="g"/><feColorMatrix in="g" values="0 0 0 0 1  0 0 0 0 .985  0 0 0 0 .95  0 0 0 -.45 1.15" result="grain"/><feComposite in="grain" in2="d" operator="in"/></filter><filter id="${id}soft"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="${id}lift" x="-5%" y="-2%" width="110%" height="104%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-color="#5a3f1e" flood-opacity=".28"/></filter>
    <clipPath id="${id}tear"><path d="${tear}"/></clipPath></defs>
    <g filter="url(#${id}lift)"><path d="${edges.outer}" fill="#fffdf7" filter="url(#${id}fiber)"/></g>
    <g clip-path="url(#${id}tear)">
      <rect width="${W}" height="${H}" fill="url(#${id}sky)"/><rect width="${W}" height="${H}" fill="url(#${id}sun)"/>
      <rect width="${W}" height="${H}" filter="url(#${id}cs)" opacity=".55"/><rect width="${W}" height="${H}" filter="url(#${id}cl)"/>
      <path d="M0 700 C 70 676 120 690 180 668 S 300 640 360 664 S 470 690 540 660 V${H} H0Z" fill="url(#${id}hill)" filter="url(#${id}haze)"/>
      <path d="M0 748 C 90 724 170 742 250 722 S 400 700 460 728 S 520 744 540 736 V${H} H0Z" fill="url(#${id}hill2)" filter="url(#${id}haze)"/>
      <g class="birds" fill="#4e4032" opacity=".6">${bird(386, 236, 1.05, -4, 1)}${bird(418, 251, .75, 6, .55)}${bird(366, 262, .55, -10, .85)}</g>
      <rect width="${W}" height="${H}" fill="url(#${id}sun)" opacity=".5"/><rect width="${W}" height="${H}" fill="url(#${id}vig)"/>
      <rect width="${W}" height="${H}" fill="#000" filter="url(#${id}paint)"/></g>
    <path d="${tear}" fill="none" stroke="#6b4e2c" stroke-width="2.5" opacity=".22" filter="url(#${id}soft)" clip-path="url(#${id}tear)"/></svg>`;
}
const LEDE = '<div class="lede"><p>Each morning the page is clean. Set down what the day asks of you, plainly and in order, and leave nothing to memory.</p><p>As the hours pass, mark each task as it is done. What remains at nightfall is simply let go, and tomorrow begins anew.</p></div>';
const light = {
  name: 'Light Academia', color: '#ede4d3', check: 'tick',
  tabNames: ['Tasks', 'Workout', 'Records', 'Settings'],
  placeholder: 'Add a task…', addLabel: 'Add', empty: 'A clean page. Begin whenever you are ready.',
  num: i => roman(i),
  count: c => c.total ? `${word(c.done)} <small>of ${word(c.total)}</small>` : '<small>a clean page</small>',
  head: c => `<header class="ph"><div class="top"><span>FOLIO ${roman(c.now.getMonth() + 1)} · ${roman(c.year)}</span><span>${c.month.toUpperCase()}</span></div>
      <div class="headrow">${STAR}<h2>${tabTitle(c, `${c.dow}<i>the ${c.ord}</i>`, `${c.dow}<i>exercises</i>`, 'Settings<i>& preferences</i>', 'Records<i>of days past</i>')}</h2></div>
      ${c.tab === 'tasks' ? LEDE : ''}<div class="rule" aria-hidden="true">${STAR}</div></header>`,
  brand: c => `<figure class="fresco">${fresco('lf', 5, false)}<div class="ftitle"><div class="sc">the</div><div class="word">LEDGER</div></div>
      <span class="flank" aria-hidden="true">${STAR}</span><figcaption>Pl. ${roman(c.now.getMonth() + 1)} — <i>Morning, from the eastern window</i></figcaption></figure>`,
  side: c => `<figure class="fresco small">${fresco('lg', 9, true)}<div class="ftitle"><div class="sc">festina lente</div></div><figcaption><i>make haste slowly</i></figcaption></figure>`,
  swatch: '<span class="sw sw-light"><i></i><b>LEDGER</b></span>'
};

export const THEMES = { aero, cyber, dark, light };
export const ART = { aero: aeroArt, cyber: cyberArt, dark: darkArt, light: () => '<div class="li-paper"></div><div class="li-tex"></div>' };
