#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""中文字体子集化

站内真正会用到的汉字是有限的（界面文案 + 78 张牌的牌义，去重后约 2000 字），
而随站点分发的思源宋体/黑体是完整常用字集——首屏要下 2.5 MB 字体。

本脚本扫描 index.html 与 src/**/*.js 里出现过的每一个字符，用 fontTools 的
pyftsubset 裁出只含这些字形的 woff2。

用法：
    python tools/make-font-subset.py
    python tools/make-font-subset.py --dry-run        只统计字符集，不做子集
    python tools/make-font-subset.py --check          只校验现有子集是否覆盖当前字符集

产物：
    fonts/<name>.subset.woff2        子集字体（styles/fonts.css 已指向它们）
    fonts/_subset-chars.txt          本次用到的字符集（便于排查缺字）
    fonts/_subset-report.json        每个字体的体积对比

注意：以后新增了中文文案（新牌义、新界面文字），必须重跑本脚本，
      否则新字会回落到系统字体。--check 可以检测出这种情况。
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Windows 的中文控制台默认是 GBK(936)，遇到 ⚠ ✓ 这类符号会直接抛
# UnicodeEncodeError 把整条流程打断（--check 报告缺字时就是这样挂的，
# 而且崩在打印那一行，看不到到底缺哪些字）。固定成 UTF-8 并让不可编码字符降级。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"
CHARS_FILE = FONTS / "_subset-chars.txt"
REPORT = FONTS / "_subset-report.json"

# 需要子集化的 CJK 字体。拉丁字体（Cinzel / Cormorant）本来就只含几十 KB，不动。
CJK_FONTS = [
    "NotoSerifSC-400.woff2",
    "NotoSerifSC-600.woff2",
    "NotoSansSC-400.woff2",
]

# 扫描范围：真正参与渲染的文本都在这里
SOURCES = ["index.html"]


def collect_chars() -> set:
    """收集站内出现过的全部字符。"""
    chars = set()
    files = [ROOT / s for s in SOURCES]
    files += sorted((ROOT / "src").rglob("*.js"))
    for p in files:
        if p.is_file():
            chars |= set(p.read_text(encoding="utf-8"))

    # ASCII 可打印字符：中文字体同时承担拉丁回退，必须全留
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    # 常用中文标点与全角符号，即使当前没出现也留一手（文案微调不必重跑）
    chars |= set("　、。〈〉《》「」『』【】〔〕（）·—…‘’“”～！？：；，．　×÷±°％‰¥€$§¶†‡•‰′″")
    chars.discard("\n")
    chars.discard("\r")
    chars.discard("\t")
    return chars


def run_subset(src: Path, out: Path, chars_path: Path) -> bool:
    cmd = [
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--text-file={chars_path}",
        "--flavor=woff2",
        "--no-hinting",
        "--layout-features=kern,liga,clig,calt,locl,ccmp,mark,mkmk,rlig",
        "--drop-tables+=DSIG",
        f"--output-file={out}",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"    失败：{r.stderr.strip()[:300]}")
        return False
    return True


def human(n: int) -> str:
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def main() -> int:
    ap = argparse.ArgumentParser(description="中文字体子集化")
    ap.add_argument("--dry-run", action="store_true", help="只统计字符集，不做子集")
    ap.add_argument("--check", action="store_true",
                    help="校验现有子集是否覆盖当前字符集（检测新增文案导致的缺字）")
    args = ap.parse_args()

    chars = collect_chars()
    han = sum(1 for c in chars if "\u4e00" <= c <= "\u9fff")
    print(f"扫描到 {len(chars)} 个不同字符，其中汉字 {han} 个")

    if args.check:
        if not CHARS_FILE.is_file():
            print("尚无字符集记录，请先正常运行一次本脚本")
            return 1
        old = set(CHARS_FILE.read_text(encoding="utf-8"))
        added = chars - old
        if added:
            print(f"\n发现 {len(added)} 个新增字符（现有子集里没有，会回落到系统字体）：")
            print("  " + "".join(sorted(added))[:300])
            print("\n请重跑： python tools/make-font-subset.py")
            return 1
        print("现有子集覆盖完整 ✓")
        return 0

    if args.dry_run:
        for f in CJK_FONTS:
            p = FONTS / f
            print(f"  {f}: {human(p.stat().st_size)} → 待估算")
        return 0

    CHARS_FILE.write_text("".join(sorted(chars)), encoding="utf-8")

    results = []
    total_before = total_after = 0
    for f in CJK_FONTS:
        src = FONTS / f
        if not src.is_file():
            print(f"  跳过（不存在）：{f}")
            continue
        out = FONTS / f.replace(".woff2", ".subset.woff2")
        before = src.stat().st_size
        print(f"  子集化 {f} … {human(before)}", end="")
        if not run_subset(src, out, CHARS_FILE):
            return 1
        after = out.stat().st_size
        total_before += before
        total_after += after
        pct = (1 - after / before) * 100 if before else 0
        print(f" → {human(after)}  (省 {pct:.0f}%)")
        results.append({"font": f, "before": before, "after": after,
                        "subset": out.name, "savedPct": round(pct, 1)})

    REPORT.write_text(json.dumps({
        "chars": len(chars), "han": han, "fonts": results,
        "totalBefore": total_before, "totalAfter": total_after,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "─" * 52)
    print(f"  CJK 字体合计  {human(total_before)} → {human(total_after)}"
          f"   省 {human(total_before - total_after)}")
    print(f"  字符集已写入 {CHARS_FILE.name}（{len(chars)} 字）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
