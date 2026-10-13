// Sound, haptics, particles, full-screen scenes, and per-theme font loading.

const FONTS = {
  base: 'family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600',
  demon: 'family=Cinzel:wght@600;700',
  guild: 'family=Cinzel:wght@600;700&family=EB+Garamond:wght@500;600;700',
  blessing: 'family=Cinzel:wght@600;700',
  sakura: 'family=Shippori+Mincho:wght@600;700&family=Zen+Kaku+Gothic+New:wght@500;700',
  frost: 'family=Josefin+Sans:wght@500;600;700',
  celestial: 'family=Marcellus',
  dragon: 'family=Cinzel:wght@600;700',
  abyss: 'family=Exo+2:wght@500;600;700',
  ronin: 'family=Cormorant+Garamond:wght@600;700',
  vrmmo: 'family=Orbitron:wght@500;600;700'
};
const loaded = new Set();
export function loadFonts(theme) {
  for (const k of ['base', theme]) {
    if (!FONTS[k] || loaded.has(k)) continue;
    loaded.add(k);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${FONTS[k]}&display=swap`;
    document.head.appendChild(l);
  }
}

let settings = () => ({});
export function bindSettings(fn) { settings = fn; }

// ---------- sound (synthesized, no files) ----------
let ctx = null;
function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, start, dur, { type = 'sine', vol = 0.08, glide = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
const SOUNDS = {
  check: () => { tone(880, 0, 0.12, { type: 'triangle', vol: 0.06 }); tone(1320, 0.05, 0.16, { vol: 0.045 }); },
  uncheck: () => tone(520, 0, 0.1, { type: 'triangle', vol: 0.04, glide: 0.8 }),
  clear: () => [659, 880, 1175].forEach((f, i) => tone(f, i * 0.09, 0.32, { type: 'triangle', vol: 0.06 })),
  levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.5, { type: 'triangle', vol: 0.07 })); tone(2093, 0.45, 0.9, { vol: 0.03 }); },
  skill: () => [988, 1319, 1760].forEach((f, i) => tone(f, i * 0.06, 0.45, { vol: 0.05 })),
  timer: () => tone(660, 0, 0.08, { type: 'square', vol: 0.025 }),
  goal: () => [784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.4, { type: 'triangle', vol: 0.06 })),
  error: () => tone(220, 0, 0.18, { type: 'sawtooth', vol: 0.03 })
};
export function sfx(name) {
  if (!settings().sound) return;
  try { SOUNDS[name] && SOUNDS[name](); } catch (e) { /* audio is optional */ }
}
export function buzz(ms = 12) {
  if (settings().haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* optional */ }
}

// ---------- particles ----------
const calm = () => !settings().fx || matchMedia('(prefers-reduced-motion: reduce)').matches;
export function burst(el, theme) {
  if (calm() || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const kind = theme === 'abyss' ? 'bubble' : theme === 'dragon' ? 'coin' : 'pfx';
  const n = kind === 'pfx' ? 8 : 7;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = kind;
    p.style.left = cx - 3 + 'px'; p.style.top = cy - 3 + 'px';
    document.body.appendChild(p);
    let anim;
    if (kind === 'bubble') {
      const dx = (Math.random() - 0.5) * 40, dy = -60 - Math.random() * 80;
      anim = [{ transform: 'translate(0,0) scale(.6)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 0 }];
    } else if (kind === 'coin') {
      const dx = (Math.random() - 0.5) * 120, up = -40 - Math.random() * 50;
      anim = [{ transform: 'translate(0,0) rotateY(0)', opacity: 1 }, { transform: `translate(${dx * 0.6}px,${up}px) rotateY(360deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,${30}px) rotateY(720deg)`, opacity: 0 }];
    } else {
      const a = (i / n) * Math.PI * 2, d = 26 + Math.random() * 18;
      anim = [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }];
    }
    p.animate(anim, { duration: kind === 'pfx' ? 520 : 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)', delay: kind === 'pfx' ? 0 : i * 40, fill: 'both' })
      .onfinish = () => p.remove();
  }
}

// ---------- full-screen scenes ----------
// Queued so a level-up and a skill unlock in the same tap show one after the other.
const queue = [];
let showing = false;
export function scene(label, huge, sub, small = '', sound = 'levelup') {
  queue.push({ label, huge, sub, small, sound });
  if (!showing) next();
}
function next() {
  const s = queue.shift();
  if (!s) { showing = false; return; }
  showing = true;
  sfx(s.sound); buzz(30);
  const el = document.createElement('div');
  el.className = 'scene';
  el.innerHTML = `${calm() ? '' : '<div class="rays"></div><div class="rings"><i></i><i></i><i></i></div>'}
    <div class="core"><div class="lbl">[ ${s.label} ]</div><div class="huge">${s.huge}</div>
    <div class="subl">${s.sub}${s.small ? `<small>${s.small}</small>` : ''}</div><div class="tap">TAP TO CONTINUE</div></div>`;
  const close = () => { el.remove(); next(); };
  el.onclick = close;
  document.body.appendChild(el);
}
