/* ===========================================================
   rules.js · 占卜方向 & 牌阵 & 解读模板
   网站的全部占卜"规则"都在这里：方向决定解读的重点，
   牌阵决定每张牌说话的位置，位置本身也参与解读。
   =========================================================== */

/* ───────── 八个常用占卜方向 ───────── */
export const CATEGORIES = [
  {
    key: 'career',
    name: '事业',
    en: 'Career',
    icon: '⚒',
    desc: '工作选择、晋升、跳槽、创业与职场关系的走向。',
    focus: '工作与事业',
    lead: '把注意力放在「你能推动的那一件事」上，而不是整片职场的情绪。',
    ask: '这段事业里，我真正该投入的是什么？',
  },
  {
    key: 'study',
    name: '学业',
    en: 'Study',
    icon: '✧',
    desc: '考试、升学、论文、技能学习与备考状态。',
    focus: '学习与考试',
    lead: '看牌时要区分「能力不够」和「节奏不对」，多数卡点其实是后者。',
    ask: '我该怎样安排接下来的学习？',
  },
  {
    key: 'love',
    name: '情感',
    en: 'Love',
    icon: '♡',
    desc: '恋爱、暧昧、婚姻、复合与自我在关系中的位置。',
    focus: '情感与关系',
    lead: '牌只描述当下的能量，不替任何人做承诺；请把它当成一面镜子。',
    ask: '这段关系现在真正需要什么？',
  },
  {
    key: 'wealth',
    name: '财富',
    en: 'Wealth',
    icon: '⛁',
    desc: '收入、投资、合作分账、消费习惯与财务风险。',
    focus: '金钱与资源',
    lead: '涉及真金白银时，牌面给的是倾向与提醒，最终请以数据与合同为准。',
    ask: '我该如何对待眼下的这笔资源？',
  },
  {
    key: 'health',
    name: '身心',
    en: 'Wellbeing',
    icon: '☘',
    desc: '精力、睡眠、压力、情绪耗竭与生活节律。',
    focus: '身心状态',
    lead: '牌面只反映压力与节律，不构成任何医疗建议；身体不适请找医生。',
    ask: '我的身心现在最需要什么照顾？',
  },
  {
    key: 'social',
    name: '人际',
    en: 'Social',
    icon: '⧉',
    desc: '朋友、家人、同事、合租与沟通中的误会。',
    focus: '人际与沟通',
    lead: '关系是双向的，先看清自己这一侧的动作，再判断对方。',
    ask: '我在这段人际里该调整什么？',
  },
  {
    key: 'decision',
    name: '抉择',
    en: 'Decision',
    icon: '⚖',
    desc: '二选一、要不要开始／结束、何时按下确认键。',
    focus: '取舍与抉择',
    lead: '牌不会替你选，但它会告诉你：哪条路的代价你更付得起。',
    ask: '这两个选项，各自要我付出什么？',
  },
  {
    key: 'general',
    name: '综合',
    en: 'General',
    icon: '✵',
    desc: '说不清方向、只想看看最近的整体能量流动。',
    focus: '整体运势',
    lead: '当你不确定该问什么时，先看牌在提醒你注意哪一类事。',
    ask: '最近我整体处于什么状态？',
  },
];

export const getCategory = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[7];

/* ───────── 牌阵 ───────── */
/* col/row 用于桌面栅格定位；mobile 顺序即移动端堆叠顺序 */

