# ⚖️ Legal Notice – Atlas

This document provides a clear explanation of the legal framework under which the **Atlas** project operates.  
It is a supplement to the [LICENSE](LICENSE) file and the licensing sections of the [README](README.md).  

---

## 1. Software License

All **code written specifically for Atlas** (pipelines, scripts, APIs, rendering tools, frontend components) is released under the:

**GNU General Public License v2.0 (GPL‑2.0)**

- You may use, study, copy, and modify the software freely.  
- If you distribute modified versions of the software, you must also license them under GPL‑2.0.  
- A full copy of the license is included in the [`LICENSE`](LICENSE) file.  

---

## 2. Data Licensing and Attribution

Atlas data is **not uniform in license**, because we integrate multiple open sources. To respect these projects, please note:

- **OpenStreetMap**: © OpenStreetMap contributors, licensed under **ODbL 1.0**.  
- **GeoNames**: Licensed under **CC‑BY 4.0** (requires attribution).  
- **Natural Earth**: Public Domain (no restrictions).  
- **Wikidata**: Licensed under **CC‑BY‑SA 4.0** (requires attribution and share‑alike).  

**Implication for Atlas data users:**  
- Any datasets derived from OSM must remain open under the **ODbL** license.  
- GeoNames and Wikidata data require attribution to their sources.  
- Natural Earth data may be used freely without restriction.  

---

## 3. Relationship Between Code License and Data Licenses

- **The Atlas software (GPL‑2.0)** is separate from the upstream **data licenses**.  
- Using the Atlas software on your own data does not bind your data to GPL‑2.0.  
- Distributing Atlas *with included OSM/GeoNames/Wikidata data* requires following both the GPL‑2.0 for the code **and** the relevant licenses for the data.  

Example:  
- If you fork Atlas and use your own proprietary dataset → your code changes must be GPL‑2.0, but your data remains your choice.  
- If you fork Atlas and ship it with OSM data → your distribution must include ODbL attribution and share‑alike compliance.  

---

## 4. Attribution of Atlas

When reusing Atlas code or data, a clear attribution should appear in your product, service, or research paper. A suggested form:

> **Map data from Atlas** — © OpenStreetMap contributors (ODbL 1.0), GeoNames (CC‑BY 4.0), Natural Earth (Public Domain), Wikidata (CC‑BY‑SA 4.0).  
> **Atlas software** — Licensed under GPL‑2.0.  

---

## 5. Disclaimer of Warranty

Atlas is provided *“as is” without warranty of any kind*.  
Data may contain errors, omissions, or outdated information. Atlas contributors and maintainers are not liable for any damages arising from the use of the software or data.  

---

## 6. Contact

For licensing questions or compliance issues, please open an issue on the [GitHub repository](./) or contact the maintainers directly.  

---
