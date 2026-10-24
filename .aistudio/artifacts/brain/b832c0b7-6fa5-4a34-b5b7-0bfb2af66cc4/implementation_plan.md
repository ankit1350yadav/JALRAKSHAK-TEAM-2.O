# JalRakshak 2.0: Multi-Hazard Mountain Risk Intelligence Architecture

An integrated environmental decision-support platform upgrading JalRakshak 1.0 into a unified **Multi-Hazard Mountain Risk Platform** covering **Water Stress (Drought)**, **Flash Flood Inundation**, and **Landslide Susceptibility** across the SMVDU-area study catchment in Reasi District, Jammu & Kashmir.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were aligned during the interactive clarification phase:
> - **Multi-Hazard Synthesis**: Implements a **Composite Weighted Index ($0.35 \times \text{Water} + 0.35 \times \text{Flood} + 0.30 \times \text{Landslide}$)** augmented with a **Cascading Threat Trigger** (monsoon cloudburst $\rightarrow$ saturated terrain $\rightarrow$ slope failure / debris blocking intake taps $\rightarrow$ acute drinking water contamination/stress).
> - **ESP32 & Soil Moisture Telemetry**: Implements an **Interactive Telemetry Simulator** featuring selectable environmental presets (*Cloudburst Storm*, *Monsoon Peak*, *Summer Drought*, *Nominal Season*), manual stream sliders, and live dispatch into the data store.
> - **GIS Multi-Hazard Mapping**: Provides **Switchable Spatial Layers** (*Composite Multi-Hazard*, *Water Stress*, *Flood Risk*, *Landslide Risk*) with dynamic radius pulsing, multi-peril compound badges, and localized terrain popups.

---

## 1. System Architecture Overview

```
                               JALRAKSHAK 2.0
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
  WATER STRESS                   FLOOD RISK                   LANDSLIDE RISK
   (Drought)                  (Flash Inundation)             (Slope Failure)
  • Supply vs Demand         • Peak Rainfall Intensity      • Slope Angle & Soil
  • Spring Flow Deficit      • Catchment Discharge Buffer   • Moisture Saturation
  • Low Reservoir Buffer     • Stream Proximity (<150m)     • 3-Day Cumul. Rain
       │                              │                              │
       └──────────────────────────────┼──────────────────────────────┘
                                      │
                                      ▼
                        MULTI-HAZARD SYNTHESIS ENGINE
                     • Composite Risk Index (0–100 scale)
                     • Cascading Trigger Matrix
                     • Primary Threat Isolation
                                      │
                                      ▼
                             STATE & API LAYER
                     • In-Browser / LocalStorage State Store
                     • REST API Handlers (/api/hazards/*, /api/telemetry/*)
                     • Rule-Based & ML Inference Pipelines
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
             REACT FRONTEND SUITE             GIS SPATIAL SYSTEM
         • Multi-Hazard Dashboard         • Leaflet Layer Controller
         • Telemetry Simulator Console    • Risk-Colored Circle Markers
         • Tri-Hazard Prediction Lab      • Peril Badges & Inundation Buffers
         • Compound Action Guide          • Terrain & Catchment Popups
```

---

## 2. Detailed Specification for All 20 Core Components

### Component 1: ESP32 Sensor Telemetry
- **Inputs**: Device ID, timestamp, battery voltage ($3.2 - 4.2\text{ V}$), RSSI signal strength ($\text{dBm}$), packet transmission interval.
- **Outputs**: Normalized telemetry stream packets, device connectivity status (Active, Degraded, Stale).
- **Database Table**: `sensor_devices` (`id`, `village_id`, `device_uid`, `mac_address`, `installed_at`, `status`, `last_ping`, `battery_pct`).
- **API Endpoint**: `POST /api/telemetry/ingest`, `GET /api/telemetry/devices`.
- **Frontend Component**: `src/components/TelemetryConsole.tsx` (live status indicators, packet frequency controls, stream pause/resume).
- **ML Dependency**: None directly; feeds input streams into time-series sanitization.
- **Dependencies**: Feeds Components 2, 3, 4, 5, 6, 7.

