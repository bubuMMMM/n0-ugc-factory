function normalizeHook(value){
  const hook=String(value||'').replace(/\s+/g,' ').trim();
  if(hook.split(/\s+/).filter(Boolean).length<6)throw new Error('HOOK_TOO_SHORT');
  if(hook.length>500)throw new Error('HOOK_TOO_LONG');
  return hook;
}
module.exports={normalizeHook};
