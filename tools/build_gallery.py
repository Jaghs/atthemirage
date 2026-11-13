"""Build the gallery from the photos in images/.

Put full-size photos straight into images/, named like:

    Road (Japan).jpg            -> title "Road", in the Japan tab
    Road (Tokyo, Japan).jpg     -> same tab, and the location reads "Tokyo, Japan"
    Road.jpg                    -> no tab; it only appears under "All"

The tab is whatever comes after the last comma in the brackets. For each photo
this makes two web-sized copies in images/gallery/ (with all hidden data, GPS
included, removed) and rewrites js/photos.js with the titles, tabs, dates and
camera settings. GitHub runs it on every push (see .github/workflows/site.yml);
the originals themselves are never published to the website.

Run it yourself with:  python tools/build_gallery.py   (needs: pip install pillow)
"""
import json
import os
import re
import sys
from datetime import datetime

from PIL import Image, ImageOps, ImageStat, ExifTags

try:  # iPhone .heic photos, if the extra package is installed
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'images')
OUT = os.path.join(SOURCE, 'gallery')
DATA = os.path.join(ROOT, 'js', 'photos.js')
TYPES = ('.jpg', '.jpeg', '.png', '.heic', '.webp')
TAGS = {v: k for k, v in ExifTags.TAGS.items()}
MONTHS = 'January February March April May June July August September October November December'.split()


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or 'photo'


def parse_name(filename):
    stem = os.path.splitext(filename)[0].strip()
    match = re.match(r'^(.*?)\s*\(([^()]+)\)\s*$', stem)
    if not match:
        return stem, None, None
    title, where = match.group(1).strip(), match.group(2).strip()
    group = where.split(',')[-1].strip()
    place = where if ',' in where else None
    return title or stem, group, place


def details(image):
    exif = image.getexif()
    sub = exif.get_ifd(0x8769)
    get = lambda name: sub.get(TAGS[name]) or exif.get(TAGS[name])
    info, taken = {}, None
    stamp = get('DateTimeOriginal') or get('DateTime')
    if stamp:
        try:
            taken = datetime.strptime(str(stamp)[:19], '%Y:%m:%d %H:%M:%S')
            info['date'] = f'{MONTHS[taken.month - 1]} {taken.year}'
        except ValueError:
            pass
    if exif.get(272):
        info['camera'] = str(exif.get(272)).strip().strip('\x00')
    settings = []
    if get('FNumber'):
        settings.append(f"f/{float(get('FNumber')):g}")
    if get('ExposureTime'):
        t = float(get('ExposureTime'))
        settings.append(f'1/{round(1 / t)} s' if t < 1 else f'{t:g} s')
    if get('ISOSpeedRatings'):
        settings.append(f"ISO {get('ISOSpeedRatings')}")
    if settings:
        info['settings'] = ' · '.join(settings)
    if get('FocalLength'):
        info['focal'] = f"{float(get('FocalLength')):.1f} mm".replace('.0 mm', ' mm')
    return info, taken


def save(image, path, long_edge):
    copy = image.copy()
    copy.thumbnail((long_edge, long_edge), Image.LANCZOS)
    # No exif is passed on, so the copy carries no hidden data (GPS included)
    copy.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    return copy.size


def is_colour(image):
    small = image.copy()
    small.thumbnail((200, 200))
    return ImageStat.Stat(small.convert('HSV')).mean[1] > 12


def spread(photos):
    """Order the photos so ones shot close together in the same place (like a set
    of portraits) never sit next to each other on the wall, which repeats them in
    a pattern where neighbours are 1, 6, 7 or 8 places apart."""
    n = len(photos)
    if n < 10:
        return photos
    gaps = {1, 6, 7, 8}

    def alike(a, b):
        if a.get('group') != b.get('group') or not a['_taken'] or not b['_taken']:
            return False
        return abs((a['_taken'] - b['_taken']).total_seconds()) < 6 * 3600

    order, left = [], list(photos)
    while left:
        i = len(order)
        near = [order[(i - g) % n] for g in gaps if i - g >= 0]
        near += [order[(i + g) % n] for g in gaps if (i + g) % n < len(order) and i + g >= n]
        pick = next((p for p in left if not any(alike(p, q) for q in near)), left[0])
        order.append(pick)
        left.remove(pick)
    return order


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(f for f in os.listdir(SOURCE)
                   if f.lower().endswith(TYPES) and os.path.isfile(os.path.join(SOURCE, f)))
    photos, used, made = [], set(), set()
    for filename in files:
        title, group, place = parse_name(filename)
        slug = slugify(title)
        while slug in used:
            slug += '-2'
        used.add(slug)
        original = Image.open(os.path.join(SOURCE, filename))
        info, taken = details(original)
        image = ImageOps.exif_transpose(original).convert('RGB')
        width, height = save(image, os.path.join(OUT, f'{slug}-900.jpg'), 1200)
        save(image, os.path.join(OUT, f'{slug}-1800.jpg'), 2000)
        made.update({f'{slug}-900.jpg', f'{slug}-1800.jpg'})
        entry = {'id': slug, 'title': title}
        if group:
            entry['group'] = group
        if place:
            entry['place'] = place
        entry.update(info)
        entry.update({'src': f'images/gallery/{slug}-900.jpg', 'large': f'images/gallery/{slug}-1800.jpg',
                      'width': width, 'height': height})
        if is_colour(image):
            entry['colour'] = True
        entry['_taken'] = taken
        photos.append(entry)
        print(f'  {filename}  ->  {title}' + (f'  [{group}]' if group else ''))

    photos.sort(key=lambda p: p['_taken'] or datetime.min, reverse=True)  # newest first
    photos = spread(photos)
    for p in photos:
        del p['_taken']

    # Remove web copies of photos that are no longer in images/
    for old in os.listdir(OUT):
        if old not in made:
            os.remove(os.path.join(OUT, old))

    with open(DATA, 'w', encoding='utf-8') as f:
        f.write('// Made by tools/build_gallery.py from the photos in images/ -- edits here are\n')
        f.write('// overwritten. To change a title or tab, rename the photo, e.g. "Road (Japan).jpg".\n')
        f.write('window.PHOTOS = ' + json.dumps(photos, indent=4, ensure_ascii=False) + ';\n')
    print(f'{len(photos)} photos in the gallery')


if __name__ == '__main__':
    sys.exit(main())
