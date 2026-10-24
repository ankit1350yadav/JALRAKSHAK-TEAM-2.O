# JalRakshak — Implementation Plan
## AI-Based Mountain Drinking Water Management System (Prototype)

---

## ⚠️ PROTOTYPE DISCLAIMER

> **JalRakshak is an educational decision-support prototype. AI predictions are based on
> demonstration/synthetic data and should not be interpreted as certified hydrological
> forecasts, drinking-water safety assessments, or field measurements.**
>
> This system is NOT intended to replace:
> - Field surveys
> - Hydrological studies
> - Laboratory water-quality testing
> - Professional engineering assessment
> - Government water-management systems

---

## ⚠️ DATA AUTHENTICITY POLICY

This prototype distinguishes two categories of data:

| Category | Description | Status |
|---|---|---|
| **Geographic reference data** | Village names, district names, approximate coordinates used for map placement | Used from publicly available geographic references |
| **All other data** | Water-level measurements, flow rates, climate observations, water-quality values, risk labels, storage capacities, population estimates | **Synthetic / demonstration data — not representative of actual field measurements** |

> **"Prototype demonstration data — not representative of actual field measurements."**

Rules:
- Real village geographic coordinates may only appear where they are publicly verifiable.
- Water-source locations, water-level measurements, flow rates, climate observations, water-quality values, and risk labels are **synthetic**.
- Do **not** claim that synthetic water-source data represents actual surveyed water sources.
- A visible **"Demo / Synthetic Data"** indicator must appear in the application UI.
- A full explanation must appear in the Methodology page and in README.md.

---

## PROJECT OBJECTIVE

JalRakshak combines:

```
Climate data
+
Water-source data
+
Geographical data
+
Machine learning
↓
Potential water-shortage risk estimate
↓
Visualization + recommendations
```

The system studies potential drinking-water shortage risk in mountainous communities
of Jammu and Kashmir using synthetic demonstration data.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)           │
│  Dashboard │ Map │ Villages │ Sources │ Analytics    │
│  Predictions │ Recommendations │ Alerts │ Methodology│
└────────────────────────┬────────────────────────────┘
                         │ HTTP / REST (JSON)
                         ▼
┌─────────────────────────────────────────────────────┐
│               BACKEND (Python FastAPI)               │
│  Routes: villages, sources, climate, predict,        │
│          recommendations, alerts                     │
│                                                     │
│  ML Module (scikit-learn)                           │
│  └── RandomForestClassifier → Low/Medium/High Risk  │
└────────────────────────┬────────────────────────────┘
                         │ SQLite (via SQLAlchemy)
                         ▼
┌─────────────────────────────────────────────────────┐
│                  DATABASE (SQLite)                   │
│  villages │ water_sources │ climate_readings         │
│  risk_predictions │ alerts                           │
└─────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Single-process FastAPI server (Uvicorn) — no separate worker needed
- SQLite file on disk — no server setup required
- ML model trained at startup on synthetic dataset, persisted as `.pkl`
- Frontend proxies `/api` calls to FastAPI (Vite dev proxy)
- GIS tiles served by OpenStreetMap (no API key needed)

---

## 2. Folder Structure

```
JalRakshak/
├── plans/
│   └── jalrakshak-plan.md           ← this file
│
├── backend/
│   ├── main.py                      ← FastAPI app entry point
│   ├── database.py                  ← SQLAlchemy engine + session
│   ├── models.py                    ← ORM table definitions
│   ├── schemas.py                   ← Pydantic request/response models
│   ├── seed_data.py                 ← Synthetic data generator
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── features.py              ← Feature definitions (numerical/categorical)
│   │   ├── preprocessing.py         ← ColumnTransformer pipeline builder
│   │   ├── train.py                 ← Model training script
│   │   ├── predict.py               ← Prediction helper
│   │   └── model.pkl                ← Saved trained model (generated)
│   ├── routers/
│   │   ├── villages.py
│   │   ├── sources.py
│   │   ├── climate.py
│   │   ├── predictions.py
│   │   ├── recommendations.py
│   │   └── alerts.py
│   ├── jalrakshak.db                ← SQLite database (generated)
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js            ← Axios base client
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Sidebar.jsx
│       │   ├── AlertBanner.jsx
│       │   ├── RiskBadge.jsx
│       │   └── SyntheticDataNotice.jsx
│       └── pages/
│           ├── Dashboard.jsx
│           ├── MapView.jsx
│           ├── Villages.jsx
│           ├── WaterSources.jsx
│           ├── ClimateAnalytics.jsx
│           ├── Predictions.jsx
│           ├── Recommendations.jsx
│           ├── Alerts.jsx
│           └── Methodology.jsx
│
├── tests/
│   ├── backend/
│   │   ├── test_villages.py
│   │   ├── test_sources.py
│   │   ├── test_predictions.py
│   │   └── test_ml.py
│   └── frontend/                    ← (optional smoke tests)
│
└── README.md
```

