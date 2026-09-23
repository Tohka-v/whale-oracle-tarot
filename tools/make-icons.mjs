/* ===========================================================
   tools/make-icons.mjs · 生成 PWA 图标

   PWA 图标 ≠ favicon，两处用途不同：
     · favicon（assets/icons/favicon-16/32.png + index.html 里的图标）
       出现在**浏览器标签页、书签栏**，实际渲染尺寸 16~32px；
     · PWA 图标（manifest.webmanifest 里声明的 192 / 512 / maskable-512）
       只在**「添加到主屏幕 / 安装成应用」**时出现：安卓桌面图标、iOS 主屏图标、
       Windows 任务栏与开始菜单里的应用图标。浏览器标签页**不看**这几个文件。

   图形来源：tools/icon-art.mjs 里的候选（`--key` 选，默认 DEFAULT_KEY）。
     · 矢量候选（a d e f h i）：SVG 直接画进 canvas；
     · 光栅候选（g，当前选用）：就是品牌插画本身，圆形裁切后压在夜空渐变上。
       图源优先 `assets/brand/mark-1024.webp`（brand-fit.py 从 4096 原图裁的），
       再退回顶栏那份 256px——512 图标拿 256 放大会发虚，所以有 1024 就用 1024。

   为什么用浏览器而不是图像库：SVG 里的 mask 与渐变只有浏览器能原样渲染，
   Pillow / System.Drawing 都不行。做法是最朴素的——扔进 <img>，
   再按目标尺寸 drawImage 进 canvas，直接拿 PNG，不需要打开站点。

   用法：
     node tools/make-icons.mjs                                   # 写 assets/icons/
     node tools/make-icons.mjs --out .shots/brand/pwa-preview    # 只预览不覆盖
     node tools/make-icons.mjs --key i                           # 换成矢量候选试试
     node tools/make-icons.mjs --src assets/brand/mark.webp      # 指定光栅图源
   =========================================================== */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  CANDIDATES, DEFAULT_KEY, byKey, iconSvg, resolveMarkSource, BG_TOP, BG_BOTTOM,
} from './icon-art.mjs';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
if (!EDGE) { console.error('找不到 Edge'); process.exit(1); }

const ROOT = resolve(import.meta.dirname, '..');

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
};

const KEY = arg('key', DEFAULT_KEY);
const layer = byKey(KEY);
if (!layer) {
  console.error(`未知图形 ${KEY}；可选：${CANDIDATES.map((c) => c.key).join(' ')}`);
  process.exit(2);
}
const OUT = resolve(ROOT, arg('out', 'assets/icons'));
const PROFILE = join(tmpdir(), 'dsh-icon-profile');
const PORT = 9347;

/* 光栅图源（只有 layer.raster 才需要） */
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
let rasterUri = null;
if (layer.raster) {
  /* 候选可以带 src 指到别的图（例如 tools/brand-recolor.py 出的深发版），
     没写就按 MARK_SOURCES 取第一个可用的；--src 可以强制覆盖。 */
  const src = resolveMarkSource(ROOT, layer.src || arg('src'));
  if (!src) { console.error('找不到品牌图源（assets/brand/mark-1024.webp 或 mark.webp）'); process.exit(1); }
  const ext = src.slice(src.lastIndexOf('.')).toLowerCase();
  if (!MIME[ext]) { console.error(`不认识的光栅格式：${ext}`); process.exit(2); }
  rasterUri = `data:${MIME[ext]};base64,` + (await readFile(src)).toString('base64');
  console.log(`图源：${src.replace(ROOT, '.')}  ${(Buffer.byteLength(rasterUri, 'utf8') / 1024).toFixed(0)} KB(base64)`);
}

/* any：交给平台自己加遮罩，形体放大到 0.9（留一点边，别顶到圆角外的透明区）
   maskable：内容必须落在中心 80% 直径的安全区内，收到 0.62 */
const SPECS = [
  { size: 512, inset: 0.9, bg: 'gradient', file: 'icon-512.png' },
  { size: 192, inset: 0.9, bg: 'gradient', file: 'icon-192.png' },
  { size: 512, inset: 0.62, bg: 'gradient', file: 'icon-maskable-512.png' },
];

await rm(PROFILE, { recursive: true, force: true });
await mkdir(PROFILE, { recursive: true });
await mkdir(OUT, { recursive: true });

