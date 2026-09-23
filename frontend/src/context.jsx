import React,{createContext,useContext,useState,useEffect,useRef} from 'react';
import {DATA_TEXT} from '../../shared/i18n-data.mjs';
import {validate} from '../../shared/engine.mjs';
import {EXAMPLE,DISTRICTS} from '../../shared/data.mjs';
import {UX_COPY} from './ux-copy.mjs';
import {STRINGS} from './strings.mjs';
import {OFFICE_COPY} from './office-copy.mjs';
import {V4_COPY} from './v4-copy.mjs';
let expectedAccount=null;
export async function api(path,options={}){let r;try{r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(expectedAccount?{'X-Akim-Account-Id':expectedAccount}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined});}catch{throw new Error('loadError');}let data;try{data=await r.json();}catch{throw new Error('SERVER_ERROR');}if(!r.ok){if(data.error==='ACCOUNT_CHANGED')window.dispatchEvent(new Event('akim-account-changed'));if(r.status===401&&path!=='/api/auth/login')window.dispatchEvent(new Event('akim-session-expired'));throw Object.assign(new Error(data.error||'ERROR'),{data,status:r.status});}return data;}
const Context=createContext(null);
function localRead(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function Provider({children}){
 const [locale,setLocale]=useState(()=>{const l=localRead('akim-language','kk');return ['kk','ru','en'].includes(l)?l:'kk';});
 const [decisions,setDraft]=useState(EXAMPLE),[config,setConfig]=useState(null),[toast,setToast]=useState(''),[saveStatus,setSaveStatus]=useState(''),[draftError,setDraftError]=useState(null);
 const [selectedDistrict,setSelectedDistrict]=useState(()=>{const d=localRead('akim-district','nura');return DISTRICTS.some(x=>x.id===d)?d:'nura';});
 const configRef=useRef(null),draftRef=useRef(EXAMPLE),revision=useRef(0),epoch=useRef(0),queue=useRef(Promise.resolve());
 const setAll=(d)=>{draftRef.current=d;setDraft(d);};
 async function refreshConfig(){const stamp=++epoch.current;configRef.current=null;expectedAccount=null;setConfig(null);try{const c=await api('/api/config');if(stamp!==epoch.current)return;expectedAccount=c.user?.id||null;if(c.canEdit){const d=await api('/api/draft');if(stamp!==epoch.current)return;revision.current=d.revision;setAll(d.decisions);}else{revision.current=0;setAll(EXAMPLE);}configRef.current=c;setConfig(c);setDraftError(null);setSaveStatus('');}catch(e){if(stamp===epoch.current){configRef.current=null;setConfig({unavailable:true});setAll(EXAMPLE);setDraftError(e);}}}
 useEffect(()=>{refreshConfig();const expired=()=>{epoch.current++;configRef.current=null;setConfig({user:null,canEdit:false});setAll(EXAMPLE);setDraftError(new Error('AUTH_REQUIRED'));};const changed=()=>refreshConfig(),storage=e=>{if(e.key==='akim-auth-change')refreshConfig();};window.addEventListener('akim-session-expired',expired);window.addEventListener('akim-account-changed',changed);window.addEventListener('storage',storage);return()=>{window.removeEventListener('akim-session-expired',expired);window.removeEventListener('akim-account-changed',changed);window.removeEventListener('storage',storage);};},[]);
 async function signIn(email,password){await api('/api/auth/login',{method:'POST',body:{email,password}});await refreshConfig();try{localStorage.setItem('akim-auth-change',String(Date.now()));}catch{}}
 async function signOut(){await queue.current;await api('/api/auth/logout',{method:'POST',body:{}});await refreshConfig();try{localStorage.setItem('akim-auth-change',String(Date.now()));}catch{}setToast(V4_COPY[locale].auth.signedOut);}
 function setDecisions(value){
  if(!configRef.current?.canEdit){setToast(V4_COPY[locale].auth.authRequired);return false;}
  const next=typeof value==='function'?value(draftRef.current):value;if(!validate(next,{partial:true}).valid)return false;
  const snapshot=structuredClone(next),stamp=epoch.current;setAll(snapshot);setDraftError(null);setSaveStatus('saving');
  queue.current=queue.current.then(async()=>{if(stamp!==epoch.current)return;const r=await api('/api/draft',{method:'PUT',body:{decisions:snapshot,revision:revision.current}});if(stamp!==epoch.current)return;revision.current=r.revision;setSaveStatus(JSON.stringify(snapshot)===JSON.stringify(draftRef.current)?'saved':'saving');}).catch(async e=>{if(stamp!==epoch.current)return;const recovery=++epoch.current;setSaveStatus('error');setDraftError(e);try{const d=await api('/api/draft');if(recovery!==epoch.current)return;revision.current=d.revision;setAll(d.decisions);}catch{}});return true;
 }
 useEffect(()=>{document.documentElement.lang=locale;document.title=STRINGS[locale].brand+' — AKIM City Lab';try{localStorage.setItem('akim-language',JSON.stringify(locale));localStorage.removeItem('akim-draft');localStorage.removeItem('akim-role');}catch{}},[locale]);
 useEffect(()=>{try{localStorage.setItem('akim-district',JSON.stringify(selectedDistrict));}catch{}},[selectedDistrict]);
 useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id);}},[toast]);
 const auth=V4_COPY[locale].auth,extra={AUTH_REQUIRED:auth.authRequired,FORBIDDEN:auth.forbidden,INVALID_CREDENTIALS:auth.invalidCredentials,LOGIN_LIMIT:auth.rateLimit,AUTH_NOT_CONFIGURED:auth.authRequired,DRAFT_CONFLICT:{kk:'Жоспар басқа терезеде өзгертілді. Соңғы нұсқа жүктелді.',ru:'План изменён в другом окне. Загружена последняя версия.',en:'The plan changed in another window. The latest version was loaded.'}[locale]};
 extra.ACCOUNT_CHANGED={kk:'Аккаунт басқа терезеде ауысты. Жұмыс кеңістігі жаңартылды.',ru:'Аккаунт сменился в другом окне. Рабочее пространство обновлено.',en:'The account changed in another tab. The workspace was refreshed.'}[locale];
 const t=key=>extra[key]||STRINGS[locale][key]||STRINGS.en[key]||key;
 const errorText=message=>{if(message.includes('ровно'))return t('invalidCount');if(message.includes('Бюджет'))return t('invalidBudget');if(message.includes('уже'))return t('invalidRepeat');if(message.includes('2 мер'))return t('invalidCategory');if(message.includes('ЛРТ'))return t('invalidTransport');if(message.includes('одном районе'))return t('invalidLocal');return t('invalidDistrict');};
 const role=config?.user?.role||'mayor';
 return <Context.Provider value={{locale,setLocale,decisions,setDecisions,config,refreshConfig,signIn,signOut,canEdit:!!config?.canEdit,role,selectedDistrict,setSelectedDistrict,saveStatus,draftError,v4:V4_COPY[locale],office:OFFICE_COPY[locale],t,copy:UX_COPY[locale],data:DATA_TEXT[locale],notify:setToast,errorText,number:x=>new Intl.NumberFormat(locale==='kk'?'kk-KZ':locale==='ru'?'ru-RU':'en-US',{maximumFractionDigits:2,minimumFractionDigits:2}).format(x)}}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</Context.Provider>;
}
export const useApp=()=>useContext(Context);

