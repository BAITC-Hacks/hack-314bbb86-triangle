import {simulate,validate} from '../shared/engine.mjs';
import {VERSION} from '../shared/data.mjs';
import {factsFor,localReport,explain} from './advisor.mjs';
import {rows,one,run,quota,hash} from './database.mjs';
import {whatIf} from './what-if.mjs';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(code,status=400)=>json({error:code},status);
const cleanName=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null;
export function scenarioDTO(row) {
 const decisions=JSON.parse(row.decisions_json),result=simulate(decisions);
 return {id:row.id,name:row.name,team:row.team,decisions,result,shareId:row.share_id,published:Boolean(row.published),createdAt:row.created_at,updatedAt:row.updated_at,version:row.version};
}
async function readBody(request) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw {code:'JSON_REQUIRED',status:415};
 if(Number(request.headers.get('content-length')||0)>16384)throw {code:'TOO_LARGE',status:413};
 const reader=request.body?.getReader();let total=0,parts=[];
 if(!reader)throw {code:'INVALID_JSON',status:400};
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>16384){await reader.cancel();throw {code:'TOO_LARGE',status:413};}parts.push(value);}
 const combined=new Uint8Array(total);let offset=0;for(const p of parts){combined.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder().decode(combined));}catch{throw {code:'INVALID_JSON',status:400};}
}
export async function api(request,env,identity=null) {
 try {
 const url=new URL(request.url),path=url.pathname,method=request.method,db=env.DB;
 const user=identity;
 if(method==='GET'&&path==='/api/config')return json({version:VERSION,budget:100,horizon:8,aiConfigured:Boolean(env.OPENAI_API_KEY),user:user?{name:user.name,kind:user.kind||'browser'}:null,local:env.LOCAL==='1'});
 if(method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return fail('ORIGIN_DENIED',403);
 if(path==='/api/simulate'&&method==='POST'){
  const input=await readBody(request),result=simulate(input?.decisions);return json(result,result.valid?200:400);
 }
 if(path==='/api/analyze'&&method==='POST'){
  const input=await readBody(request),result=simulate(input?.decisions);if(!result.valid)return json(result,400);
  const locale=['kk','ru','en'].includes(input.locale)?input.locale:'kk',facts=factsFor(input.decisions,result,locale);
  const base={result,recommendations:facts.recommendations};
  if(!user)return fail('WORKSPACE_UNAVAILABLE',503);
  if(!env.OPENAI_API_KEY)return json({...base,mode:'local',reason:'NO_API_KEY',report:localReport(facts,locale)});
  if(!db)return fail('DATABASE_UNAVAILABLE',503);
  const key=await hash(JSON.stringify({d:[...input.decisions].sort((a,b)=>a.measureId.localeCompare(b.measureId)),locale,reportVersion:4,version:VERSION,model:env.OPENAI_MODEL||'gpt-4.1-mini'}));
  const cache=await one(db,'SELECT response_json FROM analyses WHERE id=?',key);
  if(cache)return json({...base,...JSON.parse(cache.response_json),cached:true});
  const day=new Date().toISOString().slice(0,10),minute=new Date().toISOString().slice(0,16);
  const ip=env.LOCAL!=='1'&&request.headers.get('cf-connecting-ip');
  if(ip&&!await quota(db,`ai-ip:${await hash(ip)}:${minute}`,6))return json({...base,mode:'local',reason:'AI_LIMIT',report:localReport(facts,locale)});
  if(!await quota(db,`ai-user:${user.id}:${minute}`,3)||!await quota(db,`ai-global:${day}`,Number(env.AI_DAILY_LIMIT)||60))return json({...base,mode:'local',reason:'AI_LIMIT',report:localReport(facts,locale)});
  const analysis=await explain(facts,locale,env,env.FETCHER||fetch);
  if(analysis.mode==='ai')await run(db,'INSERT OR IGNORE INTO analyses (id,response_json,created_at) VALUES (?,?,?)',key,JSON.stringify(analysis),new Date().toISOString());
  return json({...base,...analysis});
 }
 if(path==='/api/what-if'&&method==='POST'){
  const input=await readBody(request),result=validate(input?.decisions,{partial:true});if(!result.valid)return json(result,400);
  if(!user)return fail('WORKSPACE_UNAVAILABLE',503);
  if(typeof input.message!=='string'||!input.message.trim()||input.message.length>600)return fail('INVALID_QUESTION');
  const locale=['kk','ru','en'].includes(input.locale)?input.locale:'kk';
  const history=Array.isArray(input.history)?input.history.slice(-4).filter(h=>h&&['user','assistant'].includes(h.role)&&typeof h.content==='string').map(h=>({role:h.role,content:h.content.slice(0,1400)})):[];
  if(!env.OPENAI_API_KEY)return json({mode:'local',reason:'NO_API_KEY',trace:[]});
  if(!db)return fail('DATABASE_UNAVAILABLE',503);
  const day=new Date().toISOString().slice(0,10),minute=new Date().toISOString().slice(0,16),ip=env.LOCAL!=='1'&&request.headers.get('cf-connecting-ip');
  if(ip&&!await quota(db,`ai-ip:${await hash(ip)}:${minute}`,6)||!await quota(db,`ai-user:${user.id}:${minute}`,3)||!await quota(db,`ai-global:${day}`,Number(env.AI_DAILY_LIMIT)||60))return json({mode:'local',reason:'AI_LIMIT',trace:[]});
  return json(await whatIf({message:input.message,decisions:input.decisions,locale,history},env,env.FETCHER||fetch));
 }
 if(path==='/api/leaderboard'&&method==='GET'){
  if(!db)return fail('DATABASE_UNAVAILABLE',503);
  return json({scenarios:(await rows(db,'SELECT * FROM scenarios WHERE published=1 AND version=? ORDER BY score DESC,cost ASC LIMIT 50',VERSION)).map(scenarioDTO)});
 }
 const shared=path.match(/^\/api\/shared\/([\w-]+)$/);
 if(shared&&method==='GET'){
  if(!db)return fail('DATABASE_UNAVAILABLE',503);
  const row=await one(db,'SELECT * FROM scenarios WHERE share_id=?',shared[1]);return row?json({scenario:scenarioDTO(row)}):fail('NOT_FOUND',404);
 }
 if(path.startsWith('/api/scenarios')){
  if(!user)return fail('WORKSPACE_UNAVAILABLE',503);if(!db)return fail('DATABASE_UNAVAILABLE',503);
  if(path==='/api/scenarios'&&method==='GET')return json({scenarios:(await rows(db,'SELECT * FROM scenarios WHERE owner_id=? ORDER BY updated_at DESC LIMIT 100',user.id)).map(scenarioDTO)});
  if(path==='/api/scenarios'&&method==='POST'){
   const input=await readBody(request),result=simulate(input?.decisions);if(!result.valid)return json(result,400);
   const name=cleanName(input.name,80),team=cleanName(input.team,60);if(!name||!team)return fail('NAME_REQUIRED');
   const id=crypto.randomUUID(),now=new Date().toISOString();
   const insertion=await run(db,'INSERT INTO scenarios (id,owner_id,name,team,decisions_json,version,score,cost,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM scenarios WHERE owner_id=?)<100',id,user.id,name,team,JSON.stringify(input.decisions),VERSION,result.score,result.cost,now,now,user.id);
   if(!insertion.meta.changes)return fail('SCENARIO_LIMIT',409);
   return json({scenario:scenarioDTO(await one(db,'SELECT * FROM scenarios WHERE id=? AND owner_id=?',id,user.id))},201);
  }
  const match=path.match(/^\/api\/scenarios\/([\w-]+)(?:\/(share|publish))?$/);
  if(!match)return fail('NOT_FOUND',404);
  const row=await one(db,'SELECT * FROM scenarios WHERE id=? AND owner_id=?',match[1],user.id);if(!row)return fail('NOT_FOUND',404);
  if(method==='GET'&&!match[2])return json({scenario:scenarioDTO(row)});
  if(method==='DELETE'&&!match[2]){await run(db,'DELETE FROM scenarios WHERE id=? AND owner_id=?',row.id,user.id);return json({ok:true});}
  if(method==='POST'&&['share','publish'].includes(match[2])){
   const shareId=row.share_id||crypto.randomUUID();
   await run(db,"UPDATE scenarios SET share_id=COALESCE(share_id,?),published=CASE WHEN ?='publish' THEN 1 ELSE published END,updated_at=? WHERE id=? AND owner_id=?",shareId,match[2],new Date().toISOString(),row.id,user.id);
   return json({scenario:scenarioDTO(await one(db,'SELECT * FROM scenarios WHERE id=? AND owner_id=?',row.id,user.id))});
  }
 }
 return fail('NOT_FOUND',404);
 }catch(error){return fail(error.code||'SERVER_ERROR',error.status||500);}
}


