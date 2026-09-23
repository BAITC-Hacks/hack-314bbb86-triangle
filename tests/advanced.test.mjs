import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EXAMPLE} from '../shared/data.mjs';
import {simulate,calculate,projection,BASELINE} from '../shared/engine.mjs';
import {nextQuarterFacts} from '../shared/planning.mjs';
import {globalOptimum} from '../shared/optimum.mjs';
import certificate from '../shared/optimum-certificate.json' with {type:'json'};
import {executeWhatIf,whatIf,WHATIF_TOOLS} from '../backend/what-if.mjs';
import {browserSession,withBrowserSession} from '../backend/session.mjs';
import {openDatabase} from '../backend/sqlite.mjs';
import {api} from '../backend/api.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('Shapley efficiency, permutation invariance and independent 120-order oracle',()=>{
 const result=simulate(EXAMPLE),reverse=simulate([...EXAMPLE].reverse());
 near(result.shapley.reduce((s,x)=>s+x.value,0),result.delta);
 result.shapley.forEach(x=>near(x.value,reverse.shapley.find(y=>y.measureId===x.measureId).value));
 const sums=Object.fromEntries(EXAMPLE.map(x=>[x.measureId,0]));let permutations=0;
 function visit(order,remaining){if(!remaining.length){permutations++;let prior=BASELINE.score;for(let i=0;i<order.length;i++){const next=calculate(order.slice(0,i+1)).score;sums[order[i].measureId]+=next-prior;prior=next;}return;}remaining.forEach((d,i)=>visit([...order,d],remaining.filter((_,j)=>i!==j)));}
 visit([],EXAMPLE);assert.equal(permutations,120);result.shapley.forEach(x=>near(x.value,sums[x.measureId]/120));
});
test('optimum certificate matches exact current dataset and deterministic engine',async()=>{
 assert.equal(certificate.modelSourceSha256,createHash('sha256').update(await readFile(new URL('../shared/data.mjs',import.meta.url))).digest('hex'));
 const best=globalOptimum();near(best.result.score,57.236735);assert.equal(best.result.cost,98);assert.equal(best.feasibleScenarios,694395);assert.equal(certificate.optimalScenarioCount,1);
 near(best.result.shapley.reduce((s,x)=>s+x.value,0),best.result.delta);
});
test('tool replacements are preview-only, budget checked and never mutate original',()=>{
 const snapshot=JSON.stringify(EXAMPLE),r=executeWhatIf('evaluate_replacement',{removeId:'M5',addId:'M3',districtId:'nura'},EXAMPLE);
 assert.equal(r.result.valid,true);near(r.result.score,57.20556);assert.equal(r.result.cost,100);assert.equal(r.applied,false);assert.equal(JSON.stringify(EXAMPLE),snapshot);
 assert.equal(r.timing.unit,'quarters');assert.equal(r.timing.measures.find(m=>m.measureId==='M3').lagQuarters,4);assert.equal(r.changeFromCurrent.find(d=>d.id==='nura').metrics.S1,0);
 const over=executeWhatIf('evaluate_replacement',{removeId:'M12',addId:'M2',districtId:null},EXAMPLE);assert.equal(over.result.valid,false);assert.equal(over.result.score,null);
 assert.equal(executeWhatIf('evaluate_replacement',{removeId:'M1',addId:'M3',districtId:'nura'},EXAMPLE).error,'REMOVED_MEASURE_NOT_SELECTED');
 assert.equal(executeWhatIf('delete_scenario',{},EXAMPLE).error,'UNKNOWN_TOOL');
 const invalid=executeWhatIf('evaluate_scenario',{decisions:EXAMPLE.map(d=>({measureId:'M7',districtId:'nura'}))},EXAMPLE);assert.equal(invalid.result.valid,false);
});
test('quarter projections preserve Q0 and Q8 and recompute non-monotonic threshold effects',()=>{
 for(const decisions of [EXAMPLE,globalOptimum().decisions]){const series=projection(decisions);assert.equal(series.length,9);near(series[0].score,BASELINE.score);near(series[8].score,simulate(decisions).score);assert.deepEqual(series[8].districts,simulate(decisions).districts);}
 const bad=projection([{measureId:'M11',districtId:'almaty'}]);assert.ok(bad[2].score<bad[1].score);near(bad[2].districts.find(d=>d.id==='almaty').metrics.T1,39.75);
 assert.throws(()=>calculate(EXAMPLE,{quarter:9}));assert.throws(()=>calculate(EXAMPLE,{quarter:1.5}));
});
test('quarterly effects and synergies activate after both lags, never early',()=>{
 const s=projection([{measureId:'M10',districtId:'nura'},{measureId:'M12'}]);assert.equal(s[1].synergies.length,0);assert.equal(s[2].synergies.length,1);
 const school=projection([{measureId:'M7',districtId:'nura'}]);near(school[3].districts.find(d=>d.id==='nura').metrics.S1,38);near(school[4].districts.find(d=>d.id==='nura').metrics.S1,40);
 const first=nextQuarterFacts(EXAMPLE,0);assert.ok(first.measures.every(m=>m.stage==='waiting'));assert.equal(nextQuarterFacts(EXAMPLE,8).horizonComplete,true);assert.equal(nextQuarterFacts(EXAMPLE,1).measures.find(m=>m.measureId==='M12').stage,'first');
});
test('AI can allocate a full legal budget starting from an empty draft',async()=>{
 const best=executeWhatIf('global_optimum',{},[]);assert.equal(best.result.valid,true);assert.equal(best.decisions.length,5);assert.equal(best.result.cost,98);near(best.gain,best.result.score-BASELINE.score);assert.equal(best.applied,false);
 const response=await api(new Request('https://test.invalid/api/what-if',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisions:[],message:'Allocate budget',locale:'en'})}),{}, {id:'mayor',role:'mayor',kind:'account'});assert.equal(response.status,200);assert.equal((await response.json()).reason,'NO_API_KEY');
});
test('function calling round trip passes verified facts and retains provider call IDs',async()=>{
 const calls=[];const fetcher=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return calls.length===1?Response.json({status:'completed',output:[{type:'function_call',id:'fc_1',call_id:'call_1',name:'evaluate_replacement',arguments:JSON.stringify({removeId:'M5',addId:'M3',districtId:'nura'})}]}):Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Verified explanation.'}]}]});};
 const result=await whatIf({message:'Replace M5 with M3 in Nura',decisions:EXAMPLE,locale:'en'},{OPENAI_API_KEY:'test-only'},fetcher);
 assert.equal(result.mode,'ai');assert.equal(calls.length,2);assert.equal(calls[0].store,false);assert.equal(calls[0].tool_choice,'required');assert.equal(calls[0].parallel_tool_calls,false);
 const output=calls[1].input.find(x=>x.type==='function_call_output');assert.equal(output.call_id,'call_1');near(JSON.parse(output.output).result.score,57.20556);
 assert.equal(result.trace[0].result.applied,false);assert.ok(WHATIF_TOOLS.every(t=>t.strict&&t.parameters.additionalProperties===false));
});
test('provider failures return honest local status and retain any completed calculations',async()=>{
 assert.equal((await whatIf({decisions:EXAMPLE,message:'hello',locale:'kk'},{},()=>{throw Error('should not call');})).reason,'NO_API_KEY');
 const unavailable=await whatIf({decisions:EXAMPLE,message:'hello',locale:'ru'},{OPENAI_API_KEY:'test-only'},async()=>new Response('',{status:429}));assert.equal(unavailable.mode,'local');assert.equal(unavailable.reason,'AI_UNAVAILABLE');
 const ungrounded=await whatIf({decisions:EXAMPLE,message:'hello',locale:'en'},{OPENAI_API_KEY:'test-only'},async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Invented'}]}]}));assert.equal(ungrounded.mode,'local');
});
const secret='test-secret-not-a-real-credential'.repeat(2),request=cookie=>new Request('https://test.invalid/api/config',{headers:cookie?{cookie}:{}});
test('IP limit bounds attempts across authenticated accounts',async()=>{
 const db=openDatabase(':memory:');try{let provider=0;const env={DB:db,OPENAI_API_KEY:'test-only',FETCHER:async()=>{provider++;return new Response('',{status:503});}};let response;
 for(let i=0;i<7;i++){const req=new Request('https://test.invalid/api/what-if',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({decisions:EXAMPLE,message:'best',locale:'en'})});response=await api(req,env,{id:'visitor'+i,role:'manager',kind:'account'});}
 assert.equal(provider,6);assert.equal((await response.json()).reason,'AI_LIMIT');}finally{db.close();}
});
