/* ===========================================================
   main.js · 星海鲸语塔罗占卜 · 流程控制
   方向 → 牌阵 → 洗牌抽牌 → 逐张翻牌 → 解读
   =========================================================== */

import { initSky } from './core/sky.js';
import { sfx, setEnabled, isEnabled } from './core/sound.js';
import * as FX from './core/fx.js';
import {
  wait, rectOf, flipCard, shuffleVisual,
} from './core/anim.js';
import { createCard, createFaceCard, createMiniCard, createSlotMini, setSlotMiniState, h } from './core/ui.js';
import { initGallery } from './core/gallery.js';
import { CATEGORIES, SPREADS, getCategory, getSpread } from './data/rules.js';
import { DECK, getCard } from './data/deck.js';
import { drawCards, buildReading, readOne } from './core/reading.js';
import { brandMark, mountCardDefs } from './art/whale-back.js';
import { initPWA } from './core/pwa.js';
import {
  saveSession, loadSession, clearSession, buildShareUrl, readShare, copyText,
} from './core/session.js';

/* ───────── 状态 ───────── */
const state = {
  category: null,
  spread: null,
  /* 称呼与问题：2026-09-24 起第一步底部的两个输入框已移除，这两个字段
     只在**打开旧分享链接**时被 restoreFrom() 填值，再原样传回 buildReading()
     与 snapshot()，因此老链接的「你的问题：…」和开场语仍然完整。
     正常流程下它们恒为空字符串。 */
  userName: '',
  question: '',
  picks: [],      // { deckIndex, cardId, reversed }
  shuffled: [],   // 78 张洗好的顺序
  fanCount: 21,
  busy: false,
  stageIndex: -1,
  seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
  reading: null,
};

const dom = {};
const $ = (id) => document.getElementById(id);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 真实视口宽度：优先用 clientWidth，避免滚动条 / 设备模拟下 innerWidth 失真 */
function viewportWidth() {
  return document.documentElement.clientWidth || window.innerWidth;
}

/** 等待 ms 毫秒，或者在被点击时提前结束——用于翻牌后挂着牌义的浮层。
    只在浮层里那个「继续 →」按钮上监听，不做全局拦截，
    否则用户想点下一张牌时会先被吞掉一次。 */
function waitOrSkip(ms, host) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    host?.querySelector('.reveal-caption__next')?.addEventListener('click', finish, { once: true });
  });
}

/* ───────── 随机 ───────── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────── 屏幕切换 ───────── */
function go(name) {
  for (const s of document.querySelectorAll('.screen')) {
    s.hidden = s.dataset.screen !== name;
  }
  document.body.dataset.screen = name;
  const target = document.querySelector(`.screen[data-screen="${name}"]`);
  if (target) {
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
  }
  window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  return target;
}

/* 顶栏品牌标记：优先用生成图（现在是用户自出的那版 mark-v4.webp），
   拿不到就退回手写矢量鲸鱼（brandMark()）。

   顺序是刻意的——**先挂矢量版，图片 onload 之后再替换**：
   直接渲染 <img> 的话，弱网下顶栏会空着一格，而这格是页面左上角
   最先被看到的东西。矢量版已经在文档里，回退是零成本的。
   用 WebP 而不是 PNG：256px 下前者 20 KB、后者 300 KB 以上，而顶栏只显示 48 CSS px，
   真要是不支持/加载失败，矢量回退比一张大 PNG 更清楚。
   同时 make-icons.mjs 会从 #brandMark 里抠节点，两种形态它都得认。

   换成 mark-v4 的原因见 tools/icon-art.mjs：那一版是用户自己出的，构图更好。
   这个 src 改名要跟 README 的「图标」一节一起改。 */
function mountBrandMark() {
  dom.brandMark.innerHTML = brandMark();
  const img = new Image();
  img.className = 'brand__img';
  img.alt = '';
  img.decoding = 'async';
  img.onload = () => dom.brandMark.replaceChildren(img);
  img.onerror = () => { /* 保持矢量版，不报错、不留空 */ };
  img.src = './assets/brand/mark-v4.webp';
}

/* ───────── 启动 ───────── */
function boot() {
  const ids = [
    'stars', 'app', 'catGrid', 'spreadGrid', 'spreadLede', 'toSpread', 'toDraw',
    'soundBtn', 'helpBtn', 'helpModal', 'helpDoc',
    'drawTitle', 'drawHint', 'progressBar', 'progress', 'progressLabel', 'reshuffleBtn',
    'deck', 'deckCaption', 'fan', 'fanCaption', 'spreadSlots', 'flipAllBtn', 'readingLayout',
    'readingTitle', 'readingSub', 'detailModal', 'detailCardArt', 'detailPos',
    'detailTitle', 'detailMeta', 'detailText', 'detailExtraWrap', 'detailExtraTitle',
    'detailExtra', 'detailTags', 'replayBtn', 'againBtn', 'brandMark',
    'detailNav', 'detailPrev', 'detailNext', 'detailNavCount',
    'galleryBtn', 'galleryModal', 'galleryGrid', 'galleryFilters', 'galleryFlip',
    'galleryRev', 'galleryCount', 'zoomModal', 'zoomArt', 'zoomPos', 'zoomTitle', 'zoomMeta',
    'zoomPrev', 'zoomNext', 'shareBtn',
  ];
  for (const id of ids) dom[id] = $(id);

  mountBrandMark();
  mountCardDefs();
  initSky(dom.stars);

  renderCategories();
  renderSpreads();
  renderHelp();
  bindGlobal();
  buildDeckPreview();
  initGallery({
    galleryBtn: dom.galleryBtn,
    galleryModal: dom.galleryModal,
    galleryGrid: dom.galleryGrid,
    galleryFilters: dom.galleryFilters,
    galleryFlip: dom.galleryFlip,
    galleryRev: dom.galleryRev,
    galleryCount: dom.galleryCount,
    zoomModal: dom.zoomModal,
    zoomArt: dom.zoomArt,
    zoomPos: dom.zoomPos,
    zoomTitle: dom.zoomTitle,
    zoomMeta: dom.zoomMeta,
    zoomPrev: dom.zoomPrev,
    zoomNext: dom.zoomNext,
  }, { openModal, closeModal });
  initPWA();

  /* 优先用分享链接（#r=…），否则看有没有刷新前的局面。
     分享数据只做「一次性还原」——用完就把 hash 清掉，
     否则之后每次刷新都会回到分享时那一刻，而不是最新牌局。 */
  const shared = readShare();
  if (restoreFrom(shared) || restoreFrom(loadSession())) {
    if (shared) history.replaceState(null, '', location.pathname);
    persist();
  } else {
    go('category');
  }
}

