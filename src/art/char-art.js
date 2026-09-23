/* ===========================================================
   char-art.js · 程序化「鲸鱼娘」角色
   设计原型（藏青＋白女仆装鲸鱼娘）的要点，全部参数化绘制：
     · 蓝色渐变长波浪发（及膝）＋ 呆毛
     · 鲸类耳鳍，鳍尖为浅色、根系蓝色小丝带
     · 大蓝瞳、眼内高光与渐变虹膜
     · 白色荷叶边女仆头饰
     · 藏青连衣裙 ＋ 白色胸襟／围裙 ＋ 泡泡袖 ＋ 深蓝领结
     · 身后大鲸尾
     · 藏青玛丽珍鞋 ＋ 白袜
   坐标约定：局部 (0,0) = 脚底；Y 轴向上为负；全身高约 600 单位（约 6.5 头身）。
   =========================================================== */

const SKIN = '#f9dcc9';
const SKIN_SHADE = '#efc3ae';
const SKIN_LINE = '#c98f78';
const LINE = '#5d4550';

/* ───────── 鲸类耳鳍 ───────── */
function headFin(side, x, y) {
  // side = 1 右耳，-1 左耳；整体用 scale 镜像
  return `
  <g transform="translate(${x} ${y}) scale(${side} 1)">
    <!-- 鳍本体：外缘深、内侧浅 -->
    <path d="M 0 6 C 14 -6 30 -16 48 -20 C 40 -4 30 14 18 32 C 12 24 6 14 0 6 Z"
          fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M 8 8 C 20 -1 33 -9 44 -14 C 37 -3 29 9 20 22 C 16 16 12 12 8 8 Z"
          fill="#dbe7ff" opacity="0.85"/>
    <path d="M 16 8 C 24 2 33 -3 41 -7" fill="none" stroke="#8fa8ff" stroke-width="1" opacity="0.6"/>
    <!-- 根系丝带 -->
    <path d="M -2 4 C -8 2 -13 4 -16 8 C -10 10 -5 9 -1 7 Z" fill="#5a76d8" stroke="#1b2450" stroke-width="0.8"/>
    <path d="M -2 4 C -9 -1 -15 -1 -19 1 C -13 5 -6 5 -1 6 Z" fill="#6f8bff" stroke="#1b2450" stroke-width="0.8"/>
    <circle cx="-3" cy="5" r="2.4" fill="#9fb4ff" stroke="#1b2450" stroke-width="0.7"/>
  </g>`;
}

/* ───────── 呆毛 ───────── */
function ahoge() {
  return `
  <path d="M 6 -588 C 0 -612 -10 -628 -26 -636 C -12 -630 -2 -616 4 -600"
        fill="none" stroke="url(#dsh-hair)" stroke-width="3" stroke-linecap="round"/>
  <path d="M 6 -588 C 12 -610 24 -622 40 -626 C 26 -618 16 -606 10 -592"
        fill="none" stroke="url(#dsh-hair)" stroke-width="2.6" stroke-linecap="round"/>`;
}

/* ───────── 女仆头饰：白色荷叶边发箍（用圆形扇贝连成一圈） ───────── */
function headdress() {
  const arc = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.PI * (0.14 + t * 0.72); // 从左耳上方翻到右耳上方
    const x = -46 * Math.cos(a);
    const y = -606 - Math.sin(a) * 13;
    const r = 6.6 + Math.sin(t * Math.PI) * 1.6;
    arc.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffffff" stroke="#c2cde8" stroke-width="1"/>`);
  }
  return `
  <path d="M -46 -600 C -32 -616 32 -616 46 -600 C 30 -594 -30 -594 -46 -600 Z"
        fill="#f2f6ff" stroke="#c2cde8" stroke-width="1"/>
  ${arc.join('')}`;
}

