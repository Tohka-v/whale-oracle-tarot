/* ===========================================================
   anim.js · 卡牌动效
   保留：翻牌、洗牌时牌库自身的动静、以及几个几何工具。
   =========================================================== */

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** 翻面 */
export function flipCard(cardEl, flipped = true, ms = 860) {
  const isFlipped = cardEl.classList.contains('is-flipped');
  if (isFlipped === flipped) return Promise.resolve();
  cardEl.classList.toggle('is-flipped', flipped);
  return reduce() ? Promise.resolve() : wait(ms);
}

/**
 * 洗牌视觉：牌库原地抖动 + 上下浮动（CSS 的 `.deck-pump`），不再飞出牌堆。
 *
 * 这里原先会克隆十来个牌背做「翻飞交错」的飞牌，三个问题：
 *   1. 飞牌是 position:fixed + z-index:200，会盖住标题和说明文字；
 *   2. 坐标取自 rectOf(deckEl)，而刚切到抽牌台时 .screen 还在入场动画里
 *      （translateY + blur），量出来的位置偏上，牌会飘到屏幕左上角；
 *   3. 观感上并不像「洗牌」，更像有东西从画面外飞过去。
 * 现在只保留牌库自身的动静：信息量一样够，也不再遮挡任何东西。
 *
 * 参数 count 保留是为了不破坏调用签名。
 */
export async function shuffleVisual(deckEl, count = 12, dur = 1300) {
  if (!deckEl) return;
  deckEl.classList.add('is-shuffling');
  await wait(reduce() ? 500 : dur);
  deckEl.classList.remove('is-shuffling');
}
