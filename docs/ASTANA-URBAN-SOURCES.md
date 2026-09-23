# Astana urban geometry for white/clay 3D views

## Ready assets

- `astana-urban.geojson`: central Astana, 4,615 features, about 1.89 MB.
- **`astana-urban-districts.geojson`**: recommended combined asset, 5,858 features, about 2.45 MB. Contains the central Esil area plus four small representative urban fragments. **It is not complete coverage of the five districts.**
- Corresponding `*-metadata.json`: exact source URLs, retrieval times, counts, height policy, SHA-256, license.
- `astana-urban-cameras.json`: focus points and queried rectangles for the five views.

All coordinates and footprints come from OpenStreetMap. No building footprint, road, park or river geometry was invented. The source is community mapping, not an independently surveyed or cadastral model. The original proposed larger area was reduced after three public Overpass endpoints returned HTTP 504/timeouts. Public OSM API map extracts succeeded.

## Viewports

Coordinates below are **[longitude, latitude]**; bboxes are **[west, south, east, north]**. Centers were checked against the six current OSM district boundaries in `work/map-research/astana-districts.geojson`. These are selected urban sample locations, not district administrative centers.

| View | Camera center | Queried bbox |
| --- | --- | --- |
| Esil / central Astana | [71.432, 51.130] | [71.414, 51.121, 71.451, 51.139] |
| Nura | [71.392, 51.136] | [71.386, 51.132, 71.398, 51.140] |
| Saryarka | [71.408, 51.183] | [71.402, 51.179, 71.414, 51.187] |
| Baikonur | [71.464, 51.181] | [71.458, 51.177, 71.470, 51.185] |
| Almaty | [71.482, 51.156] | [71.476, 51.152, 71.488, 51.160] |

Use these centers/rectangles, not the combined geometry extent, to position a camera. OSM ways and polygons returned by a bbox query can extend outside the queried area; a complete Ishim river polygon is included and extends beyond the central rectangle. Panning into gaps does not imply that unmapped areas have no buildings. Label the view as a **selected fragment of the district**.

## Rendering fields

`kind`: `building`, `building_part`, `road`, `road_area`, `water`, `waterway`, or `park`. A `park` may actually be grass, garden or forest; inspect `landuse` / `leisure` before labeling it a formal park.

Buildings have `render_height_m`, `render_min_height_m`, `height_source`, `height_estimated`, `fallback_height`, and original height/levels tags. Render heights are absolute above ground; extrusion depth is top minus base.

- `osm_height`: parsed OSM `height` (metres, or feet converted to metres); not independently verified.
- `levels_times_3m_assumption`: OSM levels times an illustrative 3 metres per storey. Explicitly estimated.
- `fallback_8m`: no usable height/levels. Render an illustrative 8 metre depth above the base, explicitly flagged.
- Base height is from OSM `min_height`, else an explicitly labeled assumption of `building:min_level × 3m`, else ground level.

Combined asset: 39 buildings/parts have an OSM height; 676 use the levels assumption; 703 use a fallback. These counts describe mapping completeness, not city statistics. Roads are centerlines unless `road_area`; untagged rendered widths are visual assumptions.

Preserved `roof:shape` / `building:min_level` tags can help depict landmarks. Baiterek's footprint is `way/230401645`; its upper part is `way/230401644` with OSM `roof:shape=orb`. Its render heights are estimated from levels, not measured heights. Akorda is `way/166198046` with OSM height 86 m. Ishim water polygon: `way/23970652`.

## Source, processing, licensing

Retrieved 2026-09-23 via [OpenStreetMap API](https://wiki.openstreetmap.org/wiki/API_v0.6), endpoint `https://api.openstreetmap.org/api/0.6/map.json?bbox=...`. Exact five request URLs are in the combined metadata. Original JSON snapshots are retained beside the assets.

Converted with [osmtogeojson 3.0.0-beta.5](https://github.com/tyrasd/osmtogeojson) (MIT software license), preserving multipolygon holes. Coordinates rounded to six decimal places; no simplification or synthetic geometry added. Incomplete/tainted geometries were excluded (26 in the combined conversion). The combined output has 5,858 unique IDs, 47,977 coordinate pairs and 427 interior rings; closed-ring and finite-coordinate checks passed. One missing top-height building part is explicitly rendered as base+8 m to avoid a negative extrusion.

Data license: [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Display **© OpenStreetMap contributors** linked to [OSM copyright](https://www.openstreetmap.org/copyright). Preserve attribution and provide the derived GeoJSON/metadata with the project. OSM data remain separate from the synthetic city score model.

Only copy the GeoJSON, camera file and metadata/source documentation into the product. Raw snapshots, converter dependencies, npm cache and research scripts are research materials, not client dependencies.
