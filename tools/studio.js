/* ===========================================================
   tools/studio.js · 卡面生成台前端
   与服务端 /api/studio/* 通信；密钥只存本机 localStorage。
   =========================================================== */

const $ = (id) => document.getElementById(id);

const STORE_KEY = 'whale-tarot-studio';
/* 设置结构变更时提升版本，避免旧版本存下的失效值（例如已不支持的尺寸）继续生效 */
const STORE_VERSION = 2;

/* 每张牌的画面描述（与服务端无关，纯提示词） */
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
};

/* 统一的形象描述（可按自己喜好改写；改这里会应用到之后所有生成） */
const STYLE = `anime tarot card illustration, cute whale girl character, \
long wavy gradient blue hair to the knees, a single ahoge strand, \
cetacean ear fins with pale tips and a small blue ribbon, large blue eyes with highlights, \
white frilled maid headdress, navy blue victorian dress with white apron and puff sleeves, \
navy ribbon bow, a large whale tail behind her, white stockings, navy shoes, `;

const TAIL = `, soft cel shading, clean line art, mystical night background with stars, \
vertical composition, plain dark backdrop, no text, no watermark`;

const hintFor = (card) => ART_HINT[card.id]
  || `${card.name} (${card.en}), ${ART_HINT[card.suit] || ''}`;

const buildPrompt = (card, cardEn) =>
  `${STYLE}theme: ${cardEn || card.en}, ${hintFor(card)}${TAIL}`;

/* ───────── 状态 ───────── */
const state = {
  cards: [],
  providers: {},
  existing: [],
  current: null,
  lastImage: null,     // { dataUrl, cardId }
  running: false,
  stopFlag: false,
  /* model / size 故意留空：由所选供应商的默认值决定，避免写死的旧值造成「尺寸不对」 */
  settings: { provider: 'ark', model: '', key: '', size: '' },
};

/* ───────── 本地设置 ───────── */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.v !== STORE_VERSION) {
      /* 旧版本设置：只保留密钥，其余用新默认值，避免旧尺寸/模型继续报错 */
      if (saved.key) state.settings.key = saved.key;
      saveSettings();
      return;
    }
    Object.assign(state.settings, saved);
  } catch { /* 忽略 */ }
}
function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...state.settings, v: STORE_VERSION }));
  } catch { /* 忽略 */ }
}

/* ───────── 日志 ───────── */
function log(msg, cls = '') {
  const el = $('log');
  const line = document.createElement('div');
  if (cls) line.className = cls;
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  line.textContent = `[${t}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
const setStatus = (t) => { $('status').textContent = t; };
const setBar = (p) => { $('bar').style.width = `${Math.max(0, Math.min(100, p))}%`; };

/* ───────── 初始化 ───────── */
async function boot() {
  loadSettings();

  let data;
  try {
    const r = await fetch('/api/studio/cards');
    data = await r.json();
  } catch (e) {
    log('无法连接服务端：请用 node tools/serve.mjs 启动，并通过 http:// 打开本页', 'bad');
    return;
  }
  state.cards = data.cards;
  state.providers = data.providers;

  /* 供应商下拉 */
  const ps = $('provider');
  ps.innerHTML = '';
  for (const [k, v] of Object.entries(state.providers)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = `${v.label}　(${k})`;
    ps.appendChild(o);
  }
  ps.value = state.providers[state.settings.provider] ? state.settings.provider : Object.keys(state.providers)[0];
  /* 牌下拉 */
  const cs = $('card');
  cs.innerHTML = '';
  for (const c of state.cards) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.id}　${c.name}　${c.en}`;
    cs.appendChild(o);
  }

  /* 回填设置 */
  $('key').value = state.settings.key || '';
  $('size').value = state.settings.size || '768x1344';
  onProviderChange();
  selectCard(state.cards[0].id);
  await loadExisting();
  bind();

  log('就绪。填好 API Key 后即可生成。', 'gd');
}

function onProviderChange() {
  const k = $('provider').value;
  const p = state.providers[k] || {};

  /* 模型 ID：换供应商时用它的默认模型（除非用户在当前供应商下已自定义） */
  $('model').value = (state.settings.provider === k && state.settings.model)
    ? state.settings.model
    : (p.defaultModel || '');

  /* 尺寸：按供应商动态生成，只列它支持的取值 */
  const sel = $('size');
  const opts = p.sizeOptions || [];
  sel.innerHTML = '';
  for (const s of opts) {
    const o = document.createElement('option');
    o.value = s;
    const [w, h] = s.split('x').map(Number);
    o.textContent = h ? `${s}　（${w > h ? '横版' : w === h ? '方图' : '竖版'}）` : `${s} 档位`;
    sel.appendChild(o);
  }
  const custom = document.createElement('option');
  custom.value = '__custom__';
  custom.textContent = '自定义…（手动输入 宽x高 或 2K 这类档位）';
  sel.appendChild(custom);

  const want = (state.settings.provider === k && state.settings.size) ? state.settings.size : (p.defaultSize || opts[0] || '');
  if (opts.includes(want)) {
    sel.value = want;
  } else if (want) {
    sel.value = '__custom__';
    $('sizeCustom').value = want;
  }
  toggleCustomSize();
  $('sizeHint').textContent = p.sizeNote || '';
}