/* ───────── 一只手（简化的连指手型） ───────── */
function hand(cx, cy, rot = 0) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <path d="M -7 0 C -7 -8 7 -8 7 0 C 7 9 3 13 0 13 C -3 13 -7 9 -7 0 Z"
          fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="1"/>
    <path d="M -4 -5 C -4 -10 -1 -12 1 -12 C 4 -12 5 -9 5 -5" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.9"/>
  </g>`;
}

/* ───────── 法器 ───────── */
function prop(kind) {
  switch (kind) {
    case 'wand':
      return `<g transform="translate(86 -300) rotate(-10)">
        <path d="M 0 -52 L 0 52" stroke="#e8c98a" stroke-width="3" stroke-linecap="round"/>
        <path d="M -9 -24 q 9 6 18 0 M -9 -4 q 9 6 18 0 M -9 16 q 9 6 18 0" fill="none" stroke="#8ff0e6" stroke-width="1.4" opacity="0.75"/>
        <circle cx="0" cy="-56" r="4.4" fill="#f6e6bb"/></g>`;
    case 'grail':
      return `<g transform="translate(0 -430)">
        <path d="M -22 -8 L 22 -8 q -4 28 -22 32 q -18 -4 -22 -32 Z" fill="rgba(180,220,255,0.4)" stroke="#e8c98a" stroke-width="2"/>
        <path d="M 0 24 L 0 38 M -13 42 q 13 -8 26 0" fill="none" stroke="#e8c98a" stroke-width="2"/>
        <circle cx="0" cy="-30" r="4" fill="#cfe0ff" opacity="0.9"/></g>`;
    case 'sword':
      return `<g transform="translate(84 -410) rotate(8)">
        <path d="M 0 -60 L 4 -42 L 4 22 L -4 22 L -4 -42 Z" fill="#e6ecff" stroke="#e8c98a" stroke-width="1.4"/>
        <path d="M -16 22 L 16 22 M 0 22 L 0 42" fill="none" stroke="#e8c98a" stroke-width="2.4" stroke-linecap="round"/></g>`;
    case 'pentacle':
      return `<g transform="translate(78 -286)">
        <circle r="24" fill="rgba(12,26,20,0.55)" stroke="#8ce0a8" stroke-width="2.2"/>
        <path d="M 0 -17 L 10 -5 L 16 9 L 0 17 L -16 9 L -10 -5 Z" fill="none" stroke="#8ce0a8" stroke-width="2"/></g>`;
    case 'lantern':
      return `<g transform="translate(74 -262)">
        <path d="M -13 -12 L 13 -12 L 16 18 L -16 18 Z" fill="#ffd88a" opacity="0.9" stroke="#e8c98a" stroke-width="1.8"/>
        <path d="M 0 -12 L 0 -32 M -9 -32 L 9 -32" fill="none" stroke="#e8c98a" stroke-width="2"/>
        <circle cx="0" cy="3" r="15" fill="#ffe6a8" opacity="0.3"/></g>`;
    case 'scales':
      return `<g transform="translate(80 -330)">
        <path d="M 0 -24 L 0 18 M -24 -12 L 24 -12" fill="none" stroke="#e8c98a" stroke-width="2.6"/>
        <path d="M -24 -12 q 0 18 12 18 q 12 0 12 -18 M 24 -12 q 0 18 -12 18 q -12 0 -12 -18" fill="none" stroke="#e8c98a" stroke-width="1.8"/>
        <circle cx="0" cy="-27" r="3.6" fill="#e8c98a"/></g>`;
    case 'book':
      return `<g transform="translate(-78 -318)">
        <path d="M -20 -14 L 0 -8 L 0 18 L -20 12 Z" fill="#cfe0ff" opacity="0.92" stroke="#e8c98a" stroke-width="1.6"/>
        <path d="M 20 -14 L 0 -8 L 0 18 L 20 12 Z" fill="#a9c6ff" opacity="0.92" stroke="#e8c98a" stroke-width="1.6"/></g>`;
    case 'flower':
      return `<g transform="translate(76 -280)">
        <path d="M 0 0 q -10 -16 -3 -28" fill="none" stroke="#8ce0a8" stroke-width="2"/>
        <circle cx="-3" cy="-32" r="9" fill="#ffd7e6" opacity="0.95"/>
        <circle cx="-3" cy="-32" r="3.6" fill="#fff2b8"/></g>`;
    case 'star':
      return `<g transform="translate(0 -470)">
        <path d="M 0 -22 L 6 -6 L 22 0 L 6 6 L 0 22 L -6 6 L -22 0 L -6 -6 Z" fill="#ffe9b0" opacity="0.95"/>
        <circle cx="0" cy="0" r="34" fill="#ffe9b0" opacity="0.2"/></g>`;
    case 'key':
      return `<g transform="translate(78 -300) rotate(10)">
        <circle cx="0" cy="-22" r="9" fill="none" stroke="#e8c98a" stroke-width="2.4"/>
        <path d="M 0 -13 L 0 26 M 0 12 L 11 12 M 0 22 L 9 22" fill="none" stroke="#e8c98a" stroke-width="2.4" stroke-linecap="round"/></g>`;
    case 'bell':
      return `<g transform="translate(80 -330)">
        <path d="M -15 12 q 0 -27 15 -27 q 15 0 15 27 Z" fill="#ffd88a" opacity="0.92" stroke="#e8c98a" stroke-width="1.7"/>
        <circle cx="0" cy="17" r="4.4" fill="#e8c98a"/></g>`;
    case 'lanternHigh':
      return `<g transform="translate(0 -490)">
        <path d="M -11 -10 L 11 -10 L 14 16 L -14 16 Z" fill="#ffd88a" opacity="0.9" stroke="#e8c98a" stroke-width="1.6"/>
        <circle cx="0" cy="2" r="13" fill="#ffe6a8" opacity="0.3"/></g>`;
    default:
      return '';
  }
}

/* ───────── 冠饰 ───────── */
function crown(kind) {
  switch (kind) {
    case 'crescent':
      return `<g transform="translate(46 -600)">
        <path d="M 0 -14 a 14 14 0 1 0 18 14 a 10 10 0 1 1 -18 -14 Z" fill="#e8c98a"/>
        <path d="M 2 -28 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" fill="#f6e6bb"/></g>`;
    case 'tiara':
      return `<g transform="translate(0 -596)" fill="#e8c98a">
        <path d="M -30 6 l 9 -18 l 10 13 l 11 -19 l 11 19 l 10 -13 l 9 18 Z" stroke="#8a6a2c" stroke-width="0.9" stroke-linejoin="round"/>
        <circle cx="0" cy="-16" r="4.4" fill="#8ff0e6" stroke="#8a6a2c" stroke-width="0.8"/></g>`;
    case 'laurel':
      return `<g transform="translate(0 -592)" fill="none" stroke="#8ce0a8" stroke-width="2.6" stroke-linecap="round">
        <path d="M -44 4 q -12 -18 -2 -34 M -34 -2 q -6 -16 2 -26"/>
        <path d="M 44 4 q 12 -18 2 -34 M 34 -2 q 6 -16 -2 -26"/></g>`;
    case 'horn':
      return `<g transform="translate(0 -590)">
        <path d="M -34 -2 q -12 -24 -6 -44 q 14 14 20 36 Z" fill="#e8c98a" stroke="#8a6a2c" stroke-width="1"/>
        <path d="M 34 -2 q 12 -24 6 -44 q -14 14 -20 36 Z" fill="#e8c98a" stroke="#8a6a2c" stroke-width="1"/></g>`;
    case 'veil':
      return `<path d="M -44 -586 C -30 -598 30 -598 44 -586 L 52 -424 C 10 -404 -10 -404 -52 -424 Z"
              fill="#dbe7ff" opacity="0.18"/>`;
    default:
      return '';
  }
}

/* ───────── 角色主函数 ───────── */
/**
 * @param {object} c
 *   pose: sit 站立 / float 微浮 / lean 侧身 / kneel 低身
 *   arms: down-hold（提裙，参考图姿势）/ open / up / pray / one
 */
export function renderCharacter(c = {}) {
  const {
    pose = 'sit',
    arms = 'down-hold',
    hair = 'wave',
    outfit = 'maid',
    crown: crownKind = 'none',
    prop: propKind = 'none',
    veil = false,
    aura = '#4d6bfe',
  } = c;

  const lift = pose === 'float' ? -16 : 0;
  const tilt = pose === 'lean' ? -3 : 0;
  const bob = pose === 'kneel' ? 26 : 0;

  /* 手臂：左（-1）右（1）× 肩→手 */
  const armSet = {
    'down-hold': [[1, 62, 232], [-1, 58, 168]],
    down: [[1, 34, 240], [-1, 34, 240]],
    open: [[1, 76, 168], [-1, 76, 168]],
    up: [[1, 44, -96], [-1, 44, -96]],
    one: [[1, 80, -78], [-1, 34, 240]],
    pray: [[1, 8, 104], [-1, 8, 104]],
  }[arms] || [];
  const shoulderY = -406;
  const shoulderX = 36;

  const armSvg = armSet.map(([side, dx, dy]) => {
    const sx = side * shoulderX;
    const ex = side * (shoulderX + dx);
    const ey = shoulderY + dy;
    const cx = side * (shoulderX + dx * 0.42);
    const cy = shoulderY + dy * 0.46;
    return `<path d="M ${sx} ${shoulderY} Q ${cx.toFixed(0)} ${cy.toFixed(0)} ${ex.toFixed(0)} ${ey.toFixed(0)}"/>`;
  }).join('');

  const hands = armSet.map(([side, dx, dy]) =>
    hand(side * (shoulderX + dx), shoulderY + dy, side > 0 ? 16 : -16)).join('');

  /* 白色袖口：只落在每只手的末端 */
  const cuffSvg = `
    <g fill="none" stroke="#f7faff" stroke-width="15" stroke-linecap="round">
      ${armSet.map(([side, dx, dy]) => {
        const ex = side * (shoulderX + dx);
        const ey = shoulderY + dy;
        const mx = side * (shoulderX + dx * 0.72);
        const my = shoulderY + dy * 0.76;
        return `<path d="M ${mx.toFixed(0)} ${my.toFixed(0)} L ${ex.toFixed(0)} ${ey.toFixed(0)}"/>`;
      }).join('')}
    </g>`;

  /* 裙摆：女仆连衣裙（藏青，外扩） */
  const skirt = `
    <path d="M -40 -330 C -56 -300 -74 -240 -84 -168 C -90 -132 -92 -100 -92 -76
             L 92 -76 C 92 -100 90 -132 84 -168 C 74 -240 56 -300 40 -330 Z"
          fill="url(#dsh-robe)" stroke="#1b2450" stroke-width="1.4"/>
    <path d="M -92 -76 q 92 20 184 0" fill="none" stroke="#e8c98a" stroke-width="2" opacity="0.75"/>
    <path d="M -88 -96 q 88 18 176 0" fill="none" stroke="#e8c98a" stroke-width="1.1" opacity="0.5"/>
    <!-- 裙面暗纹 -->
    <g fill="none" stroke="#cfe0ff" stroke-width="1" opacity="0.22">
      <path d="M -58 -300 C -70 -250 -82 -180 -86 -96"/>
      <path d="M 58 -300 C 70 -250 82 -180 86 -96"/>
    </g>`;

  /* 白色围裙 */
  const apron = `
    <path d="M -34 -348 C -30 -368 30 -368 34 -348 L 52 -150 C 20 -132 -20 -132 -52 -150 Z"
          fill="#f7faff" stroke="#cdd7f0" stroke-width="1.2"/>
    <path d="M -52 -150 q 52 18 104 0" fill="none" stroke="#cdd7f0" stroke-width="1.4"/>
    <path d="M -40 -330 C -20 -344 20 -344 40 -330" fill="none" stroke="#cdd7f0" stroke-width="1.2"/>
    <!-- 围裙上的小鲸鱼 -->
    <g transform="translate(0 -222) scale(0.9)" fill="#3b4c8f" opacity="0.85">
      <path d="M -16 0 C -8 -12 10 -14 20 -4 C 24 0 24 6 20 10 C 8 18 -8 14 -14 6 C -16 4 -17 2 -16 0 Z"/>
      <path d="M -14 2 C -20 -3 -26 -5 -30 -6 C -24 -8 -18 -5 -13 0 Z"/>
      <path d="M -13 8 C -19 11 -24 15 -26 19 C -20 17 -15 12 -11 8 Z"/>
      <circle cx="12" cy="-2" r="1.7" fill="#f7faff"/>
    </g>`;

  /* 上身：藏青连衣裙 + 白胸襟 + 泡泡袖 */
  const bodice = `
    <!-- 躯干 -->
    <path d="M -30 -406 C -44 -392 -50 -360 -46 -330 L 46 -330 C 50 -360 44 -392 30 -406
             C 16 -416 -16 -416 -30 -406 Z"
          fill="url(#dsh-robe)" stroke="#1b2450" stroke-width="1.3"/>
    <!-- 束腰（深色高腰） -->
    <path d="M -44 -346 C -30 -338 30 -338 44 -346 L 46 -330 L -46 -330 Z" fill="#1b2450" opacity="0.9"/>
    <path d="M -30 -340 L -30 -332 M -14 -338 L -14 -331 M 2 -338 L 2 -331 M 18 -338 L 18 -331"
          stroke="#e8c98a" stroke-width="1.1" opacity="0.55"/>
    <!-- 白色胸襟 -->
    <path d="M -24 -408 C -34 -392 -38 -368 -36 -342 L 36 -342 C 38 -368 34 -392 24 -408 Z"
          fill="#f7faff" stroke="#cdd7f0" stroke-width="1.1"/>
    <g fill="#cdd7f0">
      <circle cx="0" cy="-392" r="2.2"/><circle cx="0" cy="-378" r="2.2"/><circle cx="0" cy="-364" r="2.2"/>
    </g>
    <!-- 领结 -->
    <path d="M -14 -424 C -6 -418 6 -418 14 -424 C 16 -416 16 -408 14 -402 C 6 -408 -6 -408 -14 -402 C -16 -408 -16 -416 -14 -424 Z"
          fill="#1b2450" stroke="#8fa8ff" stroke-width="0.9"/>
    <path d="M 0 -418 L 0 -350" stroke="#1b2450" stroke-width="2.4" opacity="0.9"/>
    <g fill="#e8c98a" opacity="0.8">
      <rect x="-30" y="-386" width="4" height="4" rx="1"/>
      <rect x="26" y="-386" width="4" height="4" rx="1"/>
      <rect x="-30" y="-366" width="4" height="4" rx="1"/>
      <rect x="26" y="-366" width="4" height="4" rx="1"/>
    </g>`;

  /* 腿与鞋 */
  const legs = `
    <g fill="#f7faff" stroke="#cdd7f0" stroke-width="1">
      <path d="M -22 -78 L -6 -78 L -8 -18 L -24 -18 Z"/>
      <path d="M 6 -78 L 22 -78 L 24 -18 L 8 -18 Z"/>
    </g>
    <g fill="#1f2a5c" stroke="#0f1738" stroke-width="1.2">
      <path d="M -27 -18 C -27 -30 -20 -34 -14 -32 C -8 -30 -6 -22 -6 -14 L -6 -8 L -27 -8 Z"/>
      <path d="M 27 -18 C 27 -30 20 -34 14 -32 C 8 -30 6 -22 6 -14 L 6 -8 L 27 -8 Z"/>
    </g>`;

  return `
  <g class="char" transform="translate(0 ${lift}) rotate(${tilt})">
    <!-- 光环 -->
    <ellipse cx="0" cy="-300" rx="180" ry="210" fill="url(#dsh-char-aura)" opacity="0.45"/>
    ${pose === 'float' ? `<g opacity="0.4">${[[-104, -150, 9], [-70, -86, 6], [-118, -66, 7], [104, -170, 7], [128, -104, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#8ff0e6" stroke-width="1.8"/>`).join('')}</g>` : ''}

    <!-- 长波浪发（后层，及膝；注意收窄以免整个人变成一团头发） -->
    <path d="M -64 -560 C -96 -496 -104 -404 -98 -318 C -94 -250 -84 -186 -66 -140
             C -54 -112 -42 -94 -32 -82 L 32 -82 C 42 -94 54 -112 66 -140
             C 84 -186 94 -250 98 -318 C 104 -404 96 -496 64 -560 Z"
          fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.3"/>
    <g fill="none" stroke="#dbe7ff" stroke-width="1.6" opacity="0.34">
      <path d="M -74 -520 C -90 -450 -92 -350 -80 -240"/>
      <path d="M -52 -540 C -66 -460 -70 -350 -60 -200"/>
      <path d="M 74 -520 C 90 -450 92 -350 80 -240"/>
      <path d="M 52 -540 C 66 -460 70 -350 60 -200"/>
    </g>
    <g fill="none" stroke="#22307f" stroke-width="1.2" opacity="0.28">
      <path d="M -96 -480 C -108 -400 -106 -300 -94 -210"/>
      <path d="M 96 -480 C 108 -400 106 -300 94 -210"/>
    </g>

    <!-- 鲸尾：从裙后向右后方甩出，尾鳍为分开的两叶 -->
    <g transform="translate(52 -214) rotate(-14)">
      <path d="M 0 0 C 40 -4 84 -14 122 -30 C 140 -38 154 -46 164 -54
               C 152 -32 136 -10 116 8 C 96 26 68 40 36 48 C 12 54 0 50 -2 34
               C -2 34 -2 34 0 34 L 0 0 Z"
            fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M 44 4 C 84 -10 126 -34 154 -68 C 148 -42 132 -12 108 8 C 84 28 58 38 34 42
               C 40 30 42 16 44 4 Z" fill="#dbe7ff" opacity="0.22"/>
      <path d="M 30 4 C 70 -8 112 -28 146 -58" fill="none" stroke="#dbe7ff" stroke-width="1.3" opacity="0.4"/>
      <path d="M 46 22 C 78 14 110 -4 138 -30" fill="none" stroke="#dbe7ff" stroke-width="1" opacity="0.26"/>
    </g>

    <!-- 裙与围裙 -->
    ${skirt}
    ${apron}
    ${bodice}
    ${legs}

    <!-- 手臂：藏青长袖（白袖口只在末端一点） -->
    <g fill="none" stroke="url(#dsh-cloak)" stroke-width="23" stroke-linecap="round">${armSvg}</g>
    <g fill="none" stroke="#1b2450" stroke-width="1.4" stroke-linecap="round" opacity="0.45">${armSvg}</g>
    <g fill="none" stroke="url(#dsh-robe)" stroke-width="19" stroke-linecap="round" opacity="0.55">${armSvg}</g>
    ${cuffSvg}
    ${hands}

    <!-- 颈与头 -->
    <path d="M -12 -412 L 12 -412 L 10 -438 L -10 -438 Z" fill="${SKIN_SHADE}"/>

    <g transform="translate(0 ${bob})">
      <!-- 头部轮廓（略大，动漫头身比） -->
      <path d="M 0 -598 C -34 -598 -54 -574 -54 -536 C -54 -500 -28 -478 0 -478 C 28 -478 54 -500 54 -536 C 54 -574 34 -598 0 -598 Z"
            fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="1.2"/>
      ${crown(crownKind)}
      ${veil ? crown('veil') : ''}
      ${ahoge()}
      ${headdress()}
      ${headFin(1, 44, -554)}
      ${headFin(-1, -44, -554)}

      <!-- 五官（按新头部尺寸微调：脸中心 -538） -->
      <g class="char-face">
        <ellipse cx="-19" cy="-518" rx="9.5" ry="4.2" fill="#f0958f" opacity="0.4"/>
        <ellipse cx="19" cy="-518" rx="9.5" ry="4.2" fill="#f0958f" opacity="0.4"/>
        <g class="char-eye">
          <ellipse cx="-17" cy="-539" rx="12.6" ry="15" fill="#fdfcff"/>
          <ellipse cx="17" cy="-539" rx="12.6" ry="15" fill="#fdfcff"/>
          <ellipse cx="-17" cy="-538" rx="10" ry="13" fill="url(#dsh-iris)"/>
          <ellipse cx="17" cy="-538" rx="10" ry="13" fill="url(#dsh-iris)"/>
          <ellipse cx="-17" cy="-534" rx="5.2" ry="7.2" fill="#0d1533" opacity="0.9"/>
          <ellipse cx="17" cy="-534" rx="5.2" ry="7.2" fill="#0d1533" opacity="0.9"/>
          <circle cx="-20.6" cy="-545" r="4.6" fill="#ffffff" opacity="0.98"/>
          <circle cx="13.4" cy="-545" r="4.6" fill="#ffffff" opacity="0.98"/>
          <circle cx="-13" cy="-531" r="2.1" fill="#ffffff" opacity="0.7"/>
          <circle cx="21" cy="-531" r="2.1" fill="#ffffff" opacity="0.7"/>
        </g>
        <!-- 睫毛 -->
        <g fill="none" stroke="${LINE}" stroke-width="3.1" stroke-linecap="round">
          <path d="M -29.5 -549 q 12.5 -8.4 25 -2"/>
          <path d="M 29.5 -549 q -12.5 -8.4 -25 -2"/>
          <path d="M -29.5 -549 l -5.2 -4.2"/>
          <path d="M 29.5 -549 l 5.2 -4.2"/>
        </g>
        <g fill="none" stroke="#7b86b8" stroke-width="2.1" stroke-linecap="round" opacity="0.75">
          <path d="M -26 -564 q 10.5 -5.2 20 -1"/>
          <path d="M 26 -564 q -10.5 -5.2 -20 -1"/>
        </g>
        <!-- 开口笑 -->
        <path d="M -8.5 -508 q 8.5 -10.5 17 0 q -8.5 10.5 -17 0 Z" fill="#c4576a"/>
        <path d="M -5.5 -507 q 5.5 -5.2 11 0 Z" fill="#ff9db0" opacity="0.9"/>
      </g>

      <!-- 前发：中分波浪 + 侧发 -->
      <path d="M -56 -536 C -60 -580 -30 -606 0 -606 C 30 -606 60 -580 56 -536
               C 47 -570 32 -586 15 -582 C 6 -565 -4 -559 -15 -563
               C -24 -576 -41 -572 -49 -551 C -52 -545 -54 -540 -56 -536 Z"
            fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.3"/>
      <path d="M -56 -542 C -64 -500 -60 -452 -45 -414 C -43 -462 -45 -502 -47 -538 Z"
            fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.1"/>
      <path d="M 56 -542 C 64 -500 60 -452 45 -414 C 43 -462 45 -502 47 -538 Z"
            fill="url(#dsh-hair)" stroke="#1b2450" stroke-width="1.1"/>
      <path d="M -36 -594 C -13 -606 13 -606 34 -594" fill="none" stroke="#e8f4ff" stroke-width="2.4" opacity="0.5"/>
      <path d="M -19 -576 C -6 -570 6 -570 19 -576" fill="none" stroke="#e8f4ff" stroke-width="1.6" opacity="0.35"/>
    </g>

    ${prop(propKind)}
  </g>`;
}

