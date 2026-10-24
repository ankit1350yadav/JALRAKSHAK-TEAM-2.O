/**
 * index.ts — JalRakshak 2.0 API Layer
 * Exposes endpoints for Multi-Hazard assessments, Telemetry simulation, and Peril Predictions.
 */

import {
  store,
  computeWaterStress,
  WaterStressInputs,
  computeFloodRisk,
  FloodInputs,
  computeLandslideRisk,
  LandslideInputs,
  computeMultiHazard,
  MULTI_HAZARD_RECOMMENDATIONS,
  Village,
  WaterSource,
  ClimateReading,
  HazardAssessment,
  Alert,
  SensorDevice,
  SystemOperatingMode,
  RealHardwareStatus,
  ESP32TelemetryPacket,
} from './store'
export type { SensorDevice, SystemOperatingMode, RealHardwareStatus, ESP32TelemetryPacket }

export interface MultiHazardPredictPayload {
  village_id?: number
  rainfall_mm: number
  peak_intensity_mm_hr: number
  temperature_c: number
  humidity_pct: number
  water_level_m: number
  flow_rate_lpm: number
  slope_deg: number
  soil_moisture_pct: number
  soil_type: 'clay_loam' | 'gravelly_silt' | 'fractured_shale' | 'alluvial'
  distance_to_river_m: number
  catchment_area_sqkm: number
  vegetation_cover_pct: number
  population: number
  storage_capacity_L: number
  season: 'winter' | 'spring' | 'summer' | 'autumn'
}

export interface MultiHazardPredictResult {
  overall_multi_hazard_score: number
  overall_multi_hazard_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  dominant_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'COMBINED'
  secondary_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'NONE'
  risk_factors: string[]
  water_stress: { score: number; level: 'low' | 'medium' | 'high'; factors: string[] }
  flash_flood: { score: number; level: 'low' | 'medium' | 'high'; factors: string[] }
  landslide: { score: number; level: 'low' | 'medium' | 'high'; factors: string[] }
  composite: {
    score: number
    level: 'low' | 'medium' | 'high'
    primary_threat: 'water_stress' | 'flash_flood' | 'landslide' | 'compound'
    cascade_triggered: boolean
    factors: string[]
  }
  recommendations: string[]
  disclaimer: string
}

export const getHealth = async () => ({
  data: {
    status: 'ok',
    service: 'JalRakshak 2.0 Multi-Hazard Platform',
    version: '2.0.0',
    hazards_monitored: ['water_stress', 'flash_flood', 'landslide'],
    notice: 'Prototype demonstration data for educational decision support.',
  },
})

export const getDashboardStats = async () => {
  return { data: store.getDashboardStats() }
}

export const getVillages = async () => {
  store.init()
  return { data: [...store.villages] }
}

export const getVillage = async (id: number | string) => {
  store.init()
  const v = store.villages.find((item) => item.id === Number(id))
  if (!v) throw new Error(`Village ${id} not found`)
  return { data: v }
}

export const getSources = async (params?: { village_id?: number | string; source_type?: string }) => {
  store.init()
  let list = store.waterSources
  if (params?.village_id) list = list.filter((s) => s.village_id === Number(params.village_id))
  if (params?.source_type) list = list.filter((s) => s.source_type === params.source_type)
  return { data: list }
}

export const getClimate = async (params?: { village_id?: number | string; season?: string; limit?: number }) => {
  store.init()
  let list = store.climateReadings
  if (params?.village_id) list = list.filter((r) => r.village_id === Number(params.village_id))
  if (params?.season) list = list.filter((r) => r.season === params.season)
  const limit = params?.limit ?? 100
  return { data: list.slice(-limit).reverse() }
}

export const getSensors = async (params?: { village_id?: number | string }) => {
  store.init()
  let list = store.sensorDevices
  if (params?.village_id) list = list.filter((s) => s.village_id === Number(params.village_id))
  return { data: list }
}

export const getHazardAssessments = async () => {
  store.init()
  return { data: [...store.hazardAssessments] }
}