### Component 2: Water Level Monitoring
- **Inputs**: Ultrasonic / hydrostatic pressure readings (depth in meters, range $0.1 - 8.0\text{ m}$), sensor calibration offset.
- **Outputs**: Calibrated reservoir & spring water depth, percentage capacity filled, trend rate ($\Delta\text{m/hr}$).
- **Database Table**: `water_sources` (`id`, `village_id`, `water_level_m`, `capacity_pct`, `last_updated`).
- **API Endpoint**: `GET /api/water-sources`, `PUT /api/water-sources/{id}/reading`.
- **Frontend Component**: `src/pages/WaterSources.tsx` & Gauge visualizers in `src/pages/Dashboard.tsx`.
- **ML Dependency**: Feature in Water Stress Random Forest classifier and Flood Inundation rule base.
- **Dependencies**: Dependent on Component 1; feeds Components 11, 12, 14.

### Component 3: Rainfall Measurement
- **Inputs**: Tipping bucket sensor pulses (accumulated daily rainfall in millimeters, $0 - 250\text{ mm}$).
- **Outputs**: Total $24\text{h}$ rainfall, rolling $72\text{h}$ antecedent precipitation index (API).
- **Database Table**: `climate_readings` (`id`, `village_id`, `rainfall_mm`, `recorded_date`, `antecedent_72h_mm`).
- **API Endpoint**: `GET /api/climate`, `POST /api/climate/record`.
- **Frontend Component**: `src/pages/ClimateAnalytics.tsx` (Recharts trend lines and seasonal bar charts).
- **ML Dependency**: Feature in Water Stress, Flash Flood, and Landslide classifiers.
- **Dependencies**: Dependent on Component 1; feeds Components 4, 11, 12, 13.

### Component 4: Rainfall Intensity
- **Inputs**: High-resolution hyetograph pulses ($15\text{-min}$ and $1\text{-hour}$ rainfall rates in $\text{mm/hr}$).
- **Outputs**: Peak hourly intensity, cloudburst classification flag ($>100\text{ mm/hr}$ or $>30\text{ mm/15min}$).
- **Database Table**: `climate_readings` (`peak_intensity_mm_hr`, `is_cloudburst_flag`).
- **API Endpoint**: `GET /api/climate/intensity`, `GET /api/hazards/intensity-peaks`.
- **Frontend Component**: Rainfall Intensity Alert Badge and Rate Gauge in `src/pages/Predictions.tsx`.
- **ML Dependency**: Primary governing parameter for Flash Flood ML tree split and Landslide trigger.
- **Dependencies**: Dependent on Component 3; feeds Components 12, 13, 16.

### Component 5: Soil Moisture Telemetry
- **Inputs**: Frequency-domain reflectometry (FDR) volumetric water content ($\text{VWC}\%$, range $5\% - 60\%$) at depths $15\text{ cm}$ and $45\text{ cm}$.
- **Outputs**: Soil saturation ratio ($S_r = \theta / \theta_{sat}$), geotechnical pore-water pressure proxy.
- **Database Table**: `soil_readings` (`id`, `village_id`, `vwc_shallow_pct`, `vwc_deep_pct`, `saturation_index`, `recorded_at`).
- **API Endpoint**: `GET /api/telemetry/soil`, `POST /api/telemetry/soil`.
- **Frontend Component**: Soil Saturation Bar and Matrix Column in `src/pages/MultiHazardMatrix.tsx`.
- **ML Dependency**: Key predictive feature for shallow slope stability and Landslide susceptibility scoring.
- **Dependencies**: Dependent on Component 1; feeds Components 13, 14.

