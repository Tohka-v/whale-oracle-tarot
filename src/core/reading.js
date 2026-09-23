/* ===========================================================
   reading.js · 解读引擎
   规则：每张牌的解读 = 牌义（正/逆位） × 占卜方向 × 牌阵位置
   再加上一层整体性的综合判断（元素分布 / 逆位比例 / 大牌占比）
   =========================================================== */

import { getCategory, openingLine, CLOSING, DISCLAIMER, positionIntro } from '../data/rules.js';
import { getCard, cardLabel, ELEMENT_HINT } from '../data/deck.js';
import { MEANINGS } from '../data/meanings.js';

/* 位置语义词 → 用于综合判断 */
const POS_ROLE = {
  now: 'now', situation: 'now', core: 'now',
  block: 'block', root: 'block',
  action: 'action', self: 'action',
  past: 'past',
  future: 'future', outcome: 'future',
};

const REVERSED_HINT = {
  career: '逆位提示这件事现在有内耗或时机未到，先把地基补好再推进。',
  study: '逆位提示方法与状态需要调整，别用加倍的时间去补错误的方法。',
  love: '逆位提示关系里有没说出口的部分，先处理情绪再处理问题。',
  wealth: '逆位提示有隐藏成本或过度乐观，先算清楚再签字。',
  health: '逆位提示身心已经在报警，优先减负而不是硬撑。',
  social: '逆位提示沟通存在错位，重要的事请当面或电话确认一次。',
  decision: '逆位提示选项的信息还不完整，先补上关键事实再决定。',
  general: '逆位提示能量受阻，允许自己慢一点，先把状态调顺。',
};

/**
 * 抽取一副牌
 * @param {() => number} rng 0~1 随机源
 * @param {number} count 需要的张数
 * @param {boolean} allowReversed 是否允许逆位
 */
export function drawCards(rng, count, allowReversed = true) {
  const pool = [];
  for (let i = 0; i < 78; i++) pool.push(i);
  // Fisher–Yates 洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((idx) => ({
    deckIndex: idx,
    reversed: allowReversed ? rng() < 0.38 : false,
  }));
}

/* 牌义数据里有少量条目结尾没有标点，直接拼进句子读起来会「断」。
   这里统一补齐，而不去改动 245 KB 的 meanings.js 数据文件。 */
const SENTENCE_END = /[。！？….”』」）)]$/;
function closeSentence(t) {
  const s = String(t ?? '').trim();
  if (!s) return s;
  return SENTENCE_END.test(s) ? s : `${s}。`;
}

/* 找出给定牌义对象里的文本 */
function meaningOf(card, reversed) {
  const m = MEANINGS[card.id];
  if (!m) return null;
  return {
    keywords: m.keywords || [],
    element: m.element,
    branch: reversed ? m.reversed : m.upright,
  };
}

/**
 * 生成一张牌的完整解读
 */
export function readOne({ cardId, reversed }, position, categoryKey) {
  const card = getCard(cardId);
  const category = getCategory(categoryKey);
  const info = meaningOf(card, reversed);
  const branch = info?.branch;
  const base = branch?.[categoryKey] || branch?.general || '（这张牌的解读数据暂缺）';

  const extra = {};
  if (!reversed && branch && branch.general && categoryKey !== 'general') {
    extra.general = closeSentence(branch.general);
  }
  if (reversed) {
    extra.reversedHint = REVERSED_HINT[categoryKey] || REVERSED_HINT.general;
  }

  return {
    card,
    label: cardLabel(card),
    reversed,
    position,
    category,
    keywords: info?.keywords || [],
    text: closeSentence(base),
    extra,
    intro: positionIntro(categoryKey, position),
    orientation: reversed ? '逆位' : '正位',
  };
}

/**
 * 生成整副牌的解读
 */
export function buildReading({ picks, spread, categoryKey, userName = '', question = '' }) {
  const category = getCategory(categoryKey);
  if (!picks.length) return null;

  const reads = picks.map((p, i) =>
    readOne({ cardId: p.cardId, reversed: p.reversed }, spread.positions[i], categoryKey),
  );

  const uprightCount = reads.filter((r) => !r.reversed).length;
  const revCount = reads.length - uprightCount;

  const opening = openingLine({
    category,
    spread,
    userName,
    uprightCount,
    cardCount: reads.length,
  });

  const analysis = analyse(reads, categoryKey);

  return {
    category,
    spread,
    userName,
    question,
    reads,
    opening,
    analysis,
    closing: CLOSING[categoryKey] || CLOSING.general,
    disclaimer: DISCLAIMER,
    stats: {
      total: reads.length,
      upright: uprightCount,
      reversed: revCount,
      majors: reads.filter((r) => r.card.arcana === 'major').length,
    },
  };
}

