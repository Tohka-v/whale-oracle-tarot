/* ===========================================================
   tools/gen-brand.mjs · 生成顶栏品牌标记（网站图标）

   和 gen-art.mjs 分开，是因为两者的目标完全不同：
     · 卡面是 78 张、竖版 1472×2560、提示词由牌义推导、写进 assets/tarot/
     · 品牌标记是**一张**、方图 1:1、提示词是固定的几个构图候选、写进 assets/brand/
   硬塞进 gen-art 会让那边的 --cards / --style / 落盘命名全都要加特例。

   用法：
     node tools/gen-brand.mjs --dry-run           # 只打印提示词，不花钱（先跑这个）
     node tools/gen-brand.mjs --yes               # 出 3 个候选（默认 2K，够用）
     node tools/gen-brand.mjs --yes --variants 1  # 只出第 1 个候选，最省
     node tools/gen-brand.mjs --yes --only 2      # 只重出第 2 个
     node tools/gen-brand.mjs --yes --set base    # 换用不含塔罗符号的那组提示词
     node tools/gen-brand.mjs --yes --prompt "…"  # 完全自定义提示词
     node tools/gen-brand.mjs --yes --size 4K     # 除非真要大幅面，否则别加

   ⚠️ 真实调用必须显式 --yes。这个闸门是补上去的：上一轮 6 张 4K 图
   就是「以为还在试稿、其实早已计费」烧掉的。

   模型：默认 doubao-seedream-4-5-251128。4.5 的档位只有 2K / 4K
   （3K 是 5.0 Lite 专属），像素串下限 2560x1440，且固定输出 JPEG
   （output_format 是 5.0 才有的参数）。本脚本最终产物只是顶栏
   256px 的 WebP，**2K 已经远超所需，没必要时不要用 4K**。

   密钥从环境变量 ARK_API_KEY 读，不写进代码、不写进任何文件。
   若该变量在当前进程里没有，会回落到注册表里的用户级变量（setx 设的那个）——
   DSH 起子进程时继承的是它自己启动时的环境块，setx 之后不重启读不到，
   但注册表是实时的，所以这一步兜底很有用。

   产物：
     assets/brand/raw/<时间戳>/mark-N-<key>.jpg   原始候选（不提交，见 .gitignore）
     assets/brand/raw/<时间戳>/_report.json       本次记录
   =========================================================== */

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'assets/brand/raw');

/* ───────── 参数 ───────── */
const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
};
const flag = (name) => process.argv.includes(`--${name}`);

const MODEL = arg('model', 'doubao-seedream-4-5-251128');
/* 尺寸规则**按模型各不相同**，不能把上一代的结论直接搬过来：
     · 档位预设  4.5 只有 2K / 4K（3K 是 5.0 Lite 专属，4.5 会直接拒）
     · 显式 WxH  4.5 的像素积需落在 2560x1440 ~ 4096x4096
   默认 2K：本脚本的最终产物是**顶栏 256px 的 WebP**，2K 已经远超所需。
   2026-09-23 那次事故就是用了 4K——出 4096² 再降到 256px，
   多出来的像素一个都没用上，纯烧钱。 */
const SIZE = arg('size', '2K');
const URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const delay = Number(arg('delay', '4000'));

/* ───────── 提示词 ─────────
   三条共用的收尾：图标必须在 44px 顶栏里还认得出，所以反复强调
   「剪影清楚 / 对比强 / 缩到 48px 仍可辨」，并明确排除文字水印——
   文生图模型很爱在"logo"类提示里自己加一行字母。

   「金环四周留出明确空隙」是第二版才补上的：第一版没写，模型把金环画到了
   画布边缘（实测包围盒 4087×4095 / 画布 4096），裁圆就会切掉环的四个极值点。 */
const TAIL = 'flat cel-shaded anime illustration, clean bold line art, '
  + 'strong readable silhouette, simple shapes, high contrast, crisp edges, '
  + 'designed to stay recognizable when scaled down to 48 by 48 pixels, '
  + 'perfectly centered square 1:1 composition, '
  + 'the gold ring sits well inside the frame with clear empty margin on all four sides, '
  + 'deep navy blue starry background with a subtle nebula glow, '
  + 'no watermark, no signature, no frame border';

