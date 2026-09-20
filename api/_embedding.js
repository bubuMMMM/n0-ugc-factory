const {credential,openaiCredential}=require('./_ai');
const {gatewayError,openaiError,isTimeout}=require('./_gateway-errors');
const EMBEDDING_MODEL=process.env.VIDEOMA_EMBEDDING_MODEL||'openai/text-embedding-3-small';
const DIRECT_EMBEDDING_MODEL=process.env.VIDEOMA_OPENAI_EMBEDDING_MODEL||EMBEDDING_MODEL.replace(/^openai\//,'')||'text-embedding-3-small';
const DIMENSIONS=1536;
let embeddingGatewayBlockedUntil=0;

async function requestEmbeddings(url,token,model,input,errorPrefix){
  let r;
  try{
    r=await fetch(url,{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'videoma/1.0'},
      body:JSON.stringify({model,input,dimensions:DIMENSIONS}),
      signal:AbortSignal.timeout(90000)
    });
  }catch(error){
    if(isTimeout(error)){const e=new Error(errorPrefix+'_TIMEOUT');e.code=errorPrefix+'_TIMEOUT';throw e}
    const code=errorPrefix+'_NETWORK_ERROR';
    const e=new Error(code);e.code=code;e.cause=error;throw e;
  }
  const raw=await r.text();
  if(!r.ok){
    if(errorPrefix==='EMBEDDING_GATEWAY')throw gatewayError(raw,r.status,'EMBEDDING_ERROR');
    throw openaiError(raw,r.status,'OPENAI_EMBEDDING');
  }
  let data;try{data=JSON.parse(raw)}catch{throw new Error(errorPrefix+'_INVALID_RESPONSE')}
  const rows=(data.data||[]).sort((a,b)=>a.index-b.index);
  if(rows.length!==input.length)throw new Error('EMBEDDING_COUNT_MISMATCH');
  if(rows.some((x,i)=>x.index!==i||!Array.isArray(x.embedding)||x.embedding.length!==DIMENSIONS||x.embedding.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('EMBEDDING_INVALID_VECTOR');
  return rows.map(x=>x.embedding);
}
async function embedMany(values){
  const input=(Array.isArray(values)?values:[values]).map(x=>String(x||'').slice(0,24000));
  const gatewayToken=credential(),directToken=openaiCredential();

  if(gatewayToken&&Date.now()>=embeddingGatewayBlockedUntil){
    try{
      return await requestEmbeddings('https://ai-gateway.vercel.sh/v1/embeddings',gatewayToken,EMBEDDING_MODEL,input,'EMBEDDING_GATEWAY');
    }catch(error){
      const code=String(error&&error.message||'');
      if(code==='AI_GATEWAY_INSUFFICIENT_FUNDS'||code==='AI_GATEWAY_AUTH_ERROR')embeddingGatewayBlockedUntil=Date.now()+5*60*1000;
      if(!directToken||(!code.startsWith('AI_GATEWAY_')&&code!=='EMBEDDING_ERROR'&&!code.startsWith('EMBEDDING_GATEWAY_')))throw error;
      console.warn('Embedding Gateway fallback to direct OpenAI',code);
    }
  }
  if(directToken){
    return requestEmbeddings('https://api.openai.com/v1/embeddings',directToken,DIRECT_EMBEDDING_MODEL,input,'OPENAI_EMBEDDING');
  }
  const e=new Error('AI_NOT_CONFIGURED');e.code='AI_NOT_CONFIGURED';throw e;
}
async function embedOne(value){return (await embedMany([value]))[0]}
module.exports={embedMany,embedOne,EMBEDDING_MODEL,DIRECT_EMBEDDING_MODEL,DIMENSIONS};
