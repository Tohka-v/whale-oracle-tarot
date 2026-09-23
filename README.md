# 星海鲸语 · Whale Oracle Tarot

一个纯前端的塔罗牌占卜小站。选占卜方向 → 选牌阵 → 洗牌抽牌 → 逐张翻牌 → 得到结合「牌义 × 正逆位 × 方向 × 位置」的解读。
牌背是 DeepSeek 风格的「鲸鱼娘」徽记，整体保持塔罗的对称纹样与金线装饰。

零依赖、零构建、可离线运行。

---

## 快速开始

```bash
# 方式一：用自带的零依赖静态服务器（推荐，ES module 需要 http 协议）
node tools/serve.mjs 4173
# 服务器会打印：本机地址、手机地址、生成台地址、以及一个终端二维码

# 方式二：Windows 双击「启动服务器.bat」

# 方式三：任意静态服务器
python -m http.server 4173
npx serve .
```

浏览器打开 `http://127.0.0.1:4173/`。

> 直接双击 `index.html`（`file://`）会因为浏览器对 ES module 的跨域限制而无法加载，请用 http 方式打开。

### 在手机上打开

服务器默认监听所有网卡，启动时会打印局域网地址并生成二维码：

```
手机：   http://192.168.5.154:4173/   (WLAN)
```

手机与电脑连**同一个 Wi-Fi**，扫码或直接输入该地址即可。要点：

- 只允许本机访问：`node tools/serve.mjs 4173 --local`
- 不打印二维码：`node tools/serve.mjs 4173 --no-qr`
- **打不开九成是 Windows 防火墙。** 以管理员身份运行一次：
  ```powershell
  netsh advfirewall firewall add rule name="WhaleOracleTarot 4173" dir=in action=allow protocol=TCP localport=4173 profile=private
  netsh advfirewall firewall add rule name="WhaleOracleTarot 4173 (Public)" dir=in action=allow protocol=TCP localport=4173 profile=public
  ```
  第二条是给「公用网络」用的——很多 Wi-Fi 会被 Windows 判定为公用，只加第一条仍然连不上。
  查看当前网络类别：`Get-NetConnectionProfile`
- 手机访问的是你电脑上的服务，**电脑关机或关掉服务器窗口就打不开了**。想长期在手机用需要部署到公网。
- 端口被占用时 `serve.mjs` 会**自动往后找一个空闲端口**并在窗口里打印实际地址，别照抄旧端口。
- 列表里若出现 `(… · 虚拟网卡，手机连不上)` 的地址（Radmin / ZeroTier 之类），
  那是虚拟网卡，手机连不上；二维码只会指向真正的局域网地址。

### 部署到公网（可选）

站点是纯静态文件（`index.html`、`styles/`、`src/`、`fonts/`、`assets/`），上传到任意静态托管即可：
GitHub Pages、Cloudflare Pages、Vercel、Netlify、对象存储 + CDN 都行。
`tools/` 不需要上传；生成台依赖本地服务端，公网部署后用不了。

---

## 功能与规则

### 八个占卜方向

| 方向 | 覆盖内容 |
| --- | --- |
| 事业 | 工作选择、晋升、跳槽、创业、职场关系 |
| 学业 | 考试、升学、论文、技能学习与备考状态 |
| 情感 | 恋爱、暧昧、婚姻、复合与自我位置 |
| 财富 | 收入、投资、合作分账、消费习惯与风险 |
| 身心 | 精力、睡眠、压力、情绪耗竭与生活节律 |
| 人际 | 朋友、家人、同事、合租与沟通误会 |
| 抉择 | 二选一、要不要开始／结束、何时确认 |
| 综合 | 说不清方向时的整体能量流动 |

### 五个牌阵

| 牌阵 | 张数 | 位置含义 |
| --- | --- | --- |
| 单牌指引 | 1 | 核心指引 |
| 时间之流 | 3 | 过去 → 现在 → 未来 |
| 处境·阻碍·行动 | 3 | 处境 / 阻碍 / 行动 |
| 五牌十字 | 5 | 现状 / 阻力 / 深层原因 / 建议行动 / 可能结果 |
| 七牌纵深 | 7 | 现况 / 阻碍 / 潜在基础 / 近期过去 / 近期未来 / 你的态度 / 最终走向 |

### 解读规则（`src/core/reading.js`）

一份解读由四层信息合成：

1. **牌义** —— 78 张牌各有正位与逆位两套文本；
2. **方向** —— 同一张牌在事业与情感里的说法不同，共 8 个方向；
3. **位置** —— 「过去」和「建议行动」是两个完全不同的发言角度；
4. **整体判断** —— 由本次牌局统计得出：
   - 正逆位比例决定「节奏」结论（可推进 / 半推半等 / 先回收）；
   - 元素分布（火水风土）给出能量倾向；
   - 重复出现的花色与数字提示主旋律与「打转的课题」；
   - 大阿卡纳占比判断这是阶段课题还是一次日常小事。

解读数据规模：`78 张 × 2 个朝向 × 8 个方向 = 1248` 条独立文案，每条 40–90 字，不做正逆位简单反写。

### 流程与交互

1. **定心**：选方向；
   - 手机上**再点一次同一个方向**就直接进入下一步，不必滚到页底去找主按钮
     （第一次点击只做选中，不会误触前进）；
   - 这一步底部原本还有「称呼 / 问题」两个输入框，**2026-09-24 已移除**（见维护记录第八轮）；
