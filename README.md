# 🌍 Atlas  

**A Borderless Atlas of Earth**  
Settlements, landscapes, and names at planet scale — free from political boundaries.  

---

## 📖 Project Overview  
Atlas is an open geospatial initiative that reimagines how Earth can be represented.  
Instead of borders and administrative hierarchies, Atlas foregrounds:  

- Cities, towns, villages, and settlements  
- Rivers, lakes, mountains, and coastlines  
- Land cover and natural terrains  
- Names in multiple languages and scripts  

We start with a **fully populated world dataset** (derived from OSM, GeoNames, Natural Earth, and complementary open sources).  
From day one, the map is *already full*.  
Contributors focus on **refinement, enrichment, and technical excellence** rather than filling blank spaces.  

---

## 🌐 Philosophy  
- **Borderless View** → The Earth without geopolitical overlays.  
- **Prefilled Baseline** → A complete atlas from the very first release.  
- **Multilingual Core** → Endonyms, exonyms, and historical forms treated equally.  
- **Curator Model** → 90% contributions improve quality, pipelines, rendering, and naming systems. 10% correct geographic details.  

---

## 🛠️ Technical Foundation  
- **Database**: PostgreSQL + PostGIS  
- **Pipelines**: OSM planet dumps, GeoNames, Natural Earth integration  
- **Data Handling**: osm2pgsql, osmfilter, custom ETL scripts  
- **Tile Infrastructure**: Tegola / TileServer GL for vector tiles  
- **Frontend**: MapLibre GL styles (custom Atlas aesthetic)  
- **Languages**: Python / Go for pipelines, JS/TS for frontend  

---

## 🔍 What Makes Atlas Distinct  
- **No borders**: Political features are deliberately excluded.  
- **Names first**: Settlements, rivers, mountains, and landscapes are the primary focus.  
- **Scale**: Designed to ingest, normalize, and render **planet-scale data**.  
- **Neutrality**: A global atlas that avoids boundary disputes while retaining geographic richness.  

---

## 👩‍💻 Who Can Contribute?  
Atlas is open for **everyone** to contribute — because we believe valuable insights do not come only from specialized developers.  

### Technical Contributors  
- Geospatial engineers (PostGIS, ETL, pipelines, osm2pgsql)  
- Frontend and cartography developers (MapLibre, GL styles, rendering)  
- Data scientists and pipeline builders (validation, anomaly detection)  
- Linguistic engineers (multi-script handling, transliteration, lexicon enrichment)  

### Non-Technical / General Contributors  
- **Translators & linguists** → Add, verify, or refine names across languages and scripts  
- **Cultural researchers** → Validate historical variants, endonyms, local usage  
- **Designers** → Suggest improvements to the user experience or visualization style  
- **Curious explorers** → Spot inconsistencies, flag errors, or simply test Atlas and give feedback  

We do not know what unexpected contributions can emerge — and that is exactly the strength of opening the project to a wider audience.  

---

## 📜 Licensing & Attribution  

**Software License**  
This software is licensed under the **GNU General Public License v2.0**.  
A copy of the full license text is included in the [`LICENSE`](LICENSE) file.  

**Data Attribution**  
Atlas incorporates data from the following open projects:  
- [OpenStreetMap contributors](https://www.openstreetmap.org) – © OSM, licensed ODbL  
- [GeoNames](https://www.geonames.org) – CC-BY 4.0  
- [Natural Earth](https://www.naturalearthdata.com) – Public Domain  
- [Wikidata](https://www.wikidata.org) – CC-BY-SA 4.0  

Derived datasets produced by Atlas comply with the respective upstream license terms (ODbL for OSM-based data).  

---

## 🌟 Vision  
Atlas is not simply “another map.”  
It is a **new paradigm in digital cartography**: a borderless world atlas where settlements, names, and natural features define the Earth.  

We are building long-term infrastructure — open for **engineers, researchers, translators, designers, and curious users** alike. Whatever your background, if you share curiosity for how the Earth can be represented without political boundaries, you can help shape Atlas.  

---
