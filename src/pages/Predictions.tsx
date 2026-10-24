import React, { useState, useEffect } from 'react'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import RiskBadge from '../components/RiskBadge'
import ExplainableFactors from '../components/ExplainableFactors'
import {
  postPredictMultiHazard,
  getModelStatus,
  getVillages,
  getSources,
  getClimate,
  MultiHazardPredictPayload,
  MultiHazardPredictResult,
} from '../api'
import { Village, WaterSource, ClimateReading } from '../api/store'
import './Page.css'
import './Predictions.css'

const DEFAULT_PAYLOAD: MultiHazardPredictPayload = {
  rainfall_mm: 35.0,
  peak_intensity_mm_hr: 28.0,
  temperature_c: 23.0,
  humidity_pct: 72.0,
  water_level_m: 2.4,
  flow_rate_lpm: 45.0,
  slope_deg: 26,
  soil_moisture_pct: 62,
  soil_type: 'fractured_shale',
  distance_to_river_m: 160,
  catchment_area_sqkm: 5.2,
  vegetation_cover_pct: 45,
  population: 1200,
  storage_capacity_L: 180000,
  season: 'summer',
}

export default function Predictions() {
  const [form, setForm] = useState<MultiHazardPredictPayload>(DEFAULT_PAYLOAD)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<MultiHazardPredictResult | null>(null)
  const [modelStatus, setModelStatus] = useState<any>(null)
  const [villages, setVillages] = useState<Village[]>([])
  const [waterSources, setWaterSources] = useState<WaterSource[]>([])
  const [climateReadings, setClimateReadings] = useState<ClimateReading[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState<string>('custom')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getModelStatus().then((r) => setModelStatus(r.data))
    Promise.all([getVillages(), getSources(), getClimate({ limit: 100 })]).then(
      ([vRes, sRes, cRes]) => {
        setVillages(vRes.data ?? [])
        setWaterSources(sRes.data ?? [])
        setClimateReadings(cRes.data ?? [])
      }
    )
  }, [])

  // Auto-run initial prediction
  useEffect(() => {
    postPredictMultiHazard(DEFAULT_PAYLOAD).then((res) => {
      setResult(res.data)
    }).catch(() => {})
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }))
  }

  const handleVillageSelect = (villageIdStr: string) => {
    setSelectedVillageId(villageIdStr)
    if (villageIdStr === 'custom') {
      setForm(DEFAULT_PAYLOAD)
      return
    }

    const vid = Number(villageIdStr)
    const v = villages.find((item) => item.id === vid)
    if (!v) return

    const src = waterSources.find((s) => s.village_id === vid)
    const clim = climateReadings.filter((c) => c.village_id === vid).slice(-1)[0]

    const updated: MultiHazardPredictPayload = {
      village_id: v.id,
      rainfall_mm: clim?.rainfall_mm ?? 28.0,
      peak_intensity_mm_hr: clim?.peak_intensity_mm_hr ?? 20.0,
      temperature_c: clim?.temperature_c ?? 22.0,
      humidity_pct: clim?.humidity_pct ?? 65.0,
      water_level_m: src?.water_level_m ?? 2.1,
      flow_rate_lpm: src?.flow_rate_lpm ?? 35.0,
      slope_deg: v.slope_deg,
      soil_moisture_pct: clim?.soil_moisture_pct ?? 48,
      soil_type: v.soil_type,
      distance_to_river_m: v.distance_to_river_m,
      catchment_area_sqkm: v.catchment_area_sqkm,
      vegetation_cover_pct: v.vegetation_cover_pct,
      population: v.population,
      storage_capacity_L: v.storage_capacity_L,
      season: clim?.season || 'summer',
    }

    setForm(updated)
    setSubmitting(true)
    postPredictMultiHazard(updated)
      .then((res) => setResult(res.data))
      .catch((err) => setError(err?.message || 'Prediction failed'))
      .finally(() => setSubmitting(false))
  }

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await postPredictMultiHazard(form)
      setResult(res.data)
    } catch (err: any) {
      setError(err?.message || 'Prediction failed')
    } finally {
      setSubmitting(false)
    }
  }

  const activeTargetName = selectedVillageId !== 'custom'
    ? villages.find((v) => String(v.id) === selectedVillageId)?.name
    : 'Simulated Catchment Parameter Set'

  return (
    <div className="pred-page">
      <h1 className="pred-page__title">Multi-Hazard Prediction Laboratory</h1>
      <p className="pred-page__subtitle">
        Explainable multi-peril risk inference answering <strong>"WHY is this village/node at risk?"</strong> based on verified rule triggers, hydrological stage, and geotechnical properties.
      </p>

      <SyntheticDataNotice />

      {/* Model Engine Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 24 }}>🧠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Inference Engine: Multi-Hazard Explainable Ensemble (v2.0)
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {modelStatus?.message || 'Hydro-geotechnical rule matrix with Random Forest probability calibration.'}
          </div>
        </div>
        <RiskBadge level="compound" prefix="Mode" />
      </div>

      {/* Target Village Preset Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
          Select Location to Inspect:
        </span>
        <select
          value={selectedVillageId}
          onChange={(e) => handleVillageSelect(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 12.5,
            fontWeight: 600,
            background: '#ffffff',
            color: '#1e293b',
            cursor: 'pointer',
          }}
        >
          <option value="custom">⚙️ Custom Parameter Simulation</option>
          {villages.map((v) => (
            <option key={v.id} value={String(v.id)}>
              🏡 {v.name} ({v.district} District)
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11.5, color: '#64748b' }}>
          Loads verified terrain, slope, water source, and live telemetry inputs.
        </span>
      </div>

      <div className="pred-body">
        {/* Form Inputs */}
        <section className="card pred-form-card">
          <h2 className="card__heading">1. Hydro-Meteorological Telemetry Inputs</h2>
          <form onSubmit={handlePredict}>
            <div className="pred-fields-grid">
              <div className="pred-field">
                <label className="pred-field__label">Daily Rainfall (mm)</label>
                <input
                  type="number"
                  name="rainfall_mm"
                  value={form.rainfall_mm}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="0"
                  max="300"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Peak Intensity (mm/hr)</label>
                <input
                  type="number"
                  name="peak_intensity_mm_hr"
                  value={form.peak_intensity_mm_hr}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="0"
                  max="150"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Temperature (°C)</label>
                <input
                  type="number"
                  name="temperature_c"
                  value={form.temperature_c}
                  onChange={handleChange}
                  className="pred-field__input"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Relative Humidity (%)</label>
                <input
                  type="number"
                  name="humidity_pct"
                  value={form.humidity_pct}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="0"
                  max="100"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Water Level (m)</label>
                <input
                  type="number"
                  name="water_level_m"
                  value={form.water_level_m}
                  onChange={handleChange}
                  className="pred-field__input"
                  step="0.1"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Spring Flow (L/min)</label>
                <input
                  type="number"
                  name="flow_rate_lpm"
                  value={form.flow_rate_lpm}
                  onChange={handleChange}
                  className="pred-field__input"
                />
              </div>
            </div>

            <h2 className="card__heading" style={{ marginTop: 24 }}>
              2. Geotechnical &amp; Terrain Features
            </h2>
            <div className="pred-fields-grid">
              <div className="pred-field">
                <label className="pred-field__label">Hillside Slope Angle (°)</label>
                <input
                  type="number"
                  name="slope_deg"
                  value={form.slope_deg}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="5"
                  max="55"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Soil Moisture Content (%)</label>
                <input
                  type="number"
                  name="soil_moisture_pct"
                  value={form.soil_moisture_pct}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="5"
                  max="100"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Lithology / Soil Type</label>
                <select
                  name="soil_type"
                  value={form.soil_type}
                  onChange={handleChange}
                  className="pred-field__select"
                >
                  <option value="fractured_shale">Fractured Shale (High Risk)</option>
                  <option value="gravelly_silt">Gravelly Silt (Moderate)</option>
                  <option value="clay_loam">Clay Loam (Moderate)</option>
                  <option value="alluvial">Alluvial Basin (Inundation Prone)</option>
                </select>
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Distance to Stream/River (m)</label>
                <input
                  type="number"
                  name="distance_to_river_m"
                  value={form.distance_to_river_m}
                  onChange={handleChange}
                  className="pred-field__input"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Vegetation Cover (%)</label>
                <input
                  type="number"
                  name="vegetation_cover_pct"
                  value={form.vegetation_cover_pct}
                  onChange={handleChange}
                  className="pred-field__input"
                  min="0"
                  max="100"
                />
              </div>

              <div className="pred-field">
                <label className="pred-field__label">Community Population</label>
                <input
                  type="number"
                  name="population"
                  value={form.population}
                  onChange={handleChange}
                  className="pred-field__input"
                />
              </div>
            </div>

            {error && (
              <div className="error-banner" role="alert" style={{ marginTop: 14 }}>
                {error}
              </div>
            )}

            <div className="pred-form-actions">
              <button type="submit" className="pred-submit-btn" disabled={submitting}>
                {submitting ? '⏳ Computing Multi-Hazard Matrix…' : '⚡ Run Explainable Risk Inference'}
              </button>
            </div>
          </form>
        </section>

        {/* Prediction Results & Explainability */}
        <section className="card pred-result-card">
          <h2 className="card__heading">Explainable Multi-Hazard Diagnostic Report</h2>

          {!result ? (
            <div className="pred-result-empty">
              <span className="pred-result-empty__icon">🏔️</span>
              <span>Submit the hydro-geotechnical telemetry parameters to generate the tri-hazard report.</span>
            </div>
          ) : (
            <div>
              {/* ── Standardized Explainability Card answering "WHY is this village/node at risk?" ── */}
              <ExplainableFactors
                targetName={activeTargetName}
                overallRisk={result.overall_multi_hazard_category || result.composite.level}
                overallScore={result.overall_multi_hazard_score || result.composite.score}
                dominantHazard={result.dominant_hazard || result.composite.primary_threat}
                riskScores={{
                  flood: result.flash_flood.score,
                  landslide: result.landslide.score,
                  waterStress: result.water_stress.score,
                  composite: result.composite.score,
                }}
                factors={result.risk_factors || result.composite.factors}
                cascadeTriggered={result.composite.cascade_triggered}
              />

              {/* Priority Action Protocol */}
              <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Priority Intervention Protocol
                </div>
                <div style={{ fontSize: 12.5, color: '#1e293b', lineHeight: 1.5 }}>
                  {result.recommendations[0] || 'Maintain continuous catchment telemetry monitoring.'}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
