/* ===========================================================
   tools/icon-art.mjs · 图标图形的**唯一来源**

   favicon（tools/make-favicon.mjs）与 PWA 图标（tools/make-icons.mjs）
   共用这一份图形定义。为什么不各画一遍：这两处画的必须是同一个东西，
   分成两份拷贝迟早会漂移成「标签页是金月牙、主屏图标还是蓝月牙」。

   改这里 = 同时改标签页图标和主屏图标。

   ── 两个必须记住的坑 ──

   1) 新月一律用「大圆挖掉一个偏移圆」画（mask），**不要**用两条弧过同一对端点：
      那种画法里弦长已经等于外弧直径，内弧半径给小了会被 SVG 规范
      **自动放大到同半径**，两条弧完全重合、面积归零——图标变成空的，而且不报任何错。
      v1 第一版就是这么写的，渲染出来只剩一个金环。
   2) 16px 下只有「厚、亮、单一实心形状」能活。实测：加金环（d / e）、
      加鲸尾（f）在 16px 全糊；把品牌插画直接缩小（g）就是一坨。
      所以形体的取舍不是审美问题，是这个尺寸的物理限制。
   =========================================================== */

import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

/* 站点夜空色：与 styles/base.css 的 --bg / 顶栏标记同族 */
export const BG_TOP = '#16204a';
export const BG_BOTTOM = '#070b1c';
export const BG_FLAT = '#0b1024';

/* ───────── 光栅候选（g）的图源 ─────────
   两张是**同一张画的同一处裁切**，只是分辨率不同：
     mark-1024.webp  brand-fit.py --size 1024 直接从 4096 原图裁的，给 PWA 512 图标用；
     mark.webp       顶栏那份 256px。
   512 图标如果只拿 256 放大，边缘会发虚，所以有 1024 就优先用 1024。
   重新生成高清版：
     python tools/brand-fit.py assets/brand/raw/<批次>/mark-1-tarot-moon.jpg \
       --out assets/brand/mark-1024.webp --size 1024 */
export const MARK_SOURCES = [
  'assets/brand/mark-v4-1024.webp',   // 当前选用（用户自出那一版）
  'assets/brand/mark-1024.webp',      // 最初那版插画
];