### Component 6: Temperature Monitoring
- **Inputs**: Ambient air temperature in Celsius ($-15^\circ\text{C}$ to $45^\circ\text{C}$) via digital sensor.
- **Outputs**: Daily mean, minimum, maximum temperature, heat stress index, elevation lapse rate.
- **Database Table**: `climate_readings` (`temperature_c`, `temp_min_c`, `temp_max_c`).
- **API Endpoint**: `GET /api/climate`.
- **Frontend Component**: Temperature curves in `src/pages/ClimateAnalytics.tsx`.
- **ML Dependency**: Input feature for evapotranspiration calculation in Water Stress model.
- **Dependencies**: Dependent on Component 1; feeds Component 11.

### Component 7: Humidity Telemetry
- **Inputs**: Relative humidity percentage ($10\% - 100\%$) via capacitive hygrometer.
- **Outputs**: Relative humidity, vapor pressure deficit, dew point approximation.
- **Database Table**: `climate_readings` (`humidity_pct`).
- **API Endpoint**: `GET /api/climate`.
- **Frontend Component**: Climate trends in `src/pages/ClimateAnalytics.tsx`.
- **ML Dependency**: Secondary feature in drought and water balance models.
- **Dependencies**: Dependent on Component 1; feeds Component 11.

### Component 8: Weather Forecast Data
- **Inputs**: 72-hour quantitative precipitation forecast (QPF), convective precipitation probability, temperature outlook.
- **Outputs**: Projected 24h/48h rainfall amounts, forecast hazard outlook score.
- **Database Table**: `weather_forecasts` (`id`, `village_id`, `forecast_date`, `predicted_rain_mm`, `heavy_rain_risk_level`).
- **API Endpoint**: `GET /api/climate/forecast`.
- **Frontend Component**: 72-Hour Outlook Strip on `src/pages/Dashboard.tsx`.
- **ML Dependency**: Feeds forward-looking predictive risk inference.
- **Dependencies**: Feeds Components 11, 12, 13, 16.

### Component 9: Terrain / DEM (Digital Elevation Model) Features
- **Inputs**: DEM raster extraction values: elevation ($m$), slope steepness ($\text{degrees}$), aspect, flow accumulation index.
- **Outputs**: Village terrain vector: `slope_deg` ($14^\circ - 38^\circ$), `catchment_area_sqkm`, `valley_confinement_ratio`.
- **Database Table**: `villages` (`elevation_m`, `slope_deg`, `catchment_area_sqkm`, `terrain_ruggedness_idx`).
- **API Endpoint**: `GET /api/villages`, `GET /api/villages/{id}`.
- **Frontend Component**: Terrain Attributes Card in `src/pages/Villages.tsx`.
- **ML Dependency**: Static geo-structural weights in Landslide and Flash Flood decision trees.
- **Dependencies**: Feeds Components 12, 13, 18, 19.

### Component 10: Satellite & Geospatial Features
- **Inputs**: Normalized Difference Vegetation Index (NDVI: $0.15 - 0.75$), land use/land cover classification (LULC), distance to river tap/major channel ($m$).
- **Outputs**: Forest canopy retention index, proximity drainage buffer score.
- **Database Table**: `villages` (`vegetation_cover_pct`, `distance_to_river_m`, `soil_type`).
- **API Endpoint**: `GET /api/villages/{id}/geospatial`.
- **Frontend Component**: Geospatial Environmental Card in `src/pages/Methodology.tsx`.
- **ML Dependency**: Soil friction angle and surface runoff coefficients.
- **Dependencies**: Feeds Components 12, 13.

### Component 11: Water Stress Risk Model
- **Inputs**: $24\text{h}$ rainfall, flow rate ($\text{L/min}$), water level ($m$), population demand ($60\text{ L/capita/day}$), storage capacity ($L$), season.
- **Outputs**: Water Stress Score ($0 - 100$), Category (`Low`, `Medium`, `High`), model confidence percentage.
- **Database Table**: `hazard_predictions` (`hazard_type="water_stress"`, `risk_score`, `risk_level`, `confidence_pct`).
- **API Endpoint**: `GET /api/hazards/water-stress`, `POST /api/predictions/ml`.
- **Frontend Component**: Water Stress tab and gauge in `src/pages/Dashboard.tsx` & `src/pages/Predictions.tsx`.
- **ML Dependency**: Scikit-Learn `RandomForestClassifier` (passthrough numerical + OneHotEncoder categorical).
- **Dependencies**: Dependent on Components 2, 3, 6, 7, 9; feeds Components 14, 15, 16.

