const assert = require('node:assert/strict');
const E=require('../calc-engine.js');
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-8, `${x} != ${y}`);
const base={type:'area', areaSqm:2, count:1, plywoodThickness:'1/2', sheetCoverageSqm:2.44, plywoodWastePct:0,
 frameLumber:'2x3x10',braceLumber:'2x2x12',framingSpacingCm:40,braceSpacingM:2,braceLengthM:1.5,bracesPerStation:1,
 nailSize:'2',nailGram:2.8,nailsPerSqm:20,nailWastePct:0};
for(const [area,sheets] of [[2,1],[2.44,1],[2.5,2],[4.88,2],[5,3]]) {
 const r=E.formwork({...base,areaSqm:area});near(r.areaSqm,area);assert.equal(r.plywoodSheets,sheets);
 assert.equal(r.framingBars,0);assert.equal(r.braceBars,0);
}
assert.equal(E.formwork({...base, areaSqm:2.5, sheetCoverageSqm:2.9768}).plywoodSheets,1);
assert.equal(E.formwork({...base, areaSqm:2.44, plywoodWastePct:10}).plywoodSheets,2);
const slab=E.formwork({...base, type:'slab', length:4,width:2,count:1});
near(slab.areaSqm,8);
assert.equal(slab.framingStations,6); // width 2 / .4 + edge = 6 joists
assert.equal(slab.braceCount,2); // 4m run / 2m brace intervals
assert.equal(slab.plywoodSheets,4);
assert.ok(slab.framingBars>=6 && slab.braceBars>=1);
const column=E.formwork({...base,type:'column',length:3,width:.3,height:.4});
near(column.areaSqm,4.2);assert.equal(column.braceCount,2);
const beam=E.formwork({...base,type:'beam',length:4,width:.3,height:.5});near(beam.areaSqm,5.2);
const footing=E.formwork({...base,type:'footing',length:2,width:2,height:.4});near(footing.areaSqm,3.2);
const scaffold=E.formwork({...base,type:'scaffolding',length:4,width:2});near(scaffold.areaSqm,8);
for (const n of ['1','1.5','2','3','3-concrete']) assert.ok(E.formwork({...base,nailSize:n,nailGram:E.constants.formNails[n]}).nailCount>0);
for (const spec of E.constants.formLumber) assert.ok(E.formwork({...base,frameLumber:spec,braceLumber:spec}).plywoodSheets>0);
const prices={plywood:800,lumber:95,formnails:125};
const one=E.projectSummary([{module:'formwork',section:'slab',qty:slab}],prices);
assert.equal(one.lines.find(x=>x.key==='phenolic-1/2-2.44').qty,4);
assert.equal(one.lines.find(x=>x.key==='phenolic-1/2-2.44').rate,800);
assert.ok(one.lines.find(x=>x.key==='coco-2x3x10'));
assert.ok(one.lines.find(x=>x.key==='coco-2x2x12'));
assert.ok(one.lines.find(x=>x.key==='form-nails-2'));
const a=E.formwork({...base,areaSqm:1});
const both=E.projectSummary([{module:'formwork',section:'slab',qty:a},{module:'formwork',section:'beam',qty:a}],prices);
assert.equal(both.lines.find(x=>x.key==='phenolic-1/2-2.44').qty,1,'Project plywood area pooled before rounding');
assert.equal(both.lines.find(x=>x.key==='form-nails-2').qty,0.5,'Nails pooled before kg purchasing round');
const different=E.projectSummary([{module:'formwork',qty:a},{module:'formwork',qty:E.formwork({...base,plywoodThickness:'3/4'})}],prices);
assert.equal(different.lines.filter(x=>x.key.startsWith('phenolic-')).length,2);
const overridden=E.projectSummary([{module:'formwork',qty:slab}],{...prices,rateOverrides:{'phenolic-1/2-2.44':1080,'coco-2x2x12':120}});
assert.equal(overridden.lines.find(x=>x.key==='phenolic-1/2-2.44').rate,1080);
assert.equal(overridden.lines.find(x=>x.key==='coco-2x2x12').rate,120);
const latest=E.cost({formwork:slab},{...prices,cement:0,steel:0,ties:0,paint:0,primer:0,tile:0,adhesive:0,grout:0,nails:0,sand:0,gravel:0,wire:0,labor:0,workers:0,days:0,overheadPct:0,contingencyPct:0});
assert.ok(latest.lines.some(l=>l.label.includes('Phenolic plywood')));
assert.ok(latest.total>0);
assert.throws(()=>E.formwork({...base,areaSqm:0}),/positive/);
assert.throws(()=>E.formwork({...base,sheetCoverageSqm:0}),/positive/);
assert.throws(()=>E.formwork({...base,plywoodThickness:'1/4'}),/Choose phenolic/);
assert.throws(()=>E.formwork({...base,braceSpacingM:0}),/positive/);
assert.throws(()=>E.formwork({...base,frameLumber:'3x8x40'}),/valid coco lumber/);
console.log('PASS: formwork plywood 2.44 m² sheet rounding, manual sqm, all sections, joists at 40 cm, braces at 2 m, all lumber/nail options, combined BOQ and price overrides, legacy cost.');
console.log('Slab example: area',slab.areaSqm,'m², plywood',slab.plywoodSheets,'sheets, joists',slab.framingStations,'stations, braces',slab.braceCount);
