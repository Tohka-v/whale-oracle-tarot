/* ===========================================================
   tools/gen-art.mjs · 用外部文生图接口批量生成卡面插画

   ⚠️ 先说明清楚：
   · 我（AI 编码助手）不能生成、也不能编辑图片。这个脚本只做三件事：
     拼提示词 → 调用第三方文生图接口 → 把返回的图片落盘到 assets/tarot/。
   · 图片是第三方模型「生成」的，不是绘画出来的。是否使用、许可与合规
     由站点所有者决定。生成式图片请按各服务商条款使用。

   支持的供应商（用 --provider 选择，密钥从环境变量读，不写进代码）：
     zhipu       智谱 BigModel      ZHIPU_API_KEY
                 └ cogview-3-flash 为官方免费模型，适合试稿
     siliconflow 硅基流动           SILICONFLOW_API_KEY
     ark         火山方舟（豆包）     ARK_API_KEY
     dashscope   阿里百炼（通义万相） DASHSCOPE_API_KEY
     pollinations 免密钥公共服务      （无需密钥，但复杂提示词常返回 500）

   用法：
     node tools/gen-art.mjs --provider zhipu --limit 2               # 先试稿
     node tools/gen-art.mjs --provider zhipu --cards major-00,major-01
     node tools/gen-art.mjs --provider zhipu                          # 全部 78 张
     node tools/gen-art.mjs --provider ark --dry-run                  # 只打印提示词，不花钱
   参数：
     --provider  见上，默认 zhipu
     --model     覆盖默认模型
     --style     w（鲸鱼娘女仆）/ s（古典塔罗）/ p（装饰象征），默认 w
     --size      WxH，代码内默认 1472x2560（火山 Seedream 竖版；卡面比例 ≈ 0.577）
                 换供应商务必显式指定，例如智谱要写 --size 768x1344
     --limit N   只生成前 N 张
     --cards     指定牌 id，逗号分隔
     --force     已存在也重新生成
     --delay ms  每张间隔，默认 4000
     --dry-run   只打印将要发送的提示词与参数：不调用接口、不写文件、不产生费用
    输出：
       assets/tarot/<牌id>.jpg        生成的卡面
       assets/tarot/_report-<时间戳>.json   本次运行的报告存档（每次新建，不覆盖历史）
       assets/tarot/_report.json            最近一次运行的报告（快捷入口）
   =========================================================== */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { DECK } from '../src/data/deck.js';

const OUT = resolve('assets/tarot');

/* ───────── 风格预设 ───────── */
const STYLES = {
  w: {
    label: '鲸鱼娘女仆（参考原型）',
    text: (c) =>
      `anime tarot card illustration, cute whale girl character, long wavy gradient blue hair to the knees, ` +
      `a single ahoge strand, cetacean ear fins with pale tips and a small blue ribbon, large blue eyes with highlights, ` +
      `white frilled maid headdress, navy blue victorian dress with white apron and puff sleeves, navy ribbon bow, ` +
      `a large whale tail behind her, white stockings, navy shoes, ` +
      `theme: ${c.en}, ${c.artHint}, ` +
      `soft cel shading, clean line art, mystical night background with stars, ` +
      `vertical composition, plain dark backdrop, full-bleed edge-to-edge artwork reaching every edge of the canvas, no text, no watermark, no border frame, no ornamental frame, no decorative corner ornaments, no vignette, no margin`,
  },
  s: {
    label: '古典塔罗（神秘学）',
    text: (c) =>
      `tarot card illustration, ${c.en}, ${c.artHint}, ` +
      `ornate gold linework, celestial night sky, occult symbolism, ` +
      `one anime-styled character at the centre, soft cel shading, clean line art, ` +
      `vertical composition, plain dark backdrop, full-bleed edge-to-edge artwork reaching every edge of the canvas, no text, no watermark, no border frame, no ornamental frame, no decorative corner ornaments, no vignette, no margin`,
  },
  p: {
    label: '装饰象征（无人物）',
    text: (c) =>
      `ornate tarot card illustration, ${c.en}, ${c.artHint}, ` +
      `rich gold filigree, deep indigo and gold palette, celestial motifs, ` +
      `symmetric symbolic composition, engraved style, ` +
      `vertical composition, plain dark backdrop, full-bleed edge-to-edge artwork reaching every edge of the canvas, no text, no watermark, no border frame, no ornamental frame, no decorative corner ornaments, no vignette, no margin`,
  },
};

