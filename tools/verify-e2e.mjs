/* ===========================================================
   端到端验收：逐条核对站点优化的验收标准
   用法：node tools/verify-e2e.mjs   （需先在 4173 起 serve.mjs）
   截图落在 .shots/e2e/
   =========================================================== */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
/* 路径基于 cwd（从仓库根目录跑），落在 .shots/ 下——那里已被 gitignore。
   不要用 URL.pathname：它保留百分号编码，中文路径下会凭空造出
   D:\Claudecode%E5%AD%98... 这样的目录，把浏览器 profile 全写进去。 */
const PORT = 9348;
/* --proxy=host:port：让**浏览器**也走代理。
   验线上站（GitHub Pages）时需要——本机的系统代理是关着的，Edge 不会自己用
   HTTPS_PROXY 环境变量，而 --proxy-server 是启动参数，不碰系统设置。
   本地跑（127.0.0.1）不需要它，保持默认即可。 */
const PROXY = (() => {
  const i = process.argv.indexOf('--proxy');
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : null;
})();
const PROFILE = join(tmpdir(), `dsh-e2e-profile-${PORT}`);
const SHOTS = resolve('.shots/e2e');
/* 默认跑本机根的 4173；--site 可以指到别处，用来验「部署在子目录」的场景
   （GitHub Pages 的项目页就是子目录，绝对路径写错时只有在这里才暴露）。 */
const SITE = (() => {
  const i = process.argv.indexOf('--site');
  const raw = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 'http://127.0.0.1:4173/';
  return raw.endsWith('/') ? raw : raw + '/';
})();

