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


test('face safety margin penalizes nearby text even without direct overlap',()=>{
  const intelligence={
    textSafeZone:{
      preferred:'top',horizontal:'center',allowSecondLine:false,maxLines:1,
      zoneScores:{top:95,upper:80,middle:20,lower:85,bottom:82}
    },
    // Face stops just before the nominal top text band, but the safety margin must protect it.
    faceRegions:[{frame:1,x:.25,y:.135,w:.5,h:.22,confidence:1}],
    objectRegions:[]
  };
  const penalty=layout.facePenalty(intelligence,'top','center',{x:.10,y:.055,w:.80,h:.075});
  assert.ok(penalty>0);
});

test('resolver chooses a different band when requested band approaches a face',()=>{
  const intelligence={
    textSafeZone:{
      preferred:'top',horizontal:'center',allowSecondLine:false,maxLines:1,
      zoneScores:{top:96,upper:70,middle:15,lower:90,bottom:88}
    },
    faceRegions:[
      {frame:1,x:.20,y:.10,w:.60,h:.26,confidence:1},
      {frame:2,x:.20,y:.10,w:.60,h:.26,confidence:1},
      {frame:3,x:.20,y:.10,w:.60,h:.26,confidence:1},
      {frame:4,x:.20,y:.10,w:.60,h:.26,confidence:1}
    ],
    objectRegions:[]
  };
  const result=layout.resolveLayout(intelligence,{requested:'top',secondLine:'',style:'short'});
  assert.notEqual(result.placement,'top');
  assert.ok(result.faceOcclusionPenalty<=8);
});
