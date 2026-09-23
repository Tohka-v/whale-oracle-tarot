/* ===========================================================
   手机端审计：字号 / 触控目标 / 文字裁切 / 排布利用率
   用法：node tools/verify-mobile.mjs      （需先在 4173 起 serve.mjs）
   截图落在 .shots/mb/

   为什么不用 node_modules 里的工具：本项目零依赖，验证脚本也
   只依赖 Node 内置模块 + Edge 的 CDP。这与 verify-e2e.mjs /
   verify-breakpoints.mjs 保持一致。
   =========================================================== */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = join(tmpdir(), 'dsh-mb-profile');
const SHOTS = resolve('.shots/mb');
const PORT = 9351;
const SITE = 'http://127.0.0.1:4173/';

await rm(PROFILE, { recursive: true, force: true });
await mkdir(PROFILE, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const child = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(300);
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { /* 等 */ }
}
if (!wsUrl) { console.error('Edge 未就绪'); process.exit(1); }
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const evalJS = async (expr) => (await send('Runtime.evaluate',
  { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name, full = false) => {
  let params = { format: 'png' };
  if (full) {
    const m = await send('Page.getLayoutMetrics');
    const cs = m.result.cssContentSize;
    params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cs.width, height: cs.height, scale: 1 } };
  }
  const r = await send('Page.captureScreenshot', params);
  if (r.result?.data) await writeFile(join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setBypassServiceWorker', { bypass: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

/* 直接构造分享链接跳到「已抽满」的局面，省掉 3×6 秒的抽牌动画。
   pack() 的结构：v 版本 | s 种子 | c 方向 | p 牌阵 | f 铺牌张数 | k 抽中的位置 */
const shareHash = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const DEVICES = [
  { w: 360, h: 740, label: '360x740 小屏安卓', dpr: 2 },
  { w: 390, h: 844, label: '390x844 iPhone 14', dpr: 2 },
  { w: 414, h: 896, label: '414x896 大屏手机', dpr: 2 },
  { w: 768, h: 1024, label: '768x1024 竖屏平板', dpr: 1 },
];

/* 页面内审计：一次性把「字太小 / 目标太小 / 文字被裁 / 排布没铺满」都量出来 */
const AUDIT = `(() => {
  const cw = document.documentElement.clientWidth;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  const tag = (el) => el.tagName.toLowerCase()
    + (el.id ? '#' + el.id : '')
    + (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const inApp = (el) => !el.closest('.sky') && !el.closest('.fx-layer');

  /* 只挑「叶子文本」节点，避免父容器重复计数。
     SVG 里的 <text>（牌面上的烫金小字）不算界面文案——它随牌面缩放，
     读的是牌的大小，不是 UI 的字号。 */
  const smallText = [];
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!inApp(el) || !vis(el) || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fs = parseFloat(cs.fontSize);
      const txt = el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 12);
      if (fs < 12 && txt) smallText.push({ 元素: tag(el), 字号: +fs.toFixed(1), 文字: txt });
      /* 文字被裁：只有 overflow:hidden/clip 才真的看不见内容。
         而且要用 Range 量**文字自己**的范围——直接比 scrollWidth 会把
         ::after 那条扫光（left:-60% → 130%）算成内容，.btn--primary 于是
         稳定误报「内容 287px 挤在 165px 盒子里」。 */
      const hides = (v) => v === 'hidden' || v === 'clip';
      let clippedX = false; let clippedY = false;
      if (hides(cs.overflowX) || hides(cs.overflowY)) {
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const tr = rg.getBoundingClientRect();
        const br = el.getBoundingClientRect();
        if (hides(cs.overflowX)) clippedX = tr.width > 0 && (tr.right > br.right + 1 || tr.left < br.left - 1);
        if (hides(cs.overflowY)) clippedY = tr.height > 0 && (tr.bottom > br.bottom + 1 || tr.top < br.top - 1);
      }
      if ((clippedX || clippedY) && cs.textOverflow !== 'ellipsis') {
        clipped.push({ 元素: tag(el), 方向: clippedX ? '横向' : '纵向',
          内容: el.scrollWidth + 'x' + el.scrollHeight, 盒子: el.clientWidth + 'x' + el.clientHeight, 文字: txt });
      }
    }
    /* 元素超出视口右边界 */
    const b = el.getBoundingClientRect();
    if (b.right > cw + 1 && cs.position !== 'fixed') {
      clipped.push({ 元素: tag(el), 方向: '出界', 内容: 'right=' + Math.round(b.right), 盒子: 'vw=' + cw, 文字: '' });
    }
  }

  /* 触控目标：可点元素至少 44×44（WCAG 2.5.5 建议值），低于 40 记为不达标 */
  const targets = [];
  const clickable = document.querySelectorAll(
    '#app button, #app a, #app [role="button"], .topbar button, .topbar a, .modal button, .toast button');
  for (const el of clickable) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) {
      targets.push({ 元素: tag(el), 尺寸: Math.round(r.width) + 'x' + Math.round(r.height),
        文字: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 10) });
    }
  }

  /* 排布利用率：网格实际占宽 / 可用宽 */
  let layout = null;
  const grid = document.querySelector('.reading-layout');
  if (grid && vis(grid)) {
    const cards = [...grid.querySelectorAll('.card')];
    const gr = grid.getBoundingClientRect();
    const host = grid.parentElement.getBoundingClientRect();
    const byRow = new Map();
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const k = Math.round(r.top);
      byRow.set(k, (byRow.get(k) || 0) + 1);
    }
    layout = {
      列数: Math.max(0, ...byRow.values()),
      行数: byRow.size,
      张数: cards.length,
      首牌宽: cards.length ? +cards[0].getBoundingClientRect().width.toFixed(1) : 0,
      网格宽: Math.round(gr.width),
      可用宽: Math.round(host.width),
      利用率: host.width ? +(gr.width / host.width).toFixed(3) : 0,
      两侧留白: Math.round((host.width - gr.width) / 2),
    };
  }

  return {
    屏幕: document.body.dataset.screen || '(未设置)',
    视口: cw + 'x' + window.innerHeight,
    横向溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    页高: document.documentElement.scrollHeight,
    首屏内可见按钮: [...document.querySelectorAll('#app button')].filter(vis)
      .filter((b) => b.getBoundingClientRect().bottom <= window.innerHeight + 1).length,
    小字: smallText.slice(0, 8), 小字数: smallText.length,
    小目标: targets.slice(0, 8), 小目标数: targets.length,
    裁切: clipped.slice(0, 8), 裁切数: clipped.length,
    解读排布: layout,
  };
})()`;

const rows = [];
const problems = [];

for (const d of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride',
    { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: false });
  await send('Page.navigate', { url: SITE });
  await sleep(1200);
  await evalJS('sessionStorage.clear()');
  await send('Page.navigate', { url: SITE });
  await sleep(1500);
  await evalJS('document.fonts.ready.then(() => true)');
  await sleep(400);

  /* ── 首屏（选方向） ── */
  const home = await evalJS(AUDIT);
  await shot(`${d.label}_1_方向`);
  await shot(`${d.label}_1_方向_全页`, true);

  /* 双击方向应直接进入牌阵页 */
  const dblCat = await evalJS(`(async () => {
    const b = document.querySelector('.cat[data-key="career"]');
    b.click();
    await new Promise((r) => setTimeout(r, 120));
    const mid = document.body.dataset.screen;
    b.click();
    await new Promise((r) => setTimeout(r, 400));
    return { 首次点击后: mid, 再次点击后: document.body.dataset.screen };
  })()`);
  const spreadScreen = await evalJS(AUDIT);
  await shot(`${d.label}_2_牌阵`);

  /* 双击牌阵应直接开始洗牌 */
  const dblSpread = await evalJS(`(async () => {
    const b = document.querySelector('.spread[data-key="path3"]');
    b.click();
    await new Promise((r) => setTimeout(r, 120));
    const mid = document.body.dataset.screen;
    b.click();
    await new Promise((r) => setTimeout(r, 2600));
    return { 首次点击后: mid, 再次点击后: document.body.dataset.screen };
  })()`);
  await evalJS('document.fonts.ready.then(() => true)');
  await sleep(400);
  const drawScreen = await evalJS(AUDIT);
  await shot(`${d.label}_3_抽牌台`);

  /* ── 解读页：用分享链接直达已抽满的局面 ── */
  const hash = shareHash({ v: 1, s: 20260923, c: 'career', p: 'path3', f: 21, k: [2, 7, 13] });
  /* 必须先离开当前文档：同 URL 只差 hash 属于「同文档导航」，
     浏览器不会重新加载，boot() 也就不会去读 #r=，页面会原地不动。 */
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(200);
  await send('Page.navigate', { url: `${SITE}#r=${hash}` });
  await sleep(1600);
  await evalJS(`document.getElementById('flipAllBtn').click()`);
  await sleep(3200);
  await evalJS('document.fonts.ready.then(() => true)');
  await sleep(400);
  const reading = await evalJS(AUDIT);
  await shot(`${d.label}_4_解读`);
  await shot(`${d.label}_4_解读_全页`, true);

  /* 展开解读浮层 */
  await evalJS(`document.querySelector('.reading-card__toggle').click()`);
  await sleep(700);
  const detail = await evalJS(AUDIT);
  await shot(`${d.label}_5_解读浮层`);
  await evalJS(`document.querySelector('#detailModal .modal__close').click()`);
  await sleep(300);

  rows.push({
    设备: d.label, 屏: '方向', 横向溢出: home.横向溢出, 小字: home.小字数, 小目标: home.小目标数, 裁切: home.裁切数,
  });
  rows.push({
    设备: d.label, 屏: '牌阵', 横向溢出: spreadScreen.横向溢出, 小字: spreadScreen.小字数,
    小目标: spreadScreen.小目标数, 裁切: spreadScreen.裁切数,
  });
  rows.push({
    设备: d.label, 屏: '抽牌台', 横向溢出: drawScreen.横向溢出, 小字: drawScreen.小字数,
    小目标: drawScreen.小目标数, 裁切: drawScreen.裁切数,
  });
  rows.push({
    设备: d.label, 屏: '解读', 横向溢出: reading.横向溢出, 小字: reading.小字数,
    小目标: reading.小目标数, 裁切: reading.裁切数,
  });

  const notes = [];
  if (dblCat.再次点击后 !== 'spread') notes.push(`方向双击未跳转（${dblCat.首次点击后} → ${dblCat.再次点击后}）`);
  if (dblSpread.再次点击后 !== 'draw') notes.push(`牌阵双击未跳转（${dblSpread.首次点击后} → ${dblSpread.再次点击后}）`);
  for (const [name, a] of [['方向', home], ['牌阵', spreadScreen], ['抽牌台', drawScreen], ['解读', reading]]) {
    if (a.横向溢出 > 0) notes.push(`${name}横向溢出 ${a.横向溢出}px`);
    if (a.裁切数) notes.push(`${name}文字裁切 ${a.裁切数} 处：${a.裁切.map((c) => c.元素 + c.方向).join('、')}`);
    if (a.小目标数) notes.push(`${name}触控目标偏小 ${a.小目标数} 处：${a.小目标.slice(0, 4).map((t) => t.元素 + t.尺寸).join('、')}`);
  }
  const L = reading.解读排布;
  if (L && L.利用率 < 0.9) notes.push(`解读网格只用了 ${Math.round(L.利用率 * 100)}% 宽度（两侧空 ${L.两侧留白}px），${L.张数} 张排成 ${L.行数} 行`);
  if (L && L.行数 > 1 && L.张数 <= 3) notes.push(`3 张牌排了 ${L.行数} 行，应一行放下`);
  if (detail.小目标数) notes.push(`解读浮层触控目标偏小 ${detail.小目标数} 处`);

  console.log(`\n── ${d.label} ──`);
  console.log(`  方向   ${JSON.stringify({ 溢出: home.横向溢出, 小字: home.小字, 小目标: home.小目标 })}`);
  console.log(`  牌阵   ${JSON.stringify({ 溢出: spreadScreen.横向溢出, 小字: spreadScreen.小字数, 小目标: spreadScreen.小目标数 })}`);
  console.log(`  抽牌台 ${JSON.stringify({ 溢出: drawScreen.横向溢出, 小字: drawScreen.小字数, 小目标: drawScreen.小目标数, 裁切: drawScreen.裁切 })}`);
  console.log(`  解读   ${JSON.stringify({ 溢出: reading.横向溢出, 小字: reading.小字, 小目标: reading.小目标数, 裁切: reading.裁切 })}`);
  console.log(`  解读排布 ${JSON.stringify(L)}`);
  console.log(`  浮层   ${JSON.stringify({ 小字: detail.小字数, 小目标: detail.小目标数, 裁切: detail.裁切 })}`);
  for (const n of notes) console.log(`  ✗ ${n}`);
  problems.push(...notes.map((n) => `${d.label}：${n}`));
}

console.log('\n手机端审计汇总：');
console.table(rows);
console.log(`JS 异常：${errors.length ? errors.slice(0, 3).join(' | ') : '无'}`);
console.log(`\n问题 ${problems.length} 条`);
console.log('截图：' + SHOTS);

ws.close(); try { child.kill(); } catch { /* 已退出 */ }
process.exit(problems.length || errors.length ? 1 : 0);
