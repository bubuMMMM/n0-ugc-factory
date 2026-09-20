const dns=require('node:dns').promises;
const http=require('node:http');
const https=require('node:https');
const ipaddr=require('ipaddr.js');

function normalizeIp(raw){
  try{
    let addr=ipaddr.parse(String(raw));
    if(addr.kind()==='ipv6'&&addr.isIPv4MappedAddress())addr=addr.toIPv4Address();
    return addr;
  }catch{return null}
}
function isPublicIp(raw){
  const addr=normalizeIp(raw);
  if(!addr)return false;
  return addr.range()==='unicast';
}
async function resolvePublic(host){
  if(ipaddr.isValid(host)){
    if(!isPublicIp(host))throw new Error('PRIVATE_HOST');
    const addr=normalizeIp(host);
    return [{address:addr.toString(),family:addr.kind()==='ipv4'?4:6}];
  }
  let rows;
  try{rows=await dns.lookup(host,{all:true,verbatim:true})}catch{throw new Error('DNS_FAILED')}
  if(!rows.length)throw new Error('DNS_FAILED');
  if(rows.some(x=>!isPublicIp(x.address)))throw new Error('PRIVATE_HOST');
  return rows;
}
async function validateUrl(raw){
  let url;try{url=new URL(String(raw))}catch{throw new Error('INVALID_URL')}
  if(!['http:','https:'].includes(url.protocol))throw new Error('INVALID_PROTOCOL');
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))throw new Error('PRIVATE_HOST');
  const addresses=await resolvePublic(host);
  return {url,addresses};
}
function pinnedLookup(addresses){
  return (_hostname,options,callback)=>{
    const opts=typeof options==='object'?options:{family:Number(options)||0};
    let choices=addresses;
    if(opts.family)choices=addresses.filter(x=>x.family===opts.family);
    if(!choices.length)return callback(new Error('DNS_FAMILY_UNAVAILABLE'));
    if(opts.all)return callback(null,choices);
    return callback(null,choices[0].address,choices[0].family);
  };
}
async function requestOnce(raw,{accept,maxBytes,timeoutMs}){
  const {url,addresses}=await validateUrl(raw);
  const transport=url.protocol==='https:'?https:http;
  return new Promise((resolve,reject)=>{
    const req=transport.request(url,{
      method:'GET',
      headers:{
        'User-Agent':'Mozilla/5.0 (compatible; videoma-site-analyzer/1.0)',
        'Accept':accept,
        'Accept-Encoding':'identity',
        'Connection':'close'
      },
      lookup:pinnedLookup(addresses)
    },res=>{
      const status=Number(res.statusCode)||0;
      const headers=res.headers||{};
      if(status>=300&&status<400){
        const location=headers.location;
        res.resume();
        return resolve({redirect:location?new URL(location,url).href:null,status,url:url.href,headers});
      }
      if(status<200||status>=300){
        res.resume();
        return reject(new Error('HTTP_'+status));
      }
      const declared=Number(headers['content-length']||0);
      if(declared&&declared>maxBytes){
        res.destroy();
        return reject(new Error('RESPONSE_TOO_LARGE'));
      }
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>maxBytes){
          res.destroy(new Error('RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end',()=>resolve({
        status,url:url.href,headers,
        body:Buffer.concat(chunks).toString('utf8')
      }));
      res.on('error',reject);
    });
    req.setTimeout(timeoutMs,()=>req.destroy(new Error('FETCH_TIMEOUT')));
    req.on('error',reject);
    req.end();
  });
}
async function fetchPublicText(raw,options={},depth=0){
  if(depth>4)throw new Error('TOO_MANY_REDIRECTS');
  const result=await requestOnce(raw,{
    accept:options.accept||'text/html,application/xhtml+xml',
    maxBytes:Math.max(1024,Number(options.maxBytes)||450000),
    timeoutMs:Math.max(500,Number(options.timeoutMs)||6000)
  });
  if(result.redirect){
    return fetchPublicText(result.redirect,options,depth+1);
  }
  return result;
}
module.exports={fetchPublicText,validateUrl,isPublicIp};
