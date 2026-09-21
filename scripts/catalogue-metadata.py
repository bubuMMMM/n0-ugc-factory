"""Collect origin metadata without model APIs. Prompts are NOT verified visual facts."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/video-source-metadata.json'
urls = (ROOT / 'videos.txt').read_text().splitlines()
old = {r['url']: r for r in json.loads(OUT.read_text()).get('videos', [])} if OUT.exists() else {}
def collect(pair):
    i, url = pair
    if url in old and old[url].get('status') == 'available': return old[url]
    row = dict(index=i+1, url=url, sourceHash=hashlib.sha256(url.encode()).hexdigest(), visuallyVerified=False)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=35) as response:
                h = response.headers
                row.update(status='available', bytes=int(h.get('content-length', 0)), contentType=h.get('content-type'), etag=h.get('etag'), sourcePrompt=h.get('x-ms-meta-prompt', ''))
                return row
        except Exception as error: row.update(status='unavailable', error=str(error)[:180])
    return row
rows=[]
def save():
    payload=dict(version='source-metadata-v1', collectedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), provenance='Azure HEAD headers; generation intent only, not visual verification', videos=sorted(rows,key=lambda r:r['index']))
    temp=OUT.with_suffix('.tmp'); temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n'); temp.replace(OUT)
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    for row in pool.map(collect, enumerate(urls)):
        rows.append(row)
        if len(rows)%50==0: save(); print(f'{len(rows)}/{len(urls)} metadata records',flush=True)
save(); print('Complete:',len(rows),'Available:',sum(r['status']=='available' for r in rows),flush=True)
