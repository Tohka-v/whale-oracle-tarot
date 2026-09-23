/* ===========================================================
   sw.js · Service Worker（PWA 离线）

   策略：
     · install  预缓存「壳」——HTML/CSS/全部 JS 模块/字体/牌背/图标，约 2 MB
                （其中 PWA 图标占约 0.6 MB：品牌插画版比原来的简笔图标大得多）。
                卡面插画刻意**不**预缓存：78 张原图约 20 MB，装机时白下没有意义。
     · fetch    同源 GET 才接管，分两条路：
                  - 导航请求：网络优先，离线回落缓存的首页
                  - 其余资源：缓存优先 + 后台更新（用过就留下）
     · activate 清掉旧版本缓存并立即接管

   ⚠ 作用域限制：Service Worker 需要安全上下文，只在
      http://127.0.0.1:4173 与 http://localhost 下生效。
      手机通过 http://192.168.x.x:4173 访问属于不安全上下文，
      SW 不会注册（功能不受影响，只是没有离线能力）。

   改版时把 VERSION 加一即可全量换新。
   =========================================================== */

const VERSION = 'v8';
const SHELL_CACHE = `whale-oracle-shell-${VERSION}`;
const RUNTIME_CACHE = `whale-oracle-runtime-${VERSION}`;
const KEEP = [SHELL_CACHE, RUNTIME_CACHE];

/* 站点基准路径 = SW 脚本自己所在的那个目录。
   部署在根目录是 '/'，部署在 GitHub Pages 项目页（用户名.github.io/仓库名/）
   就是 '/仓库名/'。预缓存与所有路径判断都以它为基准，
   这样同一份代码放根目录、放子目录、换域名都不用改。 */
const BASE = new URL('./', self.location).pathname;

/* ───────── 以下路径全部相对 BASE ─────────
   Service Worker 里相对 URL 以脚本自身地址解析，所以 './index.html' 就是
   BASE + 'index.html'。绝对路径（'/index.html'）在子目录部署时会指到域名根，
   正是上一版只能在根目录跑的原因。

   新增 src/ 模块后记得补进这里，否则离线时那个模块会 404。
   install 是逐个 add 的，漏写只会让该模块离线不可用，不会让整次安装失败。 */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/fonts.css',
  './styles/base.css',
  './styles/card.css',
  './styles/app.css',
  './src/main.js',
  './src/core/sky.js',
  './src/core/sound.js',
  './src/core/fx.js',
  './src/core/anim.js',
  './src/core/ui.js',
  './src/core/gallery.js',
  './src/core/reading.js',
  './src/core/session.js',
  './src/core/pwa.js',
  './src/art/card-art.js',
  './src/art/char-art.js',
  './src/art/svgkit.js',
  './src/art/whale-back.js',
  './src/data/rules.js',
  './src/data/deck.js',
  './src/data/meanings.js',
  './src/data/art-manifest.js',
  './fonts/NotoSansSC-400.subset.woff2',
  './fonts/NotoSerifSC-400.subset.woff2',
  './fonts/NotoSerifSC-600.subset.woff2',
  './fonts/Cinzel-400.woff2',
  './fonts/Cinzel-600.woff2',
  './fonts/Cormorant-400.woff2',
  './assets/back/medallion.jpg',
  './assets/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    /* 不加 cache:'reload'：这些资源页面刚加载过，条件请求基本都是 304，
       预缓存几乎不产生额外流量。
       逐个 add 而不是 addAll——任何一个 404 都不该让整次安装失败。 */
    const results = await Promise.allSettled(SHELL.map((u) => cache.add(u)));
    const failed = SHELL.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) console.warn('[sw] 预缓存失败：', failed);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** 图 / 字体 / 图标：内容基本不变，缓存优先省流量。
    入参是**去掉 BASE 之后**的路径，例如 'assets/tarot/xx.webp'。 */
const isStatic = (rel) => rel.startsWith('assets/') || rel.startsWith('fonts/');

/** 代码类：改动频繁，必须网络优先。
    早先一律用「缓存优先 + 后台更新」，结果改完 CSS 刷新看到的还是旧样式，
    要刷两次才更新——排查了很久才发现是 SW 把旧副本先返回了。 */
const isCode = (rel) => rel === '' || rel.endsWith('.html') || rel.endsWith('.css')
  || rel.endsWith('.js') || rel.endsWith('.mjs') || rel.endsWith('.webmanifest');

/* 首页在缓存里的键：统一用相对路径，子目录部署时才能命中 */
const INDEX = './index.html';

const OFFLINE = () => new Response('离线且无缓存', {
  status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  /* 站外路径不管（同域下别的东西也不该被这个 SW 接管） */
  if (!url.pathname.startsWith(BASE)) return;

  const rel = url.pathname.slice(BASE.length);   // '' / 'index.html' / 'assets/…'
  if (rel.startsWith('api/')) return;            // 生成台接口不缓存

  /* 导航：网络优先，离线回落首页 */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(INDEX, fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(INDEX)) || (await cache.match('./')) || OFFLINE();
      }
    })());
    return;
  }

  const cacheName = isStatic(rel) ? RUNTIME_CACHE : SHELL_CACHE;

  /* 代码类：网络优先，失败才回缓存 */
  if (isCode(rel)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || OFFLINE();
      }
    })());
    return;
  }

  /* 静态资源：缓存优先 + 后台更新（用过才留，不预缓存卡面） */
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(req);
    if (hit) {
      fetch(req)
        .then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); })
        .catch(() => { /* 离线：保留旧副本 */ });
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      return OFFLINE();
    }
  })());
});