2. **立阵**：选牌阵（同样支持「再点一次直接开始洗牌」）；
   - 手机上页脚的主按钮**常驻在屏幕底部**，任何时候都在拇指下；
3. **取牌**：牌库原地抖动洗牌（动效 + 音效），牌背等距平铺成网格；
   - 平铺张数同时受视口宽度与**高度**约束：顶部的牌库、标题、底部牌位条高度都是实测出来的，
     不是拍一个常数。宽且不矮的视口下抽牌台换用 0.8 倍大小的牌，让候选牌一屏看全——
     「凭直觉点选」最忌讳看不全；
   - **张数永远是列数的整数倍**（列数由 JS 写进 `--fan-cols`，不交给 CSS `auto-fit` 自己算）。
     否则最后一行会缺角、右侧空一块，看着像牌没铺好；
   - 刻意不用重叠扇形：重叠布局里指针停在两牌交界处会在「抬起 → 盖住 → 换人」之间循环，
     表现为抽搐；平铺后每张牌热区独立，不会争抢；
   - 点选后**原地翻开**（不飞、不挪位），牌上方浮出牌位信息与牌义；默认停留 2.2–3.6 秒
     （牌越多越短），想更快可以点浮层上的「继续 →」立刻结束等待；
   - 每张牌都是 `role="button"` + `tabindex="0"`，可用 `Tab` + `Enter`/`空格` 完成整局抽牌；
   - 已经抽了牌时，「重洗」第一次点击只进入待确认状态（按钮变成「再点一次确认」，
     3 秒无操作自动解除），避免误触一下就把整局进度清掉；
   - 抽满后可「全部翻开」，也支持空格键；
4. **观象**：解读页按牌阵坐标摆放卡牌（窄屏改为**按张数自适应列数的流式网格**），
   逐张翻开并落星屑；点任意一张牌打开详情，含牌面启示、逆位提示／另一层意思与关键词，
   浮层里可以**「← 上一张 / 下一张 →」连续翻阅**（键盘 `←` `→` 同样可用），
   手机上读三张牌不必反复开关浮层。

**手机端布局的两条硬规则**（`styles/app.css` 末尾的 `@media (max-width: 820px)`）：

- **列宽一律用 `1fr` 铺满，不用写死的 px 列宽**。旧版把解读网格的列宽写死成
  116 / 104 / 94px，结果 390px 手机上 3 张牌被排成 2+1 两行、左右各空 100px。
  现在列数由 JS 按张数写进 `--reading-cols`（3 张一行、5 张 3 列、7 张 4 列），
  实测宽度利用率 100%。
- **牌面高度用 `aspect-ratio: 300 / 520`，不要再用 `--card-w` / `--card-h`**。
  那是一组 px 令牌，只改宽度高度不会跟着变，会得到畸形比例。

其他细节：

- **刷新不丢牌局**：种子与「抽了第几张」存在 `sessionStorage` 里，`state.shuffled` 完全由
  `mulberry32(seed)` 重放得到，所以刷新后自动回到刚才那一步，牌面一模一样。
- **分享链接**：解读页有「复制分享链接」，把同一局编码进 URL hash（`#r=…`，约 90 字符），
  对方打开就是同一副牌。分享数据只做一次性还原，用完就把 hash 清掉，
  否则之后每次刷新都会退回分享时那一刻。
- **点左上角品牌标记 = 回到最开始**：不刷新地回首页，并清空当前局面、撤销方向与牌阵的选中。
  它本身是 `<a href="./">`，默认会整页重载，但重载后 `session.js` 又会把牌局恢复回来，
  用户会觉得「点了没反应」。
- **键盘与读屏**：浮层打开时焦点移入并在内部循环 `Tab`，关闭后归还触发元素；
  牌背的 `aria-label` 做了去重，读屏不会把同一句「塔罗牌背」念 16 遍。
- 音效默认关闭（纯 Web Audio 合成，无音频文件）；顶栏的**牌面图鉴**可浏览全部 78 张牌面，
  支持按大阿卡纳 / 花色筛选、整体翻到牌背、切换逆位显示、单张放大并左右翻页；
  `prefers-reduced-motion` 下自动降级动画；`Escape` 关闭浮层；
  布局在 375–1920px 之间可用，十个断点实测均无横向溢出。

---

## 目录结构

