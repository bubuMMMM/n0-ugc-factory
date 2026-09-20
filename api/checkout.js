module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET')return res.status(200).json({configured:Boolean(process.env.STRIPE_SECRET_KEY)});
  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }

  const key=String(process.env.STRIPE_SECRET_KEY||'').trim();
  const website=String(req.body&&req.body.website||'').slice(0,500);
  if(!key)return res.status(503).json({error:'STRIPE_NOT_CONFIGURED'});

  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  if(!host)return res.status(400).json({error:'INVALID_HOST'});
  const origin=proto+'://'+host;

  const p=new URLSearchParams();
  p.set('mode','payment');
  p.set('success_url',origin+'/?payment=success&session_id={CHECKOUT_SESSION_ID}');
  p.set('cancel_url',origin+'/?payment=cancel');
  p.set('customer_creation','always');
  p.set('line_items[0][quantity]','1');
  p.set('line_items[0][price_data][currency]','eur');
  p.set('line_items[0][price_data][unit_amount]','99000');
  p.set('line_items[0][price_data][product_data][name]','videoma. — Pack 1000 vidéos');
  p.set('line_items[0][price_data][product_data][description]','1000 vidéos verticales + textes personnalisés');
  if(website){
    p.set('metadata[website]',website);
    p.set('payment_intent_data[metadata][website]',website);
  }

  try{
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},
      body:p.toString(),
      signal:AbortSignal.timeout(20000)
    });
    const raw=await r.text();
    let data={};try{data=JSON.parse(raw)}catch{}
    if(!r.ok)return res.status(502).json({error:data&&data.error&&data.error.message||'STRIPE_ERROR'});
    if(!data.url)return res.status(502).json({error:'STRIPE_SESSION_MISSING_URL'});
    return res.status(200).json({url:data.url});
  }catch(error){
    console.error('checkout',error&&error.message);
    return res.status(502).json({error:'STRIPE_UNAVAILABLE'});
  }
};