const SETS = {
  /* 第一版：纯角色，不带塔罗符号 */
  base: [
    {
      key: 'bust',
      label: '头肩胸像 + 金环',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, long flowing light blue hair, '
        + 'small whale-tail shaped hair ornament, big bright blue eyes, soft confident smile, '
        + 'white and navy maid headdress with a tiny gold star, '
        + 'her head fills most of the frame, ' + TAIL + ', no text, no letters, no numbers',
    },
    {
      key: 'bust-star',
      label: '头肩胸像 + 四角星 + 鲸尾剪影',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, a single four-pointed gold star '
        + 'floating above her head, a faint whale-tail silhouette behind her, '
        + 'long flowing light blue hair, big bright blue eyes, gentle smile, '
        + 'white and navy maid headdress, her head fills most of the frame, '
        + TAIL + ', no text, no letters, no numbers',
    },
    {
      key: 'chibi',
      label: 'Q 版全身抱星',
      prompt: 'app icon badge, chibi super-deformed anime whale-girl, full body sitting pose, '
        + 'big head and small body, long light blue twin-tail hair, whale-fin ear ornaments, '
        + 'white maid dress with navy and gold accents, hugging a small golden four-pointed star, '
        + 'centered inside a thin elegant gold ring, ' + TAIL + ', no text, no letters, no numbers',
    },
  ],

  /* 第二版：加塔罗元素。塔罗的可读信号按「44px 下还认不认得出」排序：
     新月 > 序号带 > 四花色。花色四个符号在 44px 里各自只剩 6px，基本会糊，
     所以放在最后一条当对照组，而不是主推。 */
  tarot: [
    {
      key: 'tarot-moon',
      label: '胸像 + 新月 + 四角星（小尺寸最稳）',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, a large slim crescent moon '
        + 'curving behind her head, one four-pointed gold star above her, '
        + 'a few small scattered stars, long flowing light blue hair with a whale-tail ornament, '
        + 'big bright blue eyes, serene smile, white and navy tarot priestess headdress, '
        + 'her head fills most of the frame, '
        + TAIL + ', no text, no letters, no numbers',
    },
    {
      key: 'tarot-badge',
      label: '胸像 + 顶部罗马数字序号带（站内卡面同款）',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, an ornate gold nameplate capsule '
        + 'at the top of the ring inscribed with the roman numeral XXI in clean serif capitals, '
        + 'a tiny four-pointed gold star, long flowing light blue hair with a whale-tail ornament, '
        + 'big bright blue eyes, calm smile, white and navy tarot priestess headdress with '
        + 'a small gold diadem, her head fills most of the frame, '
        + TAIL + ', no other text, no other words',
    },
    {
      key: 'tarot-suits',
      label: '胸像 + 环上四花色（权杖/圣杯/宝剑/星币）',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, four small tarot suit emblems set on '
        + 'the ring at the four compass points: a wooden wand, a golden chalice, a silver sword '
        + 'and a golden pentacle, a slim crescent moon and a four-pointed gold star above her, '
        + 'long flowing light blue hair, big bright blue eyes, gentle smile, '
        + 'white and navy tarot priestess headdress, her head fills most of the frame, '
        + TAIL + ', no text, no letters, no numbers',
    },
  ],

  /* 第三版：照用户给的参考图改发色。
     用户原话是「头发颜色太浅」——前几版的 light blue hair 出来都是发白的青色，
     参考图里那种偏灰的中深靛蓝。《反过来说明的道理》：颜色词在提示词里
     权重很低，只写 light/deep 没用，得把**不要什么**也写出来
     （NOT pale cyan, NOT light sky blue），并给出可对照的色相描述。 */
  refstyle: [
    {
      key: 'refstyle-bust',
      label: '胸像 · 中深靛蓝发（照参考图色号）',
      prompt: 'app icon, cute anime whale-girl mascot, head and shoulders bust portrait, '
        + 'centered inside a thin elegant gold ring, a large slim crescent moon '
        + 'curving behind her head, one four-pointed gold star above her, '
        + 'a few small scattered stars, '
        + 'hair is deep muted indigo blue: medium-dark slate blue with softer periwinkle '
        + 'highlights and darker navy shading, clearly darker and greyer than sky blue, '
        + 'absolutely not pale cyan, not light sky blue, not white-bluish, '
        + 'long flowing wavy hair falling over both shoulders, '
        + 'small whale-fin ear ornaments, a small blue whale floating beside her head, '
        + 'big bright blue eyes, gentle smile, '
        + 'white and navy maid headdress with gold trim and a tiny gold star, '
        + 'her head and shoulders fill most of the frame, '
        + TAIL + ', no text, no letters, no numbers',
    },
  ],
};

const setName = arg('set', 'tarot');
const chosen = SETS[setName];
if (!chosen) {
  console.error(`未知提示词组 ${setName}，可选：${Object.keys(SETS).join(', ')}`);
  process.exit(2);
}

const custom = arg('prompt');
let jobs = custom
  ? [{ key: 'custom', label: '自定义提示词', prompt: custom.endsWith('.') ? custom : `${custom}, ${TAIL}` }]
  : chosen;

const only = Number(arg('only', '0')) || 0;
if (only) {
  const pick = jobs[only - 1];
  if (!pick) { console.error(`--only ${only} 超出范围（1~${jobs.length}）`); process.exit(2); }
  jobs = [pick];
} else {
  const n = Number(arg('variants', '0')) || 0;
  if (n > 0) jobs = jobs.slice(0, n);
}

/* ───────── 密钥 ───────── */
function readKey() {
  if (process.env.ARK_API_KEY) return process.env.ARK_API_KEY.trim();
  if (process.platform !== 'win32') return '';
  /* 回落到注册表：setx 写的用户级变量在这里能读到，
     哪怕 DSH 自己的环境块还是启动时的旧快照 */
  const r = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', 'ARK_API_KEY'], { encoding: 'utf8' });
  const m = /ARK_API_KEY\s+REG_SZ\s+(.+)/.exec(r.stdout || '');
  return m ? m[1].trim() : '';
}

