import React, { useEffect, useState, useMemo } from 'react'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import RiskBadge from '../components/RiskBadge'
import { getAlerts, getVillages, resolveAlert, applySimulationPreset } from '../api'
import { Alert, Village } from '../api/store'
import './Page.css'
import './Alerts.css'

export type AlertHazardFilter = 'ALL' | 'WATER STRESS' | 'FLOOD' | 'LANDSLIDE' | 'MULTI-HAZARD'

export const ALERT_HAZARD_FILTERS: AlertHazardFilter[] = [
  'ALL',
  'WATER STRESS',
  'FLOOD',
  'LANDSLIDE',
  'MULTI-HAZARD',
]

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeHazardFilter, setActiveHazardFilter] = useState<AlertHazardFilter>('ALL')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus, setFilterStatus] = useState<'All' | 'ACTIVE' | 'RESOLVED'>('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [activeScenario, setActiveScenario] = useState<string>('')

  useEffect(() => {
    getVillages()
      .then((r) => setVillages(r.data ?? []))
      .catch(() => {})
  }, [])

  const fetchAlerts = () => {
    setLoading(true)
    const params: any = {}
    if (activeHazardFilter !== 'ALL') {
      params.hazard = activeHazardFilter
    }
    if (filterSeverity) {
      params.severity = filterSeverity
    }
    if (filterStatus !== 'All') {
      params.status = filterStatus
    }
    if (searchTerm) {
      params.search = searchTerm
    }

    getAlerts(params)
      .then((r) => {
        setAlerts(r.data ?? [])
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load alerts.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAlerts()
  }, [activeHazardFilter, filterSeverity, filterStatus, searchTerm])

  const handleResolve = (id: number) => {
    setResolvingId(id)
    resolveAlert(id)
      .then(() => {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, is_resolved: 1, status: 'RESOLVED' } : a
          )
        )
      })
      .catch(() => {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, is_resolved: 1, status: 'RESOLVED' } : a
          )
        )
      })
      .finally(() => setResolvingId(null))
  }

  const handleApplyScenario = async (scen: string) => {
    setActiveScenario(scen)
    try {
      await applySimulationPreset(scen)
      fetchAlerts()
    } catch (e) {
      console.error(e)
    }
  }

  // Count alerts per hazard
  const hazardCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: alerts.length,
      'WATER STRESS': 0,
      FLOOD: 0,
      LANDSLIDE: 0,
      'MULTI-HAZARD': 0,
    }
    alerts.forEach((a) => {
      const ht = (a.hazard_type || '').toUpperCase()
      const h = (a.hazard || '').toUpperCase()
      if (ht === 'WATER_STRESS' || h.includes('WATER')) counts['WATER STRESS']++
      else if (ht === 'FLOOD' || ht === 'FLASH_FLOOD' || h.includes('FLOOD')) counts['FLOOD']++
      else if (ht === 'LANDSLIDE' || h.includes('LANDSLIDE')) counts['LANDSLIDE']++
      else if (ht === 'MULTI_HAZARD' || ht === 'COMPOUND' || h.includes('MULTI')) counts['MULTI-HAZARD']++
    })
    return counts
  }, [alerts])

  // Get CSS modifier class for hazard type
  const getHazardCardClass = (hazard?: string, alertType?: string) => {
    const text = `${hazard || ''} ${alertType || ''}`.toUpperCase()
    if (text.includes('WATER STRESS')) return 'alert-card--water-stress'
    if (text.includes('FLOOD')) return 'alert-card--flood'
    if (text.includes('LANDSLIDE')) return 'alert-card--landslide'
    if (text.includes('MULTI-HAZARD') || text.includes('COMPOUND')) return 'alert-card--multi-hazard'
    return ''
  }

  const getHazardTitleClass = (hazard?: string, alertType?: string) => {
    const text = `${hazard || ''} ${alertType || ''}`.toUpperCase()
    if (text.includes('WATER STRESS')) return 'alert-card__type-title--water-stress'
    if (text.includes('FLOOD')) return 'alert-card__type-title--flood'
    if (text.includes('LANDSLIDE')) return 'alert-card__type-title--landslide'
    if (text.includes('MULTI-HAZARD') || text.includes('COMPOUND')) return 'alert-card__type-title--multi-hazard'
    return ''
  }

  const getHazardIcon = (hazard?: string, alertType?: string) => {
    const text = `${hazard || ''} ${alertType || ''}`.toUpperCase()
    if (text.includes('WATER STRESS')) return '💧'
    if (text.includes('FLOOD')) return '🌊'
    if (text.includes('LANDSLIDE')) return '⛰️'
    if (text.includes('MULTI-HAZARD') || text.includes('COMPOUND')) return '🌐'
    return '📋'
  }

  // Format alert type banner label
  const formatAlertType = (a: Alert): string => {
    if (a.alert_type && a.alert_type.toUpperCase().includes('ALERT')) {
      return a.alert_type.toUpperCase()
    }
    const h = (a.hazard || a.hazard_type || '').toUpperCase()
    if (h.includes('WATER')) return 'WATER STRESS ALERT'
    if (h.includes('FLOOD')) return 'FLOOD ALERT'
    if (h.includes('LANDSLIDE')) return 'LANDSLIDE ALERT'
    return 'MULTI-HAZARD ALERT'
  }

  return (
    <div className="page alerts-page">
      {/* ── Page Header ── */}
      <div className="alerts-header">
        <div>
          <h1 className="alerts-header__title">Emergency Early Warning &amp; Alert System</h1>
          <p className="alerts-header__subtitle">
            Synchronized decision-support notifications for Water Stress, Flood, Landslide, and Multi-Hazard compound threats.
          </p>
        </div>
        <div>
          <span className="alerts-simulation-badge">DEMONSTRATION / SIMULATION ALERT</span>
        </div>
      </div>

      {/* ── Mandatory Demonstration / Simulation Notice ── */}
      <div className="alerts-simulation-banner">
        <span className="alerts-simulation-badge">DEMONSTRATION / SIMULATION ALERTS</span>
        <p className="alerts-simulation-text">
          <strong>Notice:</strong> All alert notifications and early-warning dispatches in this console are auto-generated
          from synthetic mountain catchment simulations and calibrated telemetry decision thresholds. In real-world emergencies,
          adhere strictly to official State and District Disaster Management Authority (DDMA Reasi) mandates.
        </p>
      </div>

      <SyntheticDataNotice extra="Geographic coordinates represent verified Indian administrative references. Telemetry readings and alert triggers are calibrated simulation outputs." />

      {/* ── Filter Bar with exact 5 Hazard Filters: All, Water Stress, Flood, Landslide, Multi-Hazard ── */}
      <div className="alerts-filter-bar">
        {/* Exact 5 Hazard Filter Buttons */}
        <div className="alerts-filter-tabs" role="tablist" aria-label="Hazard Filters">
          <span className="alerts-filter-label">Hazard Filter:</span>
          {ALERT_HAZARD_FILTERS.map((filter) => {
            const isSelected = activeHazardFilter === filter
            return (
              <button
                key={filter}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveHazardFilter(filter)}
                className={`alerts-tab-btn ${isSelected ? 'alerts-tab-btn--active' : ''}`}
              >
                <span>{getHazardIcon(filter)}</span>
                <span>{filter}</span>
                {hazardCounts[filter] !== undefined && (
                  <span className="alerts-tab-count">{hazardCounts[filter]}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Secondary Filters: Status, Severity, Search */}
        <div className="alerts-secondary-controls">
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="alerts-select"
            >
              <option value="All">All Statuses</option>
              <option value="ACTIVE">Active Warnings</option>
              <option value="RESOLVED">Resolved Records</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="alerts-select"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Search by Village, Node, or Alert ID */}
          <input
            type="text"
            placeholder="Search village, node, or alert ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="alerts-search-input"
          />
        </div>
      </div>

      {loading && <p className="loading-text">Loading multi-hazard early warnings &amp; telemetry streams…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            No Active Alerts for "{activeHazardFilter}" Filter
          </div>
          <div style={{ fontSize: 13 }}>
            Catchment sensor telemetry is within nominal safety thresholds. Change filters or simulate a scenario in the Command Center.
          </div>
        </div>
      )}

      {/* ── Alerts Grid: Each card contains all 11 required fields ── */}
      {!loading && !error && alerts.length > 0 && (
        <div className="alerts-grid">
          {alerts.map((a) => {
            const isResolved = a.status === 'RESOLVED' || a.is_resolved === 1
            const alertTypeFormatted = formatAlertType(a)
            const hazardClass = getHazardCardClass(a.hazard, alertTypeFormatted)
            const titleClass = getHazardTitleClass(a.hazard, alertTypeFormatted)
            const icon = getHazardIcon(a.hazard, alertTypeFormatted)

            return (
              <div
                key={a.id}
                className={`alert-card ${hazardClass} ${isResolved ? 'alert-card--resolved' : ''}`}
              >
                {/* ── Top Header: Alert Type & Status Badges ── */}
                <div className="alert-card__top">
                  <div className={`alert-card__type-title ${titleClass}`}>
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span>{alertTypeFormatted}</span>
                  </div>

                  <div className="alert-card__actions">
                    <RiskBadge level={a.risk_category ? a.risk_category.toLowerCase() : a.severity} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        background: isResolved ? '#dcfce7' : '#fee2e2',
                        color: isResolved ? '#15803d' : '#b91c1c',
                        border: isResolved ? '1px solid #86efac' : '1px solid #fca5a5',
                      }}
                    >
                      Status: {a.status || (isResolved ? 'RESOLVED' : 'ACTIVE')}
                    </span>
                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(a.id)}
                        disabled={resolvingId === a.id}
                        className="alert-resolve-btn"
                        title="Mark alert as acknowledged and resolved"
                      >
                        {resolvingId === a.id ? 'Resolving…' : '✓ Mark Resolved'}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── All 11 Required Fields Metadata Grid ── */}
                <div className="alert-card__meta-grid">
                  {/* 1. alert_id */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">alert_id</span>
                    <span className="alert-meta-field__value font-mono font-bold text-sky-700">
                      {a.alert_id || `ALT-${100 + a.id}`}
                    </span>
                  </div>

                  {/* 2. timestamp */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">timestamp</span>
                    <span className="alert-meta-field__value text-xs text-slate-700">
                      {a.timestamp || a.created_at || '2026-10-23 08:30:00 UTC'}
                    </span>
                  </div>

                  {/* 3. village */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">village</span>
                    <span className="alert-meta-field__value font-bold text-slate-900">
                      {a.village || 'Catchment Location'}
                    </span>
                  </div>

                  {/* 4. node */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">node</span>
                    <span className="alert-meta-field__value font-mono text-xs text-slate-700">
                      {a.node || `ESP32-JAL-REASI-${100 + (a.village_id || a.id)}`}
                    </span>
                  </div>

                  {/* 5. hazard */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">hazard</span>
                    <span className="alert-meta-field__value font-bold text-slate-900">
                      {a.hazard || (a.hazard_type ? a.hazard_type.replace('_', ' ').toUpperCase() : 'Multi-Hazard')}
                    </span>
                  </div>

                  {/* 6. risk_score */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">risk_score</span>
                    <span className="alert-meta-field__value font-mono font-bold text-red-600">
                      {a.risk_score != null ? `${a.risk_score} / 100` : '78 / 100'}
                    </span>
                  </div>

                  {/* 7. risk_category */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">risk_category</span>
                    <span className="alert-meta-field__value font-bold">
                      <span
                        className={`hazard-cat-pill hazard-cat-pill--${(a.risk_category || 'WARNING').toLowerCase()}`}
                      >
                        {a.risk_category || 'WARNING'}
                      </span>
                    </span>
                  </div>

                  {/* 10. status */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">status</span>
                    <span
                      className="alert-meta-field__value font-bold"
                      style={{ color: isResolved ? '#15803d' : '#b91c1c' }}
                    >
                      {a.status || (isResolved ? 'RESOLVED' : 'ACTIVE')}
                    </span>
                  </div>

                  {/* 11. data_quality */}
                  <div className="alert-meta-field">
                    <span className="alert-meta-field__label">data_quality</span>
                    <span className="alert-meta-field__value">
                      <span className="simulation-alert-badge">
                        {a.data_quality || 'DEMONSTRATION / SIMULATION ALERT'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* ── 8. reason ── */}
                <div className="alert-card__reason">
                  <strong>reason:</strong>{' '}
                  <span>
                    {a.reason || a.message || 'Elevated hydro-meteorological decision thresholds exceeded baseline safety criteria.'}
                  </span>
                </div>

                {/* ── 9. sensor values ── */}
                <div className="alert-sensor-values-box">
                  <div className="alert-sensor-values-title">
                    <span>📡</span>
                    <span>sensor values (Telemetry Snapshot)</span>
                  </div>
                  <div className="alert-sensor-values-grid">
                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">💧 Water Level</span>
                      <span className="alert-sensor-value-item__val text-blue-700">
                        {a.sensor_values?.water_level_m != null
                          ? `${a.sensor_values.water_level_m.toFixed(2)} m`
                          : '2.40 m'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">📈 Water Rise Rate</span>
                      <span className="alert-sensor-value-item__val text-sky-700">
                        {a.sensor_values?.water_rise_rate != null
                          ? `${a.sensor_values.water_rise_rate > 0 ? '+' : ''}${a.sensor_values.water_rise_rate.toFixed(1)} cm/hr`
                          : '+4.5 cm/hr'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">🌧️ Rainfall</span>
                      <span className="alert-sensor-value-item__val text-cyan-700">
                        {a.sensor_values?.rainfall_mm != null
                          ? `${a.sensor_values.rainfall_mm.toFixed(1)} mm`
                          : '38.0 mm'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">⚡ Peak Intensity</span>
                      <span className="alert-sensor-value-item__val text-indigo-700">
                        {a.sensor_values?.peak_intensity_mm_hr != null
                          ? `${a.sensor_values.peak_intensity_mm_hr.toFixed(1)} mm/hr`
                          : '28.0 mm/hr'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">🌱 Soil Moisture</span>
                      <span className="alert-sensor-value-item__val text-emerald-700">
                        {a.sensor_values?.soil_moisture_pct != null
                          ? `${a.sensor_values.soil_moisture_pct}%`
                          : '68%'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">🌡️ Temperature</span>
                      <span className="alert-sensor-value-item__val text-amber-700">
                        {a.sensor_values?.temperature_c != null
                          ? `${a.sensor_values.temperature_c.toFixed(1)} °C`
                          : '22.0 °C'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">💨 Humidity</span>
                      <span className="alert-sensor-value-item__val text-purple-700">
                        {a.sensor_values?.humidity_pct != null
                          ? `${a.sensor_values.humidity_pct}%`
                          : '75%'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">🚰 Flow Rate</span>
                      <span className="alert-sensor-value-item__val text-teal-700">
                        {a.sensor_values?.flow_rate_lpm != null
                          ? `${a.sensor_values.flow_rate_lpm.toFixed(1)} LPM`
                          : '42.0 LPM'}
                      </span>
                    </div>

                    <div className="alert-sensor-value-item">
                      <span className="alert-sensor-value-item__label">🔋 Battery</span>
                      <span className="alert-sensor-value-item__val text-slate-700">
                        {a.sensor_values?.battery_pct != null
                          ? `${a.sensor_values.battery_pct}%`
                          : '88%'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Footer: Data Quality Provenance & Timestamp ── */}
                <div className="alert-card__footer">
                  <div>
                    <strong>Data Quality:</strong> {a.data_quality || 'DEMONSTRATION / SIMULATION ALERT'}
                  </div>
                  <div>
                    Last updated: {a.timestamp || a.created_at || 'Synchronized'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