export const getAlerts = async (params?: {
  hazard?: string
  hazard_type?: string
  severity?: string
  resolved?: boolean
  status?: string
  search?: string
}) => {
  store.init()
  let list = store.alerts

  if (params?.hazard && params.hazard.toUpperCase() !== 'ALL') {
    const q = params.hazard.toLowerCase().replace(/[\s_-]/g, '')
    list = list.filter((a) => {
      const h = a.hazard.toLowerCase().replace(/[\s_-]/g, '')
      const ht = a.hazard_type.toLowerCase().replace(/[\s_-]/g, '')
      const at = a.alert_type.toLowerCase().replace(/[\s_-]/g, '')
      return h === q || ht === q || at.includes(q)
    })
  }
  if (params?.hazard_type && params.hazard_type.toUpperCase() !== 'ALL') {
    const htClean = params.hazard_type.toLowerCase().replace(/[\s_-]/g, '')
    list = list.filter((a) => a.hazard_type.toLowerCase().replace(/[\s_-]/g, '') === htClean)
  }
  if (params?.severity) list = list.filter((a) => a.severity === params.severity)
  if (params?.resolved !== undefined) list = list.filter((a) => a.is_resolved === (params.resolved ? 1 : 0))
  if (params?.status && params.status !== 'All') {
    list = list.filter((a) => a.status.toUpperCase() === params.status?.toUpperCase())
  }
  if (params?.search) {
    const s = params.search.toLowerCase()
    list = list.filter(
      (a) =>
        a.village.toLowerCase().includes(s) ||
        a.node.toLowerCase().includes(s) ||
        a.alert_id.toLowerCase().includes(s) ||
        (a.reason && a.reason.toLowerCase().includes(s)) ||
        (a.reasons && a.reasons.some((r) => r.toLowerCase().includes(s))) ||
        (a.data_source && a.data_source.toLowerCase().includes(s))
    )
  }
  return { data: list }
}

export const resolveAlert = async (id: number | string) => {
  const alert = store.resolveAlert(id)
  if (!alert) throw new Error(`Alert ${id} not found`)
  return { data: alert }
}

export const applySimulationPreset = async (preset: string) => {
  store.applyTelemetryPreset(preset)
  return { data: store.getDashboardStats() }
}

export const applyTestScenario = applySimulationPreset

export const postPredictMultiHazard = async (
  payload: MultiHazardPredictPayload
): Promise<{ data: MultiHazardPredictResult }> => {
  store.init()

  const waterRes = computeWaterStress({
    rainfall_mm: Number(payload.rainfall_mm),
    temperature_c: Number(payload.temperature_c),
    humidity_pct: Number(payload.humidity_pct),
    water_level_m: Number(payload.water_level_m),
    flow_rate_lpm: Number(payload.flow_rate_lpm),
    population: Number(payload.population),
    storage_capacity_L: Number(payload.storage_capacity_L),
    season: payload.season,
  })

  const floodRiseRate = payload.flow_rate_lpm >= 40.0 ? 8.5 : undefined
  const forecastRain = payload.rainfall_mm >= 30.0 ? Math.round(payload.rainfall_mm * 1.2) : undefined

  const floodRes = computeFloodRisk({
    rainfall_mm: Number(payload.rainfall_mm),
    peak_intensity_mm_hr: Number(payload.peak_intensity_mm_hr),
    water_level_m: Number(payload.water_level_m),
    water_level_rise_rate: floodRiseRate,
    forecast_rainfall: forecastRain,
    soil_moisture_pct: Number(payload.soil_moisture_pct),
    distance_to_river_m: Number(payload.distance_to_river_m),
    catchment_area_sqkm: Number(payload.catchment_area_sqkm),
    soil_type: payload.soil_type,
    slope_deg: Number(payload.slope_deg),
  })

  const landslideRes = computeLandslideRisk({
    slope_deg: Number(payload.slope_deg),
    rainfall_72h_mm: Number(payload.rainfall_mm) * 1.5,
    soil_moisture_pct: Number(payload.soil_moisture_pct),
    soil_type: payload.soil_type,
    vegetation_cover_pct: Number(payload.vegetation_cover_pct),
  })

  const multiRes = computeMultiHazard(waterRes, floodRes, landslideRes)

  // Build tailored recommendations
  const actionList = MULTI_HAZARD_RECOMMENDATIONS[multiRes.compositeLevel]?.map((r) => r.action) || []

  return {
    data: {
      overall_multi_hazard_score: multiRes.overall_multi_hazard_score,
      overall_multi_hazard_category: multiRes.overall_multi_hazard_category,
      dominant_hazard: multiRes.dominant_hazard,
      secondary_hazard: multiRes.secondary_hazard,
      risk_factors: multiRes.risk_factors,
      water_stress: waterRes,
      flash_flood: floodRes,
      landslide: landslideRes,
      composite: {
        score: multiRes.compositeScore,
        level: multiRes.compositeLevel,
        primary_threat: multiRes.primaryThreat,
        cascade_triggered: multiRes.cascadeTriggered,
        factors: multiRes.allTopFactors,
      },
      recommendations: actionList,
      disclaimer:
        'JalRakshak 2.0 multi-hazard prediction based on synthetic geotechnical & meteorological simulation.',
    },
  }
}