---

## 3. Database Schema

### Table: `villages`
| Column           | Type    | Notes                          |
|------------------|---------|--------------------------------|
| id               | INTEGER | Primary key                    |
| name             | TEXT    | Village name                   |
| district         | TEXT    | e.g. Reasi, Ramban, Doda       |
| latitude         | REAL    | Decimal degrees (geographic reference) |
| longitude        | REAL    | Decimal degrees (geographic reference) |
| elevation_m      | REAL    | Metres above sea level (synthetic estimate) |
| population       | INTEGER | Approximate synthetic estimate |
| storage_capacity_L | REAL  | Synthetic estimate (litres)    |
| created_at       | TEXT    | ISO timestamp                  |

### Table: `water_sources`
| Column          | Type    | Notes                               |
|-----------------|---------|-------------------------------------|
| id              | INTEGER | Primary key                         |
| village_id      | INTEGER | FK → villages.id                    |
| source_name     | TEXT    | e.g. "Spring A" (synthetic)         |
| source_type     | TEXT    | spring / river / well / tank        |
| water_level_m   | REAL    | **Synthetic demonstration value**   |
| flow_rate_lpm   | REAL    | **Synthetic demonstration value**   |
| last_updated    | TEXT    | ISO timestamp                       |

### Table: `climate_readings`
| Column          | Type    | Notes                               |
|-----------------|---------|-------------------------------------|
| id              | INTEGER | Primary key                         |
| village_id      | INTEGER | FK → villages.id                    |
| recorded_date   | TEXT    | YYYY-MM-DD                          |
| rainfall_mm     | REAL    | **Synthetic demonstration value**   |
| temperature_c   | REAL    | **Synthetic demonstration value**   |
| humidity_pct    | REAL    | **Synthetic demonstration value**   |
| season          | TEXT    | winter/spring/summer/autumn         |

### Table: `risk_predictions`
| Column          | Type    | Notes                               |
|-----------------|---------|-------------------------------------|
| id              | INTEGER | Primary key                         |
| village_id      | INTEGER | FK → villages.id                    |
| predicted_at    | TEXT    | ISO timestamp                       |
| risk_level      | TEXT    | low / medium / high                 |
| confidence_pct  | REAL    | Model probability × 100             |
| input_snapshot  | TEXT    | JSON string of input features       |

### Table: `alerts`
| Column          | Type    | Notes                          |
|-----------------|---------|--------------------------------|
| id              | INTEGER | Primary key                    |
| village_id      | INTEGER | FK → villages.id               |
| alert_type      | TEXT    | shortage / contamination / etc.|
| severity        | TEXT    | info / warning / critical      |
| message         | TEXT    | Human-readable description     |
| is_resolved     | INTEGER | 0 = open, 1 = resolved         |
| created_at      | TEXT    | ISO timestamp                  |

---

## 4. API Endpoints

### Villages
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/health`               | API health check               |
| GET    | `/api/villages`             | List all villages              |
| GET    | `/api/villages/{id}`        | Single village detail          |
| GET    | `/api/villages/{id}/summary`| Village + latest source + risk |

### Water Sources
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/sources`              | All sources                    |
| GET    | `/api/sources/{id}`         | Single source                  |
| GET    | `/api/sources?village_id=X` | Sources for a village          |

