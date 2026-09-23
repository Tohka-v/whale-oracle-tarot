/* ===========================================================
   card-art.js · 把一张塔罗牌渲染成 SVG
   统一构图：星空 → 中心象征场景 → 金色牌框 → 名牌
   =========================================================== */

import {
  CARD_W, CARD_H, poly, ngon, starPath, sparkle, starN, circle, dot, ring,
  crescent, cloud, mount, wave, branch, wand, cup, sword, pentacle, figure,
  eye, scales, infinity, roman, cornerFlourish, starDustBand, backgroundStars,
  rays, PIPS,
} from './svgkit.js';
import { renderCharacterSVG } from './char-art.js';
import { artUrl } from '../data/art-manifest.js';

/* 牌面天空区域 */
export const SKY = { x: 26, y: 26, w: CARD_W - 52, h: CARD_H - 52 };
const CX = CARD_W / 2;
const CY = 250;

/* 每个序号固定的星点，避免每次渲染都不一样 */
function dust(count, seedBase, spread = [40, CARD_W - 40]) {
  const out = [];
  let s = seedBase;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < count; i++) {
    const x = spread[0] + rnd() * (spread[1] - spread[0]);
    const y = 44 + rnd() * (CARD_H - 96);
    out.push([+x.toFixed(1), +y.toFixed(1), +(2 + rnd() * 2.4).toFixed(2), +(0.22 + rnd() * 0.5).toFixed(2)]);
  }
  return out;
}

/* ───────── 大阿卡纳场景 ───────── */