### Component 12: Flash Flood Risk Model
- **Inputs**: Rainfall intensity ($\text{mm/hr}$), $24\text{h}$ cumulative rain, stream proximity ($m$), catchment slope, drainage density.
- **Outputs**: Flood Risk Score ($0 - 100$), Category (`Low`, `Medium`, `High`), estimated inundation time window ($hrs$).
- **Database Table**: `hazard_predictions` (`hazard_type="flood"`, `risk_score`, `risk_level`, `confidence_pct`).
- **API Endpoint**: `GET /api/hazards/flood`, `POST /api/predictions/flood`.
- **Frontend Component**: Flash Flood Inundation Section in `src/pages/Predictions.tsx`.
- **ML Dependency**: Gradient-boosted/Tree decision ensemble mapping intensity $\times$ terrain run-off.
- **Dependencies**: Dependent on Components 3, 4, 9, 10; feeds Components 14, 15, 16.

### Component 13: Landslide Risk Model
- **Inputs**: Slope angle ($\text{deg}$), $72\text{h}$ antecedent rainfall, soil moisture saturation ($S_r$), vegetation cover ($\%$), lithology.
- **Outputs**: Landslide Risk Score ($0 - 100$), Category (`Low`, `Medium`, `High`), critical factor-of-safety indicator.
- **Database Table**: `hazard_predictions` (`hazard_type="landslide"`, `risk_score`, `risk_level`, `confidence_pct`).
- **API Endpoint**: `GET /api/hazards/landslide`, `POST /api/predictions/landslide`.
- **Frontend Component**: Slope Stability Assessment card in `src/pages/Predictions.tsx`.
- **ML Dependency**: Infinite slope geotechnical physics model combined with tree classifier.
- **Dependencies**: Dependent on Components 3, 4, 5, 9, 10; feeds Components 14, 15, 16.

### Component 14: Multi-Hazard Synthesis Engine
- **Inputs**: Individual scores from Components 11, 12, 13 + compounding environmental triggers.
- **Outputs**: Overall Multi-Hazard Score ($0 - 100$), Composite Risk Level (`Low`, `Medium`, `High`), Primary Active Threat identifier.
- **Database Table**: `hazard_assessments` (`village_id`, `composite_score`, `composite_level`, `primary_threat`, `compound_flag`).
- **API Endpoint**: `GET /api/hazards/summary`, `GET /api/hazards/matrix`, `POST /api/predictions/multi-hazard`.
- **Frontend Component**: Multi-Hazard Scoreboard in `src/pages/Dashboard.tsx` and triage matrix in `src/pages/MultiHazardMatrix.tsx`.
- **ML Dependency**: Weighted synthesis formula with non-linear cascading amplifier:
  $$\text{Score} = 0.35 \times \text{Water} + 0.35 \times \text{Flood} + 0.30 \times \text{Landslide} + \text{CascadePenalty}$$
- **Dependencies**: Dependent on Components 11, 12, 13; feeds Components 15, 16, 17, 18, 19.

### Component 15: Explainable Risk Factors
- **Inputs**: Feature contribution values for each hazard (e.g. soil saturation $+35\%$, slope angle $+25\%$, rainfall intensity $+20\%$).
- **Outputs**: Ranked breakdown of the top 3 contributing hazard drivers per location in natural English.
- **Database Table**: JSON field `factor_contributions` in `hazard_assessments`.
- **API Endpoint**: `GET /api/hazards/{village_id}/explain`.
- **Frontend Component**: `src/components/ExplainableFactors.tsx` (progress bars detailing dominant drivers).
- **ML Dependency**: Tree feature importances / SHAP-style linear contribution weights.
- **Dependencies**: Dependent on Component 14.

