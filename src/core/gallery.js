/* ===========================================================
   gallery.js · 卡面图鉴
   · 78 张牌面按「大阿卡纳 / 四个花色」分组浏览
   · 可整体翻到牌背、可切换正位 / 逆位
   · 点任意一张放大，支持左右切换
   =========================================================== */

import { DECK, SUITS } from '../data/deck.js';
import { artThumbUrl } from '../data/art-manifest.js';
import { createCard, createFaceCard, h } from './ui.js';
import { sfx } from './sound.js';

const GROUPS = [
  { key: 'all', label: '全部', count: DECK.length },
  { key: 'major', label: '大阿卡纳', count: 22 },
  ...SUITS.map((s) => ({ key: s.key, label: s.name, count: 14 })),
];

let filter = 'all';
let showBack = false;
let showReversed = false;
let zoomIndex = 0;
let dom = null;
let modalApi = null;

export function initGallery(ids, api) {
  dom = ids;
  modalApi = api || null;
  renderFilters();
  bind();
}

/* 浮层统一走 main.js 的 openModal：那里负责把焦点移进浮层、锁滚动，
   关闭时再把焦点还给触发元素。没传就退回原来的朴素实现。 */
function showModal(el) {
  if (modalApi?.openModal) { modalApi.openModal(el); return; }
  el.hidden = false;
  document.body.classList.add('is-locked');
  el.querySelector('.modal__panel')?.scrollTo({ top: 0 });
}

function bind() {
  dom.galleryBtn.addEventListener('click', () => { sfx.click(); openGallery(); });

  dom.galleryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.gallery__filter');
    if (!btn) return;
    filter = btn.dataset.key;
    for (const b of dom.galleryFilters.children) {
      b.setAttribute('aria-pressed', String(b.dataset.key === filter));
    }
    sfx.click();
    renderGrid();
  });

  dom.galleryFlip.addEventListener('click', () => {
    showBack = !showBack;
    dom.galleryFlip.setAttribute('aria-pressed', String(showBack));
    dom.galleryFlip.textContent = showBack ? '翻回牌面' : '翻到牌背';
    sfx.flip();
    renderGrid();
  });

  dom.galleryRev.addEventListener('click', () => {
    showReversed = !showReversed;
    dom.galleryRev.setAttribute('aria-pressed', String(showReversed));
    sfx.flip();
    renderGrid();
    if (!dom.zoomModal.hidden) paintZoom();
  });

  dom.galleryGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery__item');
    if (item) openZoom(Number(item.dataset.index));
  });

  dom.zoomPrev.addEventListener('click', () => stepZoom(-1));
  dom.zoomNext.addEventListener('click', () => stepZoom(1));
}

function openGallery() {
  renderGrid();
  showModal(dom.galleryModal);
  /* renderGrid 里那次调用发生在面板还隐藏时，观察者收不到回调，这里重来一次 */
  observeThumbs();
}

function renderFilters() {
  dom.galleryFilters.innerHTML = '';
  for (const g of GROUPS) {
    const b = h('button', 'gallery__filter', `${g.label}<span style="opacity:.5"> ${g.count}</span>`);
    b.type = 'button';
    b.dataset.key = g.key;
    b.setAttribute('aria-pressed', String(g.key === 'all'));
    dom.galleryFilters.appendChild(b);
  }
}

/** 当前筛选下的牌列表（放大后左右切换用） */
function currentList() {
  if (filter === 'all') return DECK;
  if (filter === 'major') return DECK.filter((c) => c.arcana === 'major');
  return DECK.filter((c) => c.suit === filter);
}

/**
 * @param {object} card
 * @param {boolean} [lazy] 图鉴网格专用：先渲染不带底图的骨架，等滚进视口
 *        再挂 216px 缩略图。全尺寸原图约 260 KB，78 张一起加载会让
 *        「打开图鉴」变成 20 MB 的请求；缩略图全部加起来才 1.3 MB。
 */