const SCENES = [
  () => `                       /* 愚者 */
    ${circle(CX + 66, 118, 30)}
    ${rays(CX + 66, 118, 34, 66, 12, 3.4)}
    ${mount(CX - 96, 420, 150, 74)}
    <path d="M ${CX + 34} 400 L ${CX + 104} 400" stroke-width="1.4" opacity="0.7"/>
    <path d="M ${CX + 34} 400 L ${CX + 34} 300" stroke-width="1.4" opacity="0.7"/>
    ${figure(CX + 8, 396, 118, { arms: 'up' })}
    <g data-fill="accent" stroke="none">${sparkle(CX - 60, 250, 9)}</g>
    <path d="M ${CX + 40} 250 q 12 12 24 0" fill="none"/>
    <path d="M ${CX + 40} 258 q 12 12 24 0" fill="none"/>
    <path d="M ${CX + 74} 404 q 22 -8 34 6 q -20 6 -34 -6 Z" data-fill="robe"/>
    ${cloud(84, 172, 62, 18)}`,

  () => `                       /* 魔术师 */
    ${infinity(CX, 150, 1.25)}
    <path d="M ${CX - 46} 404 L ${CX + 46} 404 L ${CX + 34} 418 L ${CX - 34} 418 Z" data-fill="robe"/>
    <path d="M ${CX - 74} 172 L ${CX + 74} 172" stroke-width="2"/>
    ${wand(CX - 58, 214, 74, 0)}
    ${cup(CX - 20, 210, 0.72)}
    ${sword(CX + 22, 214, 76, 0)}
    ${pentacle(CX + 62, 216, 20)}
    ${figure(CX, 402, 132, { arms: 'up' })}
    <path d="M ${CX - 90} 418 q 90 22 180 0" fill="none"/>
    <g data-fill="accent" stroke="none">${sparkle(CX, 92, 12)}</g>
    <g data-fill="accent" stroke="none">${sparkle(CX - 52, 106, 7)}</g>
    <g data-fill="accent" stroke="none">${sparkle(CX + 54, 108, 7)}</g>`,

  () => `                       /* 女祭司 */
    <path d="M ${CX - 78} 200 L ${CX - 78} 418 M ${CX + 78} 200 L ${CX + 78} 418" stroke-width="5" opacity="0.55"/>
    <path d="M ${CX - 86} 200 L ${CX - 70} 200 M ${CX + 70} 200 L ${CX + 86} 200" stroke-width="3"/>
    <path d="M ${CX - 46} 200 L ${CX + 46} 200 L ${CX + 46} 418 L ${CX - 46} 418 Z" data-fill="veil" opacity="0.5" stroke="none"/>
    <path d="M ${CX - 40} 198 q 40 -26 80 0" fill="none"/>
    <path d="M ${CX - 40} 208 q 40 26 80 0" fill="none" opacity="0.7"/>
    ${figure(CX, 412, 124, { arms: 'pray', crown: true })}
    ${crescent(CX, 108, 22)}
    ${starN(CX, 108, 30, 9)}
    <path d="M ${CX - 22} 452 q 22 -12 44 0" fill="none" opacity="0.8"/>`,

  () => `                       /* 女皇 */
    <path d="M ${CX - 92} 400 q 20 -60 46 -78 M ${CX + 92} 400 q -20 -60 -46 -78" fill="none"/>
    ${dot(CX - 60, 330, 7, 'var-accent')}
    ${dot(CX + 58, 322, 6, 'var-accent')}
    <path d="M ${CX - 104} 412 q 104 -34 208 0" fill="none"/>
    ${figure(CX, 400, 138, { arms: 'open', crown: true })}
    <path d="${starPath(CX, 112, 34, 15, 8, 22)}"/>`,

  () => `                       /* 皇帝 */
    <path d="M ${CX - 70} 430 L ${CX - 70} 300 L ${CX - 46} 300 L ${CX - 46} 430 Z" data-fill="veil" opacity="0.45" stroke="none"/>
    <path d="M ${CX + 46} 430 L ${CX + 46} 300 L ${CX + 70} 300 L ${CX + 70} 430 Z" data-fill="veil" opacity="0.45" stroke="none"/>
    ${mount(CX + 2, 302, 190, 78)}
    <path d="M ${CX - 74} 430 L ${CX + 74} 430 L ${CX + 56} 452 L ${CX - 56} 452 Z" data-fill="robe"/>
    ${figure(CX, 404, 146, { arms: 'one', crown: true })}
    <path d="M ${CX - 30} 268 q 30 -22 60 0" fill="none"/>
    ${dot(CX, 258, 7, 'var-accent')}
    ${dot(CX - 34, 434, 8, 'var-gold')}
    ${dot(CX + 34, 434, 8, 'var-gold')}`,

  () => `                       /* 教皇 */
    <path d="M ${CX - 84} 436 L ${CX - 84} 244 q 84 -46 168 0 L ${CX + 84} 436" fill="none"/>
    <path d="M ${CX - 54} 244 q 54 -30 108 0" fill="none" opacity="0.7"/>
    <path d="M ${CX - 26} 282 L ${CX + 26} 282 L ${CX + 26} 420 L ${CX - 26} 420 Z" data-fill="robe" opacity="0.55" stroke="none"/>
    <path d="M ${CX - 20} 262 L ${CX} 240 L ${CX + 20} 262 Z" data-fill="accent"/>
    <path d="M ${CX - 8} 300 L ${CX - 8} 330 M ${CX + 8} 300 L ${CX + 8} 330 M ${CX - 16} 315 L ${CX + 16} 315" stroke-width="4"/>
    ${figure(CX, 416, 122, { arms: 'pray', crown: true })}
    ${figure(CX - 86, 452, 92, { arms: 'pray' })}
    ${figure(CX + 86, 452, 92, { arms: 'pray' })}
    ${dot(CX - 88, 356, 6, 'var-accent')}
    ${dot(CX + 88, 356, 6, 'var-accent')}`,

  () => `                       /* 恋人 */
    ${circle(CX, 116, 30)}
    ${rays(CX, 116, 34, 62, 14, 3)}
    <path d="M ${CX - 6} 116 q 40 -26 62 -6 q -22 26 -62 6 Z" data-fill="accent" stroke="none" opacity="0.9"/>
    ${figure(CX - 74, 420, 128, { arms: 'up', crown: true })}
    ${figure(CX + 74, 420, 128, { arms: 'open', crown: true })}
    <g data-fill="accent" stroke="none">${sparkle(CX, 250, 12)}</g>
    ${mount(CX, 452, 240, 60)}
    ${starN(CX - 118, 176, 20, 6)}
    ${starN(CX + 118, 176, 22, 6)}`,

  () => `                       /* 战车 */
    <path d="M ${CX - 84} 176 q 84 -44 168 0 L ${CX + 84} 300 L ${CX - 84} 300 Z" data-fill="veil" opacity="0.42" stroke="none"/>
    ${starN(CX, 214, 42, 6)}
    <path d="M ${CX - 64} 300 L ${CX + 64} 300 L ${CX + 48} 384 L ${CX - 48} 384 Z" data-fill="robe"/>
    <path d="M ${CX - 88} 384 L ${CX + 88} 384 L ${CX + 70} 456 L ${CX - 70} 456 Z" data-fill="veil" opacity="0.5" stroke="none"/>
    ${figure(CX, 386, 140, { arms: 'open', crown: true })}
    <path d="M ${CX - 96} 430 q -30 14 -52 4 M ${CX + 96} 430 q 30 14 52 4" fill="none"/>
    ${dot(CX - 96, 420, 8, 'var-gold')}
    ${dot(CX + 96, 420, 8, 'var-gold')}
    ${starN(CX - 118, 116, 16, 5)}
    ${starN(CX + 118, 116, 16, 5)}`,

  () => `                       /* 力量 */
    ${infinity(CX, 118, 0.95)}
    <g data-ink="gold">${crescent(CX - 66, 300, 20, -18)}${crescent(CX + 66, 300, 20, 18)}</g>
    ${figure(CX - 8, 428, 150, { arms: 'up' })}
    <path d="M ${CX + 52} 428 q 34 -14 56 4 q -20 22 -56 10 q -14 -6 0 -14 Z" data-fill="robe"/>
    <path d="M ${CX + 74} 424 q 10 -22 28 -26 M ${CX + 86} 414 q 22 -6 30 -22" fill="none"/>
    ${mount(CX - 4, 452, 220, 56)}`,

  () => `                       /* 隐者 */
    <path d="M ${CX - 70} 452 L ${CX} 130 L ${CX + 70} 452 Z" fill="none" opacity="0.55"/>
    <path d="M ${CX - 40} 452 L ${CX} 186 L ${CX + 40} 452 Z" fill="none" opacity="0.35"/>
    <g data-ink="gold">${starN(CX + 54, 250, 26, 6)}</g>
    ${dot(CX + 54, 250, 9, 'var-accent')}
    ${figure(CX - 16, 428, 154, { arms: 'one' })}
    ${mount(CX - 10, 452, 240, 66)}
    <g data-fill="gold" stroke="none" opacity="0.7">${sparkle(CX - 82, 300, 6)}</g>`,

  () => `                       /* 命运之轮 */
    ${ring(CX, 246, 108, 3)}
    ${ring(CX, 246, 92, 2)}
    ${rays(CX, 246, 112, 128, 12, 2.4)}
    <path d="M ${ngon(CX, 246, 74, 8, 22.5).map((p) => p.join(' ')).join(' L ')} Z" fill="none" stroke-width="3"/>
    <path d="M ${ngon(CX, 246, 56, 8, 0).map((p) => p.join(' ')).join(' L ')} Z" fill="none" stroke-width="2" opacity="0.7"/>
    <circle cx="${CX}" cy="${246}" r="30" fill="none" stroke-width="2"/>
    <g data-fill="accent" stroke="none">${sparkle(CX, 246, 20)}</g>
    <g data-fill="accent" stroke="none">${sparkle(CX, 158, 12)}</g>
    <g data-fill="accent" stroke="none">${sparkle(CX + 76, 316, 12)}</g>
    <g data-fill="accent" stroke="none">${sparkle(CX - 76, 316, 12)}</g>
    <path d="M ${CX - 40} 214 L ${CX - 40} 278 M ${CX + 40} 214 L ${CX + 40} 278" stroke-width="4"/>
    ${cloud(CX - 96, 128, 58, 16)}
    ${cloud(CX + 96, 366, 58, 16)}`,

  () => `                       /* 正义 */
    <path d="M ${CX} 118 L ${CX} 424" stroke-width="3"/>
    ${scales(CX, 208, 128)}
    <path d="M ${CX - 46} 424 L ${CX + 46} 424 L ${CX + 32} 442 L ${CX - 32} 442 Z" data-fill="robe"/>
    ${figure(CX, 424, 140, { arms: 'down', crown: true })}
    <path d="M ${CX + 40} 250 L ${CX + 44} 402 M ${CX + 40} 250 L ${CX + 44} 250" stroke-width="3"/>
    <path d="M ${CX + 44} 250 L ${CX + 30} 268 L ${CX + 44} 264 L ${CX + 58} 268 Z" data-fill="blade" stroke="none"/>`,

  () => `                       /* 倒吊人 */
    <path d="M ${CX - 74} 128 L ${CX - 74} 452 M ${CX + 74} 128 L ${CX + 74} 452" stroke-width="4" opacity="0.65"/>
    <path d="M ${CX - 84} 128 L ${CX + 84} 128" stroke-width="4"/>
    <path d="M ${CX} 128 L ${CX} 174" stroke-width="3"/>
    <path d="M ${CX - 34} 178 L ${CX + 34} 178" stroke-width="3"/>
    <g transform="rotate(180 ${CX} 250)">
      ${figure(CX, 336, 140, { arms: 'open' })}
    </g>
    <path d="M ${CX - 26} 322 q 26 -66 52 0" fill="none" opacity="0.6"/>
    ${dot(CX - 30, 300, 7, 'var-accent')}
    ${dot(CX + 30, 300, 7, 'var-accent')}
    ${cloud(CX - 98, 396, 54, 15)}`,

  () => `                       /* 死神 */
    <path d="M ${CX - 96} 452 L ${CX - 30} 168 L ${CX + 40} 452 Z" fill="none" opacity="0.4"/>
    <path d="M ${CX - 46} 452 L ${CX + 12} 200 L ${CX + 62} 452 Z" fill="none" opacity="0.28"/>
    ${circle(CX + 16, 168, 28)}
    <path d="M ${CX + 2} 168 L ${CX + 30} 168 M ${CX + 8} 156 L ${CX + 24} 156 M ${CX + 8} 180 L ${CX + 24} 180" stroke-width="3" opacity="0.8"/>
    ${crescent(CX - 74, 130, 26, -30)}
    ${figure(CX - 78, 452, 96, { arms: 'up', crown: true })}
    ${figure(CX + 92, 452, 82, { arms: 'pray' })}
    ${figure(CX + 132, 452, 62, { arms: 'pray' })}
    <path d="M ${CX - 40} 452 q 40 -22 80 0" fill="none" opacity="0.7"/>`,

  () => `                       /* 节制 */
    ${rays(CX - 30, 130, 26, 52, 12, 3)}
    ${figure(CX - 46, 424, 138, { arms: 'up' })}
    ${cup(CX + 40, 268, 1.15)}
    ${cup(CX + 76, 340, 0.8)}
    <path d="M ${CX - 26} 258 q 22 8 40 0" fill="none"/>
    <path d="M ${CX + 8} 296 q 4 22 -8 34" fill="none"/>
    <path d="M ${CX + 62} 300 q 10 22 4 34" fill="none" opacity="0.7"/>
    ${dot(CX + 30, 320, 4, 'var-accent')}
    ${dot(CX + 46, 344, 3, 'var-accent')}
    <path d="M ${CX - 30} 452 q 60 -14 120 0" fill="none" opacity="0.5"/>`,

  () => `                       /* 恶魔 */
    <path d="M ${CX - 60} 220 L ${CX + 60} 220 L ${CX + 40} 300 L ${CX - 40} 300 Z" data-fill="robe"/>
    ${crescent(CX, 154, 26, 180)}
    <path d="M ${CX - 30} 182 q -12 -18 -26 -20 M ${CX + 30} 182 q 12 -18 26 -20" fill="none"/>
    ${figure(CX, 220, 84, { arms: 'up', crown: false })}
    <path d="M ${CX - 130} 452 L ${CX - 130} 336 L ${CX + 130} 336" stroke-width="4"/>
    ${dot(CX - 130, 300, 8, 'var-gold')}
    ${dot(CX + 130, 300, 8, 'var-gold')}
    ${figure(CX - 96, 452, 92, { arms: 'pray' })}
    ${figure(CX + 96, 452, 92, { arms: 'pray' })}
    <g transform="rotate(180 ${CX} 250)">${infinity(CX, 200, 0.62)}</g>`,

  () => `                       /* 塔 */
    <path d="M ${CX - 44} 452 L ${CX - 30} 216 L ${CX + 30} 216 L ${CX + 44} 452 Z" data-fill="veil" opacity="0.5" stroke="none"/>
    <path d="M ${CX - 44} 452 L ${CX - 30} 216 L ${CX + 30} 216 L ${CX + 44} 452" fill="none" stroke-width="3"/>
    <path d="M ${CX - 8} 452 L ${CX - 12} 200 L ${CX + 22} 178 L ${CX + 26} 452" data-fill="robe" stroke="none" opacity="0.85"/>
    <path d="M ${CX - 34} 216 L ${CX + 34} 216 L ${CX + 22} 190 L ${CX - 22} 190 Z" data-fill="accent" stroke="none"/>
    <path d="M ${CX + 66} 96 L ${CX - 4} 208" stroke-width="4"/>
    <path d="M ${CX + 74} 104 L ${CX + 60} 78 L ${CX + 48} 108 Z" data-fill="accent" stroke="none"/>
    ${dot(CX - 46, 258, 8, 'var-accent')}
    ${dot(CX + 52, 320, 7, 'var-accent')}
    ${dot(CX - 30, 372, 6, 'var-accent')}
    ${figure(CX - 84, 452, 80, { arms: 'up' })}
    ${figure(CX + 86, 452, 76, { arms: 'up' })}
    ${cloud(CX - 96, 150, 56, 16)}`,

  () => `                       /* 星星 */
    <g data-fill="accent" stroke="none">${starN(CX, 148, 42, 8)}</g>
    <g data-fill="accent" stroke="none">${starN(CX - 92, 108, 20, 7)}</g>
    <g data-fill="accent" stroke="none">${starN(CX + 92, 104, 17, 7)}</g>
    <g data-fill="accent" stroke="none">${starN(CX - 58, 210, 12, 7)}</g>
    <g data-fill="accent" stroke="none">${starN(CX + 66, 196, 11, 7)}</g>
    ${figure(CX, 432, 142, { arms: 'down' })}
    ${cup(CX - 44, 322, 0.66)}
    ${cup(CX + 44, 322, 0.66)}
    <path d="M ${CX - 44} 340 q -14 40 -30 52" fill="none"/>
    <path d="M ${CX + 44} 340 q 14 40 30 52" fill="none"/>
    <path d="M ${CX + 34} 330 q 20 44 44 56" fill="none" opacity="0.6"/>
    <path d="M ${CX - 34} 330 q -20 44 -44 56" fill="none" opacity="0.6"/>
    ${wave(CX - 96, CX + 96, 452, 7, 6)}`,

  () => `                       /* 月亮 */
    <g data-ink="gold">${crescent(CX, 158, 46, 0)}</g>
    ${rays(CX, 158, 52, 82, 14, 2.6)}
    ${dot(CX - 60, 172, 5, 'var-accent')}
    ${dot(CX + 60, 148, 4, 'var-accent')}
    <path d="M ${CX - 84} 372 L ${CX - 84} 214 L ${CX - 58} 214 L ${CX - 58} 372 Z" data-fill="veil" opacity="0.4" stroke="none"/>
    <path d="M ${CX + 58} 372 L ${CX + 58} 214 L ${CX + 84} 214 L ${CX + 84} 372 Z" data-fill="veil" opacity="0.4" stroke="none"/>
    ${figure(CX - 96, 404, 92, { arms: 'down' })}
    ${figure(CX + 96, 404, 92, { arms: 'down' })}
    <path d="M ${CX - 46} 452 q 46 -22 92 0" fill="none"/>
    ${wave(CX - 92, CX + 92, 428, 6, 6)}
    ${dot(CX, 380, 8, 'var-gold')}`,

  () => `                       /* 太阳 */
    ${circle(CX, 172, 52)}
    ${rays(CX, 172, 60, 116, 18, 4)}
    <g data-fill="accent" stroke="none" opacity="0.35">${circle(CX, 172, 44)}</g>
    <path d="M ${CX - 92} 452 q 92 -60 184 0 Z" data-fill="veil" opacity="0.45" stroke="none"/>
    <path d="M ${CX - 92} 452 q 92 -60 184 0" fill="none"/>
    <path d="M ${CX - 30} 452 L ${CX - 30} 300 M ${CX + 30} 452 L ${CX + 30} 300" stroke-width="3"/>
    ${figure(CX, 420, 116, { arms: 'up', crown: false })}
    <path d="M ${CX - 62} 452 L ${CX - 40} 400 L ${CX - 18} 452 Z" data-fill="accent" stroke="none" opacity="0.5"/>
    <path d="M ${CX + 18} 452 L ${CX + 40} 400 L ${CX + 62} 452 Z" data-fill="accent" stroke="none" opacity="0.5"/>`,

  () => `                       /* 审判 */
    ${rays(CX, 128, 30, 84, 16, 3.4)}
    ${cloud(CX, 116, 130, 30)}
    <path d="M ${CX - 40} 136 L ${CX + 40} 136 M ${CX} 136 L ${CX} 190" stroke-width="4"/>
    <path d="M ${CX - 14} 190 L ${CX + 14} 190" stroke-width="4"/>
    <path d="M ${CX - 90} 452 L ${CX - 90} 356 L ${CX + 90} 356 L ${CX + 90} 452" fill="none" opacity="0.5"/>
    ${wave(CX - 80, CX + 80, 420, 8, 6)}
    ${figure(CX - 62, 400, 96, { arms: 'up' })}
    ${figure(CX + 62, 400, 96, { arms: 'up' })}
    ${figure(CX, 388, 78, { arms: 'pray' })}
    ${starN(CX - 116, 220, 14, 6)}
    ${starN(CX + 116, 220, 14, 6)}`,

  () => `                       /* 世界 */
    <ellipse cx="${CX}" cy="${246}" rx="86" ry="118" fill="none" stroke-width="3"/>
    <ellipse cx="${CX}" cy="${246}" rx="74" ry="106" fill="none" stroke-width="1.6" opacity="0.6"/>
    <path d="M ${CX - 86} 246 q 20 -30 44 0 q -24 30 -44 0 Z" fill="none" opacity="0.4"/>
    <path d="M ${CX + 86} 246 q -20 -30 -44 0 q 24 30 44 0 Z" fill="none" opacity="0.4"/>
    ${figure(CX, 340, 138, { arms: 'open' })}
    <path d="M ${CX - 40} 352 q 40 22 80 0" fill="none" opacity="0.6"/>
    <g data-fill="accent" stroke="none">${dot(CX - 24, 116, 14)}</g>
    <g data-fill="accent" stroke="none">${dot(CX + 24, 116, 14)}</g>
    ${figure(CX - 112, 430, 84, { arms: 'open' })}
    ${figure(CX + 112, 430, 84, { arms: 'open', flip: true })}
    <path d="M ${CX - 96} 440 q 96 -26 192 0" fill="none" opacity="0.45"/>`,
];

