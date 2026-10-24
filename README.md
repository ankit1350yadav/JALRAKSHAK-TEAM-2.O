# JalRakshak 2.0 — जलरक्षक
## AI-Based Mountain Multi-Hazard Risk Intelligence & Water Management Platform

**Educational Prototype · SMVDU-Area Study Region · Reasi District, J&K**

---

## ⚠️ Prototype Disclaimer

> **JalRakshak 2.0 is an educational decision-support prototype. Multi-hazard risk scores and AI predictions are based on
> demonstration/synthetic telemetry and should not be interpreted as certified hydrological
> forecasts, disaster-management directives, or field measurements.**

This system is **NOT** intended to replace:
- Field surveys or Geological Survey of India (GSI) slope assessments
- Central Water Commission (CWC) flood monitoring
- Laboratory water-quality testing or IMD weather forecasts
- Official government disaster management protocols (NDMA / SDMA)

---

## The JalRakshak 2.0 Paradigm

Mountain communities in the Himalayan foothills (such as Reasi District, Jammu and Kashmir) face interdependent climate and geological perils:
1. **Water Stress & Drought**: Critical spring drying during summer and pre-monsoon peaks.
2. **Flash Flood Risk**: Sudden cloudburst storms and runoff concentration down steep mountain catchments.
3. **Landslide Susceptibility**: High slope angles, heavy antecedent soil moisture saturation, and loose shale/silt lithology.
4. **Cascading / Compound Hazards**: Heavy rainfall events that simultaneously saturate unstable slopes, overflow stream channels, and wash out spring intake infrastructure.

```
                    JALRAKSHAK 2.0
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
     WATER STRESS       FLOOD         LANDSLIDE
       RISK             RISK            RISK
          |               |               |
          +---------------+---------------+
                          |
                          v
                MULTI-HAZARD ENGINE
                          |
                          v
                  OVERALL RISK SCORE
                          |
              +-----------+-----------+
              |                       |
              v                       v
       DATA STORE / SIM         REACT + GIS
              |                       |
              v                       v
       Telemetry + Predictions  Dashboard + Map + Matrix
```

---

## Key JalRakshak 2.0 Features

| Feature | Description |
|---------|-------------|
| **Multi-Hazard GIS Map** | Switchable layers (*Multi-Hazard Composite*, *Water Stress*, *Flash Flood*, *Landslide Susceptibility*) with dynamic circle radius and localized terrain popups |
| **Hazard Triage Matrix** | Cross-village comparative matrix evaluating all 10 SMVDU study catchments across all 3 perils with dominant risk and alert badges |
| **Interactive Telemetry Simulator** | Real-time sensor telemetry injector featuring 4 scenarios (*Cloudburst Storm*, *Monsoon Peak*, *Summer Drought*, *Nominal Baseline*) driving instant multi-hazard recalculations |
| **Cascading Threat Alerting** | Automated detection of compound risk triggers (e.g. soil saturation > 75% + intense rainfall > 40 mm/hr trigger immediate dual Flood + Landslide emergency alerts) |
| **Multi-Hazard Prediction Lab** | 3-in-1 interactive sandbox allowing manual tuning of weather (rainfall, intensity, temp, humidity), hydrology (water level, flow rate), and terrain (slope, soil, vegetation) with real-time multi-hazard scorecards |
| **Explainable Risk Drivers** | Visual contribution breakdown showing exact percentages contributed by each peril and specific physical trigger metrics |
| **Comprehensive DRR Actions** | Action catalogue tailored for drought conservation, flash flood evacuations, slope stabilization, and compound hazard response |

---

## SMVDU-Area Study Catchments

All 10 study locations are in **Reasi district, Jammu and Kashmir**, surrounding **Shri Mata Vaishno Devi University (SMVDU)** at Kakryal/Panthal:

| # | Location | Elevation | Avg Slope | Soil Lithology | River Dist | Vegetation |
|---|----------|-----------|-----------|----------------|------------|------------|
| 1 | SMVDU Campus | 850 m | 14° | Gravelly Loam | 850 m | 42% |
| 2 | Kakryal | 820 m | 18° | Silt Clay | 450 m | 35% |
| 3 | Kotla | 790 m | 24° | Weathered Shale | 210 m | 28% |
| 4 | Bhagta | 890 m | 31° | Sandy Loam / Scree | 180 m | 22% |
| 5 | Dudura | 960 m | 36° | Fractured Sandstone | 120 m | 18% |
| 6 | Sool | 810 m | 21° | Silt Loam | 390 m | 30% |
| 7 | Dheerti | 780 m | 16° | Compact Clay | 600 m | 48% |
| 8 | Manoon (Serli) | 870 m | 28° | Debris / Gravel | 280 m | 25% |
| 9 | Panthal | 1,020 m | 38° | Highly Weathered Shale | 90 m | 15% |
| 10 | Treen Miyari | 760 m | 12° | Alluvial Silt | 720 m | 55% |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 5 + TypeScript |
| Multi-Hazard Engine | Pure TypeScript in-app model store & physics synthesis engine |
| Routing | React Router v6 |
| Charts | Recharts |
| GIS / Maps | React-Leaflet 4 + OpenStreetMap tiles |

---

## How to Run

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build for production
npm run build
```

---

*JalRakshak v2.0 · SMVDU-area study dataset · Reasi district, Jammu and Kashmir*
*Educational prototype — synthetic demonstration data only*

