const GATEWAY_URL='https://ai-gateway.vercel.sh/v1/chat/completions';
const OPENAI_URL='https://api.openai.com/v1/chat/completions';
const MODEL=process.env.VIDEOMA_AI_MODEL||'openai/gpt-5.6-sol';
const DIRECT_MODEL=process.env.VIDEOMA_OPENAI_MODEL||MODEL.replace(/^openai\//,'')||'gpt-5.6-sol';
const {gatewayError,openaiError,isTimeout}=require('./_gateway-errors');
let gatewayBlockedUntil=0;

function credential(){
  return process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||'';
}
function openaiCredential(){
  return process.env.OPENAI_API_KEY||process.env.openai_key||process.env.OPENAI_KEY||'';
}
function canDirect(){return Boolean(openaiCredential())}
function fallbackable(error){
  const code=String(error&&error.message||error&&error.code||'');
  return !code||code.startsWith('AI_GATEWAY_')||code==='AI_MODEL_UNAVAILABLE'||code==='AI_GATEWAY_NETWORK_ERROR';
}
async function structuredRequest({url,token,model,messages,name,schema,timeoutMs,errorPrefix}){
  let response;
  try{
    response=await fetch(url,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+token,
        'Content-Type':'application/json',
        'User-Agent':'videoma/1.0'
      },
      body:JSON.stringify({
        model,
        messages,
        response_format:{
          type:'json_schema',
          json_schema:{name,strict:true,schema}
        }
      }),
      signal:AbortSignal.timeout(timeoutMs)
    });
  }catch(error){
    if(isTimeout(error)){
      const e=new Error(errorPrefix+'_TIMEOUT');e.code=errorPrefix+'_TIMEOUT';throw e;
    }
    const code=errorPrefix+'_NETWORK_ERROR';
    const e=new Error(code);e.code=code;e.cause=error;throw e;
  }
  const body=await response.text();
  if(!response.ok){
    if(errorPrefix==='AI_GATEWAY')throw gatewayError(body,response.status);
    throw openaiError(body,response.status,'OPENAI_API');
  }
  let data;
  try{data=JSON.parse(body)}catch{throw new Error(errorPrefix+'_INVALID_RESPONSE')}
  const content=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
  if(!content)throw new Error(errorPrefix+'_EMPTY_RESPONSE');
  try{return JSON.parse(content)}catch{throw new Error(errorPrefix+'_INVALID_JSON')}
}
async function openaiJson({messages,name,schema,timeoutMs=90000}){
  const token=openaiCredential();
  if(!token){
    const e=new Error('OPENAI_API_NOT_CONFIGURED');e.code='OPENAI_API_NOT_CONFIGURED';throw e;
  }
  return structuredRequest({
    url:OPENAI_URL,token,model:DIRECT_MODEL,messages,name,schema,timeoutMs,errorPrefix:'OPENAI_API'
  });
}
async function gatewayJson({messages,name,schema,timeoutMs=55000}){
  const deadline=Date.now()+timeoutMs;
  const gatewayToken=credential();
  const directToken=openaiCredential();
  if(!gatewayToken&&!directToken){
    const e=new Error('AI_NOT_CONFIGURED');e.code='AI_NOT_CONFIGURED';throw e;
  }

  if(gatewayToken&&Date.now()>=gatewayBlockedUntil){
    try{
      return await structuredRequest({
        url:GATEWAY_URL,token:gatewayToken,model:MODEL,messages,name,schema,timeoutMs:directToken?Math.max(1,Math.floor(timeoutMs*.55)):timeoutMs,errorPrefix:'AI_GATEWAY'
      });
    }catch(error){
      const code=String(error&&error.message||error);
      if(code==='AI_GATEWAY_INSUFFICIENT_FUNDS'||code==='AI_GATEWAY_AUTH_ERROR')gatewayBlockedUntil=Date.now()+5*60*1000;
      if(!directToken||!fallbackable(error))throw error;
      console.warn('AI Gateway fallback to direct OpenAI',code);
    }
  }

  const remaining=deadline-Date.now();
  if(remaining<1)throw new Error('AI_GATEWAY_TIMEOUT');
  return openaiJson({messages,name,schema,timeoutMs:remaining});
}

module.exports={gatewayJson,openaiJson,MODEL,DIRECT_MODEL,credential,openaiCredential,canDirect};