/* 大阿卡纳调色板：深色夜空 + 象征色 */
/* ───────── 大阿卡纳的鲸鱼娘角色配置 ─────────
   基础形象统一（藏青＋白女仆装鲸鱼娘），按牌义调整姿态、冠饰与法器 */
const CHAR = {
  0:  { pose: 'float', arms: 'open',      crown: 'none',     prop: 'flower',  aura: '#7fd8c8' },
  1:  { pose: 'sit',   arms: 'up',        crown: 'none',     prop: 'wand',    aura: '#ffcf6a' },
  2:  { pose: 'sit',   arms: 'pray',      crown: 'crescent', prop: 'book',    aura: '#a9c6ff', veil: true },
  3:  { pose: 'sit',   arms: 'down-hold', crown: 'tiara',    prop: 'flower',  aura: '#ffd98a' },
  4:  { pose: 'sit',   arms: 'one',       crown: 'horn',     prop: 'none',    aura: '#ffb066' },
  5:  { pose: 'sit',   arms: 'pray',      crown: 'tiara',    prop: 'key',     aura: '#e0b6ff' },
  6:  { pose: 'lean',  arms: 'pray',      crown: 'none',     prop: 'flower',  aura: '#ffc4d8' },
  7:  { pose: 'sit',   arms: 'one',       crown: 'tiara',    prop: 'sword',   aura: '#9fe0ff' },
  8:  { pose: 'sit',   arms: 'open',      crown: 'none',     prop: 'none',    aura: '#ffd98a' },
  9:  { pose: 'sit',   arms: 'one',       crown: 'none',     prop: 'lantern', aura: '#cfe0ff' },
  10: { pose: 'float', arms: 'open',      crown: 'tiara',    prop: 'star',    aura: '#ffd27a' },
  11: { pose: 'sit',   arms: 'open',      crown: 'none',     prop: 'scales',  aura: '#bcd4ff' },
  12: { pose: 'float', arms: 'open',      crown: 'none',     prop: 'none',    aura: '#8ff0e6' },
  13: { pose: 'sit',   arms: 'one',       crown: 'none',     prop: 'none',    aura: '#c9b3ff' },
  14: { pose: 'sit',   arms: 'open',      crown: 'none',     prop: 'grail',   aura: '#ffe0a8' },
  15: { pose: 'sit',   arms: 'open',      crown: 'horn',     prop: 'none',    aura: '#ff8f7a' },
  16: { pose: 'float', arms: 'up',        crown: 'tiara',    prop: 'none',    aura: '#ff9a6a' },
  17: { pose: 'float', arms: 'open',      crown: 'none',     prop: 'none',    aura: '#a8f0ff' },
  18: { pose: 'sit',   arms: 'open',      crown: 'crescent', prop: 'none',    aura: '#cfd8ff' },
  19: { pose: 'sit',   arms: 'open',      crown: 'laurel',   prop: 'none',    aura: '#ffd166' },
  20: { pose: 'float', arms: 'up',        crown: 'tiara',    prop: 'bell',    aura: '#a9ecff' },
  21: { pose: 'sit',   arms: 'open',      crown: 'laurel',   prop: 'star',    aura: '#a8ffe8' },
};

