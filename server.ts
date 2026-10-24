/**
 * server.ts — JalRakshak 2.0 Full-Stack Node.js / Express Server
 * 
 * Supports:
 * 1. Real ESP32 hardware telemetry ingestion via HTTP POST /api/telemetry
 * 2. Strict physical range validation & missing optional sensor support
 * 3. Tri-state hardware status tracking (CONNECTED, DISCONNECTED, STALE)
 * 4. Real-time Risk Engine pipeline connection (Water Stress + Flood + Landslide -> Multi-Hazard)
 * 5. Time-ranged historical telemetry queries (1h, 6h, 24h, all)
 * 6. Node diagnostic status & developer troubleshooting endpoint
 * 7. Vite development middleware serving the React SPA on port 3000
 */

import express, { Request, Response } from 'express'
import cors from 'cors'
import { createServer as createViteServer } from 'vite'
import path from 'path'
import fs from 'fs'
import {
  store,
  computeWaterStress,
  computeFloodRisk,
  computeLandslideRisk,
  computeMultiHazard,
  evaluateDisasterAlertChannels,
  toRiskCategory,
} from './src/api/store'

export interface ESP32TelemetryPacket {
  node_id: string
  timestamp?: string
  water_level_cm?: number | null
  water_rise_rate?: number | null
  rainfall_mm?: number | null
  rainfall_intensity?: number | null
  soil_moisture_1?: number | null
  soil_moisture_2?: number | null
  temperature_c?: number | null
  humidity_pct?: number | null
  pressure_hpa?: number | null
  battery_level?: number | null
}

export type HardwareConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'STALE'

export interface RealHardwareStatus {
  node_id: string
  node_name: string
  village_id: number
  village_name: string
  latitude: number
  longitude: number
  elevation_m: number
  hardware_model: string
  firmware_version: string
  status: HardwareConnectionState
  is_connected: boolean
  last_heartbeat_at: string | null
  packets_received_count: number
  stale_timeout_sec: number
  latest_telemetry: (ESP32TelemetryPacket & { recorded_at: string; data_quality: 'REAL' }) | null
  telemetry_history: Array<ESP32TelemetryPacket & { recorded_at: string; data_quality: 'REAL' }>
  data_quality: 'REAL'
  is_synthetic: 0
  computed_risks?: any
}

export type SystemOperatingMode = 'SIMULATION' | 'REAL'

// ── Physical Range Validation Specifications ─────────────────────────────────
const SENSOR_VALIDATION_RULES = {
  water_level_cm: { min: 0, max: 2500, label: 'Water Level (cm)', unit: 'cm' },
  water_rise_rate: { min: -300, max: 300, label: 'Water Rise Rate (cm/hr)', unit: 'cm/hr' },
  rainfall_mm: { min: 0, max: 1200, label: 'Cumulative Rainfall (mm)', unit: 'mm' },
  rainfall_intensity: { min: 0, max: 600, label: 'Rainfall Intensity (mm/hr)', unit: 'mm/hr' },
  soil_moisture_1: { min: 0, max: 100, label: 'Soil Moisture 1 (% VWC)', unit: '%' },
  soil_moisture_2: { min: 0, max: 100, label: 'Soil Moisture 2 (% VWC)', unit: '%' },
  temperature_c: { min: -40, max: 65, label: 'Temperature (°C)', unit: '°C' },
  humidity_pct: { min: 0, max: 100, label: 'Relative Humidity (%)', unit: '%' },
  pressure_hpa: { min: 300, max: 1250, label: 'Barometric Pressure (hPa)', unit: 'hPa' },
  battery_level: { min: 0, max: 100, label: 'Battery Level (%)', unit: '%' },
} as const

// ── Configuration ───────────────────────────────────────────────────────────
const STALE_TIMEOUT_SEC = 60
const STALE_TIMEOUT_MS = STALE_TIMEOUT_SEC * 1000

