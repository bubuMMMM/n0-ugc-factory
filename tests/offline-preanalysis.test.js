const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('scheduled and direct batch paths cannot invoke providers or restart a job',async()=>{
 const context={module:{exports:{}},require:(id)=>{
  if(id==='../_versions')return {VIDEO_INTELLIGENCE_VERSION:'test'};
  if(id==='../_db')return new Proxy({},{get(){throw Error('Unexpected database access')}});
  throw Error('Unexpected dependency '+id);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../api/admin/_preanalysis-core'),'utf8'),context);
 const core=context.module.exports;
 assert.equal(await core.ensureActiveJob(),null);
 const result=await core.runBatch('existing-active-job');
 assert.equal(result.stop,true);assert.equal(result.reason,'OFFLINE_PREANALYSIS_ONLY');
 assert.equal(require('../vercel.json').crons.length,0);
});
test('manual reviews retain source identity and evidence without fabricating export approval',()=>{
 const crypto=require('node:crypto');
 const urls=fs.readFileSync(require.resolve('../videos.txt'),'utf8').trim().split(/\r?\n/);
 const reviews=require('../data/video-manual-reviews.json').videos;
 const summary=require('../data/video-review-summary.json');
 const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/demo-hooks'),'utf8'),context);
 assert.equal(summary.sampledVideosReviewed,reviews.length);
 assert.equal(new Set(reviews.map(r=>r.index)).size,reviews.length);
 for(const r of reviews){
  assert.equal(r.sourceHash,crypto.createHash('sha256').update(urls[r.index-1]).digest('hex'));
  assert.equal(r.frameSha256.length,4);assert.equal(r.sampleTimestampsSeconds.length,4);
  assert.ok(r.sampleTimestampsSeconds.every(t=>t>0&&t<r.durationSeconds));
  assert.equal(r.safeForAutoApproval,false);
  assert.equal(context.window.VIDEOMA_DEMO_HOOKS[r.index-1].hook,r.hook);
 }
});
