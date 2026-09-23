import { BUDGET, HORIZON, VERSION, DISTRICTS, MEASURES, METRICS, SYNERGIES } from './data.mjs';
const measures = new Map(MEASURES.map(m => [m.id, m]));
const districtIds = new Set(DISTRICTS.map(d => d.id));
export const clip = value => Math.max(0, Math.min(100, value));
export function validate(decisions, { partial = false } = {}) {
  const errors = [];
  if (!Array.isArray(decisions)) return { valid: false, errors: ['Решения должны быть массивом.'], cost: 0 };
  if (partial ? decisions.length > 5 : decisions.length !== 5) errors.push('Нужно принять ровно 5 решений.');
  const seen = new Set(), counts = {};
  let cost = 0;
  for (const d of decisions) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.measureId !== 'string' || !measures.has(d.measureId)) {
      errors.push('Неизвестное мероприятие или неверный формат решения.'); continue;
    }
    const m = measures.get(d.measureId);
    if (seen.has(m.id)) errors.push(`${m.id}: мероприятие уже выбрано.`);
    seen.add(m.id);
    cost += m.cost;
    counts[m.category] = (counts[m.category] || 0) + 1;
    if (counts[m.category] > 2) errors.push('Нельзя выбрать больше 2 мер из одного направления.');
    if (m.scope === 'district' && !districtIds.has(d.districtId)) errors.push(`${m.id}: выберите один из пяти районов.`);
    if (m.scope === 'city' && d.districtId !== undefined) errors.push(`${m.id}: общегородская мера не должна содержать район.`);
    if (Object.keys(d).some(k => !['measureId','districtId'].includes(k))) errors.push(`${m.id}: решение содержит лишние поля.`);
  }
  if (cost > BUDGET) errors.push(`Бюджет превышен на ${cost - BUDGET} ед.`);
  if (seen.has('M1') && seen.has('M3')) errors.push('Автобусные полосы и ЛРТ несовместимы в любом районе.');
  for (const [a,b] of [['M4','M7'], ['M5','M13']]) {
    const first = decisions.find(d => d?.measureId === a);
    const second = decisions.find(d => d?.measureId === b);
    if (first && second && first.districtId === second.districtId) errors.push(`${a} и ${b} нельзя реализовать в одном районе.`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], cost };
}

// For internal/provisional calculations only. Public final scoring uses simulate().
export function calculate(decisions,{quarter=HORIZON}={}) {
  if(!Number.isInteger(quarter)||quarter<0||quarter>HORIZON)throw Error('INVALID_QUARTER');
  const check = validate(decisions, { partial: true });
  if (!check.valid) throw new Error(check.errors.join(' '));
  const districts = structuredClone(DISTRICTS);
  for (const d of decisions) {
    const m = measures.get(d.measureId), factor = Math.max(0,quarter-m.lag) / HORIZON;
    for (const target of districts.filter(x => m.scope === 'city' || x.id === d.districtId)) {
      for (const [key, value] of Object.entries(m.effects)) target.metrics[key] += value * factor;
    }
  }
  const synergies = [];
  for (const s of SYNERGIES) {
    const first = decisions.find(d => d.measureId === s.pair[0]);
    if (first && decisions.some(d => d.measureId === s.pair[1]) && quarter>Math.max(...s.pair.map(id=>measures.get(id).lag))) {
      const target = districts.find(d => d.id === first.districtId);
      for (const [key,value] of Object.entries(s.effects)) target.metrics[key] += value;
      synergies.push({ ...s, districtId: target.id, districtName: target.name });
    }
  }
  const critical = [];
  for (const d of districts) {
    d.score = 0;
    d.deltas = {};
    const original = DISTRICTS.find(x => x.id === d.id);
    for (const [key, meta] of Object.entries(METRICS)) {
      d.metrics[key] = clip(d.metrics[key]);
      d.deltas[key] = d.metrics[key] - original.metrics[key];
      d.score += d.metrics[key] * meta.weight;
      if (d.metrics[key] < 40) critical.push({ districtId: d.id, district: d.name, key, name: meta.name, value: d.metrics[key] });
    }
  }
  const average = districts.reduce((sum,d) => sum + d.population * d.score, 0);
  const weakest = districts.reduce((min,d) => d.score < min.score ? d : min);
  return { version: VERSION, cost: check.cost, remaining: BUDGET - check.cost, districts, average,
    weakest: { id: weakest.id, name: weakest.name, score: weakest.score }, critical, synergies,
    score: .7 * average + .3 * weakest.score - critical.length };
}
export const BASELINE = calculate([]);
// Intermediate quarters are an explicit visualization assumption. Q8 is the
// organizer's exact model. Costs are committed at the start, not cash flow.
export const projection=decisions=>Array.from({length:HORIZON+1},(_,quarter)=>({quarter,...calculate(decisions,{quarter})}));
// Exact Shapley values over all 2^5 coalitions. Each marginal is averaged
// across all 5! orders; interaction and threshold effects are shared fairly.
export function shapley(decisions) {
  if (!validate(decisions).valid) return [];
  const n=decisions.length, factorial=[1,1,2,6,24,120];
  const scores=Array.from({length:1<<n},(_,mask)=>calculate(decisions.filter((_,i)=>mask&(1<<i))).score);
  return decisions.map((d,i)=>{
    let value=0;
    for(let mask=0;mask<(1<<n);mask++)if(!(mask&(1<<i))){
      const size=mask.toString(2).replaceAll('0','').length;
      value+=factorial[size]*factorial[n-size-1]/factorial[n]*(scores[mask|(1<<i)]-scores[mask]);
    }
    return {...d,value};
  });
}
export function simulate(decisions) {
  const validation = validate(decisions);
  if (!validation.valid) return { ...validation, score: null };
  const result = calculate(decisions);
  const contributions = decisions.map((d,i) => {
    const m = measures.get(d.measureId);
    return { ...d, name: m.name, cost: m.cost, realizedFraction: (HORIZON-m.lag)/HORIZON,
      marginalScore: result.score - calculate(decisions.filter((_,j) => j !== i)).score };
  });
  return { valid: true, errors: [], ...result, delta: result.score - BASELINE.score, contributions, shapley:shapley(decisions) };
}
export function recommend(decisions) {
  const current = simulate(decisions);
  if (!current.valid) return [];
  const variants = [];
  for (let i = 0; i < decisions.length; i++) {
    for (const m of MEASURES) {
      for (const districtId of m.scope === 'city' ? [undefined] : [...districtIds]) {
        const choice = districtId ? { measureId: m.id, districtId } : { measureId: m.id };
        if (JSON.stringify(choice) === JSON.stringify(decisions[i])) continue;
        const candidate = decisions.map((d,j) => i === j ? choice : d);
        if (!validate(candidate).valid) continue;
        const result = calculate(candidate), gain = result.score - current.score;
        if (gain > 1e-8) variants.push({ remove: decisions[i], add: choice, gain,
          score: result.score, cost: result.cost, decisions: candidate });
      }
    }
  }
  return variants.sort((a,b) => b.gain-a.gain || a.cost-b.cost).slice(0,3);
}
