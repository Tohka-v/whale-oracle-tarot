/* ===========================================================
   tools/smoke-tools.mjs · 校对工具页冒烟测试
   逐个打开 tools/*.html，检查是否抛错 / 是否白屏。
   用法：node tools/smoke-tools.mjs [baseUrl]
   =========================================================== */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const PORT = 9411;
const EXE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const pages = readdirSync('tools').filter((f) => f.endsWith('.html')).sort();

const child = spawn(EXE, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--hide-scrollbars', '--no-first-run', '--mute-audio',
  `--user-data-dir=${process.cwd()}\\.shots\\smoke-profile`,
  `--remote-debugging-port=${PORT}`, '--window-size=1280,1000', 'about:blank',
], { stdio: 'ignore' });

let list = null;
for (let i = 0; i < 60; i++) {
  try {
    list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (list?.length) break;
  } catch { /* retry */ }
  await sleep(300);
}
if (!list?.length) { console.error('浏览器未启动'); child.kill(); process.exit(2); }

const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pend = new Map();
const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const { res, rej } = pend.get(m.id);
    pend.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    events.push('异常: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0]);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    events.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0]);
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    events.push('日志: ' + m.params.entry.text);
  }
});
const rpc = (method, params = {}) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => pend.set(mid, { res, rej }));
};
const ev = async (expr) => {
  const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await rpc('Runtime.enable');
await rpc('Page.enable');
await rpc('Log.enable');

let bad = 0;
console.log('工具页冒烟测试：');
for (const p of pages) {
  events.length = 0;
  await rpc('Page.navigate', { url: `${BASE}/tools/${p}` });
  await sleep(2600);
  const info = await ev(`(() => {
    const errBox = document.querySelector('#err, .err, pre');
    const errText = errBox && /出错|Error|FAIL/i.test(errBox.textContent || '') ? (errBox.textContent || '').slice(0, 90) : '';
    const body = document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim() : '';
    return JSON.stringify({
      title: document.title || '(无标题)',
      svgCount: document.querySelectorAll('svg').length,
      bodyLen: body.length,
      errText,
      noSvg: document.documentElement.dataset.noSvg === '1',
    });
  })()`);
  const o = JSON.parse(info);
  const problems = [];
  if (events.length) problems.push(...events.slice(0, 2));
  if (o.errText) problems.push('页面报错框: ' + o.errText);
  /* 控制台类页面（如 studio.html）本来就没有 SVG，用 data-no-svg="1" 声明豁免 */
  if (o.svgCount === 0 && !o.noSvg) problems.push('没有任何 SVG（疑似白屏）');
  if (o.bodyLen < (o.noSvg ? 60 : 10)) problems.push('正文过少（疑似白屏）');

  /* art-check 在还没有插画素材时会正常地 404（它在对比「有图/无图」）——
     这种情况只提示，不算失败 */
  const onlyMissingArt = problems.length > 0 && problems.every((x) => /404/.test(x));

  if (problems.length && !onlyMissingArt) {
    bad++;
    console.log(`  ✘ ${p}`);
    problems.forEach((x) => console.log(`      ${x}`));
  } else if (onlyMissingArt) {
    console.log(`  ○ ${p.padEnd(20)} svg=${String(o.svgCount).padStart(3)}  正常（素材尚未生成，404 属预期）`);
  } else {
    console.log(`  ✔ ${p.padEnd(20)} svg=${String(o.svgCount).padStart(3)}  文本=${String(o.bodyLen).padStart(5)}  「${o.title}」`);
  }
}

child.kill();
console.log(bad ? `\n${bad} 个工具页有问题` : '\n全部工具页正常');
process.exit(bad ? 1 : 0);
