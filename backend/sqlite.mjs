import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function openDatabase(filename='.data/akim.sqlite') {
 if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
 const raw=new DatabaseSync(filename);raw.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 raw.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
  if(!raw.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)){
   raw.exec('BEGIN');try{raw.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));raw.prepare('INSERT INTO local_migrations VALUES (?)').run(file);raw.exec('COMMIT');}catch(e){raw.exec('ROLLBACK');throw e;}
  }
 }
 const wrapper=(sql,args=[])=>({bind:(...values)=>wrapper(sql,values),first:async()=>raw.prepare(sql).get(...args)||null,all:async()=>({results:raw.prepare(sql).all(...args)}),run:async()=>({success:true,meta:raw.prepare(sql).run(...args)})});
 return {prepare:sql=>wrapper(sql),close:()=>raw.close(),raw};
}