/* 大阿卡纳调色板：深色夜空 + 象征色 */
const MAJOR_PALETTE = [
  ['#0f2540', '#123a52', '#071322', '#7fd8c8'], // 0 愚者
  ['#3a0f22', '#5c1a2c', '#140610', '#ffcf6a'], // 1 魔术师
  ['#131a4a', '#1d2a6b', '#080c24', '#a9c6ff'], // 2 女祭司
  ['#123a24', '#1d5a34', '#07180f', '#ffd98a'], // 3 女皇
  ['#3d1410', '#63231a', '#170806', '#ffb066'], // 4 皇帝
  ['#2a1a44', '#3d2a68', '#100a1e', '#e0b6ff'], // 5 教皇
  ['#1d1440', '#2f2064', '#0b0820', '#ffc4d8'], // 6 恋人
  ['#0d2038', '#173a5e', '#050f1c', '#9fe0ff'], // 7 战车
  ['#3a2a08', '#5c4410', '#170f04', '#ffd98a'], // 8 力量
  ['#141a2e', '#222c4c', '#070a16', '#cfe0ff'], // 9 隐者
  ['#101c48', '#1c2f74', '#060c22', '#ffd27a'], // 10 命运之轮
  ['#16223c', '#25406a', '#080f1e', '#bcd4ff'], // 11 正义
  ['#0d2436', '#154a5c', '#05131c', '#8ff0e6'], // 12 倒吊人
  ['#1a1030', '#2c1a4e', '#080418', '#c9b3ff'], // 13 死神
  ['#231a3c', '#3a2a63', '#0c0818', '#ffe0a8'], // 14 节制
  ['#2c0f1a', '#45161f', '#12040a', '#ff8f7a'], // 15 恶魔
  ['#2a0e14', '#4a1218', '#100306', '#ff9a6a'], // 16 塔
  ['#0b2340', '#14456e', '#04101f', '#a8f0ff'], // 17 星星
  ['#141a44', '#25306e', '#070a22', '#cfd8ff'], // 18 月亮
  ['#40260a', '#6b3f0e', '#1a0f04', '#ffd166'], // 19 太阳
  ['#0c2440', '#134a6a', '#04121f', '#a9ecff'], // 20 审判
  ['#102a30', '#17514f', '#06171a', '#a8ffe8'], // 21 世界
];

