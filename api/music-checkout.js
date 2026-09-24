export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key)return res.status(503).json({error:'STRIPE_NOT_CONFIGURED'});

  const body=req.body||{};
  const origin=(req.headers['x-forwarded-proto']||'https')+'://'+(req.headers['x-forwarded-host']||req.headers.host);
  const clean=(v,n=400)=>String(v||'').slice(0,n);
  const p=new URLSearchParams();

  p.set('mode','payment');
  p.set('success_url',origin+'/musique?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  p.set('cancel_url',origin+'/musique?checkout=cancelled');
  p.set('customer_creation','always');
  if(body.email)p.set('customer_email',clean(body.email,180));

  p.set('line_items[0][price_data][currency]','eur');
  p.set('line_items[0][price_data][unit_amount]','19900');
  p.set('line_items[0][price_data][product_data][name]','CLIPFA.ST — Clip musical');
  p.set('line_items[0][price_data][product_data][description]','Création d’un clip musical à partir du morceau et de la direction artistique fournis');
  p.set('line_items[0][quantity]','1');

  p.set('metadata[vertical]','musique');
  p.set('metadata[artist]',clean(body.artist,180));
  p.set('metadata[track]',clean(body.track,400));
  p.set('metadata[title]',clean(body.title,180));
  p.set('metadata[references]',clean(body.references,500));
  p.set('metadata[mood]',clean(body.mood,500));
  p.set('metadata[style]',clean(body.style,120));
  p.set('metadata[release]',clean(body.release,120));

  try{
    const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},
      body:p.toString()
    });
    const data=await r.json();
    if(!r.ok){
      console.error('Stripe music checkout error',data);
      return res.status(502).json({error:'STRIPE_CHECKOUT_FAILED'});
    }
    return res.status(200).json({url:data.url,id:data.id});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'CHECKOUT_FAILED'});
  }
}