```
index.html                 页面骨架（四个步骤 + 四个浮层：解读 / 规则 / 图鉴 / 放大）
sw.js                      Service Worker（PWA 离线；必须在根目录才能拿到 / 作用域）
manifest.webmanifest       PWA 清单
fonts/                     内嵌字体（思源宋体·黑体已子集化 + Cinzel / Cormorant Garamond，全 OFL-1.1）
styles/
  fonts.css                @font-face 声明
  base.css                 设计令牌、星空背景、通用组件
  card.css                 卡牌 3D 翻转、扇形牌堆、卡槽
  app.css                  抽牌台、解读区、卡面图鉴、响应式
src/
  main.js                  流程状态机与全部交互
  core/
    reading.js             解读引擎（牌义 × 方向 × 位置 + 整体分析）
    anim.js                洗牌与翻牌（Web Animations API；飞牌动画已整体删除）
    fx.js                  星屑、涟漪、星雨、提示条
    sky.js                 背景星空 canvas（星点闪烁 + 流星）
    sound.js               Web Audio 合成音效
    ui.js                  DOM 构建工具
    gallery.js             卡面图鉴（分组浏览 / 翻牌背 / 逆位 / 放大翻页 / 缩略图懒加载）
    session.js             局面持久化（sessionStorage）与分享链接（URL hash）
    pwa.js                 Service Worker 注册（非安全上下文时静默降级）
  art/
    svgkit.js              SVG 绘图基础件（星、月、权杖、圣杯、宝剑、星币、牌框…）
    char-art.js            程序化「鲸鱼娘」角色（脸 / 发 / 头鳍 / 呆毛 / 服饰 / 冠饰 / 法器）
    card-art.js            78 张牌面的程序化绘制 + 22 张的角色配置
    whale-back.js          牌背（鲸尾）/ 徽记 / 品牌标记 / 共享 symbol
  data/
    deck.js                78 张牌定义（中文名 + 英文牌名）
    rules.js               8 个方向、5 个牌阵、解读模板与免责声明
    meanings.js            1248 条牌义文案
    art-manifest.js        卡面插画清单（由 make-manifest.mjs 生成）
assets/tarot/               AI 生成的卡面插画（<牌id>.jpg，900×1565）
assets/tarot/thumbs/        图鉴用缩略图（<牌id>.webp，216×376），由 optimize-art.py 生成
assets/back/                牌背中央纹章（medallion.jpg，512×512）
assets/icons/               favicon-16/32.png + PWA 图标（192 / 512 / maskable-512）
                            全部由 tools/make-icons.mjs、tools/make-favicon.mjs 从
                            tools/icon-art.mjs 的候选生成（当前 DEFAULT_KEY = n3）
assets/brand/mark-v4.webp   顶栏品牌标记（256×256，当前用这份）
assets/brand/mark-v4-1024.webp  同一张的高清版，图标候选的图源（256 放大会发虚）
assets/brand/mark.webp      上一代顶栏标记（256）；mark-1024.webp 是其高清版，留档
assets/brand/mark-deep-1024.webp / mark-deeper-1024.webp / mark-ref-1024.webp / mark-ref78-1024.webp
                            中间试过的调色版本（tools/brand-recolor.py 生成），留档备查
tools/
  serve.mjs                零依赖静态服务器（含 ETag 协商缓存）
  manifest-lib.mjs          卡面清单生成逻辑（serve.mjs 与 make-manifest.mjs 共用同一份）
  optimize-art.py           卡面降采样 + 生成缩略图 + 牌背图压缩（需 Pillow）
  make-font-subset.py       中文字体子集化（需 fontTools + brotli）
  icon-art.mjs              图标图形的唯一来源（favicon 与 PWA 图标共用，改这里两边一起变）
  make-favicon.mjs          标签页图标：出 16/32/64px 实尺对照表 + 写 index.html
  make-icons.mjs            用无头浏览器渲染 PWA 图标（mask / 渐变只有浏览器能原样画）
  brand-fit.py              品牌图标裁切：按金环包围盒裁剪 + 圆形/方形蒙版 + 真实尺寸对照表
  brand-recolor.py          品牌插画调色：把过浅的头发压深，或从参考图吸色号做配色迁移
  verify.mjs               数据自检（牌库 / 牌义 / 牌阵一致性）
  pathscan.mjs             扫描全部牌面的 SVG 路径是否合法
  drive.mjs                CDP 端到端走查 + 逐步截图（含图鉴）
  verify-e2e.mjs           端到端验收回归（28 项断言）
  verify-breakpoints.mjs   断点回归（10 个视口）
  verify-mobile.mjs        手机审计（4 个设备 × 5 个界面：字号 / 触控目标 / 裁切 / 排布利用率）
  gen-art.mjs              调用第三方文生图接口批量出图
  make-manifest.mjs        扫描 assets/tarot/ 生成插画清单
  preview.html             78 张牌面总览（视觉校对用）
  char-check.html          角色大图 / 头部特写 / 实际卡牌尺寸对照
  back-check.html          牌背与徽记放大对照
  art-check.html           插画版 vs 程序化版对照
```

---

## 牌面绘制方式

牌面不是位图，而是按统一构图程序化生成的 SVG（`viewBox 300×520`）：

- 夜空渐变底色 → 牌面星空 → **鲸鱼娘角色** → 中心象征场景 → 内圈星尘装饰带 → 三层金线牌框 + 四角花饰 → 底部名牌；
- 顶部**序号带**（金色胶囊）标牌号。取值遵循韦特原版（Rider-Waite-Smith）的惯例，同一副牌只用一种符号系统：
  - 大阿卡纳 = **罗马数字** `0` ~ `XXI`
  - 小阿卡纳 Ace~Ten = **罗马数字** `I` ~ `X`（韦特原版就是罗马数字，不是阿拉伯数字）
  - 宫廷牌 = **`PAGE` / `KNIGHT` / `QUEEN` / `KING`**（默认风格 `latin`）
  - 可切换：`renderCardFront(card, { badge })`，可选值见 `src/art/card-art.js` 的 `BADGE_STYLES`
    （`rws` 宫廷牌不标号 / `rwsLetter` 用 `P`·`N`·`Q`·`K` / `classic` 旧版阿拉伯数字＋中文首字）
