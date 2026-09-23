#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""品牌图标后处理：从 Seedream 出的方图里裁出圆形徽记、导出网页资产、出真实尺寸对照表。

用法：
    python tools/brand-fit.py --sheet
        为 assets/brand/raw/ 下最新一批候选生成对照表（落在 .shots/brand/sheet.png）：
        每个候选按 180 / 96 / 64 / 44 px 渲染，并排放在站点同色背景上，
        另附当前顶栏图标的同尺寸参照。选图就看这张，别看 2K 原图。

    python tools/brand-fit.py <候选图> --out assets/brand/mark.webp --size 256
        把选中的那张裁成圆形徽记并导出网页用的资产。
        格式按 --out 的扩展名走；网页那份建议用 .webp + 256px——
        顶栏只显示 48 CSS px（3 倍屏 144 设备像素），512px PNG 要 316 KB，
        256px WebP 只要 19 KB。图片加载失败时 main.js 会退回矢量鲸鱼，
        所以不需要 PNG 兜底。

为什么裁切边界要算而不是拍常数：三张候选的金环留白差了一倍，
写死任何一个值都会让另外两张要么切掉金环、要么留一大圈空。
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

# 与 make-font-subset.py 同一个坑：Windows 中文控制台是 GBK(936)，
# 一旦要打印 ⚠ 这类符号就直接抛 UnicodeEncodeError，而且崩在「报告结果」那一行。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "brand" / "raw"
SHOTS = ROOT / ".shots" / "brand"
CURRENT_ICON = ROOT / "assets" / "icons" / "icon-192.png"

# 对照表里的尺寸：180 看细节，96/64/44 是真机上的实际显示尺寸
SIZES = [180, 96, 64, 44]
BG = (11, 16, 36)          # 与站点夜空同色，避免在浅底上看走眼
LABEL = (150, 162, 200)
HILITE = (232, 201, 138)

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/msyhl.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
]


def load_font(size: int):
    for p in FONT_CANDIDATES:
        if p.is_file():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def ring_bbox(im: Image.Image):
    """金色像素的包围盒 ≈ 金环包围盒。

    环上还有别的小金件（头饰星、手里的四角星），但它们都在环**内部**，
    不会把包围盒撑大。通道运算交给 ImageChops（C 实现），
    4096² 逐像素在 Python 里要跑十几秒。
    """
    r, g, b = im.convert("RGB").split()
    m = ImageChops.multiply(
        ImageChops.multiply(
            ImageChops.subtract(r, b).point(lambda v: 255 if v > 55 else 0),
            ImageChops.subtract(g, b).point(lambda v: 255 if v > 20 else 0),
        ),
        r.point(lambda v: 255 if v > 150 else 0),
    )
    return m.getbbox()


def square_crop(im: Image.Image, bb, pad_ratio: float = 0.03):
    """把包围盒扩成正方形（含一点外扩），并夹回画布范围内。"""
    x0, y0, x1, y1 = bb
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0) * (1 + pad_ratio * 2)
    half = side / 2
    box = (round(cx - half), round(cy - half), round(cx + half), round(cy + half))
    return im.crop(box)


