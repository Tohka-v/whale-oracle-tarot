/* 数据与规则自检：node tools/verify.mjs */
import { DECK, getCard } from '../src/data/deck.js';
import { MEANINGS, CATEGORY_KEYS } from '../src/data/meanings.js';
import { CATEGORIES, SPREADS } from '../src/data/rules.js';

const problems = [];
const noPunct = [];
let checked = 0;

if (DECK.length !== 78) problems.push(`牌库数量异常：${DECK.length}`);
if (new Set(DECK.map((c) => c.id)).size !== DECK.length) problems.push('牌 id 有重复');

const ids = new Set(DECK.map((c) => c.id));
for (const id of Object.keys(MEANINGS)) {
  if (!ids.has(id)) problems.push(`牌义里存在未知牌 id：${id}`);
}
for (const c of DECK) {
  const m = MEANINGS[c.id];
  if (!m) { problems.push(`缺少牌义：${c.id} ${c.name}`); continue; }
  checked++;
  if (m.name !== c.name) problems.push(`牌名不一致：${c.id} deck=${c.name} meanings=${m.name}`);
  for (const side of ['upright', 'reversed']) {
    const b = m[side];
    if (!b) { problems.push(`${c.id} 缺少 ${side}`); continue; }
    for (const k of CATEGORY_KEYS) {
      const t = b[k];
      if (!t || typeof t !== 'string' || t.trim().length < 12) {
        problems.push(`${c.id} ${side}.${k} 文本过短或缺失`);
      } else if (t.length > 160) {
        problems.push(`${c.id} ${side}.${k} 文本过长（${t.length}）`);
      } else if (!/[。！？….”』」）)]$/.test(t.trim())) {
        noPunct.push(`${c.id} ${side}.${k}`);
      }
    }
  }
}

/* 牌阵校验 */
for (const s of SPREADS) {
  if (s.positions.length !== s.count) problems.push(`牌阵 ${s.key} positions 与 count 不符`);
  if (s.cells.length !== s.count) problems.push(`牌阵 ${s.key} cells 与 count 不符`);
  const maxCol = Math.max(...s.cells.map((c) => c.col));
  if (maxCol > s.grid.cols) problems.push(`牌阵 ${s.key} 网格列数不足`);
}

/* 方向校验 */
if (CATEGORIES.length !== 8) problems.push(`方向数量应为 8，实际 ${CATEGORIES.length}`);

console.log(`牌库：${DECK.length} 张`);
console.log(`牌义：${Object.keys(MEANINGS).length} 条，完整校验通过 ${checked} 张`);
console.log(`方向：${CATEGORIES.length} 个 | 牌阵：${SPREADS.length} 个`);
console.log(`每张牌解读段落：${checked * 2 * CATEGORY_KEYS.length} 段`);
console.log(`结尾缺标点：${noPunct.length} 段${noPunct.length ? '（运行时由 reading.js 的 closeSentence 补齐，此处仅作提示）' : ''}`);
if (noPunct.length) {
  console.log(`  例：${noPunct.slice(0, 6).join('、')}`);
}
if (problems.length) {
  console.log(`\n发现 ${problems.length} 个问题（前 40 条）：`);
  console.log(problems.slice(0, 40).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\n全部校验通过 ✓');
}
