import React, { useState, useEffect } from 'react'
import { getOperatingMode, setOperatingMode, SystemOperatingMode } from '../api'
import { store } from '../api/store'
import './Header.css'

export default function Header() {
  const [mode, setMode] = useState<SystemOperatingMode>('SIMULATION')
  const [hardwareConnected, setHardwareConnected] = useState(false)

  const refreshMode = () => {
    getOperatingMode().then((res) => {
      setMode(res.data.mode)
      setHardwareConnected(res.data.hardware_connected)
    })
  }

  useEffect(() => {
    refreshMode()
    const unsubscribe = store.subscribe(() => {
      refreshMode()
    })
    return () => unsubscribe()
  }, [])

  const handleToggle = async () => {
    const nextMode: SystemOperatingMode = mode === 'REAL' || mode === 'REAL_SENSOR' ? 'SIMULATION' : 'REAL'
    await setOperatingMode(nextMode)
    setMode(nextMode)
    refreshMode()
  }

  const isReal = mode === 'REAL' || mode === 'REAL_SENSOR'

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">🏔️💧</span>
        <div className="header__titles">
          <span className="header__name">JalRakshak 2.0</span>
          <span className="header__subtitle">
            Multi-Hazard Mountain Risk Intelligence (Water Stress • Flash Flood • Landslide)
          </span>
        </div>
      </div>

      <div className="header__badges" style={{ alignItems: 'center' }}>
        {/* Mode Indicator & Quick Switcher */}
        <button
          onClick={handleToggle}
          title="Click to toggle between REAL SENSOR MODE and SIMULATION MODE"
          style={{
            background: isReal
              ? hardwareConnected
                ? '#064e3b'
                : '#7f1d1d'
              : '#78350f',
            border: isReal
              ? hardwareConnected
                ? '1px solid #10b981'
                : '1px solid #ef4444'
              : '1px solid #f59e0b',
            color: '#ffffff',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <span>{isReal ? (hardwareConnected ? '📡' : '🔌') : '🧪'}</span>
          <span>
            {isReal
              ? hardwareConnected
                ? 'REAL MODE: JR-NODE-01 LIVE'
                : 'REAL MODE: HARDWARE DISCONNECTED'
              : 'SIMULATION MODE (DEMO)'}
          </span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>[Switch]</span>
        </button>

        <span className="header__badge" style={{ background: '#0284c7', borderColor: '#38bdf8' }}>
          ESP32 IoT v2
        </span>
        <span className="header__badge header__badge--proto">Prototype 2.0</span>
      </div>
    </header>
  )
}
