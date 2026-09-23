/* ===========================================================
   whale-back.js · 牌背 / 徽记 / 品牌标记
   牌背主体 = 破水的鲸鱼尾鳍 + 塔罗对称纹样 + 星月金线
   性能要点：牌背以 <symbol> 定义一次，所有卡牌用 <use> 复用，
   避免每张牌重复解析一整份含滤镜 / 图案 / 样式的 SVG。
   =========================================================== */

import { CARD_W, CARD_H, sparkle, starN, crescent, wave } from './svgkit.js';

const CX = CARD_W / 2;

/* 中央纹章：一张 Seedream 生成的「黑底金线曼陀罗」（中心是鲸尾）。
   生成图负责它擅长的细密金色卷草，边框 / 角饰 / 收口金环仍由矢量 SVG 绘制，
   这样外围保持锐利、可无限缩放，只有纹章本身是位图。

   地址从模块位置算，不写死 '/assets/…'：写死的话站点一放到子目录
   （GitHub Pages 项目页 用户名.github.io/仓库名/）就会去请求域名根而 404，
   而牌背是每张牌都要用的，坏了满屏都是空白牌。 */
export const BACK_MEDALLION = new URL('../../assets/back/medallion.jpg', import.meta.url).href;
const MED_Y = 272;    // 纹章圆心 Y
const MED_R = 112;    // 纹章半径（占卡宽 75%）

export const DEFS_ID = 'dsh-card-defs';
export const BACK_SYMBOL_ID = 'dsh-card-back';
export const SIGIL_SYMBOL_ID = 'dsh-whale-sigil';
export const BRAND_SYMBOL_ID = 'dsh-brand-mark';

/* ───────── 共享渐变 / 图案 ───────── */
function sharedDefs() {
  return `
    <linearGradient id="dsh-back-sky" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#0e0e11"/>
      <stop offset="52%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <!-- 原来这里有一层蓝色径向光（dsh-back-nova）。已移除：
         它把底色染成深蓝，与「黑金」的方向相冲。现在的底色是中性近黑。 -->
    <linearGradient id="dsh-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6e6bb"/>
      <stop offset="30%" stop-color="#cfa859"/>
      <stop offset="58%" stop-color="#8a6a2c"/>
      <stop offset="100%" stop-color="#e8c98a"/>
    </linearGradient>
    <!-- 关键：用 userSpaceOnUse，否则左右两片尾叶各自铺一遍渐变，会看成两只"耳朵" -->
    <linearGradient id="dsh-tail-fill" gradientUnits="userSpaceOnUse" x1="10" y1="230" x2="290" y2="372">
      <stop offset="0%" stop-color="#16266a"/>
      <stop offset="26%" stop-color="#2b47bd"/>
      <stop offset="58%" stop-color="#4d6bfe"/>
      <stop offset="100%" stop-color="#9fbaff"/>
    </linearGradient>
    <linearGradient id="dsh-body-fill" x1="0.08" y1="0" x2="0.86" y2="1">
      <stop offset="0%" stop-color="#22305f"/>
      <stop offset="46%" stop-color="#3a56c4"/>
      <stop offset="100%" stop-color="#7e97ff"/>
    </linearGradient>
    <linearGradient id="dsh-fin-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4055c8"/>
      <stop offset="100%" stop-color="#a8c2ff"/>
    </linearGradient>
    <radialGradient id="dsh-sigil-halo" cx="50%" cy="46%" r="58%">
      <stop offset="0%" stop-color="#8ff0e6" stop-opacity="0.42"/>
      <stop offset="62%" stop-color="#4d6bfe" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#4d6bfe" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="dsh-tail-band" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8fa8ff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#22307f" stop-opacity="0.75"/>
    </linearGradient>
    <pattern id="dsh-lattice" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M 0 12 L 12 0 L 24 12 L 12 24 Z" fill="none" stroke="#cfa859" stroke-width="0.55" opacity="0.28"/>
      <circle cx="12" cy="12" r="1.5" fill="#e8c98a" opacity="0.26"/>
    </pattern>
    <clipPath id="dsh-back-medallion-clip">
      <circle cx="${CX}" cy="${MED_Y}" r="${MED_R}"/>
    </clipPath>
    <style>
      .dsh-gold-fill { fill: url(#dsh-gold); }
      .dsh-gold-line { fill: none; stroke: url(#dsh-gold); }
      .dsh-teal { fill: #8ff0e6; }
      /* 水波流动。keyframes 与使用方定义在一起：它原先挂在 styles/card.css，
         是跨文件隐式依赖——清理那边的死代码时几乎必被误删。 */
      .dsh-flow { animation: dsh-sigil-flow 5s ease-in-out infinite; }
      @keyframes dsh-sigil-flow {
        0%, 100% { transform: translateX(0); opacity: 0.85; }
        50% { transform: translateX(-3px); opacity: 1; }
      }
    </style>`;
}

