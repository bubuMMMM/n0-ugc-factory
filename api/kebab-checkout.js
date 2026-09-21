export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key)return res.status(503).json({error:'STRIPE_NOT_CONFIGURED'});

  const body=req.body||{};
  const origin=(req.headers['x-forwarded-proto']||'https')+'://'+(req.headers['x-forwarded-host']||req.headers.host);
  const clean=(v,n=300)=>String(v||'').slice(0,n);
  const p=new URLSearchParams();
  p.set('mode','payment');
  p.set('success_url',origin+'/kebab/success?session_id={CHECKOUT_SESSION_ID}');
  p.set('cancel_url',origin+'/kebab?checkout=cancelled');
  p.set('customer_creation','always');
  if(body.email)p.set('customer_email',clean(body.email,180));
  p.set('line_items[0][price_data][currency]','eur');
  p.set('line_items[0][price_data][unit_amount]','12900');
  p.set('line_items[0][price_data][product_data][name]','Pack Kebab — 1000 vidéos + 20 premium');
  p.set('line_items[0][price_data][product_data][description]','1000 vidéos personnalisées prêtes à publier + 20 vidéos premium offertes');
  p.set('line_items[0][quantity]','1');
  p.set('metadata[vertical]','kebab');
  p.set('metadata[business]',clean(body.business,200));
  p.set('metadata[source]',clean(body.source,300));
  p.set('metadata[city]',clean(body.city,120));
  p.set('metadata[product]',clean(body.product,200));
  p.set('metadata[offer]',clean(body.offer,400));
  p.set('metadata[goal]',clean(body.goal,300));
  p.set('metadata[platforms]',clean(Array.isArray(body.platforms)?body.platforms.join(', '):body.platforms,300));

  try{
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},
      body:p.toString()
    });
    const data=await r.json();
    if(!r.ok){
      console.error('Stripe checkout error',data);
      return res.status(502).json({error:'STRIPE_CHECKOUT_FAILED'});
    }
    return res.status(200).json({url:data.url,id:data.id});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'CHECKOUT_FAILED'});
  }
}