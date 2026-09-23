import React,{createContext,useContext,useState,useEffect} from 'react';
import {DATA_TEXT} from '../../shared/i18n-data.mjs';
import {validate} from '../../shared/engine.mjs';
import {UX_COPY} from './ux-copy.mjs';
import {STRINGS} from './strings.mjs';
import {OFFICE_COPY} from './office-copy.mjs';
async function request(path,options={}){let r;try{r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body?JSON.stringify(options.body):undefined});}catch{throw new Error('loadError');}let data;try{data=await r.json();}catch{throw new Error('SERVER_ERROR');}if(!r.ok)throw Object.assign(new Error(data.error||'ERROR'),{data,status:r.status});return data;}
let workspace;
// Every initial request shares one bootstrap, so concurrent page loads cannot
// overwrite a newly issued workspace cookie with a second identity.
export async function api(path,options={}){
 workspace??=request('/api/config').catch(error=>{workspace=null;throw error;});
 const config=await workspace;
 return path==='/api/config'?config:request(path,options);
}
const Context=createContext(null);
function localRead(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function Provider({children}){
 const [locale,setLocale]=useState(()=>{const l=localRead('akim-language','kk');return ['kk','ru','en'].includes(l)?l:'kk';});
 const [decisions,setDecisions]=useState(()=>{const d=localRead('akim-draft',[]);return validate(d,{partial:true}).valid?d:[];});
 const [config,setConfig]=useState(null),[toast,setToast]=useState('');
 const [role,setRole]=useState(()=>localRead('akim-role','mayor')==='manager'?'manager':'mayor');
 const refreshConfig=()=>{setConfig(null);api('/api/config').then(setConfig).catch(()=>setConfig({unavailable:true}));};
 useEffect(refreshConfig,[]);
 useEffect(()=>{try{localStorage.setItem('akim-role',JSON.stringify(role));}catch{}},[role]);
 useEffect(()=>{document.documentElement.lang=locale;document.title=`${STRINGS[locale].brand} — AKIM City Lab`;try{localStorage.setItem('akim-language',JSON.stringify(locale));}catch{}},[locale]);
 useEffect(()=>{try{localStorage.setItem('akim-draft',JSON.stringify(decisions));}catch{}},[decisions]);
 useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id);}},[toast]);
 const t=key=>STRINGS[locale][key]||STRINGS.en[key]||key;
 const errorText=message=>{if(message.includes('ровно'))return t('invalidCount');if(message.includes('Бюджет'))return t('invalidBudget');if(message.includes('уже'))return t('invalidRepeat');if(message.includes('2 мер'))return t('invalidCategory');if(message.includes('ЛРТ'))return t('invalidTransport');if(message.includes('одном районе'))return t('invalidLocal');return t('invalidDistrict');};
 return <Context.Provider value={{locale,setLocale,decisions,setDecisions,config,refreshConfig,role,setRole,office:OFFICE_COPY[locale],t,copy:UX_COPY[locale],data:DATA_TEXT[locale],notify:setToast,errorText,number:x=>new Intl.NumberFormat(locale==='kk'?'kk-KZ':locale==='ru'?'ru-RU':'en-US',{maximumFractionDigits:2,minimumFractionDigits:2}).format(x)}}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</Context.Provider>;
}
export const useApp=()=>useContext(Context);