/* ───────── 方向 ───────── */
/* 「同一个选项再点一次」= 确认并进入下一步。
   手机上选完方向还得滑到页底去找主按钮，多一次定位成本；连点两次就能
   直接往下走。第一次点击仍然只做选中，所以既不会误触前进，也不影响
   「先点 A 看看、再改点 B」的用法。 */
const SECOND_TAP_MS = 1600;
let lastTap = { tag: '', at: 0 };

function isSecondTap(kind, key) {
  const tag = `${kind}:${key}`;
  const now = Date.now();
  const hit = state[kind] === key && lastTap.tag === tag && now - lastTap.at < SECOND_TAP_MS;
  lastTap = { tag, at: now };
  return hit;
}

/** 每个步骤只提示一次：这是发现性引导，不是每次都得念的规则。
    用 toast 而不是在页脚常驻一行字——手机上那行字会把常驻按钮栏顶高一截。 */
const tapHinted = new Set();

function hintSecondTap(kind, name, next) {
  if (tapHinted.has(kind)) return;
  tapHinted.add(kind);
  FX.toast(`已选「${name}」· 再点一次直接${next}`, 2600);
}

function renderCategories() {
  dom.catGrid.innerHTML = '';
  for (const c of CATEGORIES) {
    const btn = h('button', 'cat');
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.key = c.key;
    btn.innerHTML = `
      <span class="cat__name">${c.name}</span>
      <span class="cat__en">${c.en}</span>
      <span class="cat__desc">${c.desc}</span>`;
    btn.addEventListener('click', () => selectCategory(c.key));
    dom.catGrid.appendChild(btn);
  }
}

function selectCategory(key) {
  const second = isSecondTap('category', key);
  state.category = key;
  const c = getCategory(key);
  for (const b of dom.catGrid.children) b.setAttribute('aria-pressed', String(b.dataset.key === key));
  dom.toSpread.textContent = `以「${c.name}」起卦，选牌阵 →`;
  dom.toSpread.disabled = false;
  sfx.click();
  if (second) go('spread');
  else hintSecondTap('category', c.name, '进入牌阵');
}

/* ───────── 牌阵 ───────── */
function renderSpreads() {
  dom.spreadGrid.innerHTML = '';
  for (const s of SPREADS) {
    const btn = h('button', 'spread');
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.key = s.key;
    btn.innerHTML = `
      <span class="spread__top">
        <span class="spread__name">${s.name}</span>
        <span class="spread__count">${s.count} 张 · ${s.en}</span>
      </span>
      <span class="spread__desc">${s.desc}</span>
      <span class="spread__slots">${s.positions
        .map((p, i) => `<span class="chip${i === 0 ? ' chip--gold' : ''}">${i + 1} ${p.name}</span>`)
        .join('')}</span>`;
    btn.addEventListener('click', () => selectSpread(s.key));
    dom.spreadGrid.appendChild(btn);
  }
}

function selectSpread(key) {
  const second = isSecondTap('spread', key);
  state.spread = key;
  for (const b of dom.spreadGrid.children) b.setAttribute('aria-pressed', String(b.dataset.key === key));
  sfx.click();
  if (second) startDraw();
  else hintSecondTap('spread', getSpread(key).name, '开始洗牌');
}

/** 「洗牌并抽牌」：页脚按钮与「连点两次牌阵」共用同一条路径。
    加一把锁是因为连点第二次之后，页脚那颗按钮还在原位，紧接着再点一次
    就会叠起第二遍洗牌动画（两次 runShuffle 的 await 交错）。 */
let shuffling = false;
async function startDraw() {
  if (!state.category) { FX.toast('请先选择占卜方向'); return; }
  if (!state.spread) { FX.toast('请先选择一个牌阵'); sfx.error(); return; }
  if (shuffling) return;
  shuffling = true;
  sfx.click();
  try {
    await runShuffle({ fresh: true });
  } finally {
    shuffling = false;
  }
}

/* ───────── 牌库视觉 ───────── */
function buildDeckPreview() {
  dom.deck.innerHTML = '';
  const layers = 4;
  for (let i = layers; i >= 1; i--) {
    const l = h('div', 'deck__layer');
    l.style.transform = `translate(${i * 1.7}px, ${-i * 2.3}px) rotate(${(i - 2) * 0.8}deg)`;
    l.style.zIndex = String(layers - i + 1);
    const c = createCard(null);
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.cursor = 'default';
    l.appendChild(c);
    dom.deck.appendChild(l);
  }
  const top = createCard(null);
  top.classList.add('deck__layer');
  top.style.zIndex = '10';
  top.style.cursor = 'default';
  dom.deck.appendChild(top);
  dom.deck.appendChild(h('div', 'deck__glow'));
  dom.deckCaption.textContent = `星海鲸语 · ${DECK.length} 张 · 牌背为鲸鱼娘徽记`;
}

