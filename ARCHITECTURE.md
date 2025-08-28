# 🏛️ Atlas Architecture

This document describes the functional architecture of the **Atlas Project**: its layers, components, data flow, and responsibilities.  

It provides a high-level guide for contributors — developers, linguists, designers, and researchers — to understand **how the system fits together**.

---

## 🔑 Overview

Atlas is designed as a **pipeline → database → rendering → APIs → applications** system, with strong emphasis on:

- **Prefilled global dataset** (OSM Planet Dump + GeoNames + Natural Earth + Wikidata)  
- **Borderless view** (political boundaries deliberately excluded)  
- **Multilingual naming core**  
- **Curator model**: contributors refine quality, enrichment, and pipelines rather than building a dataset from scratch  

---

## 🖼️ High-Level Architecture Diagram

```mermaid
flowchart TD

    A[External Data Sources<br>(OSM, GeoNames, Natural Earth, Wikidata)]
      --> B[Atlas Data Pipeline<br>Filtering / Validation / Name Merging]

    B --> C[Atlas Database<br>(PostGIS)]

    C --> D[Atlas API Layer<br>(REST / GraphQL)]
    C --> E[Vector Tile Generator<br>(Tegola / TileServer GL)]

    D --> F[Applications & SDKs<br>(Python SDK / JS SDK / CLI Tools)]
    E --> G[Atlas Frontend<br>(MapLibre GL Web Client)]

    F --> H[End Users: Developers, Researchers, NGOs, Educators]
    G --> H
