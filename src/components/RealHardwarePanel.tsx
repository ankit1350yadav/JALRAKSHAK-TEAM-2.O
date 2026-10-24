import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  RealHardwareStatus,
  ESP32TelemetryPayload,
  postTelemetry,
  disconnectRealHardware,
  getTelemetryHistory,
  getNodeDiagnostics,
  NodeDiagnostics,
} from '../api'

interface RealHardwarePanelProps {
  hardware: RealHardwareStatus
  onTelemetryUpdated: () => void
}

const SAMPLE_ESP32_PACKET: ESP32TelemetryPayload = {
  node_id: 'JR-NODE-01',
  timestamp: new Date().toISOString(),
  water_level_cm: 184.5,
  water_rise_rate: 3.2,
  rainfall_mm: 28.4,
  rainfall_intensity: 22.5,
  soil_moisture_1: 67.8,
  soil_moisture_2: 63.5,
  temperature_c: 20.8,
  humidity_pct: 78.4,
  pressure_hpa: 1011.8,
  battery_level: 89,
}

type HistoryRange = 'latest' | '1h' | '6h' | '24h' | 'all'

export default function RealHardwarePanel({
  hardware,
  onTelemetryUpdated,
}: RealHardwarePanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [showFirmwareSnippet, setShowFirmwareSnippet] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showTestForm, setShowTestForm] = useState(false)
  const [testForm, setTestForm] = useState<ESP32TelemetryPayload>(SAMPLE_ESP32_PACKET)
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null)

  // Historical telemetry state
  const [selectedRange, setSelectedRange] = useState<HistoryRange>('all')
  const [historyRecords, setHistoryRecords] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<NodeDiagnostics | null>(null)

  const status = hardware.status || (hardware.is_connected ? 'CONNECTED' : 'DISCONNECTED')
  const isConnected = status === 'CONNECTED'
  const isStale = status === 'STALE'
  const isDisconnected = status === 'DISCONNECTED'
  const hasReadings = hardware.latest_telemetry !== null
  const telemetry = hardware.latest_telemetry
  const risks = hardware.computed_risks

  // Load history whenever range or hardware updates
  useEffect(() => {
    loadHistory(selectedRange)
  }, [selectedRange, hardware.last_heartbeat_at, hardware.packets_received_count])

  // Load diagnostics when drawer is opened
  useEffect(() => {
    if (showDiagnostics) {
      loadDiagnosticsData()
    }
  }, [showDiagnostics, hardware.last_heartbeat_at])

  const loadHistory = async (range: HistoryRange) => {
    setHistoryLoading(true)
    try {
      const res = await getTelemetryHistory({
        node_id: hardware.node_id,
        range: range === 'latest' ? 'all' : range,
      })
      const recs = res.data?.records || []
      if (range === 'latest') {
        setHistoryRecords(recs.slice(0, 1))
      } else {
        setHistoryRecords(recs)
      }
    } catch {
      setHistoryRecords(hardware.telemetry_history || [])
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadDiagnosticsData = async () => {
    try {
      const res = await getNodeDiagnostics()
      setDiagnostics(res.data)
    } catch {
      // ignore
    }
  }

  const handleSendPacket = async (packetToSend: ESP32TelemetryPayload) => {
    setSubmitting(true)
    setStatusMsg(null)
    try {
      const payload = {
        ...packetToSend,
        timestamp: new Date().toISOString(),
      }
      const res = await postTelemetry(payload)
      setStatusMsg({
        text: `✓ Telemetry accepted: ${res.data.status || 'OK'} (Data Quality: REAL, Node: ${payload.node_id})`,
        isError: false,
      })
      onTelemetryUpdated()
      setShowTestForm(false)
      loadHistory(selectedRange)
    } catch (err: any) {
      setStatusMsg({
        text: `✕ Failed to post telemetry: ${err?.message || 'Network error'}`,
        isError: true,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisconnect = async () => {
    setSubmitting(true)
    try {
      await disconnectRealHardware()
      setStatusMsg({
        text: 'Hardware node disconnected. Telemetry stream stopped.',
        isError: false,
      })
      onTelemetryUpdated()
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = () => {
    if (isConnected) {
      return {
        bg: '#dcfce7',
        color: '#15803d',
        border: '1px solid #86efac',
        label: '● CONNECTED (Active Stream)',
        description: 'Node is transmitting regular heartbeats (< 60s timeout).',
      }
    }
    if (isStale) {
      return {
        bg: '#fef3c7',
        color: '#b45309',
        border: '1px solid #fcd34d',
        label: '⚠️ STALE DATA (Timeout > 60s)',
        description: `Last telemetry was received > ${hardware.stale_timeout_sec || 60} seconds ago. Sensor stream may be interrupted.`,
      }
    }
    return {
      bg: '#fee2e2',
      color: '#b91c1c',
      border: '1px solid #fca5a5',
      label: '○ DISCONNECTED (Awaiting Signal)',
      description: 'No active connection. Ingestion pipeline is waiting for initial ESP32 HTTP packet.',
    }
  }

  const badge = getStatusBadge()

  // Chart data formatting (oldest to newest for charting)
  const chartData = [...historyRecords].reverse().map((r) => ({
    time: new Date(r.timestamp || r.recorded_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    'Water Level (cm)': r.water_level_cm,
    'Rainfall (mm)': r.rainfall_mm,
    'Rain Intensity (mm/h)': r.rainfall_intensity,
    'Soil Moisture 1 (%)': r.soil_moisture_1,
    'Battery (%)': r.battery_level,
  }))

  const curlSnippet = `curl -X POST http://0.0.0.0:3000/api/telemetry \\
  -H "Content-Type: application/json" \\
  -d '{
    "node_id": "JR-NODE-01",
    "timestamp": "${new Date().toISOString()}",
    "water_level_cm": 184.5,
    "water_rise_rate": 3.2,
    "rainfall_mm": 28.4,
    "rainfall_intensity": 22.5,
    "soil_moisture_1": 67.8,
    "soil_moisture_2": 63.5,
    "temperature_c": 20.8,
    "humidity_pct": 78.4,
    "pressure_hpa": 1011.8,
    "battery_level": 89
  }'`

  const arduinoSnippet = `// ESP32 Arduino C++ Telemetry Transmitter (JalRakshak 2.0)
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/telemetry";

void sendTelemetry() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["node_id"] = "JR-NODE-01";
    doc["water_level_cm"] = readUltrasonicDepth();
    doc["water_rise_rate"] = calculateRiseVelocity();
    doc["rainfall_mm"] = readTippingBucket();
    doc["rainfall_intensity"] = calculateRainfallIntensity();
    doc["soil_moisture_1"] = readSoilSensor1();
    doc["soil_moisture_2"] = readSoilSensor2();
    doc["temperature_c"] = readDHTTemperature();
    doc["humidity_pct"] = readDHTHumidity();
    doc["pressure_hpa"] = readBMPPressure();
    doc["battery_level"] = readBatteryPercentage();

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    http.end();
  }
}`

  return (
    <div
      style={{
        background: '#ffffff',
        border: '2px solid #0284c7',
        borderRadius: 10,
        padding: '20px',
        marginBottom: 24,
        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)',
      }}
    >
      {/* ── 1. Header & Node Information ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 14,
          paddingBottom: 16,
          borderBottom: '1px solid #e2e8f0',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🛰️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Node: {hardware.node_id} ({hardware.node_name || 'Katra Sensor Station'})
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: badge.bg,
                  color: badge.color,
                  border: badge.border,
                }}
              >
                {badge.label}
              </span>
            </div>

            {/* Node Metadata Row */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                fontSize: 12,
                color: '#475569',
                marginTop: 6,
              }}
            >
              <span>
                <strong>Village:</strong> {hardware.village_name || 'Katra'} (ID: {hardware.village_id || 1})
              </span>
              <span>
                <strong>Coordinates:</strong> {hardware.latitude?.toFixed(4) || '32.9934'}° N,{' '}
                {hardware.longitude?.toFixed(4) || '74.9317'}° E
              </span>
              <span>
                <strong>Elevation:</strong> {hardware.elevation_m || 875} m
              </span>
              <span>
                <strong>Firmware:</strong> {hardware.firmware_version || 'v2.1-ESP32-FIELD'}
              </span>
              <span>
                <strong>Timeout Rule:</strong> {hardware.stale_timeout_sec || 60}s stale cutoff
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: showDiagnostics ? '#0f172a' : '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              color: showDiagnostics ? '#ffffff' : '#334155',
              cursor: 'pointer',
            }}
          >
            {showDiagnostics ? 'Hide Diagnostics' : '🔍 Diagnostics'}
          </button>

          <button
            onClick={() => setShowFirmwareSnippet(!showFirmwareSnippet)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            {showFirmwareSnippet ? 'Hide Specs' : '⚙️ API & Firmware Specs'}
          </button>

          <button
            onClick={() => setShowTestForm(!showTestForm)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: '#e0f2fe',
              border: '1px solid #7dd3fc',
              borderRadius: 6,
              color: '#0369a1',
              cursor: 'pointer',
            }}
          >
            {showTestForm ? 'Close Test Tool' : '⚡ Push ESP32 Packet'}
          </button>

          {(isConnected || isStale) && (
            <button
              onClick={handleDisconnect}
              disabled={submitting}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 6,
                color: '#991b1b',
                cursor: 'pointer',
              }}
            >
              🔌 Disconnect Node
            </button>
          )}
        </div>
      </div>

      {/* Notification banner */}
      {statusMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            background: statusMsg.isError ? '#fee2e2' : '#f0fdf4',
            color: statusMsg.isError ? '#991b1b' : '#166534',
            fontSize: 12.5,
            marginBottom: 16,
            border: statusMsg.isError ? '1px solid #fca5a5' : '1px solid #bbf7d0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Diagnostics Drawer ── */}
      {showDiagnostics && (
        <div
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            borderRadius: 8,
            padding: '16px',
            marginBottom: 20,
            fontSize: 12,
            border: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: 13 }}>
              🛠️ Hardware Ingestion Diagnostics &amp; Developer Telemetry State
            </span>
            <button
              onClick={loadDiagnosticsData}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#cbd5e1',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ↻ Refresh Diagnostics
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: 6 }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Packets Ingested Count</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>
                {hardware.packets_received_count}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: 6 }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Last Heartbeat Received</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                {hardware.last_heartbeat_at ? new Date(hardware.last_heartbeat_at).toLocaleTimeString() : 'None'}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: 6 }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Hardware Connection State</div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isConnected ? '#4ade80' : isStale ? '#facc15' : '#f87171',
                }}
              >
                {status} ({badge.description})
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: '10px', borderRadius: 6 }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Stale Threshold Window</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                {hardware.stale_timeout_sec || 60} seconds
              </div>
            </div>
          </div>

          {diagnostics?.last_validation_error && (
            <div
              style={{
                background: '#450a0a',
                border: '1px solid #b91c1c',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              <strong>Last Validation Error:</strong> [{diagnostics.last_validation_error.error_code}] {diagnostics.last_validation_error.message} {diagnostics.last_validation_error.field ? `(field: ${diagnostics.last_validation_error.field}, received: ${JSON.stringify(diagnostics.last_validation_error.invalid_value)})` : ''}
            </div>
          )}

          {diagnostics?.last_api_response && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              <strong>Last API Response:</strong> HTTP {diagnostics.last_api_response.status} —{' '}
              {diagnostics.last_api_response.message} (Timestamp: {diagnostics.last_api_response.timestamp})
            </div>
          )}
        </div>
      )}

      {/* ── API / Firmware Specs Accordion ── */}
      {showFirmwareSnippet && (
        <div
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            borderRadius: 8,
            padding: '16px',
            marginBottom: 20,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#38bdf8' }}>
            ESP32 HTTP POST Integration Specification:
          </div>
          <div style={{ marginBottom: 12 }}>
            <strong>Ingestion Endpoint:</strong> <code style={{ color: '#fef08a' }}>POST /api/telemetry</code>
            <br />
            <strong>Content-Type:</strong> <code style={{ color: '#fef08a' }}>application/json</code>
            <br />
            <strong>Contract:</strong> Accepts 12 core sensor parameters. Range checks enforced for all physical measurements.
          </div>

          <div style={{ marginBottom: 10 }}>
            <strong>Sample cURL Command:</strong>
            <pre
              style={{
                background: '#1e293b',
                padding: '10px',
                borderRadius: 6,
                overflowX: 'auto',
                fontSize: 11,
                marginTop: 4,
                color: '#e2e8f0',
              }}
            >
              {curlSnippet}
            </pre>
          </div>

          <div>
            <strong>ESP32 Arduino C++ Code:</strong>
            <pre
              style={{
                background: '#1e293b',
                padding: '10px',
                borderRadius: 6,
                overflowX: 'auto',
                fontSize: 11,
                marginTop: 4,
                color: '#e2e8f0',
              }}
            >
              {arduinoSnippet}
            </pre>
          </div>
        </div>
      )}

      {/* ── Test Packet Transmission Tool ── */}
      {showTestForm && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '16px',
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 12, color: '#0f172a' }}>
            ⚡ Transmit Field Telemetry Packet (Hardware Integration Test)
          </h3>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            Test the live telemetry ingestion pipeline without physical hardware. Enter custom sensor readings or use defaults.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Water Level (cm) [0-2500]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.water_level_cm ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, water_level_cm: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Water Rise Rate (cm/hr) [-300 to +300]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.water_rise_rate ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, water_rise_rate: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Rainfall (mm) [0-1200]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.rainfall_mm ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, rainfall_mm: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Rain Intensity (mm/hr) [0-600]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.rainfall_intensity ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, rainfall_intensity: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Soil Moisture 1 (% VWC) [0-100]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.soil_moisture_1 ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, soil_moisture_1: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Soil Moisture 2 (% VWC) [0-100]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.soil_moisture_2 ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, soil_moisture_2: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Temperature (°C) [-40 to +65]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.temperature_c ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, temperature_c: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Humidity (%) [0-100]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.humidity_pct ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, humidity_pct: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Pressure (hPa) [300-1250]
              </label>
              <input
                type="number"
                step="0.1"
                value={testForm.pressure_hpa ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, pressure_hpa: e.target.value === '' ? (null as any) : parseFloat(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                Battery Level (%) [0-100]
              </label>
              <input
                type="number"
                value={testForm.battery_level ?? ''}
                onChange={(e) =>
                  setTestForm({ ...testForm, battery_level: e.target.value === '' ? (null as any) : parseInt(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSendPacket(testForm)}
              disabled={submitting}
              style={{
                padding: '8px 18px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Transmitting…' : '🚀 Send ESP32 Packet Now'}
            </button>

            <button
              onClick={() => setTestForm(SAMPLE_ESP32_PACKET)}
              style={{
                padding: '8px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: 13,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* ── Disconnected State View ── */}
      {isDisconnected && !hasReadings ? (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 8,
            padding: '24px 20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔌</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#9f1239', margin: '0 0 6px' }}>
            No Signal from Field Node {hardware.node_id}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: '#881337',
              maxWidth: 620,
              margin: '0 auto 16px',
              lineHeight: 1.5,
            }}
          >
            Real Sensor Mode is waiting for incoming telemetry packets. Simulated readings are strictly disabled in this mode to preserve scientific data integrity. Once hardware is powered on, packets transmitted to <code style={{ background: '#ffe4e6', padding: '1px 6px', borderRadius: 4 }}>POST /api/telemetry</code> will automatically connect the node.
          </p>

          <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => handleSendPacket(SAMPLE_ESP32_PACKET)}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚡</span>
              <span>Send Sample ESP32 Telemetry Packet</span>
            </button>

            <button
              onClick={() => setShowFirmwareSnippet(true)}
              style={{
                padding: '10px 18px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              View Ingestion Contract &amp; cURL
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Status Subtitle bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: isStale ? '#fffbeb' : '#f0fdf4',
              border: isStale ? '1px solid #fde68a' : '1px solid #dcfce7',
            }}
          >
            <div style={{ fontSize: 13, color: '#334155' }}>
              <strong>Packets Ingested:</strong> {hardware.packets_received_count} &nbsp;|&nbsp;
              <strong>Last Heartbeat:</strong>{' '}
              {hardware.last_heartbeat_at ? new Date(hardware.last_heartbeat_at).toLocaleTimeString() : 'N/A'}{' '}
              &nbsp;|&nbsp;
              <strong style={{ color: isStale ? '#b45309' : '#059669' }}>
                Status: {status} ({isStale ? '>60s without heartbeat' : 'Real-time telemetry stream'})
              </strong>
            </div>

            <button
              onClick={() => setShowJson(!showJson)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {showJson ? 'Hide Raw JSON' : 'Inspect Raw Packet JSON'}
            </button>
          </div>

          {/* ── 4 Grouped Sensor Readings ── */}
          <div style={{ marginBottom: 20 }}>
            {/* Group 1: Water Sensors */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8, textTransform: 'uppercase' }}>
                💧 Hydrological &amp; River Stage Gauges
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Water Level"
                  value={telemetry?.water_level_cm !== null && telemetry?.water_level_cm !== undefined ? `${telemetry.water_level_cm} cm` : 'N/A'}
                  sub="Ultrasonic depth probe"
                  color="#0284c7"
                  icon="💧"
                />
                <MetricCard
                  label="Water Rise Rate"
                  value={telemetry?.water_rise_rate !== null && telemetry?.water_rise_rate !== undefined ? `${telemetry.water_rise_rate} cm/hr` : 'N/A'}
                  sub="Stage velocity"
                  color={Number(telemetry?.water_rise_rate ?? 0) > 5 ? '#dc2626' : '#0284c7'}
                  icon="📈"
                />
              </div>
            </div>

            {/* Group 2: Weather Sensors */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', marginBottom: 8, textTransform: 'uppercase' }}>
                🌦️ Meteorological Station Telemetry
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Cumulative Rainfall (24h)"
                  value={telemetry?.rainfall_mm !== null && telemetry?.rainfall_mm !== undefined ? `${telemetry.rainfall_mm} mm` : 'N/A'}
                  sub="Tipping bucket gauge"
                  color="#0284c7"
                  icon="🌧️"
                />
                <MetricCard
                  label="Rainfall Intensity"
                  value={telemetry?.rainfall_intensity !== null && telemetry?.rainfall_intensity !== undefined ? `${telemetry.rainfall_intensity} mm/hr` : 'N/A'}
                  sub="Peak precipitation rate"
                  color={Number(telemetry?.rainfall_intensity ?? 0) > 30 ? '#dc2626' : '#0284c7'}
                  icon="⚡"
                />
                <MetricCard
                  label="Ambient Temperature"
                  value={telemetry?.temperature_c !== null && telemetry?.temperature_c !== undefined ? `${telemetry.temperature_c} °C` : 'N/A'}
                  sub="DHT22 thermal probe"
                  color="#ea580c"
                  icon="🌡️"
                />
                <MetricCard
                  label="Relative Humidity"
                  value={telemetry?.humidity_pct !== null && telemetry?.humidity_pct !== undefined ? `${telemetry.humidity_pct} %` : 'N/A'}
                  sub="Ambient RH sensor"
                  color="#7c3aed"
                  icon="🌫️"
                />
                <MetricCard
                  label="Barometric Pressure"
                  value={telemetry?.pressure_hpa !== null && telemetry?.pressure_hpa !== undefined ? `${telemetry.pressure_hpa} hPa` : 'N/A'}
                  sub="BMP280 sensor"
                  color="#475569"
                  icon="🧭"
                />
              </div>
            </div>

            {/* Group 3: Geotechnical / Soil Sensors */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 8, textTransform: 'uppercase' }}>
                🌱 Slope &amp; Geotechnical Soil Probes
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Soil Moisture 1"
                  value={telemetry?.soil_moisture_1 !== null && telemetry?.soil_moisture_1 !== undefined ? `${telemetry.soil_moisture_1} %` : 'N/A'}
                  sub="Upper probe (10cm depth)"
                  color="#d97706"
                  icon="🌱"
                />
                <MetricCard
                  label="Soil Moisture 2"
                  value={telemetry?.soil_moisture_2 !== null && telemetry?.soil_moisture_2 !== undefined ? `${telemetry.soil_moisture_2} %` : 'N/A'}
                  sub="Deep probe (40cm depth)"
                  color="#d97706"
                  icon="🪴"
                />
                <MetricCard
                  label="Battery Reserve"
                  value={telemetry?.battery_level !== null && telemetry?.battery_level !== undefined ? `${telemetry.battery_level} %` : 'N/A'}
                  sub="Solar LiFePO4 pack"
                  color={Number(telemetry?.battery_level ?? 0) < 20 ? '#dc2626' : '#16a34a'}
                  icon="🔋"
                />
              </div>
            </div>
          </div>

          {/* Raw JSON Inspector */}
          {showJson && (
            <div
              style={{
                background: '#0f172a',
                color: '#34d399',
                borderRadius: 6,
                padding: '14px',
                fontSize: 11.5,
                fontFamily: 'monospace',
                overflowX: 'auto',
                marginBottom: 18,
              }}
            >
              <div style={{ color: '#94a3b8', marginBottom: 6 }}>
                // Raw Ingested Telemetry Packet ({hardware.node_id})
              </div>
              <pre style={{ margin: 0 }}>{JSON.stringify(telemetry, null, 2)}</pre>
            </div>
          )}

          {/* ── 2. Live Risk Assessment Pipeline Results ── */}
          {risks && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '16px',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    ⚡ Real-Time Multi-Hazard Risk Computation (Live Pipeline)
                  </h3>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    Ingested ESP32 telemetry immediately processed by JalRakshak 2.0 Risk Engines (Water Stress, Flash Flood, Landslide, Multi-Hazard).
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background:
                      risks.multi_hazard.category === 'CRITICAL'
                        ? '#dc2626'
                        : risks.multi_hazard.category === 'WARNING'
                        ? '#ea580c'
                        : risks.multi_hazard.category === 'WATCH'
                        ? '#eab308'
                        : '#16a34a',
                    color: '#ffffff',
                  }}
                >
                  OVERALL: {risks.multi_hazard.category} ({risks.multi_hazard.composite_score}/100)
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {/* Water Stress Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>Water Stress</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: risks.water_stress.level === 'high' ? '#fee2e2' : '#f0fdf4',
                        color: risks.water_stress.level === 'high' ? '#991b1b' : '#166534',
                      }}
                    >
                      {risks.water_stress.level}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', margin: '4px 0 2px' }}>
                    {risks.water_stress.score} <span style={{ fontSize: 12, fontWeight: 500 }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {risks.water_stress.factors[0] || 'Nominal municipal reserve'}
                  </div>
                </div>

                {/* Flood Risk Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>Flash Flood</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: risks.flood.level === 'high' ? '#fee2e2' : '#f0fdf4',
                        color: risks.flood.level === 'high' ? '#991b1b' : '#166534',
                      }}
                    >
                      {risks.flood.level}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0369a1', margin: '4px 0 2px' }}>
                    {risks.flood.score} <span style={{ fontSize: 12, fontWeight: 500 }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {risks.flood.factors[0] || 'Stage velocity baseline'}
                  </div>
                </div>

                {/* Landslide Risk Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>Landslide &amp; Slope</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: risks.landslide.level === 'high' ? '#fee2e2' : '#f0fdf4',
                        color: risks.landslide.level === 'high' ? '#991b1b' : '#166534',
                      }}
                    >
                      {risks.landslide.level}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', margin: '4px 0 2px' }}>
                    {risks.landslide.score} <span style={{ fontSize: 12, fontWeight: 500 }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {risks.landslide.factors[0] || 'Soil pore saturation within limits'}
                  </div>
                </div>

                {/* Multi-Hazard Composite Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>Composite Risk</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: risks.multi_hazard.cascade_triggered ? '#fef3c7' : '#f1f5f9',
                        color: risks.multi_hazard.cascade_triggered ? '#b45309' : '#475569',
                      }}
                    >
                      {risks.multi_hazard.cascade_triggered ? '⚡ Cascade Triggered' : 'Normal Interaction'}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', margin: '4px 0 2px' }}>
                    {risks.multi_hazard.composite_score} <span style={{ fontSize: 12, fontWeight: 500 }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Primary: <strong>{risks.multi_hazard.dominant_hazard}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Sensor History & Range Filter Section ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px',
              marginTop: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  📈 Telemetry Trends &amp; Sensor History
                </h3>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Filterable historical records for {hardware.node_id} ({historyRecords.length} records available).
                </div>
              </div>

              {/* Range Toggle Buttons */}
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: '3px', borderRadius: 6 }}>
                {(['latest', '1h', '6h', '24h', 'all'] as HistoryRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRange(r)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: 'none',
                      fontSize: 11.5,
                      fontWeight: selectedRange === r ? 700 : 500,
                      background: selectedRange === r ? '#0284c7' : 'transparent',
                      color: selectedRange === r ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {r === 'latest'
                      ? 'Last reading'
                      : r === '1h'
                      ? 'Last 1h'
                      : r === '6h'
                      ? 'Last 6h'
                      : r === '24h'
                      ? 'Last 24h'
                      : 'Historical (All)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Historical Visualization */}
            {chartData.length > 1 ? (
              <div style={{ height: 240, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="Water Level (cm)"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Rain Intensity (mm/h)"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Soil Moisture 1 (%)"
                      stroke="#d97706"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : chartData.length === 1 ? (
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#64748b',
                  marginBottom: 14,
                }}
              >
                1 packet recorded. Push more packets to view multi-point historical trend charts.
              </div>
            ) : (
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#64748b',
                  marginBottom: 14,
                }}
              >
                No historical records in the selected range ({selectedRange}).
              </div>
            )}

            {/* Historical Readings Table */}
            {historyRecords.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 11.5,
                    color: '#334155',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Timestamp</th>
                      <th style={{ padding: '8px' }}>Water Level</th>
                      <th style={{ padding: '8px' }}>Rise Rate</th>
                      <th style={{ padding: '8px' }}>Rainfall 24h</th>
                      <th style={{ padding: '8px' }}>Rain Intensity</th>
                      <th style={{ padding: '8px' }}>Soil M1</th>
                      <th style={{ padding: '8px' }}>Temp</th>
                      <th style={{ padding: '8px' }}>Battery</th>
                      <th style={{ padding: '8px' }}>Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>
                          {new Date(r.timestamp || r.recorded_at).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '8px' }}>{r.water_level_cm !== null ? `${r.water_level_cm} cm` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.water_rise_rate !== null ? `${r.water_rise_rate} cm/h` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.rainfall_mm !== null ? `${r.rainfall_mm} mm` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.rainfall_intensity !== null ? `${r.rainfall_intensity} mm/h` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.soil_moisture_1 !== null ? `${r.soil_moisture_1}%` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.temperature_c !== null ? `${r.temperature_c}°C` : '—'}</td>
                        <td style={{ padding: '8px' }}>{r.battery_level !== null ? `${r.battery_level}%` : '—'}</td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 10,
                            }}
                          >
                            REAL
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub: string
  color: string
  icon: string
}) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 14px',
        borderTop: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 14 }}>{icon}</span>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color,
          margin: '4px 0 2px',
          fontFamily: 'monospace',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{sub}</div>
    </div>
  )
}
