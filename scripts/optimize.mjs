// Exhaustive certificate for the supplied finite Astana model.
// Run: node scripts/optimize.mjs
// Optional first argument: path to another identical-layout shared/ directory.
// Writes a reproducible certificate to shared/optimum-certificate.json.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const shared = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]) + '/').href
  : new URL('../shared/', import.meta.url).href;
const modelUrl = new URL('data.mjs', shared);
const {BUDGET,HORIZON,VERSION,DISTRICTS,MEASURES,METRICS,SYNERGIES} = await import(modelUrl);
const {simulate,calculate,validate,BASELINE} = await import(new URL('engine.mjs',shared));
const started = performance.now();
// This exact-rational implementation is intentionally specific to the given model.
// It fails loudly if denominators or the horizon change.
assert.equal(HORIZON,8);
const integral = x => {const rounded=Math.round(x);assert.ok(Math.abs(x-rounded)<1e-9);return rounded;};
const metricKeys = Object.keys(METRICS);
const weights = metricKeys.map(k => integral(METRICS[k].weight*100));
const population = DISTRICTS.map(d => integral(d.population*100));
assert.equal(weights.reduce((a,b)=>a+b,0),100);
assert.equal(population.reduce((a,b)=>a+b,0),100);
const initial = DISTRICTS.flatMap(d=>metricKeys.map(k=>integral(d.metrics[k]*8)));
const metrics = Int16Array.from(initial);
const indexOfMetric = Object.fromEntries(metricKeys.map((k,i)=>[k,i]));
const measureIndex = new Map(MEASURES.map((m,i)=>[m.id,i]));
const localConflicts = [['M4','M7'],['M5','M13']].map(pair=>pair.map(id=>measureIndex.get(id)));
assert.ok(measureIndex.get('M1')<measureIndex.get('M3'),'Expected catalog order');
assert.ok(localConflicts.every(([a,b])=>a<b),'Expected catalog order');
const denominator=800000;

function integerScore() {
  let weighted=0,minimum=Infinity,critical=0;
  for(let d=0;d<DISTRICTS.length;d++){
    let district=0;
    for(let k=0;k<metricKeys.length;k++){
      const value=Math.max(0,Math.min(800,metrics[d*metricKeys.length+k]));
      district+=weights[k]*value;
      if(value<320)critical++;
    }
    weighted+=population[d]*district;
    minimum=Math.min(minimum,district);
  }
  return 7*weighted+300*minimum-denominator*critical;
}
assert.ok(Math.abs(integerScore()/denominator-BASELINE.score)<1e-10);

const baseVariants=MEASURES.map(m => (m.scope==='city'?[-1]:DISTRICTS.map((_,i)=>i)).map(target=>{
  const touched=m.scope==='city'?DISTRICTS.map((_,i)=>i):[target];
  const changes=[];
  for(const d of touched)for(const [key,effect] of Object.entries(m.effects))changes.push([d*metricKeys.length+indexOfMetric[key],integral(effect*(8-m.lag))]);
  return {target,changes};
}));
const chosen=[],counts=new Map(),assigned=new Int16Array(MEASURES.length).fill(-2);
let feasible=0,measureSets=0,unconstrainedAssignments=0,best=-Infinity,bestTies=0;
const top=[],samples=[];
const materialize=()=>chosen.map(i=>assigned[i]===-1?{measureId:MEASURES[i].id}:{measureId:MEASURES[i].id,districtId:DISTRICTS[assigned[i]].id});

function evaluate(cost) {
  feasible++;
  const numerator=integerScore();
  if(numerator>best){best=numerator;bestTies=1;}else if(numerator===best)bestTies++;
  if(top.length<10||numerator>top.at(-1).numerator){
    top.push({numerator,score:numerator/denominator,cost,decisions:materialize()});
    top.sort((a,b)=>b.numerator-a.numerator||a.cost-b.cost);
    if(top.length>10)top.length=10;
  }
  // Deterministic stratified samples spanning the entire traversal, not only winners.
  if(feasible%997===0)samples.push({numerator,decisions:materialize()});
}

function visitAssignments(position,variants,cost) {
  if(position===chosen.length){evaluate(cost);return;}
  const i=chosen[position];
  for(const variant of variants[position]){
    if(localConflicts.some(([a,b])=>i===b&&assigned[a]===variant.target))continue;
    assigned[i]=variant.target;
    for(const [offset,value] of variant.changes)metrics[offset]+=value;
    visitAssignments(position+1,variants,cost);
    for(const [offset,value] of variant.changes)metrics[offset]-=value;
    assigned[i]=-2;
  }
}