/* ───────── 抽牌阶段 ───────── */
/** 抽牌台实际使用的卡片尺寸与间距。
    不能读 :root 的 --card-w——宽屏下 .screen--table 会把它覆盖成 0.8 倍，
    所以这里从屏幕元素上取，高度按卡面比例 300:520 推导。 */
function drawCardMetrics() {
  const stage = document.getElementById('screen-draw');
  const cs = getComputedStyle(stage || document.documentElement);
  const w = parseFloat(cs.getPropertyValue('--card-w')) || 132;
  const h = w * 520 / 300;
  return {
    w,
    h,
    gapX: Math.max(6, Math.round(w * 0.1)),
    gapY: Math.max(6, Math.round(h * 0.06)),
  };
}

/** 抽牌台一行能放几张牌 */
function fanColsForViewport() {
  const { w: cardW, gapX } = drawCardMetrics();
  /* 用 .fan 的实测宽度，而不是「视口宽 - 40」：两者口径不同，会让 JS 算出的
     列数与 CSS 实际排布对不上。.fan-grid 左右各有 2px padding，要扣掉。 */
  const fanW = dom.fan?.getBoundingClientRect().width || 0;
  const avail = fanW > 0 ? fanW - 4 : Math.max(240, viewportWidth() - 40);
  return Math.max(3, Math.floor((avail + gapX) / (cardW + gapX)));
}

/* 平铺张数：行数受可用高度约束，且张数永远取列数的整数倍。
   早先只按宽度算行数、再用 Math.max(9, …) 兜底，结果一行放 7 张时被强行凑到
   9 张，最后一行只剩 2 张、右边空一大块，看着像牌没铺好。 */
function fanCountForViewport() {
  const { h: cardH, gapY } = drawCardMetrics();
  const perRow = fanColsForViewport();

  /* 顶部与底部占位实测，而不是拍一个常数：牌库、标题、牌位条的高度
     在不同断点差别很大，硬编码会让某些视口算多、某些算少。 */
  const hOf = (sel) => document.querySelector(sel)?.getBoundingClientRect().height || 0;
  const chrome = hOf('.topbar') + hOf('.table-head') + hOf('.deck-area')
    + hOf('.fan-caption') + hOf('.table-foot') + 34;
  const availH = Math.max(cardH, window.innerHeight - chrome);
  const fitRows = Math.max(1, Math.min(4, Math.floor((availH + gapY) / (cardH + gapY))));

  /* 能少排就少排；但候选不足 9 张时宁可轻微滚动（七牌阵要选 7 次，
     候选太少就没有「从一堆牌里挑」的感觉了） */
  let rows = fitRows;
  while (perRow * rows < 9 && rows < 4) rows++;
  /* 总张数上限 21，且按整行截断，不能出现半行 */
  rows = Math.min(rows, Math.max(1, Math.floor(21 / perRow)));
  return perRow * rows;
}

function beginDraw({ seed, fanCount } = {}) {
  state.seed = seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const rng = mulberry32(state.seed);
  state.shuffled = drawCards(rng, DECK.length, true);
  state.picks = [];
  state.stageIndex = -1;
  state.fanCount = fanCount ?? fanCountForViewport();
  buildFan();
  renderSlotMinis();
  updateProgress();
  dom.flipAllBtn.hidden = true;
  dom.reshuffleBtn.hidden = true;
  resetReshuffleArm();
}

/* 铺牌：等距平铺网格。刻意不用重叠扇形——
   重叠布局里指针停在两牌交界处会不断在「抬起→盖住→换人」之间循环，
   表现为抽搐；平铺后每张牌有独立热区，根本不会争抢。 */
function layoutFan() {
  const n = state.fanCount;
  dom.fan.innerHTML = '';
  const { gapX, gapY } = drawCardMetrics();
  const shell = h('div', 'fan-grid');
  shell.style.gap = `${gapY}px ${gapX}px`;
  /* 列数由 JS 决定并写进 CSS 变量，这样张数永远是列数的整数倍，不会留半行 */
  shell.style.setProperty('--fan-cols', String(fanColsForViewport()));
  shell.style.animationDelay = '0ms';
  dom.fan.style.height = 'auto';

  for (let i = 0; i < n; i++) {
    const el = createCard(null);
    el.classList.add('is-hoverable');
    el.dataset.deckIndex = String(i);
    el.style.animationDelay = `${Math.min(i * 16, 320)}ms`;
    /* 键盘可达：牌是 <div>，不加 role/tabindex 的话整个抽牌步骤用键盘
       完全走不通——实测 21 张牌可聚焦数为 0。 */
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `第 ${i + 1} 张牌，未翻开`);
    const act = () => pickCard(el, i);
    el.addEventListener('click', act);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation(); // 别让 document 上的空格快捷键再触发「全部翻开」
        act();
      }
    });
    el.addEventListener('pointerenter', () => {
      if (!el.classList.contains('is-picked')) sfx.hover();
    }, { passive: true });
    shell.appendChild(el);
  }
  dom.fan.appendChild(shell);
}

/** 兼容旧调用名 */
const buildFan = layoutFan;

function renderSlotMinis() {
  const spread = getSpread(state.spread);
  dom.spreadSlots.innerHTML = '';
  spread.positions.forEach((p, i) => dom.spreadSlots.appendChild(createSlotMini(i, p)));
}

/** 把某个牌位标记为已填并挂上牌名胶囊（现场抽牌与恢复局面共用） */
function markSlotFilled(slotIndex, card, reversed) {
  const targetEl = dom.spreadSlots.querySelector(`[data-slot="${slotIndex}"]`);
  if (!targetEl) return;
  setSlotMiniState(targetEl, true);
  const chip = h('span', 'chip chip--gold');
  chip.style.marginLeft = 'auto';
  chip.textContent = `${card.name}${reversed ? ' · 逆' : ''}`;
  targetEl.appendChild(chip);
}

