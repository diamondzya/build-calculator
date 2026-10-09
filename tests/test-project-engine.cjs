const assert = require('node:assert/strict');
const engine = require('../calc-engine.js');
const near = (a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
const base = {project:'column',length:6,width:.3,height:.4,spacingCm:15,coverMm:40,
 stockLength:6,size:12,tieSize:10,layers:1,longitudinalBars:4,
 elementCount:1,excavationDepth:1.5,bottomHookM:.4,topHookM:.2,lapLength:.6,
 minSplices:0,stirrupHookDb:10,wireLengthCm:30,wirePerJoin:1,wireWastePct:10,wireGramPerM:15.8};
const col6 = engine.steel(base);
near(col6.verticalLength,7.5); near(col6.mainRunLength,8.1);
assert.equal(col6.spliceCount,4); near(col6.mainLength,34.8);
assert.equal(col6.mainPieces,8); assert.equal(col6.stirrups,51); assert.equal(col6.tieWireJoints,204);
near(col6.tieWireKg,204*.3*.0158*1.1); assert.equal(col6.wireBuyKg,1.5);
const col9 = engine.steel({...base,stockLength:9});
const col12= engine.steel({...base,stockLength:12});
assert.equal(col9.mainPieces,4); assert.equal(col12.mainPieces,4);
assert.equal(col9.spliceCount,0); assert.equal(col12.spliceCount,0);
assert.equal(col6.mainPieces,8); assert.equal(col6.stirrupCutLength,1.28);
const two = engine.steel({...base,elementCount:2});
assert.equal(two.stirrups,102); assert.equal(two.mainBars,8); assert.equal(two.mainPieces,16);
assert.equal(two.spliceCount,8);
const footing = engine.steel({ ...base, project:'footing', length:2,width:2,height:.4,layers:2,
  elementCount:3,stockLength:6,excavationDepth:1.5 });
assert.ok(footing.mainPieces>0); assert.ok(footing.tieWireKg>0); assert.equal(footing.tiePieces,0);
assert.equal(footing.tieWireJoints,(footing.countLengthwise/2)*(footing.countWidthwise/2)*2/3);
const prices = {cement:260,steel:350,ties:180,wire:115,paint:0,primer:0,tile:0,
 adhesive:0,grout:0,nails:0,sand:1000,gravel:1200,labor:0,days:1,workers:1,overheadPct:0,contingencyPct:0};
const separate = engine.projectSummary([{module:'steel',section:'column',qty:col6}],prices);
const combined = engine.projectSummary([{module:'steel',section:'column',qty:col6},
 {module:'steel',section:'column',qty:col6}],prices);
const wire = combined.lines.find(x=>x.key==='wire-16');
assert.equal(wire.qty,2.5); // round total 2.127 kg up to half kg
assert.ok(combined.lines.find(x=>x.key==='main-12mm-6m'));
assert.equal(combined.lines.find(x=>x.key==='main-12mm-6m').qty,16);
assert.equal(combined.lines.find(x=>x.key==='tie-10mm-6m').rate,180);
const override = engine.projectSummary([{module:'steel',section:'column',qty:col9}], {...prices,rateOverrides:{'main-12mm-9m':470}});
assert.equal(override.lines.find(x=>x.key==='main-12mm-9m').rate,470);
const concrete = engine.concrete({project:'column',length:.3,width:.4,height:3,belowFloorM:1.5,count:2,mixClass:'A',wastePct:5});
near(concrete.volume,.3*.4*4.5*2); near(concrete.totalHeight,4.5);
const merged = engine.projectSummary([
 {module:'concrete',section:'column',qty:concrete},{module:'steel',section:'column',qty:col9},
 {module:'steel',section:'footing',qty:footing}], prices);
assert.ok(merged.lines.find(x=>x.key==='cement-40'));
assert.ok(merged.lines.find(x=>x.key==='wire-16'));
assert.ok(merged.lines.find(x=>x.key==='main-12mm-9m'));
assert.ok(merged.lines.find(x=>x.key==='main-12mm-6m'));
assert.throws(()=>engine.steel({...base,lapLength:0}),/Splicing/);
assert.throws(()=>engine.steel({...base,stockLength:8}),/6 m, 9 m or 12 m/);
assert.throws(()=>engine.projectSummary([{module:'steel',section:'column',qty:{mainPieces:4}}],prices),/Old rebar/);
console.log('PASS: Column FFL + excavation + hooks + laps; 6/9/12 m stock; stirrups; tie wire; multiple elements; grouped project materials, price overrides, concrete below grade.');
console.log('6m column bars:',col6.mainPieces,'9m:',col9.mainPieces,'12m:',col12.mainPieces,'splice joints:',col6.spliceCount);
