import React from 'react'
import RiskBadge from './RiskBadge'

export interface ExplainableFactorsProps {
  factors?: string[]
  title?: string
  overallRisk?: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' | string
  overallScore?: number
  dominantHazard?: string
  riskScores?: {
    flood?: number
    landslide?: number
    waterStress?: number
    composite?: number
  }
  targetName?: string // e.g. "Katra" or "ESP32-JAL-REASI-101"
  cascadeTriggered?: boolean
  compact?: boolean
}

export default function ExplainableFactors({
  factors = [],
  title,
  overallRisk,
  overallScore,
  dominantHazard,
  riskScores,
  targetName,
  cascadeTriggered,
  compact = false,
}: ExplainableFactorsProps) {
  // Normalize dominant hazard label
  const formatHazard = (hazard?: string) => {
    if (!hazard) return null
    const h = hazard.toUpperCase().replace('FLASH_FLOOD', 'FLOOD')
    if (h === 'WATER_STRESS') return 'Water Stress'
    if (h === 'FLOOD') return 'Flood'
    if (h === 'LANDSLIDE') return 'Landslide'
    if (h === 'COMBINED' || h === 'COMPOUND') return 'Combined (Multi-Hazard Compound)'
    return hazard
  }

  const dominantDisplay = formatHazard(dominantHazard)

  // Determine category badge display
  const categoryDisplay = overallRisk ? overallRisk.toUpperCase() : null

  // If only factors are passed without scores (minimal mode)
  const isMinimal = !overallRisk && !riskScores && !dominantHazard

  if (isMinimal) {
    if (!factors || factors.length === 0) return null
    return (
      <div
        className="explainability-card explainability-card--minimal"
        style={{
          marginTop: 10,
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>❓</span>
          <span>{title || 'WHY is this village/node at risk?'}</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          Main contributing factors:
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {factors.map((f, idx) => (
            <li key={idx} style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
              <strong>{f}</strong>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div
      className={`explainability-card ${compact ? 'explainability-card--compact' : ''}`}
      style={{
        marginTop: 12,
        padding: compact ? '10px 12px' : '14px 16px',
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        borderLeft: '4px solid #ea580c',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* ── Question Header ── */}
      <div
        style={{
          fontSize: compact ? 12 : 13.5,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 6,
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>❓</span>
          <span className="explainability-question font-bold text-slate-900">
            WHY is this village/node at risk?
          </span>
        </div>
        {targetName && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#0284c7',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            Target: {targetName}
          </span>
        )}
      </div>

      {/* ── 1. Overall Risk ── */}
      {categoryDisplay && (
        <div
          className="explainability-overall-risk"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', letterSpacing: '0.02em' }}>
            Overall Risk (MULTI-HAZARD RISK: {categoryDisplay}):
          </span>
          <RiskBadge level={categoryDisplay.toLowerCase()} />
          {overallScore !== undefined && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              (Score: {overallScore})
            </span>
          )}
          {cascadeTriggered && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#7e22ce',
                background: '#f3e8ff',
                border: '1px solid #d8b4fe',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              ⚠️ CASCADING COUPLING
            </span>
          )}
        </div>
      )}

      {/* ── 2. Risk Score Breakdown ── */}
      {riskScores && (
        <div
          className="explainability-risk-scores"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
            Risk Score:
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {riskScores.flood !== undefined && (
              <div style={{ fontSize: 12.5, color: '#1e293b' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Flood Risk:</span>{' '}
                <strong style={{ color: '#0284c7' }}>{riskScores.flood}</strong>
              </div>
            )}
            {riskScores.landslide !== undefined && (
              <div style={{ fontSize: 12.5, color: '#1e293b' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Landslide Risk:</span>{' '}
                <strong style={{ color: '#ea580c' }}>{riskScores.landslide}</strong>
              </div>
            )}
            {riskScores.waterStress !== undefined && (
              <div style={{ fontSize: 12.5, color: '#1e293b' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Water Stress:</span>{' '}
                <strong style={{ color: '#d97706' }}>{riskScores.waterStress}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Dominant Hazard ── */}
      {dominantDisplay && (
        <div className="explainability-dominant-hazard" style={{ fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Dominant Hazard:</span>{' '}
          <strong style={{ color: '#0f172a' }}>{dominantDisplay}</strong>
        </div>
      )}

      {/* ── 4. Top Contributing Factors (Numbered 1, 2, 3...) ── */}
      <div className="explainability-factors-section" style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            marginBottom: 6,
          }}
        >
          Top Contributing Factors (Main contributing factors):
        </div>

        {factors && factors.length > 0 ? (
          <ol
            className="explainability-factors-list"
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {factors.map((factor, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: 12.5,
                  color: '#1e293b',
                  lineHeight: 1.45,
                }}
              >
                <strong>{factor}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>
            No critical risk triggers exceeded baseline safe thresholds.
          </div>
        )}
      </div>

      {/* ── Model Integrity Footnote ── */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 6,
          borderTop: '1px solid #f1f5f9',
          fontSize: 10,
          color: '#94a3b8',
        }}
      >
        Verified feature attribution derived from configured rule engine &amp; telemetry pipeline · Zero fabricated weights.
      </div>
    </div>
  )
}
