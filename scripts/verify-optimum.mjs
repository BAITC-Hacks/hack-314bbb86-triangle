// Independent exhaustive oracle: bitmask measure subsets, base-N target tuples,
// and only the product's validator/calculator for feasibility and scores.
import {MEASURES,DISTRICTS,BUDGET} from '../shared/data.mjs';
import {validate,calculate} from '../shared/engine.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const start=performance.now();let checked=0,feasible=0,best=-Infinity,bestDecisions,bestTies=0;
for(let mask=0;mask<2**MEASURES.length;mask++){
 const set=MEASURES.filter((_,i)=>mask&(2**i));
 if(set.length!==5||set.reduce((n,m)=>n+m.cost,0)>BUDGET)continue;
 const categories={};for(const m of set)categories[m.category]=(categories[m.category]||0)+1;
 if(Object.values(categories).some(n=>n>2))continue;
 if(set.some(m=>m.id==='M1')&&set.some(m=>m.id==='M3'))continue;
 const locals=set.filter(m=>m.scope==='district').length;
 for(let tuple=0;tuple<DISTRICTS.length**locals;tuple++){
  let value=tuple;
  const decisions=set.map(m=>{if(m.scope==='city')return {measureId:m.id};const districtId=DISTRICTS[value%DISTRICTS.length].id;value=Math.floor(value/DISTRICTS.length);return {measureId:m.id,districtId}});
  checked++;if(!validate(decisions).valid)continue;feasible++;
  const score=calculate(decisions).score;
  if(score>best+1e-10){best=score;bestDecisions=decisions;bestTies=1;}
  else if(Math.abs(score-best)<1e-10)bestTies++;
 }
}
const certificate=JSON.parse(await readFile(new URL('../shared/optimum-certificate.json',import.meta.url)));
assert.equal(checked,certificate.districtAssignmentsBeforeLocalConflicts);
assert.equal(feasible,certificate.feasibleScenarios);
assert.ok(Math.abs(best-certificate.bestScore)<1e-10);
assert.deepEqual(bestDecisions,certificate.best.decisions);
assert.equal(bestTies,certificate.optimalScenarioCount);
console.log(JSON.stringify({checked,feasible,best,bestDecisions,bestTies,ms:Math.round(performance.now()-start)},null,2));
