# Визуальные материалы

## Концептуальная иллюстрация

Файл: `frontend/public/images/astana-concept.jpg`.
Создан 23 сентября 2026 встроенным imagegen, не Midjourney.
Исходная PNG-иллюстрация преобразована в JPEG для загрузки на сайте.
Используется на главной и на обложке автоматически создаваемой презентации.
Это вымышленный квартал в стиле Астаны, не фотография или реконструкция района.

Промпт:

> Use case: stylized-concept. Asset type: hero illustration and presentation cover for an urban planning simulator called AKIM, no text in the image. Create a polished architectural 3D isometric miniature neighborhood inspired by contemporary Astana: 4 elegant cream and light blue mid-rise residential blocks, a small modern school with playground, a clinic, a tram stop, clear geometric roads, tiny cars, a few children and adult pedestrians in a green courtyard. Astana's Baiterek tower and a graceful bridge subtly in far background, not dominant. Sophisticated soft clay-render material, crisp architecture, realistic ambient occlusion, warm morning sun from upper left, minimal pale blue-gray seamless background #eef2f6, petrol blue #087f87 and navy #18364a accents with warm gold. Landscape wide composition 3:2, entire district model fully visible with generous breathing room on all sides. Architectural visualization quality, beautifully detailed but uncluttered, suitable for a municipal dashboard. No text, no labels, no logo, no watermark. This is clearly an illustrative conceptual model, not a documentary aerial photograph.

## Интерактивные сцены

- MapLibre показывает реальные OSM-границы, белые здания используют реальные контуры OSM и высоты из тегов либо явно помеченные оценки.
- Three.js рисует пять различных условных кварталов, встроенных в планирование района. M7 добавляет корпус школы,
  M8 — клинику, M9 — спортплощадку, M3 — трамвайную линию. Остальные меры
  отображаются условными деревьями, освещением, инфраструктурой и сервисами.
- При смене района учитываются только его локальные меры и общегородские меры.
- Объекты появляются после лага. Промежуточный масштаб иллюстративный.
- Количество машин и детей не вычисляется из населения. T1 управляет
  условным ощущением плотности и скорости потока. Это не транспортная модель.
- Доступны пауза, вращение и `prefers-reduced-motion`.
- При невозможности WebGL вместо улицы используется концептуальная иллюстрация.

Числа и графики создаются из `shared/engine.mjs`, изображения не являются
источником статистики. Границы и лицензия описаны в `MAP-SOURCES.md`.

## Районные отчёты v4

Первый слайд захватывает обе актуальные Three.js-сцены Q0/Q8 выбранного района.
Снимки встраиваются в HTML как data URL. Сцены учитывают только местные
и общегородские меры; все графики вычисляются из тех же решений.
Реальная городская геометрия, происхождение высот и границы покрытия:
[ASTANA-URBAN-SOURCES.md](ASTANA-URBAN-SOURCES.md).
