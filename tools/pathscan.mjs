/* 扫描全部牌面，找出非法的 <path d="..."> */
import { DECK } from '../src/data/deck.js';
import { renderCardFront } from '../src/art/card-art.js';

const bad = [];
for (const card of DECK) {
  const svg = renderCardFront(card);
  const ds = [...svg.matchAll(/\sd="([^"]*)"/g)].map((m) => m[1]);
  ds.forEach((d, i) => {
    const t = d.trim();
    if (!/^[Mm]/.test(t)) {
      bad.push(`${card.id} ${card.name} :: path#${i} :: ${t.slice(0, 60)}`);
    } else if (/[,\s]-?\d+(\.\d+)?,[,\s]/.test(t) && !/[A-Za-z]/.test(t.slice(1))) {
      bad.push(`${card.id} ${card.name} :: path#${i} 缺指令 :: ${t.slice(0, 60)}`);
    }
  });
}
if (bad.length) {
  console.log(`发现 ${bad.length} 处非法路径：`);
  console.log(bad.slice(0, 20).join('\n'));
  process.exitCode = 1;
} else {
  console.log('78 张牌面路径全部合法 ✓');
}
