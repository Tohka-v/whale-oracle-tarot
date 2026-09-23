/* ===========================================================
   ui.js · DOM 构建工具（卡牌元素 / 卡槽 / 标签）
   牌背使用共享 <symbol> + <use>，避免每张牌重复解析整份 SVG
   （扇形 21 张 + 洗牌克隆时这是主要的性能瓶颈）
   =========================================================== */

import { renderCardFront } from '../art/card-art.js';
import { cardBackMarkup } from '../art/whale-back.js';

const BACK_MARKUP = cardBackMarkup();

/* 每次渲染牌面都给一个唯一 uid：同一张牌可能在扇形、解读页、图鉴里各渲染一份，
   若 SVG 内部 id 相同，url(#…) 会解析到第一个（可能落在 display:none 的屏幕里）而失效。 */
let faceUid = 0;
const nextUid = () => `u${(faceUid += 1)}`;

/**
 * 构建一张可翻面的卡牌元素
 * @param {object|null} card 传入牌数据则正面为牌面，否则正面留空
 * @param {{artSrc?:string}} [opts] 透传给 renderCardFront；artSrc 传空串可先不加载底图
 */
export function createCard(card, opts) {
  const el = document.createElement('div');
  el.className = 'card';
  if (card) el.dataset.cardId = card.id;
  el.innerHTML = `
    <div class="card__inner">
      <div class="card__face card__face--back">${BACK_MARKUP}</div>
      <div class="card__face card__face--front">${card ? renderCardFront(card, { uid: nextUid(), ...opts }) : ''}</div>
    </div>`;
  return el;
}

/** 已翻开并落位的牌（含逆位） */
export function createFaceCard(card, reversed, opts) {
  const el = createCard(card, opts);
  el.classList.add('is-flipped');
  if (reversed) el.classList.add('is-reversed');
  return el;
}

/** 小尺寸牌（详情浮层用） */
export function createMiniCard(card, reversed) {
  const el = document.createElement('div');
  el.className = `mini-card${reversed ? ' is-reversed' : ''}`;
  el.innerHTML = renderCardFront(card, { uid: nextUid() });
  return el;
}

/** 抽牌台上方的牌位指示条 */
export function createSlotMini(index, position) {
  const el = document.createElement('div');
  el.className = 'slot-mini';
  el.dataset.slot = String(index);
  el.innerHTML = `<span class="slot-mini__idx">${index + 1}</span><span>${position.name}</span>`;
  return el;
}

export function setSlotMiniState(el, filled) {
  if (!el) return;
  el.classList.toggle('is-filled', !!filled);
}

/** 通用元素工厂 */
export function h(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html != null) el.innerHTML = html;
  return el;
}
