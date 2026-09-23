/* ===========================================================
   tools/patch-sidebar-relpath.mjs
   dsh-better-sidebar 相对路径修复（本地补丁，插件更新后需重跑）

   ── 问题 ──────────────────────────────────────────────
   侧栏里打开「已编辑的文件 / 交付物」卡片时，预览区一片空白（图片是破图图标）。

   链路：
     1. DSH 记录「本轮产出的文件」时，**工作区内的文件存的是相对路径**
        （dsh-workspace-changes 文档：位于工作目录内时为相对路径，否则为绝对路径）
     2. better-sidebar 的 intercept.tsx 会用
        `resolveSidebarPath(summary?.cwd, path)` 转成绝对路径，
        但该函数里有一条静默失败分支：
            const base = cwd ?? ''
            if (base === '') return path        // ← 会话列表快照取不到 cwd 时原样返回
        于是相对路径被直接交给服务端。
     3. 服务端 path-security.ts：
            const absolute = requireAbsolute(resolveSessionPath(cwd, target))
        `resolveSessionPath` 只做 WSL 的 `/foo` 投影，**从不把相对路径拼到 cwd**，
        紧接着 `requireAbsolute` 就抛 `"…" is not an absolute path` → 400，预览空白。

   实测日志（打补丁抓到的原始证据）：
     REQ   cwd=D:\Claudecode存储\网页塔罗占卜 path=.shots/brand/sheet.png
     CWD-RESOLVED cwd=D:\Claudecode存储\网页塔罗占卜 fence=true
     ERROR ".shots/brand/sheet.png" is not an absolute path

   ── 修法 ──────────────────────────────────────────────
   服务端容忍相对路径，按会话 cwd 解析。这与客户端 `resolveSidebarPath` 的语义
   完全一致，而且服务端本来就拿到了正确的 cwd，是最稳的一处修复：

       const absolute = requireAbsolute(resolveSessionPath(cwd, target));
     →
       const projected = resolveSessionPath(cwd, target);
       const absolute = requireAbsolute(isAbsolute(projected) ? projected : join(cwd, projected));

   注意：这只影响「客户端给了相对路径」的情形，绝对路径走原逻辑，行为不变。
   影响面不只是图片——侧栏里打开**任何**产出文件都会走这条路径。

   ── 为什么放在这里而不是直接改 ────────────────────────
   改的是 DSH 插件目录里的**构建产物**。插件被卸载/重装/升级时会被覆盖
   （2026-09-23 实测：一次插件操作就把补丁连同备份一起清掉了）。
   所以做成幂等脚本，覆盖后重跑一次即可。

   用法：
     node tools/patch-sidebar-relpath.mjs            # 应用（已打过则跳过）
     node tools/patch-sidebar-relpath.mjs --check    # 只看状态，不改
     node tools/patch-sidebar-relpath.mjs --revert   # 还原到 .orig-relpathfix 备份

   真正的修复应提给上游：dsh-better-sidebar 0.19.1（当前最新版）仍有此问题。
   =========================================================== */

import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const HOME = process.env.DSH_HOME || 'D:\\.dsh';
const PKG = join(HOME, 'profiles', 'web', 'node_modules', 'dsh-better-sidebar');
const FILE = join(PKG, 'lib', 'index.js');
const BACKUP = `${FILE}.orig-relpathfix`;

const OLD = 'const absolute = requireAbsolute(resolveSessionPath(cwd, target));';
const NEW = [
  'const projected = resolveSessionPath(cwd, target);',
  '\tconst absolute = requireAbsolute(isAbsolute(projected) ? projected : join(cwd, projected));',
].join('\n');

const args = process.argv.slice(2);
const check = args.includes('--check');
const revert = args.includes('--revert');

const exists = async (p) => access(p, constants.F_OK).then(() => true, () => false);

if (!(await exists(FILE))) {
  console.error(`找不到插件文件：${FILE}`);
  console.error(`DSH_HOME=${HOME}（可用环境变量覆盖）`);
  process.exit(1);
}

let src = await readFile(FILE, 'utf8');
const oldCount = src.split(OLD).length - 1;
const newCount = src.split('const projected = resolveSessionPath(cwd, target);').length - 1;

if (revert) {
  if (!(await exists(BACKUP))) { console.error(`没有备份可还原：${BACKUP}`); process.exit(1); }
  await copyFile(BACKUP, FILE);
  console.log(`已还原：${FILE}`);
  console.log(`  来源备份 ${BACKUP}`);
  process.exit(0);
}

console.log(`插件目录：${PKG}`);
console.log(`  原始写法 ${oldCount} 处，已修复写法 ${newCount} 处`);

if (oldCount === 0 && newCount === 0) {
  console.error('\n两种写法都没有 —— 插件版本可能变了，需要重新核对源码。');
  process.exit(2);
}

if (check) {
  console.log(newCount > 0 && oldCount === 0
    ? '\n状态：已修复 ✓'
    : '\n状态：未修复（插件可能刚被重装覆盖，跑一次不带参数的即可）');
  process.exit(0);
}

if (oldCount === 0) {
  console.log('\n已经是修复状态，无需改动。');
  process.exit(0);
}

if (!(await exists(BACKUP))) {
  await copyFile(FILE, BACKUP);
  console.log(`原文件已备份 → ${BACKUP}`);
} else {
  console.log(`备份已存在，保留不动 → ${BACKUP}`);
}

src = src.split(OLD).join(NEW);
await writeFile(FILE, src, 'utf8');
console.log(`已修复 ${oldCount} 处。`);
console.log('\n⚠ 需要重启 DSH 桌面版才会生效（宿主只在启动时加载这个文件）。');
console.log('  重启后侧栏里打开图片/文件即应正常。');