function updateProgress() {
  const spread = getSpread(state.spread);
  const done = state.picks.length;
  const pct = spread.count ? (done / spread.count) * 100 : 0;
  dom.progressBar.style.width = `${pct}%`;
  dom.progressLabel.textContent = `${done} / ${spread.count}`;
  dom.progress.setAttribute('aria-valuenow', String(Math.round(pct)));
}

async function pickCard(cardEl, fanIndex) {
  const spread = getSpread(state.spread);
  if (state.busy || state.picks.length >= spread.count || cardEl.classList.contains('is-picked')) return;
  state.busy = true;
  sfx.draw();

  const slotIndex = state.picks.length;
  const draw = state.shuffled[fanIndex];
  const card = getCard(DECK[draw.deckIndex].id);
  const pos = spread.positions[slotIndex];

  /* 原地翻开：不飞、不挪位，掀开后在牌上方浮出牌位信息与牌义，停留 3–5 秒 */
  cardEl.classList.add('is-picked', 'is-revealing');
  cardEl.dataset.cardId = card.id;
  const front = cardEl.querySelector('.card__face--front');
  front.innerHTML = createFaceCard(card, draw.reversed).querySelector('.card__face--front').innerHTML;

  await wait(60);
  await flipCard(cardEl, true, 820);

  sfx.reveal(slotIndex);
  FX.glowFlash(cardEl, 900);
  const rc = rectOf(cardEl);
  FX.sparkBurst(rc.x + rc.w / 2, rc.y + rc.h * 0.4, 22, { spread: 170 });
  FX.ripple(rc.x + rc.w / 2, rc.y + rc.h * 0.4, rc.w * 0.7);

  const read = readOne({ cardId: card.id, reversed: draw.reversed }, pos, state.category);
  /* 浮层挂到 body：卡片所在的 .screen 带 transform 动画，
     会让 fixed 定位的祖先变成包含块，导致浮层错位或被裁剪 */
  const caption = h('div', 'reveal-caption');
  caption.innerHTML = `
    <span class="reveal-caption__pos">第 ${slotIndex + 1} 位 · ${pos.name}</span>
    <b>${card.name}<i class="${draw.reversed ? 'is-rev' : ''}">${draw.reversed ? '逆位' : '正位'}</i></b>
    <p>${escapeHTML(read.text)}</p>
    <span class="reveal-caption__keys">${read.keywords.join(' · ')}</span>
    <button class="reveal-caption__next" type="button">继续 →</button>`;
  document.body.appendChild(caption);

  dom.drawHint.innerHTML = `已翻开 <b>${card.name}${draw.reversed ? '（逆）' : ''}</b>　·　${pos.name}`;

  /* 停留时长：牌越多越短，比早先各减了约 1.4 秒——牌义一眼就能读完，
     硬等 5 秒很难受。想更快可以直接点浮层上的「继续 →」。 */
  const hold = spread.count >= 7 ? 2200 : spread.count >= 5 ? 2800 : 3600;
  await waitOrSkip(hold, caption);

  cardEl.classList.remove('is-revealing');
  caption.classList.add('is-out');
  await wait(320);
  caption.remove();

  /* 记录结果 */
  state.picks.push({
    fanIndex, deckIndex: draw.deckIndex, cardId: card.id, reversed: draw.reversed,
  });
  state.stageIndex = slotIndex;
  markSlotFilled(slotIndex, card, draw.reversed);
  /* 进度必须在这里更新：早先它被放在翻牌动画之前，而那一刻这张牌还没进 picks，
     于是进度条永远比牌位条少 1——抽满 3 张却显示 2/3，最后一格永远亮不起来。 */
  updateProgress();
  cardEl.setAttribute('aria-label',
    `第 ${fanIndex + 1} 张牌，已翻开：${card.name}${draw.reversed ? '（逆位）' : '（正位）'}`);
  cardEl.setAttribute('aria-disabled', 'true');
  cardEl.setAttribute('tabindex', '-1');
  persist();
  state.busy = false;

  if (state.picks.length >= spread.count) {
    dom.drawTitle.textContent = '牌已到齐';
    dom.drawHint.innerHTML = '所有牌位都已就位。点击 <b>全部翻开</b>，或按空格键，查看完整解读。';
    dom.flipAllBtn.hidden = false;
    dom.reshuffleBtn.hidden = false;
    sfx.complete();
    FX.starRain(32, 2000);
  } else {
    const left = spread.count - state.picks.length;
    dom.drawHint.innerHTML = `已选 <b>${state.picks.length}</b> 张，还需 <b>${left}</b> 张。继续凭直觉选择。`;
    updateFanCaption();
  }
}

/* ───────── 解读阶段 ───────── */
async function revealAll() {
  const spread = getSpread(state.spread);
  if (state.busy || state.picks.length < spread.count) return;
  state.busy = true;
  dom.flipAllBtn.disabled = true;

  state.reading = buildReading({
    picks: state.picks.map((p) => ({ cardId: p.cardId, reversed: p.reversed })),
    spread,
    categoryKey: state.category,
    userName: state.userName,
    question: state.question,
  });

  go('reading');
  await renderReading();
  state.busy = false;
  dom.flipAllBtn.disabled = false;
}

