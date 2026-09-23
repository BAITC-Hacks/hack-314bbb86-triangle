import {one,run,quota,hash} from './database.mjs';
const COOKIE='akim_session',LIFETIME=60*60*8,encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const readCookie=request=>request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
const cookie=(request,value,age)=>COOKIE+'='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(new URL(request.url).protocol==='https:'?'; Secure':'');
export const canEdit=user=>!!user&&['mayor','manager'].includes(user.role)&&user.kind==='account';
export async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
}
export async function seedAccounts(env){
 if(!env.DB||!env.AUTH_ACCOUNTS)return;
 const accounts=JSON.parse(env.AUTH_ACCOUNTS);
 if(!Array.isArray(accounts)||accounts.length!==2)throw Error('AUTH_NOT_CONFIGURED');
 for(const a of accounts){
  if(!['mayor','manager'].includes(a.role)||typeof a.email!=='string'||!a.email.includes('@')||!/^[a-f0-9]{64}$/.test(a.passwordHash)||!/^[a-f0-9]{32,64}$/.test(a.salt))throw Error('AUTH_NOT_CONFIGURED');
  // Roles and hashes come exclusively from trusted server configuration.
  await run(env.DB,'INSERT INTO accounts (id,email,name,role,password_hash,salt,enabled) VALUES (?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role,password_hash=excluded.password_hash,salt=excluded.salt',a.role,a.email.toLowerCase(),a.name||a.role,a.role,a.passwordHash,a.salt);
 }
}
export async function browserSession(request,env){
 if(!env.DB)return {user:null};
 const raw=readCookie(request);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return {user:null};
 const s=await one(env.DB,'SELECT a.id,a.email,a.name,a.role,s.id AS session_id FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND s.expires_at>? AND a.enabled=1 AND s.password_version=a.password_hash',await hash(raw),Date.now());
 return {user:s?{id:s.id,email:s.email,name:s.name,role:s.role,kind:'account',sessionId:s.session_id}:null};
}
export async function login(request,env,input){
 if(!env.DB)return Response.json({error:'DATABASE_UNAVAILABLE'},{status:503});
 if(!env.AUTH_ACCOUNTS)return Response.json({error:'AUTH_NOT_CONFIGURED'},{status:503});
 if(typeof input?.email!=='string'||input.email.length>150||typeof input?.password!=='string'||input.password.length>256)return Response.json({error:'INVALID_CREDENTIALS'},{status:401});
 const email=input.email.trim().toLowerCase(),bucket=Math.floor(Date.now()/900000),ip=env.LOCAL==='1'?'local':request.headers.get('cf-connecting-ip')||'unknown';
 if(!await quota(env.DB,'login-account:'+await hash(email)+':'+bucket,10)||!await quota(env.DB,'login-ip:'+await hash(ip)+':'+bucket,30))return Response.json({error:'LOGIN_LIMIT'},{status:429});
 await seedAccounts(env);
 const a=await one(env.DB,'SELECT * FROM accounts WHERE email=? AND enabled=1',email);
 const actual=await passwordHash(input.password,a?.salt||'0'.repeat(32)),expected=a?.password_hash||'0'.repeat(64);let difference=0;
 for(let i=0;i<64;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
 if(!a||difference)return Response.json({error:'INVALID_CREDENTIALS'},{status:401});
 const raw=token(),old=readCookie(request);if(old)await run(env.DB,'DELETE FROM auth_sessions WHERE id=?',await hash(old));
 await run(env.DB,'DELETE FROM auth_sessions WHERE expires_at<=?',Date.now());
 await run(env.DB,'INSERT INTO auth_sessions (id,account_id,password_version,expires_at,created_at) VALUES (?,?,?,?,?)',await hash(raw),a.id,a.password_hash,Date.now()+LIFETIME*1000,new Date().toISOString());
 return Response.json({ok:true,user:{id:a.id,name:a.name,email:a.email,role:a.role,kind:'account'}},{headers:{'Set-Cookie':cookie(request,raw,LIFETIME),'Cache-Control':'no-store'}});
}
export async function logout(request,env){
 const raw=readCookie(request);if(raw&&env.DB)await run(env.DB,'DELETE FROM auth_sessions WHERE id=?',await hash(raw));
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie(request,'',0),'Cache-Control':'no-store'}});
}
export async function withBrowserSession(request,env,handler){
 const url=new URL(request.url);
 if(request.method!=='GET'&&(request.headers.get('origin')&&request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return Response.json({error:'ORIGIN_DENIED'},{status:403});
 try{const session=await browserSession(request,env);return await handler(session.user);}
 catch{return Response.json({error:'WORKSPACE_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});}
}

