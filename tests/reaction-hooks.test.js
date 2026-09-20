const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {normalizeHook}=require('../api/_hook-text');

test('all 1017 demo hooks are unique, complete, at least six words and keyed by video index',()=>{
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/demo-hooks.js'),'utf8'),context);
 const rows=context.window.VIDEOMA_DEMO_HOOKS;
 assert.equal(rows.length,1017);
 assert.equal(new Set(rows.map(x=>x.hook)).size,1017);
 rows.forEach((x,i)=>{assert.equal(x.index,i+1);assert.equal(normalizeHook(x.hook),x.hook);assert.match(x.hook,/1000 vidéos en 5 minutes/);assert.match(x.hook,/lien|URL|site/);assert.ok(['outline','paper','editorial'].includes(x.design))});
});
test('hook validation rejects short or oversized copy rather than silently truncating',()=>{
 assert.throws(()=>normalizeHook('Une phrase trop courte'),/HOOK_TOO_SHORT/);
 const text='Ma réaction quand le client change encore le brief.';
 assert.equal(normalizeHook('  '+text+'  '),text);
 assert.throws(()=>normalizeHook('un deux trois quatre cinq six '+ 'a'.repeat(500)),/HOOK_TOO_LONG/);
 assert.equal(normalizeHook('Ma réaction quand le client écrit 50 % de réduction.'),'Ma réaction quand le client écrit 50 % de réduction.');
});
test('frontend JavaScript parses and removes competing line clamp rules',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 const css=fs.readFileSync(require.resolve('../assets/reaction-gallery.css'),'utf8');
 assert.doesNotMatch(css+html,/-webkit-line-clamp\s*:/);
 assert.match(css,/data-caption-mode="outside-media"/);
});