### Component 16: Alert Dispatch & Management System
- **Inputs**: Threshold breaches across all 3 hazards (e.g. Flood Critical $>75$, Landslide Warning $>55$, Drought Warning $>50$).
- **Outputs**: Structured alert queue with severity (`critical`, `warning`, `info`), hazard taxonomy, and resolution workflows.
- **Database Table**: `alerts` (`id`, `village_id`, `hazard_type`, `severity`, `message`, `is_resolved`, `created_at`).
- **API Endpoint**: `GET /api/alerts`, `POST /api/alerts`, `PATCH /api/alerts/{id}/resolve`.
- **Frontend Component**: `src/pages/Alerts.tsx` (hazard filter, severity tabs, resolve actions).
- **ML Dependency**: Triggered by output of Components 11, 12, 13, 14.
- **Dependencies**: Dependent on Components 11, 12, 13, 14; feeds Component 17.

### Component 17: Historical Trends & Analytics
- **Inputs**: Time-series log of all climate, water source, and multi-hazard assessment records.
- **Outputs**: Multi-week and seasonal risk progression charts, cross-hazard correlation trends.
- **Database Table**: `climate_readings`, `hazard_predictions`.
- **API Endpoint**: `GET /api/climate`, `GET /api/hazards/history`.
- **Frontend Component**: `src/pages/ClimateAnalytics.tsx` and Historical Risk graph on `src/pages/Dashboard.tsx`.
- **ML Dependency**: None directly.
- **Dependencies**: Dependent on Components 2, 3, 5, 14.

### Component 18: GIS Spatial Sensor & Hazard Markers
- **Inputs**: Village coordinates ($32.90^\circ - 32.97^\circ\text{N}, 74.91^\circ - 74.98^\circ\text{E}$), active hazard levels, stream vectors.
- **Outputs**: Rendered interactive Leaflet circles with dynamic radius ($8\text{px} - 14\text{px}$), risk color fills, and peril glyphs.
- **Database Table**: `villages`, `hazard_assessments`.
- **API Endpoint**: `GET /api/villages`, `GET /api/hazards/summary`.
- **Frontend Component**: `src/pages/MapView.tsx` (Layer selector: Composite, Water Stress, Flood, Landslide).
- **ML Dependency**: None directly.
- **Dependencies**: Dependent on Components 9, 14, 19.

### Component 19: Village-Level Risk Triage & Profiling
- **Inputs**: Aggregated socio-hydrological and geological parameters for all 10 SMVDU communities.
- **Outputs**: Prioritized triage ranking table, population at risk, evacuation status.
- **Database Table**: `villages`, `hazard_assessments`.
- **API Endpoint**: `GET /api/villages`, `GET /api/hazards/matrix`.
- **Frontend Component**: `src/pages/Villages.tsx` & `src/pages/MultiHazardMatrix.tsx`.
- **ML Dependency**: Output of Component 14.
- **Dependencies**: Dependent on Components 9, 14.

### Component 20: Data Quality & Sensor Health Indicators
- **Inputs**: Missing reading count, timestamp latency, sensor out-of-bound flags, synthetic demonstration tag.
- **Outputs**: Confidence tier (`High Quality`, `Partial Interpolation`, `Simulated Demonstration`), data staleness age.
- **Database Table**: Field `data_quality_grade` in `climate_readings` and `hazard_assessments`.
- **API Endpoint**: `GET /api/telemetry/quality-summary`.
- **Frontend Component**: Data Quality Badge on `src/components/Header.tsx` and Notice in `src/pages/Methodology.tsx`.
- **ML Dependency**: Adjusts model confidence score downwards if input metrics have low quality/staleness.
- **Dependencies**: Dependent on Component 1.

---

## 3. Visual & Component Architecture (SaaS & Scientific Dashboard Constitution)

In accordance with the **Universal Frontend Design Constitution** and `references/3_saas_dashboard.md`:

- **Design Philosophy**: High-density scientific dashboard with clean single-elevation cards, hairline border division, unboxed metadata separators (`·`), and strict zero-pill discipline for static labels.
- **Typography**: Display/Brand headers in clean geometric sans with tabular numerals (`tabular-nums font-mono`) applied to all telemetry values, coordinates, and percentages to eliminate layout jitter.
- **Color Discipline (60-30-10)**:
  - 60% Canvas: Neutral background (`#F8FAFC`).
  - 30% Structural: Pure white card surfaces (`#FFFFFF`) with subtle 1px border lines (`#E2E8F0`).
  - 10% Semantics:
    - Water Stress: Amber/Ochre (`#D97706`).
    - Flash Flood: Cyan/Deep Azure (`#0284C7`).
    - Landslide: Terracotta/Rust (`#DC2626`).
    - Nominal/Safe: Emerald Forest (`#16A34A`).
- **Interactive Controls**:
  - Filter tabs and layer toggles implemented as functional button elements (`<button>`) with clean segmented background styles.
  - Interactive Telemetry Simulator with preset storm triggers (*Cloudburst Storm*, *Monsoon Peak*, *Extended Drought*, *Nominal Season*).

---

## 4. Phased Implementation Roadmap for JalRakshak 2.0 (Completed)

### Phase 1: Multi-Hazard Data Model & Core Scoring Engine — [COMPLETED]
- [x] Add terrain attributes (`slope_deg`, `soil_type`, `vegetation_cover_pct`, `distance_to_river_m`, `catchment_area_sqkm`) to all 10 SMVDU study locations in `src/api/store.ts`.
- [x] Formulate the 3 independent hazard evaluation algorithms (Water Stress, Flash Flood, Landslide) and the Multi-Hazard Synthesis Engine with Cascading Threat penalty.
- [x] Seed the baseline multi-hazard assessments and soil moisture records.

### Phase 2: Telemetry Simulator & API Layer — [COMPLETED]
- [x] Implement the interactive telemetry simulator and live stream dispatcher (`src/components/TelemetryConsole.tsx`).
- [x] Expose typed endpoints in `src/api/index.ts` for multi-hazard predictions, hazard matrix, explainable factors, and telemetry feeds.

### Phase 3: GIS Multi-Hazard Map Upgrades — [COMPLETED]
- [x] Upgrade `src/pages/MapView.tsx` with a multi-layer selector (*Composite Multi-Hazard*, *Water Stress*, *Flash Flood*, *Landslide Susceptibility*).
- [x] Implement dynamic marker radius, hazard-specific color schemes, and enriched popups displaying all three peril levels and primary threats.

### Phase 4: UI Screens & Dashboard Overhaul — [COMPLETED]
- [x] **Dashboard (`/`)**: Added Tri-Hazard KPI cards, compound risk breakdown, cascading threat emergency banner, and interactive telemetry simulator console.
- [x] **Predictions (`/predictions`)**: Expanded form with terrain, rainfall intensity, and soil saturation inputs; displays 3 simultaneous hazard cards with explainable contribution bars.
- [x] **Multi-Hazard Matrix (`/matrix`)**: Created cross-hazard triage matrix comparing all 10 villages across the 3 perils.
- [x] **Recommendations (`/recommendations`)**: Added flood barrier, drainage clearing, slope revetment, and emergency evacuation protocols.
- [x] **Alerts (`/alerts`)**: Updated alert dispatch with flood, landslide, and drought classifications with interactive resolution.
- [x] **Study Locations (`/villages`)**: Added terrain, slope, and catchment geology attributes.
- [x] **Methodology (`/methodology`)**: Documented mathematical formulas, cascading physics, and ESP32 telemetry specifications.

### Phase 5: Verification & Build Validation — [COMPLETED]
- [x] Run `compile_applet` to ensure pristine TypeScript compilation and zero build regressions.
- [x] Successfully compiled and refreshed Vite dev server.