### Climate
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/climate`              | All readings                   |
| GET    | `/api/climate?village_id=X` | Readings for a village         |
| GET    | `/api/climate/trends`       | Aggregated monthly trend data  |

### Predictions
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| POST   | `/api/predict`              | Run prediction (manual input)  |
| GET    | `/api/predictions`          | Saved prediction history       |
| POST   | `/api/predictions/batch`    | Predict all villages at once   |

**POST `/api/predict` request body:**
```json
{
  "village_id": 1,
  "rainfall_mm": 45.0,
  "temperature_c": 22.0,
  "humidity_pct": 65.0,
  "water_level_m": 1.2,
  "flow_rate_lpm": 30.0,
  "elevation_m": 1500.0,
  "population": 800,
  "storage_capacity_L": 50000.0,
  "season": "summer"
}
```

**Response (includes mandatory disclaimer):**
```json
{
  "risk_level": "medium",
  "confidence_pct": 72.4,
  "recommendation": "Monitor daily; restrict non-essential usage.",
  "disclaimer": "Prototype prediction based on demonstration data."
}
```

### Recommendations
| Method | Path                                    | Description                    |
|--------|-----------------------------------------|--------------------------------|
| GET    | `/api/recommendations/{risk_level}`     | Text recommendations for risk  |

### Alerts
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/alerts`               | All open alerts                |
| GET    | `/api/alerts?village_id=X`  | Alerts for a village           |
| PATCH  | `/api/alerts/{id}/resolve`  | Mark alert resolved            |

### Dashboard
| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/dashboard/stats`      | Counts, averages for overview  |

---

## 5. Sample Dataset Structure

The `seed_data.py` script generates synthetic records for **10 villages** in
mountainous Jammu & Kashmir districts. All numeric measurements are synthetic.

**Villages (geographic names are real reference; all measurements are synthetic):**
```
Patnitop, Bhaderwah, Kishtwar, Doda, Ramban,
Reasi, Rajouri, Poonch, Udhampur, Chenab Nagar
```

**Risk label generation (rule-based, for training only):**
```python
def label_risk(rainfall, temperature, water_level, flow_rate, population, storage):
    """
    Rule-based labeller for generating synthetic training targets.
    Does NOT represent real hydrological thresholds.
    """
    score = 0
    if rainfall < 20: score += 2
    if temperature > 28: score += 1
    if water_level < 1.0: score += 2
    if flow_rate < 15: score += 2
    demand = population * 60 / 1000        # 60 L/person/day in kL
    supply = (water_level * flow_rate * 60 * 24) / 1000
    if supply < demand: score += 3
    if score <= 2: return "low"
    if score <= 5: return "medium"
    return "high"
```

---

## 6. ML Architecture (Correction 2 applied)

### Algorithm: `RandomForestClassifier` (scikit-learn)

Random Forest is chosen for the prototype because it:
- Handles mixed feature types well
- Provides feature importances
- Works with small synthetic datasets
- Requires no hyperparameter tuning for prototype purposes

### Feature Categories

**Numerical features** (passthrough — no scaling needed for Random Forest):
- `rainfall_mm`
- `temperature_c`
- `humidity_pct`
- `water_level_m`
- `flow_rate_lpm`
- `elevation_m`
- `population`
- `storage_capacity_L`

**Categorical features** (OneHotEncoder):
- `season` (values: winter / spring / summer / autumn)

> **Note:** `StandardScaler` is **not** applied to Random Forest inputs.
> Tree-based models are scale-invariant; scaling would add unnecessary complexity
> without improving predictions.

### Preprocessing Pipeline (modular)

```python
# ml/features.py — single source of truth for feature lists
NUMERICAL_FEATURES = [
    "rainfall_mm", "temperature_c", "humidity_pct",
    "water_level_m", "flow_rate_lpm", "elevation_m",
    "population", "storage_capacity_L"
]
CATEGORICAL_FEATURES = ["season"]
TARGET = "risk_level"

# ml/preprocessing.py — builds the ColumnTransformer independently
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline

