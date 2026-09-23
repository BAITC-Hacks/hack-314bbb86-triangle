import {MEASURES,METRICS} from './data.mjs';
import {calculate} from './engine.mjs';
export function nextQuarterFacts(decisions,quarter){
 const current=calculate(decisions,{quarter});if(quarter===8)return {quarter,horizonComplete:true};
 const next=calculate(decisions,{quarter:quarter+1});
 return {quarter:quarter+1,horizonComplete:false,score:next.score,scoreChange:next.score-current.score,
  measures:decisions.map(d=>{const m=MEASURES.find(m=>m.id===d.measureId);return {...d,firstEffectQuarter:m.lag+1,stage:quarter+1<=m.lag?'waiting':quarter+1===m.lag+1?'first':'active',cost:m.cost};}),
  districts:next.districts.map(d=>({id:d.id,changes:Object.fromEntries(Object.keys(METRICS).map(k=>[k,d.metrics[k]-current.districts.find(x=>x.id===d.id).metrics[k]]))})),
  critical:next.critical};
}
