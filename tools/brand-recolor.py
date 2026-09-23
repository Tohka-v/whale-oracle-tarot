"""品牌插画调色：把过浅的头发改成参考图那样的深蓝。

为什么要这个脚本：现在的品牌插画（Seedream 出的那张）头发是**很浅的青色**，
和参考图里那种偏灰的中深蓝差得远。裁切、缩放都改不了颜色，只能动像素。

两种模式：

1) 简单档位（默认）——只对「青蓝高亮」像素降明度：
     python tools/brand-recolor.py --in assets/brand/mark-1024.webp \
         --out assets/brand/mark-deep-1024.webp --v 0.72

2) **从参考图吸色号**（--palette-from）——分位数匹配，推荐：
     python tools/brand-recolor.py --in assets/brand/mark-1024.webp \
         --out assets/brand/mark-ref-1024.webp \
         --palette-from <参考图.jpg> --palette-rects "70,300,130,320;425,280,80,280"
   做法：在参考图的头发区域里按「明度」取 5/25/50/75/95 五个分位色，
   再取本图头发的同样五个分位，两边一一对应后建三张查表（以明度为输入），
   只对本图的头发遮罩生效。
   效果是「保留本图的画法结构，换成参考图的配色」，比手拍一个倍数可控得多。
   ⚠ 参考图是别人的作品，**不要拷进仓库**——只把吸出来的色号记进文档。

遮罩怎么定的（两种模式共用）：
  · 明度门槛（--v-min）把深蓝夜空挡在外面——背景明度很低，不会被误伤；
  · 饱和度门槛（--s-min）把白色头巾、肤色挡在外面——那两块饱和度都低；
  · 色相区间（--h-lo/hi）只圈青到蓝，脸部的橙肤色（H≈0.05）完全不在里面。
"""

from __future__ import annotations

import argparse
import colorsys
import sys
import warnings
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

# Pillow 14 会移除 Image.getdata（改用 get_flattened_data）。
# 这里逐像素取样是本脚本的核心，等 Pillow 14 真发布了再一次性迁移；
# 现在先把告警压掉，免得几十行噪音淹掉真正有用的输出。
warnings.filterwarnings("ignore", category=DeprecationWarning)

ROOT = Path(__file__).resolve().parent.parent

# Windows 控制台默认 GBK，中文/符号会直接抛 UnicodeEncodeError
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass


def hue_mask(h: Image.Image, lo: int, hi: int, feather: float = 1.0) -> Image.Image:
    """色相落在 [lo, hi]（0~255 的 HSV 标度）内的软遮罩。

    色相是环形的，青蓝这一段（约 112~175）不跨 0，所以直接夹区间即可。
    两条边各留一点斜坡，避免遮罩边界出现生硬的分界线。
    """
    ramp = 6

    def f(x: int) -> int:
        if x < lo - ramp or x > hi + ramp:
            return 0
        if x < lo:
            return int(255 * (x - (lo - ramp)) / ramp)
        if x > hi:
            return int(255 * ((hi + ramp) - x) / ramp)
        return 255

    m = h.point(f)
    return m.filter(ImageFilter.GaussianBlur(feather)) if feather else m


def threshold(ch: Image.Image, lo: int | None = None, hi: int | None = None,
              feather: float = 1.0) -> Image.Image:
    """明度/饱和度门槛。lo 以下为 0，hi 以上为 0，中间给一条斜坡。"""
    ramp = 24

    def f(x: int) -> int:
        if lo is not None:
            if x <= lo:
                return 0
            if x < lo + ramp:
                return int(255 * (x - lo) / ramp)
        if hi is not None:
            if x >= hi:
                return 0
            if x > hi - ramp:
                return int(255 * (hi - x) / ramp)
        return 255

    m = ch.point(f)
    return m.filter(ImageFilter.GaussianBlur(feather)) if feather else m


def hair_mask(im: Image.Image, h_lo: int, h_hi: int, v_min: int, s_min: int,
              feather: float):
    """挑出「头发 / 眼睛 / 鲸鱼」这类青蓝高亮区的遮罩，同时返回 HSV 三个通道。"""
    hsv = im.convert("HSV")
    h, sat, val = hsv.split()
    mask = ImageChops.multiply(
        ImageChops.multiply(
            hue_mask(h, h_lo, h_hi, feather),
            threshold(sat, lo=s_min, feather=feather),
        ),
        threshold(val, lo=v_min, feather=feather),
    )
    return mask, h, sat, val