async function renderReading() {
  const r = state.reading;
  // 窄屏（<820px）不走桌面坐标：列数由 CSS 决定，元素按抽牌顺序自然排列
  const narrow = paintReadingGrid(r);
  const plan = { cols: r.spread.grid.cols, cells: r.spread.cells };
  const cols = Math.max(1, Math.min(plan.cols, r.reads.length));
  dom.readingLayout.dataset.cols = String(cols);
  dom.readingLayout.dataset.layout = r.spread.layout;
  dom.readingLayout.innerHTML = '';
  document.querySelector('.reading-summary')?.remove();
  document.querySelector('.disclaimer')?.remove();

  r.reads.forEach((read, i) => {
    const wrap = h('div', 'reading-card');
    wrap.style.animationDelay = `${i * 90}ms`;
    if (!narrow) {
      const cell = plan.cells[i] || { col: 1, row: 1 };
      wrap.style.gridColumn = String(cell.col);
      wrap.style.gridRow = String(cell.row);
    }

    const card = createFaceCard(read.card, read.reversed);
    card.addEventListener('click', () => openDetail(i));

    wrap.appendChild(h('div', 'reading-card__pos', `${String(i + 1).padStart(2, '0')} · ${read.position.name}`));
    wrap.appendChild(card);
    wrap.appendChild(h('div', 'reading-card__name',
      `${read.card.name}<em class="${read.reversed ? 'is-rev' : ''}">${read.orientation}</em>`));
    const btn = h('button', 'reading-card__toggle', '展开解读');
    btn.type = 'button';
    btn.addEventListener('click', (e) => { e.stopPropagation(); openDetail(i); });
    wrap.appendChild(btn);
    dom.readingLayout.appendChild(wrap);
  });

  dom.readingTitle.textContent = `${r.category.name} · ${r.spread.name}`;
  dom.readingSub.innerHTML = r.question
    ? `你的问题：<b>${escapeHTML(r.question)}</b> · 共 ${r.stats.total} 张（正位 ${r.stats.upright} / 逆位 ${r.stats.reversed}）`
    : `共 ${r.stats.total} 张 · 正位 ${r.stats.upright} · 逆位 ${r.stats.reversed} · 大阿卡纳 ${r.stats.majors}`;

  renderSummary(r);

  const cards = [...dom.readingLayout.querySelectorAll('.card')];
  for (let i = 0; i < cards.length; i++) {
    await wait(i === 0 ? 260 : 230);
    cards[i].classList.add('is-flipped');
    if (r.reads[i].reversed) cards[i].classList.add('is-reversed');
    sfx.flip();
    const rc = rectOf(cards[i]);
    FX.sparkBurst(rc.x + rc.w / 2, rc.y + rc.h / 2, 10, { spread: 90, size: 2.4, dur: 700 });
  }
  sfx.complete();
  FX.starRain(26, 1800);
}

/** 窗口尺寸变化时切换「桌面坐标摆放 / 自然流式排列」 */
function paintReadingCells(reading, narrow) {
  const wraps = [...dom.readingLayout.querySelectorAll('.reading-card')];
  wraps.forEach((wrap, i) => {
    if (narrow) {
      wrap.style.gridColumn = '';
      wrap.style.gridRow = '';
    } else {
      const cell = reading.spread.cells[i] || { col: 1, row: 1 };
      wrap.style.gridColumn = String(cell.col);
      wrap.style.gridRow = String(cell.row);
    }
  });
}

/** 窄屏解读网格的列数。
    早先三档媒体查询把列宽写死成 116 / 104 / 94px，390px 手机上 3 张牌被
    排成 2+1 两行、左右各空出 100px，牌既小又浪费了一整行高度。现在按张数
    取列数、列宽用 1fr 铺满：3 张一行看全，5 张 3+2，7 张 4+3。
    @returns {boolean} 是否处于窄屏（自然流式）布局 */
function paintReadingGrid(r) {
  const narrow = viewportWidth() < 820;
  const count = r.reads.length;
  dom.readingLayout.dataset.count = String(count);
  if (!narrow) {
    dom.readingLayout.style.removeProperty('--reading-cols');
    return false;
  }
  const cols = count <= 3 ? Math.max(1, count) : count <= 5 ? 3 : 4;
  dom.readingLayout.style.setProperty('--reading-cols', String(cols));
  return true;
}

function renderSummary(r) {
  const host = dom.readingLayout.parentElement;
  const box = h('div', 'reading-summary');

  const left = h('div', 'summary-block');
  left.innerHTML = `
    <h3>总览</h3>
    <p>${escapeHTML(r.opening)}</p>
    <p>${escapeHTML(r.category.lead)}</p>
    ${r.analysis.paragraphs.map((p) => `<p>${escapeHTML(p)}</p>`).join('')}
    <p style="color:var(--gold-300)">${escapeHTML(r.closing)}</p>`;

  const right = h('div', 'summary-block');
  right.innerHTML = `<h3>关键提醒</h3>`;
  const ul = h('ul');
  for (const b of r.analysis.bullets) ul.appendChild(h('li', null, escapeHTML(b)));
  right.appendChild(ul);

  const keyTitle = h('h3', null, '重点牌');
  keyTitle.style.marginTop = '24px';
  right.appendChild(keyTitle);
  const kc = h('div', 'key-cards');
  for (const k of r.analysis.keyCards) {
    kc.appendChild(h('div', 'key-card',
      `<b>${k.name}${k.reversed ? ' · 逆' : ''}</b><br><span>${k.keywords.join(' · ')}</span>`));
  }
  right.appendChild(kc);

  const statTitle = h('h3', null, '牌局数据');
  statTitle.style.marginTop = '24px';
  right.appendChild(statTitle);
  right.appendChild(h('div', 'stat-row', `
    <div class="stat"><b>${r.stats.total}</b><span>张数</span></div>
    <div class="stat"><b>${r.stats.upright}</b><span>正位</span></div>
    <div class="stat"><b>${r.stats.reversed}</b><span>逆位</span></div>
    <div class="stat"><b>${r.stats.majors}</b><span>大阿卡纳</span></div>`));

  box.appendChild(left);
  box.appendChild(right);
  host.appendChild(box);
  host.appendChild(h('p', 'disclaimer', escapeHTML(r.disclaimer)));
}