/* ───────── 小阿卡纳 ───────── */

const SUIT_STYLE = {
  wands: { accent: '#ff9f5a', deep: '#4a1c06', name: '权杖', glyph: (x, y, s) => wand(x, y, 96 * s) },
  cups: { accent: '#7fc4ff', deep: '#0a2340', name: '圣杯', glyph: (x, y, s) => cup(x, y, 1.5 * s) },
  swords: { accent: '#cfd8ff', deep: '#1b2340', name: '宝剑', glyph: (x, y, s) => sword(x, y, 100 * s) },
  pentacles: { accent: '#8ce0a8', deep: '#0d2c1a', name: '星币', glyph: (x, y, s) => pentacle(x, y, 28 * s) },
};

const COURT_CN = { 11: '侍从', 12: '骑士', 13: '王后', 14: '国王' };

/* 顶部序号带的宫廷牌标记。
   不能用中文名的第一个字：「国王」首字是「国」（country）、
   「王后」首字是「王」（通常指国王），两个都会误读。
   这里各自取一个能独立成义的字：侍 / 骑 / 后 / 王。 */
const COURT_MARK = { 11: '侍', 12: '骑', 13: '后', 14: '王' };

function minorScene(suit, number) {
  const st = SUIT_STYLE[suit];
  const out = [];
  if (number <= 10) {
    const layout = PIPS[number] || PIPS[1];
    const rx = 74;
    const ry = 150;
    const centerY = CY + 6;
    for (const [px, py] of layout) {
      const x = +(CX + px * rx).toFixed(1);
      out.push(`<g data-stroke="accent">${st.glyph(x, centerY + py * ry, number === 1 ? 1.5 : 1)}</g>`);
    }
    if (number === 1) {
      out.push(rays(CX, centerY, 96, 138, 12, 2.4));
    }
    if (number >= 6) {
      out.push(`<g data-stroke="gold" opacity="0.5">${wave(CX - 84, CX + 84, 452, 6, 6)}</g>`);
    }
  } else {
    // 宫廷牌：一位人物 + 该花色的象征物
    out.push(`<path d="M ${CX - 86} 452 q 86 -34 172 0" fill="none" opacity="0.45"/>`);
    out.push(figure(CX, 424, 150, { arms: number === 11 ? 'open' : 'one', crown: number === 14 }));
    const gx = CX + (number % 2 ? 82 : -82);
    out.push(`<g data-stroke="accent">${st.glyph(gx, 300, number === 14 ? 1.1 : 0.9)}</g>`);
    out.push(`<g data-fill="accent" stroke="none" opacity="0.85">${sparkle(CX - (number % 2 ? 80 : -80), 220, 9)}</g>`);
    out.push(`<g data-fill="gold" stroke="none" opacity="0.7">${sparkle(CX, 132, 13)}</g>`);
    out.push(rays(CX, 132, 18, 40, 12, 2.2));
  }
  return out.join('');
}

