import {api} from './api.mjs';
import {withBrowserSession} from './session.mjs';
export default {async fetch(request,env){
 const url=new URL(request.url);let response;
 if(url.pathname.startsWith('/api/'))response=await withBrowserSession(request,env,user=>api(request,env,user));
 else {response=await env.ASSETS.fetch(request);if(response.status===404&&!url.pathname.split('/').pop().includes('.'))response=await env.ASSETS.fetch(new Request(new URL('/index.html',url),request));}
 const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 return new Response(response.body,{status:response.status,headers});
}};
