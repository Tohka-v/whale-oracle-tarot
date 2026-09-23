/* ===========================================================
   tools/make-favicon.mjs · 标签页图标（favicon）

   为什么单独一个脚本：favicon 的难点不是画，是**16×16 下还认不认得出**。
   所以这个脚本的主要产物其实不是 PNG，而是那张对照表——
   把候选按 16/32/64 渲染在浅色和深色两种标签栏底色上，
   看一眼就知道哪个能用。PNG 只是顺带落盘给不支持 SVG 图标的场合兜底。

   用法：
     node tools/make-favicon.mjs                 # 全部候选 → 对照表 .shots/brand/favicon-v2.png
     node tools/make-favicon.mjs --only a,d      # 只看某几个（逗号分隔）
     node tools/make-favicon.mjs --only h --pick h   # 只渲染 h，并写进 index.html

   候选（v2，2026-09-24）：
     a  粗新月 + 四角星（无环）    —— v1 选中并上线的版本，保留作基准
     d  金月牙 + 金环              —— 月牙改暖金，呼应顶栏的金环
     e  蓝月牙 + 金环 + 星         —— 结构与顶栏标记最接近
     f  月牙 + 鲸尾                —— 品牌双元素（月亮 + 鲸），16px 风险最高
     h  只有金月牙（无星无环）      —— 极简对照：星和环到底是帮忙还是添乱
     i  金月牙 + 星                —— **已上线**（用户 2026-09-24 选定）
     g  品牌图直接缩到 16px        —— 光栅对照组，用来证明「真图在这个尺寸不行」

   图形本身（含那个 mask 画新月的坑）在 tools/icon-art.mjs，与 PWA 图标共用一份定义。 */
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { CANDIDATES, DEFAULT_KEY, iconSvg, resolveMarkSource } from './icon-art.mjs';

/* ───────── 环境 ───────── */

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
if (!EDGE) { console.error('找不到 Edge'); process.exit(1); }

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'assets/icons');
const SHOTS = join(ROOT, '.shots/brand');
const PROFILE = join(tmpdir(), 'dsh-favicon-profile');
const PORT = 9346;
const SIZES = [16, 32, 64];

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
};
/* 光栅候选的图源是**逐个候选**解析的（候选可以带 src 指到别的图，
   例如 tools/brand-recolor.py 出的深发版），见下面 rasterKeys 那段。 */
