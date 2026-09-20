const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const ffmpeg=require('ffmpeg-static');
const ffprobe=require('ffprobe-static').path;

const MAX_SOURCE_BYTES=90*1024*1024;
const MAX_FONT_BYTES=2*1024*1024;
let cachedFontFile=null;
let fontPromise=null;

async function ensureRenderFont(){
  const configured=String(process.env.VIDEOMA_FONT_FILE||'').trim();
  if(configured&&fs.existsSync(configured))return {file:configured,family:'TikTok Sans',fallback:false};
  if(cachedFontFile&&fs.existsSync(cachedFontFile))return {file:cachedFontFile,family:'TikTok Sans',fallback:false};
  if(fontPromise)return fontPromise;
  fontPromise=(async()=>{
    try{
      const cssResponse=await fetch('https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@700&display=swap',{
        headers:{'User-Agent':'Mozilla/5.0 Chrome/140 Safari/537.36'},
        signal:AbortSignal.timeout(8000)
      });
      if(!cssResponse.ok)throw new Error('FONT_CSS_'+cssResponse.status);
      const css=await cssResponse.text();
      const latin=(css.match(/\/\*\s*latin\s*\*\/[\s\S]*?src:\s*url\((https:[^)]+)\)/i)||[])[1];
      const urls=[...css.matchAll(/src:\s*url\((https:[^)]+)\)/gi)].map(m=>m[1]);
      const url=latin||urls[urls.length-1];
      if(!url)throw new Error('FONT_URL_MISSING');
      const fontResponse=await fetch(url,{signal:AbortSignal.timeout(10000)});
      if(!fontResponse.ok)throw new Error('FONT_FETCH_'+fontResponse.status);
      const ab=await fontResponse.arrayBuffer();
      if(!ab.byteLength||ab.byteLength>MAX_FONT_BYTES)throw new Error('FONT_SIZE_INVALID');
      const file=path.join(os.tmpdir(),'videoma-tiktok-sans-700.woff2');
      fs.writeFileSync(file,Buffer.from(ab));
      cachedFontFile=file;
      return {file,family:'TikTok Sans',fallback:false};
    }catch(error){
      console.warn('TikTok Sans renderer fallback',error&&error.message);
      return {file:'',family:'DejaVu Sans',fallback:true};
    }finally{
      fontPromise=null;
    }
  })();
  return fontPromise;
}

