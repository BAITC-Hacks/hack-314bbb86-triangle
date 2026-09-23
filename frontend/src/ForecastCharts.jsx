import React from 'react';
import {useApp} from './context.jsx';
import {BASELINE} from '../../shared/engine.mjs';
export function QuarterChart({series}){
 const {number}=useApp(),min=Math.floor(Math.min(...series.map(x=>x.score))-1),max=Math.ceil(Math.max(...series.map(x=>x.score))+1);
 const x=q=>55+q*63,y=s=>205-(s-min)/(max-min)*160,points=series.map(s=>`${x(s.quarter)},${y(s.score)}`).join(' ');
 return <svg className="forecast-chart" viewBox="0 0 610 255" role="img" aria-label={series.map(s=>`Q${s.quarter}: ${number(s.score)}`).join(', ')}>{Array.from({length:5},(_,i)=>{const v=min+(max-min)*i/4;return <g key={i}><line x1="55" x2="570" y1={y(v)} y2={y(v)} stroke="#dce5eb"/><text x="43" y={y(v)+4} textAnchor="end">{number(v)}</text></g>;})}<polyline points={points} fill="none" stroke="#087f87" strokeWidth="3" strokeLinejoin="round"/>{series.map(s=><g key={s.quarter}><circle cx={x(s.quarter)} cy={y(s.score)} r="4" fill="#087f87"/><text x={x(s.quarter)} y="232" textAnchor="middle">Q{s.quarter}</text></g>)}<text x="55" y="23" className="chart-caption">Astana Quality of Life Score</text></svg>;
}
export function DistrictChart({result}){const {data,number,t}=useApp();return <div className="forecast-bars">{result.districts.map((d,i)=><div key={d.id}><div><b>{data.districts[d.id].name}</b><span>{number(BASELINE.districts[i].score)} → {number(d.score)}</span></div><div className="forecast-bar-pair"><i style={{width:BASELINE.districts[i].score+'%'}} title={t('before')}/><i style={{width:d.score+'%'}} title={t('after')}/></div></div>)}</div>;}