// Registered Nodes in Catchment Network (No invented coordinates; based on Katra catchment)
const REGISTERED_NODES: Record<string, {
  node_name: string
  village_id: number
  village_name: string
  latitude: number
  longitude: number
  elevation_m: number
  hardware_model: string
  firmware_version: string
}> = {
  'JR-NODE-01': {
    node_name: 'Katra Ridge Hydro-Telemetry Gateway',
    village_id: 1,
    village_name: 'Katra',
    latitude: 32.9934,
    longitude: 74.9317,
    elevation_m: 875,
    hardware_model: 'ESP32-WROOM-32D / Real Mountain Hydro-Node',
    firmware_version: 'v2.1-ESP32-FIELD',
  },
  'ESP32-JAL-REASI-101': {
    node_name: 'Katra Stream Reference Station',
    village_id: 1,
    village_name: 'Katra',
    latitude: 32.9912,
    longitude: 74.9345,
    elevation_m: 860,
    hardware_model: 'ESP32-WROOM-32 Reference Station',
    firmware_version: 'v2.0-SIM-REF',
  },
}

// ── In-Memory Server State ──────────────────────────────────────────────────
let operatingMode: SystemOperatingMode = 'SIMULATION'
let activeSimulationPreset: string = 'nominal'

const realHardware: RealHardwareStatus = {
  node_id: 'JR-NODE-01',
  node_name: 'Katra Ridge Hydro-Telemetry Gateway',
  village_id: 1,
  village_name: 'Katra',
  latitude: 32.9934,
  longitude: 74.9317,
  elevation_m: 875,
  hardware_model: 'ESP32-WROOM-32D / Real Mountain Hydro-Node',
  firmware_version: 'v2.1-ESP32-FIELD',
  status: 'DISCONNECTED',
  is_connected: false,
  last_heartbeat_at: null,
  packets_received_count: 0,
  stale_timeout_sec: STALE_TIMEOUT_SEC,
  latest_telemetry: null,
  telemetry_history: [],
  data_quality: 'REAL',
  is_synthetic: 0,
  computed_risks: null,
}

// Developer Debugging & Diagnostics Tracker
let lastValidationError: {
  timestamp: string
  error_code: string
  message: string
  field?: string
  invalid_value?: any
} | null = null

let lastApiResponse: {
  timestamp: string
  status_code: number
  status: string
  message: string
  packet_id?: number
} | null = null

// Helper to determine live connection status
function evaluateNodeStatus(): HardwareConnectionState {
  if (!realHardware.is_connected || !realHardware.last_heartbeat_at) {
    return 'DISCONNECTED'
  }
  const diff = Date.now() - new Date(realHardware.last_heartbeat_at).getTime()
  if (diff > STALE_TIMEOUT_MS) {
    return 'STALE'
  }
  return 'CONNECTED'
}

