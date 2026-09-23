/* ===========================================================
   sound.js · 纯 Web Audio 合成音效（无音频文件，可离线）
   音效默认关闭，由用户点击「音效」按钮开启
   =========================================================== */

let ctx = null;
let master = null;
let enabled = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  return ctx;
}

export function isEnabled() { return enabled; }

export async function setEnabled(on) {
  enabled = !!on;
  if (enabled) {
    ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.35);
  } else if (master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
  }
  return enabled;
}

function tone({ freq = 440, dur = 0.22, type = 'sine', gain = 0.22, delay = 0, slide = 0, pan = 0 } = {}) {
  if (!enabled || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g).connect(p);
    node = p;
    p.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    return;
  }
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.16, delay = 0, hp = 400, lp = 4200, q = 1 } = {}) {
  if (!enabled || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = (hp + lp) / 2;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
}

/* ─── 对外音效 ─── */

export const sfx = {
  click() {
    tone({ freq: 620, dur: 0.09, type: 'triangle', gain: 0.14 });
  },
  hover() {
    tone({ freq: 1180, dur: 0.05, type: 'sine', gain: 0.05 });
  },
  shuffle(dur = 1.6) {
    for (let i = 0; i < 26; i++) {
      noise({ dur: 0.13, gain: 0.1, delay: (i / 26) * dur + Math.random() * 0.03, q: 0.7 });
    }
  },
  draw() {
    noise({ dur: 0.24, gain: 0.14, q: 0.6 });
    tone({ freq: 520, dur: 0.16, type: 'sine', gain: 0.1, slide: 220 });
  },
  flip() {
    noise({ dur: 0.18, gain: 0.1, q: 0.9 });
    tone({ freq: 340, dur: 0.12, type: 'triangle', gain: 0.08, slide: 180 });
  },
  reveal(index = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5];
    const f = scale[index % scale.length];
    tone({ freq: f, dur: 1.1, type: 'sine', gain: 0.13 });
    tone({ freq: f * 2, dur: 0.7, type: 'sine', gain: 0.05, delay: 0.02 });
    tone({ freq: f * 1.5, dur: 1.3, type: 'sine', gain: 0.045, delay: 0.06 });
  },
  complete() {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => tone({ freq: f, dur: 1.4, type: 'sine', gain: 0.11, delay: i * 0.13 }));
  },
  error() {
    tone({ freq: 220, dur: 0.2, type: 'square', gain: 0.08, slide: -60 });
  },
};
