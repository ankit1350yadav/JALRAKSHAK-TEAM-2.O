import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import RiskBadge from '../components/RiskBadge'
import ExplainableFactors from '../components/ExplainableFactors'
import {
  getVillages,
  getHazardAssessments,
  getSources,
  getSensors,
  getClimate,
} from '../api'
import {
  Village,
  HazardAssessment,
  WaterSource,
  SensorDevice,
  ClimateReading,
} from '../api/store'
import './Page.css'
import './Villages.css'

export default function Villages() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [villages, setVillages] = useState<Village[]>([])
  const [assessments, setAssessments] = useState<Record<number, HazardAssessment>>({})
  const [waterSources, setWaterSources] = useState<WaterSource[]>([])
  const [sensors, setSensors] = useState<SensorDevice[]>([])
  const [climateReadings, setClimateReadings] = useState<ClimateReading[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getVillages(),
      getHazardAssessments(),
      getSources(),
      getSensors(),
      getClimate({ limit: 300 }),
    ])
      .then(([vRes, aRes, sRes, devRes, cRes]) => {
        const vList = vRes.data ?? []
        setVillages(vList)

        const aMap: Record<number, HazardAssessment> = {}
        ;(aRes.data ?? []).forEach((item) => {
          aMap[item.village_id] = item
        })
        setAssessments(aMap)

        setWaterSources(sRes.data ?? [])
        setSensors(devRes.data ?? [])
        setClimateReadings(cRes.data ?? [])

        // If URL has ?village=id, select that, otherwise default to first village
        const urlVid = searchParams.get('village') || searchParams.get('id')
        if (urlVid && vList.some((v) => String(v.id) === urlVid)) {
          setSelectedVillageId(Number(urlVid))
        } else if (vList.length > 0) {
          setSelectedVillageId(vList[0].id)
        }
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load village directory data.')
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  // Select a village
  const handleSelectVillage = (id: number) => {
    setSelectedVillageId(id)
    setSearchParams({ village: String(id) })
  }

  // Active village and related data
  const selectedVillage = useMemo(() => {
    if (!selectedVillageId) return null
    return villages.find((v) => v.id === selectedVillageId) || null
  }, [villages, selectedVillageId])

  const villageSources = useMemo(() => {
    if (!selectedVillageId) return []
    return waterSources.filter((s) => s.village_id === selectedVillageId)
  }, [waterSources, selectedVillageId])

  const villageSensors = useMemo(() => {
    if (!selectedVillageId) return []
    return sensors.filter((s) => s.village_id === selectedVillageId)
  }, [sensors, selectedVillageId])

  const villageClimate = useMemo(() => {
    if (!selectedVillageId) return []
    return climateReadings.filter((c) => c.village_id === selectedVillageId)
  }, [climateReadings, selectedVillageId])

  const latestReading = useMemo(() => {
    if (villageClimate.length === 0) return null
    return villageClimate[villageClimate.length - 1]
  }, [villageClimate])

  const primarySource = useMemo(() => {
    if (villageSources.length === 0) return null
    return villageSources[0]
  }, [villageSources])

  const assessment = useMemo(() => {
    if (!selectedVillageId) return null
    return assessments[selectedVillageId] || null
  }, [assessments, selectedVillageId])

  // Historical trend data (last 12 readings)
  const historicalTrend = useMemo(() => {
    if (villageClimate.length === 0) return []
    const slice = villageClimate.slice(-12)
    return slice.map((c, idx) => ({
      date: c.recorded_date ? c.recorded_date.substring(5) : `T-${slice.length - idx}`,
      rainfall: c.rainfall_mm,
      soil_moisture: c.soil_moisture_pct,
      temperature: c.temperature_c,
      humidity: c.humidity_pct,
    }))
  }, [villageClimate])

  // Search filter for village selector
  const filteredVillages = villages.filter(
    (v) =>
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.district?.toLowerCase().includes(search.toLowerCase())
  )

  // Risk category helper
  const getRiskCategory = (score: number | undefined): 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' => {
    if (score === undefined || score === null) return 'NORMAL'
    if (score >= 75) return 'CRITICAL'
    if (score >= 50) return 'WARNING'
    if (score >= 25) return 'WATCH'
    return 'NORMAL'
  }

  return (
    <div className="page village-page">
      <div className="village-page__header">
        <div>
          <h1 className="village-page__title">Village Multi-Hazard Observatory</h1>
          <p className="village-page__subtitle">
            Granular terrain telemetry, hydrological assets, IoT node infrastructure, and tri-hazard vulnerability analytics.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="synthetic-badge">DEMO / SYNTHETIC CATCHMENT DATA</span>
        </div>
      </div>

      <SyntheticDataNotice extra="Geographic coordinates represent verified Indian administrative references. Telemetry readings and model risk scores are calibrated simulation outputs." />

      {loading && <p className="loading-text">Loading village directory &amp; telemetry streams…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && villages.length > 0 && (
        <>
          {/* ── Village Quick-Select Bar ── */}
          <div className="village-selector-bar">
            <div className="village-selector-bar__controls">
              <div className="village-pills" role="tablist" aria-label="Select Village">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Select Village:
                </span>
                {filteredVillages.map((v) => {
                  const isSelected = v.id === selectedVillageId
                  const a = assessments[v.id]
                  const riskLevel = a ? a.composite_level : 'low'
                  return (
                    <button
                      key={v.id}
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => handleSelectVillage(v.id)}
                      className={`village-pill-btn ${isSelected ? 'village-pill-btn--active' : ''}`}
                    >
                      <span>{v.name}</span>
                      <RiskBadge level={riskLevel} />
                    </button>
                  )
                })}
              </div>

              <input
                type="text"
                placeholder="Search village…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="village-selector-bar__search"
              />
            </div>
          </div>

          {/* ── Detailed Village View when a village is selected ── */}
          {selectedVillage ? (
            <div className="village-details-card">
              {/* ── Hero / Identity Header ── */}
              <div className="village-details-card__hero">
                <div className="village-details-card__identity">
                  <div className="village-details-card__name">
                    <span>🏡</span>
                    <span>{selectedVillage.name || 'Data unavailable'}</span>
                  </div>
                  <div className="village-details-card__district">
                    {selectedVillage.district
                      ? `${selectedVillage.district} District · UT of Jammu & Kashmir`
                      : 'Data unavailable'}
                  </div>

                  <div className="village-details-card__quick-meta">
                    <span className="village-meta-item">
                      Coordinates:
                      <strong>
                        {selectedVillage.latitude != null && selectedVillage.longitude != null
                          ? `${selectedVillage.latitude.toFixed(5)}° N, ${selectedVillage.longitude.toFixed(5)}° E`
                          : 'Data unavailable'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="village-meta-item">
                      Elevation:
                      <strong>
                        {selectedVillage.elevation_m != null
                          ? `${selectedVillage.elevation_m} m ASL`
                          : 'Data unavailable'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="village-meta-item">
                      Slope:
                      <strong>
                        {selectedVillage.slope_deg != null
                          ? `${selectedVillage.slope_deg}°`
                          : 'Data unavailable'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="village-meta-item">
                      Population:
                      <strong>
                        {selectedVillage.population != null
                          ? selectedVillage.population.toLocaleString()
                          : 'Data unavailable'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="village-details-card__badges">
                  {assessment && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Overall Multi-Hazard</div>
                      <span
                        className={`hazard-cat-pill hazard-cat-pill--${getRiskCategory(assessment.composite_score).toLowerCase()}`}
                        style={{ fontSize: 13, padding: '4px 10px' }}
                      >
                        {getRiskCategory(assessment.composite_score)} ({assessment.composite_score})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 1. Current Conditions (Water Level, Rainfall, Soil Moisture, Temperature, Humidity) ── */}
              <div className="village-section">
                <div className="village-section__title">
                  <span>Current Conditions</span>
                  <span className="village-section__badge">IoT Telemetry</span>
                </div>

                <div className="conditions-grid">
                  {/* Water Level */}
                  <div className="condition-card">
                    <span className="condition-card__label">💧 Water Level</span>
                    <div className="condition-card__value text-blue-700">
                      {primarySource?.water_level_m != null
                        ? `${primarySource.water_level_m.toFixed(2)} m`
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                    <span className="condition-card__sub">
                      {primarySource?.source_name ? primarySource.source_name : 'Primary Reservoir / Stream'}
                    </span>
                  </div>

                  {/* Rainfall */}
                  <div className="condition-card">
                    <span className="condition-card__label">🌧️ Rainfall</span>
                    <div className="condition-card__value text-sky-700">
                      {latestReading?.rainfall_mm != null
                        ? `${latestReading.rainfall_mm.toFixed(1)} mm`
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                    <span className="condition-card__sub">
                      {latestReading?.peak_intensity_mm_hr != null
                        ? `Intensity: ${latestReading.peak_intensity_mm_hr} mm/hr`
                        : 'Hyetometer reading'}
                    </span>
                  </div>

                  {/* Soil Moisture */}
                  <div className="condition-card">
                    <span className="condition-card__label">🌱 Soil Moisture</span>
                    <div className="condition-card__value text-emerald-700">
                      {latestReading?.soil_moisture_pct != null
                        ? `${latestReading.soil_moisture_pct}%`
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                    <span className="condition-card__sub">Volumetric pore saturation</span>
                  </div>

                  {/* Temperature */}
                  <div className="condition-card">
                    <span className="condition-card__label">🌡️ Temperature</span>
                    <div className="condition-card__value text-amber-700">
                      {latestReading?.temperature_c != null
                        ? `${latestReading.temperature_c.toFixed(1)} °C`
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                    <span className="condition-card__sub">Ambient mountain station</span>
                  </div>

                  {/* Humidity */}
                  <div className="condition-card">
                    <span className="condition-card__label">💨 Humidity</span>
                    <div className="condition-card__value text-purple-700">
                      {latestReading?.humidity_pct != null
                        ? `${latestReading.humidity_pct}%`
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                    <span className="condition-card__sub">Relative atmospheric vapor</span>
                  </div>
                </div>
              </div>

              {/* ── 2. Risk Scores (Water Stress, Flood, Landslide, Overall Multi-Hazard) ── */}
              <div className="village-section">
                <div className="village-section__title">
                  <span>Risk Scores</span>
                  <span className="village-section__badge">ML Hazard Inference</span>
                </div>

                <div className="risk-scores-grid">
                  {/* Water Stress Score */}
                  <div className="risk-score-card risk-score-card--water">
                    <div className="risk-score-card__top">
                      <span className="risk-score-card__title">Water Stress Score</span>
                      {assessment?.water_stress_score != null ? (
                        <span
                          className={`hazard-cat-pill hazard-cat-pill--${getRiskCategory(assessment.water_stress_score).toLowerCase()}`}
                        >
                          {getRiskCategory(assessment.water_stress_score)}
                        </span>
                      ) : (
                        <span className="data-unavailable">Data unavailable</span>
                      )}
                    </div>
                    <div className="risk-score-card__score-wrap">
                      <span className="risk-score-card__score text-amber-700">
                        {assessment?.water_stress_score != null
                          ? assessment.water_stress_score
                          : <span className="data-unavailable">Data unavailable</span>}
                      </span>
                      {assessment?.water_stress_score != null && (
                        <span className="risk-score-card__denom">/ 100</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Hydrological deficit &amp; storage depletion</div>
                  </div>

                  {/* Flood Risk Score */}
                  <div className="risk-score-card risk-score-card--flood">
                    <div className="risk-score-card__top">
                      <span className="risk-score-card__title">Flood Risk Score</span>
                      {assessment?.flood_risk_score != null ? (
                        <span
                          className={`hazard-cat-pill hazard-cat-pill--${getRiskCategory(assessment.flood_risk_score).toLowerCase()}`}
                        >
                          {getRiskCategory(assessment.flood_risk_score)}
                        </span>
                      ) : (
                        <span className="data-unavailable">Data unavailable</span>
                      )}
                    </div>
                    <div className="risk-score-card__score-wrap">
                      <span className="risk-score-card__score text-blue-700">
                        {assessment?.flood_risk_score != null
                          ? assessment.flood_risk_score
                          : <span className="data-unavailable">Data unavailable</span>}
                      </span>
                      {assessment?.flood_risk_score != null && (
                        <span className="risk-score-card__denom">/ 100</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Flash flood runoff &amp; valley breach</div>
                  </div>

                  {/* Landslide Risk Score */}
                  <div className="risk-score-card risk-score-card--landslide">
                    <div className="risk-score-card__top">
                      <span className="risk-score-card__title">Landslide Risk Score</span>
                      {assessment?.landslide_risk_score != null ? (
                        <span
                          className={`hazard-cat-pill hazard-cat-pill--${getRiskCategory(assessment.landslide_risk_score).toLowerCase()}`}
                        >
                          {getRiskCategory(assessment.landslide_risk_score)}
                        </span>
                      ) : (
                        <span className="data-unavailable">Data unavailable</span>
                      )}
                    </div>
                    <div className="risk-score-card__score-wrap">
                      <span className="risk-score-card__score text-orange-700">
                        {assessment?.landslide_risk_score != null
                          ? assessment.landslide_risk_score
                          : <span className="data-unavailable">Data unavailable</span>}
                      </span>
                      {assessment?.landslide_risk_score != null && (
                        <span className="risk-score-card__denom">/ 100</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Hillside instability &amp; shear failure</div>
                  </div>

                  {/* Overall Multi-Hazard Score */}
                  <div className="risk-score-card risk-score-card--overall">
                    <div className="risk-score-card__top">
                      <span className="risk-score-card__title">Overall Multi-Hazard Score</span>
                      {assessment?.composite_score != null ? (
                        <span
                          className={`hazard-cat-pill hazard-cat-pill--${getRiskCategory(assessment.composite_score).toLowerCase()}`}
                        >
                          {getRiskCategory(assessment.composite_score)}
                        </span>
                      ) : (
                        <span className="data-unavailable">Data unavailable</span>
                      )}
                    </div>
                    <div className="risk-score-card__score-wrap">
                      <span className="risk-score-card__score text-red-700">
                        {assessment?.composite_score != null
                          ? assessment.composite_score
                          : <span className="data-unavailable">Data unavailable</span>}
                      </span>
                      {assessment?.composite_score != null && (
                        <span className="risk-score-card__denom">/ 100</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Compounded compound threat synthesis</div>
                  </div>
                </div>
              </div>

              {/* ── 3. Dominant Hazard, Risk Factors, Data Quality, Data Source, Last Updated ── */}
              <div className="village-section">
                <div className="village-section__title">
                  <span>Hazard Intelligence &amp; Data Provenance</span>
                </div>

                <div className="intelligence-grid">
                  {/* Dominant Hazard */}
                  <div className="intel-block">
                    <div className="intel-block__label">Dominant Hazard</div>
                    <div className="intel-block__value">
                      {assessment?.primary_threat != null ? (
                        <span style={{ textTransform: 'uppercase', color: '#0f172a' }}>
                          ⚡{' '}
                          {assessment.primary_threat === 'compound'
                            ? 'COMBINED (COMPOUND CASCADING)'
                            : assessment.primary_threat.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="data-unavailable">Data unavailable</span>
                      )}
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div className="intel-block">
                    <div className="intel-block__label">Risk Factors</div>
                    {assessment?.top_factors && assessment.top_factors.length > 0 ? (
                      <ul className="intel-factors-list">
                        {assessment.top_factors.map((f, i) => (
                          <li key={i} className="intel-factor-item">
                            <span className="intel-factor-bullet">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="data-unavailable">Data unavailable</span>
                    )}
                  </div>

                  {/* Data Quality */}
                  <div className="intel-block">
                    <div className="intel-block__label">Data Quality</div>
                    <div className="intel-block__value">
                      <span className="synthetic-pill">SYNTHETIC (DEMO TELEMETRY)</span>
                    </div>
                  </div>

                  {/* Data Source */}
                  <div className="intel-block">
                    <div className="intel-block__label">Data Source</div>
                    <div className="intel-block__value text-xs font-mono text-slate-700">
                      ESP32 LoRa Gateway &amp; IoT Sensor Subsystem · JalRakshak Telemetry Network
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="intel-block">
                    <div className="intel-block__label">Last Updated</div>
                    <div className="intel-block__value text-xs">
                      {latestReading?.recorded_date
                        ? `${latestReading.recorded_date} (Synchronized)`
                        : assessment?.assessed_at
                        ? new Date(assessment.assessed_at).toLocaleString()
                        : <span className="data-unavailable">Data unavailable</span>}
                    </div>
                  </div>
                </div>

                {/* ── Explainable Intelligence: WHY is this village/node at risk? ── */}
                {assessment && (
                  <div style={{ marginTop: 16 }}>
                    <ExplainableFactors
                      targetName={selectedVillage.name}
                      overallRisk={getRiskCategory(assessment.composite_score)}
                      overallScore={assessment.composite_score}
                      dominantHazard={assessment.primary_threat}
                      riskScores={{
                        flood: assessment.flood_risk_score,
                        landslide: assessment.landslide_risk_score,
                        waterStress: assessment.water_stress_score,
                        composite: assessment.composite_score,
                      }}
                      factors={assessment.top_factors}
                      cascadeTriggered={assessment.cascade_triggered}
                    />
                  </div>
                )}
              </div>

              {/* ── 4. Historical Trend ── */}
              <div className="village-section">
                <div className="village-section__title">
                  <span>Historical Trend</span>
                  <span className="village-section__badge">Telemetry Chronology</span>
                </div>

                {historicalTrend.length > 0 ? (
                  <div className="trend-chart-card">
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      Precipitation, soil pore saturation, and ambient thermal observations over past cycles.
                    </div>
                    <div className="trend-chart-wrapper">
                      <ResponsiveContainer width="100%" height={230}>
                        <LineChart data={historicalTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={34} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                          <Line type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="soil_moisture" name="Soil Moisture (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#ea580c" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <span className="data-unavailable">Data unavailable</span>
                )}
              </div>

              {/* ── 5. Water Sources & Sensor Nodes Detailed Split ── */}
              <div className="village-section">
                <div className="entity-details-split">
                  {/* Water Sources */}
                  <div className="entity-subcard">
                    <div className="entity-subcard__header">
                      <span>💧 Water Sources ({villageSources.length})</span>
                      <span className="text-xs text-slate-500">Infrastructure</span>
                    </div>

                    {villageSources.length > 0 ? (
                      <div className="entity-items-list">
                        {villageSources.map((s) => (
                          <div key={s.id} className="entity-item">
                            <div>
                              <div className="entity-item__title">{s.source_name}</div>
                              <div className="entity-item__sub">
                                Type: <strong style={{ textTransform: 'capitalize' }}>{s.source_type.replace('_', ' ')}</strong>
                              </div>
                            </div>
                            <div className="entity-item__meta">
                              <div className="font-bold text-blue-700">
                                {s.water_level_m != null ? `${s.water_level_m} m` : 'Data unavailable'}
                              </div>
                              <div className="text-slate-500 text-xs">
                                {s.flow_rate_lpm != null ? `${s.flow_rate_lpm} LPM` : 'Data unavailable'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="data-unavailable">Data unavailable</span>
                    )}
                  </div>

                  {/* Sensor Nodes */}
                  <div className="entity-subcard">
                    <div className="entity-subcard__header">
                      <span>📡 Sensor Nodes ({villageSensors.length})</span>
                      <span className="text-xs text-slate-500">Hardware Fleet</span>
                    </div>

                    {villageSensors.length > 0 ? (
                      <div className="entity-items-list">
                        {villageSensors.map((dev) => (
                          <div key={dev.id} className="entity-item">
                            <div>
                              <div className="entity-item__title font-mono text-xs">{dev.device_uid}</div>
                              <div className="entity-item__sub" style={{ textTransform: 'capitalize' }}>
                                {dev.device_type.replace('_', ' ')}
                              </div>
                            </div>
                            <div className="entity-item__meta">
                              <span
                                className={`badge badge--${dev.status === 'active' ? 'success' : 'warning'}`}
                                style={{ fontSize: 10, padding: '1px 6px' }}
                              >
                                {dev.status ? dev.status.toUpperCase() : 'Data unavailable'}
                              </span>
                              <div className="text-slate-500 text-xs mt-1">
                                🔋 {dev.battery_pct != null ? `${dev.battery_pct}%` : 'Data unavailable'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="data-unavailable">Data unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="loading-text">Select a village to inspect comprehensive hazard and telemetry details.</p>
          )}

          {/* ── Directory Table of all Catchment Study Locations ── */}
          <div className="table-card">
            <h2 className="card__heading" style={{ marginBottom: 12 }}>All Catchment Study Locations</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Village</th>
                    <th>District</th>
                    <th>Elevation</th>
                    <th>Slope (°)</th>
                    <th>Soil Lithology</th>
                    <th>River Proximity</th>
                    <th>Population</th>
                    <th>Storage (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVillages.map((v) => {
                    const isSelected = v.id === selectedVillageId
                    return (
                      <tr
                        key={v.id}
                        style={{
                          background: isSelected ? '#f0f9ff' : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleSelectVillage(v.id)}
                      >
                        <td>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectVillage(v.id)
                            }}
                            className={`btn btn--sm ${isSelected ? 'btn--primary' : 'btn--secondary'}`}
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            {isSelected ? '✓ Viewing' : 'View Details'}
                          </button>
                        </td>
                        <td>
                          <strong>{v.name}</strong>
                        </td>
                        <td>{v.district || 'Data unavailable'}</td>
                        <td>{v.elevation_m != null ? `${v.elevation_m} m` : 'Data unavailable'}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: v.slope_deg > 30 ? '#dc2626' : v.slope_deg > 20 ? '#d97706' : '#16a34a',
                            }}
                          >
                            {v.slope_deg != null ? `${v.slope_deg}°` : 'Data unavailable'}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>
                          {v.soil_type?.replace('_', ' ') || 'Data unavailable'}
                        </td>
                        <td>{v.distance_to_river_m != null ? `${v.distance_to_river_m} m` : 'Data unavailable'}</td>
                        <td>{v.population != null ? v.population.toLocaleString() : 'Data unavailable'}</td>
                        <td>{v.storage_capacity_L != null ? v.storage_capacity_L.toLocaleString() : 'Data unavailable'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