const dryRun = flag('dry-run');
const key = readKey();

if (!dryRun && !key) {
  console.error('缺少密钥：环境变量 ARK_API_KEY 没有，注册表 HKCU\\Environment 里也没有。\n');
  console.error('  当前窗口临时用：  $env:ARK_API_KEY="你的密钥"');
  console.error('  以后都能读到：    setx ARK_API_KEY "你的密钥"   （之后新开的窗口才生效）\n');
  console.error('  密钥申请：https://console.volcengine.com/ark');
  process.exit(2);
}

/* ───────── 预演 ───────── */
if (dryRun) {
  console.log('【预演模式】不调用接口、不写文件、不产生费用。\n');
  console.log(`供应商：火山方舟 · 豆包 Seedream`);
  console.log(`模型：${MODEL}`);
  console.log(`尺寸：${SIZE}　（4.5 的档位只有 2K / 4K，出的都是方图 1:1）`);
  console.log(`接口：POST ${URL}`);
  console.log(`密钥：ARK_API_KEY${key ? '（已设置）' : '（当前读不到——预演不受影响）'}`);
  console.log(`计划：${jobs.length} 个候选\n`);
  for (const j of jobs) {
    console.log('─'.repeat(76));
    console.log(`${j.key}  ·  ${j.label}   (${j.prompt.length} 字符)`);
    console.log('─'.repeat(76));
    console.log(j.prompt);
    console.log('');
  }
  console.log(`共 ${jobs.length} 次接口调用（会计费）。确认无误后改用 --yes 正式跑。`);
  process.exit(0);
}

/* ───────── 花钱前的闸门 ─────────
   真实调用必须显式加 --yes。理由很实在：上一轮 6 张 4K 图就是
   「以为还在试稿、其实早就在计费」烧掉的。默认拦住，把决定权交回给人。 */
if (!flag('yes')) {
  console.error(`⚠ 中断：本次会真实调用 ${jobs.length} 次接口并计费。`);
  console.error(`  模型 ${MODEL}　尺寸 ${SIZE}　候选 ${jobs.length} 个`);
  console.error('');
  console.error('  只看提示词、不花钱：  node tools/gen-brand.mjs --dry-run');
  console.error('  确认要出图：          node tools/gen-brand.mjs --yes');
  console.error('  想再省一点：          --size 2K（默认）而不是 4K；--variants 1 只出一个');
  process.exit(3);
}

/* ───────── 出图 ───────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = join(OUT, stamp);
await mkdir(dir, { recursive: true });

/** 按**内容**判定扩展名，而不是按预期。
    火山返回的其实是 JPEG，早先一律存成 .png，于是文件后缀和真实格式不符——
    read_image 会直接拒绝打开，Pillow 也会给出误导性的 format。
    记这一笔是因为「后缀只是名字，格式看字节」这类问题在图片流程里很容易埋很久。 */
function extOf(buf) {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return '.png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF'
      && buf.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return '.bin';
}

console.log(`模型：${MODEL}　尺寸：${SIZE}`);
console.log(`候选：${jobs.length} 个　输出：${dir}\n`);

async function generate(prompt, seed) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL, prompt, size: SIZE, response_format: 'url', watermark: false, seed,
    }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`返回非 JSON：${text.slice(0, 200)}`); }
  const url = json?.data?.[0]?.url;
  if (!url) throw new Error(`未拿到图片 URL：${text.slice(0, 300)}`);
  const img = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!img.ok) throw new Error(`下载图片失败 HTTP ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

const report = { model: MODEL, size: SIZE, at: new Date().toISOString(), items: [] };
let ok = 0; let fail = 0;

for (let i = 0; i < jobs.length; i++) {
  const j = jobs[i];
  const t0 = Date.now();
  try {
    const buf = await generate(j.prompt, 4200 + i);
    if (buf.length < 2000) throw new Error(`内容过小（${buf.length}B）`);
    const name = `mark-${i + 1}-${j.key}${extOf(buf)}`;
    await writeFile(join(dir, name), buf);
    ok++;
    console.log(`✔ ${String(i + 1).padStart(2)} ${j.key.padEnd(11)} ${(buf.length / 1048576).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${name}`);
    report.items.push({ file: name, key: j.key, ok: true, bytes: buf.length });
  } catch (err) {
    fail++;
    console.log(`✘ ${String(i + 1).padStart(2)} ${j.key.padEnd(11)} ${err.message}`);
    report.items.push({ key: j.key, ok: false, error: err.message });
  }
  if (i < jobs.length - 1) await sleep(delay);
}

const summary = { ...report, ok, failed: fail };
await writeFile(join(dir, '_report.json'), JSON.stringify(summary, null, 2));

console.log(`\n完成：成功 ${ok}　失败 ${fail}`);
console.log(`目录：${dir}`);
if (ok) console.log('挑好之后告诉我文件名，我接进顶栏并重出 PWA 图标。');
