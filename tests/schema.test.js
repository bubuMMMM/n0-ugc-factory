const test=require('node:test');
const assert=require('node:assert/strict');
const {MIGRATIONS}=require('../api/_schema');

test('migration ids are unique',()=>{
  const ids=MIGRATIONS.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
});

test('render and face-layout columns are part of automatic migrations',()=>{
  const sql=MIGRATIONS.map(x=>x.sql).join('\n');
  for(const column of [
    'layout_version','horizontal_align','text_rect','font_scale',
    'hook_style','max_lines','safe_for_auto_approval',
    'generation_projects','video_renders'
  ]){
    assert.ok(sql.includes(column),'missing '+column);
  }
});

test('current migration set includes persistent render contract',()=>{
  assert.ok(MIGRATIONS.some(x=>x.id==='010_render_contract.sql'));
});