function cleanText(value,max=500){
  return String(value||'').replace(/\r/g,'').replace(/\u0000/g,'').trim().slice(0,max);
}
function safeRect(rect){
  if(!rect||typeof rect!=='object')return null;
  const x=Number(rect.x),y=Number(rect.y),w=Number(rect.w),h=Number(rect.h);
  if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>1.01||y+h>1.01)return null;
  return {x,y,w,h};
}
async function download(url,file){
  const r=await fetch(url,{headers:{'User-Agent':'videoma-renderer/1.0'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error('VIDEO_FETCH_'+r.status);
  const len=Number(r.headers.get('content-length')||0);
  if(len&&len>MAX_SOURCE_BYTES)throw new Error('VIDEO_TOO_LARGE');
  const reader=r.body&&r.body.getReader?r.body.getReader():null;
  if(!reader){
    const ab=await r.arrayBuffer();
    if(ab.byteLength>MAX_SOURCE_BYTES)throw new Error('VIDEO_TOO_LARGE');
    fs.writeFileSync(file,Buffer.from(ab));return;
  }
  const stream=fs.createWriteStream(file);let bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX_SOURCE_BYTES)throw new Error('VIDEO_TOO_LARGE');
      if(!stream.write(Buffer.from(value)))await new Promise(resolve=>stream.once('drain',resolve));
    }
  }finally{
    await new Promise(resolve=>stream.end(resolve));
    try{reader.releaseLock()}catch{}
  }
}
async function probe(file){
  const {stdout}=await execFileAsync(ffprobe,[
    '-v','error','-select_streams','v:0',
    '-show_entries','stream=width,height:format=duration',
    '-print_format','json',file
  ],{timeout:15000,maxBuffer:1024*1024});
  const data=JSON.parse(stdout||'{}'),video=(data.streams||[])[0]||{};
  const width=Number(video.width)||0,height=Number(video.height)||0,duration=Number(data.format&&data.format.duration||0);
  if(!width||!height||!duration)throw new Error('VIDEO_METADATA_INVALID');
  return {width,height,duration};
}
function approxWidth(text,fontSize){
  return [...String(text||'')].reduce((sum,ch)=>{
    if(/[MW@#%]/.test(ch))return sum+fontSize*.8;
    if(/[il1.,' ]/.test(ch))return sum+fontSize*.3;
    return sum+fontSize*.55;
  },0);
}
function wrap(text,maxWidth,fontSize,maxLines){
  const words=cleanText(text,600).split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  const lines=[];let line='';
  for(const word of words){
    const next=line?line+' '+word:word;
    if(line&&approxWidth(next,fontSize)>maxWidth){
      lines.push(line);line=word;
    }else line=next;
  }
  if(line)lines.push(line);
  if(lines.length>maxLines)return null;
  return lines;
}
function fitText({hook,secondLine,rect,width,height,fontScale=1,style='short',maxLines=2}){
  const boxW=rect.w*width,boxH=rect.h*height;
  const base=width*(style==='wall'?.054:.066)*Math.max(.58,Math.min(1,Number(fontScale)||1));
  let mainSize=base;
  const minSize=width*.0365;
  let main=null;
  while(mainSize>=minSize){
    main=wrap(hook,boxW,mainSize,maxLines);
    if(main){
      const mainHeight=main.length*mainSize*1.2;
      let second=[],secondSize=width*.05*Math.min(fontScale,.92);
      if(secondLine){
        second=wrap(secondLine,boxW,secondSize,1);
        if(!second){second=[]}
      }
      const gap=second.length?secondSize*.3:0;
      const total=mainHeight+(second.length?secondSize*1.2+gap:0);
      if(total<=boxH)return {main,mainSize,second,secondSize,gap,total};
    }
    mainSize*=.91;
  }
  throw new Error('RENDER_TEXT_TOO_LONG');
}
function escapeFilterPath(value){
  return String(value).replace(/\\/g,'\\\\').replace(/:/g,'\\:').replace(/'/g,"\\'");
}
function drawFilter({file,rect,width,height,fontSize,align,lineSpacing,borderWidth,y,fontFile}){
  const xPx=Math.round(rect.x*width),wPx=Math.round(rect.w*width);
  const x=align==='left'
    ? String(xPx)
    : align==='right'
      ? String(xPx+wPx)+'-text_w'
      : String(xPx)+'+('+String(wPx)+'-text_w)/2';
  const font=fontFile
    ? "fontfile='"+escapeFilterPath(fontFile)+"'"
    : "font='DejaVu Sans'";
  return [
    'drawtext='+font,
    "textfile='"+escapeFilterPath(file)+"'",
    'reload=0',
    'fontcolor=white',
    'fontsize='+Math.max(18,Math.round(fontSize)),
    'borderw='+Math.max(2,Math.round(borderWidth)),
    'bordercolor=black',
    'line_spacing='+Math.max(0,Math.round(lineSpacing)),
    'x='+x,
    'y='+Math.max(0,Math.round(y))
  ].join(':');
}
async function renderVideo({sourceUrl,hook,secondLine,textRect,fontScale,style,horizontalAlign,maxLines}){
  const rect=safeRect(textRect);
  if(!rect)throw new Error('RENDER_LAYOUT_INVALID');
  const id=crypto.randomBytes(8).toString('hex');
  const input=path.join(os.tmpdir(),'videoma-'+id+'-input.mp4');
  const output=path.join(os.tmpdir(),'videoma-'+id+'-output.mp4');
  const mainFile=path.join(os.tmpdir(),'videoma-'+id+'-hook.txt');
  const secondFile=path.join(os.tmpdir(),'videoma-'+id+'-second.txt');
  try{
    await download(sourceUrl,input);
    const meta=await probe(input);
    const renderFont=await ensureRenderFont();
    const fit=fitText({
      hook:cleanText(hook,500),
      secondLine:cleanText(secondLine,300),
      rect,width:meta.width,height:meta.height,fontScale,style,maxLines
    });
    fs.writeFileSync(mainFile,fit.main.join('\n'),'utf8');
    if(fit.second.length)fs.writeFileSync(secondFile,fit.second.join('\n'),'utf8');

    const y=rect.y*meta.height;
    const filters=[drawFilter({
      file:mainFile,rect,width:meta.width,height:meta.height,fontSize:fit.mainSize,
      align:horizontalAlign||'center',lineSpacing:fit.mainSize*.2,
      borderWidth:fit.mainSize*.125,y,fontFile:renderFont.file
    })];
    if(fit.second.length){
      filters.push(drawFilter({
        file:secondFile,rect,width:meta.width,height:meta.height,fontSize:fit.secondSize,
        align:horizontalAlign||'center',lineSpacing:fit.secondSize*.2,
        borderWidth:fit.secondSize*.125,
        y:y+fit.main.length*fit.mainSize*1.2+fit.gap,
        fontFile:renderFont.file
      }));
    }

    await execFileAsync(ffmpeg,[
      '-hide_banner','-loglevel','error','-i',input,
      '-vf',filters.join(','),
      '-c:v','libx264','-preset','veryfast','-crf','20',
      '-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','128k',
      '-movflags','+faststart',
      '-y',output
    ],{timeout:240000,maxBuffer:4*1024*1024});

    const stat=fs.statSync(output);
    if(!stat.size)throw new Error('RENDER_EMPTY');
    const verified=await probe(output);
    if(verified.width!==meta.width||verified.height!==meta.height)throw new Error('RENDER_DIMENSIONS_MISMATCH');
    if(Math.abs(verified.duration-meta.duration)>Math.max(.35,meta.duration*.03))throw new Error('RENDER_DURATION_MISMATCH');
    return {
      output,size:stat.size,durationMs:Math.round(verified.duration*1000),
      width:verified.width,height:verified.height,
      fontFamily:renderFont.family,fontFallbackUsed:renderFont.fallback
    };
  }catch(error){
    try{fs.unlinkSync(output)}catch{}
    throw error;
  }finally{
    try{fs.unlinkSync(input)}catch{}
    try{fs.unlinkSync(mainFile)}catch{}
    try{fs.unlinkSync(secondFile)}catch{}
  }
}
module.exports={renderVideo,safeRect};
