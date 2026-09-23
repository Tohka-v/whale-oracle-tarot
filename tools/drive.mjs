/* ===========================================================
   tools/drive.mjs · 无头浏览器端到端走查
   用 CDP 直接驱动 Edge，把整条流程跑一遍并逐步截图，
   同时收集 console 报错与页面异常。
   用法：node tools/drive.mjs [baseUrl] [outDir]
   =========================================================== */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const OUT = resolve(process.argv[3] || '.shots/flow');
const PORT = 9331;

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('找不到 Edge/Chrome');
  process.exit(2);
}

/* ───────── 最小 WebSocket 客户端 ───────── */
class WS {
  constructor(url) {
    const u = new URL(url);
    this.sock = connect(Number(u.port), u.hostname);
    this.buf = Buffer.alloc(0);
    this.waiters = [];
    this.hsDone = false;
    this.handshake = new Promise((res) => { this._hs = res; });
    this.sock.on('error', () => {});
    this.sock.on('data', (d) => this._onData(d));
    const key = Buffer.from(`${Math.random()}${Date.now()}`).toString('base64').slice(0, 24);
    this.sock.write(
      `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
    );
  }

  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (!this.hsDone) {
      const i = this.buf.indexOf('\r\n\r\n');
      if (i === -1) return;
      this.buf = this.buf.subarray(i + 4);
      this.hsDone = true;
      this._hs();
    }
    while (this.buf.length >= 2) {
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const len0 = b1 & 0x7f;
      let off = 2;
      let len = len0;
      if (len0 === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2); off = 4;
      } else if (len0 === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2)); off = 10;
      }
      if (this.buf.length < off + len) return;
      const payload = this.buf.subarray(off, off + len);
      this.buf = this.buf.subarray(off + len);
      const op = b0 & 0x0f;
      if (op === 0x1 || op === 0x2) this._deliver(payload.toString('utf8'));
    }
  }

  _deliver(text) {
    while (this.waiters.length) this.waiters.shift()(text);
  }

  _frame(str) {
    const payload = Buffer.from(str, 'utf8');
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
    else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2);
    }
    const mask = Buffer.from([1, 2, 3, 4]);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    return Buffer.concat([header, mask, masked]);
  }

  send(obj) { this.sock.write(this._frame(JSON.stringify(obj))); }
  next(timeout = 20000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('ws timeout')), timeout);
      this.waiters.push((text) => { clearTimeout(t); res(text); });
    });
  }
  close() { try { this.sock.destroy(); } catch { /* ignore */ } }
}

/* ───────── CDP ───────── */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws._deliver = (text) => {
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }
  on(fn) { this.listeners.add(fn); }
  cmd(method, params = {}, timeout = 25000) {
    const id = ++this.id;
    this.ws.send({ id, method, params });
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(`${method} timeout`)); }, timeout);
      this.pending.set(id, {
        res: (v) => { clearTimeout(t); res(v); },
        rej: (e) => { clearTimeout(t); rej(e); },
      });
    });
  }
  async eval(expr) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(`${r.exceptionDetails.text} :: ${r.exceptionDetails.exception?.description || ''}`);
    }
    return r.result.value;
  }
  async shot(name) {
    const r = await this.cmd('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(OUT, name), Buffer.from(r.data, 'base64'));
    return name;
  }
}

async function jsonList(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      return await (await fetch(url)).json();
    } catch {
      await sleep(300);
    }
  }
  throw new Error('无法连接 CDP: ' + url);
}

/* ───────── 主流程 ───────── */
await mkdir(OUT, { recursive: true });
const profile = join(tmpdir(), 'dsh-drive-profile');
await rm(profile, { recursive: true, force: true }).catch(() => {});

const child = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--hide-scrollbars', '--no-first-run', '--mute-audio',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

const problems = [];
const report = { base: BASE };
let cdp = null;

try {
  const list = await jsonList(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('没有可用的 page target');

  const ws = new WS(page.webSocketDebuggerUrl);
  await ws.handshake;
  await sleep(150);
  cdp = new CDP(ws);

  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      problems.push(`console.${msg.params.type}: ` + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      problems.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    }
  });

  await cdp.cmd('Runtime.enable');
  await cdp.cmd('Page.enable');
  await cdp.cmd('Log.enable');
  await cdp.cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const nav = async (url) => { await cdp.cmd('Page.navigate', { url }); await sleep(1500); };
  const pickCount = () => cdp.eval('document.querySelectorAll("#spreadSlots .slot-mini.is-filled").length');
  const click = (sel) => cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);

  /** 点一张牌并等它真正落位（动画约 2.4s，点太快会被流程忽略） */
  const pickOne = async () => {
    const before = await pickCount();
    await cdp.eval('(() => { const c = document.querySelectorAll("#fan .card:not(.is-picked)")[0]; if (c) c.click(); })()');
    for (let i = 0; i < 45; i++) {
      await sleep(200);
      const now = await pickCount();
      if (now > before) return now;
    }
    return before;
  };

  /* ── 1. 首屏 ── */
  await nav(`${BASE}/index.html`);
  await sleep(700);
  await cdp.shot('01-category.png');
  report.categoryButtons = await cdp.eval('document.querySelectorAll(".cat").length');
  report.spreadButtons = await cdp.eval('document.querySelectorAll(".spread").length');
  report.brandRendered = await cdp.eval('!!document.querySelector("#brandMark svg")');

  /* ── 2. 牌阵页 ── */
  await click('.cat');
  await sleep(300);
  await click('#toSpread');
  await sleep(900);
  await cdp.shot('02-spread.png');
  report.toSpreadEnabled = await cdp.eval('!document.getElementById("toSpread").disabled');

  /* ── 3. 五牌十字：洗牌后看扇形 ── */
  await cdp.eval('document.querySelectorAll(".spread")[3].click()');
  /* 第一步底部的「称呼 / 问题」输入框已于 2026-09-24 移除，这里顺手断言它真的没了 */
  report.legacyInputs = await cdp.eval('document.querySelectorAll("#userName, #userQuestion").length');
  await click('#toDraw');
  await sleep(3600);
  await cdp.shot('03-fan.png');
  report.fanCards = await cdp.eval('document.querySelectorAll("#fan .card").length');
  report.deckLayers = await cdp.eval('document.querySelectorAll("#deck .deck__layer").length');
  report.fanSpread = await cdp.eval(`(() => {
    const cs = [...document.querySelectorAll('#fan .card')];
    const rects = cs.map(c => c.getBoundingClientRect());
    return JSON.stringify({
      count: cs.length,
      firstLeft: Math.round(rects[0].left),
      lastRight: Math.round(rects[rects.length - 1].right),
      viewport: document.documentElement.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
    });
  })()`);
  report.fanCaption = await cdp.eval('document.getElementById("fanCaption").textContent');

  /* ── 4. 抽满五张 ── */
  await pickOne();
  await sleep(300);
  await cdp.shot('04-picked-1.png');
  report.fanCaptionAfter1 = await cdp.eval('document.getElementById("fanCaption").textContent');
  for (let i = 1; i < 5; i++) await pickOne();
  await sleep(500);
  await cdp.shot('05-picked-all.png');
  report.pickedSlots = await pickCount();
  report.progress = await cdp.eval('document.getElementById("progressLabel").textContent');
  report.flipButtonVisible = await cdp.eval('!document.getElementById("flipAllBtn").hidden');
  report.stageHidden = await cdp.eval('document.querySelector(".stage-slot") ? "still-present" : "removed"');
  /* 选牌区已改为等距平铺网格 + 原地翻牌 */
  report.pickerLayout = await cdp.eval(`(() => {
    const cards = [...document.querySelectorAll('#fan .card')];
    const rects = cards.map(c => c.getBoundingClientRect());
    const rows = [...new Set(rects.map(r => Math.round(r.top)))];
    const overlap = cards.some((c, i) => rects.some((r, j) => i < j
      && !(rects[i].right <= r.left + 0.5 || r.right <= rects[i].left + 0.5
        || rects[i].bottom <= r.top + 0.5 || r.bottom <= rects[i].top + 0.5)));
    return JSON.stringify({
      rows: rows.length,
      perRow: rows.map(t => rects.filter(r => Math.round(r.top) === t).length),
      cardSize: Math.round(rects[0].width) + 'x' + Math.round(rects[0].height),
      overlap,
    });
  })()`);
  report.pickedFlipped = await cdp.eval('document.querySelectorAll("#fan .card.is-picked.is-flipped").length');
  report.slotChipTexts = await cdp.eval('[...document.querySelectorAll("#spreadSlots .slot-mini")].map(s=>s.textContent).join(" | ")');

  /* ── 5. 解读页 ── */
  await click('#flipAllBtn');
  await sleep(3600);
  await cdp.shot('06-reading-cross.png');
  report.readingCards = await cdp.eval('document.querySelectorAll("#readingLayout .card").length');
  report.summaryRendered = await cdp.eval('!!document.querySelector(".reading-summary")');
  report.summaryHead = await cdp.eval('(document.querySelector(".reading-summary")||{}).innerText?.slice(0,320) || ""');
  report.reversedRendered = await cdp.eval('document.querySelectorAll("#readingLayout .card.is-reversed").length');
  report.readingScrollHeight = await cdp.eval('document.documentElement.scrollHeight');

  /* ── 6. 单张牌详情 ── */
  await cdp.eval('document.querySelectorAll(".reading-card__toggle")[1].click()');
  await sleep(800);
  await cdp.shot('07-detail.png');
  report.detailTitle = await cdp.eval('document.getElementById("detailTitle").textContent');
  report.detailTextLength = await cdp.eval('document.getElementById("detailText").textContent.length');
  report.detailExtraLength = await cdp.eval('document.getElementById("detailExtra").textContent.length');
  await cdp.eval('document.querySelector("#detailModal .modal__close").click()');
  await sleep(400);

  /* ── 7. 七牌纵深 ── */
  await click('[data-back="spread"]');
  await sleep(700);
  await cdp.eval('document.querySelectorAll(".spread")[4].click()');
  report.celticSelected = await cdp.eval('document.querySelectorAll(".spread")[4].getAttribute("aria-pressed")');
  await click('#toDraw');
  await sleep(3400);
  report.celticDrawTitle = await cdp.eval('document.getElementById("drawTitle").textContent');
  for (let i = 0; i < 7; i++) await pickOne();
  report.celticPicked = await pickCount();
  await click('#flipAllBtn');
  await sleep(4000);
  await cdp.shot('08-reading-seven.png');
  report.celticCards = await cdp.eval('document.querySelectorAll("#readingLayout .card").length');
  report.celticColumns = await cdp.eval('getComputedStyle(document.getElementById("readingLayout")).gridTemplateColumns');
  report.celticRows = await cdp.eval('getComputedStyle(document.getElementById("readingLayout")).gridTemplateRows');

  /* ── 8. 移动端（用 1x 缩放，保证 CSS 视口宽度就是 390） ── */
  await cdp.cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.eval('window.dispatchEvent(new Event("resize"))');
  await sleep(900);
  await cdp.eval('document.querySelectorAll(".reading-card__toggle")[0].click()');
  await sleep(200);
  await cdp.eval('document.querySelector("#detailModal .modal__close").click()');
  await sleep(500);
  await cdp.shot('09-mobile-reading.png');
  report.mobileViewport = await cdp.eval('JSON.stringify({inner: window.innerWidth, client: document.documentElement.clientWidth, dpr: window.devicePixelRatio})');
  report.mobileCardOrder = await cdp.eval('[...document.querySelectorAll("#readingLayout .reading-card__pos")].map(e=>e.textContent.split("·")[0].trim()).join(",")');
  report.mobileMediaQueries = await cdp.eval(`JSON.stringify({
    mq680: matchMedia('(max-width: 680px)').matches,
    mq760: matchMedia('(max-width: 760px)').matches,
    mq820: matchMedia('(max-width: 820px)').matches,
    inner: window.innerWidth,
    client: document.documentElement.clientWidth,
    cardVar: getComputedStyle(document.documentElement).getPropertyValue('--card-w'),
  })`);
  report.mobileReadingCells = await cdp.eval(`(() => {
    const lay = document.getElementById('readingLayout');
    const wraps = [...lay.querySelectorAll('.reading-card')];
    const rows = [...new Set(wraps.map(w => Math.round(w.getBoundingClientRect().top)))];
    return JSON.stringify({
      cols: getComputedStyle(lay).gridTemplateColumns.split(' ').length,
      rows: rows.length,
      perRow: rows.map(t => wraps.filter(w => Math.round(w.getBoundingClientRect().top) === t).length),
    });
  })()`);

  await click('#againBtn');
  await sleep(900);
  await cdp.shot('10-mobile-category.png');
  await cdp.eval('document.querySelectorAll(".cat")[2].click()');
  await click('#toSpread');
  await sleep(700);
  await cdp.eval('document.querySelectorAll(".spread")[2].click()');
  await click('#toDraw');
  await sleep(3600);
  await cdp.shot('11-mobile-fan.png');
  report.mobileFanCards = await cdp.eval('document.querySelectorAll("#fan .card").length');
  report.mobileFanSpread = await cdp.eval(`(() => {
    const cs = [...document.querySelectorAll('#fan .card')];
    const rects = cs.map(c => c.getBoundingClientRect());
    return JSON.stringify({
      count: cs.length,
      firstLeft: Math.round(rects[0].left),
      lastRight: Math.round(rects[rects.length - 1].right),
      viewport: document.documentElement.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
    });
  })()`);
  report.mobileOverflowFan = await cdp.eval('document.documentElement.scrollWidth - document.documentElement.clientWidth');

  /* ── 9. 卡面图鉴 ── */
  await cdp.cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await click('#galleryBtn');
  await sleep(1400);
  await cdp.shot('13-gallery.png');
  report.galleryCards = await cdp.eval('document.querySelectorAll("#galleryGrid .gallery__item").length');
  report.gallerySections = await cdp.eval('[...document.querySelectorAll("#galleryGrid .gallery__section-title")].map(e=>e.textContent).join(" | ")');
  report.galleryCount = await cdp.eval('document.getElementById("galleryCount").textContent');
  report.galleryPlateText = await cdp.eval(`[...document.querySelectorAll('#galleryGrid .gallery__item')].slice(0,3).map(i => i.querySelector('.gallery__name').textContent + '/' + i.querySelector('.gallery__cn').textContent).join(' | ')`);

  /* 只看大阿卡纳 */
  await cdp.eval('[...document.querySelectorAll(".gallery__filter")].find(b=>b.dataset.key==="major").click()');
  await sleep(700);
  report.galleryMajor = await cdp.eval('document.querySelectorAll("#galleryGrid .gallery__item").length');

  /* 翻到牌背 */
  await click('#galleryFlip');
  await sleep(900);
  await cdp.shot('14-gallery-backs.png');
  report.galleryBackFaces = await cdp.eval('document.querySelectorAll("#galleryGrid .gallery__item .card__face--back").length');
  report.galleryFrontFlipped = await cdp.eval('document.querySelectorAll("#galleryGrid .gallery__item .card.is-flipped").length');
  await click('#galleryFlip');
  await sleep(700);

  /* 放大视图 + 左右切换 */
  await cdp.eval('document.querySelectorAll("#galleryGrid .gallery__item")[2].click()');
  await sleep(800);
  await cdp.shot('15-gallery-zoom.png');
  report.zoomTitle = await cdp.eval('document.getElementById("zoomTitle").textContent');
  report.zoomHasCard = await cdp.eval('!!document.querySelector("#zoomArt .card-art")');
  const beforeZoom = report.zoomTitle;
  await click('#zoomNext');
  await sleep(500);
  report.zoomNextChanged = (await cdp.eval('document.getElementById("zoomTitle").textContent')) !== beforeZoom;
  await click('#zoomPrev');
  await sleep(400);
  await cdp.eval('document.querySelector("#zoomModal .modal__close").click()');
  await sleep(300);
  await cdp.eval('document.querySelector("#galleryModal .modal__close").click()');
  await sleep(300);
  report.galleryClosed = await cdp.eval('document.getElementById("galleryModal").hidden && document.getElementById("zoomModal").hidden');

  /* ── 10. 规则弹窗 ── */
  await click('#helpBtn');
  await sleep(700);
  await cdp.shot('12-help.png');
  report.helpDocLength = await cdp.eval('document.getElementById("helpDoc").innerText.length');
  await cdp.eval('document.querySelector("#helpModal .modal__close").click()');
  await sleep(300);

  report.consoleProblems = problems;
  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (problems.length) process.exitCode = 1;
} catch (err) {
  console.error('走查失败：', err.message);
  if (cdp) {
    try { await cdp.shot('99-failure.png'); } catch { /* ignore */ }
  }
  process.exitCode = 1;
} finally {
  child.kill();
  await sleep(300);
}