- **22 张大阿卡纳各有一个鲸鱼娘角色**（`src/art/char-art.js`），统一基础形象、按牌义调整姿态与持物：
  - 蓝色渐变长波浪发（及膝）＋ 呆毛；鲸类耳鳍（浅色鳍尖 + 蓝色丝带）
  - 白色荷叶边女仆头饰；藏青连衣裙 ＋ 白色胸襟与围裙（围裙上有小鲸鱼纹）＋ 泡泡长袖 ＋ 深蓝领结 ＋ 藏青玛丽珍鞋
  - 身后大鲸尾；6.5 头身的动漫比例
  - 按牌义更换：姿态（站立 / 微浮 / 侧身）、冠饰（弦月／宝冠／桂冠／角饰／面纱）、法器（权杖／圣杯／宝剑／星币／天平／提灯／书／号角／钥匙……）
  - 角色站在牌面下缘，裙摆被下方铭牌压住，形成前后层次；逆位时整张牌翻转，角色随之倒置
- 大阿卡纳另有各自的象征场景做背景（愚者的悬崖与朝阳、女祭司的双柱与月、命运之轮的八角轮、塔的闪电……）；
- 小阿卡纳用扑克式点数布局，权杖／圣杯／宝剑／星币各有专属符号，宫廷牌用人物剪影加该花色象征物；
- **牌背以黑金纹章为主题**（`src/art/whale-back.js`）：中性近黑底 + 极淡菱格质感 + 三线金框与四角角饰；
  中央一枚**曼陀罗纹章**（`assets/back/medallion.jpg`，Seedream 生成的黑底金线图，中心即鲸尾）；
  纹章上下各一枚月牙与八角星，左右两侧是疏排的细拱廊与小菱。
  边框、角饰、拱廊、金环**全部是矢量 SVG**，只有中央纹章是位图——
  生成图负责手写 SVG 做不到的细密卷草，外围保持锐利、可无限缩放。

  > 牌背刻意做「疏」不做「满」：密织纹样在扇形叠牌时会糊成一片，反而显吵。
  > 也**不放任何文字**——高端牌背的惯例，且去掉上下铭文后牌背更接近 180° 可逆。
  > 换中央纹章只需替换 `assets/back/medallion.jpg`，然后跑一次
  > `python tools/optimize-art.py` 把它压到 512×512——生成器给的是 2048×2048 方图，
  > 原样放上去会有 1.3 MB 压在首屏预算上。

改配色只需动 `src/art/card-art.js` 里的 `MAJOR_PALETTE`、`SUIT_STYLE` 与 `CHAR`；改角色只需动 `src/art/char-art.js`。

### 性能要点（实测数据）

本地 `tools/serve.mjs` + 无头 Edge 实测（1440×900、冷缓存）：

| 场景 | 优化前 | 现在 |
|---|---|---|
| 首次访问首屏 | 4.30 MB | **1.16 MB** |
| 二次访问首屏 | 4.30 MB（`no-store`，缓存完全失效） | **0 KB**（304 协商缓存） |
| 打开「牌面图鉴」 | 47 MB / 9.3 s | **0.6 MB** |
| 卡面素材占用 | 45.6 MB | **20.4 MB**（另加 1.3 MB 缩略图） |
| CJK 字体 | 3.98 MB | **847 KB** |

- **图鉴缩略图 + 懒加载**：网格里用的是 216×376 的 WebP（每张约 15 KB），并且只在
  滚进视口前 400px 时才把 `href` 挂上去（`IntersectionObserver`）。骨架态渲染的是一个
  **没有 `href` 的 `<image>`**——写成 `href=""` 会被解析成当前文档地址，反而多一次页面请求。
  放大视图仍走全尺寸原图。
- **缓存协商**：`serve.mjs` 对所有静态文件发 `Cache-Control: no-cache` + `ETag`。
  这是个零构建站点，文件名没有内容哈希，给不了长 `max-age`；`no-cache` 每次发条件请求、
  没变就回 304，既省掉重复传输，又保证改完文件刷新立刻可见。
- **字体子集化**：站内实际只用到 1813 个字符（含 1650 个汉字），三个 CJK 字体因此从
  3.98 MB 降到 847 KB。**新增中文文案后必须重跑 `make-font-subset.py`**，否则新字会回落到
  系统字体；`make-font-subset.py --check` 能检测出这种缺字。
- **牌背纹章降到 512×512**：它在**首屏**就会被 `<symbol>` 里的 `<image>` 触发下载，
  而卡片上显示直径只有约 112 px（DPR2 也只需 224）。
- 牌背用 `<symbol>` 定义一次、所有卡牌 `<use>` 复用（`mountCardDefs()` 在启动时挂载），
  避免每张牌重复解析整份含滤镜 / 图案 / 样式的 SVG；
- 洗牌只做牌库自身的抖动与浮动（`.deck-pump`），**不再克隆飞牌**。早先那套「翻飞交错」
  的飞牌有三个问题：它是 `fixed + z-index:200`，会盖住标题与说明文字；坐标取自
  `rectOf(deckEl)`，而刚切屏时 `.screen` 还在入场动画里，量出的位置偏上，牌会飘到
  屏幕左上角；观感上也不像洗牌。整段删除，`makeFlyer` / `flyTo` / `removeFlyer` 一并清掉。
  牌库的 0.74 缩放做在 `width/height` 上而**不是** `transform: scale()`——后者会被
  `.deck-pump` 这条 transform 动画整个替换掉，牌库会在洗牌瞬间跳大一圈；
