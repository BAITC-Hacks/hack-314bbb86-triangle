import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {passwordHash} from '../backend/session.mjs';
await mkdir('.data',{recursive:true});
const credentials=[],accounts=[];
for(const role of ['mayor','manager']){
 const email=role+'@akim.demo',password=randomBytes(15).toString('base64url'),salt=randomBytes(16).toString('hex');
 credentials.push({role,email,password});accounts.push({role,email,name:role==='mayor'?'Demo mayor':'Demo city manager',salt,passwordHash:await passwordHash(password,salt)});
}
let env='';try{env=await readFile('.env','utf8');}catch{}
env=env.split(/\r?\n/).filter(line=>!line.startsWith('AUTH_ACCOUNTS=')).join('\n').trimEnd();
await writeFile('.env',env+"\nAUTH_ACCOUNTS='"+JSON.stringify(accounts)+"'\n");
await writeFile('.data/demo-credentials.json',JSON.stringify(credentials,null,2));
console.log('Two demo accounts configured. Private credentials: .data/demo-credentials.json. Keep this file out of Git.');
