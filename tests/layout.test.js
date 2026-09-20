const test=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../api/_layout');

test('layout module exposes one canonical resolver',()=>{
  assert.equal(typeof layout.resolveLayout,'function');
  assert.equal(typeof layout.layoutDecision,'function');
  assert.equal(typeof layout.hasUsableGeometry,'function');
});

test('explicit second-line ban is respected',()=>{
  const intelligence={
    textSafeZone:{preferred:'top',horizontal:'center',allowSecondLine:false,maxLines:2},
    faceRegions:[],objectRegions:[]
  };
  const result=layout.resolveLayout(intelligence,{requested:'top',secondLine:'extra',style:'short'});
  assert.equal(result.allowSecondLine,false);
  assert.equal(result.secondLineSuppressed,true);
});

test('full-frame face is never auto-approved',()=>{
  const faces=[1,2,3,4].map(frame=>({frame,x:0,y:0,w:1,h:1,confidence:1}));
  const intelligence={
    textSafeZone:{preferred:'top',horizontal:'center',allowSecondLine:false,maxLines:1},
    faceRegions:faces,objectRegions:[]
  };
  const result=layout.resolveLayout(intelligence,{requested:'top',secondLine:'',style:'short'});
  assert.equal(result.safeForAutoApproval,false);
  assert.equal(result.noSafeZone,true);
  assert.ok(result.faceOcclusionPenalty>25);
});

test('numeric face geometry validator rejects legacy strings',()=>{
  assert.equal(layout.hasUsableGeometry({
    textSafeZone:{preferred:'top',horizontal:'center'},
    faceRegions:['haut-centre']
  }),false);
  assert.equal(layout.hasUsableGeometry({
    textSafeZone:{preferred:'lower',horizontal:'center'},
    faceRegions:[{frame:1,x:.3,y:.2,w:.3,h:.25}]
  }),true);
});
