"""Convierte los PNG renderizados (assets/render) en WebP livianos para el sitio (assets/img).

Uso: python3 tools/optimize-images.py   (requiere Pillow: pip install pillow)
"""
from pathlib import Path
from PIL import Image

SRC = Path('assets/render')
DST = Path('assets/img')
DST.mkdir(parents=True, exist_ok=True)

# nombre: (ancho final, calidad)
SIZES = {
    'hero': (1400, 84),
    'iluminacion': (1200, 80), 'clima': (1200, 80), 'seguridad': (1200, 80),
    'accesos': (1200, 80), 'cortinas': (1200, 80), 'riego': (1200, 80), 'cocina': (1200, 80),
    'amplia': (1800, 78), 'plano': (1400, 70),
}

for name, (width, quality) in SIZES.items():
    src = SRC / f'{name}.png'
    if not src.exists():
        continue
    im = Image.open(src)
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    im.save(DST / f'{name}.webp', 'WEBP', quality=quality, method=6)
    if name == 'amplia':
        # imagen para compartir en redes (1200x630)
        og = im.convert('RGB')
        s = 630 / og.height
        og = og.resize((round(og.width * s), 630), Image.LANCZOS)
        left = (og.width - 1200) // 2
        og.crop((left, 0, left + 1200, 630)).save(DST / 'og.jpg', 'JPEG', quality=82, optimize=True)
    print(name, (DST / f'{name}.webp').stat().st_size // 1024, 'KB')