def build_preprocessor():
    return ColumnTransformer([
        ("num", "passthrough", NUMERICAL_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ])

def build_pipeline(classifier):
    return Pipeline([
        ("preprocessor", build_preprocessor()),
        ("classifier", classifier),
    ])
```

Preprocessing and model are tested independently via separate test functions.

### Evaluation Metrics (Correction 3 applied)

The model reports **all four** standard classification metrics:
- **Accuracy**
- **Precision** (per class + weighted average)
- **Recall** (per class + weighted average)
- **F1-score** (per class + weighted average)

> **No fixed accuracy target is set.**
>
> "Performance on synthetic demonstration data does not establish real-world
> predictive validity."
>
> The application must **not** present a model score as proof that the system
> can accurately predict actual water shortages in Jammu.

---

## 7. GIS Approach

### Library: Leaflet.js via `react-leaflet`
- Tile layer: OpenStreetMap (no API key)
- Center: Jammu & Kashmir region (~33.5°N, 75.5°E), zoom 8

### Map Features
- **Village markers** — coloured by risk (green/orange/red)
- **Popups** — village name, population, current risk badge
- **Source markers** — water source locations
- **Layer controls** — toggle villages vs. sources

### Village Coordinates (approximate public geographic reference)
| Village      | Lat    | Lon    |
|--------------|--------|--------|
| Patnitop     | 33.07  | 75.31  |
| Bhaderwah    | 32.98  | 75.72  |
| Kishtwar     | 33.31  | 75.77  |
| Doda         | 33.14  | 75.54  |
| Ramban       | 33.24  | 75.23  |
| Reasi        | 33.08  | 74.83  |
| Rajouri      | 33.38  | 74.31  |
| Poonch       | 33.77  | 74.10  |
| Udhampur     | 32.93  | 75.13  |
| Chenab Nagar | 33.45  | 75.60  |

---

## 8. Frontend Pages

### 1. Dashboard (`/`)
- Summary cards + charts

### 2. Interactive Map (`/map`)
- Full-page Leaflet map with risk-coloured markers

### 3. Villages (`/villages`)
- Searchable table with risk badges

### 4. Water Sources (`/sources`)
- Table of synthetic water source records

### 5. Climate Analytics (`/climate`)
- Charts for temperature and rainfall trends

### 6. AI Predictions (`/predictions`)
- Input form → POST /api/predict → result with disclaimer
- "Prototype prediction based on demonstration data." shown on every result

### 7. Recommendations (`/recommendations`)
- Advice by risk level

### 8. Alerts (`/alerts`)
- Active alerts list with resolve action

### 9. Methodology (`/methodology`)
- Full explanation of synthetic data approach
- ML pipeline description
- Model evaluation metrics
- Full prototype disclaimer

---

## 9. Testing Strategy

### Backend (pytest)
| Test file              | What it tests                              |
|------------------------|--------------------------------------------|
| `test_villages.py`     | GET /api/villages returns list; 200 OK     |
| `test_sources.py`      | Filter by village_id; empty village        |
| `test_predictions.py`  | POST /api/predict returns valid risk level |
| `test_ml.py`           | Preprocessor builds; pipeline fits/predicts|

Use `TestClient` from FastAPI with an in-memory SQLite DB for isolation.

ML tests verify that the **preprocessor** and **pipeline** can be constructed and
invoked correctly — not that they achieve a target accuracy.

---

## 10. Development Sequence

| Step | Task                                              | Est. Time |
|------|---------------------------------------------------|-----------|
| 1    | Backend scaffold: FastAPI app, DB models, seed    | 2 h       |
| 2    | ML: synthetic dataset, training, model save       | 1 h       |
| 3    | API routes: villages, sources, climate            | 1.5 h     |
| 4    | API routes: predictions, alerts, recommendations  | 1.5 h     |
| 5    | Frontend scaffold: Vite + React Router + layout   | 1 h       |
| 6    | Dashboard + Alerts pages                          | 1.5 h     |
| 7    | Map page (react-leaflet)                          | 1.5 h     |
| 8    | Villages + Water Sources pages                    | 1 h       |
| 9    | Climate Analytics + Predictions pages             | 1.5 h     |
| 10   | Recommendations page + RiskBadge component        | 0.5 h     |
| 11   | Backend tests (pytest)                            | 1 h       |
| 12   | README + final polish                             | 0.5 h     |
| **Total** |                                              | **~14 h** |

---

## 11. Dependencies

### Backend (`backend/requirements.txt`)
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
pydantic==2.7.1
pandas==2.2.2
numpy==1.26.4
scikit-learn==1.4.2
joblib==1.4.2
python-multipart==0.0.9
pytest==8.2.0
httpx==0.27.0
```

### Frontend (key deps)
```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.23.0",
  "react-leaflet": "^4.2.1",
  "leaflet": "^1.9.4",
  "recharts": "^2.12.0",
  "axios": "^1.7.0"
}
```

---

## 12. Constraints & Assumptions

- **No real measurement data**: All water-source, climate, and risk data is synthetic.
- **Geographic names**: Real village names and approximate coordinates are used as reference only.
- **No authentication**: Prototype has no login/user system.
- **No live sensor feeds**: Data is seeded once; no WebSocket updates.
- **Single machine**: Backend and frontend run on localhost.
- **English only**: No Kashmiri/Hindi localisation in prototype.
- **No deployment**: Runs locally via `uvicorn` + `vite dev`.

---

*Plan version: 2.0 — corrections applied (data authenticity, ML preprocessing,
model evaluation, prototype disclaimer).*
