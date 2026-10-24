import React, { useEffect, useState, useMemo } from 'react'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import RiskBadge from '../components/RiskBadge'
import TelemetryConsole from '../components/TelemetryConsole'
import { getVillages, getHazardAssessments, getDashboardStats } from '../api'
import { Village, HazardAssessment } from '../api/store'
import './Page.css'
import './MultiHazardMatrix.css'

export default function MultiHazardMatrix() {
  const [villages, setVillages] = useState<Village[]>([])
  const [assessments, setAssessments] = useState<HazardAssessment[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'composite' | 'water' | 'flood' | 'landslide'>('composite')

  const loadData = () => {
    setLoading(true)
    Promise.all([getVillages(), getHazardAssessments(), getDashboardStats()])
      .then(([vRes, aRes, sRes]) => {
        setVillages(vRes.data ?? [])
        setAssessments(aRes.data ?? [])
        setStats(sRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const assessmentByVillageId = useMemo(
    () => Object.fromEntries(assessments.map((a) => [a.village_id, a])),
    [assessments]
  )

  const rows = useMemo(() => {
    const combined = villages.map((v) => {
      const a = assessmentByVillageId[v.id] || {
        composite_score: 0,
        composite_level: 'low' as const,
        water_stress_score: 0,
        water_stress_level: 'low' as const,
        flood_risk_score: 0,
        flood_risk_level: 'low' as const,
        landslide_risk_score: 0,
        landslide_risk_level: 'low' as const,
        primary_threat: 'water_stress' as const,
        cascade_triggered: false,
        top_factors: [],
      }
      return { village: v, assessment: a }
    })

    const filtered = combined.filter(
      (item) =>
        !search ||
        item.village.name.toLowerCase().includes(search.toLowerCase()) ||
        item.village.district.toLowerCase().includes(search.toLowerCase())
    )

    return filtered.sort((a, b) => {
      if (sortField === 'composite') return b.assessment.composite_score - a.assessment.composite_score
      if (sortField === 'water') return b.assessment.water_stress_score - a.assessment.water_stress_score
      if (sortField === 'flood') return b.assessment.flood_risk_score - a.assessment.flood_risk_score
      return b.assessment.landslide_risk_score - a.assessment.landslide_risk_score
    })
  }, [villages, assessmentByVillageId, search, sortField])

  return (
    <div className="page">
      <h1 className="page__title">Multi-Hazard Vulnerability Matrix</h1>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
        Cross-hazard multi-peril triage ranking for all 10 SMVDU study locations across Water Stress,
        Flash Flood Inundation, and Landslide Susceptibility.
      </p>

      <SyntheticDataNotice extra="Geotechnical metrics (slope, soil type, river proximity) and compound scores are synthetic demonstration calculations." />

      {/* Telemetry Simulator Console */}
      <TelemetryConsole
        activePreset={stats?.active_preset || 'nominal'}
        onPresetApplied={loadData}
      />

      <div className="matrix-toolbar">
        <input
          type="text"
          className="matrix-search"
          placeholder="Filter location name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>Sort by:</span>
          {(['composite', 'water', 'flood', 'landslide'] as const).map((field) => (
            <button
              key={field}
              onClick={() => setSortField(field)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 11.5,
                fontWeight: 600,
                border: '1px solid var(--color-border)',
                background: sortField === field ? 'var(--color-accent)' : 'var(--color-surface)',
                color: sortField === field ? '#fff' : 'var(--color-muted)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {field === 'composite' ? 'Composite' : field === 'water' ? 'Water Stress' : field === 'flood' ? 'Flash Flood' : 'Landslide'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="loading-text">Loading multi-hazard matrix…</p>}

      {!loading && (
        <div className="card table-wrapper" style={{ padding: 0 }}>
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Location</th>
                <th>Composite Score</th>
                <th>Water Stress</th>
                <th>Flash Flood</th>
                <th>Landslide Risk</th>
                <th>Primary Threat</th>
                <th>Terrain (Slope / Soil)</th>
                <th>River Proximity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const { village, assessment } = row
                return (
                  <tr key={village.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-muted)' }}>#{idx + 1}</td>
                    <td>
                      <strong>{village.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                        Pop: {village.population.toLocaleString()} · {village.elevation_m}m
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color:
                              assessment.composite_score >= 65
                                ? '#dc2626'
                                : assessment.composite_score >= 40
                                ? '#d97706'
                                : '#16a34a',
                          }}
                        >
                          {assessment.composite_score}/100
                        </span>
                        <RiskBadge level={assessment.composite_level} />
                      </div>
                    </td>
                    <td>
                      <span className="score-cell">{assessment.water_stress_score}</span>{' '}
                      <RiskBadge level={assessment.water_stress_level} />
                    </td>
                    <td>
                      <span className="score-cell">{assessment.flood_risk_score}</span>{' '}
                      <RiskBadge level={assessment.flood_risk_level} />
                    </td>
                    <td>
                      <span className="score-cell">{assessment.landslide_risk_score}</span>{' '}
                      <RiskBadge level={assessment.landslide_risk_level} />
                    </td>
                    <td>
                      {assessment.cascade_triggered ? (
                        <span
                          style={{
                            background: '#f3e8ff',
                            color: '#7e22ce',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ CASCADE TRIGGER
                        </span>
                      ) : (
                        <RiskBadge level={assessment.primary_threat} />
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{village.slope_deg}°</span>{' '}
                      <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                        ({village.soil_type.replace('_', ' ')})
                      </span>
                    </td>
                    <td>{village.distance_to_river_m}m</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
