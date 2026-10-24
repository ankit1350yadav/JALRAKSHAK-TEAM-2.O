import React, { useEffect, useState } from 'react'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import { getSources, getVillages } from '../api'
import { WaterSource, Village } from '../api/store'
import './Page.css'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  spring: 'Spring',
  river_tap: 'River Tap',
  tank: 'Tank',
  well: 'Well',
}

export default function WaterSources() {
  const [sources, setSources] = useState<WaterSource[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterVillage, setFilterVillage] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    getVillages()
      .then((r) => setVillages(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: any = {}
    if (filterVillage) params.village_id = filterVillage
    if (filterType) params.source_type = filterType

    getSources(params)
      .then((r) => {
        setSources(r.data ?? [])
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load water sources.')
      })
      .finally(() => setLoading(false))
  }, [filterVillage, filterType])

  const villageNameById = Object.fromEntries(villages.map((v) => [v.id, v.name]))

  return (
    <div className="page">
      <h1 className="page__title">Water Sources</h1>
      <SyntheticDataNotice extra="Water-source locations, water levels, and flow rates are synthetic demonstration values — not surveyed field measurements." />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filterVillage}
          onChange={(e) => setFilterVillage(e.target.value)}
          style={{
            padding: '7px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="">All Locations</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '7px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="">All Source Types</option>
          {Object.entries(SOURCE_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        {(filterVillage || filterType) && (
          <button
            onClick={() => {
              setFilterVillage('')
              setFilterType('')
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="loading-text">Loading water sources…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && sources.length === 0 && (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 32, color: 'var(--color-muted)' }}
        >
          No water sources found for the selected filters.
        </div>
      )}

      {!loading && !error && sources.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source Name</th>
                  <th>Type</th>
                  <th>Village</th>
                  <th>Water Level (m)</th>
                  <th>Flow Rate (L/min)</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.source_name}</strong>
                    </td>
                    <td>
                      <span className="type-badge">
                        {SOURCE_TYPE_LABELS[s.source_type] || s.source_type}
                      </span>
                    </td>
                    <td>{villageNameById[s.village_id] || `Village #${s.village_id}`}</td>
                    <td>{s.water_level_m != null ? s.water_level_m.toFixed(2) : '—'}</td>
                    <td>{s.flow_rate_lpm != null ? s.flow_rate_lpm.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)' }}>
            {sources.length} source{sources.length !== 1 ? 's' : ''} shown. Prototype •
            Demonstration Data — all measurements are synthetic.
          </p>
        </>
      )}
    </div>
  )
}
