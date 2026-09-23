#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""卡面素材优化：原图降采样 + 生成图鉴缩略图

为什么需要：
  · 卡面原始尺寸 1472×2560（约 3.77 M 像素、平均 585 KB），但站内最大显示
    宽度只有 280 px（放大视图），图鉴网格更是只有 108 px。
  · 打开一次「牌面图鉴」会同时请求 78 张全尺寸图 = 45.6 MB。
  · 所以：原图降到 900 px 宽（够 280 px @ DPR3 用），图鉴另配 216 px 宽的
    WebP 缩略图。

用法：
    python tools/optimize-art.py                 # 处理全部（幂等，已处理的跳过）
    python tools/optimize-art.py --dry-run       # 只预览，不写任何文件
    python tools/optimize-art.py --force         # 忽略记录，全部重做
    python tools/optimize-art.py --only major-00 pentacles-08

本脚本会**就地覆盖** assets/tarot/*.jpg。运行前会检查 .backup/ 下是否存在
完整的原图副本，找不到就拒绝执行（可用 --no-backup-check 跳过）。

产物：
    assets/tarot/<id>.jpg            降采样后的卡面（原图请依赖 .backup/）
    assets/tarot/thumbs/<id>.webp    图鉴网格缩略图
    assets/tarot/_optimize.json      处理记录（尺寸+大小+时间），用于幂等跳过
"""

import argparse
import json
import sys
import time
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("缺少 Pillow：请先执行  python -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "tarot"
THUMBS = ART / "thumbs"
RECORD = ART / "_optimize.json"
BACKUP = ROOT / ".backup"
BACK_DIR = ROOT / "assets" / "back"

CARD_RATIO = 300 / 520  # 卡面 viewBox 比例，仅用于报告
BACK_MAX = 512          # 牌背徽记最长边；卡片上直径约 112 CSS px，DPR2 需 224


def human(n: int) -> str:
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def backup_ok(needed: int) -> bool:
    """确认 .backup/ 下至少有一份包含 needed 张原图的完整副本。"""
    if not BACKUP.is_dir():
        return False
    for d in sorted(BACKUP.iterdir(), reverse=True):
        art = d / "assets" / "tarot"
        if art.is_dir() and len(list(art.glob("*.jpg"))) >= needed:
            return True
    return False


def load_record() -> dict:
    if RECORD.is_file():
        try:
            return json.loads(RECORD.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    return {"version": 1, "files": {}}


def save_record(rec: dict) -> None:
    RECORD.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")


def target_size(w: int, h: int, max_w: int) -> tuple:
    """按最长边约束等比缩放；本来就不大于目标宽则原样返回。"""
    if w <= max_w:
        return w, h
    return max_w, max(1, round(h * max_w / w))


def optimize_back(dry_run: bool, quality: int) -> tuple:
    """牌背徽记降采样。

    它是 2048×2048 的方图，但卡片上显示直径只有约 112 CSS px（DPR2 需 224），
    属于 9 倍过采样。更关键的是它在**首屏**就会被 <symbol> 里的 <image>
    触发下载，1.29 MB 直接压在首屏预算上。
    """
    if not BACK_DIR.is_dir():
        return 0, 0
    before = after = 0
    for p in sorted(BACK_DIR.glob("*.jpg")):
        st = p.stat().st_size
        before += st
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im)
            w, h = im.size
            if max(w, h) <= BACK_MAX:
                after += st
                print(f"  {p.name}: 已是 {w}×{h}，跳过")
                continue
            scale = BACK_MAX / max(w, h)
            nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
            if dry_run:
                print(f"  {p.name}: {w}×{h} → {nw}×{nh}  （{human(st)}，未写入）")
                after += st
                continue
            # 金色线稿靠 subsampling=0（4:4:4）保住边缘，否则细线会出彩边
            im.convert("RGB").resize((nw, nh), Image.LANCZOS).save(
                p, "JPEG", quality=quality, optimize=True,
                progressive=True, subsampling=0)
        ns = p.stat().st_size
        after += ns
        print(f"  {p.name}: {w}×{h} → {nw}×{nh}  {human(st)} → {human(ns)}")
    return before, after


def main() -> int:
    ap = argparse.ArgumentParser(description="卡面素材优化")
    ap.add_argument("--width", type=int, default=900, help="原图目标宽度（默认 900）")
    ap.add_argument("--quality", type=int, default=84, help="原图 JPEG 质量（默认 84）")
    ap.add_argument("--thumb-w", type=int, default=216, help="缩略图宽度（默认 216）")
    ap.add_argument("--thumb-quality", type=int, default=80, help="缩略图 WebP 质量（默认 80）")
    ap.add_argument("--only", nargs="*", metavar="ID", help="只处理指定牌 id")
    ap.add_argument("--force", action="store_true", help="忽略记录，全部重做")
    ap.add_argument("--dry-run", action="store_true", help="只预览，不写文件")
    ap.add_argument("--no-backup-check", action="store_true", help="跳过 .backup 检查（危险）")
    ap.add_argument("--back-quality", type=int, default=90, help="牌背图 JPEG 质量（默认 90）")
    args = ap.parse_args()

    if not ART.is_dir():
        sys.exit(f"找不到卡面目录：{ART}")

    sources = sorted(p for p in ART.glob("*.jpg") if p.is_file())
    if args.only:
        want = set(args.only)
        sources = [p for p in sources if p.stem in want]
        missing = want - {p.stem for p in sources}
        if missing:
            sys.exit(f"指定的牌不存在：{', '.join(sorted(missing))}")
    if not sources:
        sys.exit("没有找到任何 .jpg 卡面")

    # 安全问题：本脚本就地覆盖原图，必须先有备份
    if not args.dry_run and not args.no_backup_check and not backup_ok(len(sources)):
        sys.exit(
            f"未在 {BACKUP} 下找到包含 {len(sources)} 张原图的备份。\n"
            "本脚本会就地覆盖 assets/tarot/*.jpg，请先备份后再运行：\n"
            "  New-Item -ItemType Directory -Force .backup\\manual | Out-Null\n"
            "  Copy-Item assets\\tarot\\*.jpg .backup\\manual\\ -Force\n"
            "确认无需备份可加 --no-backup-check。"
        )

    rec = load_record()
    files_rec = rec.setdefault("files", {})
    THUMBS.mkdir(parents=True, exist_ok=True)

    before_total = sum(p.stat().st_size for p in sources)
    after_total = 0
    done, skipped, failed = 0, 0, []
    thumb_bytes = 0
    t0 = time.time()

    for i, src in enumerate(sources, 1):
        stem = src.stem
        st = src.stat()
        prev = files_rec.get(stem)
        if not args.force and prev and prev.get("size") == st.st_size and prev.get("mtime") == int(st.st_mtime):
            after_total += st.st_size
            tp = THUMBS / f"{stem}.webp"
            if tp.is_file():
                thumb_bytes += tp.stat().st_size
            skipped += 1
            continue

        try:
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im)
                w0, h0 = im.size
                tw, th = target_size(w0, h0, args.width)

                if args.dry_run:
                    print(f"  [{i}/{len(sources)}] {stem}: {w0}×{h0} → {tw}×{th}"
                          f"  ({human(st.st_size)} → ~{human(st.st_size * (tw * th) / (w0 * h0))})")
                    after_total += st.st_size
                    done += 1
                    continue

                big = im.convert("RGB").resize((tw, th), Image.LANCZOS)
                big.save(src, "JPEG", quality=args.quality, optimize=True,
                         progressive=True, subsampling=1)

                ttw = args.thumb_w
                tth = max(1, round(th * ttw / tw))
                im.convert("RGB").resize((ttw, tth), Image.LANCZOS).save(
                    THUMBS / f"{stem}.webp", "WEBP",
                    quality=args.thumb_quality, method=6)

            new_size = src.stat().st_size
            tb = (THUMBS / f"{stem}.webp").stat().st_size
            after_total += new_size
            thumb_bytes += tb
            files_rec[stem] = {"w": tw, "h": th, "size": new_size,
                               "mtime": int(src.stat().st_mtime)}
            done += 1
            print(f"  [{i}/{len(sources)}] {stem}: {w0}×{h0} → {tw}×{th}"
                  f"  {human(st.st_size)} → {human(new_size)}  (thumb {human(tb)})")
        except Exception as exc:  # noqa: BLE001 - 逐张容错，不中断整批
            failed.append(f"{stem}: {exc}")
            after_total += st.st_size

    if not args.dry_run:
        rec.update({"version": 1, "sourceWidth": args.width, "quality": args.quality,
                    "thumbWidth": args.thumb_w, "thumbQuality": args.thumb_quality,
                    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S")})
        save_record(rec)

    # 牌背徽记同样压在首屏预算上，一并处理
    print("\n牌背徽记：")
    back_before, back_after = optimize_back(args.dry_run, args.back_quality)

    print("\n" + "─" * 58)
    print(f"  卡面张数   {len(sources)}（处理 {done} / 跳过 {skipped}）")
    print(f"  原图合计   {human(before_total)} → {human(after_total)}"
          f"   省 {human(max(0, before_total - after_total))}")
    print(f"  缩略图     {len(list(THUMBS.glob('*.webp')))} 个，合计 {human(thumb_bytes)}")
    if back_before:
        print(f"  牌背徽记   {human(back_before)} → {human(back_after)}"
              f"   省 {human(max(0, back_before - back_after))}")
    print(f"  耗时       {time.time() - t0:.1f}s")
    if args.dry_run:
        print("  （--dry-run，未写入任何文件）")
    if failed:
        print(f"\n  失败 {len(failed)} 张：")
        for f in failed[:10]:
            print(f"    {f}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
