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
- **Database**: PostgreSQL + PostGIS.  
- **Pipelines**: OSM planet dumps, GeoNames, Natural Earth integration.  
- **Data Handling**: osm2pgsql, osmfilter, custom ETL scripts.  
- **Tile Infrastructure**: Tegola / TileServer GL for vector tiles.  
- **Frontend**: MapLibre GL styles (custom Atlas aesthetic).  
- **Languages**: Python / Go for pipelines, JS/TS for frontend.  

---

## 🔍 What Makes Atlas Distinct  
- **No borders**: Political features are deliberately excluded.  
- **Names first**: Settlements, rivers, mountains, and landscapes are the primary focus.  
- **Scale**: Designed to ingest, normalize, and render **planet-scale data**.  
- **Neutrality**: A global atlas that avoids boundary disputes while retaining geographic richness.  

---

## 👩‍💻 How to Contribute  
Atlas is open to **everyone**: developers, linguists, designers, researchers, and curious explorers.  
- Technical engineers can help build pipelines, optimize PostGIS, style the rendering stack.  
- Non-technical contributors may add translations, validate names, research history, or suggest UX improvements.  

➡️ See our full [Contributing Guidelines](CONTRIBUTING.md).  
➡️ Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).  

---

## 📜 Licensing & Legal  
- **Software License**: Atlas software is licensed under the **GNU General Public License v2.0** (see [LICENSE](LICENSE)).  
- **Legal context**: For a clear explanation of how software and data licenses interact, see [LEGAA.md](LEGAA.md).
- **Data Attribution**:  
  - [OpenStreetMap contributors](https://www.openstreetmap.org) – © OSM, licensed ODbL  
  - [GeoNames](https://www.geonames.org) – CC-BY 4.0  
  - [Natural Earth](https://www.naturalearthdata.com) – Public Domain  
  - [Wikidata](https://www.wikidata.org) – CC-BY-SA 4.0  

Derived datasets produced by Atlas comply with the respective upstream license terms (ODbL, CC‑BY, CC‑BY‑SA).  

---

## 🌟 Vision  
Atlas is not simply “another map.”  
It is a **new paradigm in digital cartography**: a borderless world atlas where settlements, names, and natural features define the Earth.  

We are building long-term infrastructure — open for **engineers, researchers, translators, designers, and curious users** alike.  
Whatever your background, if you share curiosity for how the Earth can be represented without political boundaries, you can help shape Atlas.  

---
