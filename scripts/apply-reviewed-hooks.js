// Publish only explicitly reviewed rows; never infer visual facts from source prompts.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {normalizeHook}=require('../api/_hook-text');
const reviews=require('../data/video-manual-reviews.json');
const metadata=require('../data/video-source-metadata.json');
const urls=fs.readFileSync('videos.txt','utf8').trim().split(/\r?\n/);
const context={window:{}};vm.runInNewContext(fs.readFileSync('assets/demo-hooks.js','utf8'),context);
const hooks=context.window.VIDEOMA_DEMO_HOOKS;
for(const row of reviews.videos){
 const i=row.index-1;
 if(crypto.createHash('sha256').update(urls[i]||'').digest('hex')!==row.sourceHash)throw Error('SOURCE_CHANGED_'+row.index);
 if(row.reviewStatus!=='sampled-frames-reviewed'||row.frameSha256.length!==4)throw Error('MISSING_EVIDENCE_'+row.index);
 Object.assign(hooks[i],{hook:normalizeHook(row.hook),reaction:row.reaction,design:row.design,placement:row.placement,reviewStatus:row.reviewStatus});
}
if(new Set(hooks.map(r=>r.hook)).size!==hooks.length)throw Error('DUPLICATE_HOOK');
fs.writeFileSync('assets/demo-hooks.js','/* Promotional hooks. Individually reviewed rows carry reviewStatus; remaining rows are editorial variations, not visual analyses. */\nwindow.VIDEOMA_DEMO_HOOKS='+JSON.stringify(hooks,null,2)+';\n');
const summary={mode:'offline',modelApiCalls:0,total:urls.length,sourceMetadataAvailable:metadata.videos.filter(r=>r.status==='available').length,sourcePromptsAvailable:metadata.videos.filter(r=>r.sourcePrompt).length,sampledVideosReviewed:reviews.videos.length,framesReviewed:reviews.videos.length*4,pendingVisualReview:urls.length-reviews.videos.length,fullMotionReviewComplete:false,updatedAt:reviews.reviewedAt};
fs.writeFileSync('data/video-review-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
