/* ===========================================================
   tools/manifest-lib.mjs · 卡面清单生成逻辑

   由 tools/make-manifest.mjs（命令行）与 tools/serve.mjs（生成新图后刷新）
   共用同一份实现——以前两边各写一份模板，改一处忘一处就会漂移。
   =========================================================== */

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

export const ART_DIR = resolve('assets/tarot');
export const THUMB_DIR = join(ART_DIR, 'thumbs');
export const MANIFEST_PATH = resolve('src/data/art-manifest.js');
export const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** 扫描 assets/tarot/ 与 assets/tarot/thumbs/，重写 src/data/art-manifest.js */
export async function refreshManifest(DECK, { out = MANIFEST_PATH } = {}) {
  await mkdir(ART_DIR, { recursive: true });

  const ids = new Set(DECK.map((c) => c.id));
  const found = {};
  for (const f of await readdir(ART_DIR)) {
    const ext = extname(f).toLowerCase();
    if (!EXTS.has(ext)) continue;
    const id = f.slice(0, -ext.length);
    if (ids.has(id) && !found[id]) found[id] = f;
  }

  /* 缩略图是可选产物：缺了就由 artThumbUrl 回落到全尺寸原图，不会 404 */
  const thumbs = {};
  if (existsSync(THUMB_DIR)) {
    for (const f of await readdir(THUMB_DIR)) {
      const ext = extname(f).toLowerCase();
      if (ext !== '.webp') continue;
      const id = f.slice(0, -ext.length);
      if (ids.has(id)) thumbs[id] = f;
    }
  }

  const entries = Object.keys(found).sort().map((id) => `  '${id}': '${found[id]}',`).join('\n');
  const thumbEntries = Object.keys(thumbs).sort().map((id) => `  '${id}': '${thumbs[id]}',`).join('\n');

  const content = `/* ===========================================================
   art-manifest.js · 卡面插画清单（由 tools/make-manifest.mjs 生成，请勿手改）
   生成时间：${new Date().toISOString()}
   共 ${Object.keys(found).length} / ${DECK.length} 张使用插画底图，其余用程序化 SVG。
   缩略图 ${Object.keys(thumbs).length} 张（图鉴网格用；由 tools/optimize-art.py 生成）。
   =========================================================== */

/* 卡面地址从**模块自身位置**算出来（import.meta.url），而不是写死 '/assets/…'。
   两个坑都是这么同时避开的：
     · 写 '/assets/…'：站点部署在子目录（GitHub Pages 项目页 用户名.github.io/仓库名/）
       时会去请求域名根，图鉴缩略图与牌背全部 404；
     · 写 'assets/…'（纯相对）：地址会跟着**页面**走，
       tools/*.html 里的预览页就会去找 /tools/assets/…，同样 404。
   用 import.meta.url 算出来的绝对地址与页面位置无关，两边都对。 */
export const ART_BASE = new URL('../../assets/tarot/', import.meta.url).href;
export const THUMB_BASE = new URL('../../assets/tarot/thumbs/', import.meta.url).href;

export const CARD_ART = {
${entries}
};

/* 图鉴网格用的小图：216px 宽，约 15 KB。全尺寸原图约 260 KB，78 张一起加载
   会让「打开图鉴」变成 20 MB 的请求。 */
export const CARD_THUMB = {
${thumbEntries}
};

export const hasArt = (id) => Object.prototype.hasOwnProperty.call(CARD_ART, id);
export const artUrl = (id) => (hasArt(id) ? ART_BASE + CARD_ART[id] : null);

export const hasThumb = (id) => Object.prototype.hasOwnProperty.call(CARD_THUMB, id);
/** 缩略图地址；没有缩略图时回落到全尺寸原图，保证不会 404 */
export const artThumbUrl = (id) => (hasThumb(id) ? THUMB_BASE + CARD_THUMB[id] : artUrl(id));
`;

  await writeFile(out, content);
  return {
    count: Object.keys(found).length,
    thumbCount: Object.keys(thumbs).length,
    total: DECK.length,
    ids: Object.keys(found),
  };
}