export const getRecommendations = async (riskLevel: string) => {
  const key = riskLevel.toLowerCase()
  const items = MULTI_HAZARD_RECOMMENDATIONS[key] || []
  return {
    data: {
      risk_level: key,
      recommendations: items,
      disclaimer:
        'Multi-hazard decision-support guidance for mountain catchments in Jammu & Kashmir. Prototype demonstration content only.',
    },
  }
}

export const getModelStatus = async () => ({
  data: {
    ml_model_available: true,
    message: 'Multi-Hazard Synthesis Engine (Random Forest + Hydro-Geotechnical Rule Base) is active.',
    hazards: ['water_stress', 'flash_flood', 'landslide', 'compound_cascade'],
    disclaimer: 'Prototype demonstration models trained on synthetic catchment data.',
  },
})

// Legacy compatibility stubs for existing components
export const postPredictML = async (payload: any) => {
  const res = await postPredictMultiHazard({
    ...payload,
    peak_intensity_mm_hr: payload.rainfall_mm * 1.2,
    slope_deg: 25,
    soil_moisture_pct: 50,
    soil_type: 'clay_loam',
    distance_to_river_m: 250,
    catchment_area_sqkm: 5.0,
    vegetation_cover_pct: 50,
  })
  return {
    data: {
      risk_level: res.data.composite.level,
      confidence_pct: res.data.composite.score,
      recommendation: res.data.recommendations[0] || 'Maintain continuous multi-hazard surveillance.',
      prediction_source: 'ml_model',
      disclaimer: res.data.disclaimer,
    },
  }
}

export const getPredictions = async (params?: any) => {
  store.init()
  return { data: store.hazardAssessments }
}

export const getVillagePredictions = async (id: number | string) => {
  store.init()
  return { data: store.hazardAssessments.filter((h) => h.village_id === Number(id)) }
}

// ---------------------------------------------------------------------------
// ESP32 Telemetry API Endpoints (JalRakshak 2.0)
// ---------------------------------------------------------------------------

export interface ESP32TelemetryPayload {
  node_id: string | number
  timestamp?: string | number
  water_level_cm?: number
  water_rise_rate?: number
  rainfall_mm?: number
  rainfall_intensity?: number
  soil_moisture_1?: number
  soil_moisture_2?: number
  temperature_c?: number
  humidity_pct?: number
  pressure_hpa?: number
  battery_level?: number
}

export const getOperatingMode = async (): Promise<{
  data: {
    mode: SystemOperatingMode
    active_preset: string
    hardware_connected: boolean
    hardware_status: string
    realHardware: RealHardwareStatus
  }
}> => {
  store.init()
  try {
    const res = await fetch('/api/mode')
    if (res.ok) {
      const json = await res.json()
      if (json.mode) {
        store.operatingMode = json.mode
      }
      return {
        data: {
          mode: json.mode || store.getOperatingMode(),
          active_preset: json.active_preset || store.activeSimulationPreset,
          hardware_connected: json.hardware_connected ?? store.getRealHardwareStatus().is_connected,
          hardware_status: json.hardware_status || store.getRealHardwareStatus().status,
          realHardware: store.getRealHardwareStatus(),
        },
      }
    }
  } catch {
    // client fallback
  }
  return {
    data: {
      mode: store.getOperatingMode(),
      active_preset: store.activeSimulationPreset,
      hardware_connected: store.getRealHardwareStatus().is_connected,
      hardware_status: store.getRealHardwareStatus().status,
      realHardware: store.getRealHardwareStatus(),
    },
  }
}

export const setOperatingMode = async (
  mode: SystemOperatingMode
): Promise<{ data: { mode: SystemOperatingMode } }> => {
  store.setOperatingMode(mode)
  try {
    await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
  } catch {
    // client fallback
  }
  return { data: { mode } }
}

