#!/usr/bin/env python3
"""Generate the PWA icon set from the master artwork.

Source of truth is assets/icon-master.png (512x512, square, artwork already
inset from the edges). Run `python3 scripts/make-icons.py` after replacing it.
Needs Pillow: `pip install pillow`.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets" / "icon-master.png"
OUT = ROOT / "public"

# Filled in behind the artwork wherever it must not be transparent (maskable
# icons, iOS home screen). Sampled from the master's darkest edge.
BACKDROP = (10, 36, 84)

# Corner radius of the master artwork, as a fraction of its width.
RADIUS = 0.17


def save(img: Image.Image, path: Path) -> None:
    """Write a palette-quantised PNG — roughly a tenth the size of full colour,
    with no visible banding on this artwork, and all of it precached by the
    service worker."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(
        path, optimize=True
    )


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    """Knock the square corners off, so the icon isn't a hard-edged box."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, img.width - 1, img.height - 1],
        radius=int(img.width * radius_ratio),
        fill=255,
    )
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def on_backdrop(img: Image.Image) -> Image.Image:
    """Flatten onto the backdrop — no transparency for iOS or maskable."""
    base = Image.new("RGBA", img.size, (*BACKDROP, 255))
    base.alpha_composite(img.convert("RGBA"))
    return base.convert("RGB")


def main() -> None:
    master = Image.open(MASTER).convert("RGB")
    (OUT / "icons").mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        save(
            rounded(master.resize((size, size), Image.LANCZOS), RADIUS),
            OUT / "icons" / f"icon-{size}.png",
        )

    # Maskable: launchers crop this to a circle, so it must bleed to the edges
    # with the logo inside the inner 80%. The master's own padding covers that,
    # so it fills the square with square corners over the backdrop.
    save(
        on_backdrop(master.resize((512, 512), Image.LANCZOS).convert("RGBA")),
        OUT / "icons" / "icon-512-maskable.png",
    )

    # iOS ignores transparency and applies its own corner mask.
    save(
        on_backdrop(master.resize((180, 180), Image.LANCZOS).convert("RGBA")),
        OUT / "apple-touch-icon.png",
    )

    # Browser tab.
    save(rounded(master.resize((32, 32), Image.LANCZOS), RADIUS), OUT / "favicon-32.png")
    master.resize((48, 48), Image.LANCZOS).save(
        OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            print(f"{p.relative_to(OUT)}  {p.stat().st_size:,}b")


if __name__ == "__main__":
    main()
