module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const key=String(process.env.STRIPE_SECRET_KEY||'').trim();
  if(!key)return res.status(503).json({error:'STRIPE_NOT_CONFIGURED'});
  const sessionId=String(req.query&&req.query.session_id||'').trim();
  if(!/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)||sessionId.length>255){
    return res.status(400).json({error:'INVALID_CHECKOUT_SESSION'});
  }
  try{
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId),{
      headers:{Authorization:'Bearer '+key,'User-Agent':'videoma/1.0'},
      signal:AbortSignal.timeout(15000)
    });
    const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
    if(!r.ok)return res.status(r.status===404?404:502).json({error:'STRIPE_SESSION_LOOKUP_FAILED'});
    const paid=
      data.mode==='payment'&&
      data.status==='complete'&&
      data.payment_status==='paid'&&
      Number(data.amount_total)===99000&&
      String(data.currency||'').toLowerCase()==='eur';
    return res.status(200).json({
      verified:true,
      paid,
      status:data.status||null,
      paymentStatus:data.payment_status||null,
      amountTotal:Number(data.amount_total)||0,
      currency:String(data.currency||'').toLowerCase()||null,
      website:data.metadata&&data.metadata.website||null
    });
  }catch(error){
    console.error('payment-status',error&&error.message);
    return res.status(502).json({error:'STRIPE_UNAVAILABLE'});
  }
};
