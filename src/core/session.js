/* ===========================================================
   session.js · 局面持久化与分享链接

   两件事：

   1) sessionStorage 存「当前这一局」，刷新/误关标签页不丢牌。
      只存种子和抽了哪几张——state.shuffled 完全由 mulberry32(seed)
      决定，可完整重放，不必存 78 张牌的顺序。

   2) URL hash 存同一份数据，用于分享「同一副牌」：
        https://…/#r=<base64url>
      对方打开就是一模一样的一局。

   编码刻意做得很短：一次抽牌只记录 fanIndex（第几张），
   正逆位与牌 id 都能从 seed 推出来，所以 7 张牌也就几十个字符。
   =========================================================== */

const KEY = 'whale-oracle-session';
const VERSION = 1;

/* ───────── base64url（要兼容中文，所以先过 TextEncoder） ───────── */
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  /* 分块拼接，避免 String.fromCharCode(...bigArray) 爆栈 */
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ───────── 内部紧凑结构 ─────────
   v 版本 | s 种子 | c 方向 | p 牌阵 | f 铺牌张数 | k 抽中的位置数组
   n 称呼 | q 问题（都只在非空时才写入） */
function pack(data) {
  const o = {
    v: VERSION,
    s: data.seed >>> 0,
    c: data.category,
    p: data.spread,
    f: data.fanCount,
    k: (data.picks || []).map((x) => (typeof x === 'number' ? x : x.fanIndex)),
  };
  if (data.userName) o.n = data.userName;
  if (data.question) o.q = data.question;
  return o;
}

function unpack(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.v !== VERSION) return null;
  if (!Number.isFinite(o.s) || typeof o.c !== 'string' || typeof o.p !== 'string') return null;
  if (!Array.isArray(o.k) || !Number.isFinite(o.f) || o.f <= 0) return null;
  const picks = o.k.filter((n) => Number.isInteger(n) && n >= 0 && n < o.f);
  if (picks.length !== o.k.length) return null; // 有非法位置，整份丢弃
  return {
    seed: o.s >>> 0,
    category: o.c,
    spread: o.p,
    fanCount: o.f,
    picks,
    userName: typeof o.n === 'string' ? o.n.slice(0, 16) : '',
    question: typeof o.q === 'string' ? o.q.slice(0, 60) : '',
  };
}

/* ───────── sessionStorage ───────── */

export function saveSession(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pack(data)));
  } catch {
    /* 隐私模式 / 配额满：持久化是加分项，失败不影响占卜 */
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? unpack(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* 同上 */ }
}

/* ───────── URL 分享 ───────── */

export function buildShareUrl(data) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#r=${toBase64Url(JSON.stringify(pack(data)))}`;
}

/** 从 location.hash 里读局面；没有或格式不对都返回 null */
export function readShare(hash = location.hash) {
  const m = /[#&]r=([A-Za-z0-9\-_]+)/.exec(hash || '');
  if (!m) return null;
  try {
    return unpack(JSON.parse(fromBase64Url(m[1])));
  } catch {
    return null;
  }
}

/** 复制到剪贴板；返回是否成功（http 下 navigator.clipboard 可能不可用） */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 回落到 execCommand */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
