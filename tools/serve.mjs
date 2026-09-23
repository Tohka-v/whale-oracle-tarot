/* ===========================================================
   tools/serve.mjs · 零依赖静态服务器 + 卡面生成代理

   用法：
     node tools/serve.mjs                     # 默认 4173，绑定所有网卡（手机可访问）
     node tools/serve.mjs 8080                # 指定端口
     node tools/serve.mjs 4173 --local        # 只允许本机访问
     node tools/serve.mjs 4173 --no-qr        # 不打印二维码

   为什么需要服务端：浏览器不能安全保存第三方 API 密钥，也不能把生成的
   图片写进 assets/。所以这个进程负责：
     1) 静态托管站点；
     2) 代理「文生图」请求，把图片落盘到 assets/tarot/ 并刷新卡面清单。
   密钥只从请求体读取、即用即弃，不写入任何文件、不打印到日志。
   =========================================================== */

import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { extname, normalize, join, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { qrToTerminal } from './qr.mjs';
import { refreshManifest, ART_DIR, EXTS } from './manifest-lib.mjs';

const root = resolve(process.cwd());
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) || 4173);
const localOnly = args.includes('--local');
const noQr = args.includes('--no-qr');
const host = localOnly ? '127.0.0.1' : '0.0.0.0';

