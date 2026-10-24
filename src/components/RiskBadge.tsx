import React from 'react'

interface ColourDef {
  bg: string
  text: string
  label: string
}

const COLOURS: Record<string, ColourDef> = {
  normal:      { bg: '#dcfce7', text: '#15803d', label: 'NORMAL' },
  watch:       { bg: '#fef9c3', text: '#854d0e', label: 'WATCH' },
  warning:     { bg: '#ffedd5', text: '#c2410c', label: 'WARNING' },
  critical:    { bg: '#fee2e2', text: '#b91c1c', label: 'CRITICAL' },
  low:         { bg: '#dcfce7', text: '#15803d', label: 'NORMAL' },
  medium:      { bg: '#fef9c3', text: '#854d0e', label: 'WATCH' },
  high:        { bg: '#fee2e2', text: '#b91c1c', label: 'CRITICAL' },
  compound:    { bg: '#f3e8ff', text: '#7e22ce', label: 'COMPOUND' },
  flash_flood: { bg: '#e0f2fe', text: '#0369a1', label: 'FLOOD' },
  landslide:   { bg: '#ffedd5', text: '#c2410c', label: 'LANDSLIDE' },
  water_stress:{ bg: '#fef9c3', text: '#854d0e', label: 'WATER STRESS' },
}

interface RiskBadgeProps {
  level?: string
  score?: number
  large?: boolean
  prefix?: string
}

export default function RiskBadge({ level, score, large = false, prefix }: RiskBadgeProps) {
  const key = level?.toLowerCase() || ''
  const c = COLOURS[key] || COLOURS.low

  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: large ? '4px 12px' : '2px 8px',
        borderRadius: '999px',
        fontSize: large ? '13px' : '11px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {prefix && <span style={{ opacity: 0.7 }}>{prefix}:</span>}
      <span>{c.label}</span>
      {score !== undefined && (
        <span style={{ fontWeight: 700, opacity: 0.9 }}>({score})</span>
      )}
    </span>
  )
}