/* ───────── 渲染 ───────── */

const ARIA_LABEL = {};

/* 顶部序号带的取值风格。大阿卡纳一律用罗马数字（这是通例，0~XXI）。
   小阿卡纳按韦特原版（Rider-Waite-Smith，1909）的惯例：
     · Ace~Ten 顶部也是**罗马数字** I~X，不是阿拉伯数字；
     · 宫廷牌**本来就不标号**，只有下方牌名。

   classic    旧版：阿拉伯数字 1~10 / 宫廷牌取中文首字（侍骑后王）
   rws        韦特原版：I~X 罗马数字；宫廷牌**不标号**
   rwsLetter  同上，但宫廷牌标拉丁首字母 P / N / Q / K
   latin      同上，但宫廷牌标完整英文 PAGE / KNIGHT / QUEEN / KING  ← 当前默认 */
const COURT_LETTER = { 11: 'P', 12: 'N', 13: 'Q', 14: 'K' };
const COURT_LETTER2 = { 11: 'P', 12: 'KN', 13: 'Q', 14: 'K' };
const COURT_WORD = { 11: 'PAGE', 12: 'KNIGHT', 13: 'QUEEN', 14: 'KING' };

export const BADGE_STYLES = ['classic', 'rws', 'rwsLetter', 'rwsKN', 'latin'];

function badgeFor(card, style) {
  if (card.arcana === 'major') return roman(card.number);
  if (card.number <= 10) {
    return style === 'classic' ? String(card.number) : roman(card.number);
  }
  switch (style) {
    case 'rws': return '';
    case 'latin': return COURT_WORD[card.number];
    case 'rwsLetter': return COURT_LETTER[card.number];
    case 'rwsKN': return COURT_LETTER2[card.number];
    default: return COURT_MARK[card.number];
  }
}

/**
 * 渲染一张牌的正面 SVG 字符串
 * @param {{id:string,name:string,arcana:string,suit:string,number:number}} card
 * @param {{badge?:'classic'|'rws'|'rwsLetter'|'latin', uid?:string, artSrc?:string}} [opts]
 *        badge  顶部序号带的取值风格
 *        uid    本次渲染的唯一后缀，保证 SVG 内部 id 不撞车
 *        artSrc 底图来源覆盖；传空串表示「先不加载底图」（图鉴骨架态）
 */