- 卡片的入场动画 `deal-in` 用 `fill: backwards` 而**不是** `both`。用 `both` 时它的
  `to { transform: none }` 会以动画优先级**永久**压掉所有 `transform` 声明，悬停抬起
  （`.card.is-hoverable:hover`）和抽中抬起（`.is-picked.is-revealing`）会全部失效——
  实测普通声明无效，只有加 `!important` 才生效。
- 卡面容器与画面严格同比：`--card-h: calc(var(--card-w) * 520 / 300)`。
  注意自定义属性的 `var()` 替换在**定义它的元素**上就完成了，继承给后代的已是算好的值；
  所以像 `.screen--table` 这样在后代上覆盖 `--card-w` 时，必须把 `--card-h` 一起重定义。

---

## 字体

正文与标题使用**思源宋体 / 思源黑体**（Noto Serif SC / Noto Sans SC，OFL-1.1），已随站点内嵌在 `fonts/`，离线可用，不需要联网拉字体；`styles/fonts.css` 负责 `@font-face` 声明。

三个 CJK 字体都已**子集化**（`*.subset.woff2`，3.98 MB → 847 KB）：

```bash
python -m pip install fonttools brotli   # 一次性
python tools/make-font-subset.py         # 重新子集化
python tools/make-font-subset.py --check # 检查现有子集是否漏字（新增文案后跑）
```

原始全量字体仍保留在 `fonts/` 供重新子集化用。子集范围 = `index.html` + `src/**/*.js`
里出现过的全部字符。**页面上会出现的字全部在这张子集里**：2026-09-24 移除
「称呼 / 问题」输入框之后，站内已经没有能让用户输入任意文字的地方了
（旧分享链接里可能仍带 `n` / `q` 字段，那种情况会回落到
`PingFang SC / Microsoft YaHei / system-ui`，属于可接受的降级）。

---

## PWA 与离线

站点带 `manifest.webmanifest` + `sw.js`，在安全上下文（`http://127.0.0.1:4173` 或
`https://…`）下会注册 Service Worker：

- `install` 预缓存「壳」约 2 MB（HTML / CSS / 全部 JS 模块 / 字体 / 牌背 / 图标；
  品牌插画版的 PWA 图标本身占约 0.6 MB）。
  **卡面插画不预缓存**——78 张原图约 20 MB，装机时白下没有意义，改成用到才留。
- 代码类资源（HTML / CSS / JS）走**网络优先**，改完文件刷新立即生效；
  图片与字体走**缓存优先 + 后台更新**。
- 断网后仍能完整走完一次占卜（离线时新抽的牌面原图若没缓存过会缺图，其余正常）。

### 图标：favicon 与 PWA 图标是两件事

| | 用在哪 | 文件 | 实际渲染尺寸 |
|---|---|---|---|
| favicon | **浏览器标签页、书签栏** | `index.html` 里的 PNG data URI（+ `assets/icons/favicon-16/32.png` 兜底） | 16 ~ 32px |
| PWA 图标 | **添加到主屏幕 / 安装成应用**：安卓桌面、iOS 主屏、Windows 任务栏与开始菜单 | `assets/icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png` | 48 ~ 192px（平台自行缩放） |

两边图形都来自 `tools/icon-art.mjs` 的候选清单（`DEFAULT_KEY` 决定用哪个），
不再是各画一遍。**当前用的是 `n3`**：品牌插画（光栅）里「头 + 鲸 + 星星」那一块取景，
favicon、主屏图标、顶栏标记三处统一：

```bash
node tools/make-favicon.mjs                 # 出 16/32/64px 实尺对照表，看哪个在标签栏上认得出
node tools/make-favicon.mjs --only n2,n3    # 只看某几个候选
node tools/make-favicon.mjs --pick n3       # 写进 index.html 的 <link rel="icon">
node tools/make-icons.mjs --out .shots/brand/pwa-preview   # 只预览不覆盖
node tools/make-icons.mjs                   # 写 assets/icons/
node tools/make-icons.mjs --key i           # 换成矢量候选（金月牙）试试
```

光栅候选的图源由**候选自己带 `src`**（历史候选也都显式写了，不依赖默认值——
默认值会随「当前用哪张」而变，那样历史候选会莫名其妙换图）。
当前这张是 `assets/brand/mark-v4-1024.webp`，从 2048² 原图直接缩到 1024（全幅、没裁）。
两个脚本都用**渐进折半**再采样（1024→512→256→…），比一步缩到底干净得多。

顶栏那份是 `assets/brand/mark-v4.webp`（256px），路径写在 `src/main.js` 的 `mountBrandMark()`。

**两个诚实说明**：

1. 插画在 16px 下就是一个带颜色的圆点，认不出细节——这是尺寸的物理限制，不是画法问题。
   实测对照见 `.shots/brand/favicon-v2.png`；矢量候选 `i`（金月牙 + 四角星）在 16px 下清晰得多，
   随时可以用 `--pick i` 换回去。