def save(im: Image.Image, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() == ".webp":
        im.save(out, "WEBP", quality=92, method=6)
    else:
        im.save(out)


def hexof(rgb) -> str:
    return "#%02X%02X%02X" % tuple(int(max(0, min(255, round(c)))) for c in rgb)


# ─────────────────────────── 模式 1：按倍数压暗 ───────────────────────────

def recolor(src: Path, out: Path, v: float, s: float, dh: int,
            h_lo: int, h_hi: int, v_min: int, s_min: int,
            feather: float) -> tuple[int, float]:
    im = Image.open(src).convert("RGB")
    mask, h, sat, val = hair_mask(im, h_lo, h_hi, v_min, s_min, feather)

    h2 = h.point(lambda x: max(0, min(255, x + dh)))
    s2 = sat.point(lambda x: max(0, min(255, int(x * s))))
    v2 = val.point(lambda x: max(0, min(255, int(x * v))))
    adjusted = Image.merge("HSV", (h2, s2, v2)).convert("RGB")

    result = Image.composite(adjusted, im, mask)
    save(result, out)

    # 受影响像素占比：太小说明阈值挑错了（一个像素都没改到），太大则是误伤
    hist = mask.histogram()
    touched = sum(hist[64:]) / max(1, sum(hist))
    return result.size[0], touched


# ─────────────────── 模式 2：从参考图吸色号（分位数匹配） ───────────────────

def hair_pixels(img: Image.Image, rects: list[tuple[int, int, int, int]],
                hue: tuple[float, float], s_min: float,
                v_lo: float, v_hi: float) -> list[tuple[int, int, int]]:
    """从若干矩形里挑出「像头发」的像素，返回 [(r, g, b), ...]。

    v_lo / v_hi 是有用的：参考图里深色裙子（V 很低）和白头巾（V 很高、S 很低）
    都得挡在外面，否则吸出来的色号会被它们带偏——第一版就是这么把 #3B3A59
    这种裙子的暗色当成「头发暗部」吸进来的。
    """
    out: list[tuple[int, int, int]] = []
    for (x, y, w, h) in rects:
        region = img.crop((x, y, x + w, y + h)).convert("RGB")
        for r, g, b in region.getdata():
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if hue[0] <= hh <= hue[1] and ss >= s_min and v_lo <= vv <= v_hi:
                out.append((r, g, b))
    return out


def percentile(vals: list[int], q: float) -> float:
    """线性插值分位数（不引 numpy，几百个样本足够了）"""
    if not vals:
        return 0.0
    s = sorted(vals)
    pos = (len(s) - 1) * q / 100
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


PCTS = (5, 25, 50, 75, 95)


def hsv_median(pixels: list[tuple[int, int, int]]) -> tuple[float, float, float]:
    """一组像素的 HSV 中位值（H/S/V 都在 0~1）。

    用中位数而不是均值：头发上有高光和暗部两块极端值，均值会被它们拖偏。
    """
    hs = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for (r, g, b) in pixels]
    return (percentile([x[0] for x in hs], 50),
            percentile([x[1] for x in hs], 50),
            percentile([x[2] for x in hs], 50))


def recolor_palette(src: Path, out: Path, ref: Path,
                    ref_rects: list[tuple[int, int, int, int]],
                    h_lo: int, h_hi: int, v_min: int, s_min: int,
                    feather: float, strength: float):
    """配色迁移：本图的头发 → 参考图头发的配色。

    做法：从两边各取「头发像素的 HSV 中位值」，算出色相偏移、饱和度倍率、明度倍率，
    再把这组变换**整体**施加到本图的头发遮罩上。

    为什么不是逐通道分位匹配（试过，效果差）：扁平上色的图里，某个通道的取值区间
    很窄（本图头发的 G/B 高光就挤在 220~254），硬把它拉成参考图的宽区间，
    相邻像素会被推成几十级的色差，出来是一块块的色带断层，很脏。
    整体变换只搬「整体色调」，像素之间的相对明暗关系原样保留，干净得多。
    """
    im = Image.open(src).convert("RGB")
    mask, h, sat, val = hair_mask(im, h_lo, h_hi, v_min, s_min, feather)

    # 本图头发像素：只取遮罩接近实心的位置，避开羽化边缘的过渡色；
    # 不过滤明度——高光那部分正是要一起压深的。
    mdata = list(mask.getdata())
    idata = list(im.getdata())
    ours = [idata[i] for i in range(len(mdata)) if mdata[i] >= 200]

    ref_img = Image.open(ref).convert("RGB")
    theirs = hair_pixels(ref_img, ref_rects, (h_lo / 255, h_hi / 255),
                         s_min / 255 * 0.6, 0.22, 0.94)

    if not ours or not theirs:
        raise SystemExit(
            f"取色失败：本图 {len(ours)} 像素，参考图 {len(theirs)} 像素。"
            "参考图取不到多半是 --palette-rects 框到白底/深色裙子上了——"
            "框选时只框纯头发，别带衣服和背景。")

    h_our, s_our, v_our = hsv_median(ours)
    h_ref, s_ref, v_ref = hsv_median(theirs)

    # 强度：1.0 = 完全搬到参考图的色调，0 = 原样
    dh = (h_ref - h_our) * strength          # 0~1 的色相差
    ks = 1 + (s_ref / s_our - 1) * strength if s_our else 1.0
    kv = 1 + (v_ref / v_our - 1) * strength if v_our else 1.0
    dh255 = int(round(dh * 255))

    h2 = h.point(lambda x: max(0, min(255, x + dh255)))
    s2 = sat.point(lambda x: max(0, min(255, int(x * ks))))
    v2 = val.point(lambda x: max(0, min(255, int(x * kv))))
    adjusted = Image.merge("HSV", (h2, s2, v2)).convert("RGB")

    result = Image.composite(adjusted, im, mask)
    save(result, out)

    hist = mask.histogram()
    touched = sum(hist[64:]) / max(1, sum(hist))
    stats = {
        "ours": len(ours), "theirs": len(theirs),
        "median_our": med_rgb(ours), "median_ref": med_rgb(theirs),
        "hsv_our": (h_our, s_our, v_our), "hsv_ref": (h_ref, s_ref, v_ref),
        "dh255": dh255, "ks": ks, "kv": kv,
    }
    return result.size[0], touched, stats


