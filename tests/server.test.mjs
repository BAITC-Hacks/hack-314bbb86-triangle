import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { analyze, buildFacts } from '../advisor.mjs';
import { simulate } from '../public/engine.mjs';
import { EXAMPLE } from '../public/data.mjs';
const facts=buildFacts(EXAMPLE,simulate(EXAMPLE));
async function running(t,options={}) {
  const server=createApp({apiKey:'',...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return `http://127.0.0.1:${server.address().port}`;
}
const post=(base,path,data)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('HTTP config and static assets available; environment and source not exposed',async t=>{
  const base=await running(t);
  const config=await(await fetch(base+'/api/config')).json();assert.equal(config.budget,100);assert.equal(config.aiConfigured,false);
  for(const path of ['/','/app.mjs','/styles.css','/data.mjs','/engine.mjs','/storage.mjs','/favicon.svg']) assert.equal((await fetch(base+path)).status,200);
  for(const path of ['/.env','/server.mjs','/../.env','/unknown']) assert.equal((await fetch(base+path)).status,404);
});
test('server recomputes result, ignores supplied cost/score, rejects invalid decisions',async t=>{
  const base=await running(t);
  const response=await post(base,'/api/simulate',{decisions:EXAMPLE,score:100,cost:0});
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.cost,95);assert.ok(Math.abs(data.score-56.54307)<1e-9);
  const invalid=await post(base,'/api/simulate',{decisions:EXAMPLE.slice(0,4)});assert.equal(invalid.status,400);assert.equal((await invalid.json()).score,null);
});
test('API rejects malformed JSON, large bodies, wrong content types and cross-origin requests',async t=>{
  const base=await running(t);
  assert.equal((await fetch(base+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await post(base,'/api/simulate',{x:'x'.repeat(20000)})).status,413);
  assert.equal((await fetch(base+'/api/simulate',{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/simulate',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/config')).status,200);
});
test('local analysis explicit and rate limit enforced',async t=>{
  const base=await running(t);
  for(let i=0;i<5;i++) {
    const response=await post(base,'/api/analyze',{decisions:EXAMPLE});assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.mode,'local');assert.ok(data.report.risks.length>0);assert.ok(data.recommendations.length>0);
  }
  assert.equal((await post(base,'/api/analyze',{decisions:EXAMPLE})).status,429);
});
test('AI success parses structured response and sends computed facts server-side',async()=>{
  const report={summary:'Анализ',strengths:['Нура'],risks:['Лаг'],recommendations:['Сравнить']};
  let request;
  const result=await analyze(facts,{apiKey:'fake-test-key',fetcher:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');request=JSON.parse(options.body);
    assert.equal(options.headers.Authorization,'Bearer fake-test-key');
    return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(report)}]}]})};
  }});
  assert.equal(result.mode,'ai');assert.deepEqual(result.report,report);assert.equal(request.store,false);
  assert.equal(JSON.parse(request.input).result.cost,95);
});
test('AI failures, refusal, invalid schema and incomplete output fall back honestly',async()=>{
  for(const fetcher of [async()=>{throw new Error('offline')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({output:[]})}),
    async()=>({ok:true,json:async()=>({status:'incomplete'})}),
    async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'{"summary":42}'}]}]})})]) {
    const r=await analyze(facts,{apiKey:'fake-test-key',fetcher});assert.equal(r.mode,'local');assert.ok(r.reason);assert.ok(r.report.strengths.length>0);
  }
});
