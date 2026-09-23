/* ===========================================================
   sky.js · 背景星空 canvas
   星点闪烁 + 偶发流星，尊重「减少动态效果」偏好
   =========================================================== */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSky(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d', { alpha: true });
  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars = [];
  let meteors = [];
  let raf = 0;
  let last = performance.now();
  let running = true;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    const count = Math.min(260, Math.round((w * h) / 9000));
    stars = Array.from({ length: count }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + depth * 1.7,
        a: 0.18 + Math.random() * 0.6,
        tw: 0.4 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
        drift: 0.02 + depth * 0.12,
        hue: Math.random() < 0.16 ? 'gold' : (Math.random() < 0.5 ? 'blue' : 'white'),
      };
    });
  }

  function spawnMeteor() {
    const fromLeft = Math.random() < 0.5;
    meteors.push({
      x: fromLeft ? -60 : w + 60,
      y: Math.random() * h * 0.5,
      vx: (fromLeft ? 1 : -1) * (2.6 + Math.random() * 2.2),
      vy: 1.4 + Math.random() * 1.2,
      life: 1,
      len: 90 + Math.random() * 120,
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(2.6, (now - last) / 16.6);
    last = now;
    if (!running) return;

    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      s.ph += 0.012 * s.tw * dt;
      const tw = 0.55 + 0.45 * Math.sin(s.ph);
      const alpha = Math.min(1, s.a * tw);
      const col = s.hue === 'gold'
        ? `rgba(232, 201, 138, ${alpha})`
        : s.hue === 'blue'
          ? `rgba(150, 180, 255, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.5) {
        ctx.globalAlpha = 0.22 * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!reduce) {
        s.y += s.drift * dt * 0.25;
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
      }
    }

    if (!reduce) {
      if (Math.random() < 0.0038 && meteors.length < 3) spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= 0.012 * dt;
        if (m.life <= 0 || m.x < -200 || m.x > w + 200 || m.y > h + 200) {
          meteors.splice(i, 1);
          continue;
        }
        const nx = m.vx / Math.hypot(m.vx, m.vy);
        const ny = m.vy / Math.hypot(m.vx, m.vy);
        const g = ctx.createLinearGradient(m.x, m.y, m.x - nx * m.len, m.y - ny * m.len);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * m.life})`);
        g.addColorStop(0.4, `rgba(180, 205, 255, ${0.35 * m.life})`);
        g.addColorStop(1, 'rgba(180, 205, 255, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - nx * m.len, m.y - ny * m.len);
        ctx.stroke();
      }
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    last = performance.now();
  });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