/* 自定义尺寸输入框的显示切换 */
function toggleCustomSize() {
  const isCustom = $('size').value === '__custom__';
  $('sizeCustom').style.display = isCustom ? '' : 'none';
  if (isCustom) $('sizeCustom').focus();
}

function currentSize() {
  return $('size').value === '__custom__'
    ? $('sizeCustom').value.trim()
    : $('size').value;
}

function selectCard(id) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  state.current = card;
  $('card').value = id;
  $('cardEn').value = card.en;
  $('prompt').value = buildPrompt(card, card.en);
}

/* ───────── 已有素材 ───────── */
async function loadExisting() {
  try {
    const r = await fetch('/api/studio/existing');
    const j = await r.json();
    state.existing = j.files || [];
  } catch { state.existing = []; }

  const host = $('existing');
  host.innerHTML = '';
  const done = new Set(state.existing.map((f) => f.replace(/\.[a-z]+$/i, '')));
  for (const c of state.cards) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.type = 'button';
    b.setAttribute('aria-pressed', String(done.has(c.id)));
    b.innerHTML = `${c.name}<br /><span class="${done.has(c.id) ? 'done' : ''}">${done.has(c.id) ? '已生成' : c.id}</span>`;
    b.addEventListener('click', () => selectCard(c.id));
    host.appendChild(b);
  }
  $('existingInfo').textContent = `已生成 ${done.size} / ${state.cards.length} 张。点任意一张可跳到它。`;
  return done;
}

/* ───────── 生成 ───────── */
async function generateOne(card, { writeToCard = false, keepPreview = true } = {}) {
  const key = $('key').value.trim();
  if (!key) throw new Error('请先填 API Key');
  const prompt = $('prompt').value.trim();
  if (!prompt) throw new Error('提示词不能为空');

  const body = {
    provider: $('provider').value,
    model: $('model').value.trim(),
    prompt,
    size: currentSize(),
    cardId: card.id,
    key,
  };

  const res = await fetch('/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.ok) {
    let msg = `${j.error}`;
    if (j.detail) msg += `\n上游返回：${j.detail}`;
    if (j.sentSize) msg += `\n本次发送的 size：${j.sentSize}　model：${j.sentModel || model}`;
    if (j.sizeOptions?.length) msg += `\n该服务商常用尺寸：${j.sizeOptions.join('、')}`;
    throw new Error(msg);
  }

  if (keepPreview) {
    $('preview').innerHTML = '';
    const img = document.createElement('img');
    img.src = j.preview;
    img.alt = card.en;
    $('preview').appendChild(img);
    state.lastImage = { dataUrl: j.preview, cardId: card.id };
    $('save').disabled = false;
  }
  return j;
}

