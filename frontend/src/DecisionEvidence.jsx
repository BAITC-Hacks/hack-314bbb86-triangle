import React from 'react';
import {ArrowUpRight,Target,Scale} from 'lucide-react';
import {useApp} from './context.jsx';
import {globalOptimum} from '../../shared/optimum.mjs';
import {WHATIF_COPY} from './whatif-copy.mjs';
export function OptimumCard({score,onApply}){
 const {locale,number,t,data}=useApp(),w=WHATIF_COPY[locale];
 let best;try{best=globalOptimum();}catch{return null;}
 const gap=Math.max(0,best.result.score-score);
 return <section className="surface optimum-card"><div className="section-title"><span className="eyebrow"><Target size={15}/> {w.optimum}</span><span className="small-badge">694 395</span></div><div className="optimum-number"><strong>{number(best.result.score)}</strong><span>Score · {best.result.cost}/100 {t('budget')}</span></div><p>{w.optimumNote}</p><div className="optimum-gap">{gap<1e-8?w.atOptimum:<>{w.optimumGap}<b>{number(gap)}</b></>}</div><div className="optimum-measures">{best.decisions.map(d=><span key={d.measureId} title={data.measures[d.measureId].name}>{d.measureId}{d.districtId?' · '+data.districts[d.districtId].name:''}</span>)}</div>{onApply&&gap>1e-8&&<button className="btn secondary full" onClick={()=>onApply(structuredClone(best.decisions))}>{w.apply}<ArrowUpRight size={16}/></button>}</section>;
}
export default function DecisionEvidence({result,onApply}){
 const {locale,number,data}=useApp(),w=WHATIF_COPY[locale];
 return <div className="evidence-grid"><section className="surface shapley-card"><div className="section-title"><h2><Scale size={19}/> {w.shapley}</h2><span className="small-badge">Σ +{number(result.delta)}</span></div><p>{w.shapleyNote}</p>{result.shapley?.map(c=><div className="shapley-row" key={c.measureId}><div><span>{c.measureId} · {data.measures[c.measureId].name}</span><b>{c.value>=0?'+':''}{number(c.value)}</b></div><div className="shapley-track"><i style={{width:Math.min(100,Math.abs(c.value)/Math.max(...result.shapley.map(x=>Math.abs(x.value)),.001)*100)+'%',background:c.value<0?'#c98042':undefined}}/></div></div>)}</section><OptimumCard score={result.score} onApply={onApply}/></div>;
}