/* 每张牌的构图提示 */
const ART_HINT = {
  'major-00': 'carefree girl stepping off a cliff edge with a white rose, a small dog, morning sun',
  'major-01': 'girl raising a wand toward the sky, infinity symbol above, magical tools on a table',
  'major-02': 'veiled priestess seated between two pillars, crescent moon crown, scroll of law',
  'major-03': 'empress on a throne in a wheat field, crown of twelve stars',
  'major-04': 'emperor in armour on a stone throne with ram heads, mountains behind',
  'major-05': 'hierophant with triple crown and crossed keys, two pillars',
  'major-06': 'two lovers beneath a radiant angel in a garden',
  'major-07': 'charioteer in armour with two sphinxes, starry canopy, city walls',
  'major-08': 'girl gently taming a lion, infinity symbol above her head',
  'major-09': 'hermit holding a lantern with a six-pointed star, snowy peak',
  'major-10': 'great wheel of fortune with a sphinx and a serpent, four winged creatures in the corners',
  'major-11': 'justice holding scales and an upright sword between two pillars',
  'major-12': 'figure hanging upside down from a wooden beam, glowing halo',
  'major-13': 'skeletal knight on a white horse carrying a black banner, sunrise',
  'major-14': 'angel pouring water between two cups, irises and a path to the sun',
  'major-15': 'horned devil on a pedestal, two chained figures, inverted pentagram',
  'major-16': 'stone tower struck by lightning, a crown falling, flames',
  'major-17': 'girl kneeling by a pool pouring water, one large star and seven small stars',
  'major-18': 'moon with a face, two howling wolves, a crayfish in a pool, two towers',
  'major-19': 'child on a white horse under a great sun, sunflowers, red banner',
  'major-20': 'angel blowing a trumpet, figures rising from coffins, grey sea',
  'major-21': 'dancing figure inside a laurel wreath, four creatures in the corners',
  wands: 'sprouting wooden wands, salamanders, fire and desert motifs',
  cups: 'chalices, flowing water, lotus and fish motifs',
  swords: 'swords, wind and clouds, sharp geometric motifs',
  pentacles: 'golden pentacle coins, roses and lilies, earth and garden motifs',

  /* 星币 8~10 与四张宫廷牌：各自的韦特经典场景。
     不单独写的话这 7 张会共用上面那句花色提示，「theme」里只剩牌名不同，
     出图会长得几乎一样——等于花 7 张的钱买 1 张图。 */
  'pentacles-08': 'girl apprentice seated on a wooden bench engraving a golden pentacle with a small hammer, many finished pentacles nailed to a wooden post beside her, tools and wood shavings on the ground, warm lamplit workshop corner, deep navy and indigo palette, richly saturated jewel tones, gold accents',
  /* 05~king：统一压暗 + 保住饱和度。实测第一版 pentacles-09 亮度 0.315（很好）
     但饱和度掉到 0.340（同系列 0.495~0.636），说明「dark moody」会把画面压灰，
     改成「richly saturated jewel tones」既暗又饱和。 */
  'pentacles-09': 'elegant girl standing in a walled vineyard at night, a hooded falcon perched on her gloved hand, many golden pentacles hanging among the dark vines, a small snail on the grass, deep purple grapes, dark green foliage, only a large forked whale tail behind her with no whale body or head visible, deep navy and indigo palette, richly saturated jewel tones, gold accents, moonlight rim light',
  'pentacles-10': 'girl standing beneath a carved stone archway of an old merchant house at night, many golden pentacles arranged in a diamond pattern above the arch, two white dogs and a white-bearded elder in the background, worn stone, faint warm lantern light, deep navy and indigo palette, richly saturated jewel tones, gold accents, family lineage and lasting wealth',
  'pentacles-page': 'young girl in a dark moonlit field holding up a single golden pentacle with both hands and gazing at it intently, freshly ploughed furrows and distant dark blue mountains behind her, deep indigo palette, richly saturated jewel tones, gold accents, cool moonlight',
  'pentacles-knight': 'girl knight in a dark travelling cloak over her navy dress, seated on a heavy black plough horse standing perfectly still in a ploughed field at night, holding a golden pentacle before her chest, cold moonlight, deep indigo palette, richly saturated jewel tones, gold accents, patient methodical bearing',
  'pentacles-queen': 'girl queen seated on a throne carved with goat heads and vines in a moonlit garden at night, a small jewelled crown over her white headdress, cradling a golden pentacle on her lap, a white rabbit at her feet, dark climbing roses, deep navy and indigo palette, richly saturated jewel tones, gold accents',
  'pentacles-king': 'girl king enthroned on an ornate throne decorated with bull heads and grape vines at night, a jewelled crown over her white headdress, holding a golden sceptre and a golden pentacle, a dark stone castle and vineyard behind her, deep navy and indigo palette, richly saturated jewel tones, gold accents, quiet mastery of wealth',
};

