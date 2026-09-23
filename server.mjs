import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BUDGET, HORIZON, VERSION } from './public/data.mjs';
import { simulate } from './public/engine.mjs';
import { analyze, buildFacts } from './advisor.mjs';

const assets = new Map([['/', ['index.html','text/html']], ['/app.mjs',['app.mjs','text/javascript']],
  ['/styles.css',['styles.css','text/css']], ['/data.mjs',['data.mjs','text/javascript']],
  ['/engine.mjs',['engine.mjs','text/javascript']], ['/storage.mjs',['storage.mjs','text/javascript']],
  ['/favicon.svg',['favicon.svg','image/svg+xml']]]);
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) { const e = new Error('Запрос слишком большой.'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const e = new Error('Некорректный JSON.'); e.status = 400; throw e; }
}
export function createApp({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-4.1-mini', fetcher = fetch } = {}) {
  const rate = new Map();
  let activeAI = 0;
  return http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/config') return send(res,200,{ budget: BUDGET, horizon: HORIZON, version: VERSION, aiConfigured: Boolean(apiKey), model: apiKey ? model : null });
      if (req.method === 'POST' && ['/api/simulate','/api/analyze'].includes(url.pathname)) {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(res,403,{ error: 'Запрос с другого сайта отклонён.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{ error: 'Используйте application/json.' });
        const input = await body(req);
        const result = simulate(input?.decisions);
        if (!result.valid) return send(res,400,result);
        if (url.pathname === '/api/simulate') return send(res,200,result);
        // Global concurrency cap and per-address quota bound paid AI usage.
        const now = Date.now(), ip = req.socket.remoteAddress;
        for (const [key,value] of rate) if (value.until <= now) rate.delete(key);
        const usage = rate.get(ip) || { count: 0, until: now + 60000 };
        if (usage.count >= 5 || activeAI >= 3) return send(res,429,{ error: 'Слишком много запросов. Попробуйте через минуту.' });
        usage.count++; rate.set(ip,usage); activeAI++;
        try {
          const facts = buildFacts(input.decisions,result);
          return send(res,200,{ result, recommendations: facts.recommendations, ...await analyze(facts,{ apiKey,model,fetcher }) });
        } finally { activeAI--; }
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file,type] = assets.get(url.pathname);
        const content = await readFile(resolve(publicDir,file));
        res.writeHead(200,{ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        return res.end(content);
      }
      send(res,404,{ error: 'Страница не найдена.' });
    } catch (error) { if (!res.headersSent) send(res,error.status || 500,{ error: error.status ? error.message : 'Ошибка сервера. Повторите запрос.' }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
  createApp().listen(port,host,() => console.log(`Аким на 5 часов: http://${host}:${port}`));
}
