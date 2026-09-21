"""Download a bounded batch and create evidence sheets. No model API calls."""
import argparse,concurrent.futures,json,pathlib,subprocess
from PIL import Image,ImageDraw
parser=argparse.ArgumentParser();parser.add_argument('--start',type=int,default=1);parser.add_argument('--end',type=int,default=12);parser.add_argument('--out',required=True);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];metadata=json.loads((root/'data/video-source-metadata.json').read_text())['videos'];urls=(root/'videos.txt').read_text().splitlines();out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
def extract(i):
 p=out/f'{i:04}.mp4';u=urls[i-1]
 expected=next(r['bytes'] for r in metadata if r['url']==u)
 if not p.exists() or p.stat().st_size!=expected:
  temp=p.with_suffix('.part')
  subprocess.run(['curl','-fsSL','--retry','2','--max-time','90','-H','Cache-Control: no-cache',u,'-o',str(temp)],check=True,capture_output=True)
  if temp.stat().st_size!=expected:raise ValueError(f'Incomplete download for video {i}')
  temp.replace(p)
 info=json.loads(subprocess.run(['ffprobe','-v','error','-show_format','-of','json',str(p)],check=True,capture_output=True,text=True).stdout)
 duration=float(info['format']['duration']); times=[round(duration*f,3) for f in (.08,.34,.64,.9)]
 for k,t in enumerate(times):
  target=out/f'{i:04}-{k+1:02}.jpg'
  subprocess.run(['ffmpeg','-v','error','-threads','1','-ss',str(t),'-i',str(p),'-vf','scale=144:256:force_original_aspect_ratio=decrease,pad=144:256:(ow-iw)/2:(oh-ih)/2','-threads','1','-frames:v','1','-y',str(target)],check=True,capture_output=True)
  if not target.exists():raise ValueError(f'Missing frame {k+1} for video {i}')
 (out/f'{i:04}.json').write_text(json.dumps(dict(index=i,duration=duration,timestamps=times)))
 print('frames',i,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(extract,range(args.start,args.end+1)))
for start in range(args.start,args.end+1,8):
 sheet=Image.new('RGB',(1152,1124),'#18202c');d=ImageDraw.Draw(sheet)
 for n,i in enumerate(range(start,min(start+8,args.end+1))):
  x=n%2*576;y=n//2*281;d.text((x+8,y+5),f'VIDEO {i} | 8%, 34%, 64%, 90%',fill='white')
  for k in range(4):sheet.paste(Image.open(out/f'{i:04}-{k+1:02}.jpg'),(x+k*144,y+25))
 sheet.save(out/f'review-{start:04}.jpg')