export const getRealHardwareStatus = async (): Promise<{ data: RealHardwareStatus }> => {
  store.init()
  try {
    const res = await fetch('/api/real-hardware/status')
    if (res.ok) {
      const json = await res.json()
      if (json.status) {
        store.realHardware = {
          ...store.realHardware,
          ...json,
        }
        return { data: store.realHardware }
      }
    }
  } catch {
    // client fallback
  }
  return { data: store.getRealHardwareStatus() }
}

export const disconnectRealHardware = async (): Promise<{ data: RealHardwareStatus }> => {
  const result = store.disconnectRealHardware()
  try {
    await fetch('/api/real-hardware/reset', { method: 'POST' })
  } catch {
    // client fallback
  }
  return { data: result }
}

export const postTelemetry = async (payload: ESP32TelemetryPayload) => {
  store.init()
  let backendData = null
  try {
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const json = await res.json()
      backendData = json.data
    }
  } catch {
    // client fallback
  }
  const result = store.recordTelemetry(payload)
  return { data: backendData || result.data }
}

export interface NodeDiagnostics {
  node_id: string
  node_name: string
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'STALE'
  is_connected: boolean
  is_stale: boolean
  stale_timeout_sec: number
  last_packet_time: string | null
  packets_received_count: number
  last_successful_update: string | null
  battery_level: number | null
  last_validation_error: {
    timestamp: string
    error_code: string
    message: string
    field?: string
    invalid_value?: any
  } | null
  last_api_response: {
    timestamp: string
    status_code: number
    status: string
    message: string
    packet_id?: number
  } | null
  total_history_records: number
  coordinates: {
    latitude: number
    longitude: number
    elevation_m: number
  }
}

export const getTelemetryHistory = async (params?: { node_id?: string; range?: string }): Promise<{
  data: {
    node_id: string
    range: string
    count: number
    records: Array<ESP32TelemetryPacket & { recorded_at: string; data_quality: 'REAL' }>
  }
}> => {
  const nodeId = params?.node_id || 'JR-NODE-01'
  const range = params?.range || 'all'
  try {
    const res = await fetch(`/api/telemetry/history?node_id=${encodeURIComponent(nodeId)}&range=${encodeURIComponent(range)}`)
    if (res.ok) {
      const json = await res.json()
      return { data: json }
    }
  } catch {
    // client fallback
  }
  return {
    data: {
      node_id: nodeId,
      range,
      count: store.realHardware.telemetry_history?.length || 0,
      records: store.realHardware.telemetry_history || [],
    },
  }
}

export const getNodeDiagnostics = async (): Promise<{ data: NodeDiagnostics }> => {
  try {
    const res = await fetch('/api/real-hardware/diagnostics')
    if (res.ok) {
      const json = await res.json()
      return { data: json }
    }
  } catch {
    // client fallback
  }
  return {
    data: {
      node_id: store.realHardware.node_id,
      node_name: store.realHardware.node_name,
      connection_status: store.getRealHardwareStatus().status,
      is_connected: store.realHardware.is_connected,
      is_stale: store.realHardware.status === 'STALE',
      stale_timeout_sec: store.realHardware.stale_timeout_sec || 60,
      last_packet_time: store.realHardware.last_heartbeat_at,
      packets_received_count: store.realHardware.packets_received_count,
      last_successful_update: store.realHardware.last_heartbeat_at,
      battery_level: store.realHardware.latest_telemetry?.battery_level ?? null,
      last_validation_error: null,
      last_api_response: null,
      total_history_records: store.realHardware.telemetry_history?.length || 0,
      coordinates: {
        latitude: store.realHardware.latitude,
        longitude: store.realHardware.longitude,
        elevation_m: store.realHardware.elevation_m,
      },
    },
  }
}

export const getTelemetryLatest = async (params?: { node_id?: string | number; limit?: number }) => {
  store.init()
  const history = store.getNodeHistory(params?.node_id || 1, params?.limit || 20)
  return { data: history }
}

export const getNodes = async (params?: { village_id?: number }) => {
  const nodes = store.getNodes(params?.village_id)
  return { data: nodes }
}

export const getNode = async (id: string | number) => {
  const node = store.getNode(id)
  return { data: node }
}

export const getNodeHistory = async (id: string | number, params?: { limit?: number }) => {
  const history = store.getNodeHistory(id, params?.limit || 20)
  return { data: history }
}

