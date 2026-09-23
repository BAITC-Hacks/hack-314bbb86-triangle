import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, validate, calculate, simulate, recommend, clip } from '../shared/engine.mjs';
import { DISTRICTS, MEASURES, METRICS, EXAMPLE } from '../shared/data.mjs';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('dataset invariants: 5 districts, 14 measures, normalized weights and populations',()=>{
  assert.equal(DISTRICTS.length,5); assert.equal(MEASURES.length,14);
  near(Object.values(METRICS).reduce((s,m)=>s+m.weight,0),1);
  near(DISTRICTS.reduce((s,d)=>s+d.population,0),1);
  assert.ok(DISTRICTS.every(d=>Object.keys(d.metrics).length===10));
});
test('baseline independently matches supplied district scores and exact formula',()=>{
  BASELINE.districts.forEach((d,i)=>near(d.score,[62.99,57.06,54.65,56.63,49.18][i]));
  near(BASELINE.average,56.8624); near(BASELINE.score,52.55768);
  assert.deepEqual(BASELINE.critical.map(x=>x.key),['S1','S2']);
});
test('organizer example: cost 95, lag effects, fixed synergy and score',()=>{
  const r=simulate(EXAMPLE);assert.equal(r.valid,true);assert.equal(r.cost,95);
  near(r.score,56.54307);near(r.delta,3.98539);assert.equal(r.critical.length,0);
  const nura=r.districts.find(d=>d.id==='nura');
  near(nura.metrics.S1,48);near(nura.metrics.S2,43.75);near(nura.metrics.B1,67.5);
  assert.equal(r.synergies.length,1);
});
test('exactly five decisions for final result, partial preview allowed',()=>{
  for(const d of [[],EXAMPLE.slice(0,4),[...EXAMPLE,{measureId:'M2'}]]) {
    assert.equal(simulate(d).score,null);assert.equal(simulate(d).valid,false);
  }
  assert.equal(validate(EXAMPLE.slice(0,2),{partial:true}).valid,true);
});
test('reject malformed JSON values and unknown ids without crashing',()=>{
  for(const input of [null,{},'x',42,[null],[[]],[{measureId:'toString'}],[{measureId:4}],[{measureId:'M100'}]]) assert.equal(validate(input).valid,false);
  assert.equal(validate([{measureId:'M12',score:100}],{partial:true}).valid,false);
});
test('district mandatory for local, prohibited for city even null',()=>{
  for(const d of [{measureId:'M1'},{measureId:'M1',districtId:'unknown'},{measureId:'M12',districtId:'nura'},{measureId:'M12',districtId:null}]) assert.equal(validate([d],{partial:true}).valid,false);
});
test('reject duplicates and more than two measures in category',()=>{
  assert.equal(validate([EXAMPLE[0],EXAMPLE[0]],{partial:true}).valid,false);
  assert.equal(validate([{measureId:'M7',districtId:'nura'},{measureId:'M8',districtId:'nura'},{measureId:'M9',districtId:'nura'}],{partial:true}).valid,false);
});
test('budget accepts 100 exactly, rejects 101 and above',()=>{
  const exact=[{measureId:'M3',districtId:'nura'},{measureId:'M7',districtId:'nura'},{measureId:'M6'},{measureId:'M11',districtId:'esil'},{measureId:'M14'}];
  assert.equal(simulate(exact).cost,100);assert.equal(simulate(exact).valid,true);
  const over=[{measureId:'M3',districtId:'nura'},{measureId:'M8',districtId:'nura'},{measureId:'M5',districtId:'saryarka'},{measureId:'M10',districtId:'esil'},{measureId:'M14'}];
  assert.equal(validate(over).cost,103);assert.ok(validate(over).errors.some(e=>e.includes('Бюджет')));
});
test('transport incompatibility is global, land and utility conflicts local',()=>{
  assert.equal(validate([{measureId:'M1',districtId:'esil'},{measureId:'M3',districtId:'nura'}],{partial:true}).valid,false);
  for(const [a,b] of [['M4','M7'],['M5','M13']]) {
    assert.equal(validate([{measureId:a,districtId:'nura'},{measureId:b,districtId:'nura'}],{partial:true}).valid,false);
    assert.equal(validate([{measureId:a,districtId:'nura'},{measureId:b,districtId:'esil'}],{partial:true}).valid,true);
  }
});
test('all synergy pairs apply only to first measure district and without lag',()=>{
  const transit=calculate([{measureId:'M1',districtId:'nura'},{measureId:'M2'}]);
  near(transit.districts.find(d=>d.id==='nura').metrics.T1,55+6*.75+4*.75+2);
  near(transit.districts.find(d=>d.id==='esil').metrics.T1,45+4*.75);
  const eco=calculate([{measureId:'M5',districtId:'saryarka'},{measureId:'M6'}]);
  near(eco.districts.find(d=>d.id==='saryarka').metrics.E2,40+14*.625+3*.5+2);
});
test('city effects reach all districts, negative effects retained, strict threshold 40',()=>{
  const r=calculate([{measureId:'M12'},{measureId:'M11',districtId:'nura'}]);
  r.districts.forEach((d,i)=>near(d.metrics.C2,DISTRICTS[i].metrics.C2+4.375));
  near(r.districts.find(d=>d.id==='nura').metrics.T1,53.25);
  assert.equal(BASELINE.critical.some(c=>c.key==='T2'),false);
  assert.equal(clip(110),100);assert.equal(clip(-4),0);assert.equal(clip(40),40);
});
test('ordering invariant, input data immutable, differences affect score',()=>{
  const snapshot=JSON.stringify({DISTRICTS,EXAMPLE});
  near(simulate(EXAMPLE).score,simulate([...EXAMPLE].reverse()).score);
  const next=EXAMPLE.map(d=>d.measureId==='M10'?{...d,districtId:'esil'}:d);
  assert.notEqual(simulate(EXAMPLE).score,simulate(next).score);
  assert.equal(JSON.stringify({DISTRICTS,EXAMPLE}),snapshot);
});
test('cheapest organizer example valid with nonconflicting districts',()=>{
  const choices=[{measureId:'M9',districtId:'nura'},{measureId:'M11',districtId:'nura'},{measureId:'M10',districtId:'nura'},{measureId:'M12'},{measureId:'M4',districtId:'saryarka'}];
  assert.equal(simulate(choices).cost,61);assert.equal(simulate(choices).valid,true);
});
test('recommendations are valid single replacements with verified positive gains',()=>{
  const recs=recommend(EXAMPLE);assert.ok(recs.length>0);near(recs[0].score,57.20556);
  for(const r of recs) {assert.equal(validate(r.decisions).valid,true);near(simulate(r.decisions).score,r.score);assert.ok(r.gain>0);near(r.gain,r.score-simulate(EXAMPLE).score);}
});