export const SPREADS = [
  {
    key: 'single',
    name: '单牌指引',
    count: 1,
    en: 'One Card',
    desc: '一张牌，一个当下最需要听见的提醒。适合每天早晨或临时起念。',
    layout: 'single',
    positions: [
      { key: 'core', name: '核心指引', ask: '此刻最需要被看见的是什么？' },
    ],
    grid: { cols: 1, rows: 1 },
    cells: [{ col: 1, row: 1 }],
  },
  {
    key: 'time3',
    name: '时间之流',
    count: 3,
    en: 'Past · Present · Future',
    desc: '过去 → 现在 → 未来，看清一件事的时间线和自己所处的位置。',
    layout: 'row3',
    positions: [
      { key: 'past', name: '过去', ask: '已经发生、仍在影响你的是什么？' },
      { key: 'now', name: '现在', ask: '此刻真实的处境是什么？' },
      { key: 'future', name: '未来', ask: '若照现在的方向走，会抵达哪里？' },
    ],
    grid: { cols: 3, rows: 1 },
    cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }],
  },
  {
    key: 'path3',
    name: '处境·阻碍·行动',
    count: 3,
    en: 'Situation · Block · Action',
    desc: '最实用的一组：现状是什么、卡在哪里、下一步做什么。',
    layout: 'row3',
    positions: [
      { key: 'situation', name: '处境', ask: '事情目前真实的模样？' },
      { key: 'block', name: '阻碍', ask: '真正绊住你的是什么？' },
      { key: 'action', name: '行动', ask: '接下来最值得做的一件事？' },
    ],
    grid: { cols: 3, rows: 1 },
    cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }],
  },
  {
    key: 'cross5',
    name: '五牌十字',
    count: 5,
    en: 'Five Card Cross',
    desc: '从现实、阻力、深层原因一路看到行动与结果，适合较重的议题。',
    layout: 'cross',
    positions: [
      { key: 'now', name: '现状', ask: '现在的局面是什么？' },
      { key: 'block', name: '阻力', ask: '什么在消耗你？' },
      { key: 'root', name: '深层原因', ask: '这一切从哪里来？' },
      { key: 'action', name: '建议行动', ask: '你可以主动做的是什么？' },
      { key: 'outcome', name: '可能结果', ask: '顺着走下去会看到什么？' },
    ],
    grid: { cols: 3, rows: 3 },
    cells: [
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 2, row: 3 },
    ],
    // 窄屏改用 2 列，避免桌面坐标在手机上留下空档或错位
    mobile: {
      cols: 2,
      cells: [
        { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 1, row: 2 }, { col: 2, row: 2 },
        { col: 1, row: 3 },
      ],
    },
  },
  {
    key: 'celtic7',
    name: '七牌纵深',
    count: 7,
    en: 'Deep Seven',
    desc: '最完整的一局：内心与外界、过去与未来、你与他人，一次看透。',
    layout: 'celtic',
    positions: [
      { key: 'now', name: '现况', ask: '问题的核心在哪？' },
      { key: 'block', name: '阻碍', ask: '横在中间的是什么？' },
      { key: 'root', name: '潜在基础', ask: '不易察觉的根源？' },
      { key: 'past', name: '近期过去', ask: '刚刚过去的影响？' },
      { key: 'future', name: '近期未来', ask: '即将浮现的变化？' },
      { key: 'self', name: '你的态度', ask: '你如何看待这件事？' },
      { key: 'outcome', name: '最终走向', ask: '整合之后会走到哪？' },
    ],
    grid: { cols: 4, rows: 3 },
    cells: [
      { col: 2, row: 2 }, { col: 1, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 },
      { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 4, row: 1 },
    ],
    mobile: {
      cols: 2,
      cells: [
        { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 1, row: 1 }, { col: 2, row: 1 },
        { col: 1, row: 3 }, { col: 2, row: 3 }, { col: 1, row: 4 },
      ],
    },
  },
];

export const getSpread = (key) => SPREADS.find((s) => s.key === key) || SPREADS[0];

/* ───────── 解读模板 ───────── */

/** 单张牌的定位句：把「位置」和「方向」缝在一起 */
export function positionIntro(categoryKey, position) {
  const c = getCategory(categoryKey);
  return `在「${position.name}」这个位置上谈${c.focus}，牌问的是：${position.ask}`;
}

/** 根据抽牌结果生成总览开头 */
export function openingLine(ctx) {
  const { category, spread, userName, uprightCount, cardCount } = ctx;
  const who = userName ? `${userName}，` : '';
  const ratio = uprightCount / cardCount;
  let tone;
  if (ratio >= 0.72) tone = '牌面整体是顺的，能量流动得比较痛快，你可以更大胆一点。';
  else if (ratio >= 0.42) tone = '牌面正逆交错，说明这件事有机会也有牵扯，节奏比方向更重要。';
  else tone = '这次逆位偏多，说明外部条件或你自己的状态需要先处理，硬推会很吃力。';
  return `${who}你用「${spread.name}」问了${category.focus}。${tone}`;
}

/** 收束语：按方向给一句可执行的落点 */
export const CLOSING = {
  career: '职场上最贵的从来不是努力，而是选对那件值得努力的事。',
  study: '学业上的复利来自稳定的节律，而不是某一次通宵。',
  love: '关系里最稳的安全感，来自你敢于把话说清楚。',
  wealth: '钱的问题上，先看现金流，再看想象力。',
  health: '身心的账永远会结，早睡一小时比任何补品都实在。',
  social: '人际里少一点猜测，多一次直接而温和的确认。',
  decision: '任何选择都有代价，选你愿意承担的那一种。',
  general: '运势不是判决书，它只是提醒你：风向在这里，帆由你掌。',
};

/** 免责声明（每份解读都会带上）。
    第二句是关于 AI 的说明：站内插画与图标确实是 AI 生成，
    《人工智能生成合成内容标识办法》（2025-09-01 施行）要求发布者作出显著标识，
    这里就是那处「显著标识」——放在每份解读的结尾，跟免责声明一起出现。 */
export const DISCLAIMER = '塔罗是一面照见自己的镜子，不是命运的通知书。请把它当作整理思路的工具，重大决定仍请依据事实、专业意见与你的判断。'
  + '本站塔罗插画（78 张）与品牌图标均由 AI 生成（火山方舟 Seedream），解读文案由 AI 辅助撰写后人工校订。';
