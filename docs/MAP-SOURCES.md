# Astana district map sources

Retrieved 23 September 2026. This is a cached geographic dataset for the city simulator. It is independent from the supplied fictional quality-of-life indicators.

## Deliverables

- `astana-districts.geojson`: six actual OpenStreetMap district geometries (WGS84, longitude then latitude). Geometry coordinates are copied from the source without manual drawing or simplification.
- `district-centers.json`: names in Kazakh, Russian and English, relation IDs, Nominatim representative center coordinates and bounding boxes. These centers are label/focus positions, not official district administration locations.
- `nominatim-raw.json`: original JSON response, including attribution and geometry, retained for provenance.
- `fetch-boundaries.mjs`: reproducible one-request lookup for the six known relation IDs. Do not call it from the application or on every build.
- `check-boundaries.mjs`: validates closed rings, coordinate range, six unique IDs and five simulation mappings. It does not certify the legal accuracy of boundaries.

## Geographic data and licensing

The geometries come from OpenStreetMap via a single public Nominatim lookup:

https://nominatim.openstreetmap.org/lookup?osm_ids=R3479876%2CR3482819%2CR3486954%2CR8593081%2CR20593940%2CR19733918&format=jsonv2&polygon_geojson=1&namedetails=1

| Dataset ID | District | OSM relation | Center [longitude, latitude] |
| --- | --- | --- | --- |
| esil | Есіл / Есиль / Esil | https://www.openstreetmap.org/relation/3479876 | [71.4644792, 51.0410060] |
| almaty | Алматы / Алматы / Almaty | https://www.openstreetmap.org/relation/3482819 | [71.5473172, 51.1550554] |
| saryarka | Сарыарқа / Сарыарка / Saryarka | https://www.openstreetmap.org/relation/3486954 | [71.3226517, 51.1988462] |
| baikonur | Байқоңыр / Байконур / Baikonur | https://www.openstreetmap.org/relation/8593081 | [71.4580973, 51.2264690] |
| nura | Нұра / Нура / Nura | https://www.openstreetmap.org/relation/20593940 | [71.3160362, 51.1008961] |
| none | Сарайшық / Сарайшык / Sarayshyk | https://www.openstreetmap.org/relation/19733918 | [71.5658681, 51.1127271] |

License: Open Data Commons Open Database License 1.0 (ODbL): https://opendatacommons.org/licenses/odbl/1-0/ . Attribution: `© OpenStreetMap contributors`, linked to https://www.openstreetmap.org/copyright . Keep the attribution visible on the interactive map. The geographic data remains under ODbL independently of the source-code license.

OpenStreetMap is community maintained. These are sourced geographic boundaries, not a legally certified cadastral map. Recent changes can be absent or delayed.

## Six actual districts, five model districts

The hackathon attachment contains five synthetic districts and fictional population weights. The actual city has six districts. The official city architecture administration lists Алматы, Есіл, Нұра, Сарайшық, Байқоңыр and Сарыарка:

https://www.gov.kz/memleket/entities/astana-saulet/press/news/details/1274528

The Ministry of Emergency Situations describes implementation of the new Сарайшық district and cites the joint resolution/decision of 23 May 2024:

https://www.gov.kz/memleket/entities/emer/press/news/details/798119

Recommended honest display:

1. Show all six sourced boundaries over a real Astana base map.
2. Match the five supplied model rows by name through `properties.datasetId`. Color these districts using the simulation score. Scores and population weights remain exactly the supplied synthetic values and must not be labeled official live statistics.
3. Draw Сарайшық with a muted neutral fill and dashed outline; mark it “Not included in the provided dataset” and disable investment selection there.
4. Explain that current district geography and the five-district educational dataset are separate layers. In particular, the five-district Алматы sample must not be interpreted as current statistics for the reduced actual administrative area.
5. Do not silently split Алматы's fictional indicators or population share, invent a sixth district score, or claim the synthetic scores cover the entire current city.

Suggested UI notice:

- KK: “Нақты карта, оқу деректері. Симуляция берілген 5 ауданның синтетикалық көрсеткіштерін пайдаланады. Сарайшық деректер жиынына кірмейді.”
- RU: “Реальная карта, учебные данные. Симуляция использует синтетические показатели 5 районов из задания. Сарайшык не включён в набор данных.”
- EN: “Real geography, educational data. The simulation uses the five synthetic district records from the brief. Sarayshyk is outside the provided dataset.”

## Base map and provider policy

Leaflet can display these bundled boundaries without any online geometry service. Standard raster tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` and the same visible OSM attribution. Follow the tile usage policy: https://operations.osmfoundation.org/policies/tiles/ . Use normal browser requests with a Referer, honor cache headers, and do not bulk download tiles or prefetch offline areas. Tile servers are a best-effort service, so retain a usable local boundary layer and district list when tiles cannot load; use a suitable tile provider for heavier production traffic.

The public Nominatim service is only used for this cached one-time six-object lookup. Its usage policy is https://operations.osmfoundation.org/policies/nominatim/ : maximum one request per second, an identifying User-Agent/Referer, cache results, and no autocomplete or systematic geocoding. There must be no runtime Nominatim dependency in the product.

Recommended initial Leaflet view: `[51.145, 71.43]` at zoom 11.5; fit a district's GeoJSON bounds when selected. Leaflet arrays are latitude then longitude, whereas GeoJSON and the stored `center` values are longitude then latitude.
