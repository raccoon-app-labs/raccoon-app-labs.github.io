"""Build display-size lossless WebP derivatives, keeping original artwork intact."""
from pathlib import Path
import re,json,hashlib,base64
from io import BytesIO
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
assets=[(p,192) for p in (ROOT/'assets/apps').glob('*-icon.webp')]+[(ROOT/'assets/raccoon-app-labs-logo.webp',128)]
assets += [(ROOT/'assets/demo'/n,w) for n,w in [('town-hall.webp',320),('house.webp',160),('tree.webp',160),('cat.webp',128),('inventory.webp',256),('basket.webp',256),('omelet.webp',192),('soup.webp',192),('pasta.webp',192),('bunny-page-1.webp',800),('bunny-page-2.webp',800),('bunny-page-3.webp',800)]]
assets += [(ROOT/'apps/neon-cyber-wall-kicker/shop/assets'/name,480) for name in ['rift-fox.webp','eclipse-maestro.webp']]
manifest={}
for source,width in assets:
 if not source.exists():continue
 image=Image.open(source);original=image.size;image.thumbnail((width,round(width*2)),Image.Resampling.LANCZOS)
 dest=ROOT/'assets/display'/(source.relative_to(ROOT/'assets') if source.is_relative_to(ROOT/'assets') else source.relative_to(ROOT));dest.parent.mkdir(parents=True,exist_ok=True)
 image.save(dest,'WEBP',lossless=True,method=6,exact=True)
 if dest.stat().st_size >= source.stat().st_size:
  if dest.resolve().is_relative_to((ROOT/'assets/display').resolve()):dest.unlink()
  continue
 src='/'+source.relative_to(ROOT).as_posix();target='/'+dest.relative_to(ROOT).as_posix()+'?v='+hashlib.sha256(dest.read_bytes()).hexdigest()[:12]
 tiny=image.copy();tiny.thumbnail((96,96),Image.Resampling.LANCZOS);buffer=BytesIO();tiny.save(buffer,'WEBP',lossless=True,method=6,exact=True)
 manifest[src]={'preview':'data:image/webp;base64,'+base64.b64encode(buffer.getvalue()).decode(),'src':target,'width':image.width,'height':image.height,'originalSize':original,'before':source.stat().st_size,'after':dest.stat().st_size}
(ROOT/'assets/display/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for page in [ROOT/'index.html',*ROOT.glob('apps/*/index.html'),*ROOT.glob('en/apps/*/index.html')]:
 s=page.read_text(encoding='utf-8')
 s=re.sub(r'/assets/display/([^"\s)<>?]+)(?:\?[^"\s)<>]*)?',lambda m: '/assets/'+m[1] if '/assets/'+m[1] not in manifest else m[0],s)
 def img(m):
  tag=m[0]
  tag=re.sub(r' data-display-src="([^"]*)"',lambda m:' data-display-src="'+m[1]+'"',tag)
  for src,spec in manifest.items():tag=re.sub(r'(\bsrc=")'+re.escape(src)+r'(?:\?[^"<>]*)?"',lambda m:m[1]+spec['src']+'"',tag)
  if '/assets/demo/' in tag or '/assets/display/demo/' in tag:
   tag=re.sub(r'\sloading="[^"]*"','',tag);tag=tag.replace('<img','<img loading="lazy"',1)
  if 'hero-fox' in tag or 'hero-maestro' in tag:
   for src,spec in manifest.items():
    if '/shop/assets/' in src and (spec['src'].split('?')[0] in tag or src in tag):
     tag=re.sub(r'\sdata-display-src="[^"]*"','',tag)
     tag=re.sub(r'\bsrc="[^"]*"','src="'+spec['preview']+'" data-display-src="'+spec['src']+'"',tag,count=1)
  return tag
 s=re.sub(r'<img\b[^>]*>',img,s)
 if page==ROOT/'index.html':
  for src,spec in manifest.items():
   if '/apps/' in src:s=re.sub(re.escape(src)+r'(?:\?[^"\s)<>]*)?',lambda _:spec['src'],s)
 page.write_text(s,encoding='utf-8')
print('Display derivatives:',len(manifest),'before KiB',sum(v['before'] for v in manifest.values())//1024,'after KiB',sum(v['after'] for v in manifest.values())//1024)
