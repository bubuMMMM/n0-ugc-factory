function parseJson(raw){
  try{return JSON.parse(raw)}catch{return null}
}
function gatewayError(raw,status,fallback='AI_GATEWAY_ERROR'){
  const data=parseJson(raw);
  const type=String(data&&data.error&&data.error.type||'');
  const message=String(data&&data.error&&data.error.message||raw||'');
  let code=fallback;
  if(status===402||type==='insufficient_funds'||/positive credit balance|insufficient funds/i.test(message))code='AI_GATEWAY_INSUFFICIENT_FUNDS';
  else if(status===401||status===403)code='AI_GATEWAY_AUTH_ERROR';
  else if(status===429||/rate.?limit/i.test(message))code='AI_GATEWAY_RATE_LIMIT';
  else if(status===404||/model.*not found|unknown model/i.test(message))code='AI_MODEL_UNAVAILABLE';
  else if(status>=500)code='AI_GATEWAY_UNAVAILABLE';
  const e=new Error(code);
  e.code=code;e.status=status;e.detail=String(raw||'').slice(0,1200);
  return e;
}
function isTimeout(error){
  const s=String(error&&error.message||error||'');
  return error&&error.name==='AbortError'||/aborted|timeout/i.test(s);
}
module.exports={gatewayError,isTimeout};
