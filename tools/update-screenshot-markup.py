"""Apply the refreshed RuStore manifest to the portfolio and all product locales."""
from __future__ import annotations

from html import escape, unescape
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
ASSETS='<link rel="stylesheet" href="/assets/screenshot-loading.css?v=20261027-preview"><script src="/assets/screenshot-loading.js?v=20261027-preview" defer></script>'
IMAGE_RE=re.compile(r'<img\b[^>]*\bsrc="([^"]*/assets/screens/([^/]+)/[^/]+/(\d+)[^"/]*)"[^>]*>')


def render_image(old: str, screen: dict, *, catalog: bool, hero: bool) -> str:
    small,medium=screen['variants']
    srcset='' if catalog else ', '.join(f"{item['src']} {item['width']}w" for item in (small,medium))
    alt=re.search(r'\balt="([^"]*)"',old)
    alt=unescape(alt.group(1)) if alt else ''
    class_name=re.search(r'\bclass="([^"]*)"',old)
    classes=f' class="{class_name.group(1)}"' if class_name else ''
    is_front='fan-front' in classes
    # The catalog requests its small previews immediately, even far below the fold.
    loading='eager' if catalog or hero else 'lazy'
    priority='high' if hero and is_front else 'auto'
    if catalog:
        sizes=('(max-width:610px) 88vw, (max-width:980px) 46vw, 555px' if screen['width']>screen['height']
               else '(max-width:610px) 68vw, (max-width:980px) 34vw, 360px')
    else:
        sizes='(max-width:760px) 72vw, 320px'
    responsive=f' srcset="{srcset}" sizes="{sizes}"' if srcset else ''
    return (f'<img{classes} src="{small["src"]}"{responsive} '
            f'width="{screen["width"]}" height="{screen["height"]}" alt="{escape(alt,quote=True)}" '
            f'loading="{loading}" decoding="async" fetchpriority="{priority}" '
            f'data-store-screen="{screen["index"]}" data-screen-fallback="{small["src"]}">')


def main() -> None:
    manifest=json.loads((ROOT/'assets/screens/manifest.json').read_text(encoding='utf-8'))
    apps=manifest['apps']
    for path in [ROOT/'index.html', *ROOT.glob('apps/*/index.html'), *ROOT.glob('en/apps/*/index.html')]:
        source=path.read_text(encoding='utf-8')
        if '/assets/screens/' not in source:continue
        catalog=path==ROOT/'index.html'
        slug=None if catalog else path.parent.name
        if not catalog and slug not in apps:continue
        screens=None if catalog else apps[slug]['screens']
        if screens:
            # Include every screenshot currently published in the store, including new slides.
            gallery=re.search(r'(<div class="gallery"[^>]*>)(.*?)(</div>)',source,re.S)
            if gallery:
                sample=re.search(r'<figure\b[^>]*>.*?</figure>',gallery.group(2),re.S).group()
                old_count=len(re.findall(r'<figure\b',gallery.group(2)))
                count=len(screens)
                slides=[]
                for screen in screens:
                    number=screen['index']
                    item=re.sub(r'(/assets/screens/[^/]+/[^/]+/)\d+([^"/]*)',lambda m:m.group(1)+f'{number:02d}'+m.group(2),sample)
                    item=re.sub(r'(скриншот|screenshot) \d+ / \d+',lambda m:f'{m.group(1)} {number} / {count}',item,flags=re.I)
                    slides.append(item)
                source=source[:gallery.start(2)]+''.join(slides)+source[gallery.end(2):]
                source=re.sub(r'(data-carousel-count>)[^<]+',rf'\g<1>1 / {count}',source)
        def figure(match):
            chunk=re.sub(r'<a\b[^>]*class="screenshot-original"[^>]*>(.*?)</a>',r'\1',match.group(),flags=re.S)
            img=IMAGE_RE.search(chunk)
            if not img or img.group(2) not in apps:return chunk
            shots=apps[img.group(2)]['screens'];number=int(img.group(3))
            if not 1<=number<=len(shots):raise ValueError(f'No store screenshot {img.group(2)}/{number}')
            screen=shots[number-1]
            chunk=re.sub(r'\sdata-store-screen="[^"]*"','',chunk,count=1)
            chunk=re.sub(r'\sstyle="[^"]*"','',chunk,count=1)
            chunk=chunk.replace('<figure',f'<figure data-store-screen="{number}" style="--store-placeholder:url({screen["placeholder"]})"',1)
            image=render_image(img.group(),screen,catalog=catalog,hero=False)
            image=f'<a class="screenshot-original" href="{screen["original"]}" target="_blank" rel="noopener">{image}</a>'
            chunk=IMAGE_RE.sub(lambda _:image,chunk,count=1)
            return chunk
        source=re.sub(r'<figure\b[^>]*>.*?</figure>',figure,source,flags=re.S)
        def remaining_image(match):
            if 'data-store-screen=' in match.group() and 'fan-image' not in match.group():return match.group()
            key=match.group(2);number=int(match.group(3))
            if key not in apps or number>len(apps[key]['screens']):return match.group()
            return render_image(match.group(),apps[key]['screens'][number-1],catalog=catalog,hero=True)
        source=IMAGE_RE.sub(remaining_image,source)
        def original_url(match):
            key,number=match.group(2),int(match.group(3))
            if key not in apps or number>len(apps[key]['screens']):return match.group()
            return match.group(1)+apps[key]['screens'][number-1]['original']
        source=re.sub(r'((?:https://raccoon-app-labs\.github\.io)?)/assets/screens/([^/]+)/(?:ru|en)/(\d+)-hq\.webp(?:\?[^\s"<>]*)?',original_url,source)
        if catalog:
            body=source.index('function applyLanguage')
            start=source.find('Object.entries(detailPages).forEach',body)
            end=source.index('document.querySelectorAll(".detail-page-link',body)
            if body<start<end:source=source[:start]+source[end:]
        if '/assets/screenshot-loading.js' not in source:source=source.replace('</head>',ASSETS+'</head>',1)
        path.write_text(source,encoding='utf-8')
        print(path.relative_to(ROOT), 'updated',flush=True)


if __name__=='__main__':main()
