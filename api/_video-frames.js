const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const ffmpeg=require('ffmpeg-static');
const ffprobe=require('ffprobe-static').path;

async function download(url){
  const id=crypto.randomBytes(8).toString('hex');
  const file=path.join(os.tmpdir(),id+'.mp4');
  const r=await fetch(url,{headers:{'User-Agent':'videoma-preanalyzer/1.0'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('VIDEO_FETCH_'+r.status);
  const len=Number(r.headers.get('content-length')||0);
  if(len&&len>80*1024*1024)throw new Error('VIDEO_TOO_LARGE');
  const ab=await r.arrayBuffer();
  if(ab.byteLength>80*1024*1024)throw new Error('VIDEO_TOO_LARGE');
  fs.writeFileSync(file,Buffer.from(ab));
  return file;
}
async function probe(file){
  const {stdout}=await execFileAsync(ffprobe,['-v','error','-print_format','json','-show_streams','-show_format',file],{timeout:15000,maxBuffer:2*1024*1024});
  const data=JSON.parse(stdout||'{}');
  const duration=Number(data.format&&data.format.duration||0);
  const video=(data.streams||[]).find(x=>x.codec_type==='video')||{};
  const audio=(data.streams||[]).find(x=>x.codec_type==='audio')||null;
  if(!Number.isFinite(duration)||duration<=0)throw new Error('VIDEO_DURATION_INVALID');
  return {duration,width:Number(video.width)||0,height:Number(video.height)||0,hasAudio:Boolean(audio)};
}
async function contactSheet(file,duration){
  const out=file.replace(/\.mp4$/,'.jpg');
  const ratios=[.08,.34,.64,.90];
  const args=[];
  for(const ratio of ratios){
    const t=Math.max(.02,Math.min(duration-.04,duration*ratio));
    args.push('-ss',String(t),'-i',file);
  }
  args.push('-filter_complex',
    '[0:v]scale=160:284:force_original_aspect_ratio=increase,crop=160:284[a];'+
    '[1:v]scale=160:284:force_original_aspect_ratio=increase,crop=160:284[b];'+
    '[2:v]scale=160:284:force_original_aspect_ratio=increase,crop=160:284[c];'+
    '[3:v]scale=160:284:force_original_aspect_ratio=increase,crop=160:284[d];'+
    '[a][b][c][d]hstack=inputs=4[out]',
    '-map','[out]','-frames:v','1','-q:v','4','-y',out
  );
  await execFileAsync(ffmpeg,args,{timeout:22000,maxBuffer:3*1024*1024});
  const buf=fs.readFileSync(out);
  const keyframes=ratios.map((r,i)=>({slot:i+1,timeMs:Math.round(duration*r*1000)}));
  return {data:'data:image/jpeg;base64,'+buf.toString('base64'),keyframes,out};
}
async function extract(url){
  const file=await download(url);
  let sheet;
  try{
    const meta=await probe(file);
    sheet=await contactSheet(file,meta.duration);
    return {durationMs:Math.round(meta.duration*1000),hasAudio:meta.hasAudio,contactSheet:sheet.data,keyframes:sheet.keyframes};
  }finally{
    try{fs.unlinkSync(file)}catch{}
    if(sheet&&sheet.out){try{fs.unlinkSync(sheet.out)}catch{}}
  }
}
module.exports={extract};
