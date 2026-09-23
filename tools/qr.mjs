/* ===========================================================
   tools/qr.mjs · 极简 QR 码生成（字节模式 / 纠错级 M）
   只为本项目服务：把手机访问地址渲染成终端二维码，避免装依赖。
   支持版本 1–9，足够放下 http://192.168.x.x:4173/ 这类短地址。
   =========================================================== */

/* GF(256) 运算表 */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/* 版本 → (每块数据码字, 纠错码字) 与分块数，纠错级 M */
const RS_M = {
  1: { ec: 10, blocks: 1, data: 16 },
  2: { ec: 16, blocks: 1, data: 28 },
  3: { ec: 26, blocks: 1, data: 44 },
  4: { ec: 18, blocks: 2, data: 32 },
  5: { ec: 24, blocks: 2, data: 43 },
  6: { ec: 16, blocks: 4, data: 27 },
  7: { ec: 18, blocks: 4, data: 31 },
  8: { ec: 22, blocks: 2, data: 38 },
  9: { ec: 22, blocks: 3, data: 36 },
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46] };

function rsGenPoly(n) {
  let p = [1];
  for (let i = 0; i < n; i++) {
    const q = [1, EXP[i]];
    const r = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      r[j] ^= mul(p[j], q[0]);
      r[j + 1] ^= mul(p[j], q[1]);
    }
    p = r;
  }
  return p;
}

function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  data.forEach((v, i) => { res[i] = v; });
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], coef);
  }
  return res.slice(data.length);
}

function makeMatrix(version, dataCodewords) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setF = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = v; reserved[y][x] = true; } };

  // 定位图形
  for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const dark = inside && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        setF(ox + x, oy + y, dark ? 1 : 0);
      }
    }
  }
  // 校正图形
  for (const cy of ALIGN[version]) {
    for (const cx of ALIGN[version]) {
      if ((cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9)) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
          setF(cx + x, cy + y, dark ? 1 : 0);
        }
      }
    }
  }
  // 时序图形
  for (let i = 8; i < size - 8; i++) {
    setF(i, 6, i % 2 === 0 ? 1 : 0);
    setF(6, i, i % 2 === 0 ? 1 : 0);
  }
  // 固定的暗模块
  setF(8, size - 8, 1);
  // 预留格式信息区
  for (let i = 0; i < 9; i++) { setF(8, i, 0); setF(i, 8, 0); }
  for (let i = 0; i < 8; i++) { setF(size - 1 - i, 8, 0); setF(8, size - 1 - i, 0); }

  // 数据放置
  const bits = [];
  for (const b of dataCodewords) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  let idx = 0;
  let up = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x = 5;
    for (let k = 0; k < size; k++) {
      const y = up ? size - 1 - k : k;
      for (const xx of [x, x - 1]) {
        if (reserved[y][xx]) continue;
        m[y][xx] = idx < bits.length ? bits[idx++] : 0;
      }
    }
    up = !up;
  }
  return { m, reserved, size };
}

function maskFn(id, x, y) {
  switch (id) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function penalty(m, size) {
  let p = 0;
  // 规则1：同色连续
  for (let y = 0; y < size; y++) {
    let run = 1;
    for (let x = 1; x < size; x++) {
      if (m[y][x] === m[y][x - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; }
    }
    if (run >= 5) p += run - 2;
  }
  for (let x = 0; x < size; x++) {
    let run = 1;
    for (let y = 1; y < size; y++) {
      if (m[y][x] === m[y - 1][x]) run++; else { if (run >= 5) p += run - 2; run = 1; }
    }
    if (run >= 5) p += run - 2;
  }
  // 规则2：2x2 同色
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3;
    }
  }
  return p;
}

/** 生成 QR 矩阵（0/1 二维数组） */
export function qrMatrix(text) {
  const bytes = [...Buffer.from(text, 'utf8')];

  // 选版本
  let version = 0;
  for (let v = 1; v <= 9; v++) {
    const cap = RS_M[v].data * RS_M[v].blocks * 8;
    const need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
    if (need <= cap) { version = v; break; }
  }
  if (!version) throw new Error('内容过长，超出本生成器支持范围');

  const cfg = RS_M[version];
  const totalData = cfg.data * cfg.blocks;

  // 位流：模式 0100（字节）+ 长度 + 数据
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(4, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  // 结束符 + 补齐
  const capBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    dataBytes.push(v);
  }
  const PAD = [0xec, 0x11];
  let pi = 0;
  while (dataBytes.length < totalData) dataBytes.push(PAD[pi++ % 2]);

  // 分块 + 纠错
  const perBlock = cfg.data;
  const all = [];
  const ecAll = [];
  for (let i = 0; i < cfg.blocks; i++) {
    const blk = dataBytes.slice(i * perBlock, (i + 1) * perBlock);
    all.push(blk);
    ecAll.push(rsEncode(blk, cfg.ec));
  }
  const finalBytes = [];
  for (let i = 0; i < perBlock; i++) for (const blk of all) finalBytes.push(blk[i]);
  for (let i = 0; i < cfg.ec; i++) for (const blk of ecAll) finalBytes.push(blk[i]);

  // 放矩阵并选掩码
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const { m, reserved, size } = makeMatrix(version, finalBytes);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (reserved[y][x]) continue;
        if (maskFn(mask, x, y)) m[y][x] ^= 1;
      }
    }
    const p = penalty(m, size);
    if (!best || p < best.p) best = { m, size, p, mask };
  }
  return best.m;
}

/** 渲染成终端二维码（用半角块拼两个像素行） */
export function qrToTerminal(text, { quiet = 2 } = {}) {
  const m = qrMatrix(text);
  const size = m.length;
  const pad = quiet;
  const lines = [];
  const row = (y) => {
    let s = '';
    for (let x = -pad; x < size + pad; x++) {
      const a = y >= 0 && y < size && x >= 0 && x < size ? m[y][x] : 0;
      const b = y + 1 >= 0 && y + 1 < size && x >= 0 && x < size ? m[y + 1][x] : 0;
      // 上黑下黑=█ 上黑下白=▀ 上白下黑=▄ 全白=空格
      s += a && b ? '█' : a ? '▀' : b ? '▄' : ' ';
    }
    return s;
  };
  for (let y = -pad; y < size + pad; y += 2) lines.push(row(y));
  return lines.join('\n');
}
