export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false});
  const key=String(process.env.STRIPE_SECRET_KEY||'').trim();
  if(!key)return res.status(503).json({ok:false,configured:false});
  const origin='https://n0-ugc-factory.vercel.app';
  const p=new URLSearchParams();
  p.set('mode','payment');
  p.set('success_url',origin+'/kebab?stripe_self_test=success');
  p.set('cancel_url',origin+'/kebab?stripe_self_test=cancel');
  p.set('line_items[0][quantity]','1');
  p.set('line_items[0][price_data][currency]','eur');
  p.set('line_items[0][price_data][unit_amount]','12900');
  p.set('line_items[0][price_data][product_data][name]','CLIPFA.ST — Stripe self-test');
  p.set('metadata[self_test]','true');
  try{
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},
      body:p.toString(),
      signal:AbortSignal.timeout(15000)
    });
    const raw=await r.text();
    let data={};try{data=JSON.parse(raw)}catch{}
    if(!r.ok)return res.status(502).json({ok:false,configured:true,stripeStatus:r.status,errorType:data?.error?.type||null});
    return res.status(200).json({
      ok:Boolean(data.id&&data.url),
      configured:true,
      mode:String(data.id||'').startsWith('cs_live_')?'live':String(data.id||'').startsWith('cs_test_')?'test':'unknown',
      checkoutHost:(()=>{try{return new URL(data.url).host}catch{return null}})(),
      amount:12900,
      currency:'eur'
    });
  }catch(e){
    return res.status(502).json({ok:false,configured:true,error:'STRIPE_UNAVAILABLE'});
  }
}