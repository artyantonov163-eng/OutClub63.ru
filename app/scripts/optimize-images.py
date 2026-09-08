"""Build responsive WebP derivatives, preserving all original private photographs."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageOps
root=Path(__file__).resolve().parents[1]
data_path=root/'private/data/club.json'
data=json.loads(data_path.read_text())
urls=set()
for p in data['players']:
 urls.update(filter(None,[p.get('photo'),p.get('portrait')]))
for t in data['tournaments']:
 urls.update(p['url'] for p in t['photos'])
 if t.get('cover'): urls.add(t['cover']['url'])
out=root/'private/media/optimized';out.mkdir(exist_ok=True)
manifest={};before=after=0
for url in sorted(urls):
 source=root/('private'+url)
 # Use the lossless native cutout as the source when available.
 original=source.with_suffix('.png') if '/portraits/' in url else source
 if not original.exists(): original=source
 im=ImageOps.exif_transpose(Image.open(original));im=im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
 entries=[]
 for width in sorted(set([min(im.width,w) for w in [128,480,960,1600]])):
  frame=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
  import io
  buf=io.BytesIO();frame.save(buf,format='WEBP',quality=80,method=6)
  content=buf.getvalue();name=hashlib.sha256(content).hexdigest()[:16]+'.webp'
  (out/name).write_bytes(content);entries.append({'url':'/media/optimized/'+name,'width':width,'height':frame.height,'bytes':len(content)})
 manifest[url]=entries;before+=source.stat().st_size;after+=entries[-1]['bytes']
data['imageVariants']=manifest
data_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(root/'private/data/image-variants.json').write_text(json.dumps(manifest,indent=2)+'\n')
for name,maxwidth,quality in [('court-hero',1600,78),('out-logo',640,85)]:
 source=root/'public/assets'/(name+('.png' if name=='court-hero' else '.jpg'))
 im=Image.open(source);im.thumbnail((maxwidth,maxwidth));im.save(source.with_suffix('.webp'),'WEBP',quality=quality,method=6)
print(json.dumps({'images':len(urls),'originalBytes':before,'largestVariantsBytes':after,'reductionPercent':round(100*(1-after/before),1)}))
