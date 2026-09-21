const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const html = fs.readFileSync(path.join(root,'kebab/index.html'),'utf8');
const js = fs.readFileSync(path.join(root,'assets/kebab-gallery.js'),'utf8');
test('kebab scripts only bind to elements present in the page',()=>{
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  for(const m of (inline+js).matchAll(/getElementById\(['"]([^'"]+)['"]\)/g))assert.ok(ids.has(m[1]),'Missing element: '+m[1]);
});
test('uploaded MP4s and posters exist and MP4 boxes are complete and fast-start',()=>{
  const media=[...new Set([...js.matchAll(/['"](\/media\/kebab\/[^'"]+)['"]/g)].map(m=>m[1]))];
  assert.equal(media.filter(p=>p.endsWith('.mp4')).length,3);
  for(const url of media){
    const data=fs.readFileSync(path.join(root,url));
    assert.ok(data.length>0,url);
    if(!url.endsWith('.mp4'))continue;
    let offset=0;const boxes=[];
    while(offset<data.length){
      assert.ok(offset+8<=data.length,'Truncated header '+url);
      const size=data.readUInt32BE(offset),type=data.toString('ascii',offset+4,offset+8);
      assert.ok(size>=8&&offset+size<=data.length,'Truncated box '+url+' '+type);
      boxes.push(type);offset+=size;
    }
    assert.equal(boxes[0],'ftyp');
    assert.ok(boxes.includes('moov')&&boxes.includes('mdat'));
    assert.ok(boxes.indexOf('moov')<boxes.indexOf('mdat'),'Metadata must precede video data');
  }
});