def med_rgb(pixels: list[tuple[int, int, int]]) -> tuple[float, float, float]:
    return tuple(percentile([p[ch] for p in pixels], 50) for ch in range(3))


def main() -> int:
    ap = argparse.ArgumentParser(description="品牌插画：把过浅的头发改成参考图的深蓝")
    ap.add_argument("--in", dest="src", default=str(ROOT / "assets/brand/mark-1024.webp"))
    ap.add_argument("--out", dest="out", default=str(ROOT / "assets/brand/mark-deep-1024.webp"))
    ap.add_argument("--v", type=float, default=0.72, help="明度倍数（越小越深），默认 0.72")
    ap.add_argument("--s", type=float, default=1.06, help="饱和度倍数，默认 1.06")
    ap.add_argument("--dh", type=int, default=6, help="色相偏移（正数偏蓝），默认 +6")
    ap.add_argument("--h-lo", type=int, default=112, help="色相下界（HSV 0~255），默认 112")
    ap.add_argument("--h-hi", type=int, default=175, help="色相上界，默认 175")
    ap.add_argument("--v-min", type=int, default=105, help="明度门槛：低于它的不碰（保住夜空），默认 105")
    ap.add_argument("--s-min", type=int, default=45, help="饱和度门槛：低于它的不碰（保住白巾与肤色），默认 45")
    ap.add_argument("--feather", type=float, default=3.0, help="遮罩羽化半径，默认 3")
    ap.add_argument("--palette-from", default=None, help="参考图路径：改用「吸色号 + 分位匹配」模式")
    ap.add_argument("--palette-rects", default="",
                    help='参考图上取头发的矩形，形如 "70,300,130,320;250,95,90,95"')
    ap.add_argument("--strength", type=float, default=1.0,
                    help="配色迁移强度 0~1，默认 1.0（完全采用参考图色调）")
    args = ap.parse_args()

    src = Path(args.src)
    if not src.exists():
        print(f"找不到输入：{src}")
        return 1

    if args.palette_from:
        rects = []
        for part in args.palette_rects.split(";"):
            part = part.strip()
            if not part:
                continue
            nums = [int(float(t)) for t in part.replace("，", ",").split(",")]
            if len(nums) != 4:
                print(f"矩形格式不对：{part}（应为 x,y,w,h）")
                return 2
            rects.append(tuple(nums))
        if not rects:
            print("--palette-from 需要同时给 --palette-rects")
            return 2

        size, touched, st = recolor_palette(
            src, Path(args.out), Path(args.palette_from), rects,
            args.h_lo, args.h_hi, args.v_min, args.s_min, args.feather, args.strength)

        h_our, s_our, v_our = st["hsv_our"]
        h_ref, s_ref, v_ref = st["hsv_ref"]
        print(f"已写出 {args.out}  {size}×{size}  {Path(args.out).stat().st_size / 1024:.1f} KB")
        print(f"  遮罩覆盖 {touched*100:.1f}% 的像素；样本：本图 {st['ours']} 像素 / 参考图 {st['theirs']} 像素")
        print(f"  头发中位色：本图 {hexof(st['median_our'])}  →  参考图 {hexof(st['median_ref'])}")
        print(f"  参考图头发 HSV 中位：H {h_ref:.3f}  S {s_ref:.3f}  V {v_ref:.3f}")
        print(f"  本图头发   HSV 中位：H {h_our:.3f}  S {s_our:.3f}  V {v_our:.3f}")
        print(f"  施加的变换：色相 {st['dh255']:+d}（0~255 标度）  饱和 ×{st['ks']:.3f}  明度 ×{st['kv']:.3f}"
              f"   [强度 {args.strength}]")
        return 0

    size, touched = recolor(src, Path(args.out), args.v, args.s, args.dh,
                            args.h_lo, args.h_hi, args.v_min, args.s_min, args.feather)
    print(f"已写出 {args.out}  {size}×{size}  {Path(args.out).stat().st_size / 1024:.1f} KB")
    print(f"  参数：明度×{args.v}  饱和×{args.s}  色相{args.dh:+d}  遮罩覆盖 {touched*100:.1f}% 的像素")
    if touched < 0.005:
        print("  ⚠ 覆盖不到 0.5%，阈值可能挑错了——检查 --h-lo/--h-hi/--v-min")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
