/* ===========================================================
   断点回归：各视口下卡面比例 / 横向滚动 / 铺牌张数
   用法：node tools/verify-breakpoints.mjs   （需先在 4173 起 serve.mjs）
   截图落在 .shots/bp/
   =========================================================== */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
/* 路径基于 cwd（从仓库根目录跑）；不要用 URL.pathname——它保留百分号编码，
   中文路径下会走错目录 */
const PROFILE = join(tmpdir(), 'dsh-bp-profile');
const SHOTS = resolve('.shots/bp');
const PORT = 9349;
const SITE = 'http://127.0.0.1:4173/';

await rm(PROFILE, { recursive: true, force: true });
await mkdir(PROFILE, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const child = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { /* 等 */ } }
if (!wsUrl) { console.error('Edge 未就绪'); process.exit(1); }
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) await writeFile(join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
/* 绕开 Service Worker：它会把上一次缓存下来的 CSS 返回给页面，
   于是「刚改的样式」测出来是旧的（实测确认过，排查花了不少时间）。 */
await send('Network.setBypassServiceWorker', { bypass: true });

const VIEWPORTS = [
  { w: 1920, h: 1080, label: '1920x1080 桌面大屏' },
  { w: 1600, h: 900, label: '1600x900 桌面' },
  { w: 1440, h: 900, label: '1440x900 桌面' },
  { w: 1280, h: 800, label: '1280x800 笔记本' },
  { w: 1024, h: 768, label: '1024x768 小笔记本' },
  { w: 900, h: 700, label: '900x700 窄且矮' },
  { w: 820, h: 1180, label: '820x1180 竖屏平板' },
  { w: 680, h: 900, label: '680x900 小平板' },
  { w: 420, h: 800, label: '420x800 手机' },
  { w: 375, h: 667, label: '375x667 小手机' },
];

const rows = [];
for (const vp of VIEWPORTS) {
  /* mobile:false + 精确宽度：mobile:true 会引入视口缩放，
     量出来的 innerHeight 与设定值不符（设定 900 实测 1055），
     会把「模拟参数问题」误报成布局溢出。 */
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
  /* 清掉上一轮的牌局：否则 navigate 后会直接恢复进抽牌台，
     「首屏」那一组量的其实不是首屏 */
  await evalJS(`sessionStorage.clear()`).catch(() => {});
  await send('Page.navigate', { url: SITE });
  await sleep(1400);
  /* 等字体真正就绪再量尺寸。font-display:swap 期间用的是回退字体，
     字宽不同会量出假的横向溢出（实测早采样会报 128~425px 的溢出，
     等 fonts.ready 之后是 0）。 */
  await evalJS(`document.fonts.ready.then(() => true)`);
  await sleep(700);

  /* 首屏：横向滚动检查 */
  const home = await evalJS(`(() => ({
    横向溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    标题可见: !!document.querySelector('.title'),
    方向卡片数: document.querySelectorAll('.cat').length,
  }))()`);

  /* 走到抽牌台 */
  await evalJS(`document.querySelector('.cat[data-key="career"]').click()`);
  await sleep(120);
  await evalJS(`document.querySelector('#toSpread').click()`);
  await sleep(220);
  await evalJS(`document.querySelector('.spread[data-key="celtic7"]').click()`);
  await sleep(120);
  await evalJS(`document.querySelector('#toDraw').click()`);
  await sleep(3400);
  await evalJS(`document.fonts.ready.then(() => true)`);
  await sleep(500);

  const draw = await evalJS(`(() => {
    const cards = [...document.querySelectorAll('.fan-grid .card')];
    const c = cards[0];
    const r = c.getBoundingClientRect();
    const svg = c.querySelector('svg.card-art');
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    const s = Math.min(r.width / vb[2], r.height / vb[3]);
    const last = cards[cards.length - 1].getBoundingClientRect();
    const grid = document.querySelector('.fan-grid').getBoundingClientRect();
    /* 找出真正把文档撑宽的元素；.sky 里的星云/极光是故意超出后被 overflow:hidden 裁掉的 */
    const cw = document.documentElement.clientWidth;
    const off = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.sky')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > cw + 1) {
        off.push(el.tagName + '.' + String(el.className).slice(0, 38)
          + ' w=' + Math.round(b.width) + ' left=' + Math.round(b.left) + ' right=' + Math.round(b.right)
          + ' ovf=' + cs.overflowX + ' minW=' + cs.minWidth);
      }
    }
    return {
      卡宽: +r.width.toFixed(1), 卡高: +r.height.toFixed(1),
      比例: +(r.width / r.height).toFixed(4),
      暗边: +(r.width - vb[2] * s).toFixed(2),
      张数: cards.length,
      列数: new Set(cards.map(x => Math.round(x.getBoundingClientRect().left))).size,
      末排底部: Math.round(last.bottom),
      视口高: window.innerHeight,
      整页可滚: document.documentElement.scrollHeight - window.innerHeight,
      横向溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      网格右边界溢出: Math.round(grid.right - cw),
      溢出元素: off.slice(0, 6),
    };
  })()`);

  const ratioOk = Math.abs(draw.比例 - 300 / 520) < 0.003 && draw.暗边 < 0.5;
  const noOverflow = draw.横向溢出 <= 0 && draw.网格右边界溢出 <= 0;
  const countOk = draw.张数 >= 9 && draw.张数 <= 21;
  const pass = ratioOk && noOverflow && countOk && home.横向溢出 <= 0;

  rows.push({ 视口: vp.label, 卡尺寸: `${draw.卡宽}×${draw.卡高}`, 比例: draw.比例, 暗边: draw.暗边,
    张数: draw.张数, 列数: draw.列数, 末排底部: draw.末排底部, 视口高: draw.视口高,
    整页可滚: draw.整页可滚, 首屏溢出: home.横向溢出, 抽牌台溢出: draw.横向溢出, 结果: pass ? 'PASS' : 'FAIL' });

  if (!pass) {
    console.log(`  ✗ ${vp.label}: 比例=${draw.比例} 暗边=${draw.暗边} 抽牌台溢出=${draw.横向溢出} 首屏溢出=${home.横向溢出} 张数=${draw.张数}`);
    for (const o of draw.溢出元素) console.log(`      溢出元素 → ${o}`);
  }

  await shot(vp.label.replace(/[^\w\u4e00-\u9fff]+/g, '_'));
}

/* 解读页断点（celtic7 在窄屏应改为顺序流） */
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: SITE });
await sleep(2200);
await evalJS(`document.querySelector('.cat[data-key="career"]').click()`);
await sleep(120);
await evalJS(`document.querySelector('#toSpread').click()`);
await sleep(220);
await evalJS(`document.querySelector('.spread[data-key="cross5"]').click()`);
await sleep(120);
await evalJS(`document.querySelector('#toDraw').click()`);
await sleep(3400);
for (let i = 0; i < 5; i++) {
  await evalJS(`(() => { const c = [...document.querySelectorAll('.fan-grid .card')].find(x => !x.classList.contains('is-picked')); if (c) c.click(); })()`);
  /* 抽牌一步要 60 + 820(翻牌) + hold + 320 ≈ 5.0~6.2 秒（hold 随牌阵张数变），
     等太短会被 state.busy 挡掉下一次点击 */
  await sleep(6000);
}
await evalJS(`document.getElementById('flipAllBtn').click()`);
await sleep(5500);
await shot('解读页_1440');

console.log('\n断点回归结果：');
console.table(rows);
console.log(`JS 异常：${errors.length ? errors.slice(0, 3).join(' | ') : '无'}`);
const failed = rows.filter((r) => r.结果 === 'FAIL');
console.log(`\n${rows.length - failed.length}/${rows.length} 个视口通过`);
console.log('截图：' + SHOTS);

ws.close(); try { child.kill(); } catch { /* 已退出 */ }
process.exit(failed.length || errors.length ? 1 : 0);
