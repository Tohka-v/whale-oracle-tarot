/* ===========================================================
   tools/make-manifest.mjs · 扫描 assets/tarot/ 生成卡面插画清单
   用法：node tools/make-manifest.mjs
   生成逻辑见 tools/manifest-lib.mjs（与 tools/serve.mjs 共用同一份实现）
   =========================================================== */

import { DECK } from '../src/data/deck.js';
import { refreshManifest, MANIFEST_PATH } from './manifest-lib.mjs';

const r = await refreshManifest(DECK);

console.log(`已写入 ${MANIFEST_PATH}`);
console.log(`识别到 ${r.count} 张插画（共 ${r.total} 张牌）`);
console.log(`识别到 ${r.thumbCount} 张缩略图`);
if (r.count === 0) {
  console.log('提示：把图片按 <牌id>.jpg 命名放进 assets/tarot/ 后重跑本脚本即可接入。');
  console.log(`牌 id 形如：${DECK.slice(0, 3).map((c) => c.id).join(', ')} … ${DECK[DECK.length - 1].id}`);
}
if (r.thumbCount === 0) {
  console.log('提示：缩略图缺失时图鉴会回落到全尺寸原图（打开图鉴约 20 MB）。');
  console.log('      执行  python tools/optimize-art.py  可生成缩略图与降采样原图。');
}
