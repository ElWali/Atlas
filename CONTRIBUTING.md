# 🤝 Contributing to Atlas

Thank you for your interest in **Atlas** — the borderless atlas of Earth.  
We believe contributions can come from both specialized developers **and** curious individuals from many backgrounds. This document explains how to contribute effectively.

---

## 📜 Code of Conduct
All contributors are expected to uphold the [Code of Conduct](CODE_OF_CONDUCT.md).  
We are building a global, inclusive atlas: discussions should remain respectful, constructive, and welcoming.

---

## 🛠️ Contribution Pathways

### A) Developers & Technical Contributors
If you are a developer, data engineer, or cartography specialist, here are the areas where your expertise matters most:

- **Data Processing & Pipelines**
  - Improve scripts for filtering, normalizing, and merging OSM / GeoNames / Natural Earth data.
  - Enhance data validation: detect anomalies, enforce schema consistency.

- **Database Architecture**
  - Extend Atlas schema (PostgreSQL + PostGIS).
  - Optimize queries to handle planet-scale data efficiently.

- **Rendering**
  - Design MapLibre GL styles for a distinct borderless aesthetic.
  - Implement tile serving (Tegola / TileServer GL) with global coverage.

- **Linguistic Engineering**
  - Expand support for multi-script names and transliteration.
  - Improve multilingual search functionality.

- **Testing & Infrastructure**
  - Add unit/integration tests for pipelines and APIs.
  - Support CI/CD, scalability, and infrastructure automation.

**Workflow:**
1. Fork the repo.  
2. Create a feature branch (`feature/my-contribution`).  
3. Make changes with clear commit messages.  
4. Ensure tests pass.  
5. Open a Pull Request explaining context, motivation, and approach.

---

### B) Non-Technical / General Contributors
Atlas is also open to people who are not programmers but who bring valuable knowledge, creativity, or attention to detail:

- **Translators & Linguists**
  - Add or verify place names in multiple languages and scripts.
  - Document historical or cultural variants of names.

- **Cultural Researchers**
  - Suggest corrections or enrichments to names where local or indigenous contexts matter.
  - Highlight missing heritage or landmark data.

- **Design Thinkers**
  - Share ideas on usability, map readability, and user experience.
  - Provide mockups or critiques of visual style.

- **Curious Explorers**
  - Try out the Atlas interface.
  - Report issues, misspellings, or inconsistencies via GitHub Issues.
  - Suggest improvements through feedback.

**Workflow:**
1. Check if your issue or idea already exists in [Issues](../../issues).  
2. If not, open a new Issue with as much context as possible (screenshots, examples, references).  
3. For name-related contributions, please provide reliable sources or local knowledge when possible.

---

## 🔎 Contribution Principles
- **Quality over quantity**: small, accurate improvements are more valuable than mass but questionable changes.  
- **Transparency**: always explain *why* a change is useful (especially in multilingual naming).  
- **Attribution & Sources**: cite sources for names or data corrections to ensure reliability.  
- **Respect for diversity**: multiple names (endonyms, exonyms, historical) are all preserved. Atlas does not impose “one official naming choice.”  

---

## 📂 Repository Structure (High-Level)
- `/pipeline/` → Data ETL scripts (imports, cleaning, validation).  
- `/db/` → Database schema migrations and utilities.  
- `/tiles/` → Tile rendering configurations and styles.  
- `/frontend/` → Web client (MapLibre GL, UI components).  
- `/docs/` → Documentation, specifications, philosophy papers.  

---

## 📜 Licensing Reminder
- All **software contributions** to Atlas are covered by **GNU GPL v2.0**.  
- Data contributions must respect upstream licenses: ODbL (OSM), CC-BY (GeoNames), CC-BY-SA (Wikidata).  

By submitting contributions, you agree to these terms.  

---

## 💡 Getting Started
- Browse [open issues](../../issues).  
- Join discussions under [Discussions](../../discussions).  
- Start small: suggest a translation, polish a style rule, or refactor a single pipeline step.  

Atlas thrives on **many voices**: expert engineers, thoughtful linguists, sharp-eyed testers, and curious newcomers.  
Together, we can create an atlas that belongs to everyone.  

---