def circular(im: Image.Image):
    """裁成圆形，模拟 border-radius:50% 之后的实际样子。"""
    w, h = im.size
    mask = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, w * 4 - 1, h * 4 - 1), fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def rounded(im: Image.Image, radius_ratio: float = 0.30):
    """裁成圆角方形——顶栏 .brand__mark 实际就是这个形状。

    圆角方形只切四个角，而金环的极值点落在四条边的中点上，
    所以「金环顶到画布边」的候选在圆角方形里**不会**被切到，
    在圆形里却会被切掉四个点。这个区别决定了候选 1 能不能用。"""
    w, h = im.size
    k = 4
    mask = Image.new("L", (w * k, h * k), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, w * k - 1, h * k - 1), radius=int(min(w, h) * k * radius_ratio), fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def feather_mask(size, feather: int):
    """中心不透明、最外圈 feather 像素渐隐的蒙版。

    从外往里一圈圈画 outline，越靠里 alpha 越高；这样贴回去时
    内图与外圈的细微色差会被糊掉，看不出接缝。"""
    w, h = size
    mask = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(mask)
    n = max(1, min(feather, min(w, h) // 3))
    for i in range(n):
        d.rectangle((i, i, w - 1 - i, h - 1 - i), outline=int(255 * (i + 1) / n))
    return mask


def extend_bg(im: Image.Image, ratio: float):
    """四周补出一圈背景，让顶到画布边的金环有喘息空间。

    做法是把画面缩到 (1-2*ratio)，再用**外圈像素的中位色**补底、边缘羽化后贴回去。
    不能用纯黑/纯色填充：外圈是带暗角的渐变，纯色会在接缝处露出一条硬边。"""
    w, h = im.size
    k = max(2, round(w * 0.02))
    edges = [
        im.crop((0, 0, w, k)), im.crop((0, h - k, w, h)),
        im.crop((0, 0, k, h)), im.crop((w - k, 0, w, h)),
    ]
    px = []
    for e in edges:
        # 每条边压成 1×1 取平均色。用 getpixel 而不是 getdata()：
        # Pillow 14 起 getdata() 已废弃，会在 stderr 打警告、被 PowerShell 当成命令失败。
        px.append(e.resize((1, 1), Image.BOX).getpixel((0, 0)))
    base = tuple(sorted(c[i] for c in px)[len(px) // 2] for i in range(3))

    side = max(1, round(w * (1 - 2 * ratio)))
    inner = im.resize((side, side), Image.LANCZOS)
    canvas = Image.new("RGB", (w, h), base)
    canvas.paste(inner, ((w - side) // 2, (h - side) // 2),
                 feather_mask((side, side), round(side * 0.06)))
    return canvas


def fit(im: Image.Image, size: int):
    return im.resize((size, size), Image.LANCZOS)


def candidates(pattern: str = ""):
    if not RAW.is_dir():
        return []
    runs = sorted((d for d in RAW.iterdir() if d.is_dir()), reverse=True)
    if not runs:
        return []
    latest = runs[0]
    out = sorted(p for p in latest.glob("mark-*")
                 if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    if pattern:
        out = [p for p in out if pattern in p.stem]
    return out


def build_sheet(out: Path, shape: str, extend: float, pattern: str) -> int:
    files = candidates(pattern)
    if not files:
        print("assets/brand/raw/ 下没有匹配的候选图，先跑：node tools/gen-brand.mjs")
        return 1

    mask_fn = (lambda im: circular(im)) if shape == "circle" else (lambda im: rounded(im))
    shape_cn = "圆形" if shape == "circle" else "圆角方形"

    pad = 22
    row_h = max(SIZES) + 46
    label_w = 460
    col_w = [label_w] + [s + 30 for s in SIZES]
    width = pad * 2 + sum(col_w)

    # 每个候选 → 一到两行（给了 --extend 就再出一行加留白的）
    rows = []
    for p in files:
        im = Image.open(p).convert("RGB")
        bb = ring_bbox(im)
        crop = square_crop(im, bb) if bb else im
        variants = [("原图", crop)]
        if extend > 0:
            variants.append((f"加留白 {round(extend * 100)}%", extend_bg(crop, extend)))
        for tag, img in variants:
            rows.append((p.stem, tag, img, bb, im.size))

    ref = None
    if CURRENT_ICON.is_file() and not pattern:
        ref = Image.open(CURRENT_ICON).convert("RGB")

    height = pad * 2 + 46 + row_h * (len(rows) + (1 if ref else 0))
    sheet = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(sheet)
    f_head = load_font(20)
    f_cell = load_font(15)

    x = pad + col_w[0]
    d.text((pad, pad + 8), f"候选（{shape_cn}装框）", font=f_head, fill=HILITE)
    for i, s in enumerate(SIZES):
        d.text((x + 15, pad + 10), f"{s}px", font=f_head, fill=LABEL)
        x += col_w[i + 1]

    y = pad + 46

    def draw_row(label, tag, img, note, verdict=""):
        nonlocal y
        d.text((pad, y + 12), f"{label}　·　{tag}", font=f_head, fill=HILITE)
        if note:
            d.text((pad, y + 40), note, font=f_cell, fill=LABEL)
        if verdict:
            d.text((pad, y + 62), verdict, font=f_cell, fill=(240, 150, 160))
        x = pad + col_w[0]
        for i, s in enumerate(SIZES):
            cell = mask_fn(fit(img, s))
            cx = x + (col_w[i + 1] - s) // 2
            sheet.paste(cell, (cx, y + (row_h - s) // 2), cell)
            x += col_w[i + 1]
        y += row_h
        d.line((pad, y - 4, width - pad, y - 4), fill=(30, 40, 74))

    for name, tag, img, bb, size in rows:
        note = f"原图 {size[0]}×{size[1]}"
        verdict = ""
        if bb:
            x0, y0, x1, y1 = bb
            touch = [n for n, cond in (
                ("左", x0 <= 2), ("上", y0 <= 2), ("右", x1 >= size[0] - 2), ("下", y1 >= size[1] - 2)
            ) if cond]
            note += f"　金环 {x1 - x0}×{y1 - y0}"
            if touch:
                note += f"　⚠ 原图里金环贴{'/'.join(touch)}边"
                verdict = ("圆角方形只切四角、不切边中点 → 可以用；圆形会切掉环的四个极值点"
                           if shape == "square" else "金环就在画布边 → 圆形装框会切掉环的四个极值点")
            else:
                inset = round((x1 - x0) / size[0] * 100)
                note += f"　金环占画幅 {inset}%"
                verdict = "留白正常，两种装框都行"
        draw_row(name, tag, img, note, verdict)

    if ref is not None:
        d.text((pad, y + 12), "现在的顶栏图标　·　矢量 SVG", font=f_head, fill=HILITE)
        d.text((pad, y + 40), "任意尺寸都锐利，但只有剪影、不是角色", font=f_cell, fill=LABEL)
        x = pad + col_w[0]
        for i, s in enumerate(SIZES):
            cell = rounded(fit(ref, s))
            sheet.paste(cell, (x + (col_w[i + 1] - s) // 2, y + (row_h - s) // 2), cell)
            x += col_w[i + 1]

    SHOTS.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"对照表：{out}  ({width}×{height})  装框={shape_cn}  加留白={extend}")
    print("按实际显示尺寸看：44px 那一列认不出来就别选它。")
    return 0


def export(src: Path, out: Path, size: int, pad_ratio: float, extend: float = 0.0) -> int:
    """按 --out 的扩展名决定落盘格式。

    网页用的那份走 WebP：同样 256px，PNG 是 316 KB、WebP 只要 19 KB。
    这里不需要「PNG 兜底」——main.js 在图片加载失败时会退回矢量鲸鱼，
    那个回退比一张 300 KB 的 PNG 更划算，也更清晰。
    """
    im = Image.open(src).convert("RGB")
    bb = ring_bbox(im)
    if not bb:
        print("没找到金色圆环，改用整幅方图。")
        crop = im
    else:
        crop = square_crop(im, bb, pad_ratio)
    if extend > 0:
        crop = extend_bg(crop, extend)

    out.parent.mkdir(parents=True, exist_ok=True)
    small = crop.resize((size, size), Image.LANCZOS)
    ext = out.suffix.lower()
    if ext == ".webp":
        small.save(out, "WEBP", quality=90, method=6)
    elif ext in (".jpg", ".jpeg"):
        small.save(out, "JPEG", quality=92, optimize=True, progressive=True)
    else:
        small.save(out, "PNG", optimize=True)

    kb = out.stat().st_size / 1024
    print(f"已导出 {out}  {size}×{size}  {kb:.1f} KB  ({ext.lstrip('.').upper()})")
    print(f"  来源 {src.name}，裁切区 {crop.size[0]}×{crop.size[1]}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="品牌图标裁切与对照表")
    ap.add_argument("src", nargs="?", help="选中的候选图；省略则只出对照表")
    ap.add_argument("--sheet", action="store_true", help="生成真实尺寸对照表")
    ap.add_argument("--sheet-out", default=str(SHOTS / "sheet.png"))
    ap.add_argument("--shape", choices=["circle", "square"], default="circle",
                    help="对照表按哪种装框渲染：circle=圆形，square=圆角方形（顶栏实际就是方形）")
    ap.add_argument("--extend", type=float, default=0.0,
                    help="额外的四周留白比例，0.08 表示缩到 84%% 再补背景")
    ap.add_argument("--only", default="", help="只处理文件名里含该子串的候选")
    ap.add_argument("--out", default=str(ROOT / "assets" / "brand" / "mark.png"))
    ap.add_argument("--size", type=int, default=512, help="导出边长，默认 512")
    ap.add_argument("--pad", type=float, default=0.03, help="金环外的额外留白比例")
    args = ap.parse_args()

    if args.sheet or not args.src:
        return build_sheet(Path(args.sheet_out), args.shape, args.extend, args.only)
    return export(Path(args.src), Path(args.out), args.size, args.pad, args.extend)


if __name__ == "__main__":
    sys.exit(main())
