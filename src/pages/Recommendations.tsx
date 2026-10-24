import React, { useEffect, useState } from 'react'
import { getRecommendations } from '../api'
import RiskBadge from '../components/RiskBadge'
import './Page.css'

const RISK_LEVELS = ['high', 'medium', 'low']

const HAZARD_TABS = [
  { key: 'all', label: 'All Perils' },
  { key: 'compound', label: 'Compound & Cascading' },
  { key: 'flash_flood', label: 'Flash Flood Defenses' },
  { key: 'landslide', label: 'Slope Stabilization' },
  { key: 'water_stress', label: 'Drought & Water Stress' },
]

export default function Recommendations() {
  const [activeLevel, setActiveLevel] = useState('high')
  const [hazardFilter, setHazardFilter] = useState('all')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    getRecommendations(activeLevel)
      .then((r) => {
        setData(r.data)
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load recommendations.')
      })
      .finally(() => setLoading(false))
  }, [activeLevel])

  const filteredItems = (data?.recommendations ?? []).filter((item: any) => {
    if (hazardFilter === 'all') return true
    return item.hazard_type === hazardFilter
  })

  return (
    <div className="page">
      <h1 className="page__title">Multi-Hazard Action &amp; Emergency Protocols</h1>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
        Standard operating disaster risk reduction (DRR) protocols categorized by threat tier and peril type.
      </p>

      {/* Warning banner */}
      <div
        role="note"
        style={{
          background: '#fffbeb',
          border: '1px solid #fbbf24',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: '12.5px',
          color: '#92400e',
          marginBottom: 18,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
        <span>
          <strong>Prototype decision-support guide only.</strong> Emergency responses must follow official directives issued by the Reasi District Disaster Management Authority (DDMA) and State Disaster Response Force (SDRF).
        </span>
      </div>

      {/* Risk level toggle pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {RISK_LEVELS.map((lvl) => {
          const isActive = activeLevel === lvl
          return (
            <button
              key={lvl}
              onClick={() => setActiveLevel(lvl)}
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                border: isActive
                  ? lvl === 'high' ? '2px solid #dc2626' : lvl === 'medium' ? '2px solid #d97706' : '2px solid #16a34a'
                  : '1px solid var(--color-border)',
                background: isActive
                  ? lvl === 'high' ? '#fee2e2' : lvl === 'medium' ? '#fef3c7' : '#dcfce7'
                  : 'var(--color-surface)',
                color: isActive
                  ? lvl === 'high' ? '#991b1b' : lvl === 'medium' ? '#92400e' : '#166534'
                  : 'var(--color-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {lvl} Priority Response
            </button>
          )
        })}
      </div>

      {/* Hazard Peril Sub-filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {HAZARD_TABS.map((tab) => {
          const isSel = hazardFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setHazardFilter(tab.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: isSel ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: isSel ? 'var(--color-accent-light)' : 'var(--color-surface)',
                color: isSel ? 'var(--color-accent)' : 'var(--color-muted)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading && <p className="loading-text">Loading action protocols…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && data && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {data.risk_level?.toUpperCase()} Tier Multi-Hazard Directive
              </h2>
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {filteredItems.length} active guidelines
              </span>
            </div>
            <RiskBadge level={data.risk_level} large />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredItems.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', padding: 12 }}>
                No specific guidelines for this peril category under {activeLevel} tier.
              </p>
            ) : (
              filteredItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <RiskBadge level={item.hazard_type || 'compound'} />

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--color-muted)',
                        letterSpacing: '0.04em',
                        marginBottom: 3,
                      }}
                    >
                      {item.category}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
                      {item.action}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