/* ───────── 牌背 ─────────
   构图：近黑底 + 极淡菱格质感；三线金框与四角角饰；中央一枚曼陀罗纹章
   （`assets/back/medallion.jpg`，中心为鲸尾）；纹章上下各一枚月牙与八角星；
   左右两侧疏排细拱廊与小菱。无铭文——高端牌背惯例不写字，也让牌背更可逆。 */
export function renderCardBack(o = {}) {
  const { anim = true } = o;
  return `
  <symbol id="${BACK_SYMBOL_ID}" viewBox="0 0 ${CARD_W} ${CARD_H}">
    <rect width="${CARD_W}" height="${CARD_H}" fill="url(#dsh-back-sky)"/>
    <!-- 极淡的菱格底纹：只作为质感，不构成图案 -->
    <rect width="${CARD_W}" height="${CARD_H}" fill="url(#dsh-lattice)" opacity="0.22"/>

    <!-- 外框 -->
    <g class="dsh-gold-line">
      <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="16" stroke-width="3.4"/>
      <rect x="12" y="12" width="${CARD_W - 24}" height="${CARD_H - 24}" rx="11" stroke-width="1.2" opacity="0.85"/>
      <rect x="20" y="20" width="${CARD_W - 40}" height="${CARD_H - 40}" rx="8" stroke-width="0.9" opacity="0.45"/>
      <!-- 内圈回纹：只保留上下两段。左右两段删掉了——侧边已有拱廊，
           再叠回纹会显密，这一版的取舍是「疏」而不是「满」。 -->
      <path d="M 74 20 L 226 20 M 74 500 L 226 500" stroke-width="2" opacity="0.5"/>
      ${[
        [18, 18, 0], [CARD_W - 18, 18, 90], [CARD_W - 18, CARD_H - 18, 180], [18, CARD_H - 18, 270],
      ].map(([x, y, rot]) => `
        <g transform="translate(${x} ${y}) rotate(${rot})">
          <path d="M 0 30 L 0 12 Q 0 0 12 0 L 30 0"/>
          <path d="M 0 40 L 0 46 M 40 0 L 46 0" stroke-width="2.4"/>
          <path d="M 16 16 L 24 8 L 32 16 L 24 24 Z" class="dsh-gold-fill" stroke="none" opacity="0.85"/>
          <path d="M 5 5 L 11 5 L 5 11 Z" class="dsh-gold-fill" stroke="none" opacity="0.6"/>
        </g>`).join('')}
    </g>

    <!-- 中央纹章：Seedream 生成的黑金曼陀罗，中心即鲸尾 -->
    <image href="${BACK_MEDALLION}" x="${CX - MED_R}" y="${MED_Y - MED_R}"
           width="${MED_R * 2}" height="${MED_R * 2}"
           preserveAspectRatio="xMidYMid slice" clip-path="url(#dsh-back-medallion-clip)"/>
    <g class="dsh-gold-line">
      <circle cx="${CX}" cy="${MED_Y}" r="${MED_R}" stroke-width="1.4"/>
      <circle cx="${CX}" cy="${MED_Y}" r="${MED_R + 7}" stroke-width="0.6" opacity="0.5"/>
    </g>

    <!-- 左右内侧：疏排细拱廊。刻意稀疏——密织纹样会让牌背变吵 -->
    <g class="dsh-gold-line" opacity="0.45" stroke-width="0.8">
      ${Array.from({ length: 6 }, (_, i) => {
        const y = 170 + i * 41;
        return `<path d="M 27 ${y} a 5 5 0 0 1 0 10 M 273 ${y} a 5 5 0 0 0 0 10"/>`;
      }).join('')}
    </g>
    <!-- 侧边两端的小菱，给拱廊收口 -->
    <g class="dsh-gold-line" opacity="0.4" stroke-width="0.8">
      ${[[27, 150], [273, 150], [27, 416], [273, 416]].map(([x, y]) => `
        <path d="M ${x} ${y - 7} L ${x + 4} ${y} L ${x} ${y + 7} L ${x - 4} ${y} Z"/>`).join('')}
    </g>

    <!-- 上下装饰带：原来是为了框住铭文，去掉铭文后一并移除，
         让上下留白干净——这一版的取舍是「疏」 -->

    <!-- 四角填纹：小菱形组 -->
    <g class="dsh-gold-line" opacity="0.34" stroke-width="0.8">
      ${[[46, 150], [254, 150], [46, 394], [254, 394]].map(([x, y]) => `
        <g transform="translate(${x} ${y})">
          <path d="M 0 -14 L 9 0 L 0 14 L -9 0 Z"/>
          <path d="M 0 -7 L 4.5 0 L 0 7 L -4.5 0 Z"/>
        </g>`).join('')}
      ${[[46, 186], [254, 186], [46, 358], [254, 358]].map(([x, y]) => `
        <g transform="translate(${x} ${y})" class="dsh-gold-fill" stroke="none" opacity="0.8">
          ${sparkle(0, 0, 4)}
        </g>`).join('')}
    </g>

    <!-- 纹章上下的月与星（纹章本身已有星月，这里只各留一枚，保持疏朗） -->
    <g class="dsh-gold-fill" opacity="0.8">
      ${crescent(CX, 136, 14, 180)}
      ${starN(CX, 406, 8.5, 8)}
    </g>

    <!-- 无铭文：高端牌背惯例不写字，也让牌背在 180° 下更接近可逆 -->
  </symbol>`;
}