/* ───────── 事件 ───────── */
function bind() {
  $('provider').addEventListener('change', () => {
    state.settings.provider = $('provider').value;
    state.settings.model = '';
    onProviderChange();
    saveSettings();
  });
  $('model').addEventListener('change', () => { state.settings.model = $('model').value.trim(); saveSettings(); });
  $('key').addEventListener('change', () => {
    state.settings.key = $('key').value.trim();
    saveSettings();
    log('密钥已保存在本机浏览器（不会上传到任何地方，除你选的服务商）。');
  });
  $('size').addEventListener('change', () => {
    toggleCustomSize();
    state.settings.size = currentSize();
    saveSettings();
  });
  $('sizeCustom').addEventListener('change', () => {
    state.settings.size = currentSize();
    saveSettings();
  });

  $('showLogs').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/studio/logs');
      const j = await r.json();
      const logs = j.logs || [];
      if (!logs.length) { log('还没有请求记录。', 'gd'); return; }
      log(`—— 最近 ${logs.length} 条请求记录 ——`, 'gd');
      for (const e of logs) {
        const t = e.t.slice(11, 19);
        const line = e.ok
          ? `✔ ${t} ${e.provider}/${e.model} size=${e.size} ${e.cardId || '-'} ${(e.bytes / 1024).toFixed(0)}KB`
          : `✘ ${t} ${e.provider}/${e.model || '-'} size=${e.size || '-'} ${e.cardId || '-'} :: ${String(e.error).slice(0, 200)}`;
        log(line, e.ok ? 'ok' : 'bad');
      }
    } catch (err) { log(`读取记录失败：${err.message}`, 'bad'); }
  });

  $('card').addEventListener('change', () => selectCard($('card').value));
  $('reset').addEventListener('click', () => {
    if (state.current) {
      $('cardEn').value = state.current.en;
      $('prompt').value = buildPrompt(state.current, state.current.en);
    }
  });

  $('gen').addEventListener('click', async () => {
    if (state.running) return;
    state.running = true;
    $('gen').disabled = true;
    setBar(10);
    setStatus(`正在生成「${state.current.name}」…`);
    log(`开始生成 ${state.current.id}（${state.current.en}）`, 'gd');
    try {
      const j = await generateOne(state.current);
      setBar(100);
      setStatus(`已生成「${state.current.name}」，${(j.bytes / 1024).toFixed(0)}KB，已写入 assets/tarot/${j.saved}`);
      log(`✔ ${state.current.id} 生成成功，${(j.bytes / 1024).toFixed(0)}KB → ${j.saved}`, 'ok');
      if (j.manifest) log(`卡面清单已更新：${j.manifest.count} / ${j.manifest.total} 张使用插画`, 'ok');
      await loadExisting();
      if (state.running) setTimeout(() => setBar(0), 1200);
    } catch (e) {
      setStatus('生成失败。');
      log(`✘ ${e.message}`, 'bad');
      setBar(0);
    } finally {
      state.running = false;
      $('gen').disabled = false;
    }
  });

  $('save').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/studio/refresh', { method: 'POST' });
      const j = await r.json();
      if (j.ok) {
        log(`卡面清单已刷新：${j.manifest.count} / ${j.manifest.total}`, 'ok');
        await loadExisting();
        setStatus('已写入卡面。回到站点刷新页面即可看到。');
      }
    } catch (e) { log(`刷新失败：${e.message}`, 'bad'); }
  });

  $('refresh').addEventListener('click', async () => {
    const r = await fetch('/api/studio/refresh', { method: 'POST' });
    const j = await r.json();
    if (j.ok) { log(`卡面清单已刷新：${j.manifest.count} / ${j.manifest.total}`, 'ok'); await loadExisting(); }
  });

  $('viewSite').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = './index.html';
  });

  $('batchMajor').addEventListener('click', () => runBatch(state.cards.filter((c) => c.arcana === 'major')));
  $('batchAll').addEventListener('click', () => runBatch(state.cards));
  $('stop').addEventListener('click', () => {
    state.stopFlag = true;
    log('已请求停止，当前这张完成后停下。', 'bad');
  });
}

/* ───────── 批量 ───────── */
async function runBatch(list) {
  if (state.running) { log('已有任务在跑，先停止。', 'bad'); return; }
  if (!$('key').value.trim()) { log('请先填 API Key。', 'bad'); return; }

  const done = new Set(state.existing.map((f) => f.replace(/\.[a-z]+$/i, '')));
  const todo = list.filter((c) => !done.has(c.id));
  if (!todo.length) { log('这些牌都已经生成过了，无需批量。', 'gd'); return; }

  state.running = true;
  state.stopFlag = false;
  $('gen').disabled = true;
  log(`批量开始：${todo.length} 张（已跳过 ${list.length - todo.length} 张已生成的）`, 'gd');

  let ok = 0; let fail = 0;
  const savedEn = $('cardEn').value;
  const savedPrompt = $('prompt').value;

  for (let i = 0; i < todo.length; i++) {
    if (state.stopFlag) { log('已停止。', 'bad'); break; }
    const card = todo[i];
    selectCard(card.id);
    $('cardEn').value = card.en;
    $('prompt').value = buildPrompt(card, card.en);
    setStatus(`批量中 ${i + 1}/${todo.length}：${card.name}`);
    setBar(((i) / todo.length) * 100);
    try {
      const j = await generateOne(card, { keepPreview: true });
      ok++;
      log(`✔ [${i + 1}/${todo.length}] ${card.id} ${(j.bytes / 1024).toFixed(0)}KB`, 'ok');
      await loadExisting();
    } catch (e) {
      fail++;
      log(`✘ [${i + 1}/${todo.length}] ${card.id} ${e.message}`, 'bad');
    }
    if (i < todo.length - 1 && !state.stopFlag) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  setBar(100);
  setStatus(`批量结束：成功 ${ok}，失败 ${fail}`);
  log(`批量结束：成功 ${ok}，失败 ${fail}`, ok ? 'gd' : 'bad');
  state.running = false;
  $('gen').disabled = false;
  $('cardEn').value = savedEn;
  $('prompt').value = savedPrompt;
  setTimeout(() => setBar(0), 1500);
}

boot();