function visitMeasures(start,cost) {
  if(chosen.length===5){
    measureSets++;
    const included=new Set(chosen);
    const variants=chosen.map(i=>baseVariants[i].map(v=>({target:v.target,changes:[...v.changes]})));
    for(const synergy of SYNERGIES){
      const first=measureIndex.get(synergy.pair[0]),second=measureIndex.get(synergy.pair[1]);
      if(!included.has(first)||!included.has(second))continue;
      for(const v of variants[chosen.indexOf(first)]){
        assert.ok(v.target>=0,'The given synergies act in the first local measure district');
        for(const [key,bonus] of Object.entries(synergy.effects))v.changes.push([v.target*metricKeys.length+indexOfMetric[key],integral(bonus*8)]);
      }
    }
    unconstrainedAssignments+=variants.reduce((n,v)=>n*v.length,1);
    visitAssignments(0,variants,cost);
    return;
  }
  for(let i=start;i<=MEASURES.length-(5-chosen.length);i++){
    const m=MEASURES[i];
    if(cost+m.cost>BUDGET||(counts.get(m.category)||0)>=2)continue;
    if(m.id==='M3'&&chosen.includes(measureIndex.get('M1')))continue;
    chosen.push(i);counts.set(m.category,(counts.get(m.category)||0)+1);
    visitMeasures(i+1,cost+m.cost);
    counts.set(m.category,counts.get(m.category)-1);chosen.pop();
  }
}
visitMeasures(0,0);
assert.deepEqual([...metrics],initial,'Recursion must restore the starting metrics');
const enumerationMs=performance.now()-started;
// Independent count: bitmask enumeration and a closed-form assignment count.
// The two incompatible local pairs are disjoint; each contributes d*(d-1)
// instead of d*d target choices when both measures are present.
let independentMeasureSets=0,independentFeasibleScenarios=0;
for(let bits=0;bits<2**MEASURES.length;bits++){
  const set=MEASURES.filter((_,i)=>bits&(1<<i));
  if(set.length!==5||set.reduce((s,m)=>s+m.cost,0)>BUDGET)continue;
  const byCategory={};for(const m of set)byCategory[m.category]=(byCategory[m.category]||0)+1;
  if(Object.values(byCategory).some(n=>n>2))continue;
  const ids=new Set(set.map(m=>m.id));
  if(ids.has('M1')&&ids.has('M3'))continue;
  const local=set.filter(m=>m.scope==='district').length;
  const conflicts=Number(ids.has('M4')&&ids.has('M7'))+Number(ids.has('M5')&&ids.has('M13'));
  independentMeasureSets++;
  independentFeasibleScenarios+=DISTRICTS.length**(local-conflicts)*(DISTRICTS.length-1)**conflicts;
}
assert.equal(independentMeasureSets,measureSets);
assert.equal(independentFeasibleScenarios,feasible);
for(const candidate of [...top,...samples]){
  assert.equal(validate(candidate.decisions).valid,true);
  const reference=calculate(candidate.decisions);
  assert.ok(Math.abs(reference.score-candidate.numerator/denominator)<1e-10,
    `Reference mismatch: ${JSON.stringify(candidate.decisions)}`);
}
for(const candidate of top){
  const reference=simulate(candidate.decisions);
  assert.equal(reference.valid,true);
  assert.equal(reference.cost,candidate.cost);
  assert.ok(Math.abs(reference.score-candidate.score)<1e-10);
}
const result={
  algorithm:'Exhaustive increasing-index 5-measure subsets and every district assignment; exact integer scoring',
  modelVersion:VERSION,
  dataFingerprint:JSON.stringify({BUDGET,HORIZON,DISTRICTS,MEASURES,METRICS,SYNERGIES}),
  modelSourceSha256:createHash('sha256').update(await readFile(modelUrl)).digest('hex'),
  scoreDenominator:denominator,
  validMeasureSetsBeforeLocalConflicts:measureSets,
  districtAssignmentsBeforeLocalConflicts:unconstrainedAssignments,
  feasibleScenarios:feasible,
  uniqueDecisionSets:true,
  bestScoreNumerator:best,
  bestScore:best/denominator,
  optimalScenarioCount:bestTies,
  baseline:BASELINE.score,
  best:top[0],
  top10:top,
  verification:{topCandidatesViaSimulate:top.length,sampledCandidatesViaCalculate:samples.length,independentMeasureSets,independentFeasibleScenarios,tolerance:1e-10},
  enumerationMs:Math.round(enumerationMs*100)/100,
  totalMs:Math.round((performance.now()-started)*100)/100,
  node:process.version,
  createdAt:new Date().toISOString(),
};
await writeFile(new URL('../shared/optimum-certificate.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,dataFingerprint:undefined,top10:undefined},null,2));
