const {credential}=require('./_ai');

const TRANSCRIPTION_MODEL=process.env.VIDEOMA_TRANSCRIPTION_MODEL||'openai/whisper-1';
const MAX_BYTES=24*1024*1024;

async function transcribeVideoUrl(url){
  if(process.env.VIDEOMA_TRANSCRIBE_AUDIO==='false')return {status:'unknown',text:''};
  const token=credential();
  if(!token)throw new Error('AI_GATEWAY_NOT_CONFIGURED');
  const r=await fetch(url,{headers:{'User-Agent':'videoma-transcriber/1.0'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('VIDEO_FETCH_FAILED');
  const len=Number(r.headers.get('content-length')||0);
  if(len&&len>MAX_BYTES)return {status:'error',text:'',reason:'VIDEO_TOO_LARGE'};
  const buf=await r.arrayBuffer();
  if(buf.byteLength>MAX_BYTES)return {status:'error',text:'',reason:'VIDEO_TOO_LARGE'};
  const form=new FormData();
  form.append('model',TRANSCRIPTION_MODEL);
  form.append('file',new Blob([buf],{type:r.headers.get('content-type')||'video/mp4'}),'clip.mp4');
  const tr=await fetch('https://ai-gateway.vercel.sh/v1/audio/transcriptions',{
    method:'POST',
    headers:{'Authorization':'Bearer '+token,'User-Agent':'videoma/1.0'},
    body:form,
    signal:AbortSignal.timeout(45000)
  });
  const raw=await tr.text();
  if(!tr.ok)return {status:'error',text:'',reason:'TRANSCRIPTION_'+tr.status};
  let data;try{data=JSON.parse(raw)}catch{return {status:'error',text:'',reason:'TRANSCRIPTION_INVALID_JSON'}}
  const text=String(data.text||'').replace(/\s+/g,' ').trim();
  return text.length>=3?{status:'transcribed',text}:{status:'none',text:''};
}
module.exports={transcribeVideoUrl,TRANSCRIPTION_MODEL};
