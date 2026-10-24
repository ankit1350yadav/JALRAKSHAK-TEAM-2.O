import React from 'react'
import './Page.css'

export default function Methodology() {
  return (
    <div className="page">
      <h1 className="page__title">Methodology &amp; Multi-Hazard Formulations</h1>

      {/* Full prototype disclaimer */}
      <div
        role="note"
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: 15, color: '#991b1b', marginBottom: 8 }}>
          ⚠️ Full Prototype Disclaimer
        </h2>
        <p style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.7 }}>
          <strong>JalRakshak 2.0 is an educational multi-hazard decision-support prototype.</strong> AI and physics-based models evaluate synthetic demonstration datasets and must not be interpreted as certified hydrological forecasts, official flood inundation maps, or geotechnical slope-stability certifications.
        </p>
      </div>

      <div className="card">
        <h2 className="card__heading">1. Multi-Hazard Architecture &amp; Synthesis Formulation</h2>
        <p style={{ marginTop: 8, color: '#475569', lineHeight: 1.7 }}>
          JalRakshak 2.0 unifies three distinct mountain peril models into a single composite vulnerability index with cascading chain awareness:
        </p>

        <div
          style={{
            margin: '16px 0',
            padding: '14px 18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#0f172a',
          }}
        >
          Composite Index = (0.35 × WaterStress) + (0.35 × FloodRisk) + (0.30 × LandslideRisk) + CascadePenalty
        </div>

        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          <strong>Cascading Trigger Rule:</strong> When high rainfall intensity triggers both Flash Flood (&gt;60) and Landslide Susceptibility (&gt;60), an emergent <em>Cascade Trigger</em> (+12 penalty) is activated. In mountainous terrains, debris flows often physically sever or silt-choke valley river taps and springs, transforming a meteorological deluge into an acute drinking water supply crisis.
        </p>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="card__heading">2. Individual Peril Physical Formulations</h2>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0369a1', margin: '0 0 6px' }}>
              💧 Water Stress (Drought) Peril Model
            </h3>
            <p style={{ fontSize: 12.5, color: '#334155', margin: 0, lineHeight: 1.6 }}>
              Governed by spring discharge decay (LPM), static water table elevation (m), ambient temperature (&gt;28°C evaporative demand), and population demand (60 L/capita/day). Evaluated via Random Forest ensemble.
            </p>
          </div>

          <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#15803d', margin: '0 0 6px' }}>
              🌊 Flash Flood Inundation Peril Model
            </h3>
            <p style={{ fontSize: 12.5, color: '#334155', margin: 0, lineHeight: 1.6 }}>
              Driven by peak hyetometer rainfall intensity (&gt;50 mm/hr cloudburst threshold), low-infiltration alluvial valley soils, stream proximity buffer (&lt;120 m), and upstream catchment flow accumulation.
            </p>
          </div>

          <div style={{ padding: 12, background: '#fff7ed', borderRadius: 6, border: '1px solid #fed7aa' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', margin: '0 0 6px' }}>
              ⛰️ Landslide / Slope Failure Peril Model
            </h3>
            <p style={{ fontSize: 12.5, color: '#334155', margin: 0, lineHeight: 1.6 }}>
              Synthesizes infinite slope geotechnical equilibrium: terrain slope angle (&gt;28°), soil moisture pore-water saturation (&gt;75%), 72-hour antecedent rainfall accumulation, and fractured shale lithology.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="card__heading">3. ESP32 Sensor Telemetry Specifications</h2>
        <p style={{ marginTop: 8, color: '#475569', lineHeight: 1.7 }}>
          The platform ingests real-time and simulated telemetry payloads from mountain sensor stations:
        </p>

        <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
          <li><strong>Rainfall Hyetometer:</strong> 0.2 mm tipping bucket measuring continuous peak intensity (mm/hr).</li>
          <li><strong>Soil Moisture Array:</strong> Frequency-Domain Reflectometry (FDR) probes measuring Volumetric Water Content (VWC %) at 15 cm and 45 cm.</li>
          <li><strong>Ultrasonic Reservoir Gauge:</strong> 24 GHz FMCW radar transducer monitoring water depth in meters.</li>
          <li><strong>IoT Gateway:</strong> ESP32 MCU transmitting via LoRaWAN / cellular with solar battery backup.</li>
        </ul>
      </div>
    </div>
  )
}