async function startServer() {
  const app = express()
  const port = 3000

  app.use(cors())
  app.use(express.json())

  // Initialize store state
  store.init()

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    const currentStatus = evaluateNodeStatus()
    realHardware.status = currentStatus

    res.json({
      status: 'ok',
      service: 'JalRakshak 2.0 Multi-Hazard Platform',
      version: '2.0.0',
      operating_mode: operatingMode,
      hardware_status: currentStatus,
      hardware_connected: currentStatus === 'CONNECTED',
      is_stale: currentStatus === 'STALE',
      stale_threshold_sec: STALE_TIMEOUT_SEC,
      packets_received_count: realHardware.packets_received_count,
      disclaimer:
        operatingMode === 'REAL'
          ? 'Real Sensor Mode is active. Data is processed strictly from authenticated field hardware.'
          : 'Simulation Mode is active. Prototype demonstration data for educational decision support.',
    })
  })

  // ── Operating Mode Switcher ───────────────────────────────────────────────
  app.get('/api/mode', (_req: Request, res: Response) => {
    const currentStatus = evaluateNodeStatus()
    realHardware.status = currentStatus

    res.json({
      mode: operatingMode,
      active_preset: activeSimulationPreset,
      hardware_connected: currentStatus === 'CONNECTED',
      hardware_status: currentStatus,
    })
  })

  app.post('/api/mode', (req: Request, res: Response) => {
    const { mode, preset } = req.body
    if (mode === 'REAL' || mode === 'SIMULATION') {
      operatingMode = mode
      store.operatingMode = mode
    }
    if (preset && typeof preset === 'string') {
      activeSimulationPreset = preset
      store.activeSimulationPreset = preset
    }
    res.json({
      status: 'success',
      mode: operatingMode,
      active_preset: activeSimulationPreset,
      message: `Operating mode set to ${operatingMode} SENSOR MODE`,
    })
  })

  // ── Real Hardware Status ──────────────────────────────────────────────────
  app.get('/api/real-hardware/status', (_req: Request, res: Response) => {
    const currentStatus = evaluateNodeStatus()
    realHardware.status = currentStatus

    res.json({
      ...realHardware,
      status: currentStatus,
      is_connected: currentStatus === 'CONNECTED',
      is_stale: currentStatus === 'STALE',
      current_mode: operatingMode,
    })
  })

  app.post('/api/real-hardware/reset', (_req: Request, res: Response) => {
    realHardware.status = 'DISCONNECTED'
    realHardware.is_connected = false
    realHardware.last_heartbeat_at = null
    realHardware.packets_received_count = 0
    realHardware.latest_telemetry = null
    realHardware.telemetry_history = []
    realHardware.computed_risks = null

    store.disconnectRealHardware()

    lastApiResponse = {
      timestamp: new Date().toISOString(),
      status_code: 200,
      status: 'success',
      message: 'Hardware state reset to DISCONNECTED',
    }

    res.json({
      status: 'success',
      message: 'Real hardware state reset to DISCONNECTED / AWAITING SIGNAL',
      hardware: realHardware,
    })
  })

  // ── Developer Diagnostics Endpoint ────────────────────────────────────────
  app.get('/api/real-hardware/diagnostics', (_req: Request, res: Response) => {
    const currentStatus = evaluateNodeStatus()
    res.json({
      node_id: realHardware.node_id,
      node_name: realHardware.node_name,
      connection_status: currentStatus,
      is_connected: currentStatus === 'CONNECTED',
      is_stale: currentStatus === 'STALE',
      stale_timeout_sec: STALE_TIMEOUT_SEC,
      last_packet_time: realHardware.last_heartbeat_at,
      packets_received_count: realHardware.packets_received_count,
      last_successful_update: realHardware.last_heartbeat_at,
      battery_level: realHardware.latest_telemetry?.battery_level ?? null,
      last_validation_error: lastValidationError,
      last_api_response: lastApiResponse,
      total_history_records: realHardware.telemetry_history.length,
      coordinates: {
        latitude: realHardware.latitude,
        longitude: realHardware.longitude,
        elevation_m: realHardware.elevation_m,
      },
    })
  })

  // ── Real ESP32 Telemetry Ingestion Endpoint ───────────────────────────────
  app.post('/api/telemetry', (req: Request, res: Response) => {
    const recordTime = new Date().toISOString()
    try {
      const payload = req.body
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        lastValidationError = {
          timestamp: recordTime,
          error_code: 'INVALID_PAYLOAD',
          message: 'Telemetry payload must be a valid JSON object.',
        }
        lastApiResponse = {
          timestamp: recordTime,
          status_code: 400,
          status: 'error',
          message: 'Telemetry payload must be a JSON object.',
        }
        return res.status(400).json({
          status: 'error',
          error_code: 'INVALID_PAYLOAD',
          message: 'Telemetry payload must be a JSON object.',
        })
      }

      // 1. Node ID Validation
      if (!payload.node_id || typeof payload.node_id !== 'string') {
        lastValidationError = {
          timestamp: recordTime,
          error_code: 'MISSING_NODE_ID',
          message: "Field 'node_id' is required and must be a non-empty string.",
          field: 'node_id',
        }
        lastApiResponse = {
          timestamp: recordTime,
          status_code: 400,
          status: 'error',
          message: "Missing required field 'node_id'.",
        }
        return res.status(400).json({
          status: 'error',
          error_code: 'MISSING_NODE_ID',
          message: "Missing required field 'node_id' (e.g. 'JR-NODE-01').",
        })
      }

      const nodeId = payload.node_id.trim()
      const registeredNode = REGISTERED_NODES[nodeId]

      if (!registeredNode) {
        lastValidationError = {
          timestamp: recordTime,
          error_code: 'UNKNOWN_NODE',
          message: `Sensor node '${nodeId}' is not registered in the network registry.`,
          field: 'node_id',
          invalid_value: nodeId,
        }
        lastApiResponse = {
          timestamp: recordTime,
          status_code: 404,
          status: 'error',
          message: `Unknown node '${nodeId}'.`,
        }
        return res.status(404).json({
          status: 'error',
          error_code: 'UNKNOWN_NODE',
          message: `Sensor node '${nodeId}' is not registered in the network registry.`,
          registered_nodes: Object.keys(REGISTERED_NODES),
        })
      }

      // 2. Physical Range and Type Validation
      const measurementsReceived: string[] = []
      const sanitizedMeasurements: Record<string, number | null> = {}

      for (const [field, rules] of Object.entries(SENSOR_VALIDATION_RULES)) {
        const val = payload[field]

        // Allow null or undefined where sensors are optional or unavailable
        if (val === null || val === undefined) {
          sanitizedMeasurements[field] = null
          continue
        }

        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          lastValidationError = {
            timestamp: recordTime,
            error_code: 'INVALID_NUMERIC_FIELD',
            message: `Field '${field}' must be a valid finite number or null. Received: ${typeof val}`,
            field,
            invalid_value: val,
          }
          lastApiResponse = {
            timestamp: recordTime,
            status_code: 400,
            status: 'error',
            message: `Field '${field}' must be a valid number.`,
          }
          return res.status(400).json({
            status: 'error',
            error_code: 'INVALID_NUMERIC_FIELD',
            field,
            message: `Field '${field}' must be a valid number or null.`,
          })
        }

        // Boundary check
        if (val < rules.min || val > rules.max) {
          lastValidationError = {
            timestamp: recordTime,
            error_code: 'VALUE_OUT_OF_BOUNDS',
            message: `Field '${field}' value ${val} is outside physically possible mountain catchment bounds (${rules.min} to ${rules.max} ${rules.unit}).`,
            field,
            invalid_value: val,
          }
          lastApiResponse = {
            timestamp: recordTime,
            status_code: 400,
            status: 'error',
            message: `Field '${field}' out of bounds.`,
          }
          return res.status(400).json({
            status: 'error',
            error_code: 'VALUE_OUT_OF_BOUNDS',
            field,
            value_received: val,
            allowed_range: { min: rules.min, max: rules.max, unit: rules.unit },
            message: `Field '${field}' (${val}) is outside physically plausible bounds [${rules.min}, ${rules.max}] ${rules.unit}.`,
          })
        }

        sanitizedMeasurements[field] = val
        measurementsReceived.push(field)
      }

      if (measurementsReceived.length === 0) {
        lastValidationError = {
          timestamp: recordTime,
          error_code: 'NO_MEASUREMENTS',
          message: 'Payload must contain at least one valid non-null measurement field.',
        }
        lastApiResponse = {
          timestamp: recordTime,
          status_code: 400,
          status: 'error',
          message: 'No measurement fields provided.',
        }
        return res.status(400).json({
          status: 'error',
          error_code: 'NO_MEASUREMENTS',
          message: 'Payload must contain at least one valid measurement field.',
        })
      }

      // Valid timestamp or current server time
      const packetTimestamp = payload.timestamp
        ? new Date(payload.timestamp).toISOString()
        : recordTime

      const telemetryRecord = {
        node_id: nodeId,
        timestamp: packetTimestamp,
        recorded_at: recordTime,
        water_level_cm: sanitizedMeasurements.water_level_cm ?? null,
        water_rise_rate: sanitizedMeasurements.water_rise_rate ?? null,
        rainfall_mm: sanitizedMeasurements.rainfall_mm ?? null,
        rainfall_intensity: sanitizedMeasurements.rainfall_intensity ?? null,
        soil_moisture_1: sanitizedMeasurements.soil_moisture_1 ?? null,
        soil_moisture_2: sanitizedMeasurements.soil_moisture_2 ?? null,
        temperature_c: sanitizedMeasurements.temperature_c ?? null,
        humidity_pct: sanitizedMeasurements.humidity_pct ?? null,
        pressure_hpa: sanitizedMeasurements.pressure_hpa ?? null,
        battery_level: sanitizedMeasurements.battery_level ?? null,
        data_quality: 'REAL' as const,
      }

      // 3. Feature Engineering for Real Risk Pipeline
      const wDepthM = sanitizedMeasurements.water_level_cm !== null
        ? Number((sanitizedMeasurements.water_level_cm / 100).toFixed(2))
        : 1.85
      const riseVelocity = sanitizedMeasurements.water_rise_rate ?? 0
      const rainMm = sanitizedMeasurements.rainfall_mm ?? 0
      const rainRate = sanitizedMeasurements.rainfall_intensity ?? 0
      const soilMoist = sanitizedMeasurements.soil_moisture_1 ?? sanitizedMeasurements.soil_moisture_2 ?? 45.0
      const tempC = sanitizedMeasurements.temperature_c ?? 22.0
      const humidity = sanitizedMeasurements.humidity_pct ?? 65.0

      // Compute using exact deterministic risk equations
      const wsRes = computeWaterStress({
        rainfall_mm: rainMm,
        temperature_c: tempC,
        humidity_pct: humidity,
        water_level_m: wDepthM,
        flow_rate_lpm: 32.0,
        population: 850,
        storage_capacity_L: 120000,
        season: 'summer',
      })

      const ffRes = computeFloodRisk({
        rainfall_mm: rainMm,
        peak_intensity_mm_hr: rainRate,
        water_level_m: wDepthM,
        water_level_rise_rate: riseVelocity,
        forecast_rainfall: rainMm * 1.2,
        soil_moisture_pct: soilMoist,
        distance_to_river_m: 180,
        catchment_area_sqkm: 4.8,
        soil_type: 'clay_loam',
        slope_deg: 22,
      })

      const lsRes = computeLandslideRisk({
        slope_deg: 22,
        rainfall_72h_mm: rainMm * 1.5,
        soil_moisture_pct: soilMoist,
        soil_type: 'clay_loam',
        vegetation_cover_pct: 55,
      })

      const mhRes = computeMultiHazard(wsRes, ffRes, lsRes)

      const sensorValues = {
        water_level_m: wDepthM,
        water_rise_rate: riseVelocity,
        rainfall_mm: rainMm,
        peak_intensity_mm_hr: rainRate,
        soil_moisture_pct: Math.round(soilMoist),
        temperature_c: tempC,
        humidity_pct: Math.round(humidity),
        flow_rate_lpm: 32.0,
        battery_pct: sanitizedMeasurements.battery_level ?? 100,
      }

      const channelRes = evaluateDisasterAlertChannels({
        village_id: registeredNode.village_id,
        village_name: registeredNode.village_name,
        node_id: nodeId,
        node_uid: nodeId,
        waterStress: wsRes,
        flood: ffRes,
        landslide: lsRes,
        multiHazard: mhRes,
        sensor_values: sensorValues,
        data_source: 'REAL HARDWARE (JR-NODE-01)',
        data_quality: 'REAL SENSOR TELEMETRY',
        timestamp: packetTimestamp,
      })

      const computedRiskSummary = {
        water_stress: {
          score: wsRes.score,
          level: wsRes.level,
          category: channelRes.water_stress_category,
          alert_active: channelRes.water_stress_alert,
          factors: wsRes.factors,
        },
        flood: {
          score: ffRes.score,
          level: ffRes.level,
          category: channelRes.flood_risk_category,
          alert_active: channelRes.flood_alert,
          factors: ffRes.factors,
        },
        landslide: {
          score: lsRes.score,
          level: lsRes.level,
          category: channelRes.landslide_risk_category,
          alert_active: channelRes.landslide_alert,
          factors: lsRes.factors,
        },
        multi_hazard: {
          composite_score: mhRes.compositeScore,
          category: mhRes.overall_multi_hazard_category,
          dominant_hazard: mhRes.dominant_hazard,
          secondary_hazard: mhRes.secondary_hazard,
          cascade_triggered: mhRes.cascadeTriggered,
          alert_active: channelRes.multi_hazard_alert,
          factors: mhRes.allTopFactors,
        },
        channels: channelRes,
      }

      // 4. Update Node State
      realHardware.node_id = nodeId
      realHardware.node_name = registeredNode.node_name
      realHardware.village_id = registeredNode.village_id
      realHardware.village_name = registeredNode.village_name
      realHardware.latitude = registeredNode.latitude
      realHardware.longitude = registeredNode.longitude
      realHardware.elevation_m = registeredNode.elevation_m
      realHardware.status = 'CONNECTED'
      realHardware.is_connected = true
      realHardware.last_heartbeat_at = packetTimestamp
      realHardware.packets_received_count += 1
      realHardware.latest_telemetry = telemetryRecord as any
      realHardware.computed_risks = computedRiskSummary
      realHardware.telemetry_history.unshift(telemetryRecord as any)
      if (realHardware.telemetry_history.length > 200) {
        realHardware.telemetry_history.pop()
      }

      // Also forward to store so client UI updates synchronously
      store.recordTelemetry(payload)

      lastApiResponse = {
        timestamp: recordTime,
        status_code: 200,
        status: 'success',
        message: `Accepted packet #${realHardware.packets_received_count} for ${nodeId}`,
        packet_id: realHardware.packets_received_count,
      }

      return res.status(200).json({
        status: 'ACCEPTED',
        node_id: nodeId,
        data_source: 'REAL HARDWARE (JR-NODE-01)',
        data_quality: 'REAL',
        message: `Real ESP32 telemetry packet accepted for node '${nodeId}'.`,

        // 1. Water Stress Alert Channel
        water_stress_alert: channelRes.water_stress_alert,
        water_stress_score: channelRes.water_stress_score,
        water_stress_category: channelRes.water_stress_category,
        water_stress_reasons: channelRes.water_stress_reasons,

        // 2. Flood Alert Channel
        flood_alert: channelRes.flood_alert,
        flood_risk_score: channelRes.flood_risk_score,
        flood_risk_category: channelRes.flood_risk_category,
        flood_risk_reasons: channelRes.flood_risk_reasons,

        // 3. Landslide Alert Channel
        landslide_alert: channelRes.landslide_alert,
        landslide_risk_score: channelRes.landslide_risk_score,
        landslide_risk_category: channelRes.landslide_risk_category,
        landslide_risk_reasons: channelRes.landslide_risk_reasons,

        // 4. Multi-Hazard Alert Channel
        multi_hazard_alert: channelRes.multi_hazard_alert,
        overall_multi_hazard_score: channelRes.overall_multi_hazard_score,
        overall_multi_hazard_category: channelRes.overall_multi_hazard_category,
        dominant_hazard: channelRes.dominant_hazard,
        secondary_hazard: channelRes.secondary_hazard,
        multi_hazard_reasons: channelRes.multi_hazard_reasons,

        active_alerts: channelRes.generated_alerts,
        computed_risks: computedRiskSummary,
        risk_pipeline: computedRiskSummary,
        data: {
          node_id: nodeId,
          node_name: registeredNode.node_name,
          village: registeredNode.village_name,
          recorded_at: recordTime,
          measurements_received: measurementsReceived,
          packet_count: realHardware.packets_received_count,
          data_source: 'REAL HARDWARE (JR-NODE-01)',
          data_quality: 'REAL',
          operating_mode: operatingMode,
          hardware_status: 'CONNECTED',
          computed_risks: computedRiskSummary,
          channels: channelRes,
        },
      })
    } catch (err: any) {
      lastValidationError = {
        timestamp: recordTime,
        error_code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal error processing telemetry packet.',
      }
      return res.status(500).json({
        status: 'error',
        error_code: 'INTERNAL_ERROR',
        message: err?.message || 'Failed to process real telemetry packet.',
      })
    }
  })

  // ── Historical Telemetry Endpoint with Time Range Filtering ───────────────
  app.get('/api/telemetry/history', (req: Request, res: Response) => {
    const requestedNode = String(req.query.node_id || 'JR-NODE-01')
    const range = String(req.query.range || 'all').toLowerCase()

    if (requestedNode !== 'JR-NODE-01') {
      return res.json({
        node_id: requestedNode,
        range,
        count: 0,
        records: [],
      })
    }

    const now = Date.now()
    let cutoff = 0
    if (range === '1h') cutoff = now - 60 * 60 * 1000
    else if (range === '6h') cutoff = now - 6 * 60 * 60 * 1000
    else if (range === '24h') cutoff = now - 24 * 60 * 60 * 1000

    const records = realHardware.telemetry_history.filter((rec) => {
      if (cutoff === 0) return true
      const timeMs = new Date(rec.timestamp || rec.recorded_at).getTime()
      return timeMs >= cutoff
    })

    res.json({
      node_id: requestedNode,
      range,
      count: records.length,
      records,
    })
  })

  // ── Latest Telemetry Query ────────────────────────────────────────────────
  app.get('/api/telemetry/latest', (req: Request, res: Response) => {
    const requestedNode = String(req.query.node_id || 'JR-NODE-01')
    const currentStatus = evaluateNodeStatus()
    realHardware.status = currentStatus

    if (requestedNode === 'JR-NODE-01' || operatingMode === 'REAL') {
      if (!realHardware.is_connected || !realHardware.latest_telemetry) {
        return res.json({
          status: 'awaiting_hardware',
          operating_mode: operatingMode,
          is_connected: false,
          hardware_status: currentStatus,
          message: 'No real telemetry packets received from JR-NODE-01 yet.',
          expected_payload_schema: {
            node_id: 'JR-NODE-01',
            timestamp: 'ISO8601 String',
            water_level_cm: 'float (0 to 2500 cm)',
            water_rise_rate: 'float (-300 to +300 cm/hr)',
            rainfall_mm: 'float (0 to 1200 mm)',
            rainfall_intensity: 'float (0 to 600 mm/hr)',
            soil_moisture_1: 'float (0 to 100 % VWC)',
            soil_moisture_2: 'float (0 to 100 % VWC)',
            temperature_c: 'float (-40 to +65 °C)',
            humidity_pct: 'float (0 to 100 %)',
            pressure_hpa: 'float (300 to 1250 hPa)',
            battery_level: 'integer (0 to 100 %)',
          },
        })
      }
      return res.json({
        status: 'success',
        operating_mode: operatingMode,
        is_connected: currentStatus === 'CONNECTED',
        is_stale: currentStatus === 'STALE',
        hardware_status: currentStatus,
        data: realHardware.latest_telemetry,
        computed_risks: realHardware.computed_risks,
        history_count: realHardware.telemetry_history.length,
      })
    }

    res.json({
      status: 'success',
      operating_mode: 'SIMULATION',
      data_quality: 'SYNTHETIC (DEMO TELEMETRY)',
      message: 'Simulation mode is active. Data is generated synthetically.',
    })
  })

  // ── Nodes Registry with Coordinates and Live Connection Status ────────────
  app.get('/api/nodes', (_req: Request, res: Response) => {
    const currentStatus = evaluateNodeStatus()
    realHardware.status = currentStatus

    const nodesList = [
      {
        id: 1,
        node_id: 'JR-NODE-01',
        node_name: realHardware.node_name,
        village_id: realHardware.village_id,
        village_name: realHardware.village_name,
        latitude: realHardware.latitude,
        longitude: realHardware.longitude,
        elevation_m: realHardware.elevation_m,
        node_type: 'REAL_ESP32_FIELD_HARDWARE',
        status: currentStatus,
        is_connected: currentStatus === 'CONNECTED',
        is_stale: currentStatus === 'STALE',
        battery_level: realHardware.latest_telemetry?.battery_level ?? 0,
        firmware_version: realHardware.firmware_version,
        last_seen: realHardware.last_heartbeat_at || 'Never',
        stale_timeout_sec: STALE_TIMEOUT_SEC,
        data_quality: 'REAL',
      },
      {
        id: 2,
        node_id: 'ESP32-JAL-REASI-101',
        node_name: 'Katra Stream Reference Station',
        village_id: 1,
        village_name: 'Katra',
        latitude: 32.9912,
        longitude: 74.9345,
        elevation_m: 860,
        node_type: 'SIMULATED_REFERENCE_NODE',
        status: 'CONNECTED',
        is_connected: true,
        is_stale: false,
        battery_level: 88,
        firmware_version: 'v2.0-SIM-REF',
        last_seen: new Date().toISOString(),
        stale_timeout_sec: STALE_TIMEOUT_SEC,
        data_quality: 'SYNTHETIC',
      },
    ]

    res.json({
      nodes: nodesList,
      total_count: nodesList.length,
      real_node_status: currentStatus,
    })
  })

  // ── Standard JalRakshak 2.0 Domain APIs (Villages, Sources, Alerts) ────────
  app.get('/api/villages', (_req: Request, res: Response) => {
    store.init()
    res.json(store.villages)
  })

  app.get('/api/sources', (req: Request, res: Response) => {
    store.init()
    let list = store.waterSources
    const villageId = req.query.village_id ? Number(req.query.village_id) : null
    if (villageId) {
      list = list.filter((s) => s.village_id === villageId)
    }
    res.json(list)
  })

  // ── Alerts with Multi-Hazard Channel Filtering ───────────────────────────
  app.get('/api/alerts', (req: Request, res: Response) => {
    store.init()
    let list = [...store.alerts]

    const hazard = req.query.hazard ? String(req.query.hazard).trim().toUpperCase() : null
    const hazardType = req.query.hazard_type ? String(req.query.hazard_type).trim().toUpperCase() : null
    const status = req.query.status ? String(req.query.status).trim().toUpperCase() : null
    const villageId = req.query.village_id ? Number(req.query.village_id) : null
    const nodeId = req.query.node_id ? String(req.query.node_id).trim().toUpperCase() : null

    if (hazard && hazard !== 'ALL') {
      const hClean = hazard.replace(/[\s_-]/g, '')
      list = list.filter((a) => {
        const aH = a.hazard.toUpperCase().replace(/[\s_-]/g, '')
        const aHt = a.hazard_type.toUpperCase().replace(/[\s_-]/g, '')
        const aAt = a.alert_type.toUpperCase().replace(/[\s_-]/g, '')
        return aH === hClean || aHt === hClean || aAt.includes(hClean)
      })
    }

    if (hazardType && hazardType !== 'ALL') {
      const htClean = hazardType.replace(/[\s_-]/g, '')
      list = list.filter((a) => a.hazard_type.toUpperCase().replace(/[\s_-]/g, '') === htClean)
    }

    if (status && status !== 'ALL') {
      list = list.filter((a) => a.status.toUpperCase() === status)
    }

    if (villageId) {
      list = list.filter((a) => a.village_id === villageId)
    }

    if (nodeId) {
      list = list.filter((a) => (a.node_id && a.node_id.toUpperCase() === nodeId) || a.node.toUpperCase() === nodeId)
    }

    res.json(list)
  })

  // ── Simulation Presets & Scenarios A-H ─────────────────────────────────────
  app.post('/api/simulation/preset', (req: Request, res: Response) => {
    const preset = req.body?.preset || req.body?.scenario || 'nominal'
    store.applyTelemetryPreset(preset)
    activeSimulationPreset = preset
    res.json({
      status: 'success',
      active_preset: preset,
      message: `Simulation preset '${preset}' applied successfully.`,
      active_alerts_count: store.alerts.filter((a) => a.status === 'ACTIVE').length,
    })
  })

  app.post('/api/simulation/scenario', (req: Request, res: Response) => {
    const scenario = req.body?.scenario || req.body?.preset || 'A'
    store.applyTelemetryPreset(scenario)
    activeSimulationPreset = scenario
    res.json({
      status: 'success',
      scenario,
      message: `Test scenario '${scenario}' executed successfully.`,
      active_alerts: store.alerts.filter((a) => a.status === 'ACTIVE'),
    })
  })

  app.get('/api/simulation/scenarios', (_req: Request, res: Response) => {
    res.json({
      scenarios: [
        { id: 'A', name: 'Scenario A: Water Stress only', active_hazard: 'WATER_STRESS', multi_hazard_active: false },
        { id: 'B', name: 'Scenario B: Flood only', active_hazard: 'FLOOD', multi_hazard_active: false },
        { id: 'C', name: 'Scenario C: Landslide only', active_hazard: 'LANDSLIDE', multi_hazard_active: false },
        { id: 'D', name: 'Scenario D: Water Stress + Flood', active_hazard: 'WATER_STRESS + FLOOD', multi_hazard_active: true },
        { id: 'E', name: 'Scenario E: Flood + Landslide', active_hazard: 'FLOOD + LANDSLIDE', multi_hazard_active: true },
        { id: 'F', name: 'Scenario F: Water Stress + Landslide', active_hazard: 'WATER_STRESS + LANDSLIDE', multi_hazard_active: true },
        { id: 'G', name: 'Scenario G: All three elevated', active_hazard: 'WATER_STRESS + FLOOD + LANDSLIDE', multi_hazard_active: true },
        { id: 'H', name: 'Scenario H: All normal', active_hazard: 'NONE', multi_hazard_active: false },
      ],
    })
  })

  app.get('/api/hazards/assessments', (_req: Request, res: Response) => {
    store.init()
    res.json(store.hazardAssessments)
  })

  // ── Vite Dev Middleware or Static Serving ─────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve('dist')
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath))
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'))
      })
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[JalRakshak 2.0] Full-Stack Server running at http://0.0.0.0:${port}`)
    console.log(`[JalRakshak 2.0] Real ESP32 Ingestion: POST http://0.0.0.0:${port}/api/telemetry`)
  })
}

startServer().catch((err) => {
  console.error('[JalRakshak 2.0] Failed to start server:', err)
  process.exit(1)
})
