/* ===========================================================
   card-art.js · 卡面 SVG 绘制工具库
   所有牌面（大阿卡纳 22 张 / 小阿卡纳 56 张）都由这里的
   基础图形函数组合而成，保证整副牌的装饰语言统一。
   画布坐标固定为 300 × 520。
   =========================================================== */

export const CARD_W = 300;
export const CARD_H = 520;

/* ───────── 基础图形 ───────── */

export const poly = (pts) => pts.map((p) => p.join(',')).join(' ');

/** 正多边形顶点（cx,cy 中心，r 半径，rot 起始角，单位度，从 12 点方向开始） */
export function ngon(cx, cy, r, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((i * 360) / n + rot - 90) * (Math.PI / 180);
    out.push([+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]);
  }
  return out;
}

/** 星形（n 角芒星）路径 */
export function starPath(cx, cy, rOut, rIn, n = 5, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = ((i * 180) / n + rot - 90) * (Math.PI / 180);
    pts.push([+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]);
  }
  return `M${pts.map((p) => p.join(' ')).join(' L')} Z`;
}

/** 四角星（塔罗里最常见的星） */
export const sparkle = (cx, cy, r) =>
  starPath(cx, cy, r, r * 0.26, 4, 0);

/** 六角星 / 七角星等 */
export const starN = (cx, cy, r, n = 6) => starPath(cx, cy, r, r * 0.45, n, 0);

export const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
export const dot = (cx, cy, r, fill = 'var-gold') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/** 圆环（描边圆） */
export const ring = (cx, cy, r, sw = 2) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${sw}"/>`;