/** 把第 i 张牌的解读填进浮层，并同步「上一张 / 下一张」的可用状态。
    与 openModal 分开，是为了在浮层已经打开时原地换内容——重新走一遍
    openModal 会把 lastFocused 记成浮层内部的元素，关闭后焦点无处可还。 */
function renderDetail(i) {
  const r = state.reading;
  const read = r?.reads[i];
  if (!read) return false;
  detailIndex = i;
  dom.detailCardArt.innerHTML = '';
  dom.detailCardArt.appendChild(createMiniCard(read.card, read.reversed));
  dom.detailPos.textContent = `第 ${i + 1} 位 · ${read.position.name}`;
  dom.detailTitle.textContent = `${read.card.name} · ${read.orientation}`;
  dom.detailMeta.textContent = `${read.label}｜${read.card.element ? read.card.element + '元素｜' : ''}${read.keywords.join(' · ')}`;
  dom.detailText.textContent = read.text;
  dom.detailExtraTitle.textContent = read.reversed ? '逆位提示' : '另一层意思';
  dom.detailExtra.textContent = read.reversed
    ? (read.extra.reversedHint || '')
    : (read.extra.general || read.intro);
  dom.detailTags.innerHTML = read.keywords.map((k) => `<span class="chip chip--gold">${k}</span>`).join('');

  const multi = r.reads.length > 1;
  dom.detailNav.hidden = !multi;
  dom.detailPrev.disabled = i === 0;
  dom.detailNext.disabled = i === r.reads.length - 1;
  dom.detailNavCount.textContent = `${i + 1} / ${r.reads.length}`;
  return true;
}

function openDetail(i) {
  if (!renderDetail(i)) return;
  sfx.flip();
  openModal(dom.detailModal);
}

/** 浮层里翻到相邻的一张（按钮 / ←→ 方向键共用） */
function stepDetail(delta) {
  const r = state.reading;
  if (!r || dom.detailModal.hidden) return;
  const next = detailIndex + delta;
  if (next < 0 || next >= r.reads.length) return;
  if (!renderDetail(next)) return;
  sfx.flip();
  const panel = dom.detailModal.querySelector('.modal__panel');
  panel?.scrollTo({ top: 0 });
}

/* ───────── 浮层 ───────── */
/* 焦点管理：打开时把焦点移进浮层并在内部循环 Tab，关闭时归还触发元素。
   不做这一步，键盘与读屏用户在浮层打开后仍停在 body 上（实测
   activeElement 就是 BODY），等于被困在背后的页面里。 */
let lastFocused = null;
/** 浮层里当前展示的是第几张（「上一张 / 下一张」用它定位） */
let detailIndex = 0;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,'
  + '[tabindex]:not([tabindex="-1"])';

function openModal(el) {
  lastFocused = document.activeElement;
  el.hidden = false;
  document.body.classList.add('is-locked');
  const panel = el.querySelector('.modal__panel') || el.querySelector('.modal__zoom');
  panel?.scrollTo({ top: 0 });
  if (panel) {
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
  }
}

function closeModal(el) {
  el.hidden = true;
  document.body.classList.toggle('is-locked', !!document.querySelector('.modal:not([hidden])'));
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus({ preventScroll: true });
  lastFocused = null;
}