/** 按 MARK_SOURCES 的顺序取第一个存在的；override 可以是绝对路径或相对仓库根。 */
export function resolveMarkSource(root, override = null) {
  const list = override ? [override, ...MARK_SOURCES] : MARK_SOURCES;
  for (const rel of list) {
    const p = isAbsolute(rel) ? rel : join(root, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

/** 新月 = 外圆 - 偏移圆。返回 <mask> 定义，供候选的 content 用 url(#bite) 引用。 */
export const crescentMask = (cx, cy, r) =>
  `<mask id='bite' maskUnits='userSpaceOnUse' x='0' y='0' width='32' height='32'>`
  + `<rect width='32' height='32' fill='#fff'/>`
  + `<circle cx='${cx}' cy='${cy}' r='${r}' fill='#000'/></mask>`;

/** 四角星（sparkle）。R 是外半径，内半径按 k 收进来——
    16px 下内半径太小会让星退化成一坨菱形。 */
export function star(cx, cy, R, fill = '#f6e6bb', k = 0.4) {
  const r = R * k;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `<path d='M${pts.join('L')}z' fill='${fill}'/>`;
}

export const ring = (r = 13.2, w = 2.2, c = '#e8c98a') =>
  `<circle cx='16' cy='16' r='${r}' fill='none' stroke='${c}' stroke-width='${w}'/>`;

export const moon = (cx, cy, r, fill) =>
  `<circle cx='${cx}' cy='${cy}' r='${r}' fill='${fill}' mask='url(#bite)'/>`;

/** v1 里那条鲸尾路径，需要缩小时整条 <g> 一起变换 */
export const WHALE_TAIL = "<path d='M6 19c3.6 0 5.2-5.6 9.6-5.6 3 0 4.2 2.4 7.2 2.4 1.6 0 2.6-.7 3.2-1.6-1 3.6-3.8 6-7.4 6-2.2 0-3.6-.9-5-2-1.7 1.4-3.6 2-5.6 2-1 0-1.9-.2-2.6-.6z' fill='#7fb3ff'/>";

/* 候选：defs = 该图形需要的 <mask> 等定义；content = 不含背景的形体。
   背景由 iconSvg() 按用途拼——favicon 要圆角小方块，PWA 图标要满幅。 */
export const CANDIDATES = [
  {
    key: 'a',
    label: 'v1 上线版：粗新月 + 四角星（无环）',
    defs: crescentMask(22.6, 15.2, 10.2),
    content: moon(15.4, 16, 11.6, '#a8c8ff') + star(24.4, 9.1, 4),
  },
  {
    key: 'd',
    label: '金月牙 + 金环（暖金调）',
    defs: crescentMask(21.0, 15.6, 8.4),
    content: ring() + moon(14.8, 16, 9.6, '#f3e7c8'),
  },
  {
    key: 'e',
    label: '蓝月牙 + 金环 + 星（结构最全）',
    defs: crescentMask(20.9, 15.4, 8.2),
    content: ring() + moon(14.9, 16.2, 9.4, '#a8c8ff') + star(23.4, 19.8, 3.1),
  },
  {
    key: 'f',
    label: '月牙 + 鲸尾（品牌双元素，风险最高）',
    defs: crescentMask(21.2, 15.2, 8.6),
    content: moon(14.9, 16, 10, '#f3e7c8')
      + `<g transform='translate(9.4,7.6) scale(0.62)'>${WHALE_TAIL}</g>` + star(24.2, 7.6, 2.8),
  },
  {
    key: 'h',
    label: '只有金月牙（无星无环）',
    defs: crescentMask(22.0, 15.4, 10.2),
    content: moon(15, 16, 11.4, '#f6e6bb'),
  },
  {
    key: 'i',
    label: '金月牙 + 星（h 的形体 + a 的那颗星）',
    defs: crescentMask(22.0, 15.4, 10.2),
    content: moon(15, 16, 11.4, '#f6e6bb') + star(24.4, 9.1, 3.6),
  },
  {
    key: 'g',
    label: '整枚徽记 · 最初那版插画（金环 + 月亮 + 角色 + 鲸）',
    raster: true,
    src: 'assets/brand/mark-1024.webp',
  },
  /* 以下三个是同一张图的**不同裁切**，思路和 g 相反：
     g 要「完整」，它们在赌「小尺寸下只有角色本人认得出来」。
     16px 的物理极限摆在那（眼睛只占 1~2 px），所以重点看 32px 那两格。
     ⚠ 图源都显式写出来，不依赖 MARK_SOURCES 的默认值——
     默认值会随着「当前选用哪张」而变，历史候选就会莫名其妙换图。 */
  {
    key: 'j',
    label: '脸部特写 · 最初那版',
    raster: true,
    src: 'assets/brand/mark-1024.webp',
    crop: { x: 0.345, y: 0.395, w: 0.35, h: 0.35 },
  },
  {
    key: 'k',
    label: '脸 + 鲸鱼 + 月牙 · 最初那版',
    raster: true,
    src: 'assets/brand/mark-1024.webp',
    crop: { x: 0.30, y: 0.32, w: 0.52, h: 0.52 },
  },
  {
    key: 'l',
    label: '脸 + 鲸鱼（更紧）· 最初那版',
    raster: true,
    src: 'assets/brand/mark-1024.webp',
    crop: { x: 0.355, y: 0.375, w: 0.43, h: 0.43 },
  },
  /* ── 深色头发版（同一张画，先用 tools/brand-recolor.py 把过浅的青发压深）──
     用户反馈「头发颜色太浅」，而裁切改不了颜色，所以换图源。
     取景与 j / k 一一对应，方便直接比。 */
  {
    key: 'j2',
    label: '脸部特写 · 深发版',
    raster: true,
    src: 'assets/brand/mark-deep-1024.webp',
    crop: { x: 0.345, y: 0.395, w: 0.35, h: 0.35 },
  },
  {
    key: 'k2',
    label: '脸 + 鲸鱼 + 月牙 · 深发版',
    raster: true,
    src: 'assets/brand/mark-deep-1024.webp',
    crop: { x: 0.30, y: 0.32, w: 0.52, h: 0.52 },
  },
  {
    key: 'g2',
    label: '整枚徽记 · 深发版',
    raster: true,
    src: 'assets/brand/mark-deep-1024.webp',
  },
  {
    key: 'j3',
    label: '脸部特写 · 更深发版（明度 ×0.58）',
    raster: true,
    src: 'assets/brand/mark-deeper-1024.webp',
    crop: { x: 0.345, y: 0.395, w: 0.35, h: 0.35 },
  },
  {
    key: 'k3',
    label: '脸 + 鲸鱼 + 月牙 · 更深发版（明度 ×0.58）',
    raster: true,
    src: 'assets/brand/mark-deeper-1024.webp',
    crop: { x: 0.30, y: 0.32, w: 0.52, h: 0.52 },
  },
  /* ── 从参考图吸色号版（tools/brand-recolor.py --palette-from）──
     色号是自动从参考图的头发上取的：中位 #90D4F8 → #757DA6，
     换算成「色相 +21 / 饱和 ×0.70 / 明度 ×0.67」。
     4 = 完全采用参考图色调；5 = 强度 0.78（保留一点原来的亮度和彩度）。 */
  {
    key: 'j4',
    label: '脸部特写 · 参考图配色',
    raster: true,
    src: 'assets/brand/mark-ref-1024.webp',
    crop: { x: 0.345, y: 0.395, w: 0.35, h: 0.35 },
  },
  {
    key: 'k4',
    label: '脸 + 鲸鱼 + 月牙 · 参考图配色',
    raster: true,
    src: 'assets/brand/mark-ref-1024.webp',
    crop: { x: 0.30, y: 0.32, w: 0.52, h: 0.52 },
  },
  {
    key: 'j5',
    label: '脸部特写 · 参考图配色（强度 0.78）',
    raster: true,
    src: 'assets/brand/mark-ref78-1024.webp',
    crop: { x: 0.345, y: 0.395, w: 0.35, h: 0.35 },
  },
  {
    key: 'k5',
    label: '脸 + 鲸鱼 + 月牙 · 参考图配色（强度 0.78）',
    raster: true,
    src: 'assets/brand/mark-ref78-1024.webp',
    crop: { x: 0.30, y: 0.32, w: 0.52, h: 0.52 },
  },
  /* ── 第三版品牌图：按参考图重出的一张（2026-09-23，Seedream 4.5，2K，约 ¥0.3）──
     发色是提示词里明确写了「deep muted indigo blue … absolutely not pale cyan」
     才压下来的。白角用内缩 6% 裁掉（模型自作主张加了圆角卡片白底）。 */
  {
    key: 'm',
    label: '整枚徽记 · 新版（完整金环 + 月亮 + 鲸）',
    raster: true,
    src: 'assets/brand/mark-v3-1024.webp',
  },
  {
    key: 'm2',
    label: '脸部特写 · 新版（深靛蓝发 + 蓝眼，最贴参考图）',
    raster: true,
    src: 'assets/brand/mark-v3-1024.webp',
    crop: { x: 0.28, y: 0.26, w: 0.42, h: 0.42 },
  },
  {
    key: 'm3',
    label: '脸 + 鲸 + 头饰 · 新版（信息更全）',
    raster: true,
    src: 'assets/brand/mark-v3-1024.webp',
    crop: { x: 0.08, y: 0.14, w: 0.64, h: 0.64 },
  },
  /* ── 第四版品牌图：用户自己出的一版（2026-09-23，全幅无白边，构图更好）──
     注意右下角有平台强制的「AI生成」水印，位置是 x 0.81~0.97 / y 0.90~0.96。
     **所有取景都刻意避开了它**（裁切下界 y ≤ 0.74；顶栏那个圆形遮罩也切掉四角），
     所以不需要对水印做任何处理。这是构图裁切，不是抹标识。 */
  {
    key: 'n',
    label: '整枚 · 用户版（全幅，圆形使用时水印被遮罩切掉）',
    raster: true,
    src: 'assets/brand/mark-v4-1024.webp',
  },
  {
    key: 'n2',
    label: '脸部特写 · 用户版（鲸鱼耳 + 蓝发）',
    raster: true,
    src: 'assets/brand/mark-v4-1024.webp',
    crop: { x: 0.36, y: 0.27, w: 0.42, h: 0.42 },
  },
  {
    key: 'n3',
    label: '头 + 鲸 + 星星 · 用户版（信息最全，16px 对比最好）',
    raster: true,
    src: 'assets/brand/mark-v4-1024.webp',
    crop: { x: 0.28, y: 0.07, w: 0.68, h: 0.68 },
  },
];

/** **当前选用**的图形：favicon 与 PWA 图标都默认用它。
    2026-09-23 定为 `n3`（用户自己出的一版，头 + 鲸 + 星星取景）。
    换图形：改这一行，或运行时用 `--only/--key`。 */
export const DEFAULT_KEY = 'n3';

export const byKey = (key) => CANDIDATES.find((c) => c.key === key) || null;

/**
 * 拼出完整的 32×32 图标 SVG。
 * @param {string} key            候选 key
 * @param {'rounded'|'square'|'flat'|'none'|'gradient'} [opts.bg]
 *        rounded = 圆角小方块（favicon，标签栏上不糊成一片）
 *        square  = 满幅直角（PWA 图标，交给平台的遮罩去切）
 *        gradient= 满幅 + 夜空渐变（PWA 图标用这个，纯色太平）
 *        flat    = 满幅纯色
 *        none    = 透明底
 * @param {number} [opts.inset]   形体整体缩放（maskable 要把内容收进中心安全区）
 * @param {number} [opts.rx]      圆角半径（仅 bg='rounded' 生效）
 */
export function iconSvg(key, { bg = 'rounded', inset = 1, rx = 7 } = {}) {
  const c = byKey(key);
  if (!c || c.raster) return null;

  let back = '';
  let bgDefs = '';
  if (bg === 'rounded') back = `<rect width='32' height='32' rx='${rx}' fill='${BG_FLAT}'/>`;
  else if (bg === 'square' || bg === 'flat') back = `<rect width='32' height='32' fill='${BG_FLAT}'/>`;
  else if (bg === 'gradient') {
    bgDefs = "<linearGradient id='skybg' x1='0' y1='0' x2='0' y2='1'>"
      + `<stop offset='0' stop-color='${BG_TOP}'/><stop offset='1' stop-color='${BG_BOTTOM}'/></linearGradient>`;
    back = "<rect width='32' height='32' fill='url(#skybg)'/>";
  }

  const inner = inset === 1
    ? c.content
    : `<g transform='translate(16 16) scale(${inset}) translate(-16 -16)'>${c.content}</g>`;

  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>`
    + `<defs>${bgDefs}${c.defs}</defs>${back}${inner}</svg>`;
}
