const {credential}=require('./_ai');
const EMBEDDING_MODEL=process.env.VIDEOMA_EMBEDDING_MODEL||'openai/text-embedding-3-small';
const DIMENSIONS=1536;

async function embedMany(values){
  const token=credential();
  if(!token){const e=new Error('AI_GATEWAY_NOT_CONFIGURED');e.code='AI_GATEWAY_NOT_CONFIGURED';throw e}
  const input=(Array.isArray(values)?values:[values]).map(x=>String(x||'').slice(0,24000));
  const r=await fetch('https://ai-gateway.vercel.sh/v1/embeddings',{
    method:'POST',
    headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'videoma/1.0'},
    body:JSON.stringify({model:EMBEDDING_MODEL,input,dimensions:DIMENSIONS}),
    signal:AbortSignal.timeout(55000)
  });
  const raw=await r.text();
  if(!r.ok){const e=new Error('EMBEDDING_ERROR');e.status=r.status;e.detail=raw.slice(0,800);throw e}
  let data;try{data=JSON.parse(raw)}catch{throw new Error('EMBEDDING_INVALID_RESPONSE')}
  const rows=(data.data||[]).sort((a,b)=>a.index-b.index);
  if(rows.length!==input.length)throw new Error('EMBEDDING_COUNT_MISMATCH');
  return rows.map(x=>x.embedding);
}
async function embedOne(value){return (await embedMany([value]))[0]}
module.exports={embedMany,embedOne,EMBEDDING_MODEL,DIMENSIONS};