2. 当前这张原图右下角有**平台强制的「AI生成」水印**（在 App / 网页里出图就会有）。
   所有取景都刻意避开了它（裁切下界 y ≤ 0.75，水印在 y 0.90+；顶栏用整幅但圆形遮罩会切掉四角），
   所以图标里看不到它——这是**构图裁切，不是抹标识**。
   依据《人工智能生成合成内容标识办法》（2025-09-01 施行），标识不得恶意删除、篡改、伪造、隐匿；
   本站在「规则 ⓘ」里与每份解读的免责声明里都写明了插画与图标由 AI 生成，那才是该做的合规动作。

maskable 版把内容收到画布的 **62%**，保证落在中心 80% 直径的安全区内；
`any` 版用 **90%**，交给平台自己加遮罩。

### AI 生成内容标识

站内确实有大量 AI 生成内容：78 张卡面插画、品牌图标与顶栏标记（火山方舟 Seedream），
解读文案由 AI 辅助撰写后人工校订。依据 2025-09-01 施行的
《人工智能生成合成内容标识办法》，发布者应当作出显著标识，所以站内写明了出两处：

- 「规则 ⓘ」弹窗 → **六、关于 AI**（`src/main.js` 的 `renderHelp()`）
- 每份解读末尾的免责声明（`src/data/rules.js` 的 `DISCLAIMER`，渲染在解读页底部）

⚠ 两条纪律：

1. **不要去抹生成图上的「AI生成」水印**。该办法明确：任何组织和个人不得恶意删除、篡改、
   伪造、隐匿生成合成内容标识。用 API 出图时传 `watermark: false` 是**平台自身的参数**，
   出图就没有水印，这是合规做法；拿到一张已经带标识的图再把它修掉，是另一回事。
2. 图标取景把水印排除在外属于**正常构图裁切**（16px 的图标也放不下那个框），
   但站点的显著标识不能因此省掉——两件事要一起做。

⚠ **两个限制**：

1. Service Worker 需要安全上下文。手机扫码访问的是 `http://192.168.x.x:4173`，
   属于不安全上下文，**SW 不会注册，手机端没有离线能力**（功能不受影响——
   `src/core/pwa.js` 会静默降级并打一条 console 说明）。
2. SW 会把旧版本留在缓存里。改了代码却看不到效果时，到 DevTools →
   Application → Service Workers 点 **Unregister**，或勾选 **Bypass for network**。
   改了 `sw.js` 的缓存策略时，把里面的 `VERSION` 常量加一即可全量换新。

---

## 开发与自检

```bash
node tools/verify.mjs                  # 数据完整性：牌库数量、牌义字段、牌阵坐标
node tools/drive.mjs                   # 端到端走查（需先启动 serve.mjs），截图落在 .shots/flow
node tools/verify-e2e.mjs              # 端到端验收 28 项（首屏字节 / 比例 / 键盘 / 焦点 / 持久化 / 分享 / AI 标识 / 离线）
node tools/verify-breakpoints.mjs      # 断点回归：10 个视口的卡面比例与横向溢出
node tools/verify-mobile.mjs           # 手机审计：4 个设备 × 5 个界面的字号 / 触控目标 / 裁切 / 排布利用率
node tools/serve.mjs 4173              # 静态服务器
```

`drive.mjs` 会用无头 Edge / Chrome 通过 CDP 真跑一遍：8 个方向、5 个牌阵、洗牌、扇形铺牌、
逐张抽满、翻牌、详情浮层、七牌阵、移动端 390px 与规则弹窗，并收集 console 报错与横向溢出值。

`verify-e2e.mjs` 与 `verify-breakpoints.mjs` 是逐条核对性能与交互验收标准的回归脚本，
需要先在 4173 端口起服务；截图分别落在 `.shots/e2e` 与 `.shots/bp`。

`verify-mobile.mjs` 逐屏统计**横向溢出、小于 12px 的文字、小于 40px 的触控目标、被裁的文字**，
并单独量解读网格的列数 / 行数 / 宽度利用率；截图落在 `.shots/mb`。
它用 `#r=` 分享链接直达「已抽满」的局面，省掉 3×6 秒的抽牌动画。
**改完任何移动端样式都应跑一遍，要求「问题 0 条」。**

### 卡面素材维护

`assets/tarot/` 与 `assets/back/` 里的图都是**产物**，改动流程如下：

```bash
node tools/gen-art.mjs --only pentacles-08      # 1. 出图（写入 assets/tarot/，原图 1472×2560）
python tools/optimize-art.py                    # 2. 降采样到 900 宽 + 生成图鉴缩略图
node tools/make-manifest.mjs                    # 3. 刷新 src/data/art-manifest.js
```

`optimize-art.py` 是**就地覆盖**原图的，所以它会先检查 `.backup/` 下有没有完整原图副本，
找不到就拒绝执行（`--no-backup-check` 可跳过，不建议）。处理记录写在
`assets/tarot/_optimize.json`（尺寸 + 大小 + mtime），重跑时已处理的会自动跳过；
`--force` 强制重做，`--dry-run` 只预览。

新增了中文文案（新牌义、新界面文字）时，别忘了：

```bash
python tools/make-font-subset.py && node tools/make-manifest.mjs
```

> 用无头浏览器做验证时注意两点：
> 一是 `URL.pathname` 会保留百分号编码，中文路径下要用 `fileURLToPath`，
> 否则会凭空造出 `D:\Claudecode%E5%AD%98...` 这样的目录；
> 二是 Service Worker 会把旧 CSS/JS 返回给页面，量之前记得
> `Network.setBypassServiceWorker` 或先 unregister。

