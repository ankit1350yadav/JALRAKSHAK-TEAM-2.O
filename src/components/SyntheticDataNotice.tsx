import React from 'react'

interface SyntheticDataNoticeProps {
  extra?: string
}

/**
 * SyntheticDataNotice — renders a visible warning banner that all data
 * in this prototype is synthetic/demonstration data.
 */
export default function SyntheticDataNotice({ extra }: SyntheticDataNoticeProps) {
  return (
    <div
      role="note"
      style={{
        background: '#fffbeb',
        border: '1px solid #fbbf24',
        borderRadius: '6px',
        padding: '10px 14px',
        fontSize: '12.5px',
        color: '#92400e',
        marginBottom: '16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>⚠️</span>
      <span>
        <strong>Prototype demonstration data</strong> — not representative of actual
        field measurements.{extra ? ' ' + extra : ''} This prototype is for educational
        purposes only and does not provide certified hydrological forecasts or
        drinking-water safety assessments.
      </span>
    </div>
  )
}
