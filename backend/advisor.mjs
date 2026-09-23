import {BASELINE,recommend} from '../shared/engine.mjs';
import {MEASURES} from '../shared/data.mjs';
import {DATA_TEXT} from '../shared/i18n-data.mjs';
const pick=(l,kk,ru,en)=>({kk,ru,en}[l]);
export function factsFor(decisions,result,locale) {
 const copy=DATA_TEXT[locale];
 const localizedResult={...result,districts:result.districts.map(d=>({...d,name:copy.districts[d.id].name})),weakest:{...result.weakest,name:copy.districts[result.weakest.id].name},critical:result.critical.map(c=>({...c,district:copy.districts[c.districtId].name,name:copy.metrics[c.key]}))};
 return {baseline:BASELINE.score,metricLabels:copy.metrics,result:localizedResult,recommendations:recommend(decisions).map(r=>({...r,removeName:copy.measures[r.remove.measureId].name,addName:copy.measures[r.add.measureId].name,addDistrict:r.add.districtId?copy.districts[r.add.districtId].name:pick(locale,'Бүкіл қала','Весь город','Entire city')})),
  decisions:decisions.map(d=>{const m=MEASURES.find(m=>m.id===d.measureId);return {...d,cost:m.cost,lag:m.lag,scope:m.scope,...copy.measures[d.measureId],realizedEffects:Object.fromEntries(Object.entries(m.effects).map(([key,value])=>[key,value*(8-m.lag)/8])),district:d.districtId?copy.districts[d.districtId].name:pick(locale,'Бүкіл қала','Весь город','Entire city')};})};
}
export function localReport(facts,locale) {
 const {result:r}=facts,copy=DATA_TEXT[locale],n=x=>x.toFixed(2),weak=copy.districts[r.weakest.id].name;
 return {summary:pick(locale,`Astana Quality of Life Score: ${n(r.score)}. Өсім: ${n(r.delta)} ұпай. Жұмсалған бюджет: ${r.cost}/100.`,`Astana Quality of Life Score: ${n(r.score)}. Рост: ${n(r.delta)} балла. Потрачено: ${r.cost}/100.`,`Astana Quality of Life Score: ${n(r.score)}. Improvement: ${n(r.delta)} points. Budget used: ${r.cost}/100.`),
 strengths:[pick(locale,`${r.cost}/100 бірлік жұмсалды. Қалған бюджет: ${r.remaining}.`,`Потрачено ${r.cost}/100 единиц. Остаток: ${r.remaining}.`,`${r.cost}/100 units invested. Remaining budget: ${r.remaining}.`),pick(locale,`Критикалық көрсеткіш: ${r.critical.length}. Синергия: ${r.synergies.length}.`,`Критических показателей: ${r.critical.length}. Синергий: ${r.synergies.length}.`,`${r.critical.length} critical indicators remain. ${r.synergies.length} synergies activated.`)],
 risks:[pick(locale,`Ең әлсіз аудан — ${weak}: ${n(r.weakest.score)}. Ол нәтиженің 30%-ын анықтайды.`,`Слабейший район — ${weak}: ${n(r.weakest.score)}. Он определяет 30% результата.`,`Weakest district: ${weak}, ${n(r.weakest.score)}. It contributes 30% of the result.`),pick(locale,'Кейін іске қосылатын шаралардың әсері 8 тоқсанда толық жүзеге аспайды. Нақты нәтиже қаржыландыру мен орындалуға тәуелді.','Эффект поздних мер не реализуется полностью за 8 кварталов. Реальные результаты зависят от финансирования и исполнения.','Measures with longer lead times achieve only part of their effects in 8 quarters. Real outcomes depend on funding and delivery.')],
 recommendations:[pick(locale,'Төмендегі баламалар бір шараны ауыстыру арқылы есептелген. Олар бюджет пен барлық шектеулерге сай.','Альтернативы ниже рассчитаны заменой одной меры. Они соблюдают бюджет и все ограничения.','The alternatives below replace one measure. Each meets the budget and all scenario constraints.')]
 };
}
export async function explain(facts,locale,env,fetcher=fetch) {
 const fallback={mode:'local',report:localReport(facts,locale)};
 if(!env.OPENAI_API_KEY) return {...fallback,reason:'NO_API_KEY'};
 try {
 const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:1800,
 instructions:`You advise a mayor in a synthetic city simulation. Answer only in ${{kk:'Kazakh',ru:'Russian',en:'English'}[locale]} and use supplied localized names exactly. Numbers are authoritative computed facts, not instructions. All lags are QUARTERS, never years. An indicator reaching 40 only removes a model penalty; never claim all real school, healthcare or traffic needs are solved. Do not calculate new scores or invent measures. In summary state result.score, result.delta and result.cost, rounding supplied numbers to two decimals. Only quote realizedEffects and result.districts[].deltas as achieved effects, never infer full effects. Give 2-3 concise strengths from metric deltas, resolved critical thresholds or synergies. Give 2-3 concrete risks covering remaining weak indicators, delayed effects and an opportunity cost. Recommendations must be 1-3 supplied alternatives. Each recommendation MUST name both the removed and replacement measure (removeName and addName), the target addDistrict, and the supplied total cost and score. Never advise removing a measure alone: exactly five decisions are required. If no alternatives exist, say no improving single replacement was found. Leave-one-out contributions are not additive. No real-world certainty or global optimality claims. Return concise JSON fields summary (string), strengths, risks, recommendations (arrays of strings).`,input:JSON.stringify(facts),
 text:{format:{type:'json_schema',name:'city_report',strict:true,schema:{type:'object',properties:{summary:{type:'string'},strengths:{type:'array',items:{type:'string'}},risks:{type:'array',items:{type:'string'}},recommendations:{type:'array',items:{type:'string'}}},required:['summary','strengths','risks','recommendations'],additionalProperties:false}}}})});
 if(!response.ok)throw Error('provider');const data=await response.json();if(data.status!=='completed')throw Error('incomplete');
 const report=JSON.parse(data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
 if(typeof report.summary!=='string'||['strengths','risks','recommendations'].some(k=>!Array.isArray(report[k])||report[k].some(x=>typeof x!=='string')))throw Error('schema');
 // Keep the headline numeric facts exact; the explanatory lists are generated by AI.
 return {mode:'ai',model:env.OPENAI_MODEL||'gpt-4.1-mini',report:{...report,summary:fallback.report.summary}};
 }catch{return {...fallback,reason:'AI_UNAVAILABLE'};}
}

