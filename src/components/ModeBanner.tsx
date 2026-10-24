import React, { useState } from 'react'
import { SystemOperatingMode, setOperatingMode } from '../api'

interface ModeBannerProps {
  currentMode: SystemOperatingMode
  hardwareConnected: boolean
  hardwareStatus?: 'CONNECTED' | 'DISCONNECTED' | 'STALE'
  packetCount: number
  onModeChanged: (mode: SystemOperatingMode) => void
}

export default function ModeBanner({
  currentMode,
  hardwareConnected,
  hardwareStatus,
  packetCount,
  onModeChanged,
}: ModeBannerProps) {
  const [loading, setLoading] = useState(false)
  const isReal = currentMode === 'REAL' || currentMode === 'REAL_SENSOR'
  const effectiveStatus = hardwareStatus || (hardwareConnected ? 'CONNECTED' : 'DISCONNECTED')

  const handleToggle = async (targetMode: SystemOperatingMode) => {
    if (targetMode === currentMode) return
    setLoading(true)
    try {
      await setOperatingMode(targetMode)
      onModeChanged(targetMode)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeStyle = () => {
    if (!isReal) {
      return {
        bg: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fcd34d',
        text: 'Demonstration Mode • Synthetic Data',
        iconBg: '#f59e0b',
        icon: '🧪',
      }
    }
    if (effectiveStatus === 'CONNECTED') {
      return {
        bg: '#064e3b',
        color: '#34d399',
        border: '1px solid #059669',
        text: 'JR-NODE-01 Online • Live Stream (CONNECTED)',
        iconBg: '#059669',
        icon: '📡',
      }
    }
    if (effectiveStatus === 'STALE') {
      return {
        bg: '#78350f',
        color: '#fde047',
        border: '1px solid #d97706',
        text: 'JR-NODE-01 Stale • Signal Timeout > 60s (STALE)',
        iconBg: '#d97706',
        icon: '⚠️',
      }
    }
    return {
      bg: '#7f1d1d',
      color: '#fca5a5',
      border: '1px solid #dc2626',
      text: 'JR-NODE-01 Disconnected • Awaiting Signal (DISCONNECTED)',
      iconBg: '#dc2626',
      icon: '🔌',
    }
  }

  const badge = getStatusBadgeStyle()

  return (
    <div
      style={{
        background: isReal ? '#0f172a' : '#ffffff',
        color: isReal ? '#f8fafc' : '#0f172a',
        border: isReal ? '2px solid #0284c7' : '2px solid #f59e0b',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 20,
        boxShadow: isReal ? '0 4px 14px rgba(2, 132, 199, 0.15)' : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: badge.iconBg,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {badge.icon}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  color: isReal ? '#ffffff' : '#0f172a',
                }}
              >
                {isReal ? 'REAL SENSOR MODE' : 'SIMULATION MODE'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: badge.bg,
                  color: badge.color,
                  border: badge.border,
                }}
              >
                {badge.text}
              </span>
            </div>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 12.5,
                color: isReal ? '#94a3b8' : '#64748b',
                lineHeight: 1.4,
              }}
            >
              {isReal
                ? effectiveStatus === 'CONNECTED'
                  ? `Receiving authenticated telemetry packets from field hardware node JR-NODE-01 (${packetCount} packet${packetCount === 1 ? '' : 's'} recorded). Data quality: REAL.`
                  : effectiveStatus === 'STALE'
                  ? `Hardware node JR-NODE-01 was previously reporting (${packetCount} packet${packetCount === 1 ? '' : 's'}), but has not transmitted a heartbeat within the last 60 seconds. Status marked STALE.`
                  : 'Hardware is not connected yet. Awaiting initial telemetry transmission via HTTP POST /api/telemetry. Simulated readings are strictly prohibited in this mode.'
                : 'Synthetic catchment simulation active. Modeling hypothetical geotechnical & hydrological storm scenarios. Readings are strictly demonstration data.'}
            </p>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isReal ? '#94a3b8' : '#64748b',
              marginRight: 4,
            }}
          >
            Switch Mode:
          </span>

          <button
            onClick={() => handleToggle('SIMULATION')}
            disabled={loading || !isReal}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: isReal ? 'pointer' : 'default',
              border: !isReal ? '2px solid #f59e0b' : '1px solid #475569',
              background: !isReal ? '#fef3c7' : '#1e293b',
              color: !isReal ? '#92400e' : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>🧪</span>
            <span>Simulation Mode</span>
            {!isReal && <span style={{ fontSize: 10 }}>● ACTIVE</span>}
          </button>

          <button
            onClick={() => handleToggle('REAL')}
            disabled={loading || isReal}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: !isReal ? 'pointer' : 'default',
              border: isReal ? '2px solid #38bdf8' : '1px solid #e2e8f0',
              background: isReal ? '#0284c7' : '#f8fafc',
              color: isReal ? '#ffffff' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>📡</span>
            <span>Real Sensor Mode</span>
            {isReal && <span style={{ fontSize: 10 }}>● ACTIVE</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