/* 卡牌牌背的轻量引用（所有牌共用一份 symbol 定义） */
export function cardBackMarkup() {
  return `<svg class="card-art card-art--back" viewBox="0 0 ${CARD_W} ${CARD_H}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="塔罗牌背" preserveAspectRatio="xMidYMid meet"
    ><use href="#${BACK_SYMBOL_ID}"/></svg>`;
}

/* ───────── 鲸鱼娘徽记（品牌用，含人物化处理） ───────── */
export function whaleSigilMarkup() {
  return `
  <symbol id="${SIGIL_SYMBOL_ID}" viewBox="0 0 120 120">
    <circle cx="60" cy="58" r="57" fill="url(#dsh-sigil-halo)"/>
    <path d="M 12 66 A 50 50 0 0 1 96 26" class="dsh-gold-line" stroke-width="0.9" opacity="0.45"
          stroke-linecap="round" stroke-dasharray="1.6 5.2"/>
    <g class="dsh-gold-fill">
      ${sparkle(34, 16, 3.4)}${sparkle(86, 16, 3.4)}${sparkle(98, 34, 2.8)}${sparkle(20, 34, 2.8)}
    </g>

    <!-- 尾鳍 -->
    <path d="M 79 47 C 87 36 94 29 102 26 C 98 39 90 50 84 57 Z"
          fill="url(#dsh-tail-band)" stroke="url(#dsh-gold)" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M 81 58 C 89 67 96 73 104 76 C 99 64 91 54 85 48 Z"
          fill="url(#dsh-tail-band)" stroke="url(#dsh-gold)" stroke-width="0.9" stroke-linejoin="round"/>

    <!-- 鲸身 -->
    <path d="M 24 62 C 24 44 40 31 60 31 C 74 31 84 37 88 46 C 92 55 89 66 80 73 C 70 82 52 85 40 82 C 29 79 24 71 24 62 Z"
          fill="url(#dsh-body-fill)" stroke="url(#dsh-gold)" stroke-width="1.35" stroke-linejoin="round"/>
    <path d="M 27 68 C 32 78 44 83 57 83 C 70 83 81 77 86 67 C 85 79 71 88 56 88 C 41 88 29 80 27 68 Z"
          fill="#dbe6ff" opacity="0.24"/>
    <path d="M 32 75 q 12 7 25 6 M 39 82 q 11 4 20 2" fill="none" stroke="#eaf0ff" stroke-width="0.85" opacity="0.3"/>
    <path d="M 45 78 q 1 8 6 12 q -2 -9 -3 -14 Z" fill="url(#dsh-fin-fill)" stroke="url(#dsh-gold)" stroke-width="0.6"/>
    <path d="M 90 30 A 44 44 0 0 1 101 54" class="dsh-gold-line" stroke-width="0.9" opacity="0.42" stroke-linecap="round"/>
    <path d="M 105 48 A 56 56 0 0 1 98 87" class="dsh-gold-line" stroke-width="0.8" opacity="0.26" stroke-linecap="round"/>
    <path d="M 19 60 q -5 6 -3 14" class="dsh-gold-line" stroke-width="0.8" opacity="0.26" stroke-linecap="round"/>

    <!-- 面部 -->
    <path d="M 35 60 q 8 -6 14 -1" fill="none" stroke="#f4f8ff" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M 41 63 q 3 2 5 0" fill="none" stroke="#8ff0e6" stroke-width="1.05" opacity="0.85"/>
    <path d="M 33 69 q 10 7 19 0" fill="none" stroke="#eaf0ff" stroke-width="1.3" stroke-linecap="round" opacity="0.65"/>
    <g class="dsh-gold-fill" opacity="0.95">${sparkle(58, 40, 6.4)}</g>
    <g fill="none" stroke="#8ff0e6" stroke-linecap="round">
      <path d="M 40 37 q -9 -5 -16 -4" stroke-width="1.1" opacity="0.34"/>
      <path d="M 43 33 q -7 -8 -13 -10" stroke-width="1" opacity="0.26"/>
    </g>
    <g stroke="#cfe0ff" fill="none" opacity="0.36" stroke-linecap="round">
      <path d="M 28 67 q -7 2 -11 6" stroke-width="0.8"/>
      <path d="M 29 72 q -6 4 -9 9" stroke-width="0.8"/>
    </g>
    <path d="M 52 8 A 9.5 9.5 0 0 1 69 9 A 12 12 0 0 0 52 8 Z" class="dsh-gold-fill"/>
    <path d="M 59 92 q 4.4 6.4 0 9.6 q -4.4 -3.2 0 -9.6 Z" fill="#8ff0e6" opacity="0.85"/>
    <path d="${wave(22, 98, 103, 3.4, 4)}" class="dsh-gold-line dsh-flow" stroke-width="1.25" opacity="0.85"/>
    <path d="${wave(34, 88, 108.5, 2.4, 3)}" fill="none" stroke="#8ff0e6" stroke-width="0.85" opacity="0.45"/>
  </symbol>`;
}