/** 让 Tab 在浮层内循环，不跑到背后的页面上 */
function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const modal = document.querySelector('.modal:not([hidden])');
  if (!modal) return;
  const items = [...modal.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function renderHelp() {
  dom.helpDoc.innerHTML = `
    <h4>一、这副牌</h4>
    <p>共 <b>78</b> 张：22 张大阿卡纳（人生课题与阶段），56 张小阿卡纳（权杖／圣杯／宝剑／星币各 14 张，分别对应行动、情感、思维、现实四个层面）。牌背的鲸鱼娘徽记是本站的视觉记号，不参与牌义。</p>
    <h4>二、正位与逆位</h4>
    <ul>
      <li><b>正位</b>：这张牌的能量顺畅表达，按字面方向理解。</li>
      <li><b>逆位</b>：能量受阻、过度或延迟，需要回收与内省。</li>
      <li>洗牌由随机数完成，逆位概率约 38%，抽出的牌不可回退重抽。</li>
    </ul>
    <h4>三、位置也参与解读</h4>
    <p>同一张牌落在「过去」和「建议行动」，说的话完全不同。所以先选牌阵再抽牌；牌位上方的名字就是它的发言角度。</p>
    <h4>四、五种牌阵</h4>
    <ul>
      ${SPREADS.map((s) => `<li><b>${s.name}</b>（${s.count} 张）：${s.desc}</li>`).join('')}
    </ul>
    <h4>五、怎么读这份结果</h4>
    <ul>
      <li>先读「总览」，再逐张点开看细节；「重点牌」是这次牌局的枢纽。</li>
      <li>把解读当作提问的镜子：认同的部分记下来，刺到你的那句更要记下来。</li>
      <li>牌不预测死局，只描述当下的能量与倾向——而能量是可以改的。</li>
    </ul>
    <h4>六、关于 AI</h4>
    <p>站内的塔罗插画（78 张）、品牌图标与顶栏标记均由 <b>AI 生成</b>（火山方舟 Seedream），
    解读文案由 AI 辅助撰写后人工校订。牌阵、牌义框架与站点代码为人工设计与实现。</p>
    <p class="doc__note">本站内容为文化娱乐与自我反思工具，不构成医疗、法律、投资等专业建议。涉及金钱与身心健康的重大决定，请咨询相应专业人士。</p>`;
}

/* ───────── 局面持久化 ─────────
   只存种子和「抽了第几张」——state.shuffled 完全由 mulberry32(seed) 决定，
   可以完整重放，没必要把 78 张牌的顺序写进存储。 */
function snapshot() {
  return {
    seed: state.seed,
    category: state.category,
    spread: state.spread,
    userName: state.userName,
    question: state.question,
    fanCount: state.fanCount,
    picks: state.picks.map((p) => p.fanIndex),
  };
}

function persist() {
  if (!state.category || !state.spread) return;
  saveSession(snapshot());
}

/** 把扇形里第 fanIndex 张牌直接画成「已翻开」的样子（恢复局面用，不播动画） */
function paintPicked(fanIndex, card, reversed) {
  const el = dom.fan.querySelectorAll('.fan-grid .card')[fanIndex];
  if (!el) return;
  el.classList.add('is-picked', 'is-flipped');
  if (reversed) el.classList.add('is-reversed');
  el.dataset.cardId = card.id;
  const front = el.querySelector('.card__face--front');
  front.innerHTML = createFaceCard(card, reversed).querySelector('.card__face--front').innerHTML;
  el.setAttribute('aria-label',
    `第 ${fanIndex + 1} 张牌，已翻开：${card.name}${reversed ? '（逆位）' : '（正位）'}`);
  el.setAttribute('aria-disabled', 'true');
  el.setAttribute('tabindex', '-1');
}

/**
 * 按快照重建局面。
 * @returns {boolean} 数据可用并已恢复
 */
function restoreFrom(data) {
  if (!data) return false;
  if (!CATEGORIES.some((c) => c.key === data.category)) return false;
  if (!SPREADS.some((s) => s.key === data.spread)) return false;

  state.category = data.category;
  state.spread = data.spread;
  /* 称呼与问题已不做输入（见 state 顶部注释）：这里只接收**旧分享链接**里
     带过来的值，让 2026-09 之前发出的链接仍能显示原问题。 */
  state.userName = data.userName || '';
  state.question = data.question || '';

  for (const b of dom.catGrid.children) b.setAttribute('aria-pressed', String(b.dataset.key === state.category));
  for (const b of dom.spreadGrid.children) b.setAttribute('aria-pressed', String(b.dataset.key === state.spread));
  dom.toSpread.textContent = `以「${getCategory(state.category).name}」起卦，选牌阵 →`;
  dom.toSpread.disabled = false;

  /* 按当前视口重算铺牌张数：视口变了列数就变了，直接沿用旧值会留半行。
     同时必须保证张数覆盖到已抽的最后一个位置。 */
  const perRow = fanColsForViewport();
  let fanCount = fanCountForViewport();
  const maxPicked = data.picks.length ? Math.max(...data.picks) : -1;
  if (fanCount <= maxPicked) fanCount = perRow * Math.ceil((maxPicked + 1) / perRow);

  beginDraw({ seed: data.seed, fanCount });

  for (const fanIndex of data.picks) {
    const draw = state.shuffled[fanIndex];
    if (!draw) continue;
    const card = getCard(DECK[draw.deckIndex].id);
    if (!card) continue;
    state.picks.push({ fanIndex, deckIndex: draw.deckIndex, cardId: card.id, reversed: draw.reversed });
    markSlotFilled(state.picks.length - 1, card, draw.reversed);
    paintPicked(fanIndex, card, draw.reversed);
  }
  state.stageIndex = state.picks.length - 1;
  updateProgress();

  const spread = getSpread(state.spread);
  go('draw');
  if (state.picks.length >= spread.count) {
    dom.drawTitle.textContent = '牌已到齐';
    dom.drawHint.innerHTML = '已恢复上次的牌局。点击 <b>全部翻开</b>，或按空格键，查看完整解读。';
    dom.flipAllBtn.hidden = false;
    dom.reshuffleBtn.hidden = false;
  } else {
    dom.drawTitle.textContent = `请抽出 ${spread.count} 张牌`;
    dom.drawHint.innerHTML = '已恢复上次的牌局，牌面顺序不变。凭直觉继续点选。';
    dom.reshuffleBtn.hidden = false;
    updateFanCaption();
  }
  return true;
}

/**
 * 回到最初的状态：清掉牌局、撤销方向与牌阵的选中、回到第一步。
 * @param {{toast?:string, keepCategory?:boolean}} o
 *        keepCategory=true 时保留已选方向（「开始新的占卜」用它，
 *        用户往往想在同一方向上再算一次，省一步点击）
 */
function resetToStart({ toast = '', keepCategory = false } = {}) {
  if (toast && state.picks.length) FX.toast(toast);
  state.picks = [];
  state.stageIndex = -1;
  state.reading = null;
  clearSession();
  history.replaceState(null, '', location.pathname);

  if (!keepCategory) {
    state.category = null;
    state.spread = null;
    for (const b of dom.catGrid.children) b.setAttribute('aria-pressed', 'false');
    for (const b of dom.spreadGrid.children) b.setAttribute('aria-pressed', 'false');
    dom.toSpread.textContent = '请先选择一个方向';
    dom.toSpread.disabled = true;
  }
  go('category');
}

/* ───────── 事件 ───────── */
/* 「重洗」在已经抽了牌时要按两次：第一次只是进入待确认状态，3 秒没动作自动解除。
   整局进度被误触一下清空太伤了，而原生 confirm() 在这个暗色界面里很突兀。 */
let reshuffleArmed = 0;
let reshuffleTimer = 0;
function resetReshuffleArm() {
  reshuffleArmed = 0;
  clearTimeout(reshuffleTimer);
  if (dom.reshuffleBtn) dom.reshuffleBtn.textContent = '↻ 重洗';
}
function armReshuffle() {
  reshuffleArmed = Date.now();
  dom.reshuffleBtn.textContent = '↻ 再点一次确认';
  clearTimeout(reshuffleTimer);
  reshuffleTimer = setTimeout(resetReshuffleArm, 3000);
}

function bindGlobal() {
  dom.toSpread.addEventListener('click', () => {
    if (!state.category) return;
    sfx.click();
    go('spread');
  });

  for (const b of document.querySelectorAll('[data-back]')) {
    b.addEventListener('click', () => {
      sfx.click();
      go(b.dataset.back);
    });
  }

  dom.toDraw.addEventListener('click', startDraw);

  dom.reshuffleBtn.addEventListener('click', async () => {
    if (state.busy) return;
    if (state.picks.length && !reshuffleArmed) {
      armReshuffle();
      FX.toast('再点一次「重洗」会清空已抽的牌');
      return;
    }
    resetReshuffleArm();
    sfx.click();
    await runShuffle({ fresh: true, refill: true });
  });

  /* 顶栏品牌标记 = 回到最开始。它本身是 <a href="./">，默认整页重载；
     但重载后 session.js 又会把牌局恢复回来，用户会觉得「点了没反应」。
     改成不刷新地回首页，并清掉当前局面（语义与「开始新的占卜」一致）。 */
  document.querySelector('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    sfx.click();
    resetToStart({ toast: '已回到首页，当前牌局已清空' });
  });

  dom.flipAllBtn.addEventListener('click', revealAll);

  dom.detailPrev.addEventListener('click', () => stepDetail(-1));
  dom.detailNext.addEventListener('click', () => stepDetail(1));

  dom.replayBtn.addEventListener('click', () => {
    if (!state.reading) { FX.toast('还没有可查看的解读'); return; }
    go('reading');
  });

  dom.againBtn.addEventListener('click', () => {
    sfx.click();
    resetToStart({ keepCategory: true });
  });

  dom.shareBtn.addEventListener('click', async () => {
    if (!state.picks.length) { FX.toast('还没有可分享的牌局'); return; }
    sfx.click();
    const url = buildShareUrl(snapshot());
    /* 顺手写进地址栏，这样直接复制地址栏也对 */
    history.replaceState(null, '', url);
    const ok = await copyText(url);
    FX.toast(ok ? '分享链接已复制，对方打开就是同一副牌' : '已写入地址栏，请手动复制');
  });

  dom.soundBtn.addEventListener('click', async () => {
    const on = await setEnabled(!isEnabled());
    dom.soundBtn.setAttribute('aria-pressed', String(on));
    dom.soundBtn.querySelector('.icon-btn__label').textContent = on ? '音效开' : '音效';
    if (on) sfx.click();
  });

  dom.helpBtn.addEventListener('click', () => { sfx.click(); openModal(dom.helpModal); });

  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('click', (e) => { if (e.target.dataset.close) closeModal(m); });
  }

  document.addEventListener('keydown', (e) => {
    trapFocus(e);
    if (e.key === 'Escape') {
      for (const m of document.querySelectorAll('.modal:not([hidden])')) closeModal(m);
    }
    /* 解读浮层里用 ←→ 连续翻阅：手机上不必关掉再点下一张 */
    if (!dom.detailModal.hidden) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepDetail(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepDetail(1); }
    }
    if (e.code === 'Space' && document.body.dataset.screen === 'draw') {
      e.preventDefault();
      if (!dom.flipAllBtn.hidden) revealAll();
    }
  });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      if (document.body.dataset.screen === 'draw' && !state.picks.length && !state.busy) {
        state.fanCount = fanCountForViewport();
        buildFan();
      }
      if (state.reading && document.body.dataset.screen === 'reading') {
        // 列数由 CSS 媒体查询决定；这里只切换坐标摆放 / 自然排列
        const narrow = paintReadingGrid(state.reading);
        paintReadingCells(state.reading, narrow);
      }
    }, 200);
  });
}

