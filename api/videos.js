const IDS = [
"e3e45b32-d29e-4d2f-a821-c06c4f101bc8",
"2dca701e-9e20-48a8-b642-3fb04aed5ea6",
"6e0873cd-1eb0-430d-9d35-d9210f87c904",
"48156df6-5847-48d2-b66d-3c7a8d4c4bbd",
"a8f3d76e-d5c3-47e0-8434-be53cbbab810",
"e0cfad7e-fb35-4517-9c09-2579362a8c7c",
"bbb77da3-473b-499c-9acc-cdab5ca44b5a",
"b8fcdddc-dcdc-41f4-bf3c-98a8f80d037c",
"3ca0aea8-9dae-4a64-be82-f1168970481c",
"4dae7e8c-9310-4240-a93d-519971de810c",
"2984bc11-f513-4c01-8aa3-8febab38b4bf",
"e4cfd36e-cfd1-448a-b1ef-b509ff8f8ba9",
"109fc20a-9e4b-458e-b418-abd5434a4ebe",
"501d8990-1c54-4254-814f-160dcc758f33",
"e25b85a5-79df-4109-9e16-b4c217c3a646",
"2245353b-9ade-41e6-9e14-a77500dcad19",
"3144f282-dcd3-4cd6-bd7c-bc3e439236f9",
"515024cb-680a-42b7-bca3-6f11cfba2f39",
"80bd22a9-5518-433c-b3d0-c55037be93ba",
"9a270124-5964-4c52-87a8-53e23a1bce99",
"95e23bd5-a4dc-4a2d-bfab-e869e4366ab0",
"096ddb1b-9a76-44bd-8f25-3a580dfbeb3a",
"e63186c4-7cac-4381-a870-6d3753c6edcc",
"48072581-e451-4382-a19b-764cf6407450",
"607c94e1-ce9e-4580-8c94-765ca678a22e",
"1363cd21-f903-478b-8a47-355bdffe317e",
"abbd0d95-4d21-4deb-b3a0-1d78bf576763",
"d36a730d-6aad-438b-bbb0-c1d7f8a5b632"
];
const BASE="https://doublespeed2.blob.core.windows.net/media";
const unesc=s=>s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&quot;/g,'"');
async function listPrefix(id){
  let marker="",out=[],pages=0;
  do{
    const prefix="media/"+id+"/";
    const url=BASE+"?restype=container&comp=list&maxresults=5000&prefix="+encodeURIComponent(prefix)+(marker?"&marker="+encodeURIComponent(marker):"");
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
    if(!r.ok) throw new Error("Azure list "+r.status+" for "+id);
    const xml=await r.text();
    for(const m of xml.matchAll(/<Name>([\s\S]*?)<\/Name>/g)){const name=unesc(m[1]);if(/\.mp4(?:$|\?)/i.test(name))out.push(BASE+"/"+name)}
    marker=(xml.match(/<NextMarker>([\s\S]*?)<\/NextMarker>/)||[])[1]||""; marker=unesc(marker); pages++;
  }while(marker&&pages<20);
  return out;
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=86400");
  const results=await Promise.allSettled(IDS.map(listPrefix));
  const videos=[...new Set(results.flatMap(r=>r.status==="fulfilled"?r.value:[]))];
  const errors=results.filter(r=>r.status==="rejected").map(r=>String(r.reason?.message||r.reason));
  res.status(200).json({source:videos.length?"azure-container":"azure-list-unavailable",videos,count:videos.length,errors:errors.slice(0,5)});
};