/** 弯月 */
export function crescent(cx, cy, r, rot = 0) {
  const x = +(r * 0.44).toFixed(2);
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="M ${-x} ${-r} A ${r} ${r} 0 1 0 ${-x} ${r} A ${r * 0.86} ${r * 0.86} 0 1 1 ${-x} ${-r} Z"/></g>`;
}

/** 云 / 雾气 */
export function cloud(cx, cy, w = 70, h = 20) {
  const r = h / 2;
  return `<g transform="translate(${cx} ${cy})">
    <path d="M ${-w / 2} ${r * 0.6} q ${w / 8} ${-h} ${w / 3.1} ${-r * 0.5} q ${w / 7} ${-h} ${w / 3.2} ${r * 0.2} q ${w / 6} ${-h} ${w / 3.1} ${r * 0.9} Z" opacity="0.9"/>
  </g>`;
}

/** 山峦 */
export function mount(cx, baseY, w, h) {
  return `M ${cx - w / 2} ${baseY} L ${cx - w * 0.16} ${baseY - h} L ${cx + w * 0.06} ${baseY - h * 0.58} L ${cx + w * 0.28} ${baseY - h * 0.86} L ${cx + w / 2} ${baseY} Z`;
}

/** 水波（一条波浪线） */
export function wave(x1, x2, y, amp = 5, steps = 6) {
  const seg = (x2 - x1) / steps;
  let d = `M ${x1} ${y}`;
  for (let i = 0; i < steps; i++) {
    const dir = i % 2 ? -1 : 1;
    d += ` q ${seg / 2} ${dir * amp} ${seg} 0`;
  }
  return d;
}

/** 叶枝（权杖类用） */
export function branch(x1, y1, x2, y2, leaves = 3) {
  const out = [`<path d="M ${x1} ${y1} L ${x2} ${y2}"/>`];
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1);
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const side = i % 2 ? 1 : -1;
    const lx = px + side * 17;
    const ly = py - 13;
    out.push(`<path d="M ${px.toFixed(1)} ${py.toFixed(1)} q ${(side * 12).toFixed(1)} -6 ${(side * 17).toFixed(1)} -13 q ${(-side * 9).toFixed(1)} 3 ${(-side * 17).toFixed(1)} 13 Z" data-fill="leaf"/>`);
  }
  return out.join('');
}

/** 权杖 */
export const wand = (cx, cy, h = 120, rot = 0) => `
  <g transform="translate(${cx} ${cy}) rotate(${rot})">
    <path d="M 0 ${-h / 2} L 0 ${h / 2}"/>
    ${branch(0, h * 0.3, 0, -h * 0.3, 3)}
    ${dot(0, -h / 2 - 4, 5, 'var-gold')}
  </g>`;

/** 圣杯 */
export const cup = (cx, cy, s = 1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M -22 -20 L 22 -20 q -3 26 -22 30 q -19 -4 -22 -30 Z"/>
    <path d="M 0 10 L 0 26"/>
    <path d="M -15 34 q 15 -9 30 0"/>
    <path d="M -22 -20 q 22 10 44 0" data-detail="1"/>
    <path d="M 0 -34 q 10 8 0 14 q -10 -6 0 -14 Z" data-fill="accent"/>
  </g>`;

/** 宝剑 */
export const sword = (cx, cy, h = 96, rot = 0) => `
  <g transform="translate(${cx} ${cy}) rotate(${rot})">
    <path d="M 0 ${-h / 2} L 6 ${-h / 2 + 14} L 6 ${h * 0.16} L -6 ${h * 0.16} L -6 ${-h / 2 + 14} Z" data-fill="blade"/>
    <path d="M -20 ${h * 0.16} L 20 ${h * 0.16}"/>
    <path d="M 0 ${h * 0.16} L 0 ${h * 0.16 + 26}"/>
    ${dot(0, h * 0.16 + 30, 5, 'var-gold')}
  </g>`;

/** 星币 */
export const pentacle = (cx, cy, r = 26) => `
  <g transform="translate(${cx} ${cy})">
    ${circle(0, 0, r)}
    ${circle(0, 0, r - 5)}
    <path d="${starPath(0, 0, r - 8, (r - 8) * 0.42, 5, 0)}"/>
  </g>`;

/** 塔罗式人物（长袍剪影，简洁符号化） */
export function figure(cx, baseY, h = 96, opts = {}) {
  const { crown = false, arms = 'open', robe = true, flip = false } = opts;
  const w = h * 0.34;
  const headR = h * 0.1;
  const headY = baseY - h + headR;
  const bodyTop = headY + headR * 1.05;
  const armD = {
    open: `M ${-w * 0.4} ${bodyTop + h * 0.2} L ${-w * 1.5} ${bodyTop + h * 0.03} M ${w * 0.4} ${bodyTop + h * 0.2} L ${w * 1.5} ${bodyTop + h * 0.03}`,
    up: `M ${-w * 0.4} ${bodyTop + h * 0.2} L ${-w * 1.35} ${bodyTop - h * 0.12} M ${w * 0.4} ${bodyTop + h * 0.2} L ${w * 1.35} ${bodyTop - h * 0.14}`,
    down: `M ${-w * 0.4} ${bodyTop + h * 0.2} L ${-w * 1.1} ${bodyTop + h * 0.44} M ${w * 0.4} ${bodyTop + h * 0.2} L ${w * 1.1} ${bodyTop + h * 0.44}`,
    one: `M ${-w * 0.4} ${bodyTop + h * 0.2} L ${-w * 1.35} ${bodyTop - h * 0.1} M ${w * 0.4} ${bodyTop + h * 0.2} L ${w * 1.1} ${bodyTop + h * 0.46}`,
    pray: `M ${-w * 0.4} ${bodyTop + h * 0.22} L ${-w * 0.16} ${bodyTop + h * 0.46} M ${w * 0.4} ${bodyTop + h * 0.22} L ${w * 0.16} ${bodyTop + h * 0.46}`,
  }[arms] || '';
  const robePath = robe
    ? `M ${-w * 0.5} ${bodyTop} L ${w * 0.5} ${bodyTop} L ${w * 1.28} ${baseY} L ${-w * 1.28} ${baseY} Z`
    : `M ${-w * 0.42} ${bodyTop} L ${w * 0.42} ${bodyTop} L ${w * 0.5} ${baseY} L ${-w * 0.5} ${baseY} Z`;
  return `
  <g transform="translate(${cx} ${baseY}) scale(${flip ? -1 : 1} 1) translate(${-cx} ${-baseY})">
    ${circle(cx, headY, headR)}
    ${crown ? `<path d="M ${cx - headR * 1.5} ${headY - headR * 1.1} L ${cx - headR * 0.75} ${headY - headR * 2.05} L ${cx} ${headY - headR * 1.25} L ${cx + headR * 0.75} ${headY - headR * 2.05} L ${cx + headR * 1.5} ${headY - headR * 1.1} Z" data-fill="accent"/>` : ''}
    <path d="${robePath}" data-fill="robe"/>
    <path d="${armD}" fill="none"/>
  </g>`;
}

/** 眼（鲸娘与神秘学共用的符号） */
export const eye = (cx, cy, w = 34, h = 15) =>
  `<g transform="translate(${cx} ${cy})">
    <path d="M ${-w / 2} 0 q ${w / 2} ${-h} ${w} 0 q ${-w / 2} ${h} ${-w} 0 Z"/>
    ${circle(0, 0, h * 0.5)}
    ${dot(0, 0, h * 0.22, 'var-ink')}
  </g>`;

/** 天平 */
export const scales = (cx, cy, w = 80) => `
  <g transform="translate(${cx} ${cy})">
    <path d="M 0 -26 L 0 22"/>
    <path d="M ${-w / 2} -14 L ${w / 2} -14"/>
    <path d="M ${-w / 2} -14 q 0 22 ${w / 4} 22 q ${w / 4} 0 ${w / 4} -22" fill="none"/>
    <path d="M ${w / 2} -14 q 0 22 ${-w / 4} 22 q ${-w / 4} 0 ${-w / 4} -22" fill="none"/>
    <path d="M -16 22 L 16 22"/>
  </g>`;

/** 无限符号 */
export const infinity = (cx, cy, s = 1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <path d="M 0 0 c -6 -13 -26 -13 -26 0 c 0 13 20 13 26 0 c 6 -13 26 -13 26 0 c 0 13 -20 13 -26 0 Z" fill="none"/>
  </g>`;

/** 罗马数字（大阿卡纳序号） */
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI',
  'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
export const roman = (n) => ROMAN[n] ?? String(n);

/* ───────── 牌框与装饰 ───────── */

export const CORNERS = [
  [18, 18, 0],
  [CARD_W - 18, 18, 90],
  [CARD_W - 18, CARD_H - 18, 180],
  [18, CARD_H - 18, 270],
];

/** 四角花饰 */
export function cornerFlourish() {
  return CORNERS.map(([x, y, rot]) => `
    <g transform="translate(${x} ${y}) rotate(${rot})" data-ink="gold" fill="none">
      <path d="M 0 30 L 0 12 Q 0 0 12 0 L 30 0"/>
      <path d="M 0 40 L 0 46 M 40 0 L 46 0" stroke-width="2.4"/>
      <path d="M 16 16 L 24 8 L 32 16 L 24 24 Z" data-fill="gold" stroke="none" opacity="0.85"/>
      <path d="M 5 5 L 11 5 L 5 11 Z" data-fill="gold" stroke="none" opacity="0.6"/>
    </g>`).join('');
}

/** 一整圈小星点装饰带 */
export function starDustBand() {
  const out = [];
  const inset = 27;
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    out.push(`<g data-fill="gold" opacity="0.5">${sparkle(inset + 2, 60 + t * (CARD_H - 120), 3.1)}</g>`);
    out.push(`<g data-fill="gold" opacity="0.5">${sparkle(CARD_W - inset - 2, 60 + t * (CARD_H - 120), 3.1)}</g>`);
  }
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    out.push(`<g data-fill="gold" opacity="0.42">${sparkle(52 + t * (CARD_W - 104), inset + 2, 3)}</g>`);
    out.push(`<g data-fill="gold" opacity="0.42">${sparkle(52 + t * (CARD_W - 104), CARD_H - inset - 2, 3)}</g>`);
  }
  return out.join('');
}

/** 背景星空氛围（牌面内的小星） */
export function backgroundStars(seedPoints) {
  return seedPoints
    .map(([x, y, r, o]) => `<g data-fill="gold" opacity="${o}">${sparkle(x, y, r)}</g>`)
    .join('');
}

/** 中心光芒（大阿卡纳用） */
export function rays(cx, cy, r1, r2, n = 16, width = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((i * 360) / n - 90) * (Math.PI / 180);
    const inner = i % 2 ? r1 * 0.86 : r1;
    out.push(`<path d="M ${(cx + inner * Math.cos(a)).toFixed(1)} ${(cy + inner * Math.sin(a)).toFixed(1)} L ${(cx + r2 * Math.cos(a - width / 200)).toFixed(1)} ${(cy + r2 * Math.sin(a - width / 200)).toFixed(1)} L ${(cx + r2 * Math.cos(a + width / 200)).toFixed(1)} ${(cy + r2 * Math.sin(a + width / 200)).toFixed(1)} Z" data-fill="gold" opacity="${i % 2 ? 0.32 : 0.6}" stroke="none"/>`);
  }
  return out.join('');
}

/* ───────── 花色牌点数布局（扑克式排列） ───────── */
export const PIPS = {
  1: [[0, 0]],
  2: [[0, -0.30], [0, 0.30]],
  3: [[0, -0.34], [0, 0], [0, 0.34]],
  4: [[-0.34, -0.33], [0.34, -0.33], [-0.34, 0.33], [0.34, 0.33]],
  5: [[-0.34, -0.34], [0.34, -0.34], [0, 0], [-0.34, 0.34], [0.34, 0.34]],
  6: [[-0.34, -0.36], [0.34, -0.36], [-0.34, 0], [0.34, 0], [-0.34, 0.36], [0.34, 0.36]],
  7: [[-0.34, -0.38], [0.34, -0.38], [0, -0.19], [-0.34, 0], [0.34, 0], [-0.34, 0.38], [0.34, 0.38]],
  8: [[-0.34, -0.38], [0.34, -0.38], [0, -0.19], [-0.34, 0], [0.34, 0], [0, 0.19], [-0.34, 0.38], [0.34, 0.38]],
  9: [[-0.34, -0.4], [0.34, -0.4], [-0.34, -0.2], [0.34, -0.2], [0, 0], [-0.34, 0.2], [0.34, 0.2], [-0.34, 0.4], [0.34, 0.4]],
  10: [[-0.34, -0.42], [0.34, -0.42], [0, -0.26], [-0.34, -0.12], [0.34, -0.12], [-0.34, 0.12], [0.34, 0.12], [0, 0.26], [-0.34, 0.42], [0.34, 0.42]],
};