/* 洗牌 + 铺牌：入场刻意做得简单——牌库抖一下，然后平铺的牌整体淡入 */
async function runShuffle({ fresh = false, refill = false } = {}) {
  go('draw');
  dom.reshuffleBtn.hidden = true;
  dom.fan.style.opacity = '0';

  if (fresh) {
    beginDraw();
    dom.drawTitle.textContent = '洗牌中…';
    dom.drawHint.textContent = `正在打乱 78 张牌${refill ? '，上一轮的选择已清空' : ''}。`;
    sfx.shuffle(1.2);
    if (reduceMotion()) {
      await wait(400);
    } else {
      await shuffleVisual(dom.deck, 10, 1100);
    }
    /* 平铺的牌一次性淡入，不做逐张飞牌 */
    dom.fan.style.transition = 'opacity .42s ease';
    dom.fan.style.opacity = '1';
    await wait(380);
  }

  const spread = getSpread(state.spread);
  dom.drawTitle.textContent = `请抽出 ${spread.count} 张牌`;
  dom.drawHint.innerHTML = `牌已平铺在下方。<b>深呼吸三次</b>，把注意力放回你的问题，凭直觉点选 <b>${spread.count}</b> 张。`;
  updateFanCaption();
  dom.reshuffleBtn.hidden = false;
  persist();
}

function updateFanCaption() {
  const spread = getSpread(state.spread);
  if (!spread) return;
  if (state.picks.length >= spread.count) {
    dom.fanCaption.textContent = '牌已取满 · 可以翻牌了';
    return;
  }
  const pos = spread.positions[state.picks.length];
  dom.fanCaption.textContent = `正在选第 ${state.picks.length + 1} 张 · ${pos.name}：${pos.ask}`;
}

/* ───────── 工具 ───────── */
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ───────── 启动 ───────── */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