export function whaleSigil(size = 120) {
  return `<svg class="whale-sigil" viewBox="0 0 120 120" width="${size}" height="${size}"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href="#${SIGIL_SYMBOL_ID}"/></svg>`;
}

/* ───────── 顶栏品牌标记 ───────── */
export function brandMarkup() {
  return `
  <symbol id="${BRAND_SYMBOL_ID}" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" class="dsh-gold-line" stroke-width="1.1" opacity="0.8"/>
    <path d="M 10 27 C 14 15 27 13 34 20 C 37 23 37 27 37 29 C 32 37 21 38 15 32 C 12 30 10 28 10 27 Z"
          fill="url(#dsh-body-fill)" stroke="url(#dsh-gold)" stroke-width="0.9"/>
    <path d="M 8 26 C 4 21 2 19 1 18 C 5 17 8 19 11 23 C 10 24 9 25 8 26 Z"
          fill="url(#dsh-body-fill)" stroke="url(#dsh-gold)" stroke-width="0.7"/>
    <path d="M 9 29 C 4 31 2 34 1 37 C 6 36 9 33 12 30 Z"
          fill="url(#dsh-body-fill)" stroke="url(#dsh-gold)" stroke-width="0.7"/>
    <circle cx="30" cy="22" r="1.5" fill="#0a1030"/>
    <path d="M 36 20 L 43 13 L 37 23 Z" fill="url(#dsh-gold)"/>
    <path d="M 30 27 q 4 2 8 -1" fill="none" stroke="#eaf0ff" stroke-width="0.9" opacity="0.8"/>
    <path d="M 24 6 l 1.6 3.4 L 29 11 l -3.4 1.6 L 24 16 l -1.6 -3.4 L 19 11 l 3.4 -1.6 Z" fill="#e8c98a" opacity="0.9"/>
  </symbol>`;
}

export function brandMark() {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href="#${BRAND_SYMBOL_ID}"/></svg>`;
}

/* ───────── 把共享 defs 挂到文档（只需一次） ───────── */
export function mountCardDefs(doc = document) {
  if (doc.getElementById(DEFS_ID)) return;
  const host = doc.createElement('div');
  host.id = DEFS_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute">
    <defs>${sharedDefs()}</defs>
    ${renderCardBack()}
    ${whaleSigilMarkup()}
    ${brandMarkup()}
  </svg>`;
  doc.body.appendChild(host);
}
