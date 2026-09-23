import { BASELINE, recommend } from './public/engine.mjs';
import { MEASURES, DISTRICTS, CATEGORIES } from './public/data.mjs';
const num = value => value.toFixed(2);
export function buildFacts(decisions, result) {
  return { baseline: BASELINE, result, recommendations: recommend(decisions),
    decisions: decisions.map(d => ({ ...d, ...MEASURES.find(m => m.id === d.measureId),
      districtName: DISTRICTS.find(x => x.id === d.districtId)?.name || 'Весь город' })) };
}
export function localReport(facts) {
  const { result, decisions, recommendations } = facts;
  const best = [...result.contributions].sort((a,b) => b.marginalScore-a.marginalScore)[0];
  const covered = new Set(decisions.map(d => d.category));
  const omitted = CATEGORIES.filter(c => !covered.has(c.id)).map(c => c.name);
  const negative = decisions.filter(d => Object.values(d.effects).some(v => v < 0));
  const strengths = [
    `Качество жизни: ${num(result.score)} балла, изменение к базе ${num(result.delta)}. Потрачено ${result.cost} из 100 единиц.`,
    `Наибольший предельный вклад: «${best.name}» — ${num(best.marginalScore)} балла относительно сценария без этой меры.`,
    result.critical.length === 0 ? 'Все показатели достигли порога 40: критических провалов нет.' : `Критических показателей осталось: ${result.critical.length}.`,
  ];
  if (result.synergies.length) strengths.push(`Сработали синергии: ${result.synergies.map(s => `${s.label} (${s.districtName})`).join(', ')}.`);
  const risks = [`Слабейший район — ${result.weakest.name}: ${num(result.weakest.score)}. Он определяет 30% результата до штрафа.`];
  if (omitted.length) risks.push(`Нет прямых инвестиций в направления: ${omitted.join(', ')}. Возможны только косвенные эффекты выбранных мер.`);
  if (negative.length) risks.push('Безопасные переходы улучшают безопасность, но снижают разгрузку дорог T1 на 1,75 пункта в выбранном районе.');
  if (result.critical.length) risks.push(`Зоны риска: ${result.critical.map(c => `${c.district} — ${c.name} (${num(c.value)})`).join('; ')}.`);
  risks.push('Эффекты условные: модель не учитывает миграцию, инфляцию и качество исполнения. Горизонт — 8 кварталов; лаг снижает реализованный эффект.');
  const advice = recommendations.length ? recommendations.map(r => {
    const old = MEASURES.find(m => m.id === r.remove.measureId);
    const next = MEASURES.find(m => m.id === r.add.measureId);
    const where = DISTRICTS.find(d => d.id === r.add.districtId)?.name || 'весь город';
    return `Вместо «${old.name}» выбрать «${next.name}» (${where}): Score ${num(r.score)}, улучшение ${num(r.gain)}, стоимость ${r.cost}.`;
  }) : ['Среди допустимых замен одной меры улучшения не найдено. Это не доказывает глобальную оптимальность сценария.'];
  return { summary: 'Расчётный разбор сценария', strengths, risks, recommendations: advice };
}
export async function analyze(facts, { apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4.1-mini', fetcher = fetch } = {}) {
  const fallback = localReport(facts);
  if (!apiKey) return { mode: 'local', reason: 'AI-ключ не настроен. Показан локальный расчётный отчёт.', report: fallback };
  try {
    const response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ model, store: false, max_output_tokens: 1800,
        instructions: 'Ты советник акима в учебном симуляторе. Пиши по-русски. Все числа уже вычислены детерминированным движком: используй только переданные факты, не пересчитывай Score, не придумывай прогнозов и мероприятий. Объясни сильные стороны, риски, лаги, распределение по районам и компромиссы. Вклады leave-one-out не аддитивны. Рекомендации только из вычисленного списка, без утверждения глобальной оптимальности. Не обещай реальные результаты. Ответ — JSON с полями summary (строка), strengths, risks, recommendations (массивы строк).',
        input: JSON.stringify(facts),
        text: { format: { type: 'json_schema', name: 'city_analysis', strict: true,
          schema: { type: 'object', properties: {
            summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } }, recommendations: { type: 'array', items: { type: 'string' } },
          }, required: ['summary','strengths','risks','recommendations'], additionalProperties: false } } },
      }),
    });
    if (!response.ok) throw new Error('Provider error');
    const data = await response.json();
    if (data.status && data.status !== 'completed') throw new Error('Incomplete response');
    const raw = data.output?.flatMap(item => item.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
    const report = JSON.parse(raw);
    if (typeof report.summary !== 'string' || ['strengths','risks','recommendations'].some(k =>
      !Array.isArray(report[k]) || report[k].some(x => typeof x !== 'string'))) throw new Error('Invalid report');
    return { mode: 'ai', model, report };
  } catch {
    return { mode: 'local', reason: 'AI-сервис не ответил корректно. Расчёт сохранён; показан локальный отчёт.', report: fallback };
  }
}
