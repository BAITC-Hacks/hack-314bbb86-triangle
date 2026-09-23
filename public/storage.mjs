import { simulate } from './engine.mjs';
import { VERSION } from './data.mjs';
export const STORAGE_KEY = 'triangle-akim-scenarios-v1';
export function readScenarios(storage) {
  try {
    const items = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(items)) return [];
    return items.filter(x => x && x.version === VERSION && typeof x.name === 'string' && x.name.length <= 80 && simulate(x.decisions).valid).slice(0,8);
  } catch { return []; }
}
export function saveScenario(storage, items, name, decisions) {
  if (!simulate(decisions).valid) throw new Error('Можно сохранить только допустимый сценарий.');
  const next = [{ name: name.trim().slice(0,80) || `Сценарий ${items.length+1}`, decisions: structuredClone(decisions), version: VERSION },...items].slice(0,8);
  storage.setItem(STORAGE_KEY,JSON.stringify(next));
  return next;
}