export function renderCardFront(card, opts = {}) {
  const isMajor = card.arcana === 'major';
  /* SVG 内部的 id 必须全局唯一。同一张牌会被渲染多次（扇形里点开的那张 + 解读页那张
     + 图鉴里那张），而 url(#…) 只认文档中第一个同 id 元素——若它落在 display:none
     的屏幕里，Chromium 会判定引用失效，于是金框 / 铭牌 / 圆角裁切 / 顶部渐隐整块消失，
     只有字面色（文字、徽标胶囊、插画本身）还在。
     调用方传 opts.uid 让每次渲染各自独立即可。 */
  const K = opts.uid ? `${card.id}--${opts.uid}` : card.id;
  const palette = isMajor
    ? MAJOR_PALETTE[card.number] || MAJOR_PALETTE[0]
    : [SUIT_STYLE[card.suit].deep, shade(SUIT_STYLE[card.suit].deep, 22), '#050912', SUIT_STYLE[card.suit].accent];

  const numLabel = badgeFor(card, opts.badge || 'latin');
  /* 罗马数字一律同号，保证大阿卡纳与小阿卡纳的序号视觉一致；
     只有 latin 风格的完整英文词（PAGE / QUEEN / KNIGHT）才缩小以塞进胶囊。 */
  const wordBadge = opts.badge === 'latin' && !isMajor && card.number > 10;
  const badgeSize = wordBadge ? (numLabel.length > 5 ? 13 : 14) : 16;
  const badgeTrack = wordBadge ? 2 : 2.4;
  const badgeW = numLabel.length * (badgeSize * 0.8 + badgeTrack) + 26;
  /* 胶囊 y=34 高 31，按大写高度 0.71em 垂直居中 */
  const badgeY = 34 + (31 + 0.71 * badgeSize) / 2;
  /* 两侧星芒跟着胶囊宽度外移，否则宽胶囊（KNIGHT）会把它们盖住。
     装饰带横线是 x 44~256，上限取 96 保证不越界。 */
  const sparkleDx = Math.min(96, badgeW / 2 + 12);

  /* 底图来源：默认查卡面清单；调用方可用 opts.artSrc 覆盖（图鉴传缩略图）。
     传空串 = 骨架态：输出一个不带 href 的 <image>，浏览器不会发任何请求，
     之后由调用方 setAttribute('href', …) 补图。
     注意不能写成 href=""——空字符串会被解析成当前文档地址，反而多一次页面请求。 */
  const artSrc = opts.artSrc !== undefined ? opts.artSrc : artUrl(card.id);
  const artPending = opts.artSrc === '';
  const useArt = artPending || !!artSrc;

  /* 卡面名字：英文为主（Cinzel 罗马碑刻体），中文作为小字补充 */
  const nameEn = card.en || card.name;
  const nameSize = nameEn.length > 18 ? 12 : nameEn.length > 13 ? 13.5 : nameEn.length > 9 ? 15.5 : 17;

  const scene = isMajor ? SCENES[card.number]() : minorScene(card.suit, card.number);

  const skyId = `sky-${K}`;
  const glowId = `glow-${K}`;
  const p = palette;
  const plateTop = 428;
  const ruleTop = 436;
  const ruleBottom = 490;
  const romanFont = "'Cinzel', 'Noto Serif SC', Georgia, serif";
  const insFont = "'Cormorant Garamond', 'Cinzel', Georgia, serif";

  /* 铭牌文字三条基线的排布（卡面 viewBox 高 520）：
       花色小字  y=445   font 8.4
       大字牌名  y=459   font nameSize(12~17)
       中文牌名  y=482   font 13
     花色小字必须落在 459 − 0.71 × nameSize 之上，否则会被大字的大写高度盖住。
     最大 nameSize=17 → 上限 446.93，取 445 留 1.93 间隙。 */
  const suitBaseline = 445;

  return `
<svg class="card-art" viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="${card.name}" preserveAspectRatio="xMidYMid meet"
     style="--gold:${p[3]};--gold-deep:#c9a45c;--ink:#050912;--accent:${p[3]};--robe:${p[1]};--veil:${p[3]};--blade:#e6ecff;--leaf:${p[3]}">
  <defs>
    <linearGradient id="${skyId}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${p[0]}"/>
      <stop offset="55%" stop-color="${p[1]}"/>
      <stop offset="100%" stop-color="${p[2]}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="${p[3]}" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="${p[3]}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${p[3]}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="frame-${K}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6e6bb"/>
      <stop offset="34%" stop-color="#cfa859"/>
      <stop offset="62%" stop-color="#8a6a2c"/>
      <stop offset="100%" stop-color="#e8c98a"/>
    </linearGradient>
    <linearGradient id="plate-${K}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="rgba(10,14,32,0.93)"/>
      <stop offset="100%" stop-color="rgba(4,7,18,0.96)"/>
    </linearGradient>
    <clipPath id="artclip-${K}">
      <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="16"/>
    </clipPath>
    <linearGradient id="artfade-top-${K}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p[2]}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${p[2]}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="artfade-bottom-${K}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p[2]}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${p[2]}" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="soft-${K}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .scene-${K} [data-fill="gold"]{fill:var(--gold);stroke:none}
      .scene-${K} [data-fill="accent"]{fill:var(--accent);stroke:none}
      .scene-${K} [data-fill="robe"]{fill:var(--robe);stroke:var(--gold)}
      .scene-${K} [data-fill="veil"]{fill:var(--veil);stroke:none;opacity:.5}
      .scene-${K} [data-fill="blade"]{fill:var(--blade);stroke:var(--gold)}
      .scene-${K} [data-fill="leaf"]{fill:var(--leaf);stroke:none}
      .scene-${K} [data-ink="gold"]{stroke:var(--gold);fill:none}
      .scene-${K} [data-stroke="accent"]{stroke:var(--accent);fill:none}
    </style>
  </defs>

  <!-- 底色 -->
  <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="18" fill="url(#${skyId})"/>
  <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="18" fill="url(#${glowId})"/>

  ${useArt ? `
  <!-- 插画底图：必须放在 defs 之后引用 clipPath，否则整块渲染失败 -->
  <g class="art-image" clip-path="url(#artclip-${K})">
    <image${artPending ? '' : ` href="${artSrc}"`} x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}"
           preserveAspectRatio="xMidYMin slice"/>
    <rect x="4" y="4" width="${CARD_W - 8}" height="92" fill="url(#artfade-top-${K})"/>
  </g>` : `
  <!-- 牌面内的星空 -->
  <g class="art-dust">${backgroundStars(dust(isMajor ? 26 : 16, card.number * 977 + (isMajor ? 11 : 97)))}</g>

  <!-- 大阿卡纳：鲸鱼娘角色。脚底落在牌外，裙摆被下方铭牌压住，形成前后层次 -->
  ${isMajor && CHAR[card.number]
    ? renderCharacterSVG(card.id, CHAR[card.number], { cx: CX, baseY: 548, scale: 0.70 })
    : ''}

  <!-- 中心场景 -->
  <g class="art-scene scene-${K}" stroke="var(--gold)" fill="none" stroke-width="2.2"
     stroke-linecap="round" stroke-linejoin="round" filter="url(#soft-${K})" opacity="${isMajor ? 0.6 : 1}">
    ${scene}
  </g>

  <!-- 内侧细密纹样带 -->
  <g class="art-band" fill="none" stroke="var(--gold)" opacity="0.42" stroke-width="1.1">${starDustBand()}</g>`}

  <!-- 顶部序号带（深色底牌保证浅色卡上的可读性） -->
  <g class="art-topband">
    <path d="M 44 62 L ${CARD_W - 44} 62" stroke="url(#frame-${K})" stroke-width="1" opacity="0.55" fill="none"/>
    <g fill="url(#frame-${K})" opacity="0.9">
      ${sparkle(CX - sparkleDx, 54, 3.4)}${sparkle(CX + sparkleDx, 54, 3.4)}
    </g>
    ${numLabel ? `<path d="M ${CX} 40 L ${CX} 50" stroke="url(#frame-${K})" stroke-width="0.9" opacity="0.5" fill="none"/>
    <rect x="${(CX - badgeW / 2).toFixed(1)}" y="34" width="${badgeW.toFixed(1)}" height="31" rx="9"
          fill="rgba(5,8,20,0.8)" stroke="url(#frame-${K})" stroke-width="1"/>
    <text x="${CX}" y="${badgeY.toFixed(1)}" text-anchor="middle" font-family="${romanFont}" font-weight="600"
          font-size="${badgeSize}" letter-spacing="${badgeTrack}" fill="#f6e6bb">${numLabel}</text>` : ''}
  </g>

  <!-- 牌框 -->
  <g class="art-frame" fill="none" stroke="url(#frame-${K})">
    <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="16" stroke-width="3.4"/>
    <rect x="12" y="12" width="${CARD_W - 24}" height="${CARD_H - 24}" rx="11" stroke-width="1.2" opacity="0.85"/>
    <rect x="19" y="19" width="${CARD_W - 38}" height="${CARD_H - 38}" rx="8" stroke-width="0.9" opacity="0.5"/>
    ${cornerFlourish()}
  </g>

  <!-- 铭牌：大字英文牌名 + 小字中文与花色 -->
  <g class="art-plate">
    <rect x="26" y="${plateTop}" width="${CARD_W - 52}" height="${CARD_H - 26 - plateTop}" rx="7"
          fill="url(#plate-${K})" stroke="url(#frame-${K})" stroke-width="1.4"/>
    <rect x="31" y="${ruleTop}" width="${CARD_W - 62}" height="${ruleBottom - ruleTop}" rx="4"
          fill="none" stroke="url(#frame-${K})" stroke-width="0.8" opacity="0.6"/>
    <path d="M 26 464 L ${CARD_W - 26} 464" stroke="url(#frame-${K})" stroke-width="0.7" opacity="0.45" fill="none"/>
    <g fill="url(#frame-${K})" opacity="0.85">
      ${sparkle(40, 464, 3.2)}${sparkle(CARD_W - 40, 464, 3.2)}
      ${sparkle(40, plateTop + 8, 2.6)}${sparkle(CARD_W - 40, plateTop + 8, 2.6)}
    </g>

    <text x="${CX}" y="459" text-anchor="middle" font-family="${romanFont}" font-weight="600"
          font-size="${nameSize}" letter-spacing="${nameSize > 15 ? 1.6 : 1.1}" fill="#f6e6bb">${nameEn.toUpperCase()}</text>
    ${isMajor ? '' : `<text x="${CX}" y="${suitBaseline}" text-anchor="middle" font-family="${insFont}"
          font-size="8.4" letter-spacing="3.4" fill="url(#frame-${K})" opacity="0.8">${card.suitNameEn.toUpperCase()}</text>`}
    <text x="${CX}" y="482" text-anchor="middle" font-family="'Noto Serif SC', Georgia, serif"
          font-size="13" letter-spacing="3.2" fill="#e8c98a" opacity="0.9">${card.name}</text>
  </g>
</svg>`;
}

/* 颜色加亮工具 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
