/* ===========================================================
   fx.js · 粒子 / 提示 / 涟漪 等视觉特效
   =========================================================== */

const layer = () => document.getElementById('fx');

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 金色星屑爆发 */
export function sparkBurst(x, y, count = 22, opts = {}) {
  if (reduce()) return;
  const host = layer();
  if (!host) return;
  const { spread = 160, color = '#e8c98a', size = 3, dur = 900 } = opts;
  const frag = document.createDocumentFragment();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    const ang = Math.random() * Math.PI * 2;
    const dist = spread * (0.35 + Math.random() * 0.65);
    const s = size * (0.5 + Math.random());
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:50%;
      background:${i % 4 === 0 ? '#8ff0e6' : color};box-shadow:0 0 8px ${color};
      pointer-events:none;will-change:transform,opacity;`;
    frag.appendChild(el);
    parts.push({ el, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist - 20, delay: Math.random() * 90 });
  }
  host.appendChild(frag);
  for (const p of parts) {
    const anim = p.el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: dur, delay: p.delay, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' },
    );
    anim.onfinish = () => p.el.remove();
  }
}

/** 环形涟漪 */
export function ripple(x, y, size = 60, color = 'rgba(232,201,138,0.55)') {
  if (reduce()) return;
  const host = layer();
  if (!host) return;
  const el = document.createElement('i');
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;
    border:2px solid ${color};transform:translate(-50%,-50%) scale(0.2);pointer-events:none;`;
  host.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 },
    ],
    { duration: 760, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' },
  );
  anim.onfinish = () => el.remove();
}

/** 金色光柱（翻牌用） */
export function glowFlash(el, ms = 900) {
  if (!el) return;
  el.animate(
    [
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.9) saturate(1.15)' },
      { filter: 'brightness(1)' },
    ],
    { duration: ms, easing: 'ease-out' },
  );
}

let toastTimer = 0;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, ms);
}

/** 屏幕轻微震动（关键动作反馈） */
export function shake(target, amount = 6) {
  if (reduce() || !target) return;
  target.animate(
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(${-amount}px)` },
      { transform: `translateX(${amount}px)` },
      { transform: 'translateX(0)' },
    ],
    { duration: 260, easing: 'ease-in-out' },
  );
}

/** 全屏一次性金色星雨（解读完成） */
export function starRain(count = 46, ms = 2200) {
  if (reduce()) return;
  const host = layer();
  if (!host) return;
  const frag = document.createDocumentFragment();
  const items = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    const x = Math.random() * window.innerWidth;
    const s = 2 + Math.random() * 3;
    el.style.cssText = `position:fixed;left:${x}px;top:-20px;width:${s}px;height:${s * 3}px;
      background:linear-gradient(180deg, rgba(246,230,187,0), #e8c98a);border-radius:2px;pointer-events:none;opacity:0.85;`;
    frag.appendChild(el);
    items.push({ el, dur: ms * (0.6 + Math.random() * 0.7), delay: Math.random() * 900, drift: (Math.random() - 0.5) * 90 });
  }
  host.appendChild(frag);
  for (const it of items) {
    const anim = it.el.animate(
      [
        { transform: 'translate(0,0) rotate(8deg)', opacity: 0 },
        { transform: `translate(${it.drift * 0.4}px, ${window.innerHeight * 0.45}px) rotate(12deg)`, opacity: 0.9, offset: 0.5 },
        { transform: `translate(${it.drift}px, ${window.innerHeight + 40}px) rotate(18deg)`, opacity: 0 },
      ],
      { duration: it.dur, delay: it.delay, easing: 'cubic-bezier(0.3,0.6,0.4,1)', fill: 'forwards' },
    );
    anim.onfinish = () => it.el.remove();
  }
}
