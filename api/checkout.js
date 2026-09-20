module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"METHOD_NOT_ALLOWED"});}
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key)return res.status(503).json({error:"STRIPE_NOT_CONFIGURED"});
  const origin="https://"+req.headers.host;
  const p=new URLSearchParams();
  p.set("mode","payment");
  p.set("success_url",origin+"/?payment=success");
  p.set("cancel_url",origin+"/?payment=cancel");
  p.set("customer_creation","always");
  p.set("line_items[0][quantity]","1");
  p.set("line_items[0][price_data][currency]","eur");
  p.set("line_items[0][price_data][unit_amount]","99000");
  p.set("line_items[0][price_data][product_data][name]","videoma. — Pack 1000 vidéos");
  p.set("line_items[0][price_data][product_data][description]","1000 vidéos verticales + textes personnalisés");
  const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:p.toString()});
  const data=await r.json();
  if(!r.ok)return res.status(502).json({error:data?.error?.message||"STRIPE_ERROR"});
  return res.status(200).json({url:data.url});
};