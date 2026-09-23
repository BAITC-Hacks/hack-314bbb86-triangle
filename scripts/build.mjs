import {build as viteBuild} from 'vite';
import {build as esbuild} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,cp} from 'node:fs/promises';
await viteBuild();
await mkdir('dist/server',{recursive:true});
await esbuild({entryPoints:['backend/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await mkdir('dist/.openai',{recursive:true});await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'akim-city-lab',main:'index.js',compatibility_date:'2025-06-01',assets:{directory:'../client',binding:'ASSETS',not_found_handling:'single-page-application'},d1_databases:[{binding:'DB',database_name:'akim',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'../.openai/drizzle'}]},null,2));
console.log('Built frontend assets, Worker backend, and D1 migrations.');