function makeCardEl(card, lazy = false) {
  if (showBack) return createCard(null);
  if (!lazy) return createFaceCard(card, showReversed);
  const el = createFaceCard(card, showReversed, { artSrc: '' });
  el.dataset.thumbSrc = artThumbUrl(card.id) || '';
  return el;
}

/* ───────── 缩略图懒加载 ───────── */
let thumbObserver = null;

function observeThumbs() {
  thumbObserver?.disconnect();
  thumbObserver = null;
  /* 面板还隐藏时建立观察者不会收到任何回调，留到 openGallery 里再建 */
  if (dom.galleryModal.hidden) return;

  const load = (el) => {
    const src = el.dataset.thumbSrc;
    delete el.dataset.thumbSrc; // 移除属性，避免重复入选
    if (!src) return;
    const img = el.querySelector('.card__face--front image');
    /* 骨架态渲染的是一个没有 href 的 <image>（见 card-art.js），
       这里补上才会真正发起请求。 */
    if (img) img.setAttribute('href', src);
  };

  const cards = [...dom.galleryGrid.querySelectorAll('.card[data-thumb-src]')];
  if (!('IntersectionObserver' in window)) { cards.forEach(load); return; }

  thumbObserver = new IntersectionObserver((entries, io) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      load(e.target);
    }
  }, { root: dom.galleryModal.querySelector('.modal__panel'), rootMargin: '400px 0px' });

  for (const c of cards) thumbObserver.observe(c);
}

function renderGrid() {
  const grid = dom.galleryGrid;
  grid.innerHTML = '';
  const list = currentList();
  dom.galleryCount.textContent = `${list.length} 张${showReversed && !showBack ? ' · 逆位显示' : ''}`;

  const sections = filter === 'all'
    ? [{ title: '大阿卡纳 · MAJOR ARCANA', cards: DECK.filter((c) => c.arcana === 'major') },
       ...SUITS.map((s) => ({ title: `${s.name} · ${s.en.toUpperCase()}`, cards: DECK.filter((c) => c.suit === s.key) }))]
    : [{ title: '', cards: list }];

  for (const sec of sections) {
    if (sec.title) grid.appendChild(h('div', 'gallery__section-title', sec.title));
    for (const card of sec.cards) {
      const item = h('button', 'gallery__item');
      item.type = 'button';
      item.dataset.index = String(DECK.indexOf(card));
      item.title = `${card.name} · ${card.en}`;
      item.appendChild(makeCardEl(card, true));
      item.appendChild(h('span', 'gallery__name', card.en.toUpperCase()));
      item.appendChild(h('span', 'gallery__cn', card.name));
      grid.appendChild(item);
    }
  }
  observeThumbs();
}

/* ───────── 放大视图 ───────── */
function openZoom(index) {
  zoomIndex = index;
  paintZoom();
  showModal(dom.zoomModal);
  sfx.flip();
}

function stepZoom(delta) {
  const list = currentList();
  const card = DECK[zoomIndex];
  const pos = Math.max(0, list.findIndex((c) => c.id === card.id));
  const next = list[(pos + delta + list.length) % list.length];
  zoomIndex = DECK.indexOf(next);
  paintZoom();
  sfx.click();
}

function paintZoom() {
  const card = DECK[zoomIndex];
  if (!card) return;
  dom.zoomArt.innerHTML = '';
  dom.zoomArt.appendChild(makeCardEl(card));
  dom.zoomPos.textContent = card.arcana === 'major'
    ? `大阿卡纳 · ${String(card.number).padStart(2, '0')}`
    : `${card.suitName} · ${card.en.split(' of ')[0]}`;
  dom.zoomTitle.textContent = `${card.name} · ${card.en}`;
  dom.zoomMeta.textContent = showBack
    ? '牌背 · 鲸尾徽记'
    : `${card.element}元素 · ${card.arcana === 'major' ? '人生课题与阶段' : `${card.suitNameEn}（${card.suitName}）`}${showReversed && card.arcana !== 'major' ? ' · 逆位显示' : ''}`;
}
