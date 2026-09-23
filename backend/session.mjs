// A private browser workspace, created automatically. No external login is required.
import {run} from './database.mjs';
const COOKIE='akim_workspace',LIFETIME=60*60*24*180;
const bytes=new TextEncoder();
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function signingKey(secret){return crypto.subtle.importKey('raw',bytes.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function browserSession(request,env){
 // Preserve saved scenarios of visitors who were already signed in to the Site.
 const platformId=env.LOCAL!=='1'&&request.headers.get('oai-authenticated-user-id');
 if(platformId)return {user:{id:platformId,name:'City workspace',kind:'platform'}};
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw Error('SESSION_NOT_CONFIGURED');
 const key=await signingKey(env.SESSION_SECRET);
 const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(raw){try{const [id,expiry,signature,...extra]=raw.split('.');const expires=Number(expiry);if(!extra.length&&/^[a-f0-9-]{36}$/.test(id)&&expires>Date.now()/1000&&expires<Date.now()/1000+LIFETIME+120&&await crypto.subtle.verify('HMAC',key,decode(signature),bytes.encode(`${id}.${expiry}`)))return {user:{id:`guest:${id}`,name:'City workspace',kind:'browser'}};}catch{}}
 const legacy=env.LOCAL==='1'&&request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('akim_local='))?.slice(11);
 const id=legacy&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(legacy)?legacy:crypto.randomUUID(),expiry=Math.floor(Date.now()/1000)+LIFETIME,payload=`${id}.${expiry}`;
 if(id===legacy&&env.DB)await run(env.DB,'UPDATE scenarios SET owner_id=? WHERE owner_id=?',`guest:${id}`,`local:${id}`);
 const signature=encode(await crypto.subtle.sign('HMAC',key,bytes.encode(payload)));
 return {user:{id:`guest:${id}`,name:'City workspace',kind:'browser'},cookie:`${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LIFETIME}${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
export async function withBrowserSession(request,env,handler){
 const url=new URL(request.url);
 if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'ORIGIN_DENIED'},{status:403});
 try{const session=await browserSession(request,env),response=await handler(session.user),headers=new Headers(response.headers);if(session.cookie)headers.append('Set-Cookie',session.cookie);return new Response(response.body,{status:response.status,headers});}
 catch{return Response.json({error:'WORKSPACE_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});}
}