/* ───────── 局域网地址 ─────────
   手机只有在**同一个局域网**里才连得上。机器上常装着 VPN / 虚拟网卡
   （Radmin、VMware、Hyper-V…），它们也会报一个 IPv4，但那个地址手机够不着。
   所以这里标出哪些是真局域网，打印时分开列，别让人拿 VPN 的 IP 去试。 */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      out.push({ name, address: ni.address });
    }
  }
  const rank = (ip) => (/^192\.168\./.test(ip) ? 0
    : /^10\./.test(ip) ? 1
      : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  for (const a of out) a.lan = rank(a.address) < 3;
  return out.sort((a, b) => rank(a.address) - rank(b.address));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const json = (res, code, obj) => {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

async function readBody(req, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('请求体过大');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* ───────── 文生图供应商 ─────────
   sizeOptions 是给前端下拉用的候选；服务端只做格式校验，不硬拦，
   因为不同 Seedream 版本的取值规则一直在变（3.0 是固定尺寸串，
   5.0 变成了 1K/2K/3K/4K 档位或 宽x高），最终以上游返回为准。 */
const PROVIDERS = {
  ark: {
    label: '火山方舟 · 豆包 Seedream',
    /* 2026-09-23 换成 4.5：5.0 Lite 的成本明显更高，而卡面/图标这类
       「一次性出图、之后只降采样」的用途用不上 5.0 的增量能力。
       4.5 与 5.0 Lite 的能力差异（本页用不到的）：不支持 web_search、
       不支持 output_format（固定 JPEG）、支持 stream 与组图。
       ⚠️ 已有 78 张卡面是 5.0 Lite 出的，混用会让新牌画风与旧牌不一致。 */
    defaultModel: 'doubao-seedream-4-5-251128',
    url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    /* 尺寸规则按模型各不相同，官方速查表（2026-09）：
         · 档位预设   5.0 Pro: 1K/2K ｜ 5.0 Lite: 2K/3K/4K ｜ 4.5: 2K/4K ｜ 4.0: 1K/2K/4K
         · 显式 WxH   4.5 与 5.0 Lite 的像素积需落在 2560x1440 ~ 4096x4096，
                      长宽比 [1/16, 16]；4.0 的下限放宽到 1280x720
       所以这里**不能**列 3K——那是 5.0 Lite 专属档，4.5 会直接拒。 */
    sizeOptions: ['1472x2560', '1488x2560', '1536x2560', '2K', '4K'],
    defaultSize: '1472x2560',
    sizeNote: 'Seedream 4.5：档位只有 2K/4K（2K 出方图）；要竖版请用像素串，'
      + '像素积需 ≥ 2560×1440。1472x2560 最贴合卡面比例。',
    build: ({ model, prompt, size, key, seed }) => ({
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: {
        model, prompt, size,
        response_format: 'url',
        watermark: false,
        ...(seed ? { seed: Number(seed) } : {}),
      },
    }),
    pick: (j) => j?.data?.[0]?.url,
  },
  zhipu: {
    label: '智谱 BigModel',
    defaultModel: 'cogview-3-flash',
    url: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
    /* cogview 系列：512–2048，16 的整数倍，总像素 ≤ 2^21
       glm-image：1024–2048，32 的整数倍，总像素 ≤ 2^22
       注意：最贴卡面比例（300:520 = 0.577）的是 768x1344（0.571），
       不是 1024x1536（那是 2:3 = 0.667，偏宽，且不在 cogview-3-flash 的官方档位里）。 */
    sizeOptions: ['768x1344', '1024x1536', '864x1152', '1024x1024',
      '1056x1568', '1088x1472', '960x1728', '1280x1280'],
    defaultSize: '768x1344',
    sizeNote: '竖版 768x1344 最贴卡面比例（0.571 ≈ 卡面 0.577）。',
    build: ({ model, prompt, size, key }) => ({
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: { model, prompt, size, watermark_enabled: false },
    }),
    pick: (j) => j?.data?.[0]?.url,
  },
  siliconflow: {
    label: '硅基流动',
    defaultModel: 'Kwai-Kolors/Kolors',
    url: 'https://api.siliconflow.cn/v1/images/generations',
    sizeOptions: ['768x1344', '1024x1536', '1024x1024', '768x1024', '720x1280', '1024x768'],
    defaultSize: '768x1344',
    sizeNote: '竖版效果最适合卡面。',
    build: ({ model, prompt, size, key }) => ({
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: { model, prompt, image_size: size, batch_size: 1, num_inference_steps: 30, guidance_scale: 7.5 },
    }),
    pick: (j) => j?.images?.[0]?.url || j?.data?.[0]?.url,
  },
};

/* 尺寸校验：只挡明显不合法的输入，具体取值让上游判定 */
function checkSize(provider, size) {
  const s = String(size || '').trim();
  if (!s) return `尺寸不能为空，建议填 ${provider.defaultSize}`;
  if (/^[1-4]K$/i.test(s)) return null;               // 档位写法：1K/2K/3K/4K
  const m = /^(\d{2,5})x(\d{2,5})$/i.exec(s);
  if (!m) {
    return `尺寸格式不对：「${s}」。可以填档位（如 2K）或 宽x高（如 1024x1536）。`
      + `\n${provider.label} 常用取值：${provider.sizeOptions.join('、')}`;
  }
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w < 64 || h < 64) return `尺寸太小：${w}x${h}，两边都应 ≥ 64`;
  if (w * h > 2 ** 23) return `像素总量过大：${w}x${h}，请降到 4K 以内`;
  return null;
}

/* ───────── 轻量请求日志（只在内存里，最多 50 条） ───────── */
const recent = [];
function recordLog(entry) {
  recent.push({ t: new Date().toISOString(), ...entry });
  if (recent.length > 50) recent.shift();
}

/* ───────── 卡面清单刷新 ─────────
   生成逻辑见 tools/manifest-lib.mjs（与 tools/make-manifest.mjs 共用同一份实现，
   避免两处模板各写一份而漂移）。这里只负责把牌库喂进去——动态 import
   让服务启动时不必等牌库模块解析。 */
async function rebuildManifest() {
  const { DECK } = await import('../src/data/deck.js');
  return refreshManifest(DECK);
}

/* ───────── 服务 ───────── */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);

  /* —— 生成一张卡面 —— */
  if (path === '/api/studio/generate' && req.method === 'POST') {
    let ctx = {};
    try {
      const payload = JSON.parse(await readBody(req));
      const { provider = 'ark', model, prompt, size, cardId, key, seed } = payload;
      const p = PROVIDERS[provider];
      if (!p) return json(res, 400, { ok: false, error: `未知供应商 ${provider}` });
      if (!key) return json(res, 400, { ok: false, error: '缺少 API Key' });
      if (!prompt) return json(res, 400, { ok: false, error: '缺少提示词' });
      if (cardId && !/^[a-z0-9-]{3,24}$/.test(cardId)) {
        return json(res, 400, { ok: false, error: '牌 id 不合法' });
      }

      /* 尺寸：先用供应商默认值兜底，再校验 */
      const finalSize = String(size || p.defaultSize || '1024x1024').trim();
      const sizeErr = checkSize(p, finalSize);
      if (sizeErr) {
        recordLog({ provider, model, size: finalSize, cardId, ok: false, error: sizeErr });
        return json(res, 400, { ok: false, error: sizeErr, sizeOptions: p.sizeOptions, defaultSize: p.defaultSize });
      }
      ctx = { provider, model: model || p.defaultModel, size: finalSize, cardId };
      if (seed) ctx.seed = seed;

      const spec = p.build({ model: model || p.defaultModel, prompt, size: finalSize, key, seed });
      const apiRes = await fetch(p.url, {
        method: 'POST',
        headers: spec.headers,
        body: JSON.stringify(spec.body),
        signal: AbortSignal.timeout(180000),
      });
      const text = await apiRes.text();
      if (!apiRes.ok) {
        recordLog({ ...ctx, ok: false, status: apiRes.status, error: text.slice(0, 300) });
        return json(res, 502, {
          ok: false,
          error: `上游 HTTP ${apiRes.status}`,
          detail: text.slice(0, 800),
          sentSize: finalSize,
          sentModel: ctx.model,
          sizeOptions: p.sizeOptions,
          defaultSize: p.defaultSize,
        });
      }

      let j;
      try { j = JSON.parse(text); } catch {
        recordLog({ ...ctx, ok: false, error: '非 JSON' });
        return json(res, 502, { ok: false, error: '上游返回非 JSON', detail: text.slice(0, 300) });
      }
      const imgUrl = p.pick(j);
      if (!imgUrl) {
        recordLog({ ...ctx, ok: false, error: '无图片地址' });
        return json(res, 502, { ok: false, error: '未取到图片地址', detail: JSON.stringify(j).slice(0, 400) });
      }

      const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(120000) });
      if (!imgRes.ok) {
        recordLog({ ...ctx, ok: false, error: `下载失败 ${imgRes.status}` });
        return json(res, 502, { ok: false, error: `下载图片失败 HTTP ${imgRes.status}` });
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 2000) {
        recordLog({ ...ctx, ok: false, error: `图片过小 ${buf.length}B` });
        return json(res, 502, { ok: false, error: `图片过小（${buf.length}B）` });
      }

      const ct = imgRes.headers.get('content-type') || 'image/jpeg';
      let saved = null;
      if (cardId) {
        await mkdir(ART_DIR, { recursive: true });
        saved = `${cardId}${ct.includes('png') ? '.png' : '.jpg'}`;
        await writeFile(join(ART_DIR, saved), buf);
      }
      const manifest = saved ? await rebuildManifest() : null;
      recordLog({ ...ctx, ok: true, bytes: buf.length, saved });
      return json(res, 200, {
        ok: true,
        bytes: buf.length,
        saved,
        manifest,
        sentSize: finalSize,
        sentModel: ctx.model,
        preview: `data:${ct};base64,${buf.toString('base64')}`,
      });
    } catch (err) {
      recordLog({ ...ctx, ok: false, error: String(err?.message || err) });
      return json(res, 500, { ok: false, error: String(err?.message || err) });
    }
  }

  /* —— 最近的请求记录（排错用，不含密钥） —— */
  if (path === '/api/studio/logs' && req.method === 'GET') {
    return json(res, 200, { ok: true, logs: recent.slice().reverse() });
  }

  /* —— 刷新清单 —— */
  if (path === '/api/studio/refresh' && req.method === 'POST') {
    try { return json(res, 200, { ok: true, manifest: await rebuildManifest() }); }
    catch (err) { return json(res, 500, { ok: false, error: String(err?.message || err) }); }
  }

  /* —— 生成台需要的牌表与供应商 —— */
  if (path === '/api/studio/cards' && req.method === 'GET') {
    const { DECK } = await import('../src/data/deck.js');
    return json(res, 200, {
      ok: true,
      providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, {
        label: v.label,
        defaultModel: v.defaultModel,
        sizeOptions: v.sizeOptions,
        defaultSize: v.defaultSize,
        sizeNote: v.sizeNote || '',
      }])),
      cards: DECK.map((c) => ({
        id: c.id, name: c.name, en: c.en, arcana: c.arcana, suit: c.suit, number: c.number,
      })),
    });
  }

  /* —— 已生成的素材 —— */
  if (path === '/api/studio/existing' && req.method === 'GET') {
    await mkdir(ART_DIR, { recursive: true });
    const files = (await readdir(ART_DIR)).filter((f) => EXTS.has(extname(f).toLowerCase()));
    return json(res, 200, { ok: true, files });
  }

  /* —— 静态文件 —— */
  try {
    let p = path;
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, normalize(p).replace(/^([/\\])+/, ''));
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    const info = await stat(file);
    if (info.isDirectory()) { res.writeHead(302, { Location: `${p}/` }).end(); return; }

    /* 协商缓存。这是一个零构建站点，文件名没有内容哈希（改了文件刷新就该看到），
       所以不能给长 max-age。用 no-cache + ETag/Last-Modified：浏览器每次都发
       条件请求，内容没变就回 304——把「二次访问 4.3 MB」降到几十字节，
       同时保证改完文件刷新立刻生效。 */
    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const lastModified = info.mtime.toUTCString();
    const headers = {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etag,
      'Last-Modified': lastModified,
    };
    const inm = req.headers['if-none-match'];
    const fresh = inm
      ? inm.split(',').some((t) => t.trim() === etag || t.trim() === `W/${etag}`)
      : req.headers['if-modified-since'] === lastModified;
    if (fresh) { res.writeHead(304, headers); res.end(); return; }

    const body = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Length': body.length });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(err.code || err.message));
  }
});

