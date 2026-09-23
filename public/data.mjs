export const VERSION = 'astana-synthetic-v1';
export const BUDGET = 100;
export const HORIZON = 8;
export const CATEGORIES = [
  { id: 'transport', name: 'Транспорт', icon: '↔', color: '#3974ac' },
  { id: 'ecology', name: 'Озеленение', icon: '♧', color: '#378261' },
  { id: 'social', name: 'Соцсфера', icon: '+', color: '#946caf' },
  { id: 'safety', name: 'Безопасность', icon: '◇', color: '#b97830' },
  { id: 'services', name: 'Городские сервисы', icon: '⌘', color: '#338d98' },
];
export const METRICS = {
  T1: { name: 'Разгрузка дорог', weight: .10, category: 'transport' },
  T2: { name: 'Общественный транспорт', weight: .10, category: 'transport' },
  E1: { name: 'Озеленение', weight: .09, category: 'ecology' },
  E2: { name: 'Качество воздуха', weight: .11, category: 'ecology' },
  S1: { name: 'Школы и детсады', weight: .11, category: 'social' },
  S2: { name: 'Первичная медпомощь', weight: .11, category: 'social' },
  B1: { name: 'Безопасность улиц', weight: .09, category: 'safety' },
  B2: { name: 'Дорожная безопасность', weight: .09, category: 'safety' },
  C1: { name: 'Надёжность ЖКХ', weight: .10, category: 'services' },
  C2: { name: 'Обращения жителей', weight: .10, category: 'services' },
};
const district = (id, name, population, values, profile) => ({ id, name, population,
  metrics: Object.fromEntries(Object.keys(METRICS).map((key, i) => [key, values[i]])), profile });
export const DISTRICTS = [
  district('esil', 'Есиль', .27, [45,62,68,72,48,55,78,60,75,70], 'Пробки на мостах и переполненные школы.'),
  district('almaty', 'Алматы', .24, [40,75,50,55,60,65,62,52,50,60], 'Пробки и изношенные коммунальные сети.'),
  district('saryarka', 'Сарыарка', .20, [50,70,42,40,62,68,58,55,45,55], 'Зимний смог и нехватка зелёных пространств.'),
  district('baikonur', 'Байконур', .13, [52,68,55,50,58,60,52,58,55,58], 'Сбалансированные показатели, есть запас для роста.'),
  district('nura', 'Нура', .16, [55,40,45,65,38,35,55,50,60,50], 'Дефицит школ, медицинской помощи и транспорта.'),
];
const measure = (id, category, name, scope, cost, lag, effects, description) =>
  ({ id, category, name, scope, cost, lag, effects, description });
export const MEASURES = [
  measure('M1','transport','Выделенные полосы для автобусов','district',18,2,{T1:6,T2:9},'Сократить время поездки и сделать автобус предсказуемым.'),
  measure('M2','transport','Умные светофоры','city',22,2,{T1:4,B2:3},'Адаптивное управление перекрёстками по всему городу.'),
  measure('M3','transport','Линия ЛРТ / расширение','district',30,4,{T1:16,T2:20,E2:4},'Масштабное транспортное решение с длинным сроком реализации.'),
  measure('M4','ecology','Новый парк или сквер','district',15,2,{E1:12,E2:3,B1:2},'Зелёное пространство рядом с домом.'),
  measure('M5','ecology','Чистое топливо для частного сектора','district',25,3,{E2:14,C1:4},'Снизить зимний смог и улучшить надёжность теплоснабжения.'),
  measure('M6','ecology','Озеленение и ветрозащитные полосы','city',20,4,{E1:5,E2:3},'Системное озеленение всех пяти районов.'),
  measure('M7','social','Модульная школа и детсад','district',24,3,{S1:16},'Снизить дефицит мест в растущем районе.'),
  measure('M8','social','Центр семейного здоровья','district',20,3,{S2:14},'Приблизить первичную медицинскую помощь к жителям.'),
  measure('M9','social','Дворовые спорт-хабы','district',10,1,{S1:3,S2:3,B1:3},'Быстрые локальные улучшения для здоровья и общения.'),
  measure('M10','safety','Освещение и камеры Safe City','district',12,1,{B1:12,B2:2},'Осветить улицы и расширить систему безопасности.'),
  measure('M11','safety','Безопасные переходы и школьные зоны','district',10,1,{B2:12,T1:-2},'Безопасность пешеходов ценой небольшого замедления движения.'),
  measure('M12','services','Единая платформа обращений','city',14,1,{C2:5},'Ускорить решение обращений во всех районах.'),
  measure('M13','services','Модернизация тепло- и водосетей','district',28,4,{C1:18,E2:2},'Обновить изношенные сети с учётом срока строительства.'),
  measure('M14','services','Аварийные бригады и оповещение','city',16,1,{C1:5,C2:2},'Быстрее реагировать на коммунальные аварии.'),
];
export const SYNERGIES = [
  { pair: ['M1','M2'], effects: { T1: 2 }, label: 'Полосы + светофоры' },
  { pair: ['M10','M12'], effects: { B1: 2 }, label: 'Safe City + обращения' },
  { pair: ['M5','M6'], effects: { E2: 2 }, label: 'Чистое топливо + озеленение' },
];
export const EXAMPLE = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];