const child = spawn(EDGE, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--window-size=512,512', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(300);
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { /* 等 */ }
}
if (!wsUrl) { console.error('Edge 调试端口未就绪'); process.exit(1); }

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
});
const evalJS = async (expr) => (await send('Runtime.evaluate', {
  expression: expr, awaitPromise: true, returnByValue: true,
})).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: 'about:blank' });
await sleep(300);

console.log(`图形：${KEY}${layer.raster ? '（光栅 · 品牌插画）' : '（矢量）'} · ${layer.label}`);
console.log('图标：');

for (const { size, inset, bg, file } of SPECS) {
  const dia = size * inset;
  let draw;
  if (layer.raster) {
    /* 夜空渐变打底 + 圆形裁切的插画。渐进折半再采样：1024 → 192 一步画下去
       细节会乱成噪点，每次减半等效盒式滤波。 */
    draw = `
      const img = new Image();
      img.src = ${JSON.stringify(rasterUri)};
      await img.decode();
      const grad = g.createLinearGradient(0, 0, 0, ${size});
      grad.addColorStop(0, ${JSON.stringify(BG_TOP)});
      grad.addColorStop(1, ${JSON.stringify(BG_BOTTOM)});
      g.fillStyle = grad;
      g.fillRect(0, 0, ${size}, ${size});
      /* 候选可以带归一化裁切框（比如「脸部特写」），先裁再缩：
         大图裁一小块再降采样，比整图缩下去清楚得多。 */
      const CROP = ${JSON.stringify(layer.crop || null)};
      let source = img;
      if (CROP) {
        const W = img.naturalWidth; const H = img.naturalHeight;
        const sx = Math.round(CROP.x * W); const sy = Math.round(CROP.y * H);
        const sw = Math.round(CROP.w * W); const sh = Math.round(CROP.h * H);
        const k = Math.min(1, 2048 / Math.max(sw, sh));
        const cc = document.createElement('canvas');
        cc.width = Math.max(1, Math.round(sw * k));
        cc.height = Math.max(1, Math.round(sh * k));
        const cg = cc.getContext('2d');
        cg.imageSmoothingQuality = 'high';
        cg.drawImage(img, sx, sy, sw, sh, 0, 0, cc.width, cc.height);
        source = cc;
      }
      let cur = source; let w = source.width; let h = source.height;
      while (w >= ${dia} * 2 && h >= ${dia} * 2) {
        const nw = Math.floor(w / 2); const nh = Math.floor(h / 2);
        const c2 = document.createElement('canvas');
        c2.width = nw; c2.height = nh;
        const g2 = c2.getContext('2d');
        g2.imageSmoothingQuality = 'high';
        g2.drawImage(cur, 0, 0, nw, nh);
        cur = c2; w = nw; h = nh;
      }
      g.save();
      g.beginPath();
      g.arc(${size} / 2, ${size} / 2, ${dia} / 2, 0, Math.PI * 2);
      g.clip();
      g.drawImage(cur, ${size} / 2 - ${dia} / 2, ${size} / 2 - ${dia} / 2, ${dia}, ${dia});
      g.restore();`;
  } else {
    const svgUri = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(KEY, { bg, inset }));
    /* JSON.stringify 包 data URL：encodeURIComponent 不转义 ! ' ( ) *，
       SVG 属性又全是单引号，手写 '${...}' 会在第一个 xmlns='...' 处把字符串截断。 */
    draw = `
      const img = new Image();
      img.src = ${JSON.stringify(svgUri)};
      await img.decode();
      g.drawImage(img, 0, 0, ${size}, ${size});`;
  }

  const out = await evalJS(`(async () => {
    try {
      const c = document.createElement('canvas');
      c.width = ${size}; c.height = ${size};
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      ${draw}
      return c.toDataURL('image/png');
    } catch (e) { return 'ERR: ' + e.message; }
  })()`);
  if (!out || out.startsWith('ERR')) { console.error(`  ${file} 渲染失败：${out || '无返回'}`); continue; }
  const buf = Buffer.from(out.split(',')[1], 'base64');
  const dest = resolve(OUT, file);
  await writeFile(dest, buf);
  const { size: bytes } = await stat(dest);
  console.log(`  ${file}  ${size}×${size}（内容 ${Math.round(inset * 100)}%）  ${(bytes / 1024).toFixed(1)} KB`);
}

ws.close();
try { child.kill(); } catch { /* 已退出 */ }
console.log(`\n已写入 ${OUT}`);
process.exit(0);
