"""Generate the app icons in app/icons/ (needs Pillow: pip install pillow).

Design: orange square, dark timer ring (3/4 full, like the run screen) and a
bold "B" for Burpees. Run from the repo root:  python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ORANGE = (242, 140, 0, 255)
INK = (27, 27, 31, 255)
TRACK = (27, 27, 31, 46)
OUT = Path(__file__).resolve().parent.parent / 'app' / 'icons'
FONTS = ['C:/Windows/Fonts/seguibl.ttf', 'C:/Windows/Fonts/arialbd.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']


def font(size):
    for path in FONTS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_icon(size, content_scale, rounded):
    """content_scale: how much of the square the ring uses (maskable icons need a safe zone)."""
    s = size * 4  # supersample, then shrink for smooth edges
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ORANGE)
    else:
        d.rectangle([0, 0, s, s], fill=ORANGE)

    ring = s * content_scale
    width = ring * 0.11
    box = [(s - ring) / 2 + width / 2, (s - ring) / 2 + width / 2,
           (s + ring) / 2 - width / 2, (s + ring) / 2 - width / 2]
    track = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(track).ellipse(box, outline=TRACK, width=int(width))
    img.alpha_composite(track)
    d = ImageDraw.Draw(img)
    d.arc(box, start=-90, end=180, fill=INK, width=int(width))
    # round caps at both ends of the arc (PIL strokes inside the box, so the
    # stroke's centre line is half a width in from the box edge)
    cx, cy = s / 2, s / 2
    r = (box[2] - box[0]) / 2 - width / 2
    for x, y in [(cx, cy - r), (cx - r, cy)]:
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=INK)

    f = font(int(ring * 0.5))
    d.text((cx, cy + ring * 0.01), 'B', font=f, fill=INK, anchor='mm')
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192, 0.72, rounded=True).save(OUT / 'icon-192.png')
    draw_icon(512, 0.72, rounded=True).save(OUT / 'icon-512.png')
    draw_icon(512, 0.58, rounded=False).save(OUT / 'icon-maskable-512.png')
    draw_icon(180, 0.66, rounded=False).convert('RGB').save(OUT / 'apple-touch-icon.png')
    draw_icon(64, 0.80, rounded=True).save(OUT / 'favicon-64.png')
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