const hintFor = (card) => ART_HINT[card.id]
  || `${card.name} (${card.en}), ${ART_HINT[card.suit] || ''}`;

/* ───────── 供应商适配 ───────── */
const PROVIDERS = {
  zhipu: {
    label: '智谱 BigModel',
    keyEnv: 'ZHIPU_API_KEY',
    defaultModel: 'cogview-3-flash',
    url: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
    build: ({ model, prompt, size }) => ({
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ZHIPU_API_KEY}` },
      body: { model, prompt, size, watermark_enabled: false },
    }),
    pick: (j) => j?.data?.[0]?.url,
  },

  siliconflow: {
    label: '硅基流动',
    keyEnv: 'SILICONFLOW_API_KEY',
    defaultModel: 'Kwai-Kolors/Kolors',
    url: 'https://api.siliconflow.cn/v1/images/generations',
    build: ({ model, prompt, size }) => {
      const [w, h] = size.split('x').map(Number);
      return {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}` },
        body: { model, prompt, image_size: `${w}x${h}`, batch_size: 1, num_inference_steps: 30, guidance_scale: 7.5 },
      };
    },
    pick: (j) => j?.images?.[0]?.url || j?.data?.[0]?.url,
  },

  ark: {
    label: '火山方舟（豆包 Seedream）',
    keyEnv: 'ARK_API_KEY',
    /* 2026-09-23 由 5.0 Lite 换成 4.5（成本）。两代的差异见 serve.mjs 里的注释：
       4.5 的档位只有 2K/4K，像素串下限 2560x1440，且固定输出 JPEG。 */
    defaultModel: 'doubao-seedream-4-5-251128',
    url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    build: ({ model, prompt, size }) => ({
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ARK_API_KEY}` },
      body: { model, prompt, size, response_format: 'url', watermark: false },
    }),
    pick: (j) => j?.data?.[0]?.url,
  },

  dashscope: {
    label: '阿里百炼（通义万相）',
    keyEnv: 'DASHSCOPE_API_KEY',
    defaultModel: 'wanx2.1-t2i-turbo',
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    build: ({ model, prompt, size }) => {
      const [w, h] = size.split('x').map(Number);
      return {
        headers: {
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        },
        body: { model, input: { prompt }, parameters: { size: `${w}*${h}`, n: 1 } },
      };
    },
    pick: (j) => j?.output?.results?.[0]?.url,
    async: true, // 返回 task_id，需要轮询
  },

  pollinations: {
    label: 'Pollinations（免密钥，稳定性一般）',
    keyEnv: null,
    defaultModel: 'flux',
    url: 'https://image.pollinations.ai/prompt',
    build: ({ prompt, size, seed }) => {
      const [w, h] = size.split('x').map(Number);
      return { get: `${PROVIDERS.pollinations.url}/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}` };
    },
    pick: null, // 直接返回图片字节
    direct: true,
  },
};

/* ───────── 参数 ───────── */
const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const flag = (name) => process.argv.includes(`--${name}`);

const pKey = arg('provider', 'zhipu');
const provider = PROVIDERS[pKey];
if (!provider) {
  console.error(`未知供应商 ${pKey}，可选：${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(2);
}
const model = arg('model', provider.defaultModel);
const style = STYLES[arg('style', 'w')];
if (!style) {
  console.error(`未知风格，可选：${Object.keys(STYLES).join(', ')}`);
  process.exit(2);
}
const size = arg('size', '1472x2560');
const delay = Number(arg('delay', '4000'));
const limit = Number(arg('limit', '0')) || 0;
const force = flag('force');
const dryRun = flag('dry-run');
const only = arg('cards') ? arg('cards').split(',').map((s) => s.trim()) : null;

if (!dryRun && provider.keyEnv && !process.env[provider.keyEnv]) {
  console.error(`缺少密钥：请先设置环境变量 ${provider.keyEnv}`);
  console.error(`  PowerShell:  $env:${provider.keyEnv}="你的密钥"`);
  console.error(`  CMD:         set ${provider.keyEnv}=你的密钥`);
  console.error(`  bash:        export ${provider.keyEnv}=你的密钥`);
  console.error('\n密钥申请：');
  console.error('  智谱 BigModel  https://open.bigmodel.cn  （cogview-3-flash 为免费模型）');
  console.error('  硅基流动        https://cloud.siliconflow.cn');
  console.error('  火山方舟        https://console.volcengine.com/ark  （豆包 Seedream）');
  console.error('  阿里百炼        https://bailian.console.aliyun.com  （通义万相）');
  process.exit(2);
}

let list = DECK.map((c) => ({ ...c, artHint: hintFor(c) }));
if (only) list = list.filter((c) => only.includes(c.id));
if (limit) list = list.slice(0, limit);

/* ───────── 预演：只打印提示词，不碰网络、不写文件 ───────── */
if (dryRun) {
  console.log('【预演模式】不调用任何接口、不写入任何文件、不产生费用。\n');
  console.log(`供应商：${provider.label}（${pKey}）`);
  console.log(`模型：${model}`);
  console.log(`风格：${style.label}`);
  console.log(`尺寸：${size}`);
  console.log(`接口：${provider.direct ? `GET ${provider.url}/<prompt>` : provider.url}`);
  console.log(`密钥：${provider.keyEnv
    ? `${provider.keyEnv}${process.env[provider.keyEnv] ? '（已设置）' : '（当前未设置——预演不受影响）'}`
    : '无需密钥'}`);
  console.log('');

  for (const card of list) {
    const exists = existsSync(join(OUT, `${card.id}.jpg`));
    console.log('─'.repeat(74));
    console.log(`${card.id}  ·  ${card.name} / ${card.en}${exists ? '   ← 已存在，正式跑时会跳过' : ''}`);
    console.log('─'.repeat(74));
    console.log(style.text(card));
    console.log('');
  }

  console.log(`共 ${list.length} 条。确认无误后去掉 --dry-run 正式跑。`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

/* ───────── 生成一张 ───────── */
async function generateOne(card) {
  const prompt = style.text(card);
  const spec = provider.build({ model, prompt, size, seed: 1000 + DECK.indexOf(card) });

  if (provider.direct) {
    const res = await fetch(spec.get, { signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: spec.headers,
    body: JSON.stringify(spec.body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`返回非 JSON：${text.slice(0, 160)}`); }

  /* 通义万相是异步任务：先拿 task_id 再轮询 */
  if (provider.async) {
    const taskId = json?.output?.task_id;
    if (!taskId) throw new Error(`未拿到 task_id：${text.slice(0, 160)}`);
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      const q = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` },
        signal: AbortSignal.timeout(30000),
      });
      const qj = await q.json();
      const st = qj?.output?.task_status;
      if (st === 'SUCCEEDED') {
        const url = qj?.output?.results?.[0]?.url;
        if (!url) throw new Error('任务成功但没有图片 URL');
        const img = await fetch(url, { signal: AbortSignal.timeout(120000) });
        return Buffer.from(await img.arrayBuffer());
      }
      if (st === 'FAILED' || st === 'CANCELED') throw new Error(`任务失败：${st} ${JSON.stringify(qj?.output || {}).slice(0, 160)}`);
    }
    throw new Error('任务轮询超时');
  }

  const url = provider.pick(json);
  if (!url) throw new Error(`未拿到图片 URL：${text.slice(0, 200)}`);
  const img = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!img.ok) throw new Error(`下载图片失败 HTTP ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

/* ───────── 主循环 ───────── */
console.log(`供应商：${provider.label}（${pKey}）`);
console.log(`模型：${model}　风格：${style.label}　尺寸：${size}`);
console.log(`计划：${list.length} 张　输出目录：${OUT}\n`);

const report = { provider: pKey, model, style: arg('style', 'w'), size, at: new Date().toISOString(), items: [] };
let ok = 0; let skip = 0; let fail = 0;

for (const card of list) {
  const file = join(OUT, `${card.id}.jpg`);
  if (!force && existsSync(file)) {
    skip++;
    console.log(`跳过 ${card.id}`);
    continue;
  }
  const t0 = Date.now();
  try {
    const buf = await generateOne(card);
    if (buf.length < 2000) throw new Error(`内容过小（${buf.length}B）`);
    await writeFile(file, buf);
    ok++;
    console.log(`✔ ${card.id.padEnd(14)} ${card.en.padEnd(22)} ${(buf.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    report.items.push({ id: card.id, ok: true, bytes: buf.length });
  } catch (err) {
    fail++;
    console.log(`✘ ${card.id.padEnd(14)} ${err.message}`);
    report.items.push({ id: card.id, ok: false, error: err.message });
  }
  await sleep(delay);
}

/* 报告：每次运行写一份带时间戳的存档（历史永不被覆盖），
   同时更新 _report.json 作为「最近一次」的快捷入口。
   时间戳形如 _report-2026-09-21T02-47-20.json */
const summary = { ...report, ok, skipped: skip, failed: fail };
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const archive = join(OUT, `_report-${stamp}.json`);
await writeFile(archive, JSON.stringify(summary, null, 2));
await writeFile(join(OUT, '_report.json'), JSON.stringify(summary, null, 2));
console.log(`\n完成：成功 ${ok}　跳过 ${skip}　失败 ${fail}`);
console.log(`报告存档：${archive}`);
console.log('下一步：把生成的图接到卡面上（我可以帮你做这一步）。');
