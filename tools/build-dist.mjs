/* ===========================================================
   tools/build-dist.mjs · 组装「要发布的那一份」

   为什么需要它：仓库根目录**不等于**网站。仓库里还有 tools/（生成台、出图脚本、
   各种 check.html）、维护记录、品牌原图候选、字体全量版……这些都不该出现在
   GitHub Pages 上。所以发布走「构建出 dist/ → 只上传 dist/」这条路。

   发布集（写死在 SITE_* 常量里，改动要同步 README「图标」一节）：
     index.html / manifest.webmanifest / sw.js
     src/  styles/
     fonts/ 里**被 fonts.css 真正引用的那 8 个**（全量版有 4.4 MB，是本地重新子集化用的）
     assets/tarot/（78 张卡面 + 缩略图） assets/back/ assets/icons/
     assets/brand/mark-v4.webp（顶栏那一张）

   收尾会做一次**引用自检**：把 index.html / styles/*.css / sw.js 里出现的本地路径
   全部抽出来，逐个确认在 dist/ 里存在。漏拷一个文件在本地看不出问题，
   上线后就是 404——这一步就是为了不让它发生。

   用法：
     node tools/build-dist.mjs              # 输出到 dist/
     node tools/build-dist.mjs --out build   # 换目录
     node tools/build-dist.mjs --list        # 只列清单，不写文件
   =========================================================== */

import { cp, mkdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
};
const flag = (name) => process.argv.includes(`--${name}`);

const OUT = resolve(ROOT, arg('out', 'dist'));

/* ───────── 发布集 ───────── */
const FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets/brand/mark-v4.webp',      // 顶栏标记（src/main.js 里引用）
];
const DIRS = [
  'src',
  'styles',
  'assets/tarot',                    // 含 thumbs/ 子目录
  'assets/back',
  'assets/icons',
];
/* 字体只挑被 fonts.css 引用的那些。全量 WooFF2 是本地做子集化的原料，不进网站。 */
const FONTS = [
  'NotoSerifSC-400.subset.woff2',
  'NotoSerifSC-600.subset.woff2',
  'NotoSansSC-400.subset.woff2',
  'Cinzel-400.woff2',
  'Cinzel-600.woff2',
  'Cinzel-700.woff2',
  'Cormorant-400.woff2',
  'Cormorant-600.woff2',
];

/* ───────── 引用自检 ─────────
   从几个入口文件里抠出本地相对路径，确认它们都在 dist 里。
   只做「存在性」检查，不解析 CSS 的 @import 之类——这个项目的引用都很直白。 */
async function collectRefs() {
  const refs = new Set();
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) refs.add(m[1]);

  const css = await readFile(join(ROOT, 'styles/fonts.css'), 'utf8');
  for (const m of css.matchAll(/url\('\.\.\/([^']+)'\)/g)) refs.add(m[1]);

  /* sw.js 的 SHELL 数组：'./xxx' */
  const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const shellPart = /const SHELL = \[([\s\S]*?)\];/.exec(sw);
  if (shellPart) {
    for (const m of shellPart[1].matchAll(/'\.\/([^']*)'/g)) if (m[1]) refs.add(m[1]);
  }
  /* 卡面与缩略图是运行时拼出来的，这里按目录整体确认 */
  refs.add('assets/tarot/');
  return [...refs].sort();
}

async function main() {
  console.log(`源：${ROOT}`);
  console.log(`目标：${OUT}${flag('list') ? '（只列清单）' : ''}\n`);

  if (flag('list')) {
    console.log('文件：', FILES.join('  '));
    console.log('目录：', DIRS.join('  '));
    console.log('字体：', FONTS.join('  '));
    return 0;
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let n = 0;
  for (const f of FILES) {
    const src = join(ROOT, f);
    if (!existsSync(src)) { console.error(`✘ 缺文件：${f}`); return 1; }
    await cp(src, join(OUT, f));
    n++;
  }
  for (const d of DIRS) {
    const src = join(ROOT, d);
    if (!existsSync(src)) { console.error(`✘ 缺目录：${d}`); return 1; }
    await cp(src, join(OUT, d), { recursive: true });
  }
  await mkdir(join(OUT, 'fonts'), { recursive: true });
  for (const f of FONTS) {
    const src = join(ROOT, 'fonts', f);
    if (!existsSync(src)) { console.error(`✘ 缺字体：${f}`); return 1; }
    await cp(src, join(OUT, 'fonts', f));
    n++;
  }

  /* ───────── 自检 ───────── */
  const refs = await collectRefs();
  const missing = [];
  for (const r of refs) {
    if (!existsSync(join(OUT, r))) missing.push(r);
  }
  if (missing.length) {
    console.error('\n✘ 引用了但 dist 里没有（上线会 404）：');
    for (const m of missing) console.error('   ' + m);
    return 1;
  }
  console.log(`引用自检：${refs.length} 个本地引用全部存在 ✓`);

  /* ───────── 体积统计 ───────── */
  async function sizeOf(p) {
    const s = await stat(p);
    if (!s.isDirectory()) return s.size;
    let total = 0;
    for (const e of await (await import('node:fs/promises')).readdir(p, { withFileTypes: true })) {
      total += await sizeOf(join(p, e.name));
    }
    return total;
  }
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  const parts = [];
  for (const d of ['src', 'styles', 'fonts', 'assets/tarot', 'assets/back', 'assets/icons', 'assets/brand']) {
    if (existsSync(join(OUT, d))) parts.push(`${d} ${kb(await sizeOf(join(OUT, d)))}`);
  }
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
    parts.push(`${f} ${kb((await stat(join(OUT, f))).size)}`);
  }
  const total = await sizeOf(OUT);
  console.log(`\n内容：${parts.join('　|　')}`);
  console.log(`合计：${(total / 1048576).toFixed(1)} MB（${kb(total)}）`);

  /* 顺手写个 .nojekyll：GitHub Pages 默认会跑 Jekyll，下划线开头的文件/目录会被吞掉。
     这个项目目前没有这类文件，但代价是 0 字节，留着防以后踩。 */
  await writeFile(join(OUT, '.nojekyll'), '');
  console.log(`已写出 ${OUT}`);
  return 0;
}

process.exit(await main());