---

## 用 AI 生成真正的插画卡面

卡面插画**已经全部生成完毕（78 / 78）**。这一节说明怎么补图、重出、或换一套风格。

程序化 SVG 版本仍完整保留在代码里：删掉 `assets/tarot/` 里的图再跑一次 `make-manifest.mjs`
即可切回——它的好处是极小、离线、可随意改，代价是**线条规整、缺少手绘感**。两种方式：

### 方式 A：站内生成台（推荐，图形界面）

启动服务器后打开 **http://127.0.0.1:4173/tools/studio.html**：

1. 选服务商（火山方舟·豆包 / 智谱 / 硅基流动），填**模型 ID** 与 **API Key**
   - 火山方舟：默认 `doubao-seedream-4-5-251128`（**成本明显低于 5.0**，2026-09-23 起改用）；
     也可填 `doubao-seedream-5-0-260128`（5.0 Lite）或控制台创建的接入点 ID（`ep-` 开头）。
     **模型要在控制台先开通**，否则报 `ModelNotOpen`
   - 智谱：`cogview-3-flash` 是官方免费模型，适合先试稿
   - ⚠️ **换模型会让新牌画风与旧牌不一致**。现有 78 张的产出模型已**无法完全追溯**：
     `assets/tarot/` 里只留下两份 `_report*.json`（都是 5.0 Lite、且都是「跳过」），
     而 2026-09-21 的记录写的是用 4.5 补的最后 7 张星币——即整副牌大概率是混着来的。
     所以补少量图时，先拿一张现有牌对比画风再决定用哪一代；要整体统一就得重出全部 78 张
2. 选一张牌，**画面描述可以自由改写**（默认已按「藏青＋白女仆装鲸鱼娘」写好，并叠加了该牌的构图）
3. 点「生成这一张」→ 右侧预览 → 满意后自动写入 `assets/tarot/`，**卡面立刻生效**
4. 也可以「批量：大阿卡纳 22 张」或「全部 78 张」，已生成的会自动跳过

密钥只存在你浏览器的 `localStorage`，请求经本地服务端转发，**不写入任何文件**。

#### 尺寸参数别填错（最容易踩的坑）

