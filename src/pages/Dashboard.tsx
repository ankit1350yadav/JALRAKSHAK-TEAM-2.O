import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import TelemetryConsole from '../components/TelemetryConsole'
import RiskBadge from '../components/RiskBadge'
import ExplainableFactors from '../components/ExplainableFactors'
import ModeBanner from '../components/ModeBanner'
import RealHardwarePanel from '../components/RealHardwarePanel'
import {
  getDashboardStats,
  getAlerts,
  getHazardAssessments,
  getVillages,
  getSources,
  getClimate,
  getSensors,
  getOperatingMode,
  getRealHardwareStatus,
  SystemOperatingMode,
  RealHardwareStatus,
} from '../api'
import {
  Village,
  HazardAssessment,
  WaterSource,
  ClimateReading,
  SensorDevice,
  store,
} from '../api/store'
import './Page.css'
import './Dashboard.css'

export type ActiveChartTab =
  | 'ALL'
  | 'WATER_LEVEL'
  | 'RAINFALL'
  | 'SOIL_MOISTURE'
  | 'WATER_STRESS'
  | 'FLOOD_RISK'
  | 'LANDSLIDE_RISK'
  | 'MULTI_HAZARD_RISK'

export interface VillageChartRow {
  village_id: number
  village: string
  district: string
  water_level: number
  rainfall: number
  soil_moisture: number
  water_stress: number
  flood_risk: number
  landslide_risk: number
  overall_risk: number
  battery: number
  data_quality: string
}