/* ───────── 启动 ─────────
   端口被占用时自动往后找一个空闲的。用户双击 bat 时如果上一次的服务窗口
   还开着（或者有别的程序占了 4173），静默失败会让人一头雾水——
   表现就是「本机能开、手机怎么都连不上」。 */
let boundPort = port;
const MAX_PORT_TRIES = 10;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && boundPort - port < MAX_PORT_TRIES) {
    console.log(`  端口 ${boundPort} 已被占用，改用 ${boundPort + 1} …`);
    boundPort += 1;
    server.listen(boundPort, host);
    return;
  }
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  端口 ${port} ~ ${boundPort} 都被占用了，请手动换一个：`);
    console.error(`      启动服务器.bat ${boundPort + 1}\n`);
  } else if (err.code === 'EACCES') {
    console.error(`\n  没有权限绑定端口 ${boundPort}，换一个 1024 以上的端口试试。\n`);
  } else {
    console.error(`\n  启动失败：${err.message}\n`);
  }
  process.exit(1);
});

server.on('listening', () => {
  const addrs = lanAddresses();
  const line = '─'.repeat(56);
  console.log(`\n${line}`);
  console.log('  星海鲸语 · 本地服务已启动');
  console.log(line);
  console.log(`  本机：   http://127.0.0.1:${boundPort}/`);
  if (localOnly) {
    console.log('  局域网： 已禁用（--local）—— 手机连不上是正常的，去掉这个参数即可');
  } else if (addrs.length) {
    const lan = addrs.filter((a) => a.lan);
    const other = addrs.filter((a) => !a.lan);
    for (const a of lan) console.log(`  手机：   http://${a.address}:${boundPort}/   (${a.name})`);
    for (const a of other) {
      console.log(`  其他：   http://${a.address}:${boundPort}/   (${a.name} · 虚拟网卡，手机连不上)`);
    }
    if (!lan.length) {
      console.log('  ⚠ 没找到真正的局域网地址（192.168 / 10. / 172.16-31 网段）。');
      console.log('    请确认电脑已连上 Wi-Fi 或网线，然后重新启动本服务。');
    }
  } else {
    console.log('  局域网： 未检测到可用网卡');
  }
  console.log(`  生成台： http://127.0.0.1:${boundPort}/studio.html`);
  console.log(line);

  /* 二维码只指向真局域网地址：给 VPN 的 IP 生成的码扫了也打不开 */
  const qrAddr = addrs.find((a) => a.lan) || addrs[0];
  if (!localOnly && qrAddr && !noQr) {
    const target = `http://${qrAddr.address}:${boundPort}/`;
    try {
      console.log('\n  用手机相机扫这个码直接打开：\n');
      console.log(qrToTerminal(target, { quiet: 1 }));
      console.log(`\n  ${target}`);
    } catch (e) {
      console.log(`\n  （二维码生成失败：${e.message}）`);
    }
    console.log('\n  ⚠ 手机需与本机在同一个 Wi-Fi。若打不开，按顺序排查：');
    console.log('    1) 地址里的 IP 是不是上面「手机：」那一行显示的（VPN 网卡会给出另一个 IP，用错就连不上）');
    console.log('    2) Windows 防火墙是否放行了入站。以管理员身份运行一次：');
    console.log(`         New-NetFirewallRule -DisplayName "WhaleOracleTarot ${boundPort}" \``);
    console.log('           -Direction Inbound -Protocol TCP -LocalPort ' + boundPort
      + ' -Action Allow -Profile Private');
    console.log('    3) 路由器是否开了「AP 隔离 / 客户端隔离」——开了的话手机与电脑互相不通');
  }
  console.log('');
});

server.listen(boundPort, host);
