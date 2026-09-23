import {BASELINE,calculate,projection} from './engine.mjs';
import {DISTRICTS,MEASURES,METRICS} from './data.mjs';
export const districtIdOrDefault=id=>DISTRICTS.some(d=>d.id===id)?id:'nura';
export function districtFacts(decisions,id,quarter=8){
 if(!DISTRICTS.some(d=>d.id===id))throw Error('INVALID_DISTRICT');
 const before=BASELINE.districts.find(d=>d.id===id),city=calculate(decisions,{quarter}),after=city.districts.find(d=>d.id===id);
 const measures=decisions.filter(d=>!d.districtId||d.districtId===id).map(d=>({...d,...MEASURES.find(m=>m.id===d.measureId)}));
 return {id,before,after,delta:after.score-before.score,city,measures,localCost:measures.filter(m=>m.scope!=='city').reduce((s,m)=>s+m.cost,0),citywideCost:measures.filter(m=>m.scope==='city').reduce((s,m)=>s+m.cost,0),metrics:Object.keys(METRICS).map(key=>({key,before:before.metrics[key],after:after.metrics[key],delta:after.metrics[key]-before.metrics[key]})),series:projection(decisions).map(s=>({quarter:s.quarter,score:s.districts.find(d=>d.id===id).score})),criticalBefore:Object.values(before.metrics).filter(v=>v<40).length,criticalAfter:Object.values(after.metrics).filter(v=>v<40).length};
}
