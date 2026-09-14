"""
Генерация тематических изображений для демо-сайта спа-салона.

Фотостоки из этой среды недоступны (egress-политика), поэтому картинки
рисуются кодом: мягкий свет, простые формы, приглушённая природная палитра —
та же, что у темы «Эвкалипт и песок». Это не фотографии, а стилизованные
иллюстрации; в реальном проекте на их место загружаются снимки салона.

Запуск из корня проекта:  python3 tools/gen_photos.py
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "photos")

S = 2                      # супердискретизация: рисуем вдвое крупнее и сжимаем
W, H = 900, 1200           # итоговый размер фото (3:4 — под плитки галереи)
CW, CH = W * S, H * S      # размер холста; меняется через size()

SAGE   = "#6f9b8b"
MOSS   = "#3f5c4f"
DEEP   = "#16281f"
WATER  = "#8fb0c4"
SAND   = "#e6cdae"
CLAY   = "#c98f76"
CREAM  = "#f3ede3"
LINEN  = "#faf6f0"
WOOD   = "#a97f5c"
AMBER  = "#f0b46a"


def size(w, h):
    """Холст под конкретный кадр (галерея — 3:4, аватар — квадрат)."""
    global W, H, CW, CH
    W, H = w, h
    CW, CH = w * S, h * S


def hx(c):
    c = c.lstrip("#")
    return np.array([int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def solid(c):
    return np.tile(hx(c), (CH, CW, 1)).astype(np.float32)


def lin(c0, c1, angle=90, lo=0.0, hi=1.0):
    """Линейный градиент. angle: 90 — сверху вниз, 0 — слева направо."""
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    a = math.radians(angle)
    t = (xx / CW) * math.cos(a) + (yy / CH) * math.sin(a)
    t = np.clip((t - lo) / (hi - lo), 0, 1)[..., None]
    return (hx(c0) * (1 - t) + hx(c1) * t).astype(np.float32)


def draw_mask(fn):
    """Рисуем фигуру в маске: fn получает ImageDraw и заливает белым."""
    img = Image.new("L", (CW, CH), 0)
    fn(ImageDraw.Draw(img))
    return img


def m2np(img, blur=0):
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return (np.asarray(img, dtype=np.float32) / 255)[..., None]


def over(base, m, col):
    col = col if isinstance(col, np.ndarray) else solid(col)
    return base * (1 - m) + col * m


def shadow(base, mimg, dx=0, dy=18, rad=26, alpha=0.30, col="#000000"):
    """Мягкая тень от маски: сдвигаем, размываем, кладём под объект."""
    sh = mimg.transform(mimg.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy))
    return over(base, m2np(sh, rad) * alpha, col)


def radial(cx, cy, rx, ry, power=2.0):
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip(1 - d, 0, 1)[..., None] ** power


def glow(base, cx, cy, rx, ry, col, strength=0.5, power=2.0):
    """Свет складывается с картинкой, а не закрашивает её."""
    return np.clip(base + radial(cx, cy, rx, ry, power) * strength * hx(col), 0, 1)


def add(base, m, col, k=1.0):
    return np.clip(base + m * hx(col) * k, 0, 1)


def leaf(x, y, length, width, angle, curve=0.0):
    """Точки листа: две дуги, сходящиеся в кончиках."""
    pts, a = [], math.radians(angle)
    for side in (1, -1):
        rng = np.linspace(0, 1, 30) if side == 1 else np.linspace(1, 0, 30)
        for t in rng:
            w = side * math.sin(math.pi * t) * width / 2
            pts.append((t * length, w + curve * math.sin(math.pi * t) * length))
    return [(x + px * math.cos(a) - py * math.sin(a), y + px * math.sin(a) + py * math.cos(a)) for px, py in pts]


def bezier(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1])
            for t in np.linspace(0, 1, n)]


def sprig(img, p0, p1, p2, n=7, ln=150, wd=72, col0="#8fae9c", col1="#4f6d5d", thick=7):
    """Ветка эвкалипта: изогнутый стебель и листья по сторонам."""
    curve = bezier(p0, p1, p2, 60)
    stem = draw_mask(lambda d: d.line(curve, fill=255, width=thick, joint="curve"))
    img = over(img, m2np(stem, 1.0), MOSS)
    for i in range(n):
        t = 0.10 + 0.86 * i / max(n - 1, 1)
        idx = int(t * (len(curve) - 1))
        lx, ly = curve[idx]
        dx = curve[min(idx + 3, len(curve) - 1)][0] - curve[max(idx - 3, 0)][0]
        dy = curve[min(idx + 3, len(curve) - 1)][1] - curve[max(idx - 3, 0)][1]
        base_ang = math.degrees(math.atan2(dy, dx))
        side = 1 if i % 2 else -1
        pts = leaf(lx, ly, ln * (1 - 0.06 * i), wd * (1 - 0.05 * i), base_ang + side * 52)
        lm = draw_mask(lambda d, p=pts: d.polygon(p, fill=255))
        img = shadow(img, lm, dx=5, dy=9, rad=13, alpha=0.14)
        img = over(img, m2np(lm, 1.0), lin(col0, col1, angle=70))
    return img


def rot_mask(fn, angle, center):
    """Маска фигуры, повёрнутой вокруг точки: для наклонных спинок и полок."""
    img = Image.new("L", (CW, CH), 0)
    fn(ImageDraw.Draw(img))
    return img.rotate(angle, resample=Image.BICUBIC, center=center)


def grain(img, amount=0.010, seed=7):
    n = np.random.default_rng(seed).normal(0, amount, img.shape[:2])[..., None]
    return np.clip(img + n, 0, 1)


def vignette(img, strength=0.22):
    return np.clip(img * (1 - strength + strength * radial(CW / 2, CH / 2, CW * 0.85, CH * 0.85, 1.5)), 0, 1)


def finish(img, seed=7, vig=0.22):
    return grain(vignette(img, vig), seed=seed)


def save(img, name, q=86):
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    im.save(os.path.join(OUT, name), quality=q, optimize=True, progressive=True)
    return name


# ---------------------------------------------------------------- сцены

def stones():
    """Стоун-терапия: стопка базальтовых камней и веточка эвкалипта."""
    img = lin(LINEN, SAND, angle=100)
    img = glow(img, CW * 0.40, CH * 0.14, CW * 0.95, CH * 0.8, "#fff6e8", 0.26, 1.9)

    cx = CW * 0.44
    sizes = [(340, 94), (292, 82), (244, 70), (196, 58), (150, 47)]
    y = CH * 0.85
    ys = []
    for i, (rx, ry) in enumerate(sizes):
        ys.append(y)
        if i + 1 < len(sizes):
            y -= (ry + sizes[i + 1][1]) * 0.78

    for (rx, ry), y in zip(sizes, ys):
        m = draw_mask(lambda d, y=y, rx=rx, ry=ry: d.ellipse([cx - rx, y - ry, cx + rx, y + ry], fill=255))
        img = shadow(img, m, dx=16, dy=22, rad=30, alpha=0.32)
        img = over(img, m2np(m, 1.2), lin("#626b68", "#202625", angle=90, lo=(y - ry) / CH, hi=(y + ry) / CH))
        hl = radial(cx - rx * 0.32, y - ry * 0.42, rx * 0.8, ry * 0.85, 2.3) * m2np(m) * 0.34
        img = add(img, hl, "#eaf2ef")

    img = sprig(img, (CW * 0.80, CH * 0.88), (CW * 0.99, CH * 0.66), (CW * 0.84, CH * 0.40))
    return finish(img, 3)


def candles():
    """Свечи: тёплый свет в полутьме."""
    img = lin("#2c3a32", DEEP, angle=90)
    img = glow(img, CW * 0.5, CH * 0.44, CW * 0.95, CH * 0.6, "#c98a4a", 0.28, 1.7)

    table = draw_mask(lambda d: d.rectangle([0, CH * 0.775, CW, CH], fill=255))
    img = over(img, m2np(table, 3), lin("#453529", "#1d1713", angle=90, lo=0.775))
    img = glow(img, CW * 0.5, CH * 0.86, CW * 0.6, CH * 0.16, "#b5793c", 0.30, 1.6)

    for cx, top, w in ((CW * 0.29, CH * 0.60, 150), (CW * 0.52, CH * 0.49, 180), (CW * 0.74, CH * 0.655, 132)):
        base = CH * 0.79
        body = draw_mask(lambda d, cx=cx, top=top, w=w, base=base: (
            d.rectangle([cx - w / 2, top, cx + w / 2, base], fill=255),
            d.ellipse([cx - w / 2, base - w * 0.22, cx + w / 2, base + w * 0.22], fill=255)))
        img = shadow(img, body, dx=22, dy=10, rad=26, alpha=0.5)
        img = over(img, m2np(body, 1.2), lin("#f8efe0", "#a98d70", angle=0, lo=(cx - w * 0.6) / CW, hi=(cx + w * 0.6) / CW))
        top_m = draw_mask(lambda d, cx=cx, top=top, w=w: d.ellipse([cx - w / 2, top - w * 0.2, cx + w / 2, top + w * 0.2], fill=255))
        img = over(img, m2np(top_m, 1.5), "#dcc8a8")
        wick = draw_mask(lambda d, cx=cx, top=top: d.line([(cx, top - 4), (cx, top - 32)], fill=255, width=6))
        img = over(img, m2np(wick, 1), "#3a2f26")
        img = glow(img, cx, top - 58, w * 2.7, w * 2.7, AMBER, 0.5, 1.9)
        fl = draw_mask(lambda d, cx=cx, top=top: d.polygon(leaf(cx, top - 28, 94, 44, -90), fill=255))
        img = add(img, m2np(fl, 4), "#ffdca8", 0.95)
    return finish(img, 11, 0.3)


def room():
    """Массажный кабинет: стол, свёрнутое полотенце, растение, тёплый торшер."""
    img = lin("#5d7a6d", "#33493f", angle=90)
    img = glow(img, CW * 0.20, CH * 0.18, CW * 0.8, CH * 0.85, "#e8d9b8", 0.20, 1.6)

    floor = draw_mask(lambda d: d.rectangle([0, CH * 0.72, CW, CH], fill=255))
    img = over(img, m2np(floor, 3), lin("#8a6a4c", "#4a3626", angle=90, lo=0.72))

    # растение в кашпо — за столом, но выше его
    px, py = CW * 0.885, CH * 0.755
    for ang, ln, wd in ((-92, 700, 240), (-66, 615, 215), (-118, 575, 205),
                        (-45, 480, 178), (-140, 455, 170), (-84, 380, 158)):
        pts = leaf(px, py - 150, ln, wd, ang, curve=0.05)
        lm = draw_mask(lambda d, p=pts: d.polygon(p, fill=255))
        img = over(img, m2np(lm, 1.0), lin("#a8c9b1", "#3d6350", angle=80))
    pot = draw_mask(lambda d: d.polygon(
        [(px - 118, py - 160), (px + 118, py - 160), (px + 88, py), (px - 88, py)], fill=255))
    img = shadow(img, pot, dx=10, dy=16, rad=22, alpha=0.30)
    img = over(img, m2np(pot, 1.2), lin("#dcc6ad", "#95795f", angle=0, lo=0.78, hi=1.0))

    # стол
    tx0, tx1, ty = CW * 0.08, CW * 0.80, CH * 0.62
    th = CH * 0.085
    for lx in (tx0 + CW * 0.09, tx1 - CW * 0.09):
        lm = draw_mask(lambda d, lx=lx: d.rectangle([lx - 16, ty + th, lx + 16, CH * 0.80], fill=255))
        img = over(img, m2np(lm, 1.2), "#4e3826")
    top = draw_mask(lambda d: d.rounded_rectangle([tx0, ty, tx1, ty + th], radius=th * 0.42, fill=255))
    img = shadow(img, top, dx=0, dy=34, rad=40, alpha=0.32)
    img = over(img, m2np(top, 1.2), lin("#fdfaf4", "#d9cdbb", angle=90, lo=0.62, hi=0.71))
    fold = draw_mask(lambda d: d.line([(tx0 + 30, ty + th * 0.62), (tx1 - 30, ty + th * 0.52)], fill=255, width=5))
    img = over(img, m2np(fold, 2.5), "#cfc3b0")

    roll = draw_mask(lambda d: d.ellipse([CW * 0.56, ty - 62, CW * 0.74, ty + 6], fill=255))
    img = shadow(img, roll, dx=6, dy=12, rad=16, alpha=0.25)
    img = over(img, m2np(roll, 1.2), lin("#ffffff", "#cfc4b2", angle=90, lo=0.50, hi=0.63))

    # торшер слева: стойка, абажур, свет
    lx = CW * 0.13
    stand = draw_mask(lambda d: (
        d.rectangle([lx - 9, CH * 0.42, lx + 9, CH * 0.79], fill=255),
        d.ellipse([lx - 78, CH * 0.775, lx + 78, CH * 0.805], fill=255)))
    img = over(img, m2np(stand, 1.2), "#4a3a2c")
    shade = draw_mask(lambda d: d.polygon(
        [(lx - 108, CH * 0.42), (lx + 108, CH * 0.42), (lx + 76, CH * 0.325), (lx - 76, CH * 0.325)], fill=255))
    img = shadow(img, shade, dx=8, dy=12, rad=18, alpha=0.28)
    img = over(img, m2np(shade, 1.2), lin("#f6e6c6", "#d2b184", angle=0, lo=0.02, hi=0.24))
    img = glow(img, lx, CH * 0.44, CW * 0.42, CH * 0.30, "#f0c079", 0.5, 1.8)
    return finish(img, 21)


def hammam():
    """Хаммам: арочная ниша, скамья, лёгкий пар."""
    img = lin("#2f6272", "#123540", angle=90)
    for i in range(1, 9):
        gy = CH * i / 9
        gm = draw_mask(lambda d, gy=gy: d.line([(0, gy), (CW, gy)], fill=80, width=3))
        img = over(img, m2np(gm, 1), "#0d2a33")
    for i in range(1, 7):
        gx = CW * i / 7
        gm = draw_mask(lambda d, gx=gx: d.line([(gx, 0), (gx, CH * 0.95)], fill=70, width=3))
        img = over(img, m2np(gm, 1), "#0d2a33")

    ax0, ax1 = CW * 0.20, CW * 0.80
    ay0, ay1 = CH * 0.16, CH * 0.84
    r = (ax1 - ax0) / 2
    arch = draw_mask(lambda d: (
        d.pieslice([ax0, ay0, ax1, ay0 + 2 * r], 180, 360, fill=255),
        d.rectangle([ax0, ay0 + r, ax1, ay1], fill=255)))
    img = shadow(img, arch, dx=0, dy=0, rad=50, alpha=0.5, col="#04161c")
    img = over(img, m2np(arch, 1.5), lin("#dfe9e8", "#7e9da0", angle=90, lo=0.14, hi=0.86))

    am = m2np(arch)                      # плитка внутри ниши
    for i in range(1, 12):
        gy = ay0 + (ay1 - ay0) * i / 12
        gm = draw_mask(lambda d, gy=gy: d.line([(ax0, gy), (ax1, gy)], fill=255, width=3))
        img = over(img, m2np(gm, 1) * am * 0.35, "#6d8e92")
    for i in range(1, 6):
        gx = ax0 + (ax1 - ax0) * i / 6
        gm = draw_mask(lambda d, gx=gx: d.line([(gx, ay0), (gx, ay1)], fill=255, width=3))
        img = over(img, m2np(gm, 1) * am * 0.35, "#6d8e92")
    img = glow(img, CW * 0.5, CH * 0.30, CW * 0.26, CH * 0.24, "#ffffff", 0.22, 2.2)

    bench = draw_mask(lambda d: d.rounded_rectangle([ax0 + 24, ay1 - 200, ax1 - 24, ay1 - 70], radius=24, fill=255))
    img = shadow(img, bench, dx=0, dy=22, rad=26, alpha=0.40)
    img = over(img, m2np(bench, 1.2), lin("#a9bab8", "#57696a", angle=90, lo=0.66, hi=0.78))

    bowl = draw_mask(lambda d: d.ellipse([CW * 0.42, ay1 - 300, CW * 0.58, ay1 - 206], fill=255))
    img = shadow(img, bowl, dx=6, dy=10, rad=14, alpha=0.30)
    img = over(img, m2np(bowl, 1.2), lin("#dcbc8d", "#8d6b47", angle=90, lo=0.56, hi=0.66))

    rng = np.random.default_rng(5)
    for _ in range(7):
        sx = rng.uniform(CW * 0.22, CW * 0.78)
        sy = rng.uniform(CH * 0.10, CH * 0.40)
        rr = rng.uniform(CW * 0.10, CW * 0.20)
        sm = draw_mask(lambda d, sx=sx, sy=sy, rr=rr: d.ellipse([sx - rr, sy - rr * 0.55, sx + rr, sy + rr * 0.55], fill=255))
        img = add(img, m2np(sm, 80), "#eaf6f8", rng.uniform(0.06, 0.12))
    return finish(img, 31)


def salt():
    """Соляная комната: подсвеченная стена из соляных блоков и шезлонг."""
    img = solid("#2a1c14")
    cols, rows = 6, 9
    bw, bh = CW / cols, CH * 0.78 / rows
    rng = np.random.default_rng(9)
    for r in range(rows):
        for c in range(cols):
            x, y = c * bw, r * bh
            m = draw_mask(lambda d, x=x, y=y: d.rounded_rectangle(
                [x + 6, y + 6, x + bw - 6, y + bh - 6], radius=14, fill=255))
            tone = rng.uniform(0.75, 1.0)
            img = over(img, m2np(m, 2.5), lin("#f7c98d", "#d98f4e", angle=110) * tone)
            img = add(img, m2np(m, 26) * rng.uniform(0.10, 0.24), "#ffb86b")
    img = glow(img, CW * 0.5, CH * 0.32, CW * 0.85, CH * 0.6, "#ffae5c", 0.28, 1.5)

    floor = draw_mask(lambda d: d.rectangle([0, CH * 0.78, CW, CH], fill=255))
    img = over(img, m2np(floor, 3), lin("#6a4a33", "#2a1b12", angle=90, lo=0.78))

    # шезлонг: один силуэт в профиль — по частям он читается как палки
    P = [(CW * 0.17, CH * 0.865), (CW * 0.215, CH * 0.70), (CW * 0.25, CH * 0.672),
         (CW * 0.30, CH * 0.678), (CW * 0.335, CH * 0.712), (CW * 0.40, CH * 0.812),
         (CW * 0.84, CH * 0.818), (CW * 0.875, CH * 0.836), (CW * 0.875, CH * 0.865)]
    chair = draw_mask(lambda d: d.polygon(P, fill=255))
    img = shadow(img, chair, dx=0, dy=22, rad=30, alpha=0.45)
    img = over(img, m2np(chair, 1.6), lin("#efdfc6", "#9e7f5f", angle=70, lo=0.15, hi=0.9))
    seam = draw_mask(lambda d: d.line([(CW * 0.42, CH * 0.822), (CW * 0.84, CH * 0.827)], fill=255, width=4))
    img = over(img, m2np(seam, 1.6), "#b89a77")
    cushion = draw_mask(lambda d: d.ellipse([CW * 0.24, CH * 0.688, CW * 0.40, CH * 0.742], fill=255))
    img = shadow(img, cushion, dx=4, dy=8, rad=12, alpha=0.24)
    img = over(img, m2np(cushion, 1.4), lin("#ffffff", "#cdb99b", angle=90, lo=0.68, hi=0.75))
    for lx in (CW * 0.24, CW * 0.80):
        lm = draw_mask(lambda d, lx=lx: d.rectangle([lx - 11, CH * 0.855, lx + 11, CH * 0.945], fill=255))
        img = over(img, m2np(lm, 1.2), "#3d2a1d")
    towel = draw_mask(lambda d: d.rounded_rectangle(
        [CW * 0.52, CH * 0.782, CW * 0.74, CH * 0.822], radius=18, fill=255))
    img = over(img, m2np(towel, 1.3), lin("#ffffff", "#cbb99e", angle=90, lo=0.78, hi=0.83))
    return finish(img, 41, 0.3)


def reception():
    """Приёмная: рейки на стене, стойка, ваза с веткой."""
    img = lin("#efe6d8", "#d9c7ae", angle=90)
    for i in range(14):            # рейки
        x = CW * (0.02 + i * 0.07)
        m = draw_mask(lambda d, x=x: d.rectangle([x, 0, x + CW * 0.045, CH * 0.70], fill=255))
        img = over(img, m2np(m, 1.2), lin("#c79b71", "#8a6446", angle=0, lo=x / CW - 0.03, hi=x / CW + 0.06))
    img = glow(img, CW * 0.5, CH * 0.06, CW * 0.8, CH * 0.5, "#fff2da", 0.35, 1.7)

    top = draw_mask(lambda d: d.rounded_rectangle([CW * 0.02, CH * 0.70, CW * 0.98, CH * 0.775], radius=18, fill=255))
    front = draw_mask(lambda d: d.rectangle([CW * 0.05, CH * 0.775, CW * 0.95, CH], fill=255))
    img = shadow(img, top, dx=0, dy=26, rad=34, alpha=0.30)
    img = over(img, m2np(front, 1.5), lin("#e4d6c1", "#b49a7d", angle=90, lo=0.77, hi=1.0))
    img = over(img, m2np(top, 1.2), lin("#fbf5ea", "#d9cab4", angle=90, lo=0.70, hi=0.78))

    vx, vy = CW * 0.72, CH * 0.70
    vase = draw_mask(lambda d: (
        d.ellipse([vx - 118, vy - 250, vx + 118, vy - 14], fill=255),
        d.rectangle([vx - 42, vy - 360, vx + 42, vy - 140], fill=255)))
    img = shadow(img, vase, dx=14, dy=14, rad=20, alpha=0.25)
    img = over(img, m2np(vase, 1.2), lin("#f4ece0", "#b9a690", angle=0, lo=0.66, hi=0.80))
    img = sprig(img, (vx, vy - 300), (vx - CW * 0.10, CH * 0.42), (vx - CW * 0.02, CH * 0.20), n=6, ln=140, wd=66)

    # два свёрнутых полотенца и свеча на стойке
    for cx in (CW * 0.20, CW * 0.31):
        cy, r = CH * 0.665, 58
        m = draw_mask(lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255))
        img = shadow(img, m, dx=5, dy=9, rad=12, alpha=0.22)
        img = over(img, m2np(m, 1.2), lin("#ffffff", "#d3c7b3", angle=110, lo=(cy - r) / CH, hi=(cy + r) / CH))
        sp = [(cx + math.cos(t) * (r * 0.66 - t * 5), cy + math.sin(t) * (r * 0.66 - t * 5))
              for t in np.linspace(0, 5.6, 70)]
        sm = draw_mask(lambda d, p=sp: d.line(p, fill=255, width=4, joint="curve"))
        img = over(img, m2np(sm, 1.2), "#cdc1ad")
    cx2 = CW * 0.42
    cm = draw_mask(lambda d: (
        d.rectangle([cx2 - 34, CH * 0.60, cx2 + 34, CH * 0.702], fill=255),
        d.ellipse([cx2 - 34, CH * 0.592, cx2 + 34, CH * 0.609], fill=255)))
    img = shadow(img, cm, dx=7, dy=8, rad=12, alpha=0.22)
    img = over(img, m2np(cm, 1.2), lin("#fbf3e6", "#c9b498", angle=0, lo=0.39, hi=0.46))
    img = glow(img, cx2, CH * 0.575, CW * 0.16, CH * 0.12, AMBER, 0.45, 1.9)
    fm = draw_mask(lambda d: d.polygon(leaf(cx2, CH * 0.578, 52, 26, -90), fill=255))
    img = add(img, m2np(fm, 3), "#ffdca8", 0.9)
    return finish(img, 51)


def towels():
    """Свёрнутые полотенца на подносе и веточка."""
    img = lin(LINEN, "#e4d6c2", angle=100)
    img = glow(img, CW * 0.35, CH * 0.12, CW * 0.9, CH * 0.8, "#ffffff", 0.25, 1.9)

    tray = draw_mask(lambda d: d.rounded_rectangle([CW * 0.08, CH * 0.58, CW * 0.92, CH * 0.80], radius=30, fill=255))
    img = shadow(img, tray, dx=0, dy=26, rad=32, alpha=0.26)
    img = over(img, m2np(tray, 1.2), lin("#c69a70", "#8a6343", angle=90, lo=0.58, hi=0.80))

    for i, cx in enumerate((CW * 0.26, CW * 0.50, CW * 0.74)):
        cy, r = CH * 0.60, 118
        m = draw_mask(lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255))
        img = shadow(img, m, dx=8, dy=16, rad=20, alpha=0.24)
        img = over(img, m2np(m, 1.2), lin("#ffffff", "#cdc0ae", angle=110, lo=(cy - r) / CH, hi=(cy + r) / CH))
        spiral = [(cx + math.cos(t) * (r * 0.72 - t * 9), cy + math.sin(t) * (r * 0.72 - t * 9))
                  for t in np.linspace(0, 6.0, 90)]
        sm = draw_mask(lambda d, p=spiral: d.line(p, fill=255, width=6, joint="curve"))
        img = over(img, m2np(sm, 1.4), "#c9bda9")

    img = sprig(img, (CW * 0.14, CH * 0.90), (CW * 0.34, CH * 0.90), (CW * 0.52, CH * 0.87),
                n=6, ln=132, wd=62)
    return finish(img, 61)


def water():
    """Купель: круги на воде и плавающий лист."""
    img = lin("#7fa8bd", "#26506b", angle=90)
    cx, cy = CW * 0.46, CH * 0.44
    for i, r in enumerate(np.linspace(90, CW * 0.95, 11)):
        m = draw_mask(lambda d, r=r: d.ellipse([cx - r, cy - r * 0.42, cx + r, cy + r * 0.42], fill=255, outline=None))
        ring = draw_mask(lambda d, r=r: d.ellipse([cx - r, cy - r * 0.42, cx + r, cy + r * 0.42], outline=255, width=14))
        img = add(img, m2np(ring, 7), "#ffffff", 0.16 * (1 - i / 12))
        img = over(img, m2np(ring, 12) * 0.10 * (1 - i / 12), "#0f3348")
    img = glow(img, CW * 0.7, CH * 0.12, CW * 0.7, CH * 0.5, "#dff0f5", 0.3, 1.8)

    pts = leaf(CW * 0.16, CH * 0.76, 520, 235, -14, curve=0.05)
    lm = draw_mask(lambda d: d.polygon(pts, fill=255))
    img = shadow(img, lm, dx=10, dy=16, rad=22, alpha=0.22)
    img = over(img, m2np(lm, 1.2), lin("#9cc4ab", "#2f5b45", angle=60))
    return finish(img, 71)


def tea():
    """Чайная пауза после процедуры."""
    img = lin("#f3ece1", "#dcc9ad", angle=95)
    img = glow(img, CW * 0.60, CH * 0.14, CW * 0.85, CH * 0.75, "#fff6e6", 0.28, 1.8)

    sx, sy = CW * 0.47, CH * 0.76
    saucer = draw_mask(lambda d: d.ellipse([sx - 300, sy - 66, sx + 300, sy + 66], fill=255))
    img = shadow(img, saucer, dx=10, dy=20, rad=26, alpha=0.24)
    img = over(img, m2np(saucer, 1.2), lin("#ffffff", "#cfc2ad", angle=90, lo=0.70, hi=0.82))

    cup = draw_mask(lambda d: (
        d.polygon([(sx - 132, sy - 62), (sx + 132, sy - 62), (sx + 172, sy - 250), (sx - 172, sy - 250)], fill=255),
        d.ellipse([sx - 172, sy - 284, sx + 172, sy - 216], fill=255)))
    img = shadow(img, cup, dx=12, dy=10, rad=18, alpha=0.22)
    img = over(img, m2np(cup, 1.2), lin("#ffffff", "#cbbca6", angle=0, lo=0.30, hi=0.66))
    inner = draw_mask(lambda d: d.ellipse([sx - 150, sy - 274, sx + 150, sy - 226], fill=255))
    img = over(img, m2np(inner, 1.5), lin("#b98a4e", "#7a5228", angle=90, lo=0.60, hi=0.66))

    for dx0 in (-70, 0, 70):        # пар
        pts = bezier((sx + dx0, sy - 272), (sx + dx0 + 90, sy - 400), (sx + dx0 - 30, sy - 540), 40)
        sm = draw_mask(lambda d, p=pts: d.line(p, fill=255, width=16, joint="curve"))
        img = add(img, m2np(sm, 26), "#ffffff", 0.42)

    img = sprig(img, (CW * 0.80, CH * 0.88), (CW * 0.98, CH * 0.70), (CW * 0.86, CH * 0.50), n=5, ln=126, wd=60)
    return finish(img, 81)


def avatar():
    """Квадратный кадр для круглой аватарки в блоке «о салоне»."""
    size(720, 720)
    img = lin("#9ec0ae", "#456b5a", angle=120)
    img = glow(img, CW * 0.3, CH * 0.2, CW * 0.9, CH * 0.9, "#f2f7f0", 0.3, 1.8)
    pts = leaf(CW * 0.16, CH * 0.80, CW * 0.86, CH * 0.44, -38, curve=0.05)
    lm = draw_mask(lambda d: d.polygon(pts, fill=255))
    img = shadow(img, lm, dx=12, dy=18, rad=26, alpha=0.22)
    img = over(img, m2np(lm, 1.2), lin("#a8cbb4", "#2f5544", angle=60))
    vein = draw_mask(lambda d: d.line(bezier((CW * 0.18, CH * 0.78), (CW * 0.5, CH * 0.5), (CW * 0.84, CH * 0.24), 30),
                                      fill=255, width=6, joint="curve"))
    img = add(img, m2np(vein, 2), "#dff0e4", 0.3)
    rng = np.random.default_rng(3)
    for _ in range(9):             # капли
        dx0, dy0 = rng.uniform(CW * 0.25, CW * 0.75), rng.uniform(CH * 0.30, CH * 0.70)
        r = rng.uniform(14, 34)
        dm = draw_mask(lambda d, dx0=dx0, dy0=dy0, r=r: d.ellipse([dx0 - r, dy0 - r, dx0 + r, dy0 + r], fill=255))
        img = shadow(img, dm, dx=3, dy=5, rad=7, alpha=0.20)
        img = add(img, m2np(dm, 1.5) * 0.30, "#ffffff")
        hl = draw_mask(lambda d, dx0=dx0, dy0=dy0, r=r: d.ellipse(
            [dx0 - r * 0.4, dy0 - r * 0.55, dx0 - r * 0.02, dy0 - r * 0.15], fill=255))
        img = add(img, m2np(hl, 2), "#ffffff", 0.75)
    return finish(img, 91, 0.18)


SCENES = [(stones, "stones.jpg"), (candles, "candles.jpg"), (room, "room.jpg"),
          (hammam, "hammam.jpg"), (salt, "salt.jpg"), (reception, "reception.jpg"),
          (towels, "towels.jpg"), (water, "water.jpg"), (tea, "tea.jpg")]

if __name__ == "__main__":
    for fn, name in SCENES:
        size(900, 1200)
        print(save(fn(), name))
    print(save(avatar(), "about.jpg"))
