import { BUDGET, HORIZON, CATEGORIES, METRICS, DISTRICTS, MEASURES, EXAMPLE } from './data.mjs';
import { BASELINE, validate, calculate, simulate } from './engine.mjs';
import { readScenarios, saveScenario, STORAGE_KEY } from './storage.mjs';
const $ = selector => document.querySelector(selector);
const fmt = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value);
const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const category = id => CATEGORIES.find(c => c.id === id);
const measure = id => MEASURES.find(m => m.id === id);
const districtName = id => DISTRICTS.find(d => d.id === id)?.name || 'Весь город';
let decisions = [], selectedDistrict = 'nura', filter = 'all', showBase = false, lastResult = null, revision = 0, busy = false;
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let saved = readScenarios(storage);
const targets = new Map(MEASURES.filter(m => m.scope === 'district').map(m => [m.id,'nura']));
function choice(m) { return m.scope === 'city' ? {measureId:m.id} : {measureId:m.id,districtId:targets.get(m.id)}; }
function notify(text) { $('#message').textContent = text; }
function invalidate() {
  revision++; busy = false; lastResult = null;
  $('#result-content').className = 'empty-state';
  $('#result-content').innerHTML = '<span>✧</span><h3>Сценарий изменён</h3><p>Завершите выбор пяти инициатив и запустите новый расчёт.</p>';
  notify(''); render();
}
function render() {
  const preview = calculate(decisions), view = showBase ? BASELINE : preview;
  $('#budget-left').textContent = BUDGET-preview.cost;
  $('#budget-description').textContent = `Инвестировано ${preview.cost} единиц`;
  $('#decision-count').textContent = `${decisions.length} / 5`;
  $('#budget-bar').innerHTML = decisions.map(d => `<i style="width:${measure(d.measureId).cost}%;background:${category(measure(d.measureId).category).color}" title="${esc(measure(d.measureId).name)}"></i>`).join('');
  $('#score-label').textContent = decisions.length === 5 ? 'Предварительный Score' : decisions.length ? 'Промежуточный прогноз' : 'Исходный Score';
  $('#score-value').textContent = fmt(preview.score);
  $('#score-delta').textContent = `${preview.score >= BASELINE.score ? '+' : ''}${fmt(preview.score-BASELINE.score)}`;
  $('#analyze').disabled = decisions.length !== 5 || busy;
  $('#analyze').textContent = busy ? 'Советник изучает сценарий…' : 'Рассчитать и получить анализ ✧';
  $('#save').disabled = !validate(decisions).valid;
  $('#decision-list').innerHTML = Array.from({length:5},(_,i) => {
    const d = decisions[i];
    if (!d) return `<li class="empty-slot"><span class="slot-number">${i+1}</span>Выберите инициативу</li>`;
    const m = measure(d.measureId), c = category(m.category);
    return `<li><span class="slot-number" style="color:${c.color}">${c.icon}</span><div><strong>${esc(m.name)}</strong><small>${districtName(d.districtId)} · ${m.cost} ед.</small></div><button class="remove" data-remove="${m.id}" aria-label="Удалить ${esc(m.name)}">×</button></li>`;
  }).join('');
  for (const d of view.districts) {
    const el = $(`#map-${d.id}`);
    el.classList.toggle('selected',d.id === selectedDistrict);
    el.setAttribute('aria-pressed',String(d.id === selectedDistrict));
    el.style.setProperty('--district-fill', d.score < 52 ? '#ead4b8' : d.score < 58 ? '#c6ded8' : '#a8cdd4');
    el.querySelector('.map-value').textContent = fmt(d.score);
    el.setAttribute('aria-label',`${d.name}, балл ${fmt(d.score)}`);
  }
  const district = view.districts.find(d => d.id === selectedDistrict);
  $('#district-detail').innerHTML = `<div class="district-title"><div><h3>${district.name} <span>${Math.round(district.population*100)}% жителей</span></h3><p>${district.profile}</p></div><strong>${fmt(district.score)}<small>/ 100</small></strong></div><div class="metric-grid">${Object.entries(METRICS).map(([key,meta]) => `<div class="metric"><div><span>${meta.name}</span><b class="${district.metrics[key]<40?'critical':''}">${fmt(district.metrics[key])}${district.deltas[key] ? `<small> ${district.deltas[key]>0?'+':''}${fmt(district.deltas[key])}</small>` : ''}</b></div><div class="metric-track"><i style="width:${district.metrics[key]}%;background:${category(meta.category).color}"></i></div></div>`).join('')}</div>`;
  renderCatalog(); renderSaved();
}
function renderCatalog() {
  $('#filters').innerHTML = [{id:'all',name:'Все инициативы'},...CATEGORIES].map(c => `<button data-filter="${c.id}" aria-pressed="${filter===c.id}" class="${filter===c.id?'selected':''}">${c.name}</button>`).join('');
  $('#measure-list').innerHTML = MEASURES.filter(m => filter==='all' || m.category===filter).map(m => {
    const c = category(m.category), chosen = decisions.some(d => d.measureId===m.id), check = validate([...decisions,choice(m)],{partial:true});
    return `<article class="measure-card ${chosen?'chosen':''}"><div class="measure-top"><span class="category-icon" style="color:${c.color};background:${c.color}15">${c.icon}</span><span class="category-name">${c.name}</span><strong class="cost">${m.cost}<small> ед.</small></strong></div><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p><div class="effects">${Object.entries(m.effects).map(([k,v]) => `<span class="${v<0?'negative':''}" title="${METRICS[k].name}: реализованный эффект ${fmt(v*(HORIZON-m.lag)/HORIZON)}">${k} ${v>0?'+':''}${v}</span>`).join('')}<small>Полный эффект</small></div><div class="measure-timing">Начало через ${m.lag} кв. <span>${(HORIZON-m.lag)/HORIZON*100}% эффекта за 2 года</span></div><div class="measure-action">${m.scope==='district'?`<select aria-label="Район для ${esc(m.name)}" data-target="${m.id}" ${chosen?'disabled':''}>${DISTRICTS.map(d=>`<option value="${d.id}" ${targets.get(m.id)===d.id?'selected':''}>${d.name}</option>`).join('')}</select>`:'<span class="city-scope">◎ Весь город</span>'}<button class="add-button" data-add="${m.id}" ${chosen || !check.valid?'disabled':''} aria-label="Добавить ${esc(m.name)}">${chosen?'✓ Выбрано':'+ Выбрать'}</button></div>${!chosen && !check.valid?`<div class="blocked-reason">${esc(check.errors[0])}</div>`:''}</article>`;
  }).join('');
}
$('#filters').addEventListener('click',e => { const b = e.target.closest('[data-filter]'); if(b) {filter=b.dataset.filter;renderCatalog();} });
$('#measure-list').addEventListener('change',e => { if(e.target.dataset.target) {targets.set(e.target.dataset.target,e.target.value);renderCatalog();} });
$('#measure-list').addEventListener('click',e => {
  const b = e.target.closest('[data-add]'); if(!b) return;
  const next = [...decisions,choice(measure(b.dataset.add))], check = validate(next,{partial:true});
  if (!check.valid) return notify(check.errors.join(' '));
  decisions=next; invalidate(); notify(`Добавлено. Решений: ${decisions.length} из 5.`);
});
$('#decision-list').addEventListener('click',e => { const b = e.target.closest('[data-remove]'); if(b) {decisions=decisions.filter(d=>d.measureId!==b.dataset.remove);invalidate();} });
function selectDistrict(e) {
  if(e.type==='keydown' && !['Enter',' '].includes(e.key)) return;
  const region=e.target.closest('[data-district]'); if(!region) return;
  e.preventDefault(); selectedDistrict=region.dataset.district;
  for(const key of targets.keys()) targets.set(key,selectedDistrict);
  render();
}
$('#district-map').addEventListener('click',selectDistrict); $('#district-map').addEventListener('keydown',selectDistrict);
$('#show-base').addEventListener('click',()=>setMap(true)); $('#show-preview').addEventListener('click',()=>setMap(false));
function setMap(base) {showBase=base;$('#show-base').setAttribute('aria-pressed',String(base));$('#show-preview').setAttribute('aria-pressed',String(!base));render();}
$('#demo').addEventListener('click',()=>{decisions=structuredClone(EXAMPLE);invalidate();notify('Пример организаторов: 95 единиц. Запустите анализ.');});
$('#reset').addEventListener('click',()=>{decisions=[];invalidate();notify('Бюджет и решения сброшены.');});
async function api(path,data) {
  const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(35000)});
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || result.errors?.join(' ') || 'Не удалось выполнить запрос.');
  return result;
}
$('#analyze').addEventListener('click',async()=>{
  const requestRevision=revision, selected=structuredClone(decisions); busy=true;render();notify('Рассчитываем влияние и готовим рекомендации…');
  try {
    const data = await api('/api/analyze',{decisions:selected});
    if(revision!==requestRevision) return;
    lastResult=data; renderReport(data);notify('Расчёт завершён.');
    $('#analysis').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  } catch(error) {if(revision===requestRevision) notify(error.name==='TimeoutError'?'Время ожидания истекло. Повторите анализ.':error.message);}
  finally {if(revision===requestRevision) {busy=false;render();}}
});
function renderReport(data) {
  const r=data.result, report=data.report;
  $('#result-content').className='report';
  $('#result-content').innerHTML=`<div class="report-hero"><div><span>Astana Quality of Life Score</span><strong>${fmt(r.score)}<small> / 100</small></strong><p>+${fmt(r.delta)} к исходным ${fmt(BASELINE.score)}</p></div><div class="report-stats"><div><b>${r.cost} / 100</b><span>бюджет</span></div><div><b>${r.critical.length}</b><span>критических показателей</span></div><div><b>${r.synergies.length}</b><span>синергий</span></div></div></div><div class="formula-strip">0,7 × ${fmt(r.average)} + 0,3 × ${fmt(r.weakest.score)} − ${r.critical.length} = ${fmt(r.score)}</div><div class="analysis-mode ${data.mode==='ai'?'live':''}">${data.mode==='ai'?`✧ AI-анализ · ${esc(data.model)}`:esc(data.reason)}</div><h3>${esc(report.summary)}</h3><div class="report-columns">${[['strengths','Сильные стороны'],['risks','Риски и компромиссы'],['recommendations','Что можно улучшить']].map(([key,title])=>`<section><h4>${title}</h4><ul>${report[key].map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`).join('')}</div>${data.recommendations?.length?`<div class="recommendation-actions">${data.recommendations.map((rec,i)=>`<button class="button secondary" data-recommendation="${i}">Применить вариант ${i+1} · +${fmt(rec.gain)}</button>`).join('')}</div>`:''}<details><summary>Вклад каждой меры в результат</summary><p class="muted">Разница между полным сценарием и сценарием без одной меры. Вклады не складываются из-за синергий и порогов.</p><div class="table-scroll"><table><thead><tr><th>Инициатива</th><th>Стоимость</th><th>Доля эффекта</th><th>Вклад в Score</th></tr></thead><tbody>${r.contributions.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.cost}</td><td>${c.realizedFraction*100}%</td><td>${fmt(c.marginalScore)}</td></tr>`).join('')}</tbody></table></div></details><div class="report-actions"><button id="export" class="button secondary">Скачать JSON</button><button id="print" class="button secondary">Печатный отчёт / PDF</button></div>`;
}
$('#result-content').addEventListener('click',e=>{
  if(e.target.id==='print') window.print();
  if(e.target.id==='export' && lastResult) {
    const blob=new Blob([JSON.stringify({decisions,...lastResult},null,2)],{type:'application/json'}), url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='astana-scenario.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const b=e.target.closest('[data-recommendation]');
  if(b && lastResult) {decisions=structuredClone(lastResult.recommendations[Number(b.dataset.recommendation)].decisions);invalidate();notify('Улучшенный вариант применён. Запустите новый анализ.');}
});
$('#save-form').addEventListener('submit',e=>{
  e.preventDefault();
  try {saved=saveScenario(storage,saved,$('#scenario-name').value,decisions);$('#scenario-name').value='';renderSaved();notify('Сценарий сохранён в этом браузере.');}
  catch {notify('Не удалось сохранить: проверьте сценарий и доступ к хранилищу браузера.');}
});
function renderSaved() {
  $('#saved-list').innerHTML=saved.length?`<div class="table-scroll"><table><thead><tr><th>Сценарий</th><th>Score</th><th>Изменение</th><th>Бюджет</th><th>Критические</th><th>Действия</th></tr></thead><tbody>${saved.map((s,i)=>{const r=simulate(s.decisions);return `<tr><td>${esc(s.name)}</td><td><b>${fmt(r.score)}</b></td><td>+${fmt(r.delta)}</td><td>${r.cost} / 100</td><td>${r.critical.length}</td><td><button class="table-button" data-load="${i}">Открыть</button><button class="table-button" data-delete="${i}" aria-label="Удалить сценарий ${esc(s.name)}">×</button></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="empty-comparison">Пока нет сохранённых сценариев. Соберите пять решений и сохраните первый вариант.</p>';
}
$('#saved-list').addEventListener('click',e=>{
  const load=e.target.closest('[data-load]'), del=e.target.closest('[data-delete]');
  if(load) {decisions=structuredClone(saved[Number(load.dataset.load)].decisions);invalidate();$('#main').scrollIntoView();}
  if(del) {try {const next=saved.filter((_,i)=>i!==Number(del.dataset.delete));storage.setItem(STORAGE_KEY,JSON.stringify(next));saved=next;renderSaved();}catch{notify('Хранилище недоступно.');}}
});
render();
fetch('/api/config').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(c=>{$('#ai-status').textContent=c.aiConfigured?'✧ AI подключён':'Локальный отчёт · AI не подключён';}).catch(()=>{$('#ai-status').textContent='Сервер недоступен';});
