const assert=require('node:assert/strict');
const E=require('../calc-engine.js');
function near(a,b,msg){assert.ok(Math.abs(a-b)<1e-8,`${msg||''}: ${a} vs ${b}`);}
const chb=E.chb({length:4,height:3,count:1,openings:0,thickness:'10',mixClass:'B',wastePct:0});
near(chb.area,12);assert.equal(chb.blocks,150);near(chb.cementExactBags,6.264);assert.equal(chb.bags,7);near(chb.sand,.522);
const chb15=E.chb({length:4,height:3,count:1,openings:0,thickness:'15',mixClass:'B',wastePct:0});near(chb15.cementExactBags,12*1.018);near(chb15.sand,12*.0844);
const plaster=E.plaster({length:4,height:3,count:1,faces:2,openings:0,mixClass:'B',thicknessMm:16,wastePct:0});
near(plaster.area,24);near(plaster.cementExactBags,4.608);assert.equal(plaster.bags,5);near(plaster.sand,.384);
const withOpenings=E.chb({length:4,height:3,count:2,openings:2,thickness:'10',mixClass:'B',wastePct:0});near(withOpenings.area,20);assert.equal(withOpenings.blocks,250);
const concrete40=E.concrete({project:'slab',length:1,width:1,height:1,count:1,mixClass:'A',wastePct:0,bagKg:40});
const concrete50=E.concrete({project:'slab',length:1,width:1,height:1,count:1,mixClass:'A',wastePct:0,bagKg:50});
assert.equal(concrete40.bags,9);assert.equal(concrete50.bags,7);assert.equal(concrete50.bagKg,50);
for(const [k,n40,n50] of [['AA',12,9.5],['A',9,7],['B',7.5,6],['C',6,5]]) {
 near(E.constants.concrete[k].cement,n40);near(E.constants.concrete[k].cement50,n50);
}
for(const [t,r] of [['rough',30],['medium',35],['smooth',40]])near(E.constants.paintSurfaceGallon[t],r);
const wood=E.lumber({spec:'2x3x10',memberLengthM:2,count:10,wastePct:0});
assert.equal(wood.stockPieces,10);near(wood.boardFeetNet,2*3*(2/.3048)*10/12);near(wood.boardFeetToBuy,50);
const short=E.lumber({spec:'2x3x10',memberLengthM:1,count:10,wastePct:0});assert.equal(short.stockPieces,4);
const project=E.projectSummary([
 {module:'chb',section:'chb',qty:chb}, {module:'plaster',section:'plaster',qty:plaster},
 {module:'concrete',section:'footing',qty:concrete50},{module:'lumber',section:'lumber',qty:wood}
],{chb:20,cement:250,cement50:300,sand:1000,gravel:1200,lumber:110});
assert.equal(project.lines.find(x=>x.key==='chb-10cm').qty,150);
assert.equal(project.lines.find(x=>x.key==='cement-40').qty,11,'Combined mortar cement rounded once');
assert.equal(project.lines.find(x=>x.key==='cement-50').qty,7);
near(project.lines.find(x=>x.key==='sand').qty,.906 + .5);
assert.equal(project.lines.find(x=>x.key==='coco-2x3x10').qty,10);
assert.throws(()=>E.chb({length:2,height:3,count:1,openings:7,thickness:'10',mixClass:'B'}),/openings/i);
assert.throws(()=>E.plaster({length:3,height:3,count:1,faces:3,openings:0,mixClass:'B',thicknessMm:16}),/faces/i);
assert.throws(()=>E.lumber({spec:'2x3x10',memberLengthM:4,count:1,wastePct:0}),/longer/i);
console.log('PASS: Fajardo CHB Tables 2-2/2-3 (p.53-54), Plaster Table 2-4 (p.56), concrete 40/50kg Table 1-2 (p.8), paint p.312 and timber board-feet p.151');
console.log('PASS: pooled 40/50kg cement and lumber across sections, separate CHB and plaster, input validation');
