#!/usr/bin/env python3
"""Deterministic metadata/palette extraction for Wufan evidence. Originals are never modified."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json

ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "sources/screenshots/original"
OUT = ROOT / "evidence/measurements"
OUT.mkdir(parents=True, exist_ok=True)

palette_targets = {
    "dark/app__dark__3188x1936__new-task-default__01.png",
    "light/app__light__3188x1948__chat-default__01.png",
    "light/app__light__860x1292__whats-new-default__01.png",
    "dark/homepage__dark__1440x900__default__01__viewport.png",
    "dark/login__dark__1440x900__default__01__viewport.png",
    "light/login__light__1440x900__default__01__viewport.png",
}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def palette(image: Image.Image, count=16):
    rgb = image.convert("RGB")
    rgb.thumbnail((512, 512), Image.Resampling.LANCZOS)
    q = rgb.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    colors = sorted(q.getcolors() or [], reverse=True)
    raw = q.getpalette()
    total = sum(n for n, _ in colors)
    out = []
    for n, idx in colors:
        r, g, b = raw[idx * 3:idx * 3 + 3]
        out.append({"hex": f"#{r:02X}{g:02X}{b:02X}", "share": round(n / total, 6)})
    return out

records = []
for p in sorted(SOURCE_ROOT.rglob("*.png")):
    rel = p.relative_to(SOURCE_ROOT).as_posix()
    with Image.open(p) as im:
        rec = {
            "path": f"sources/screenshots/original/{rel}",
            "sha256": sha256(p),
            "format": im.format,
            "mode": im.mode,
            "width": im.width,
            "height": im.height,
            "iccProfilePresent": bool(im.info.get("icc_profile")),
            "exifPresent": bool(im.getexif()),
        }
        if rel in palette_targets:
            rec["quantizedPalette"] = palette(im)
            swatches = rec["quantizedPalette"]
            canvas = Image.new("RGB", (640, 64), "white")
            draw = ImageDraw.Draw(canvas)
            x = 0
            for i, item in enumerate(swatches):
                next_x = 640 if i == len(swatches) - 1 else x + round(item["share"] * 640)
                draw.rectangle((x, 0, max(x, next_x - 1), 63), fill=item["hex"])
                x = next_x
            safe = rel.replace("/", "__").removesuffix(".png")
            canvas.save(OUT / f"palette__{safe}.png")
        records.append(rec)

# Reproducible representative crops from user originals.
crops = [
    ("dark/app__dark__3188x1936__new-task-default__01.png", "dark/crops/EVD-001__SRC-002__sidebar.png", (0, 0, 492, 1936)),
    ("dark/app__dark__3188x1936__new-task-default__01.png", "dark/crops/EVD-002__SRC-002__composer.png", (1035, 744, 2645, 1015)),
    ("light/app__light__3188x1948__chat-default__01.png", "light/crops/EVD-003__SRC-003__sidebar.png", (0, 0, 492, 1948)),
    ("light/app__light__3188x1948__chat-default__01.png", "light/crops/EVD-004__SRC-003__agent-message.png", (875, 225, 2640, 1490)),
    ("light/app__light__3188x1948__chat-default__01.png", "light/crops/EVD-005__SRC-003__composer.png", (1035, 1620, 2650, 1905)),
]
for src_rel, out_rel, box in crops:
    src = SOURCE_ROOT / src_rel
    dst = ROOT / "evidence" / out_rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im.crop(box).save(dst)

(OUT / "image-metadata.json").write_text(json.dumps({"images": records}, ensure_ascii=False, indent=2) + "\n")
print(f"analyzed {len(records)} images; generated {len(crops)} crops")