export default function Dashboard() {
  const [operatingMode, setOperatingModeState] = useState<SystemOperatingMode>('SIMULATION')
  const [realHardware, setRealHardware] = useState<RealHardwareStatus>({
    node_id: 'JR-NODE-01',
    node_name: 'Katra Sensor Station',
    village_id: 1,
    village_name: 'Katra',
    latitude: 32.9934,
    longitude: 74.9317,
    elevation_m: 875,
    hardware_model: 'ESP32-WROOM-32D / Real Mountain Hydro-Node',
    firmware_version: 'v2.1-ESP32-FIELD',
    status: 'DISCONNECTED',
    is_connected: false,
    last_heartbeat_at: null,
    packets_received_count: 0,
    stale_timeout_sec: 60,
    latest_telemetry: null,
    telemetry_history: [],
    data_quality: 'REAL',
    is_synthetic: 0,
    computed_risks: null,
  })
  const [stats, setStats] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [assessments, setAssessments] = useState<HazardAssessment[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [waterSources, setWaterSources] = useState<WaterSource[]>([])
  const [climateReadings, setClimateReadings] = useState<ClimateReading[]>([])
  const [sensors, setSensors] = useState<SensorDevice[]>([])
  const [activeChartTab, setActiveChartTab] = useState<ActiveChartTab>('ALL')
  const [selectedTriageVillageId, setSelectedTriageVillageId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      getOperatingMode(),
      getRealHardwareStatus(),
      getDashboardStats(),
      getAlerts({ resolved: false }),
      getHazardAssessments(),
      getVillages(),
      getSources(),
      getClimate(),
      getSensors(),
    ])
      .then(([modeRes, hwRes, statsRes, alertsRes, assessRes, villageRes, srcRes, climRes, sensRes]) => {
        setOperatingModeState(modeRes.data.mode)
        setRealHardware(hwRes.data)
        setStats(statsRes.data)
        setAlerts((alertsRes.data ?? []).slice(0, 8))
        const aList = assessRes.data ?? []
        setAssessments(aList)
        setVillages(villageRes.data ?? [])
        setWaterSources(srcRes.data ?? [])
        setClimateReadings(climRes.data ?? [])
        setSensors(sensRes.data ?? [])
        if (aList.length > 0 && selectedTriageVillageId === null) {
          const sorted = aList.slice().sort((a, b) => b.composite_score - a.composite_score)
          setSelectedTriageVillageId(sorted[0].village_id)
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load dashboard data.')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
    const unsubscribe = store.subscribe(() => {
      loadData()
    })
    return () => unsubscribe()
  }, [])

  const villageNameById = useMemo(
    () => Object.fromEntries(villages.map((v) => [v.id, v.name])),
    [villages]
  )

  const selectedTriageAssessment = useMemo(() => {
    if (!assessments.length) return null
    if (selectedTriageVillageId) {
      return assessments.find((a) => a.village_id === selectedTriageVillageId) || assessments[0]
    }
    return assessments.slice().sort((a, b) => b.composite_score - a.composite_score)[0] || null
  }, [assessments, selectedTriageVillageId])

  // Assembled per-village chart dataset from API
  const chartDataset: VillageChartRow[] = useMemo(() => {
    if (stats?.village_chart_data && stats.village_chart_data.length > 0) {
      return stats.village_chart_data
    }
    return villages.map((v) => {
      const a = assessments.find((h) => h.village_id === v.id)
      const src = waterSources.find((s) => s.village_id === v.id)
      const clim = climateReadings.filter((c) => c.village_id === v.id).slice(-1)[0]
      const sens = sensors.find((d) => d.village_id === v.id)

      return {
        village_id: v.id,
        village: v.name,
        district: v.district,
        water_level: src ? src.water_level_m : Number((1.8 + (v.id % 5) * 0.35).toFixed(2)),
        rainfall: clim ? clim.rainfall_mm : Number((10 + (v.id % 4) * 5.2).toFixed(1)),
        soil_moisture: clim ? clim.soil_moisture_pct : 45,
        water_stress: a ? a.water_stress_score : 20,
        flood_risk: a ? a.flood_risk_score : 18,
        landslide_risk: a ? a.landslide_risk_score : 22,
        overall_risk: a ? a.composite_score : 20,
        battery: sens ? sens.battery_pct : 88,
        data_quality: 'SYNTHETIC',
      }
    })
  }, [stats, villages, assessments, waterSources, climateReadings, sensors])

  // Existing Tri-hazard comparative distribution data
  const triHazardData = [
    {
      hazard: 'Low Risk',
      'Water Stress': stats?.hazard_breakdown?.water_stress?.low ?? 0,
      'Flash Flood': stats?.hazard_breakdown?.flash_flood?.low ?? 0,
      'Landslide': stats?.hazard_breakdown?.landslide?.low ?? 0,
    },
    {
      hazard: 'Medium Risk',
      'Water Stress': stats?.hazard_breakdown?.water_stress?.medium ?? 0,
      'Flash Flood': stats?.hazard_breakdown?.flash_flood?.medium ?? 0,
      'Landslide': stats?.hazard_breakdown?.landslide?.medium ?? 0,
    },
    {
      hazard: 'High Risk',
      'Water Stress': stats?.hazard_breakdown?.water_stress?.high ?? 0,
      'Flash Flood': stats?.hazard_breakdown?.flash_flood?.high ?? 0,
      'Landslide': stats?.hazard_breakdown?.landslide?.high ?? 0,
    },
  ]

  // Color helper for risk bars
  const getRiskColor = (score: number) => {
    if (score >= 75) return '#dc2626'
    if (score >= 50) return '#ea580c'
    if (score >= 25) return '#eab308'
    return '#16a34a'
  }

  return (
    <div className="page dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="page__title" style={{ margin: 0 }}>Multi-Hazard Command Center</h1>
          <p className="dashboard-header__subtitle">
            Synchronized decision-support platform for Reasi District, J&amp;K (Water Stress • Flash Flood • Landslide).
          </p>
        </div>
        <div className="dashboard-header__telemetry-meta">
          <span className="telemetry-pill">IoT Protocol: <strong>ESP32 Gateway v2</strong></span>
          {operatingMode === 'REAL' ? (
            <span
              style={{
                background:
                  realHardware.status === 'CONNECTED'
                    ? '#059669'
                    : realHardware.status === 'STALE'
                    ? '#d97706'
                    : '#dc2626',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.02em',
              }}
            >
              REAL SENSOR MODE ({realHardware.status || (realHardware.is_connected ? 'CONNECTED' : 'DISCONNECTED')})
            </span>
          ) : (
            <span className="synthetic-pill">SIMULATION MODE (SYNTHETIC DATA)</span>
          )}
        </div>
      </div>

      {/* ── Mode Switcher & Indicator Banner ── */}
      <ModeBanner
        currentMode={operatingMode}
        hardwareConnected={realHardware.is_connected}
        hardwareStatus={realHardware.status}
        packetCount={realHardware.packets_received_count}
        onModeChanged={(newMode) => {
          setOperatingModeState(newMode)
          loadData()
        }}
      />

      {/* ── Mode-Specific Control & Telemetry Consoles ── */}
      {operatingMode === 'REAL' ? (
        <RealHardwarePanel
          hardware={realHardware}
          onTelemetryUpdated={loadData}
        />
      ) : (
        <>
          <SyntheticDataNotice />
          <TelemetryConsole
            activePreset={stats?.active_preset || 'nominal'}
            onPresetApplied={loadData}
          />
        </>
      )}

      {loading && <p className="loading-text">Loading multi-hazard indicators &amp; telemetry streams…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── NEW: Multi-Hazard Network KPIs (6 Required Cards) ── */}
      {!loading && stats && (
        <section className="dashboard-section" aria-label="Multi-Hazard KPIs">
          <div className="section-title-wrap">
            <h2 className="section-title">Multi-Hazard Network KPIs</h2>
            <span
              className="synthetic-badge"
              style={{
                background: operatingMode === 'REAL' ? (realHardware.is_connected ? '#dcfce7' : '#fee2e2') : '#fef3c7',
                color: operatingMode === 'REAL' ? (realHardware.is_connected ? '#15803d' : '#991b1b') : '#92400e',
                borderColor: operatingMode === 'REAL' ? (realHardware.is_connected ? '#86efac' : '#fca5a5') : '#fcd34d',
              }}
            >
              {operatingMode === 'REAL'
                ? realHardware.is_connected
                  ? 'Real Telemetry Stream (JR-NODE-01)'
                  : 'Real Mode (Awaiting Signal)'
                : 'Synthetic Demo Telemetry'}
            </span>
          </div>

          <div className="card-row card-row--6">
            <KpiCard
              label="Total Villages"
              value={stats.multi_hazard_kpis?.total_villages ?? villages.length}
              accent="#2563eb"
              icon="🏘️"
              description="Mountain catchments under continuous surveillance"
            />
            <KpiCard
              label="Active Sensor Nodes"
              value={
                operatingMode === 'REAL'
                  ? realHardware.is_connected
                    ? '1 Online'
                    : '0 (Offline)'
                  : stats.multi_hazard_kpis?.active_sensor_nodes ?? sensors.length
              }
              accent={operatingMode === 'REAL' ? (realHardware.is_connected ? '#16a34a' : '#dc2626') : '#7c3aed'}
              icon="📡"
              description={
                operatingMode === 'REAL'
                  ? realHardware.is_connected
                    ? 'Physical ESP32 node JR-NODE-01 streaming'
                    : 'Awaiting signal on POST /api/telemetry'
                  : 'Operational simulated IoT telemetry gateways'
              }
            />
            <KpiCard
              label="Water Stress Alerts"
              value={stats.multi_hazard_kpis?.water_stress_alerts ?? 0}
              accent="#d97706"
              icon="💧"
              description="Hydrological drought & replenishment deficit notices"
            />
            <KpiCard
              label="Flood Alerts"
              value={stats.multi_hazard_kpis?.flood_alerts ?? 0}
              accent="#0284c7"
              icon="🌊"
              description="River stage breach & rapid rise warnings"
            />
            <KpiCard
              label="Landslide Alerts"
              value={stats.multi_hazard_kpis?.landslide_alerts ?? 0}
              accent="#ea580c"
              icon="⛰️"
              description="Steep slope instability & pore pressure alerts"
            />
            <KpiCard
              label="Critical Multi-Hazard Alerts"
              value={stats.multi_hazard_kpis?.critical_multi_hazard_alerts ?? 0}
              accent="#dc2626"
              icon="🚨"
              description="Severe compound cascading threats requiring intervention"
            />
          </div>
        </section>
      )}

      {/* ── EXISTING: Key Multi-Hazard Metric Cards (Preserved) ── */}
      {!loading && stats && (
        <section className="dashboard-section" aria-label="Multi-Hazard Metrics">
          <div className="section-title-wrap">
            <h3 className="section-subtitle">Catchment Severity Distribution</h3>
          </div>
          <div className="card-row">
            <KpiCard
              label="Composite High Risk"
              value={stats.composite_counts?.high ?? 0}
              accent="#dc2626"
              description="Locations with critical compound threat"
            />
            <KpiCard
              label="Flash Flood Alert"
              value={stats.hazard_breakdown?.flash_flood?.high ?? 0}
              accent="#0284c7"
              description="Riverbed inundation corridors"
            />
            <KpiCard
              label="Critical Slopes"
              value={stats.hazard_breakdown?.landslide?.high ?? 0}
              accent="#c2410c"
              description="Saturated unstable hillsides"
            />
            <KpiCard
              label="Drought Stress"
              value={stats.hazard_breakdown?.water_stress?.high ?? 0}
              accent="#d97706"
              description="Acute supply vs demand deficit"
            />
          </div>
        </section>
      )}

      {/* ── NEW: Peril & Multi-Hazard Operational Summaries (4 Required Panels) ── */}
      {!loading && stats?.hazard_summaries && (
        <section className="dashboard-section" aria-label="Hazard Summaries">
          <div className="section-title-wrap">
            <h2 className="section-title">Operational Hazard Summaries</h2>
            <span className="synthetic-badge">Calibrated Model Telemetry</span>
          </div>

          <div className="hazard-summaries-grid">
            {/* 1. Water Stress Summary */}
            <div className="hazard-summary-card hazard-summary-card--water">
              <div className="hazard-summary-card__header">
                <div className="hazard-summary-card__title">
                  <span className="hazard-summary-card__icon">💧</span>
                  <span>Water Stress Summary</span>
                </div>
                <span
                  className={`hazard-cat-pill hazard-cat-pill--${stats.hazard_summaries.water_stress.category.toLowerCase()}`}
                >
                  {stats.hazard_summaries.water_stress.category}
                </span>
              </div>
              <div className="hazard-summary-card__stats">
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Avg Stress Score:</span>
                  <span className="summary-stat-item__val text-amber-700 font-bold">
                    {stats.hazard_summaries.water_stress.avg_score}/100
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">High Deficit Villages:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.water_stress.high_risk_villages} of {villages.length}
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Active Shortage Alerts:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.water_stress.active_alerts}
                  </span>
                </div>
              </div>
              <p className="hazard-summary-card__desc">
                {stats.hazard_summaries.water_stress.status_message}
              </p>
              <div className="hazard-summary-card__driver">
                <strong>Primary Driver:</strong> {stats.hazard_summaries.water_stress.primary_driver}
              </div>
              <div className="hazard-summary-card__footer">
                <span className="synthetic-subtext">Data Quality: {stats.hazard_summaries.water_stress.data_quality}</span>
              </div>
            </div>

            {/* 2. Flood Summary */}
            <div className="hazard-summary-card hazard-summary-card--flood">
              <div className="hazard-summary-card__header">
                <div className="hazard-summary-card__title">
                  <span className="hazard-summary-card__icon">🌊</span>
                  <span>Flood Summary</span>
                </div>
                <span
                  className={`hazard-cat-pill hazard-cat-pill--${stats.hazard_summaries.flood.category.toLowerCase()}`}
                >
                  {stats.hazard_summaries.flood.category}
                </span>
              </div>
              <div className="hazard-summary-card__stats">
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Avg Flood Risk Score:</span>
                  <span className="summary-stat-item__val text-blue-700 font-bold">
                    {stats.hazard_summaries.flood.avg_score}/100
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Inundation Threat Areas:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.flood.high_risk_villages} of {villages.length}
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Active Flood Alerts:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.flood.active_alerts}
                  </span>
                </div>
              </div>
              <p className="hazard-summary-card__desc">
                {stats.hazard_summaries.flood.status_message}
              </p>
              <div className="hazard-summary-card__driver">
                <strong>Primary Driver:</strong> {stats.hazard_summaries.flood.primary_driver}
              </div>
              <div className="hazard-summary-card__footer">
                <span className="synthetic-subtext">Data Quality: {stats.hazard_summaries.flood.data_quality}</span>
              </div>
            </div>

            {/* 3. Landslide Summary */}
            <div className="hazard-summary-card hazard-summary-card--landslide">
              <div className="hazard-summary-card__header">
                <div className="hazard-summary-card__title">
                  <span className="hazard-summary-card__icon">⛰️</span>
                  <span>Landslide Summary</span>
                </div>
                <span
                  className={`hazard-cat-pill hazard-cat-pill--${stats.hazard_summaries.landslide.category.toLowerCase()}`}
                >
                  {stats.hazard_summaries.landslide.category}
                </span>
              </div>
              <div className="hazard-summary-card__stats">
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Avg Landslide Score:</span>
                  <span className="summary-stat-item__val text-orange-700 font-bold">
                    {stats.hazard_summaries.landslide.avg_score}/100
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Critical Hillside Slopes:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.landslide.high_risk_villages} of {villages.length}
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Active Slope Alerts:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.landslide.active_alerts}
                  </span>
                </div>
              </div>
              <p className="hazard-summary-card__desc">
                {stats.hazard_summaries.landslide.status_message}
              </p>
              <div className="hazard-summary-card__driver">
                <strong>Primary Driver:</strong> {stats.hazard_summaries.landslide.primary_driver}
              </div>
              <div className="hazard-summary-card__footer">
                <span className="synthetic-subtext">Data Quality: {stats.hazard_summaries.landslide.data_quality}</span>
              </div>
            </div>

            {/* 4. Multi-Hazard Summary */}
            <div className="hazard-summary-card hazard-summary-card--multi">
              <div className="hazard-summary-card__header">
                <div className="hazard-summary-card__title">
                  <span className="hazard-summary-card__icon">⚡</span>
                  <span>Multi-Hazard Summary</span>
                </div>
                <span
                  className={`hazard-cat-pill hazard-cat-pill--${stats.hazard_summaries.multi_hazard.category.toLowerCase()}`}
                >
                  {stats.hazard_summaries.multi_hazard.category}
                </span>
              </div>
              <div className="hazard-summary-card__stats">
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Avg Multi-Hazard Index:</span>
                  <span className="summary-stat-item__val text-purple-700 font-bold">
                    {stats.hazard_summaries.multi_hazard.avg_score}/100
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Cascading Peril Triggers:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.multi_hazard.cascade_events} active
                  </span>
                </div>
                <div className="summary-stat-item">
                  <span className="summary-stat-item__label">Critical Alerts:</span>
                  <span className="summary-stat-item__val font-bold">
                    {stats.hazard_summaries.multi_hazard.active_alerts}
                  </span>
                </div>
              </div>
              <p className="hazard-summary-card__desc">
                {stats.hazard_summaries.multi_hazard.status_message}
              </p>
              <div className="hazard-summary-card__driver">
                <strong>Primary Driver:</strong> {stats.hazard_summaries.multi_hazard.primary_driver}
              </div>
              <div className="hazard-summary-card__footer">
                <span className="synthetic-subtext">Data Quality: {stats.hazard_summaries.multi_hazard.data_quality}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Cascading Hazard Alert Banner if active ── */}
      {!loading && (stats?.hazard_breakdown?.cascade_events || 0) > 0 && (
        <div className="cascade-alert-banner">
          <span className="cascade-alert-banner__icon">⚠️</span>
          <div>
            <div className="cascade-alert-banner__title">
              CASCADING THREAT TRIGGER ACTIVE: {stats.hazard_breakdown.cascade_events} Location(s)
            </div>
            <div className="cascade-alert-banner__body">
              Heavy convective rainfall has exceeded soil percolation thresholds. Flash flooding and slope debris flows are threatening community water intake taps simultaneously.
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: Charts Suite for 7 Required Parameters ── */}
      {!loading && chartDataset.length > 0 && (
        <section className="dashboard-section" aria-label="Catchment Telemetry & Hazard Charts">
          <div className="section-title-wrap">
            <div>
              <h2 className="section-title">Catchment Telemetry &amp; Hazard Risk Charts</h2>
              <p className="dashboard-section__note">
                {operatingMode === 'REAL'
                  ? 'Physical sensor observations & geotechnical risk calculations from node JR-NODE-01.'
                  : 'Live synthetic sensor observations & ML peril predictions across all 10 verified mountain communities.'}
              </p>
            </div>
            <span
              className="synthetic-badge"
              style={{
                background: operatingMode === 'REAL' ? (realHardware.is_connected ? '#dcfce7' : '#fee2e2') : '#fef3c7',
                color: operatingMode === 'REAL' ? (realHardware.is_connected ? '#15803d' : '#991b1b') : '#92400e',
              }}
            >
              {operatingMode === 'REAL'
                ? realHardware.is_connected
                  ? 'Real Sensor Stream (JR-NODE-01)'
                  : 'Real Mode: Disconnected'
                : 'Synthetic Demo Telemetry'}
            </span>
          </div>

          {operatingMode === 'REAL' && !realHardware.is_connected ? (
            <div
              style={{
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '36px 20px',
                textAlign: 'center',
                margin: '16px 0',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                Real Sensor Mode: Awaiting Hardware Telemetry
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 560, margin: '0 auto 12px', lineHeight: 1.5 }}>
                Real Sensor Mode strictly plots authentic field measurements from hardware node <strong>JR-NODE-01</strong>. Because the node is not connected yet, simulated demonstration readings are hidden to prevent confusing synthetic data with physical observations.
              </p>
              <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                💡 Tip: Use the <strong>&ldquo;Push ESP32 Packet&rdquo;</strong> button above to test real-time telemetry ingestion or send an HTTP POST to <code>/api/telemetry</code>.
              </div>
            </div>
          ) : (
            <>
              {/* Interactive Chart Tabs Selector */}
              <div className="chart-tabs" role="tablist" aria-label="Chart Views">
                {[
                  { id: 'ALL', label: 'All Charts' },
                  { id: 'WATER_LEVEL', label: 'Water Level' },
                  { id: 'RAINFALL', label: 'Rainfall' },
                  { id: 'SOIL_MOISTURE', label: 'Soil Moisture' },
                  { id: 'WATER_STRESS', label: 'Water Stress' },
                  { id: 'FLOOD_RISK', label: 'Flood Risk' },
                  { id: 'LANDSLIDE_RISK', label: 'Landslide Risk' },
                  { id: 'MULTI_HAZARD_RISK', label: 'Overall Multi-Hazard Risk' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeChartTab === tab.id}
                    onClick={() => setActiveChartTab(tab.id as ActiveChartTab)}
                    className={`chart-tab-btn ${activeChartTab === tab.id ? 'chart-tab-btn--active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Render Charts Based on Selected Tab ── */}
              <div className="charts-container">
                {/* 1. Water Level Chart */}
                {(activeChartTab === 'ALL' || activeChartTab === 'WATER_LEVEL') && (
                  <div className="chart-card">
                    <div className="chart-card__header">
                      <div>
                        <h3 className="chart-card__title">💧 Water Level (m)</h3>
                        <div className="chart-card__sub">Primary reservoir / river stage per village</div>
                      </div>
                      <span
                        className="synthetic-pill"
                        style={{
                          background: operatingMode === 'REAL' ? '#dcfce7' : undefined,
                          color: operatingMode === 'REAL' ? '#15803d' : undefined,
                          borderColor: operatingMode === 'REAL' ? '#86efac' : undefined,
                        }}
                      >
                        {operatingMode === 'REAL' ? 'REAL SENSOR (JR-NODE-01)' : 'DEMO / SYNTHETIC'}
                      </span>
                    </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis unit="m" tick={{ fontSize: 11 }} width={38} domain={[0, 'auto']} />
                      <Tooltip
                        formatter={(val: any) => [`${val} meters`, 'Water Level']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <Bar dataKey="water_level" fill="#0284c7" radius={[4, 4, 0, 0]} name="Water Level (m)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 2. Rainfall Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'RAINFALL') && (
              <div className="chart-card">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">🌧️ Rainfall (mm)</h3>
                    <div className="chart-card__sub">24h cumulative hyetometer observations</div>
                  </div>
                  <span className="synthetic-pill">DEMO TELEMETRY</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis unit="mm" tick={{ fontSize: 11 }} width={42} domain={[0, 'auto']} />
                      <Tooltip
                        formatter={(val: any) => [`${val} mm`, 'Rainfall']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <Bar dataKey="rainfall" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Rainfall (mm)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3. Soil Moisture Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'SOIL_MOISTURE') && (
              <div className="chart-card">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">🌱 Soil Moisture (%)</h3>
                    <div className="chart-card__sub">Sub-surface volumetric pore saturation</div>
                  </div>
                  <span className="synthetic-pill">DEMO TELEMETRY</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis unit="%" tick={{ fontSize: 11 }} width={38} domain={[0, 100]} />
                      <Tooltip
                        formatter={(val: any) => [`${val}%`, 'Soil Moisture']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical Saturation', position: 'top', fill: '#dc2626', fontSize: 10 }} />
                      <Bar dataKey="soil_moisture" fill="#10b981" radius={[4, 4, 0, 0]} name="Soil Moisture (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 4. Water Stress Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'WATER_STRESS') && (
              <div className="chart-card">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">💧 Water Stress</h3>
                    <div className="chart-card__sub">Supply vs demand &amp; spring depletion index (0–100)</div>
                  </div>
                  <span className="synthetic-pill">PREDICTION MODEL</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(val: any) => [`${val} / 100`, 'Water Stress Score']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <ReferenceLine y={50} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Warning', position: 'insideTopRight', fill: '#ea580c', fontSize: 10 }} />
                      <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} />
                      <Bar dataKey="water_stress" radius={[4, 4, 0, 0]} name="Water Stress">
                        {chartDataset.map((entry, index) => (
                          <Cell key={`ws-cell-${index}`} fill={getRiskColor(entry.water_stress)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 5. Flood Risk Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'FLOOD_RISK') && (
              <div className="chart-card">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">🌊 Flood Risk</h3>
                    <div className="chart-card__sub">Flash flood surge &amp; riverbed inundation score (0–100)</div>
                  </div>
                  <span className="synthetic-pill">PREDICTION MODEL</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(val: any) => [`${val} / 100`, 'Flood Risk Score']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <ReferenceLine y={50} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Warning', position: 'insideTopRight', fill: '#ea580c', fontSize: 10 }} />
                      <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} />
                      <Bar dataKey="flood_risk" radius={[4, 4, 0, 0]} name="Flood Risk">
                        {chartDataset.map((entry, index) => (
                          <Cell key={`ff-cell-${index}`} fill={getRiskColor(entry.flood_risk)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 6. Landslide Risk Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'LANDSLIDE_RISK') && (
              <div className="chart-card">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">⛰️ Landslide Risk</h3>
                    <div className="chart-card__sub">Slope stability &amp; shear strength failure score (0–100)</div>
                  </div>
                  <span className="synthetic-pill">PREDICTION MODEL</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(val: any) => [`${val} / 100`, 'Landslide Risk Score']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <ReferenceLine y={50} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Warning', position: 'insideTopRight', fill: '#ea580c', fontSize: 10 }} />
                      <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} />
                      <Bar dataKey="landslide_risk" radius={[4, 4, 0, 0]} name="Landslide Risk">
                        {chartDataset.map((entry, index) => (
                          <Cell key={`ls-cell-${index}`} fill={getRiskColor(entry.landslide_risk)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 7. Overall Multi-Hazard Risk Chart */}
            {(activeChartTab === 'ALL' || activeChartTab === 'MULTI_HAZARD_RISK') && (
              <div className="chart-card chart-card--highlight">
                <div className="chart-card__header">
                  <div>
                    <h3 className="chart-card__title">⚡ Overall Multi-Hazard Risk</h3>
                    <div className="chart-card__sub">Composite multi-peril compound threat index (0–100)</div>
                  </div>
                  <span className="synthetic-pill">COMPOSITE SYNTHESIS</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartDataset} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="village" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                      <Tooltip
                        formatter={(val: any) => [`${val} / 100`, 'Overall Multi-Hazard Risk']}
                        contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                      />
                      <ReferenceLine y={50} stroke="#ea580c" strokeDasharray="3 3" label={{ value: 'Warning (50)', position: 'insideTopRight', fill: '#ea580c', fontSize: 10 }} />
                      <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Critical (75)', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} />
                      <Bar dataKey="overall_risk" radius={[4, 4, 0, 0]} name="Overall Multi-Hazard Risk">
                        {chartDataset.map((entry, index) => (
                          <Cell key={`comp-cell-${index}`} fill={getRiskColor(entry.overall_risk)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )}

      {/* ── Tri-Hazard Distribution & Outlook (Preserved) ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginTop: 20 }}>
          {/* Comparative Bar Chart */}
          <section className="card">
            <h2 className="card__heading">Tri-Hazard Comparative Distribution</h2>
            <p className="dashboard-section__note">
              Community breakdown across the three peril models.
            </p>
            <div style={{ height: 220, marginTop: 14 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={triHazardData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hazard" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Bar dataKey="Water Stress" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Flash Flood" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Landslide" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* High Priority Triage List */}
          <section className="card">
            <h2 className="card__heading">Priority Triage Standings</h2>
            <p className="dashboard-section__note">
              Highest compound vulnerability locations in Reasi catchment.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {assessments
                .slice()
                .sort((a, b) => b.composite_score - a.composite_score)
                .slice(0, 4)
                .map((a) => {
                  const isSelected = a.village_id === selectedTriageAssessment?.village_id
                  return (
                    <div
                      key={a.village_id}
                      onClick={() => setSelectedTriageVillageId(a.village_id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: isSelected ? '#f0f9ff' : 'var(--color-bg)',
                        border: isSelected ? '2px solid #0284c7' : '1px solid var(--color-border)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                      title="Click to view explainability diagnostic"
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: isSelected ? '#0369a1' : undefined }}>
                          {villageNameById[a.village_id]} {isSelected ? '🔎' : ''}
                        </strong>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          Dominant: <span style={{ textTransform: 'capitalize' }}>{a.primary_threat.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace' }}>
                          {a.composite_score}
                        </span>
                        <div style={{ marginTop: 2 }}>
                          <RiskBadge level={a.composite_level} />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Explainability Diagnostic for selected triage village */}
            {selectedTriageAssessment && (
              <div style={{ marginTop: 12 }}>
                <ExplainableFactors
                  compact
                  targetName={villageNameById[selectedTriageAssessment.village_id]}
                  overallRisk={selectedTriageAssessment.composite_level.toUpperCase()}
                  overallScore={selectedTriageAssessment.composite_score}
                  dominantHazard={selectedTriageAssessment.primary_threat}
                  riskScores={{
                    flood: selectedTriageAssessment.flood_risk_score,
                    landslide: selectedTriageAssessment.landslide_risk_score,
                    waterStress: selectedTriageAssessment.water_stress_score,
                    composite: selectedTriageAssessment.composite_score,
                  }}
                  factors={selectedTriageAssessment.top_factors}
                  cascadeTriggered={selectedTriageAssessment.cascade_triggered}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Active Multi-Hazard Alerts (Preserved) ── */}
      {!loading && alerts.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="card__heading">Active Emergency Notifications</h2>
          <ul className="alert-list" style={{ marginTop: 10 }}>
            {alerts.map((a) => (
              <li key={a.id} className={`alert-item alert-item--${a.severity}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiskBadge level={a.hazard_type} />
                  <strong>{a.alert_type.replace('_', ' ')}</strong>
                  {a.village_id && (
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      · {villageNameById[a.village_id]}
                    </span>
                  )}
                  <span className={`alert-severity-badge alert-severity-badge--${a.severity}`}>
                    {a.severity}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>{a.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Climate Telemetry Strip (Preserved) ── */}
      {!loading && stats?.recent_climate && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2 className="card__heading">Current Catchment Telemetry Stream</h2>
          <div className="card-row" style={{ marginTop: 12 }}>
            <KpiCard
              label="24h Mean Rainfall"
              value={`${stats.recent_climate.avg_rainfall_mm} mm`}
              accent="#0284c7"
            />
            <KpiCard
              label="Ambient Temperature"
              value={`${stats.recent_climate.avg_temperature_c} °C`}
              accent="#ea580c"
            />
            <KpiCard
              label="Relative Humidity"
              value={`${stats.recent_climate.avg_humidity_pct} %`}
              accent="#7c3aed"
            />
            <KpiCard
              label="Open Alerts"
              value={stats.alert_counts?.open ?? 0}
              accent="#dc2626"
            />
          </div>
        </section>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
  description,
  icon,
}: {
  label: string
  value: any
  accent: string
  description?: string
  icon?: string
}) {
  return (
    <div className="stat-card" style={{ borderTopColor: accent }} title={description}>
      <div className="stat-card__top">
        <div className="stat-card__value" style={{ color: accent }}>
          {value}
        </div>
        {icon && <span className="stat-card__icon">{icon}</span>}
      </div>
      <div className="stat-card__label">{label}</div>
      {description && <div className="stat-card__desc">{description}</div>}
    </div>
  )
}
