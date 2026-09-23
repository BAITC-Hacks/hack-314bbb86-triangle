import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {api} from './api.mjs';
import {openDatabase} from './sqlite.mjs';
import {withBrowserSession} from './session.mjs';
const db=openDatabase(),production=process.argv.includes('--production');
const vite=production?null:await (await import('vite')).createServer({server:{middlewareMode:true},appType:'spa'});
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')){
   const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
   const env={...process.env,DB:db,LOCAL:'1'};
   const response=await withBrowserSession(request,env,user=>api(request,env,user));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(vite)return vite.middlewares(req,res);
  const root=resolve('dist/client');let path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(path!==root&&!path.startsWith(root+'\\')&&!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  if(!extname(path))path=resolve(root,'index.html');
  try{const body=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream')+'; charset=utf-8');res.end(body);}catch{res.writeHead(404);res.end('Not found');}
 }catch{res.writeHead(500);res.end('Server error');}
});
const port=Number(process.env.PORT)||3100;server.listen(port,'127.0.0.1',()=>console.log(`Akim City Lab: http://127.0.0.1:${port}`));
process.on('SIGINT',()=>{server.close();db.close();vite?.close();process.exit(0);});