// ---------------------------------------------------------------------------
// Water Stress Risk API Endpoints (JalRakshak 2.0 Peril 1)
// ---------------------------------------------------------------------------

export interface WaterStressPredictionResult {
  water_stress_score: number
  water_stress_category: 'low' | 'medium' | 'high'
  water_stress_factors: string[]
  confidence_score: number
  model_version: string
  data_quality: string
  is_synthetic: number
  disclaimer: string
}

export const postPredictWaterStress = async (
  payload: WaterStressInputs & { village_id?: number }
): Promise<{ data: WaterStressPredictionResult }> => {
  store.init()
  const result = computeWaterStress(payload)
  return {
    data: {
      water_stress_score: result.score,
      water_stress_category: result.level,
      water_stress_factors: result.factors,
      confidence_score: 84.5,
      model_version: 'WS-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

export const getVillageWaterStress = async (villageId: number | string) => {
  store.init()
  const vid = Number(villageId)
  const assessment = store.hazardAssessments.find((h) => h.village_id === vid)
  if (!assessment) {
    // Generate default assessment for village
    const v = store.villages.find((item) => item.id === vid)
    const res = computeWaterStress({
      population: v?.population || 850,
      storage_capacity_L: v?.storage_capacity_L || 120000,
    })
    return {
      data: {
        village_id: vid,
        water_stress_score: res.score,
        water_stress_category: res.level,
        water_stress_factors: res.factors,
        confidence_score: 82.0,
        model_version: 'WS-RF-v2.0',
        data_quality: 'SYNTHETIC',
        is_synthetic: 1,
        disclaimer: 'Prototype prediction based on synthetic demonstration data.',
      },
    }
  }

  return {
    data: {
      village_id: vid,
      water_stress_score: assessment.water_stress_score,
      water_stress_category: assessment.water_stress_level,
      water_stress_factors: assessment.top_factors.filter((f) => !f.toLowerCase().includes('flood') && !f.toLowerCase().includes('slope')),
      confidence_score: 85.0,
      model_version: 'WS-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

// ---------------------------------------------------------------------------
// Flood Risk API Endpoints (JalRakshak 2.0 Peril 2)
// ---------------------------------------------------------------------------

export interface FloodPredictionResult {
  flood_risk_score: number
  flood_risk_category: 'low' | 'medium' | 'high'
  flood_risk_factors: string[]
  confidence_score: number
  peak_discharge_estimate_cms?: number
  inundation_depth_est_m?: number
  time_to_peak_hours?: number
  stream_buffer_breach?: number
  model_version: string
  data_quality: string
  is_synthetic: number
  disclaimer: string
}

export const postPredictFlood = async (
  payload: FloodInputs & { village_id?: number }
): Promise<{ data: FloodPredictionResult }> => {
  store.init()
  const result = computeFloodRisk(payload)
  return {
    data: {
      flood_risk_score: result.score,
      flood_risk_category: result.level,
      flood_risk_factors: result.factors,
      confidence_score: 86.0,
      peak_discharge_estimate_cms: 24.5,
      inundation_depth_est_m: result.score > 60 ? 0.65 : 0.0,
      time_to_peak_hours: 1.8,
      stream_buffer_breach: result.score >= 65 ? 1 : 0,
      model_version: 'FF-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

export const getVillageFloodRisk = async (villageId: number | string) => {
  store.init()
  const vid = Number(villageId)
  const assessment = store.hazardAssessments.find((h) => h.village_id === vid)
  if (!assessment) {
    const v = store.villages.find((item) => item.id === vid)
    const res = computeFloodRisk({
      distance_to_river_m: v?.distance_to_river_m || 250,
      catchment_area_sqkm: v?.catchment_area_sqkm || 5.0,
      slope_deg: v?.slope_deg || 20,
      soil_type: v?.soil_type || 'clay_loam',
    })
    return {
      data: {
        village_id: vid,
        flood_risk_score: res.score,
        flood_risk_category: res.level,
        flood_risk_factors: res.factors,
        confidence_score: 83.0,
        peak_discharge_estimate_cms: 18.2,
        inundation_depth_est_m: 0.1,
        time_to_peak_hours: 2.1,
        stream_buffer_breach: 0,
        model_version: 'FF-RF-v2.0',
        data_quality: 'SYNTHETIC',
        is_synthetic: 1,
        disclaimer: 'Prototype prediction based on synthetic demonstration data.',
      },
    }
  }

  return {
    data: {
      village_id: vid,
      flood_risk_score: assessment.flood_risk_score,
      flood_risk_category: assessment.flood_risk_level,
      flood_risk_factors: assessment.top_factors.filter((f) => !f.toLowerCase().includes('drought') && !f.toLowerCase().includes('deficit') && !f.toLowerCase().includes('spring')),
      confidence_score: 87.0,
      peak_discharge_estimate_cms: assessment.flood_risk_score > 60 ? 42.0 : 14.5,
      inundation_depth_est_m: assessment.flood_risk_score > 60 ? 0.75 : 0.0,
      time_to_peak_hours: 1.6,
      stream_buffer_breach: assessment.flood_risk_score >= 65 ? 1 : 0,
      model_version: 'FF-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

// ---------------------------------------------------------------------------
// Landslide & Slope Stability Risk API Endpoints (JalRakshak 2.0 Peril 3)
// ---------------------------------------------------------------------------

export interface LandslidePredictionResult {
  landslide_risk_score: number
  landslide_risk_category: 'low' | 'medium' | 'high'
  landslide_risk_factors: string[]
  confidence_score: number
  factor_of_safety?: number
  soil_saturation_pct?: number
  slope_instability_index?: number
  critical_rainfall_threshold_exceeded?: number
  model_version: string
  data_quality: string
  is_synthetic: number
  disclaimer: string
}

export const postPredictLandslide = async (
  payload: LandslideInputs & { village_id?: number }
): Promise<{ data: LandslidePredictionResult }> => {
  store.init()
  const result = computeLandslideRisk(payload)
  const slope = payload.slope_deg ?? payload.slope ?? 22.0
  const moisture = payload.soil_moisture_pct ?? payload.soil_moisture ?? 45.0
  const fos = slope > 30 && moisture > 70 ? 0.88 : slope > 25 ? 1.22 : 1.85
  return {
    data: {
      landslide_risk_score: result.score,
      landslide_risk_category: result.level,
      landslide_risk_factors: result.factors,
      confidence_score: 85.0,
      factor_of_safety: fos,
      soil_saturation_pct: moisture,
      slope_instability_index: Number(((slope / 45.0) * 0.5 + (moisture / 100.0) * 0.5).toFixed(2)),
      critical_rainfall_threshold_exceeded: result.score >= 65 ? 1 : 0,
      model_version: 'LS-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

export const getVillageLandslideRisk = async (villageId: number | string) => {
  store.init()
  const vid = Number(villageId)
  const assessment = store.hazardAssessments.find((h) => h.village_id === vid)
  if (!assessment) {
    const v = store.villages.find((item) => item.id === vid)
    const res = computeLandslideRisk({
      slope_deg: v?.slope_deg || 24,
      soil_type: v?.soil_type || 'clay_loam',
      vegetation_cover_pct: v?.vegetation_cover_pct || 45,
    })
    return {
      data: {
        village_id: vid,
        landslide_risk_score: res.score,
        landslide_risk_category: res.level,
        landslide_risk_factors: res.factors,
        confidence_score: 83.0,
        factor_of_safety: 1.45,
        soil_saturation_pct: 48.0,
        slope_instability_index: 0.52,
        critical_rainfall_threshold_exceeded: 0,
        model_version: 'LS-RF-v2.0',
        data_quality: 'SYNTHETIC',
        is_synthetic: 1,
        disclaimer: 'Prototype prediction based on synthetic demonstration data.',
      },
    }
  }

  return {
    data: {
      village_id: vid,
      landslide_risk_score: assessment.landslide_risk_score,
      landslide_risk_category: assessment.landslide_risk_level,
      landslide_risk_factors: assessment.top_factors.filter((f) => !f.toLowerCase().includes('drought') && !f.toLowerCase().includes('deficit') && !f.toLowerCase().includes('riverbed')),
      confidence_score: 86.0,
      factor_of_safety: assessment.landslide_risk_score > 60 ? 0.92 : 1.65,
      soil_saturation_pct: assessment.landslide_risk_score > 60 ? 78.0 : 45.0,
      slope_instability_index: assessment.landslide_risk_score > 60 ? 0.74 : 0.42,
      critical_rainfall_threshold_exceeded: assessment.landslide_risk_score >= 65 ? 1 : 0,
      model_version: 'LS-RF-v2.0',
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
      disclaimer: 'Prototype prediction based on synthetic demonstration data.',
    },
  }
}