**不同 Seedream 版本的 `size` 规则完全不同**，生成台已按服务商动态给出可选项并做前置校验。
下表依据[官方 API 速查表](https://github.com/a86582751/doubao-seedream-image-skill/blob/main/references/api-quickref.md)（2026-09 核对）：

| 服务商 / 模型 | `size` 取值 |
| --- | --- |
| 火山方舟 · Seedream **4.5**（`doubao-seedream-4-5-251128`，**当前默认**） | 档位只有 **`2K` / `4K`**（没有 `3K`，那是 5.0 Lite 专属）；显式像素串的积须落在 **2560×1440 ~ 4096×4096**。`1472x2560` = 3,768,320 ✅ 且最贴卡面比例。**固定输出 JPEG**（`output_format` 是 5.0 才有的参数） |
| 火山方舟 · Seedream **5.0 Lite**（`doubao-seedream-5-0-260128`） | 档位 `2K` / `3K` / `4K`；显式像素串下限同样是 2560×1440。支持 `output_format: png` |
| 火山方舟 · Seedream **5.0 Pro**（`doubao-seedream-5-0-pro-260628`） | 档位只有 `1K` / `2K`；显式像素串积须落在 1280×720 ~ 2048×2048。不支持组图 / 流式 |
| 火山方舟 · Seedream **3.0** | 只接受固定像素串：`1024x1024`、`864x1152`、`1152x864`、`1280x720`、`720x1280`、`832x1248`、`1248x832`、`1512x648` |
| 智谱 `cogview-*` | 512–2048，需为 16 的整数倍，总像素 ≤ 2^21。**推荐 `768x1344`** |
| 智谱 `glm-image` | 1024–2048，需为 32 的整数倍，总像素 ≤ 2^22 |
| 硅基流动 `Kwai-Kolors/Kolors` | 见下拉列表，推荐竖版 `768x1344` |

**别用 4K 出小图。** 品牌图标最终只是顶栏 256px 的 WebP，`2K` 已经远超所需；
2026-09-23 那次用 4K 出了 6 张 4096² 再降到 256px，多出来的像素一个都没用上。

> **竖版尺寸怎么选**：卡面是 `300×520`，比例 **0.577**。
> `768×1344` = 0.571（最贴）、`1472×2560` = 0.575（次之）、`1024×1536` = 0.667（偏宽，会横向切掉约 7%）。
> 实测过的合法值以各服务商为准，上表是按上游报错校正后的结果。

换了供应商，模型与尺寸会**自动切到该供应商的默认值**（设置里存了版本号，旧版本的失效值会自动丢弃）。
如果上游仍返回尺寸相关错误，点「查看请求记录」能看到**实际发送的 model / size 与上游原始报错**。

#### 已生成的卡面

`assets/tarot/` 里已有 **78 / 78** 张插画（火山方舟 Seedream，`1472x2560`），
**没有第三方平台水印**（请求体里带了 `watermark: false`）。

> 早先有 7 张星币牌（`pentacles-08` ~ `pentacles-king`）因账户欠费未能生成，
> 后由 Seedream 4.5 补齐。缺图时卡面会自动回退到程序化 SVG 绘制——**混排是设计好的行为，
> 不会报错也不算破版**，所以任何时刻缺几张都不影响站点可用。

补图 / 重出任意一张（已存在的会自动跳过，加 `--force` 强制重出）：

```bash
$env:ARK_API_KEY="..."
node tools/gen-art.mjs --provider ark --model doubao-seedream-4-5-251128 --size 1472x2560 --cards pentacles-09
node tools/make-manifest.mjs
```

**动手前先预演**——不调接口、不写文件、不花钱：

```bash
node tools/gen-art.mjs --provider ark --dry-run --cards pentacles-09
```

每张牌的构图提示写在 `tools/gen-art.mjs` 的 `ART_HINT` 里，改那里就能换构图。
运行报告存成 `assets/tarot/_report-<时间戳>.json`，**每次都是新文件，不会覆盖历史**；
`_report.json` 则是「最近一次」的快捷入口。

#### 写提示词踩过的三个坑（都已固化进脚本，改提示词时留意）

1. **模型会自己画装饰边框** —— 卡面本来就要叠 SVG 金框，于是变成双重框。
   末尾必须带 `full-bleed edge-to-edge artwork … no border frame, no ornamental frame`。
2. **`dark moody` 会把画面压灰** —— 实测平均饱和度从 0.5 掉到 0.34，比同系列暗一档还发灰。
   要「又暗又饱和」，用 `richly saturated jewel tones, gold accents`。
3. **别在提示词里给具体数字** —— 写 `six pentacles` 出来只有 4 枚。用 `many` 更稳。

### 方式 B：命令行批量

```bash
$env:ARK_API_KEY="..."          # 或 ZHIPU_API_KEY / SILICONFLOW_API_KEY / DASHSCOPE_API_KEY
node tools/gen-art.mjs --provider ark --limit 2      # 先试 2 张
node tools/gen-art.mjs --provider ark                # 全部 78 张
node tools/make-manifest.mjs                          # 刷新卡面清单
```

### 接入原理

`assets/tarot/<牌id>.jpg` 存在即被 `src/data/art-manifest.js` 收录，卡面自动改用插画底图
（金框、序号带、铭牌仍由 SVG 叠在上面），**没图的牌继续用程序化绘制，可混排**。
想切回程序化版本，删掉素材再刷新清单即可。牌 id 形如 `major-00`、`wands-05`、`cups-queen`。
`tools/art-check.html` 可直接对比「插画版 / 程序化版」。

> 也可以用自己的工具出图（Midjourney、即梦、Stable Diffusion…），
> 只要按 `<牌id>.jpg` 命名放进 `assets/tarot/` 再跑一次 `make-manifest.mjs`。

### 已实测的接口情况（本机环境）

| 服务 | 端点可达性 | 备注 |
| --- | --- | --- |
| 火山方舟（豆包 Seedream） | ✅ 可达（401，仅缺密钥） | OpenAI 风格接口 |
| 硅基流动 | ✅ 可达（401） | `Kwai-Kolors/Kolors` 等 |
| 阿里百炼（通义万相） | ✅ 可达（401） | 异步任务，需轮询 |
| 智谱 BigModel | ✅ 可达（401） | `cogview-3-flash` 为免费模型 |
| Pollinations（免密钥） | ⚠️ 可达但不稳定 | 稍复杂提示词大量返回 500 |
| Google Gemini / OpenAI | ❌ 本机网络不通 | — |

---

## 免责声明

本站内容为文化娱乐与自我反思工具，不构成医疗、法律、投资等专业建议。牌面描述的是当下的能量与倾向，不是命运的判决；涉及金钱与身心健康的重大决定，请咨询相应专业人士。

## 形象与素材说明

站内图形的来源分两部分：

- **78 张卡面的插画底图**是 `assets/tarot/*.jpg`，由火山方舟 Seedream 模型**生成**（不是绘制）。
  提示词与生成脚本见 `tools/gen-art.mjs`。金框、序号带、铭牌仍由 SVG 叠在上面。
  这类生成图**受各服务商条款约束**，商用前请自行确认许可。
- **22 个鲸鱼娘角色、牌背、徽记、图标**，以及卡面的金框与纹样，都是 `src/art/` 下的程序化 SVG，
  可离线运行、可自由修改。

删掉 `assets/tarot/` 里的图再跑一次 `make-manifest.mjs`，即可完全回到纯 SVG 版本。

角色设计参考的是**藏青＋白女仆装鲸鱼娘**这一社区形象的基本构成——蓝色渐变长发、呆毛、鲸类耳鳍、蓝瞳、身后鲸尾、深蓝配白的裙装。这些都是抽象的造型语言；角色本身由本项目的代码逐笔绘制（`src/art/char-art.js`，约 440 行参数化 SVG），不是任何具体插画作品的复制或描摹。

需要留意：网络上流传的鲸鱼娘多来自同人二创（例如被普遍认为是原型的原创角色「溟月」，以及在其基础上加入 DeepSeek 元素的女仆版），这类作品通常**不可商用**。若你要把本站用于商业用途，请把 `src/art/char-art.js` 里的造型参数（发色、耳鳍、服装、配饰、配色）调整为你自己的设计，或替换为原创／已授权美术。