await rm(PROFILE, { recursive: true, force: true });
await mkdir(PROFILE, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const child = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  ...(PROXY ? [`--proxy-server=${PROXY}`] : []),
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { /* 等 */ } }
if (!wsUrl) { console.error('Edge 未就绪'); process.exit(1); }
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0; const pending = new Map();
const errors = [];
let bytes = 0; let reqCount = 0; let reqUrl = new Map(); let byKind = {};
const kindOf = (u) => {
  if (u.includes('/assets/tarot/thumbs/')) return '缩略图';
  if (u.includes('/assets/tarot/')) return '卡面原图';
  if (u.includes('/fonts/')) return '字体';
  if (u.includes('/assets/back/')) return '牌背';
  if (u.includes('/assets/icons/')) return '图标';
  if (u.endsWith('.css')) return 'CSS';
  if (u.endsWith('.js') || u.endsWith('.mjs')) return 'JS';
  return '其他';
};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Network.responseReceived') reqUrl.set(m.params.requestId, m.params.response.url);
  if (m.method === 'Network.loadingFinished') {
    const b = m.params.encodedDataLength || 0; bytes += b; reqCount++;
    const k = kindOf(reqUrl.get(m.params.requestId) || ''); byKind[k] = (byKind[k] || 0) + b;
  }
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJS = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description?.split('\n')[0] };
  return r.result?.result?.value;
};
const resetNet = () => { bytes = 0; reqCount = 0; reqUrl = new Map(); byKind = {}; };
const fmt = (b) => (b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(2)} MB`);
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) await writeFile(join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* 先打开一次页面把旧的 Service Worker 与缓存清干净。
   否则 SW 会把上一轮缓存的 CSS/JS 返回给页面，测出来的不是当前代码。
   （离线能力本身在第 11、12 项单独验证。） */
await send('Page.navigate', { url: SITE });
await sleep(1500);
const swReset = await evalJS(`(async () => {
  if (!('serviceWorker' in navigator)) return 'no-sw';
  const rs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(rs.map((r) => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  return '已注销 ' + rs.length + ' 个 SW，清空 ' + keys.length + ' 个缓存';
})()`);
console.log('准备：' + swReset);

const ok = []; const fail = [];
const check = (name, pass, detail) => { (pass ? ok : fail).push(`${name}${detail ? ` — ${detail}` : ''}`); };

/* ─── 1. 冷启动首屏 ─── */
await send('Network.clearBrowserCache');
resetNet();
await send('Page.navigate', { url: SITE });
await sleep(4000);
const coldBytes = bytes;
check('首屏传输 ≤ 1.3 MB', coldBytes <= 1.3 * 1048576, fmt(coldBytes) + ' / ' + reqCount + ' 请求');
await shot('01-首屏');

/* ─── 2. 热启动（缓存协商） ─── */
resetNet();
await send('Page.navigate', { url: SITE });
await sleep(3500);
check('二次访问 ≤ 200 KB（304）', bytes <= 200 * 1024, fmt(bytes));

/* ─── 3. 走到抽牌台 ─── */
await evalJS(`document.querySelector('.cat[data-key="career"]').click()`);
await sleep(150);
await evalJS(`document.querySelector('#toSpread').click()`);
await sleep(250);
await evalJS(`document.querySelector('.spread[data-key="time3"]').click()`);
await sleep(150);
await evalJS(`document.querySelector('#toDraw').click()`);
/* 洗牌阶段不该再有飞牌：它们曾是 fixed + z-index:200，会盖住标题与说明文字，
   坐标还因为取自刚切屏时的 rectOf 而偏到屏幕左上角 */
await sleep(400);
const flying = await evalJS(`document.querySelectorAll('.flyer').length`);
check('洗牌阶段没有飞牌元素', flying === 0, `.flyer = ${flying} 个`);
/* 洗牌动画是 transform 动画，会把 .deck 上任何 scale 顶掉；
   所以牌库的 0.74 缩放必须做在 width/height 上，尺寸在洗牌前后要一致 */
const deckMid = await evalJS(`(() => {
  const d = document.querySelector('.deck-area .deck');
  return { w: Math.round(d.getBoundingClientRect().width), cls: d.className.replace('deck', '').trim() };
})()`);
await sleep(3400);
const deckAfter = await evalJS(`Math.round(document.querySelector('.deck-area .deck').getBoundingClientRect().width)`);
/* deck-pump 自己会把牌库脉动到 1.03 倍，所以允许这个幅度；
   但绝不能出现「跳到 1.0 倍」——那是 .deck 上的 scale 被 transform 动画顶掉的特征
   （120px 而不是 89px）。 */
const pulse = deckMid.w / deckAfter;
check('洗牌时牌库保持 0.74 缩放（没被动画顶掉）', pulse >= 0.98 && pulse <= 1.06,
  `洗牌中 ${deckMid.w}px ÷ 洗牌后 ${deckAfter}px = ${pulse.toFixed(3)}（预期 1.00~1.03；若接近 1.35 说明缩放被顶掉）`);

/* 牌库不能压住它下面的说明文字。曾经踩过：.card 自带 width/height，
   而绝对定位元素同时有 width 和 inset:0 时 width 胜出，于是顶层那张
   .card.deck__layer 不跟随 .deck 的缩放，大出一圈把 caption 盖住了 58px。 */
const overlap = await evalJS(`(() => {
  const bottomOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().bottom : 0;
  };
  const cap = document.querySelector('.deck-caption');
  return {
    牌库最低边: Math.round(Math.max(
      bottomOf('.deck-area .deck'),
      bottomOf('.deck-area .deck > .card'),
      bottomOf('.deck__layer > .card'),
    )),
    caption顶边: cap ? Math.round(cap.getBoundingClientRect().top) : 0,
  };
})()`);
check('牌库不遮挡下方的说明文字', overlap.牌库最低边 <= overlap.caption顶边,
  `牌库最低边 ${overlap.牌库最低边}px vs caption 顶边 ${overlap.caption顶边}px`);
await shot('02-抽牌台');

/* ─── 4. 卡面比例 ─── */
const ratio = await evalJS(`(() => {
  const c = document.querySelector('.fan-grid .card');
  const r = c.getBoundingClientRect();
  const svg = c.querySelector('svg.card-art');
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  const s = Math.min(r.width / vb[2], r.height / vb[3]);
  return { w: r.width, h: r.height, ratio: r.width / r.height,
           gapX: r.width - vb[2] * s, gapY: r.height - vb[3] * s, fan: document.querySelectorAll('.fan-grid .card').length };
})()`);
check('卡面比例 = 0.5769', Math.abs(ratio.ratio - 300 / 520) < 0.002, `实测 ${ratio.ratio.toFixed(4)}，左右暗边 ${ratio.gapX.toFixed(3)}px`);
check('铺牌张数 ≤ 21 且 ≥ 9', ratio.fan >= 9 && ratio.fan <= 21, `${ratio.fan} 张`);

/* 每行张数必须一致。张数若不是列数的整数倍，最后一行会缺角、右侧空一块，
   看着像牌没铺好（早先用 Math.max(9, …) 兜底时，一行放 7 张会凑成 9 张）。 */
const rowsInfo = await evalJS(`(() => {
  const byTop = {};
  for (const c of document.querySelectorAll('.fan-grid .card')) {
    const t = Math.round(c.getBoundingClientRect().top);
    byTop[t] = (byTop[t] || 0) + 1;
  }
  const counts = Object.values(byTop);
  return { 行数: counts.length, 每行: counts, 总张数: document.querySelectorAll('.fan-grid .card').length };
})()`);
check('铺牌每行张数一致（无残缺行）', new Set(rowsInfo.每行).size === 1,
  `${rowsInfo.行数} 行 × ${rowsInfo.每行.join(' / ')} 张，共 ${rowsInfo.总张数} 张`);

/* hidden 属性是否真的隐藏（.btn 的 display 会压掉 UA 的 [hidden]） */
const hiddenState = await evalJS(`(() => {
  const probe = (id) => { const b = document.getElementById(id); return b ? getComputedStyle(b).display : 'missing'; };
  return { 全部翻开_display: probe('flipAllBtn'), 全部翻开_hidden: document.getElementById('flipAllBtn').hidden,
           重洗_display: probe('reshuffleBtn'),
           详情附加块_display: getComputedStyle(document.getElementById('detailExtraWrap')).display };
})()`);
check('未抽满时「全部翻开」确实不可见', hiddenState.全部翻开_display === 'none',
  `display=${hiddenState.全部翻开_display}，hidden 属性=${hiddenState.全部翻开_hidden}`);

/* ─── 5. 一屏可见（不出现纵向滚动条） ─── */
const fits = await evalJS(`(() => {
  const cards = [...document.querySelectorAll('.fan-grid .card')];
  const last = cards[cards.length - 1].getBoundingClientRect();
  return { 最后一排底部: Math.round(last.bottom), 视口高: window.innerHeight,
           页面可滚: document.documentElement.scrollHeight - window.innerHeight };
})()`);
check('牌阵主体在首屏内可见', fits.最后一排底部 <= fits.视口高 + 40,
  `末排底部 ${fits.最后一排底部}px / 视口 ${fits.视口高}px，整页可滚 ${fits.页面可滚}px`);

/* ─── 6. 键盘可达 ─── */
const a11y = await evalJS(`(() => {
  const cards = [...document.querySelectorAll('.fan-grid .card')];
  return { 总数: cards.length,
           可聚焦: cards.filter(c => c.tabIndex >= 0).length,
           role: cards[0]?.getAttribute('role'),
           label: cards[0]?.getAttribute('aria-label') };
})()`);
check('扇形牌全部可聚焦', a11y.可聚焦 === a11y.总数, `${a11y.可聚焦}/${a11y.总数}，role=${a11y.role}`);

/* ─── 7. 用键盘抽一张，并用「继续」提前结束等待 ─── */
const kbd = await evalJS(`(() => {
  const c = document.querySelector('.fan-grid .card');
  c.focus();
  const focused = document.activeElement === c;
  c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return { 聚焦成功: focused };
})()`);
await sleep(1600);
const capState = await evalJS(`(() => {
  const cap = document.querySelector('.reveal-caption');
  const b = document.querySelector('.reveal-caption__next');
  return { 浮层在: !!cap, 有继续按钮: !!b,
           按钮可点: b ? getComputedStyle(b).pointerEvents : null,
           浮层本身: cap ? getComputedStyle(cap).pointerEvents : null };
})()`);
check('翻牌浮层带可点的「继续」按钮',
  capState.浮层在 && capState.有继续按钮 && capState.按钮可点 === 'auto',
  `浮层=${capState.浮层在}，按钮 pointer-events=${capState.按钮可点}，浮层本身=${capState.浮层本身}（须为 none，否则挡住下面的牌）`);

/* 点「继续」应当立刻结束等待，而不是等满 3.6 秒 */
const tSkip = Date.now();
await evalJS(`document.querySelector('.reveal-caption__next').click()`);
let skipMs = 0;
for (let i = 0; i < 50; i++) {
  await sleep(100);
  if (await evalJS(`!document.querySelector('.reveal-caption')`)) { skipMs = Date.now() - tSkip; break; }
}
check('点「继续」能提前结束等待', skipMs > 0 && skipMs < 1500,
  skipMs > 0 ? `点击到浮层消失 ${skipMs}ms（默认等待 3600ms）` : '浮层始终没消失');

const afterKbd = await evalJS(`({ 已填牌位: document.querySelectorAll('#spreadSlots .slot-mini.is-filled').length,
                                 进度: document.getElementById('progressLabel').textContent })`);
check('Enter 键可完成抽牌', afterKbd.已填牌位 === 1, `聚焦=${kbd.聚焦成功}，进度 ${afterKbd.进度}`);

/* ─── 8. 图鉴：缩略图与焦点 ─── */
/* 真实用户是「点」按钮，焦点会落在按钮上；程序化 click() 不会移动焦点，
   所以这里显式 focus，否则测的是「从牌上打开」这条不同的路径 */
await evalJS(`(() => { const b = document.getElementById('galleryBtn'); b.focus(); b.click(); })()`);
await sleep(4500);
const gal = await evalJS(`(() => {
  const m = document.querySelector('#galleryModal');
  const panel = m.querySelector('.modal__panel');
  const imgs = [...m.querySelectorAll('.card__face--front image')];
  return { 打开: !m.hidden,
           焦点在浮层内: m.contains(document.activeElement),
           activeElement: document.activeElement.className || document.activeElement.tagName,
           image元素: imgs.length, 已挂href: imgs.filter(i => i.hasAttribute('href')).length,
           thumbbase: imgs.find(i => i.hasAttribute('href'))?.getAttribute('href') };
})()`);
check('图鉴浮层打开且焦点进入', gal.打开 && gal.焦点在浮层内, `activeElement=${gal.activeElement}`);
check('图鉴用缩略图且懒加载', gal.thumbbase?.includes('/thumbs/') && gal.已挂href < gal.image元素,
  `${gal.已挂href}/${gal.image元素} 已挂 href，首图 ${gal.thumbbase}`);
await shot('03-图鉴');

/* Tab 循环 */
const trap = await evalJS(`(() => {
  const m = document.querySelector('#galleryModal');
  const items = [...m.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(n => n.offsetParent !== null);
  items[items.length - 1].focus();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  return { 末元素: items[items.length-1].className, 循环后: document.activeElement.className };
})()`);
check('Tab 在浮层内循环', trap.循环后 !== trap.末元素, `${trap.末元素} → ${trap.循环后}`);

/* 关闭归还焦点 */
const restore = await evalJS(`(() => {
  const g = document.querySelector('#galleryModal');
  g.querySelector('.modal__scrim').click();
  return { 已关闭: g.hidden, 焦点: document.activeElement.id || document.activeElement.className };
})()`);
check('关闭浮层后焦点归还', restore.已关闭 && restore.焦点 === 'galleryBtn', `activeElement=${restore.焦点}`);

/* ─── 9. 刷新恢复局面 ─── */
const before = await evalJS(`({ 进度: document.getElementById('progressLabel').textContent,
                                seed: document.querySelector('.fan-grid .card[data-card-id]')?.dataset.cardId || null })`);
await send('Page.navigate', { url: SITE });
await sleep(3800);
const after = await evalJS(`(() => {
  const screen = document.body.dataset.screen;
  const filled = document.querySelectorAll('#spreadSlots .slot-mini.is-filled').length;
  const picked = document.querySelectorAll('.fan-grid .card.is-picked').length;
  const revealed = [...document.querySelectorAll('.fan-grid .card.is-picked')].map(c => c.dataset.cardId);
  return { screen, filled, picked, revealed, 进度: document.getElementById('progressLabel').textContent,
           提示: document.getElementById('drawHint')?.textContent.slice(0, 24) };
})()`);
check('刷新后恢复牌局', after.screen === 'draw' && after.filled === 1 && after.picked === 1,
  `屏幕=${after.screen}，已填牌位=${after.filled}，已翻牌=${after.picked}，牌=${after.revealed.join(',')}`);
check('恢复的牌与刷新前一致', after.revealed[0] === before.seed, `${before.seed} → ${after.revealed[0]}`);
await shot('04-刷新恢复');

/* ─── 10. 继续抽满并进解读 ─── */
for (let i = 0; i < 2; i++) {
  const pre = await evalJS(`[...document.querySelectorAll('.fan-grid .card')]
    .map((c, ix) => ix + (c.classList.contains('is-picked') ? 'P' : '-') + (c.classList.contains('is-revealing') ? 'R' : '')).join(' ')`);
  const picked = await evalJS(`(() => {
    const c = [...document.querySelectorAll('.fan-grid .card')].find(x => !x.classList.contains('is-picked'));
    if (!c) return 'none';
    c.click();
    return c.dataset.deckIndex;
  })()`);
  await sleep(300);
  const instant = await evalJS(`[...document.querySelectorAll('.fan-grid .card')]
    .map((c, ix) => ix + (c.classList.contains('is-picked') ? 'P' : '-') + (c.classList.contains('is-revealing') ? 'R' : '')).join(' ')`);
  await sleep(7200);
  const st = await evalJS(`({ 进度: document.getElementById('progressLabel').textContent,
                             忙碌: document.querySelector('.fan-grid .card.is-revealing') !== null })`);
  console.log(`    循环 ${i + 1}：点击 deckIndex=${picked}`);
  console.log(`      点击前 ${pre}`);
  console.log(`      +300ms ${instant}`);
  console.log(`      完成后 进度 ${st.进度}，仍在揭示=${st.忙碌}`);
}
const full = await evalJS(`({ 进度: document.getElementById('progressLabel').textContent,
                             全部翻开可见: getComputedStyle(document.getElementById('flipAllBtn')).display !== 'none',
                             分享按钮: !!document.getElementById('shareBtn') })`);
check('抽满后「全部翻开」出现', full.全部翻开可见 && full.进度 === '3 / 3', `进度 ${full.进度}`);

/* ─── 重洗需要二次确认（防止误触清空进度） ─── */
const reshuffle = await evalJS(`(async () => {
  const btn = document.getElementById('reshuffleBtn');
  const before = btn.textContent;
  btn.click();
  await new Promise((r) => setTimeout(r, 250));
  return { 原始: before, 一次点击后: btn.textContent,
           已抽牌: document.querySelectorAll('.fan-grid .card.is-picked').length };
})()`);
check('重洗第一次点击只进入待确认', reshuffle.一次点击后.includes('确认') && reshuffle.已抽牌 === 3,
  `「${reshuffle.原始}」→「${reshuffle.一次点击后}」，已抽 ${reshuffle.已抽牌} 张仍在`);

await evalJS(`document.getElementById('flipAllBtn').click()`);
await sleep(6000);
await shot('05-解读页');
const share = await evalJS(`(async () => {
  document.getElementById('shareBtn').click();
  await new Promise(r => setTimeout(r, 300));
  const m = document.getElementById('toast');
  return { 吐司: m.textContent, hash长度: location.hash.length, hash开头: location.hash.slice(0, 12) };
})()`);
check('分享链接已生成', share.hash长度 > 20, `${share.hash开头}… 长度 ${share.hash长度}，提示「${share.吐司}」`);

/* ─── 10.5 AI 生成内容标识 ───
   《人工智能生成合成内容标识办法》（2025-09-01 施行）要求发布者对 AI 生成内容
   作出显著标识。这条本来最容易被「顺手删掉」——文案改动、界面精简都可能带走它，
   所以钉成断言：两处少一处就是回归。
   ⚠ 必须在这里查：再往后走会点 logo 回首页，解读页连同 .disclaimer 一起被清掉，
   断言就会假失败（第一版就写在了后面，抓到的是自己的 bug）。 */
const aiNotice = await evalJS(`(() => {
  const help = document.getElementById('helpDoc')?.innerText || '';
  const disc = document.querySelector('.disclaimer')?.innerText || '';
  return { 规则弹窗: /AI/.test(help) && /生成/.test(help),
           解读页: /AI/.test(disc) && /生成/.test(disc) };
})()`);
check('AI 生成标识两处都在（规则弹窗 + 解读页免责声明）',
  aiNotice.规则弹窗 && aiNotice.解读页,
  `规则弹窗=${aiNotice.规则弹窗 ? '有' : '缺'}，解读页=${aiNotice.解读页 ? '有' : '缺'}`);

/* ─── 11. Service Worker ─── */
const sw = await evalJS(`(async () => {
  if (!('serviceWorker' in navigator)) return { 支持: false };
  /* 不传参数：返回「覆盖当前页面」的那个注册。
     早先写的是 getRegistration('/')，等于写死了 scope 必须是域名根——
     site 部署在子目录（用户名.github.io/仓库名/）时 scope 是 /仓库名/，
     这条断言就会误报「未注册」，把人骗去查网站。 */
  const reg = await navigator.serviceWorker.getRegistration();
  return { 支持: true, 安全上下文: window.isSecureContext,
           已注册: !!reg, scope: reg?.scope || null,
           激活: reg?.active?.state || null };
})()`);
check('Service Worker 已注册并激活', sw.已注册 && sw.激活 === 'activated', JSON.stringify(sw));

/* ─── 12. 离线可用 ─── */
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
resetNet();
await send('Page.navigate', { url: SITE });
await sleep(4000);
const offline = await evalJS(`({ 有内容: document.body.innerText.length > 50,
                                 屏幕: document.body.dataset.screen || '(无)',
                                 标题: document.title,
                                 可见按钮: document.querySelectorAll('button').length })`);
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
check('离线仍能打开页面', offline.有内容 && offline.标题.includes('塔罗'), `标题「${offline.标题}」，${offline.可见按钮} 个按钮`);
await shot('06-离线');

/* ─── 13. 顶栏 logo 回到首页 ─── */
const brand = await evalJS(`(() => {
  document.querySelector('.brand').click();
  return { 屏幕: document.body.dataset.screen,
           选中方向: document.querySelectorAll('.cat[aria-pressed="true"]').length,
           session: sessionStorage.getItem('whale-oracle-session') };
})()`);
check('点 logo 回到首屏并清空局面',
  brand.屏幕 === 'category' && !brand.session && brand.选中方向 === 0,
  `屏幕=${brand.屏幕}，选中方向=${brand.选中方向}，session=${brand.session ? '仍在' : '已清'}`);

/* ─── 14. 无脚本错误 ─── */
check('无 JS 异常', errors.length === 0, errors.slice(0, 3).join(' | ') || '无');

/* ─── 汇总 ─── */
console.log('\n通过：');
for (const s of ok) console.log('  ✓ ' + s);
if (fail.length) {
  console.log('\n未通过：');
  for (const s of fail) console.log('  ✗ ' + s);
}
console.log(`\n合计 ${ok.length} 项通过 / ${fail.length} 项未通过`);
console.log('截图：' + SHOTS);

ws.close(); try { child.kill(); } catch { /* 已退出 */ }
process.exit(fail.length ? 1 : 0);
