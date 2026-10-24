import React, { useState } from 'react'
import { applySimulationPreset } from '../api'

interface TelemetryConsoleProps {
  activePreset: string
  onPresetApplied: () => void
}

const PRESETS: { key: 'nominal' | 'cloudburst' | 'drought' | 'monsoon_peak'; label: string; desc: string; icon: string }[] = [
  {
    key: 'nominal',
    label: 'Nominal Baseline',
    desc: 'Moderate rain, stable slopes, normal water supply',
    icon: '🍃',
  },
  {
    key: 'cloudburst',
    label: 'Cloudburst Storm',
    desc: 'Extreme rain (>90mm) triggering flood & landslide cascade',
    icon: '⚡',
  },
  {
    key: 'monsoon_peak',
    label: 'Monsoon High',
    desc: 'High antecedent rain with saturated soil and swollen streams',
    icon: '🌧️',
  },
  {
    key: 'drought',
    label: 'Summer Drought',
    desc: 'Zero rainfall, high heat (>34°C), severe drinking water stress',
    icon: '☀️',
  },
]

export default function TelemetryConsole({ activePreset, onPresetApplied }: TelemetryConsoleProps) {
  const [loading, setLoading] = useState(false)

  const handleSelect = async (preset: 'nominal' | 'cloudburst' | 'drought' | 'monsoon_peak') => {
    setLoading(true)
    try {
      await applySimulationPreset(preset)
      onPresetApplied()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            🛰️ ESP32 Telemetry & Multi-Hazard Weather Simulator
          </span>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Select an atmospheric scenario to inject real-time sensor streams (hyetometer intensity, soil moisture FDR, ultrasonic depth)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Active State:</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 4,
              background: activePreset === 'cloudburst' ? '#fee2e2' : activePreset === 'drought' ? '#fef3c7' : '#e0f2fe',
              color: activePreset === 'cloudburst' ? '#991b1b' : activePreset === 'drought' ? '#92400e' : '#0369a1',
            }}
          >
            {activePreset.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        {PRESETS.map((p) => {
          const isActive = activePreset === p.key
          return (
            <button
              key={p.key}
              onClick={() => handleSelect(p.key)}
              disabled={loading}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 6,
                border: isActive ? '2px solid #0284c7' : '1px solid #e2e8f0',
                background: isActive ? '#f0f9ff' : '#f8fafc',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: isActive ? '#0369a1' : '#1e293b' }}>
                  {p.label}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{p.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
