/* ===========================================================
   deck.js · 78 张韦特系塔罗牌
   大阿卡纳 22 张 + 小阿卡纳 4 花色 × 14 张
   =========================================================== */

export const SUITS = [
  { key: 'wands', name: '权杖', en: 'Wands', element: '火', cn: '权杖' },
  { key: 'cups', name: '圣杯', en: 'Cups', element: '水', cn: '圣杯' },
  { key: 'swords', name: '宝剑', en: 'Swords', element: '风', cn: '宝剑' },
  { key: 'pentacles', name: '星币', en: 'Pentacles', element: '土', cn: '星币' },
];

export const MAJOR_NAMES = [
  '愚者', '魔术师', '女祭司', '女皇', '皇帝', '教皇', '恋人', '战车',
  '力量', '隐者', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔',
  '塔', '星星', '月亮', '太阳', '审判', '世界',
];

/** 对应的英文牌名（卡面使用，经典韦特命名） */
export const MAJOR_NAMES_EN = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
  'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
  'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun',
  'Judgement', 'The World',
];

const NUM_EN = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const COURT_EN = { 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' };

const MAJOR_ELEMENT = [
  '风', '风', '水', '土', '火', '土', '风', '水',
  '火', '土', '火', '风', '水', '水', '火', '土',
  '火', '风', '水', '火', '火', '土',
];

const NUM_CN = ['首牌', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const COURT = { 11: '侍从', 12: '骑士', 13: '王后', 14: '国王' };

function buildDeck() {
  const list = [];

  for (let n = 0; n < 22; n++) {
    list.push({
      id: `major-${String(n).padStart(2, '0')}`,
      name: MAJOR_NAMES[n],
      en: MAJOR_NAMES_EN[n],
      arcana: 'major',
      suit: 'major',
      number: n,
      element: MAJOR_ELEMENT[n],
      suitName: '大阿卡纳',
      suitNameEn: 'Major Arcana',
    });
  }

  for (const s of SUITS) {
    for (let n = 1; n <= 14; n++) {
      const tail = n <= 10 ? String(n).padStart(2, '0') : ['page', 'knight', 'queen', 'king'][n - 11];
      const name = `${s.name}${n <= 10 ? NUM_CN[n - 1] : COURT[n]}`;
      list.push({
        id: `${s.key}-${tail}`,
        name,
        en: `${n <= 10 ? NUM_EN[n - 1] : COURT_EN[n]} of ${s.en}`,
        arcana: 'minor',
        suit: s.key,
        suitName: s.name,
        suitNameEn: s.en,
        number: n,
        element: s.element,
      });
    }
  }

  return list;
}

export const DECK = buildDeck();
export const DECK_SIZE = DECK.length;

const BY_ID = new Map(DECK.map((c) => [c.id, c]));
export const getCard = (id) => BY_ID.get(id);

/** 牌面序号文字，如 大阿卡纳 XI / 权杖 三 / 圣杯王后 */
export function cardLabel(card) {
  if (card.arcana === 'major') {
    const R = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
    return `大阿卡纳 ${R[card.number]}`;
  }
  return card.number <= 10 ? `${card.suitName} ${NUM_CN[card.number - 1]}` : `${card.suitName}${COURT[card.number]}`;
}

/** 元素修行建议（用于综合解读） */
export const ELEMENT_HINT = {
  火: '火元素偏旺——行动力是这次的燃料，但记得给冲动留一个冷却的间隙。',
  水: '水元素偏旺——情绪与关系是主线，先照顾感受，再谈方案。',
  风: '风元素偏旺——思路很多，落地偏少，把想法收进一张具体的清单里。',
  土: '土元素偏旺——现实条件与节奏最重要，慢慢来反而更快。',
};