const onlyList = (arg('only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const pick = arg('pick');
const shown = CANDIDATES.filter((c) => !onlyList.length || onlyList.includes(c.key));
if (!shown.length) { console.error('没有匹配的候选：' + onlyList.join(',')); process.exit(2); }

await rm(PROFILE, { recursive: true, force: true });
await mkdir(PROFILE, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const child = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--window-size=900,700', 'about:blank'],
  { stdio: 'ignore' });

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

let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const evalJS = async (expr) => (await send('Runtime.evaluate',
  { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'about:blank' });
await sleep(400);

/* ───────── 光栅候选：裁切 + 圆形蒙版后按目标尺寸重绘 ─────────
   必须走 canvas 重绘，直接 <img width=16> 是让浏览器做缩放，字面意义上看不清；
   这里保证用高质量的降采样。

   每个候选各自带 crop（归一化裁切框，见 icon-art.mjs），
   所以一个候选一次 evalJS——共用一份结果是不行的：裁切框不同，像素完全不同。 */
const rasterData = {};   // { key: { 16: dataURL, 32: ..., 64: ... } }
const rasterKeys = shown.filter((c) => c.raster);
/* 图源按候选取（候选可以带 src 指向另一张图，比如 tools/brand-recolor.py 出的深发版）；
   data URI 按路径缓存，同一张图被多个候选引用时只读一次。 */
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const uriCache = new Map();
async function uriOf(p) {
  if (!uriCache.has(p)) {
    const ext = p.slice(p.lastIndexOf('.')).toLowerCase();
    uriCache.set(p, `data:${MIME[ext] || 'image/webp'};base64,` + (await readFile(p)).toString('base64'));
  }
  return uriCache.get(p);
}
if (rasterKeys.length) {
  for (const rc of rasterKeys) {
    const srcPath = resolveMarkSource(ROOT, rc.src || arg('src'));
    if (!srcPath) { console.error(`候选 ${rc.key} 找不到图源，跳过`); continue; }
    const dataUri = await uriOf(srcPath);
    {
      const out = await evalJS(`(async () => {
      const img = new Image();
      img.src = ${JSON.stringify(dataUri)};
      await img.decode();
      const CROP = ${JSON.stringify(rc.crop || null)};
      /* 先按归一化裁切框取一块：大图裁小区域再缩放，比整图缩到 16px 清楚得多 */
      function cropTo(src, rect) {
        const W = src.naturalWidth; const H = src.naturalHeight;
        const sx = Math.round(rect.x * W); const sy = Math.round(rect.y * H);
        const sw = Math.round(rect.w * W); const sh = Math.round(rect.h * H);
        const k = Math.min(1, 1024 / Math.max(sw, sh));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
        const g2 = c.getContext('2d');
        g2.imageSmoothingQuality = 'high';
        g2.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return c;
      }
      /* 渐进折半：1024 → 16 一步画下去，浏览器只用一次双线性采样，
         细节会乱成噪点；每次减半再采样，等效于盒式滤波，小尺寸干净得多。 */
      function shrink(src, s) {
        let w = src.width || src.naturalWidth;
        let h = src.height || src.naturalHeight;
        let cur = src;
        while (w >= s * 2 && h >= s * 2) {
          const nw = Math.floor(w / 2); const nh = Math.floor(h / 2);
          const c = document.createElement('canvas');
          c.width = nw; c.height = nh;
          const g2 = c.getContext('2d');
          g2.imageSmoothingQuality = 'high';
          g2.drawImage(cur, 0, 0, nw, nh);
          cur = c; w = nw; h = nh;
        }
        return cur;
      }
      const base = CROP ? cropTo(img, CROP) : img;
      const res = {};
      for (const s of ${JSON.stringify(SIZES)}) {
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const g = c.getContext('2d');
        g.save();
        g.beginPath();
        g.arc(s / 2, s / 2, s / 2 - Math.max(0.5, s * 0.02), 0, Math.PI * 2);
        g.clip();
        g.imageSmoothingQuality = 'high';
        g.drawImage(shrink(base, s), 0, 0, s, s);
        g.restore();
        res[s] = c.toDataURL('image/png');
      }
      return JSON.stringify(res);
    })()`);
      try {
        rasterData[rc.key] = JSON.parse(out);
      } catch { console.error(`光栅候选 ${rc.key} 渲染失败：` + out); }
    }
  }
}

/** 取某个候选在某个尺寸下的图片地址（SVG 走 data URI，光栅走 canvas 结果） */
const srcOf = (c, s) => {
  if (!c.raster) return 'data:image/svg+xml,' + encodeURIComponent(iconSvg(c.key));
  const d = rasterData[c.key];
  return d ? d[String(s)] : '';
};

/* ───────── 对照表 ─────────
   每个候选 × 每个尺寸 × 浅色/深色标签栏。深色是现代浏览器深色主题下的标签栏，
   浅色是默认主题——favicon 两种底都得站得住。 */
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; padding:20px; background:#e9ecf3; font:13px/1.5 "Microsoft YaHei",sans-serif; color:#333; }
  .row { display:flex; align-items:center; gap:26px; padding:10px 0; border-bottom:1px solid #ccd3e0; }
  .name { width:260px; font-size:15px; }
  .cell { display:flex; flex-direction:column; align-items:center; gap:5px; }
  .light, .dark { display:flex; gap:14px; align-items:flex-end; padding:7px 12px; border-radius:8px; }
  .light { background:#f7f8fb; border:1px solid #d7dce8; }
  .dark  { background:#202124; border:1px solid #3a3d42; color:#aaa; }
  .dark .cap, .light .cap { font-size:10px; opacity:.7; }
  .cap { font-size:10px; }
  .strip { display:flex; gap:0; border-radius:10px 10px 0 0; overflow:hidden; border:1px solid #cfd6e4; }
  .tab { display:flex; align-items:center; gap:7px; padding:7px 14px; font-size:12px; background:#dfe4ee; color:#333; }
  .tab.active { background:#f7f8fb; }
</style>
<body>
<h2 style="margin:0 0 4px">favicon 真实尺寸对照（v2）</h2>
<p style="margin:0 0 14px;color:#667">左为浅色标签栏、右为深色标签栏。16px 那一格就是标签页上的真实大小。</p>
${shown.map((c) => `
<div class="row">
  <div class="name"><b>${c.key}</b> · ${c.label}</div>
  ${SIZES.map((s) => `<div class="cell">
      <div class="light"><img src="${srcOf(c, s)}" width="${s}" height="${s}"></div>
      <div class="dark"><img src="${srcOf(c, s)}" width="${s}" height="${s}"></div>
      <div class="cap">${s}px</div>
    </div>`).join('')}
</div>`).join('')}
<h3 style="margin:22px 0 8px">放进真实标签栏的样子（16px）</h3>
${shown.map((c) => `
<div class="strip">
  <div class="tab active"><img src="${srcOf(c, 16)}" width="16" height="16">星海鲸语 · 塔罗占卜</div>
  <div class="tab"><img src="${srcOf(c, 16)}" width="16" height="16">新标签页</div>
</div>`).join('<div style="height:14px"></div>')}
</body>`;

await send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) });
await sleep(1400);

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
if (shot.result?.data) {
  const f = join(SHOTS, 'favicon-v2.png');
  await writeFile(f, Buffer.from(shot.result.data, 'base64'));
  console.log(`对照表：${f}`);
}

/* ───────── 落盘 PNG 兜底 ─────────
   给不支持 SVG 图标的场合（以及 Windows 任务栏快捷方式）用。
   PNG 一定要按目标尺寸重绘，不能把 SVG 截一张图再缩放——非整数缩放会有半像素模糊。

   ⚠️ 这里必须用 JSON.stringify 把 data URL 包成 JS 字面量，不能手写单引号：
   encodeURIComponent **不转义** ! ' ( ) * 这几个字符（规范里它们属于
   非保留字符），而 SVG 的属性引号全是单引号——手写 '${...}' 会让字符串
   在第一个 xmlns='...' 处就被截断，表现为「渲染失败」而看不出原因。 */
const persistKey = pick || (onlyList.length === 1 ? onlyList[0] : DEFAULT_KEY);
const target = CANDIDATES.find((c) => c.key === persistKey);
if (target) {
  for (const s of [16, 32]) {
    let url;
    if (target.raster) {
      url = srcOf(target, s);
      if (!url) { console.error(`光栅候选 ${target.key} 缺 ${s}px，跳过`); continue; }
    } else {
      url = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(target.key));
    }
    const out = await evalJS(`(async () => {
      try {
        const img = new Image();
        img.src = ${JSON.stringify(url)};
        await img.decode();
        const c = document.createElement('canvas');
        c.width = ${s}; c.height = ${s};
        c.getContext('2d').drawImage(img, 0, 0, ${s}, ${s});
        return c.toDataURL('image/png');
      } catch (e) { return 'ERR: ' + e.message; }
    })()`);
    if (!out || out.startsWith('ERR')) { console.error(`渲染 ${s}px 失败：${out || '无返回'}`); continue; }
    const buf = Buffer.from(out.split(',')[1], 'base64');
    await writeFile(join(OUT, `favicon-${s}.png`), buf);
    console.log(`  favicon-${s}.png  ${(buf.length / 1024).toFixed(1)} KB  （来自候选 ${target.key}${target.raster ? '，光栅' : ''}）`);
  }
}

/* ───────── --pick：把选中的图标写回 index.html ─────────
   SVG 候选写成 SVG data URI；光栅候选写成 32px PNG 的 data URI——
   两者都只替换 href，head 里的结构（含 PNG 兜底那两行）保持原样，
   免得出现两个 sizes="32x32" 的 <link> 让浏览器自己猜。 */
if (pick) {
  const c = CANDIDATES.find((x) => x.key === pick);
  if (!c) { console.error(`未知候选 ${pick}`); process.exit(2); }
  const href = c.raster
    ? srcOf(c, 32)
    : 'data:image/svg+xml,' + encodeURIComponent(iconSvg(c.key));
  if (!href) { console.error(`候选 ${pick} 的图片没渲染出来，先别写`); process.exit(2); }
  const file = join(ROOT, 'index.html');
  const src = await readFile(file, 'utf8');
  /* 先取出旧的 href 再比，别用「替换后是否变化」来判断有没有匹配到：
     挑的就是当前那张时替换结果与原文一模一样，会被误报成「没匹配到」，
     而真正的「没匹配到」是另一回事（模板被改过）。 */
  const m = /(<link rel="icon" href=")([^"]*)(")/.exec(src);
  if (!m) { console.error('index.html 里没匹配到 <link rel="icon" href="…">，模板可能被改过'); process.exit(2); }
  if (m[2] === href) {
    console.log(`index.html 的图标已经是候选 ${pick} 了，无需改动`);
  } else {
    await writeFile(file, src.replace(m[0], m[1] + href + m[3]), 'utf8');
    console.log(`已把候选 ${pick}${c.raster ? '（光栅）' : ''} 写进 index.html 的 <link rel="icon">`
      + `（原 href ${m[2].length} 字符 → 新 ${href.length} 字符）`);
  }
}

ws.close();
try { child.kill(); } catch { /* 已退出 */ }