/* 角色渐变（放在角色自己的 defs 里，避免多张牌 id 冲突） */
function characterDefs(id, aura = '#4d6bfe') {
  return `
    <linearGradient id="hair-${id}" x1="0.18" y1="0" x2="0.84" y2="1">
      <stop offset="0%" stop-color="#7d9dff"/>
      <stop offset="34%" stop-color="#4d6bfe"/>
      <stop offset="68%" stop-color="#2b3d9e"/>
      <stop offset="100%" stop-color="#151f52"/>
    </linearGradient>
    <linearGradient id="robe-${id}" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="#2b3a76"/>
      <stop offset="45%" stop-color="#1f2c66"/>
      <stop offset="100%" stop-color="#141c46"/>
    </linearGradient>
    <linearGradient id="cloak-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111838"/>
      <stop offset="100%" stop-color="#232f6e"/>
    </linearGradient>
    <radialGradient id="iris-${id}" cx="50%" cy="32%" r="72%">
      <stop offset="0%" stop-color="#bfe4ff"/>
      <stop offset="42%" stop-color="#4f8bff"/>
      <stop offset="100%" stop-color="#16266b"/>
    </radialGradient>
    <radialGradient id="aura-${id}" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${aura}" stop-opacity="0.5"/>
      <stop offset="70%" stop-color="${aura}" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="${aura}" stop-opacity="0"/>
    </radialGradient>`;
}

/**
 * 把角色放进牌面：以牌底为地面，整体缩放以贴合卡片宽度
 * @param {string} id 唯一前缀
 * @param {object} c 角色配置
 * @param {{cx:number, baseY:number, scale:number}} place 放置参数
 */
export function renderCharacterSVG(id, c = {}, place = {}) {
  const { cx = 150, baseY = 520, scale = 0.72 } = place;
  return `
  <g class="char-wrap char-wrap-${id}">
    <defs>${characterDefs(id, c.aura)}</defs>
    <g transform="translate(${cx.toFixed(1)} ${baseY.toFixed(1)}) scale(${scale})">
      ${renderCharacter(c).replace(/url\(#dsh-(hair|robe|cloak|iris|char-aura)\)/g, (m, g) =>
        `url(#${g === 'char-aura' ? 'aura' : g}-${id})`)}
    </g>
  </g>`;
}