/* ───────── 综合分析 ───────── */
function analyse(reads, categoryKey) {
  const cards = reads.map((r) => r.card);
  const upright = reads.filter((r) => !r.reversed);
  const revCount = reads.length - upright.length;
  const ratio = upright.length / reads.length;

  /* 元素分布 */
  const elems = {};
  for (const r of reads) {
    elems[r.card.element] = (elems[r.card.element] || 0) + 1;
  }
  const elemTop = Object.entries(elems).sort((a, b) => b[1] - a[1])[0];

  /* 花色聚集 */
  const suits = {};
  for (const r of reads) {
    if (r.card.arcana === 'minor') suits[r.card.suit] = (suits[r.card.suit] || 0) + 1;
  }
  const suitTop = Object.entries(suits).sort((a, b) => b[1] - a[1])[0];

  /* 角色分组 */
  const roleText = (role) => reads.filter((r) => POS_ROLE[r.position.key] === role);

  const blocks = [];
  const blockCards = roleText('block').map((r) => `${r.card.name}${r.reversed ? '（逆）' : ''}`);
  if (blockCards.length) {
    blocks.push(`阻力位落在 ${blockCards.join('、')}：这是这次牌局里最需要你正面处理的一环。`);
  }
  const actionCards = roleText('action');
  if (actionCards.length) {
    const a = actionCards[0];
    blocks.push(`行动位是 ${a.card.name}${a.reversed ? '（逆位）' : ''}，它建议的动作是：${closeSentence(a.text)}`);
  }
  const futureCards = roleText('future');
  if (futureCards.length > 1) {
    const names = futureCards.map((r) => `${r.card.name}${r.reversed ? '（逆）' : ''}`).join(' 与 ');
    blocks.push(`未来走向由 ${names} 共同决定，两者若方向一致，趋势会比单张更明确。`);
  }

  /* 数字重复 */
  const numCount = {};
  for (const r of reads) {
    if (r.card.arcana === 'minor' && r.card.number <= 10) {
      numCount[r.card.number] = (numCount[r.card.number] || 0) + 1;
    }
  }
  const repeatNum = Object.entries(numCount).find(([, n]) => n >= 2);

  /* 逆位比例判断 */
  let rhythm;
  if (ratio >= 0.72) {
    rhythm = '正位占多数：阻力主要来自外部节奏，你的判断本身没大问题，可以按计划推进。';
  } else if (ratio >= 0.42) {
    rhythm = '正逆各半：这件事一半靠推进、一半靠等待，交替用力比一味猛冲更有效。';
  } else {
    rhythm = '逆位偏多：现在更适合回收、修补与观察，把力气留给下一轮。';
  }

  /* 大牌占比 */
  const majorCount = cards.filter((c) => c.arcana === 'major').length;
  let majorNote = '';
  if (majorCount >= Math.ceil(reads.length / 2)) {
    majorNote = `本局有 ${majorCount} 张大阿卡纳（共 ${reads.length} 张），说明这不是小事：它牵动的是你的阶段课题，而不只是一次具体的得失。`;
  } else if (majorCount === 0) {
    majorNote = '本局没有大阿卡纳，全部是小牌：问题具体、日常、可控，用行动就能改变走向。';
  }

  const parts = [];
  parts.push(rhythm);
  if (elemTop && elemTop[1] >= 2) parts.push(ELEMENT_HINT[elemTop[0]] || '');
  if (suitTop && suitTop[1] >= 2 && suitTop[1] < reads.length) {
    const map = { wands: '权杖（行动与热情）', cups: '圣杯（情感与关系）', swords: '宝剑（思维与沟通）', pentacles: '星币（现实与身体）' };
    parts.push(`出现最多的是${map[suitTop[0]]}，这是本次牌局的主旋律。`);
  }
  if (repeatNum) parts.push(`数字 ${repeatNum[0]} 重复出现，提示这件事在同一个课题上打了两次转，值得回头看看模式。`);
  if (majorNote) parts.push(majorNote);

  /* 关键提醒 */
  const weak = reads.filter((r) => r.position.key === 'block' || r.reversed);
  const keyCards = (weak.length ? weak : reads).slice(0, 3).map((r) => ({
    name: r.card.name,
    reversed: r.reversed,
    keywords: r.keywords,
  }));

  return {
    paragraphs: parts.filter(Boolean),
    bullets: blocks,
    keyCards,
    upright: ratio >= 0.5,
  };
}
