/**
 * store.ts — JalRakshak 2.0 In-Memory & LocalStorage Multi-Hazard Engine Store
 *
 * Implements:
 * 1. Water Stress (Drought) Risk Model
 * 2. Flash Flood Inundation Risk Model
 * 3. Landslide Susceptibility Risk Model
 * 4. Multi-Hazard Synthesis Engine (Composite Weighted Index + Cascading Threat Trigger)
 * 5. ESP32 Sensor Telemetry Simulator (Rainfall Intensity, Soil Moisture, Water Depth)
 */

export interface Village {
  id: number
  name: string
  district: string
  latitude: number
  longitude: number
  elevation_m: number
  population: number
  storage_capacity_L: number
  slope_deg: number
  soil_type: 'clay_loam' | 'gravelly_silt' | 'fractured_shale' | 'alluvial'
  vegetation_cover_pct: number
  distance_to_river_m: number
  catchment_area_sqkm: number
  created_at: string
}

export interface WaterSource {
  id: number
  village_id: number
  source_name: string
  source_type: 'spring' | 'river_tap' | 'tank' | 'well'
  water_level_m: number
  flow_rate_lpm: number
  last_updated: string
}

export interface ClimateReading {
  id: number
  village_id: number
  recorded_date: string
  rainfall_mm: number
  peak_intensity_mm_hr: number
  temperature_c: number
  humidity_pct: number
  season: 'winter' | 'spring' | 'summer' | 'autumn'
  soil_moisture_pct?: number
  is_cloudburst_flag?: boolean
}

export interface SoilReading {
  id: number
  village_id: number
  vwc_shallow_pct: number
  vwc_deep_pct: number
  saturation_index: number
  recorded_at: string
}

export interface SensorDevice {
  id: number
  village_id: number
  device_uid: string
  device_type: 'esp32_gateway' | 'soil_probe' | 'hyetometer' | 'water_radar'
  status: 'active' | 'degraded' | 'offline'
  battery_pct: number
  rssi_dbm: number
  last_ping: string
}

export interface RiskPrediction {
  id: number
  village_id: number | null
  predicted_at: string
  risk_level: 'low' | 'medium' | 'high'
  confidence_pct: number | null
  input_snapshot: string
}

export interface HazardAssessment {
  id: number
  village_id: number
  water_stress_score: number
  water_stress_level: 'low' | 'medium' | 'high'
  flood_risk_score: number
  flood_risk_level: 'low' | 'medium' | 'high'
  landslide_risk_score: number
  landslide_risk_level: 'low' | 'medium' | 'high'
  composite_score: number
  composite_level: 'low' | 'medium' | 'high'
  primary_threat: 'water_stress' | 'flash_flood' | 'landslide' | 'compound'
  cascade_triggered: boolean
  top_factors: string[]
  assessed_at: string
}

export interface AlertSensorValues {
  water_level_m: number
  water_rise_rate: number
  rainfall_mm: number
  peak_intensity_mm_hr: number
  soil_moisture_pct: number
  temperature_c: number
  humidity_pct: number
  flow_rate_lpm: number
  battery_pct: number
}

export type SupportedAlertHazard = 'Water Stress' | 'Flood' | 'Landslide' | 'Multi-Hazard'

export type SupportedHazardType =
  | 'WATER_STRESS'
  | 'FLOOD'
  | 'LANDSLIDE'
  | 'MULTI_HAZARD'
  | 'water_stress'
  | 'flash_flood'
  | 'landslide'
  | 'compound'

export type SupportedAlertType =
  | 'WATER STRESS ALERT'
  | 'FLOOD ALERT'
  | 'LANDSLIDE ALERT'
  | 'MULTI-HAZARD ALERT'

export interface Alert {
  id: number
  alert_id: string
  timestamp: string
  village_id: number | null
  node_id?: string
  village: string
  node: string
  hazard: SupportedAlertHazard
  hazard_type: SupportedHazardType
  alert_type: SupportedAlertType | string
  risk_score: number
  risk_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  severity: 'info' | 'warning' | 'critical'
  reasons: string[]
  reason: string
  sensor_values: AlertSensorValues
  status: 'ACTIVE' | 'RESOLVED'
  is_resolved: number
  data_source: string
  data_quality: string
  created_at: string
  message: string
  dominant_hazard?: string
  secondary_hazard?: string
}

export interface RecommendationItem {
  hazard_type?: string
  category: string
  action: string
  priority: 'low' | 'medium' | 'high'
}

export type SystemOperatingMode = 'SIMULATION' | 'REAL' | 'REAL_SENSOR'

export interface ESP32TelemetryPacket {
  node_id: string
  timestamp: string
  water_level_cm: number
  water_rise_rate: number
  rainfall_mm: number
  rainfall_intensity: number
  soil_moisture_1: number
  soil_moisture_2: number
  temperature_c: number
  humidity_pct: number
  pressure_hpa: number
  battery_level: number
}

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
  status: 'DISCONNECTED' | 'CONNECTED' | 'STALE'
  is_connected: boolean
  last_heartbeat_at: string | null
  packets_received_count: number
  stale_timeout_sec: number
  latest_telemetry: (ESP32TelemetryPacket & { recorded_at: string; data_quality: 'REAL' }) | null
  telemetry_history: Array<ESP32TelemetryPacket & { recorded_at: string; data_quality: 'REAL' }>
  data_quality: 'REAL'
  is_synthetic: 0
  computed_risks?: {
    water_stress: { score: number; level: string; factors: string[] }
    flood: { score: number; level: string; factors: string[] }
    landslide: { score: number; level: string; factors: string[] }
    multi_hazard: {
      composite_score: number
      category: string
      dominant_hazard: string
      cascade_triggered: boolean
      factors: string[]
    }
  } | null
}

// ---------------------------------------------------------------------------
// 2.0 Comprehensive Multi-Hazard Recommendations
// ---------------------------------------------------------------------------

export const MULTI_HAZARD_RECOMMENDATIONS: Record<string, RecommendationItem[]> = {
  high: [
    {
      hazard_type: 'compound',
      category: 'Emergency Evacuation',
      action: 'Activate high-altitude evacuation routes away from unstable gullies and riverbanks.',
      priority: 'high',
    },
    {
      hazard_type: 'flash_flood',
      category: 'Inundation Defense',
      action: 'Deploy emergency gabion sandbags, open reservoir spillways, and evacuate riverbank structures.',
      priority: 'high',
    },
    {
      hazard_type: 'landslide',
      category: 'Slope Stabilization',
      action: 'Sound community early-warning sirens; clear culverts and unblock hillside diversion ditches immediately.',
      priority: 'high',
    },
    {
      hazard_type: 'water_stress',
      category: 'Rationing & Buffer',
      action: 'Seal backup water reserves, dispatch emergency mobile tankers, and enforce emergency domestic rationing.',
      priority: 'high',
    },
    {
      hazard_type: 'compound',
      category: 'District Authority',
      action: 'Dispatch urgent SITREP to Reasi District Disaster Management Authority (DDMA) for emergency machinery deployment.',
      priority: 'high',
    },
  ],
  medium: [
    {
      hazard_type: 'flash_flood',
      category: 'Monitoring',
      action: 'Increase ultrasonic river gauge polling frequency to 5-minute intervals; inspect valley drainage bottlenecks.',
      priority: 'high',
    },
    {
      hazard_type: 'landslide',
      category: 'Geotechnical Inspection',
      action: 'Inspect hillside slope tension cracks and soil saturation probes along Panthal–Kakryal road corridors.',
      priority: 'medium',
    },
    {
      hazard_type: 'water_stress',
      category: 'Conservation',
      action: 'Implement non-essential water usage bans (irrigation and car washing); top off community buffer storage tanks.',
      priority: 'medium',
    },
    {
      hazard_type: 'compound',
      category: 'Community Alert',
      action: 'Broadcast WhatsApp & radio advisories to village water user committees regarding incoming weather fronts.',
      priority: 'medium',
    },
  ],
  low: [
    {
      hazard_type: 'water_stress',
      category: 'Routine Monitoring',
      action: 'Conduct weekly static water table and spring discharge inspections.',
      priority: 'low',
    },
    {
      hazard_type: 'flash_flood',
      category: 'Drainage Maintenance',
      action: 'Clear seasonal silt and debris from culverts before upcoming monsoon cycles.',
      priority: 'low',
    },
    {
      hazard_type: 'landslide',
      category: 'Vegetation Care',
      action: 'Inspect slope bio-engineering vetiver grass plantings and hillside terrace retainers.',
      priority: 'low',
    },
    {
      hazard_type: 'compound',
      category: 'Committee Meeting',
      action: 'Review disaster preparedness log at monthly Gram Panchayat water assembly.',
      priority: 'low',
    },
  ],
}

// ---------------------------------------------------------------------------
// Synthetic Village Reference Data (SMVDU Reasi Area)
// Expanded with Terrain, Geological, and Catchment Features
// ---------------------------------------------------------------------------

interface VillageInit {
  name: string
  district: string
  lat: number
  lon: number
  elev: number
  pop: number
  storage: number
  slope: number
  soil: 'clay_loam' | 'gravelly_silt' | 'fractured_shale' | 'alluvial'
  vegCover: number
  distRiver: number
  catchmentSqkm: number
}

const VILLAGE_INIT_DATA: VillageInit[] = [
  { name: 'SMVDU Campus',   district: 'Reasi', lat: 32.94134,  lon: 74.95356, elev: 680, pop: 2700, storage: 250000, slope: 18, soil: 'alluvial',        vegCover: 65, distRiver: 420, catchmentSqkm: 6.2 },
  { name: 'Kakryal',        district: 'Reasi', lat: 32.94000,  lon: 74.95000, elev: 675, pop: 1250, storage: 180000, slope: 22, soil: 'gravelly_silt',   vegCover: 52, distRiver: 280, catchmentSqkm: 4.8 },
  { name: 'Kotla',          district: 'Reasi', lat: 32.92880,  lon: 74.94630, elev: 690, pop: 800,  storage: 120000, slope: 31, soil: 'fractured_shale', vegCover: 38, distRiver: 150, catchmentSqkm: 3.5 },
  { name: 'Bhagta',         district: 'Reasi', lat: 32.944957, lon: 74.962253, elev: 685, pop: 950,  storage: 140000, slope: 25, soil: 'clay_loam',      vegCover: 48, distRiver: 310, catchmentSqkm: 5.1 },
  { name: 'Dudura',         district: 'Reasi', lat: 32.955128, lon: 74.968785, elev: 700, pop: 1100, storage: 165000, slope: 29, soil: 'fractured_shale', vegCover: 42, distRiver: 190, catchmentSqkm: 4.2 },
  { name: 'Sool',           district: 'Reasi', lat: 32.939212, lon: 74.938836, elev: 665, pop: 750,  storage: 110000, slope: 16, soil: 'alluvial',        vegCover: 68, distRiver: 95,  catchmentSqkm: 7.4 },
  { name: 'Dheerti',        district: 'Reasi', lat: 32.923688, lon: 74.961857, elev: 715, pop: 1300, storage: 150000, slope: 34, soil: 'fractured_shale', vegCover: 32, distRiver: 210, catchmentSqkm: 3.9 },
  { name: 'Manoon (Serli)', district: 'Reasi', lat: 32.932023, lon: 74.921110, elev: 705, pop: 850,  storage: 125000, slope: 27, soil: 'gravelly_silt',   vegCover: 44, distRiver: 340, catchmentSqkm: 4.5 },
  { name: 'Panthal',        district: 'Reasi', lat: 32.968345, lon: 74.978933, elev: 810, pop: 1415, storage: 200000, slope: 36, soil: 'fractured_shale', vegCover: 28, distRiver: 110, catchmentSqkm: 8.3 },
  { name: 'Treen Miyari',   district: 'Reasi', lat: 32.902933, lon: 74.913458, elev: 730, pop: 700,  storage: 105000, slope: 24, soil: 'clay_loam',      vegCover: 55, distRiver: 380, catchmentSqkm: 3.2 },
]

// ---------------------------------------------------------------------------
// Multi-Hazard Mathematical Formulations
// ---------------------------------------------------------------------------

export interface WaterStressInputs {
  rainfall_mm?: number
  rainfall?: number
  rainfall_deficit?: number
  temperature_c?: number
  temperature?: number
  humidity_pct?: number
  water_level_m?: number
  water_level?: number
  water_level_trend?: number
  flow_rate_lpm?: number
  population?: number
  storage_capacity_L?: number
  season?: string
  seasonal_information?: string
  soil_moisture?: number
  soil_moisture_pct?: number
  water_source_status?: string
  historical_water_availability?: number
}

export function computeWaterStress(inputs: WaterStressInputs): {
  score: number
  level: 'low' | 'medium' | 'high'
  factors: string[]
} {
  const rainfall_mm = inputs.rainfall_mm ?? inputs.rainfall ?? 12.0
  const temperature_c = inputs.temperature_c ?? inputs.temperature ?? 22.0
  let water_level_m = inputs.water_level_m ?? inputs.water_level ?? 1.8
  if (water_level_m > 15.0) water_level_m = water_level_m / 100.0 // Normalize cm to meters
  const flow_rate_lpm = inputs.flow_rate_lpm ?? 30.0
  const population = inputs.population ?? 850
  const water_level_trend = inputs.water_level_trend
  const rainfall_deficit = inputs.rainfall_deficit
  const soil_moisture = inputs.soil_moisture ?? inputs.soil_moisture_pct
  const status = inputs.water_source_status ?? 'ACTIVE'
  const hist = inputs.historical_water_availability

  let score = 25
  const factors: string[] = []

  // 1. Water source status check
  if (status === 'DRY' || status === 'DEPLETED') {
    score += 35
    factors.push(`Water Source Depleted / ${status}`)
  } else if (status === 'DEGRADED') {
    score += 20
    factors.push('Water Source Degraded Flow Status')
  }

  // 2. Rainfall deficit & ambient rainfall
  if (rainfall_deficit !== undefined && rainfall_deficit >= 65) {
    score += 28
    factors.push(`Severe Rainfall Deficit (${rainfall_deficit.toFixed(0)}% below normal)`)
  } else if (rainfall_mm < 3.0) {
    score += 26
    factors.push('Severe Rainfall Deficit (< 3mm)')
  } else if (rainfall_mm < 10.0) {
    score += 14
    factors.push('Low Ambient Rainfall (< 10mm)')
  }

  // 3. Water level & Trend
  if (water_level_m < 0.9) {
    score += 20
    factors.push('Depleted Source Reservoir (< 0.9m)')
  } else if (water_level_m < 1.6) {
    score += 10
  }

  if (water_level_trend !== undefined) {
    if (water_level_trend < -8.0) {
      score += 20
      factors.push(`Rapid Reservoir Depletion (${water_level_trend.toFixed(1)} cm/day)`)
    } else if (water_level_trend < -3.0) {
      score += 10
      factors.push(`Declining Water Table (${water_level_trend.toFixed(1)} cm/day)`)
    }
  }

  // 4. Soil moisture root-zone desiccation
  if (soil_moisture !== undefined) {
    if (soil_moisture < 18.0) {
      score += 20
      factors.push(`Critical Soil Desiccation (${soil_moisture.toFixed(0)}% VWC)`)
    } else if (soil_moisture < 28.0) {
      score += 10
      factors.push(`Low Root-Zone Moisture (${soil_moisture.toFixed(0)}% VWC)`)
    }
  }

  // 5. Temperature evaporative demand
  if (temperature_c > 30.0) {
    score += 18
    factors.push(`Extreme Evaporative Demand (${temperature_c.toFixed(1)}°C)`)
  } else if (temperature_c > 26.0) {
    score += 10
    factors.push('Elevated Temperature Stress')
  }

  // 6. Spring flow & demand balance
  if (flow_rate_lpm < 12.0) {
    score += 22
    factors.push('Critical Spring Flow Deficit (< 12 LPM)')
  } else if (flow_rate_lpm < 22.0) {
    score += 10
  }

  const dailyDemand = population * 60
  const dailySupply = flow_rate_lpm * 60 * 24
  if (dailySupply < dailyDemand) {
    score += 22
    factors.push('Daily Supply Lower Than Community Demand')
  } else if (dailySupply < dailyDemand * 1.3) {
    score += 10
  }

  // 7. Historical benchmark comparison
  if (hist !== undefined) {
    if (hist < 0.5) {
      score += 18
      factors.push('Discharge 50%+ Below Historical Baseline')
    } else if (hist < 0.75) {
      score += 9
    }
  }

  score = Math.min(100, Math.max(0, score))
  const level: 'low' | 'medium' | 'high' = score >= 65 ? 'high' : score >= 38 ? 'medium' : 'low'
  return { score, level, factors: factors.slice(0, 4) }
}

export interface FloodInputs {
  rainfall_mm?: number
  rainfall?: number
  peak_intensity_mm_hr?: number
  rainfall_intensity?: number
  recent_rainfall_accumulation?: number
  rainfall_72h_mm?: number
  forecast_rainfall?: number
  water_level_m?: number
  water_level?: number
  water_level_rise_rate?: number
  elevation_m?: number
  elevation?: number
  slope_deg?: number
  slope?: number
  distance_to_river_m?: number
  catchment_area_sqkm?: number
  soil_type?: string
  soil_moisture_pct?: number
  soil_moisture?: number
  topographic_wetness_index?: number
  historical_flood_exposure?: number
}

export function computeFloodRisk(inputs: FloodInputs): {
  score: number
  level: 'low' | 'medium' | 'high'
  factors: string[]
} {
  const rainfall_mm = inputs.rainfall_mm ?? inputs.rainfall ?? 12.0
  const peak_intensity_mm_hr = inputs.peak_intensity_mm_hr ?? inputs.rainfall_intensity ?? 10.0
  const distance_to_river_m = inputs.distance_to_river_m ?? 250.0
  const catchment_area_sqkm = inputs.catchment_area_sqkm ?? 5.0
  const soil_type = inputs.soil_type ?? 'clay_loam'
  const slope_deg = inputs.slope_deg ?? inputs.slope ?? 20.0
  let water_level_m = inputs.water_level_m ?? inputs.water_level
  if (water_level_m !== undefined && water_level_m > 15.0) water_level_m = water_level_m / 100.0
  const water_level_rise_rate = inputs.water_level_rise_rate
  const forecast_rainfall = inputs.forecast_rainfall
  const recent_rainfall_accumulation = inputs.recent_rainfall_accumulation ?? inputs.rainfall_72h_mm
  const hist = inputs.historical_flood_exposure

  let score = 15
  const factors: string[] = []

  // 1. Extreme rainfall intensity (Cloudburst / High rainfall intensity trigger)
  if (peak_intensity_mm_hr >= 50.0 || rainfall_mm >= 75.0) {
    score += 38
    factors.push(`Cloudburst / Extreme Rainfall Intensity (${peak_intensity_mm_hr.toFixed(0)} mm/hr)`)
  } else if (peak_intensity_mm_hr >= 20.0 || rainfall_mm >= 30.0) {
    score += 22
    factors.push('High rainfall intensity')
  }

  // 2. Stream stage & rise rate
  if (water_level_rise_rate !== undefined) {
    if (water_level_rise_rate >= 5.0) {
      score += 15
      factors.push('Rapid water-level increase')
    } else if (water_level_rise_rate >= 2.0) {
      score += 8
      factors.push(`Accelerating Inflow Rate (+${water_level_rise_rate.toFixed(1)} cm/hr)`)
    }
  }

  if (water_level_m !== undefined) {
    if (water_level_m >= 3.2) {
      score += 20
      factors.push(`Critical Channel Crest Height (${water_level_m.toFixed(2)} m)`)
    } else if (water_level_m >= 2.3) {
      score += 10
      factors.push(`High Stream Stage (${water_level_m.toFixed(2)} m)`)
    }
  }

  // 3. Riparian Proximity
  if (distance_to_river_m < 120) {
    score += 18
    factors.push(`Immediate Riverbed Proximity (${distance_to_river_m.toFixed(0)} m)`)
  } else if (distance_to_river_m < 220) {
    score += 10
    factors.push('Low Elevation Valley Confinement')
  }

  // 4. Elevated soil moisture
  const soil_moisture_pct = inputs.soil_moisture_pct ?? inputs.soil_moisture
  if (soil_moisture_pct !== undefined && soil_moisture_pct >= 55.0) {
    score += 8
    factors.push('Elevated soil moisture')
  }

  // 5. Forecast Rainfall & Accumulation
  if (forecast_rainfall !== undefined && forecast_rainfall >= 30.0) {
    score += 7
    factors.push('High forecast rainfall')
  }
  if (recent_rainfall_accumulation !== undefined && recent_rainfall_accumulation >= 60.0) {
    score += 10
    factors.push(`High Antecedent Catchment Saturation (${recent_rainfall_accumulation.toFixed(0)} mm)`)
  }

  // 6. Soil permeability & Runoff
  if (soil_type === 'alluvial' || soil_type === 'fractured_shale') {
    score += 8
    factors.push('High Runoff / Low Infiltration Soils')
  }

  // 7. Catchment Accumulation & Slope
  if (catchment_area_sqkm > 6.0) {
    score += 10
    factors.push(`Large Upstream Catchment Funnel (${catchment_area_sqkm.toFixed(1)} sq km)`)
  }
  if (slope_deg >= 30.0) {
    score += 8
    factors.push(`Steep Flank Accelerated Runoff (${slope_deg.toFixed(0)}°)`)
  }

  // 7. Verified Historical Exposure (only if explicitly provided)
  if (hist !== undefined && hist !== null) {
    if (hist >= 0.7) {
      score += 18
      factors.push(`Verified Historical High Flood Exposure (${hist.toFixed(2)})`)
    } else if (hist >= 0.4) {
      score += 10
    }
  }

  score = Math.min(100, Math.max(0, score))
  const level: 'low' | 'medium' | 'high' = score >= 65 ? 'high' : score >= 38 ? 'medium' : 'low'
  return { score, level, factors: factors.slice(0, 4) }
}

export interface LandslideInputs {
  rainfall_intensity?: number
  peak_intensity_mm_hr?: number
  cumulative_rainfall?: number
  rainfall_mm?: number
  antecedent_rainfall?: number
  rainfall_72h_mm?: number
  soil_moisture?: number
  soil_moisture_pct?: number
  soil_moisture_1?: number
  soil_moisture_2?: number
  slope?: number
  slope_deg?: number
  elevation?: number
  elevation_m?: number
  land_cover?: number | string
  vegetation_cover_pct?: number
  geology?: string
  soil_type?: string
  historical_landslide_inventory?: number
}

export function computeLandslideRisk(inputs: LandslideInputs): {
  score: number
  level: 'low' | 'medium' | 'high'
  factors: string[]
} {
  const slope_deg = inputs.slope_deg ?? inputs.slope ?? 22.0
  const rainfall_72h_mm = inputs.rainfall_72h_mm ?? inputs.antecedent_rainfall ?? (inputs.rainfall_mm ? inputs.rainfall_mm * 1.5 : 30.0)
  const rainfall_intensity = inputs.rainfall_intensity ?? inputs.peak_intensity_mm_hr ?? 10.0
  let soil_moisture_pct = inputs.soil_moisture_pct ?? inputs.soil_moisture
  if (soil_moisture_pct === undefined && (inputs.soil_moisture_1 !== undefined || inputs.soil_moisture_2 !== undefined)) {
    const m1 = inputs.soil_moisture_1 ?? inputs.soil_moisture_2 ?? 45.0
    const m2 = inputs.soil_moisture_2 ?? inputs.soil_moisture_1 ?? 45.0
    soil_moisture_pct = (m1 + m2) / 2.0
  }
  if (soil_moisture_pct === undefined) soil_moisture_pct = 45.0

  const soil_type = (inputs.geology ?? inputs.soil_type ?? 'clay_loam').toLowerCase()
  let vegetation_cover_pct = 50.0
  if (inputs.vegetation_cover_pct !== undefined) {
    vegetation_cover_pct = inputs.vegetation_cover_pct
  } else if (typeof inputs.land_cover === 'number') {
    vegetation_cover_pct = inputs.land_cover
  }
  const hist = inputs.historical_landslide_inventory

  let score = 12
  const factors: string[] = []

  // 1. Steep mountain slope
  if (slope_deg >= 34.0) {
    score += 35
    factors.push(`Critical Steep Terrain (${slope_deg.toFixed(0)}° Slope)`)
  } else if (slope_deg >= 28.0) {
    score += 22
    factors.push(`Steep Hillside Inclination (${slope_deg.toFixed(0)}° Slope)`)
  } else if (slope_deg >= 20.0) {
    score += 10
  } else if (slope_deg <= 12.0) {
    score -= 8
  }

  // 2. Soil pore saturation
  if (soil_moisture_pct >= 80.0) {
    score += 32
    factors.push(`Near-Total Soil Saturation (${soil_moisture_pct.toFixed(0)}% Moisture)`)
  } else if (soil_moisture_pct >= 65.0) {
    score += 20
    factors.push(`High Soil Moisture Saturation (${soil_moisture_pct.toFixed(0)}%)`)
  } else if (soil_moisture_pct >= 50.0) {
    score += 10
  } else if (soil_moisture_pct <= 25.0) {
    score -= 8
  }

  // 3. Cumulative / Antecedent Rainfall
  if (rainfall_72h_mm >= 80.0) {
    score += 28
    factors.push(`Severe Antecedent Rainfall (${rainfall_72h_mm.toFixed(0)}mm/72h)`)
  } else if (rainfall_72h_mm >= 50.0) {
    score += 16
    factors.push(`Sustained Rainfall Infiltration (${rainfall_72h_mm.toFixed(0)}mm/72h)`)
  }

  // 4. Rainfall intensity burst
  if (rainfall_intensity >= 40.0) {
    score += 22
    factors.push(`High Rainfall Burst Intensity (${rainfall_intensity.toFixed(0)}mm/hr)`)
  } else if (rainfall_intensity >= 20.0) {
    score += 12
  }

  // 5. Geotechnical lithology
  if (soil_type === 'fractured_shale' || soil_type === 'shale') {
    score += 18
    factors.push('Weak Fractured Shale Bedrock')
  } else if (soil_type === 'gravelly_silt') {
    score += 10
  }

  // 6. Vegetative root anchor
  if (vegetation_cover_pct <= 30.0) {
    score += 16
    factors.push(`Sparse Vegetative Root Anchor (< 30%)`)
  } else if (vegetation_cover_pct >= 65.0) {
    score -= 10
  }

  // 7. Verified Historical Landslide Inventory (strictly only if provided)
  if (hist !== undefined && hist !== null && hist > 0) {
    score += 18
    factors.push(`Verified Historical Landslide Activity (${hist})`)
  }

  score = Math.min(100, Math.max(0, score))
  const level: 'low' | 'medium' | 'high' = score >= 65 ? 'high' : score >= 38 ? 'medium' : 'low'
  return { score, level, factors: factors.slice(0, 4) }
}

export function computeMultiHazard(
  waterStress: { score: number; level?: string; factors?: string[] },
  flood: { score: number; level?: string; factors?: string[] },
  landslide: { score: number; level?: string; factors?: string[] }
): {
  compositeScore: number
  compositeLevel: 'low' | 'medium' | 'high'
  primaryThreat: 'water_stress' | 'flash_flood' | 'landslide' | 'compound'
  cascadeTriggered: boolean
  allTopFactors: string[]
  overall_multi_hazard_score: number
  overall_multi_hazard_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  dominant_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'COMBINED'
  secondary_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'NONE'
  risk_factors: string[]
} {
  const wsScore = waterStress.score ?? 0
  const ffScore = flood.score ?? 0
  const lsScore = landslide.score ?? 0

  // Cascading chain logic:
  // Extreme rain -> flood & landslide trigger simultaneously -> debris blocks tap -> compound disaster
  const cascadeTriggered = ffScore >= 50 && lsScore >= 50
  const cascadeBonus = cascadeTriggered ? 12 : 0

  const maxScore = Math.max(wsScore, ffScore, lsScore)
  const avgScore = (wsScore + ffScore + lsScore) / 3.0
  let composite = Math.round((0.55 * maxScore) + (0.45 * avgScore) + cascadeBonus)
  composite = Math.min(100, Math.max(0, composite))

  // Determine dominant & secondary hazard
  const perils = [
    { name: 'WATER_STRESS' as const, legacy: 'water_stress' as const, score: wsScore, factors: waterStress.factors || [] },
    { name: 'FLOOD' as const, legacy: 'flash_flood' as const, score: ffScore, factors: flood.factors || [] },
    { name: 'LANDSLIDE' as const, legacy: 'landslide' as const, score: lsScore, factors: landslide.factors || [] },
  ].sort((a, b) => b.score - a.score)

  let dominant_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'COMBINED' = perils[0].name
  let secondary_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'NONE' = perils[1].score > 15 ? perils[1].name : 'NONE'
  let primaryThreat: 'water_stress' | 'flash_flood' | 'landslide' | 'compound' = perils[0].legacy

  if (cascadeTriggered || (perils[0].score >= 50 && perils[1].score >= 50 && (perils[0].score - perils[1].score) <= 15)) {
    dominant_hazard = 'COMBINED'
    primaryThreat = 'compound'
  }

  const compositeLevel: 'low' | 'medium' | 'high' = composite >= 65 ? 'high' : composite >= 38 ? 'medium' : 'low'

  // Prototype categories: 0-24 NORMAL, 25-49 WATCH, 50-74 WARNING, 75-100 CRITICAL
  let overall_multi_hazard_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' = 'NORMAL'
  if (composite >= 75) overall_multi_hazard_category = 'CRITICAL'
  else if (composite >= 50) overall_multi_hazard_category = 'WARNING'
  else if (composite >= 25) overall_multi_hazard_category = 'WATCH'

  const prioritizedFactors: string[] = []
  if (cascadeTriggered) {
    prioritizedFactors.push('Cascading threat: coincident flood runoff & hillside instability')
  }
  perils.forEach((p) => {
    (p.factors || []).forEach((f) => {
      if (!prioritizedFactors.includes(f)) {
        prioritizedFactors.push(f)
      }
    })
  })
  const mergedFactors = prioritizedFactors.slice(0, 5)

  return {
    compositeScore: composite,
    compositeLevel,
    primaryThreat,
    cascadeTriggered,
    allTopFactors: mergedFactors,
    overall_multi_hazard_score: composite,
    overall_multi_hazard_category,
    dominant_hazard,
    secondary_hazard,
    risk_factors: mergedFactors,
  }
}

export function toRiskCategory(score: number): 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'WARNING'
  if (score >= 25) return 'WATCH'
  return 'NORMAL'
}

export interface EvaluatedHazardChannels {
  water_stress_alert: boolean
  water_stress_score: number
  water_stress_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  water_stress_reasons: string[]

  flood_alert: boolean
  flood_risk_score: number
  flood_risk_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  flood_risk_reasons: string[]

  landslide_alert: boolean
  landslide_risk_score: number
  landslide_risk_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  landslide_risk_reasons: string[]

  multi_hazard_alert: boolean
  overall_multi_hazard_score: number
  overall_multi_hazard_category: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
  dominant_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'COMBINED'
  secondary_hazard: 'WATER_STRESS' | 'FLOOD' | 'LANDSLIDE' | 'NONE'
  multi_hazard_reasons: string[]

  generated_alerts: Alert[]
}

export function evaluateDisasterAlertChannels(params: {
  village_id: number | null
  village_name: string
  node_id?: string
  node_uid?: string
  waterStress: { score: number; level?: string; factors?: string[] }
  flood: { score: number; level?: string; factors?: string[] }
  landslide: { score: number; level?: string; factors?: string[] }
  multiHazard: ReturnType<typeof computeMultiHazard>
  sensor_values: AlertSensorValues
  data_source?: string
  data_quality?: string
  timestamp?: string
}): EvaluatedHazardChannels {
  const wsScore = Math.min(100, Math.max(0, Math.round(params.waterStress.score)))
  const ffScore = Math.min(100, Math.max(0, Math.round(params.flood.score)))
  const lsScore = Math.min(100, Math.max(0, Math.round(params.landslide.score)))

  const wsCategory = toRiskCategory(wsScore)
  const ffCategory = toRiskCategory(ffScore)
  const lsCategory = toRiskCategory(lsScore)

  const wsReasons = params.waterStress.factors && params.waterStress.factors.length > 0
    ? [...params.waterStress.factors]
    : ['Spring discharge depletion vs community domestic demand deficit.']
  const ffReasons = params.flood.factors && params.flood.factors.length > 0
    ? [...params.flood.factors]
    : ['Rapid stream stage elevation and catchment runoff accumulation.']
  const lsReasons = params.landslide.factors && params.landslide.factors.length > 0
    ? [...params.landslide.factors]
    : ['High soil pore water pressure and shear strength reduction on steep slopes.']

  // Channel Alert Threshold: score >= 50 triggers WARNING or CRITICAL alert
  const water_stress_alert = wsScore >= 50
  const flood_alert = ffScore >= 50
  const landslide_alert = lsScore >= 50

  // Multi-Hazard Rule: Triggered when multiple hazards are simultaneously elevated (>= 2) OR cascading threat
  const elevatedCount = (water_stress_alert ? 1 : 0) + (flood_alert ? 1 : 0) + (landslide_alert ? 1 : 0)
  const multi_hazard_alert = elevatedCount >= 2 || params.multiHazard.cascadeTriggered

  const mhScore = params.multiHazard.compositeScore
  const mhCategory = params.multiHazard.overall_multi_hazard_category
  const mhReasons = params.multiHazard.allTopFactors && params.multiHazard.allTopFactors.length > 0
    ? [...params.multiHazard.allTopFactors]
    : ['Compound multi-hazard risk threshold exceeded across catchment.']

  const nowStr = params.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
  const dataSource = params.data_source || 'SIMULATION'
  const dataQuality = params.data_quality || 'SIMULATION / DEMONSTRATION DATA'
  const nodeId = params.node_id || (params.village_id ? `ESP32-JAL-REASI-${100 + params.village_id}` : 'JR-NODE-01')
  const nodeUid = params.node_uid || nodeId
  const vIdStr = params.village_id ? String(100 + params.village_id) : '01'

  const generated_alerts: Alert[] = []
  let seedCounter = 1

  // 1. WATER STRESS ALERT
  if (water_stress_alert) {
    generated_alerts.push({
      id: Number(params.village_id || 1) * 100 + seedCounter++,
      alert_id: `ALT-WS-${vIdStr}`,
      timestamp: nowStr,
      village_id: params.village_id,
      node_id: nodeId,
      village: params.village_name,
      node: nodeUid,
      hazard: 'Water Stress',
      hazard_type: 'WATER_STRESS',
      alert_type: 'WATER STRESS ALERT',
      risk_score: wsScore,
      risk_category: wsCategory,
      severity: wsScore >= 75 ? 'critical' : 'warning',
      reasons: wsReasons,
      reason: wsReasons.join('; '),
      sensor_values: params.sensor_values,
      status: 'ACTIVE',
      is_resolved: 0,
      data_source: dataSource,
      data_quality: dataQuality,
      created_at: new Date().toISOString(),
      message: `[${dataSource.toUpperCase()}] ${params.village_name}: Water Stress ${wsCategory} (${wsScore}/100). ${wsReasons[0] || 'Reservoir storage depletion active.'}`,
    })
  }

  // 2. FLOOD ALERT
  if (flood_alert) {
    generated_alerts.push({
      id: Number(params.village_id || 1) * 100 + seedCounter++,
      alert_id: `ALT-FL-${vIdStr}`,
      timestamp: nowStr,
      village_id: params.village_id,
      node_id: nodeId,
      village: params.village_name,
      node: nodeUid,
      hazard: 'Flood',
      hazard_type: 'FLOOD',
      alert_type: 'FLOOD ALERT',
      risk_score: ffScore,
      risk_category: ffCategory,
      severity: ffScore >= 75 ? 'critical' : 'warning',
      reasons: ffReasons,
      reason: ffReasons.join('; '),
      sensor_values: params.sensor_values,
      status: 'ACTIVE',
      is_resolved: 0,
      data_source: dataSource,
      data_quality: dataQuality,
      created_at: new Date().toISOString(),
      message: `[${dataSource.toUpperCase()}] ${params.village_name}: Flood Risk ${ffCategory} (${ffScore}/100). ${ffReasons[0] || 'Rapid water rise detected.'}`,
    })
  }

  // 3. LANDSLIDE ALERT
  if (landslide_alert) {
    generated_alerts.push({
      id: Number(params.village_id || 1) * 100 + seedCounter++,
      alert_id: `ALT-LS-${vIdStr}`,
      timestamp: nowStr,
      village_id: params.village_id,
      node_id: nodeId,
      village: params.village_name,
      node: nodeUid,
      hazard: 'Landslide',
      hazard_type: 'LANDSLIDE',
      alert_type: 'LANDSLIDE ALERT',
      risk_score: lsScore,
      risk_category: lsCategory,
      severity: lsScore >= 75 ? 'critical' : 'warning',
      reasons: lsReasons,
      reason: lsReasons.join('; '),
      sensor_values: params.sensor_values,
      status: 'ACTIVE',
      is_resolved: 0,
      data_source: dataSource,
      data_quality: dataQuality,
      created_at: new Date().toISOString(),
      message: `[${dataSource.toUpperCase()}] ${params.village_name}: Landslide Hazard ${lsCategory} (${lsScore}/100). ${lsReasons[0] || 'Pore saturation exceeding shear strength.'}`,
    })
  }

  // 4. MULTI-HAZARD ALERT (Coexists with individual hazard alerts when >= 2 elevated)
  if (multi_hazard_alert) {
    generated_alerts.push({
      id: Number(params.village_id || 1) * 100 + seedCounter++,
      alert_id: `ALT-MH-${vIdStr}`,
      timestamp: nowStr,
      village_id: params.village_id,
      node_id: nodeId,
      village: params.village_name,
      node: nodeUid,
      hazard: 'Multi-Hazard',
      hazard_type: 'MULTI_HAZARD',
      alert_type: 'MULTI-HAZARD ALERT',
      risk_score: mhScore,
      risk_category: mhCategory,
      severity: mhScore >= 75 ? 'critical' : 'warning',
      reasons: mhReasons,
      reason: mhReasons.join('; '),
      sensor_values: params.sensor_values,
      status: 'ACTIVE',
      is_resolved: 0,
      data_source: dataSource,
      data_quality: dataQuality,
      created_at: new Date().toISOString(),
      message: `[${dataSource.toUpperCase()}] ${params.village_name}: Multi-Hazard Compound Threat ${mhCategory} (${mhScore}/100). Dominant: ${params.multiHazard.dominant_hazard}. Multiple hazards simultaneously elevated.`,
      dominant_hazard: params.multiHazard.dominant_hazard,
      secondary_hazard: params.multiHazard.secondary_hazard,
    })
  }

  return {
    water_stress_alert,
    water_stress_score: wsScore,
    water_stress_category: wsCategory,
    water_stress_reasons: wsReasons,

    flood_alert,
    flood_risk_score: ffScore,
    flood_risk_category: ffCategory,
    flood_risk_reasons: ffReasons,

    landslide_alert,
    landslide_risk_score: lsScore,
    landslide_risk_category: lsCategory,
    landslide_risk_reasons: lsReasons,

    multi_hazard_alert,
    overall_multi_hazard_score: mhScore,
    overall_multi_hazard_category: mhCategory,
    dominant_hazard: params.multiHazard.dominant_hazard,
    secondary_hazard: params.multiHazard.secondary_hazard,
    multi_hazard_reasons: mhReasons,

    generated_alerts,
  }
}

// ---------------------------------------------------------------------------
// JalRakshak 2.0 Central Store
// ---------------------------------------------------------------------------

class JalRakshakStore {
  villages: Village[] = []
  waterSources: WaterSource[] = []
  climateReadings: ClimateReading[] = []
  soilReadings: SoilReading[] = []
  sensorDevices: SensorDevice[] = []
  riskPredictions: RiskPrediction[] = []
  hazardAssessments: HazardAssessment[] = []
  alerts: Alert[] = []
  activeSimulationPreset: string = 'nominal'
  operatingMode: SystemOperatingMode = 'SIMULATION'
  realHardware: RealHardwareStatus = {
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
    stale_timeout_sec: 60,
    latest_telemetry: null,
    telemetry_history: [],
    data_quality: 'REAL',
    is_synthetic: 0,
    computed_risks: null,
  }
  private listeners: Array<() => void> = []
  private initialized = false

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  notify() {
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (e) {
        console.error(e)
      }
    })
  }

  getOperatingMode(): SystemOperatingMode {
    this.init()
    return this.operatingMode
  }

  setOperatingMode(mode: SystemOperatingMode) {
    this.init()
    this.operatingMode = mode
    this.save()
    this.notify()
  }

  getRealHardwareStatus(): RealHardwareStatus {
    this.init()
    if (this.realHardware.is_connected && this.realHardware.last_heartbeat_at) {
      const elapsed = Date.now() - new Date(this.realHardware.last_heartbeat_at).getTime()
      if (elapsed > this.realHardware.stale_timeout_sec * 1000) {
        this.realHardware.status = 'STALE'
      } else {
        this.realHardware.status = 'CONNECTED'
      }
    } else {
      this.realHardware.status = 'DISCONNECTED'
    }
    return { ...this.realHardware }
  }

  disconnectRealHardware(): RealHardwareStatus {
    this.init()
    this.realHardware = {
      ...this.realHardware,
      status: 'DISCONNECTED',
      is_connected: false,
      last_heartbeat_at: null,
      latest_telemetry: null,
      computed_risks: null,
    }
    const dev = this.sensorDevices.find((d) => d.device_uid.toUpperCase() === 'JR-NODE-01')
    if (dev) {
      dev.status = 'offline'
    }
    this.save()
    this.notify()
    return { ...this.realHardware }
  }

  init() {
    if (this.initialized) return

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('jalrakshak_2_state')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          this.villages = parsed.villages || []
          this.waterSources = parsed.waterSources || []
          this.climateReadings = parsed.climateReadings || []
          this.soilReadings = parsed.soilReadings || []
          this.sensorDevices = parsed.sensorDevices || []
          this.riskPredictions = parsed.riskPredictions || []
          this.hazardAssessments = parsed.hazardAssessments || []
          this.alerts = parsed.alerts || []
          this.activeSimulationPreset = parsed.activeSimulationPreset || 'nominal'
          this.operatingMode = parsed.operatingMode || 'SIMULATION'
          if (parsed.realHardware) {
            this.realHardware = parsed.realHardware
          }
          // Ensure JR-NODE-01 is present in sensorDevices
          if (!this.sensorDevices.some((d) => d.device_uid.toUpperCase() === 'JR-NODE-01')) {
            this.sensorDevices.push({
              id: 11,
              village_id: 1,
              device_uid: 'JR-NODE-01',
              device_type: 'esp32_gateway',
              status: this.realHardware.is_connected ? 'active' : 'offline',
              battery_pct: this.realHardware.latest_telemetry?.battery_level ?? 0,
              rssi_dbm: this.realHardware.is_connected ? -65 : 0,
              last_ping: this.realHardware.last_heartbeat_at || '',
            })
          }
          if (this.alerts.length === 0 || !this.alerts[0].alert_id || !this.alerts[0].sensor_values) {
            this.refreshAllHazardAssessments()
          }
          this.initialized = true
          return
        } catch (e) {
          console.warn('Failed to parse saved state, regenerating seed data', e)
        }
      }
    }

    this.seed()
    this.save()
    this.initialized = true
  }

  save() {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        'jalrakshak_2_state',
        JSON.stringify({
          villages: this.villages,
          waterSources: this.waterSources,
          climateReadings: this.climateReadings,
          soilReadings: this.soilReadings,
          sensorDevices: this.sensorDevices,
          riskPredictions: this.riskPredictions,
          hazardAssessments: this.hazardAssessments,
          alerts: this.alerts,
          activeSimulationPreset: this.activeSimulationPreset,
          operatingMode: this.operatingMode,
          realHardware: this.realHardware,
        })
      )
    } catch {
      // ignore
    }
  }

  private seed() {
    // 1. Seed 10 villages
    this.villages = VILLAGE_INIT_DATA.map((v, idx) => ({
      id: idx + 1,
      name: v.name,
      district: v.district,
      latitude: v.lat,
      longitude: v.lon,
      elevation_m: v.elev,
      population: v.pop,
      storage_capacity_L: v.storage,
      slope_deg: v.slope,
      soil_type: v.soil,
      vegetation_cover_pct: v.vegCover,
      distance_to_river_m: v.distRiver,
      catchment_area_sqkm: v.catchmentSqkm,
      created_at: new Date(2025, 0, 1).toISOString(),
    }))

    // 2. Seed Sources
    let sId = 1
    this.villages.forEach((v) => {
      this.waterSources.push(
        {
          id: sId++,
          village_id: v.id,
          source_name: `${v.name} Hillside Spring`,
          source_type: 'spring',
          water_level_m: 2.1,
          flow_rate_lpm: 26.5,
          last_updated: new Date().toISOString(),
        },
        {
          id: sId++,
          village_id: v.id,
          source_name: `${v.name} Valley Tap / Stream`,
          source_type: 'river_tap',
          water_level_m: 3.4,
          flow_rate_lpm: 72.0,
          last_updated: new Date().toISOString(),
        },
        {
          id: sId++,
          village_id: v.id,
          source_name: `${v.name} Community Reservoir`,
          source_type: 'tank',
          water_level_m: 4.2,
          flow_rate_lpm: 45.0,
          last_updated: new Date().toISOString(),
        }
      )
    })

    // 3. Seed Climate History & Soil
    let cId = 1
    let soId = 1
    const baseDate = new Date(2025, 0, 1)

    this.villages.forEach((v) => {
      // 365 days of readings
      for (let day = 0; day < 365; day++) {
        const d = new Date(baseDate.getTime() + day * 86400000)
        const m = d.getMonth() + 1
        const isMonsoon = m >= 7 && m <= 8

        const rain = isMonsoon
          ? Math.round((Math.random() * 35 + 5) * 10) / 10
          : Math.random() < 0.35 ? 0 : Math.round((Math.random() * 8) * 10) / 10

        const intensity = rain > 15 ? Math.round((rain * 1.8) * 10) / 10 : 0
        const temp = Math.round((18 + 12 * Math.sin((day / 365) * Math.PI * 2) - (v.elevation_m / 1000) * 5) * 10) / 10
        const humidity = isMonsoon ? Math.round(75 + Math.random() * 20) : Math.round(45 + Math.random() * 25)
        const season = m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'

        this.climateReadings.push({
          id: cId++,
          village_id: v.id,
          recorded_date: d.toISOString().split('T')[0],
          rainfall_mm: rain,
          peak_intensity_mm_hr: intensity,
          temperature_c: temp,
          humidity_pct: humidity,
          season,
          soil_moisture_pct: Math.round(Math.min(95, 30 + rain * 1.2)),
        })
      }

      // Soil reading
      this.soilReadings.push({
        id: soId++,
        village_id: v.id,
        vwc_shallow_pct: 38.5,
        vwc_deep_pct: 42.0,
        saturation_index: 0.58,
        recorded_at: new Date().toISOString(),
      })

      // Sensor Gateway
      this.sensorDevices.push({
        id: v.id,
        village_id: v.id,
        device_uid: `ESP32-JAL-REASI-${100 + v.id}`,
        device_type: 'esp32_gateway',
        status: 'active',
        battery_pct: Math.round(82 + Math.random() * 16),
        rssi_dbm: Math.round(-62 - Math.random() * 15),
        last_ping: new Date().toISOString(),
      })
    })

    // Physical ESP32 Hardware Node (Initial state: Disconnected / Awaiting telemetry)
    this.sensorDevices.push({
      id: 11,
      village_id: 1,
      device_uid: 'JR-NODE-01',
      device_type: 'esp32_gateway',
      status: 'offline',
      battery_pct: 0,
      rssi_dbm: 0,
      last_ping: '',
    })

    // 4. Initial Multi-Hazard Assessments
    this.refreshAllHazardAssessments()
  }

  refreshAllHazardAssessments() {
    this.hazardAssessments = []
    this.alerts = []
    let aId = 1
    let alertId = 1

    this.villages.forEach((v) => {
      // Recent climate values
      const recentReadings = this.climateReadings.filter((c) => c.village_id === v.id).slice(-3)
      const latestReading = recentReadings[recentReadings.length - 1] || {
        rainfall_mm: 8.0,
        peak_intensity_mm_hr: 12.0,
        temperature_c: 24.0,
        humidity_pct: 60.0,
        season: 'summer',
      }

      const rain72h = recentReadings.reduce((sum, r) => sum + r.rainfall_mm, 0)
      const soilMoisture = (latestReading as any).soil_moisture_pct || 45.0

      const waterRes = computeWaterStress({
        rainfall_mm: latestReading.rainfall_mm,
        temperature_c: latestReading.temperature_c,
        humidity_pct: latestReading.humidity_pct,
        water_level_m: 2.1,
        flow_rate_lpm: 32.0,
        population: v.population,
        storage_capacity_L: v.storage_capacity_L,
        season: latestReading.season,
      })

      const src = this.waterSources.find((s) => s.village_id === v.id)
      const wLevel = src ? src.water_level_m : 2.1
      const riseRate = latestReading.peak_intensity_mm_hr >= 25 ? Number((latestReading.peak_intensity_mm_hr * 0.4).toFixed(1)) : 0
      const forecastRain = latestReading.rainfall_mm >= 30 ? Math.round(latestReading.rainfall_mm * 1.2) : 15

      const floodRes = computeFloodRisk({
        rainfall_mm: latestReading.rainfall_mm,
        peak_intensity_mm_hr: latestReading.peak_intensity_mm_hr,
        water_level_m: wLevel,
        water_level_rise_rate: riseRate,
        forecast_rainfall: forecastRain,
        soil_moisture_pct: soilMoisture,
        distance_to_river_m: v.distance_to_river_m,
        catchment_area_sqkm: v.catchment_area_sqkm,
        soil_type: v.soil_type,
        slope_deg: v.slope_deg,
      })

      const landslideRes = computeLandslideRisk({
        slope_deg: v.slope_deg,
        rainfall_72h_mm: rain72h,
        soil_moisture_pct: soilMoisture,
        soil_type: v.soil_type,
        vegetation_cover_pct: v.vegetation_cover_pct,
      })

      const multiRes = computeMultiHazard(waterRes, floodRes, landslideRes)

      this.hazardAssessments.push({
        id: aId++,
        village_id: v.id,
        water_stress_score: waterRes.score,
        water_stress_level: waterRes.level,
        flood_risk_score: floodRes.score,
        flood_risk_level: floodRes.level,
        landslide_risk_score: landslideRes.score,
        landslide_risk_level: landslideRes.level,
        composite_score: multiRes.compositeScore,
        composite_level: multiRes.compositeLevel,
        primary_threat: multiRes.primaryThreat,
        cascade_triggered: multiRes.cascadeTriggered,
        top_factors: multiRes.allTopFactors,
        assessed_at: new Date().toISOString(),
      })

      const dev = this.sensorDevices.find((d) => d.village_id === v.id)
      const nodeUid = dev ? dev.device_uid : `ESP32-JAL-REASI-${100 + v.id}`
      const sensorValues: AlertSensorValues = {
        water_level_m: Number(wLevel.toFixed(2)),
        water_rise_rate: Number(riseRate.toFixed(1)),
        rainfall_mm: Number(latestReading.rainfall_mm.toFixed(1)),
        peak_intensity_mm_hr: Number(latestReading.peak_intensity_mm_hr.toFixed(1)),
        soil_moisture_pct: Math.round(soilMoisture),
        temperature_c: Number(latestReading.temperature_c.toFixed(1)),
        humidity_pct: Math.round(latestReading.humidity_pct),
        flow_rate_lpm: src ? Number(src.flow_rate_lpm.toFixed(1)) : 35.0,
        battery_pct: dev ? dev.battery_pct : 88,
      }
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'

      const channelRes = evaluateDisasterAlertChannels({
        village_id: v.id,
        village_name: v.name,
        node_id: nodeUid,
        node_uid: nodeUid,
        waterStress: waterRes,
        flood: floodRes,
        landslide: landslideRes,
        multiHazard: multiRes,
        sensor_values: sensorValues,
        data_source: 'SIMULATION',
        data_quality: 'SIMULATION / DEMONSTRATION DATA',
        timestamp: nowStr,
      })

      this.alerts.push(...channelRes.generated_alerts)
    })

    // Seed one resolved historical record for verification only if alerts exist
    const histVillage = this.villages[1] || this.villages[0]
    if (histVillage && this.alerts.length > 0) {
      this.alerts.push({
        id: alertId++,
        alert_id: 'ALT-HIST-099',
        timestamp: '2026-10-22 14:15:00 UTC',
        village_id: histVillage.id,
        node_id: `ESP32-JAL-REASI-${100 + histVillage.id}`,
        village: histVillage.name,
        node: `ESP32-JAL-REASI-${100 + histVillage.id}`,
        hazard: 'Flood',
        hazard_type: 'FLOOD',
        alert_type: 'FLOOD ALERT',
        risk_score: 58,
        risk_category: 'WARNING',
        severity: 'warning',
        reasons: ['Transient stream stage rise resolved following storm subsidence; channel baseline normal.'],
        reason: 'Transient stream stage rise resolved following storm subsidence; channel baseline normal.',
        sensor_values: {
          water_level_m: 2.1,
          water_rise_rate: 0.0,
          rainfall_mm: 12.0,
          peak_intensity_mm_hr: 8.0,
          soil_moisture_pct: 46,
          temperature_c: 21.0,
          humidity_pct: 62,
          flow_rate_lpm: 38.0,
          battery_pct: 91,
        },
        status: 'RESOLVED',
        is_resolved: 1,
        data_source: 'SIMULATION',
        data_quality: 'SIMULATION / DEMONSTRATION DATA',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        message: `[SIMULATION] ${histVillage.name}: Flood warning resolved.`,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Telemetry Simulator Presets (Scenarios A through H)
  // ---------------------------------------------------------------------------
  applyTelemetryPreset(preset: string) {
    this.init()
    const p = preset.toLowerCase().trim()
    this.activeSimulationPreset = preset
    const now = new Date()

    this.villages.forEach((v) => {
      let rain = 10.0
      let intensity = 8.0
      let temp = 22.0
      let humidity = 60
      let soilM = 42.0
      let flow = 38.0
      let wLevel = 2.1
      let histRain1 = 10.0
      let histRain2 = 10.0

      if (p === 'scenario_a' || p === 'water_stress' || p === 'drought' || p === 'a') {
        // Scenario A: Water Stress ONLY elevated (>= 75 CRITICAL), Flood normal, Landslide normal
        rain = 0.0
        intensity = 0.0
        temp = 35.0
        humidity = 24
        soilM = 14.0
        flow = 5.5
        wLevel = 0.55
        histRain1 = 0.0
        histRain2 = 0.0
      } else if (p === 'scenario_b' || p === 'flood' || p === 'b') {
        // Scenario B: Flood ONLY elevated (>= 75 CRITICAL), Water Stress normal, Landslide normal
        rain = 75.0
        intensity = 55.0
        temp = 20.0
        humidity = 88
        soilM = 45.0
        flow = 80.0
        wLevel = 3.6
        histRain1 = 10.0
        histRain2 = 12.0
      } else if (p === 'scenario_c' || p === 'landslide' || p === 'c') {
        // Scenario C: Landslide ONLY elevated (>= 75 CRITICAL), Water Stress normal, Flood normal
        rain = 8.0
        intensity = 6.0
        temp = 19.0
        humidity = 80
        soilM = 88.0
        flow = 36.0
        wLevel = 1.85
        histRain1 = 45.0
        histRain2 = 48.0
      } else if (p === 'scenario_d' || p === 'ws_flood' || p === 'd') {
        // Scenario D: Water Stress + Flood (Both elevated >= 50 -> Multi-Hazard triggered)
        rain = 60.0
        intensity = 48.0
        temp = 32.0
        humidity = 55
        soilM = 40.0
        flow = 6.0
        wLevel = 3.4
        histRain1 = 8.0
        histRain2 = 10.0
      } else if (p === 'scenario_e' || p === 'flood_landslide' || p === 'cloudburst' || p === 'monsoon_peak' || p === 'e') {
        // Scenario E: Flood + Landslide (Both elevated >= 50 -> Multi-Hazard triggered)
        rain = 92.0
        intensity = 65.0
        temp = 19.0
        humidity = 90
        soilM = 88.0
        flow = 110.0
        wLevel = 3.8
        histRain1 = 35.0
        histRain2 = 40.0
      } else if (p === 'scenario_f' || p === 'ws_landslide' || p === 'f') {
        // Scenario F: Water Stress + Landslide (Both elevated >= 50 -> Multi-Hazard triggered)
        rain = 4.0
        intensity = 3.0
        temp = 33.0
        humidity = 40
        soilM = 86.0
        flow = 5.0
        wLevel = 0.58
        histRain1 = 45.0
        histRain2 = 50.0
      } else if (p === 'scenario_g' || p === 'all_three' || p === 'multi_hazard' || p === 'compound' || p === 'g') {
        // Scenario G: All Three Elevated (Water Stress + Flood + Landslide -> Multi-Hazard triggered, all 4 channels)
        rain = 90.0
        intensity = 65.0
        temp = 33.0
        humidity = 85
        soilM = 88.0
        flow = 4.5
        wLevel = 3.8
        histRain1 = 45.0
        histRain2 = 50.0
      } else {
        // Scenario H: All Normal (< 30 NORMAL) -> Zero active alerts
        rain = 10.0
        intensity = 6.0
        temp = 21.0
        humidity = 55
        soilM = 42.0
        flow = 42.0
        wLevel = 2.2
        histRain1 = 8.0
        histRain2 = 9.0
      }

      // Update primary water source level & flow
      const src = this.waterSources.find((s) => s.village_id === v.id)
      if (src) {
        src.water_level_m = wLevel
        src.flow_rate_lpm = flow
        src.last_updated = now.toISOString()
      }

      // Update recent historical readings to establish target antecedent rainfall
      const vClimate = this.climateReadings.filter((c) => c.village_id === v.id)
      if (vClimate.length >= 2) {
        vClimate[vClimate.length - 2].rainfall_mm = histRain1
        vClimate[vClimate.length - 2].soil_moisture_pct = Math.round(soilM)
        vClimate[vClimate.length - 1].rainfall_mm = histRain2
        vClimate[vClimate.length - 1].soil_moisture_pct = Math.round(soilM)
      }

      // Push latest reading
      this.climateReadings.push({
        id: this.climateReadings.length + 1,
        village_id: v.id,
        recorded_date: now.toISOString().split('T')[0],
        rainfall_mm: Math.round(rain * 10) / 10,
        peak_intensity_mm_hr: Math.round(intensity * 10) / 10,
        temperature_c: Math.round(temp * 10) / 10,
        humidity_pct: humidity,
        season: temp > 28 ? 'summer' : 'autumn',
        soil_moisture_pct: Math.round(soilM),
        is_cloudburst_flag: intensity >= 50,
      })
    })

    this.refreshAllHazardAssessments()
    this.save()
    this.notify()
  }

  getDashboardStats() {
    this.init()
    const totalVillages = this.villages.length
    const totalSources = this.waterSources.length

    // Multi-hazard counts
    const compositeCounts = { low: 0, medium: 0, high: 0 }
    const waterStressCounts = { low: 0, medium: 0, high: 0 }
    const floodCounts = { low: 0, medium: 0, high: 0 }
    const landslideCounts = { low: 0, medium: 0, high: 0 }
    let cascadeEvents = 0

    let totalWsScore = 0
    let totalFfScore = 0
    let totalLsScore = 0
    let totalCompScore = 0

    this.hazardAssessments.forEach((h) => {
      compositeCounts[h.composite_level]++
      waterStressCounts[h.water_stress_level]++
      floodCounts[h.flood_risk_level]++
      landslideCounts[h.landslide_risk_level]++
      totalWsScore += h.water_stress_score
      totalFfScore += h.flood_risk_score
      totalLsScore += h.landslide_risk_score
      totalCompScore += h.composite_score
      if (h.cascade_triggered) cascadeEvents++
    })

    const nAssess = Math.max(1, this.hazardAssessments.length)
    const avgWsScore = Math.round(totalWsScore / nAssess)
    const avgFfScore = Math.round(totalFfScore / nAssess)
    const avgLsScore = Math.round(totalLsScore / nAssess)
    const avgCompScore = Math.round(totalCompScore / nAssess)

    const openAlerts = this.alerts.filter((a) => a.is_resolved === 0).length
    const criticalAlerts = this.alerts.filter((a) => a.severity === 'critical' && a.is_resolved === 0).length

    // Specific alert counts by hazard
    const waterStressAlerts = this.alerts.filter(
      (a) => a.hazard_type === 'water_stress' && a.is_resolved === 0
    ).length
    const floodAlerts = this.alerts.filter(
      (a) => (a.hazard_type === 'flash_flood' || (a.hazard_type as string) === 'flood') && a.is_resolved === 0
    ).length
    const landslideAlerts = this.alerts.filter(
      (a) => a.hazard_type === 'landslide' && a.is_resolved === 0
    ).length
    const criticalMultiHazardAlerts = this.alerts.filter(
      (a) => a.severity === 'critical' && a.is_resolved === 0
    ).length

    // Active sensor nodes
    const activeSensorNodes = this.sensorDevices.filter((s) => s.status === 'active').length

    // Recent 30 readings average
    const recent = this.climateReadings.slice(-30)
    const avgRain = recent.length ? recent.reduce((s, r) => s + r.rainfall_mm, 0) / recent.length : 0
    const avgTemp = recent.length ? recent.reduce((s, r) => s + r.temperature_c, 0) / recent.length : 0
    const avgHum = recent.length ? recent.reduce((s, r) => s + r.humidity_pct, 0) / recent.length : 0

    const toCat = (score: number): 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' => {
      if (score >= 75) return 'CRITICAL'
      if (score >= 50) return 'WARNING'
      if (score >= 25) return 'WATCH'
      return 'NORMAL'
    }

    // Per-village chart dataset combining water level, rainfall, soil moisture, and peril scores
    const villageChartData = this.villages.map((v) => {
      const a = this.hazardAssessments.find((h) => h.village_id === v.id)
      const src = this.waterSources.find((s) => s.village_id === v.id)
      const climate = this.climateReadings.filter((c) => c.village_id === v.id).slice(-1)[0]
      const sensor = this.sensorDevices.find((d) => d.village_id === v.id)

      const wLevel = src ? src.water_level_m : Number((1.8 + (v.id % 5) * 0.35).toFixed(2))
      const rain = climate ? climate.rainfall_mm : Number((10 + (v.id % 4) * 5.2).toFixed(1))
      const soilMoisture = climate ? climate.soil_moisture_pct : 45
      const wsScore = a ? a.water_stress_score : 20
      const ffScore = a ? a.flood_risk_score : 18
      const lsScore = a ? a.landslide_risk_score : 22
      const compScore = a ? a.composite_score : 20

      return {
        village_id: v.id,
        village: v.name,
        district: v.district,
        water_level: wLevel,
        rainfall: rain,
        soil_moisture: soilMoisture,
        water_stress: wsScore,
        flood_risk: ffScore,
        landslide_risk: lsScore,
        overall_risk: compScore,
        battery: sensor ? sensor.battery_pct : 88,
        data_quality: 'SYNTHETIC',
      }
    })

    const isRealMode = this.operatingMode === 'REAL'
    const realConnected = this.realHardware.is_connected
    const effectiveActiveNodes = isRealMode
      ? (realConnected ? 1 : 0)
      : activeSensorNodes

    return {
      operating_mode: this.operatingMode,
      real_hardware: { ...this.realHardware },
      hardware_connected: realConnected,
      total_villages: totalVillages,
      total_water_sources: totalSources,
      active_sensor_nodes: effectiveActiveNodes,
      total_sensor_nodes: isRealMode ? 1 : this.sensorDevices.length,
      active_preset: this.activeSimulationPreset,
      composite_counts: compositeCounts,
      hazard_breakdown: {
        water_stress: waterStressCounts,
        flash_flood: floodCounts,
        landslide: landslideCounts,
        cascade_events: cascadeEvents,
      },
      alert_counts: {
        total: this.alerts.length,
        open: openAlerts,
        critical: criticalAlerts,
        water_stress: waterStressAlerts,
        flood: floodAlerts,
        landslide: landslideAlerts,
        critical_multi_hazard: criticalMultiHazardAlerts,
      },
      multi_hazard_kpis: {
        total_villages: totalVillages,
        active_sensor_nodes: activeSensorNodes,
        water_stress_alerts: waterStressAlerts,
        flood_alerts: floodAlerts,
        landslide_alerts: landslideAlerts,
        critical_multi_hazard_alerts: criticalMultiHazardAlerts,
      },
      hazard_summaries: {
        water_stress: {
          category: toCat(avgWsScore),
          avg_score: avgWsScore,
          high_risk_villages: waterStressCounts.high,
          active_alerts: waterStressAlerts,
          primary_driver: 'Spring discharge depletion vs community demand deficit',
          status_message:
            avgWsScore >= 50
              ? 'Acute hydrological drought stress detected across higher ridge catchments; reservoir replenishment critical.'
              : 'Mountain spring replenishment and storage capacity are operating within nominal thresholds.',
          data_quality: 'SYNTHETIC (DEMO TELEMETRY)',
        },
        flood: {
          category: toCat(avgFfScore),
          avg_score: avgFfScore,
          high_risk_villages: floodCounts.high,
          active_alerts: floodAlerts,
          primary_driver: 'Peak convective rainfall intensity & valley stream bottlenecking',
          status_message:
            avgFfScore >= 50
              ? 'High flash flood surge threat in narrow stream corridors; ultrasonic gauges monitoring river stage breaches.'
              : 'Riverbed discharge rates and stream stage levels are within seasonal baseline limits.',
          data_quality: 'SYNTHETIC (DEMO TELEMETRY)',
        },
        landslide: {
          category: toCat(avgLsScore),
          avg_score: avgLsScore,
          high_risk_villages: landslideCounts.high,
          active_alerts: landslideAlerts,
          primary_driver: 'Pore water pressure saturation on steep fractured shale slopes',
          status_message:
            avgLsScore >= 50
              ? 'Critical hillside instability on slopes >28°; sustained soil pore saturation exceeding shear strength.'
              : 'Hillside slope stability indices are stable with nominal shear strength retention.',
          data_quality: 'SYNTHETIC (DEMO TELEMETRY)',
        },
        multi_hazard: {
          category: toCat(avgCompScore),
          avg_score: avgCompScore,
          cascade_events: cascadeEvents,
          active_alerts: criticalMultiHazardAlerts,
          primary_driver: 'Compound hazard interactions & cascading geotechnical-hydrological impacts',
          status_message:
            cascadeEvents > 0
              ? `Cascading threat active across ${cascadeEvents} location(s); heavy rainfall concurrently triggering flood surges and slope debris flows.`
              : 'Composite multi-hazard risk index is balanced; standard continuous telemetry surveillance active.',
          data_quality: 'SYNTHETIC (DEMO TELEMETRY)',
        },
      },
      recent_climate: {
        avg_rainfall_mm: Math.round(avgRain * 10) / 10,
        avg_temperature_c: Math.round(avgTemp * 10) / 10,
        avg_humidity_pct: Math.round(avgHum * 10) / 10,
      },
      village_chart_data: villageChartData,
    }
  }

  resolveAlert(id: number | string): Alert | null {
    this.init()
    const a = this.alerts.find((item) => item.id === Number(id) || item.alert_id === String(id))
    if (a) {
      a.is_resolved = 1
      a.status = 'RESOLVED'
      this.save()
      return a
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Telemetry Backend Store Methods
  // ---------------------------------------------------------------------------
  recordTelemetry(payload: any) {
    this.init()
    if (!payload || typeof payload !== 'object') {
      throw new Error("Telemetry payload must be a JSON object.")
    }
    if (payload.node_id === undefined || payload.node_id === null) {
      throw new Error("Missing required field 'node_id'.")
    }
    if (typeof payload.node_id === 'boolean') {
      throw new Error("Field 'node_id' cannot be a boolean.")
    }

    const nodeStr = String(payload.node_id).trim()
    const node = this.sensorDevices.find(
      (d) =>
        String(d.id) === nodeStr ||
        d.device_uid.toLowerCase() === nodeStr.toLowerCase() ||
        `esp32-smvdu-${String(d.id).padStart(2, '0')}` === nodeStr.toLowerCase()
    )
    if (!node) {
      throw new Error(`Sensor node '${payload.node_id}' not found in registry.`)
    }

    const numericKeys = [
      'water_level_cm', 'water_rise_rate', 'rainfall_mm', 'rainfall_intensity',
      'soil_moisture_1', 'soil_moisture_2', 'temperature_c', 'humidity_pct',
      'pressure_hpa', 'battery_level'
    ]

    const measurementsReceived: string[] = []
    for (const key of numericKeys) {
      const val = payload[key]
      if (val !== undefined && val !== null) {
        if (typeof val !== 'number' || isNaN(val)) {
          throw new Error(`Field '${key}' must be a numeric value (integer or float).`)
        }
        measurementsReceived.push(key)
      }
    }

    if (measurementsReceived.length === 0) {
      throw new Error("Payload must contain at least one valid measurement field.")
    }

    const recorded_at = payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString()
    const village = this.villages.find((v) => v.id === node.village_id)

    node.last_ping = recorded_at
    if (payload.battery_level !== undefined && payload.battery_level !== null) {
      node.battery_pct = Math.round(payload.battery_level)
    }
    node.status = 'active'

    if (payload.rainfall_mm !== undefined || payload.temperature_c !== undefined) {
      this.climateReadings.push({
        id: this.climateReadings.length + 1,
        village_id: node.village_id,
        recorded_date: recorded_at.split('T')[0],
        rainfall_mm: payload.rainfall_mm ?? 0,
        peak_intensity_mm_hr: payload.rainfall_intensity ?? (payload.rainfall_mm ?? 0),
        temperature_c: payload.temperature_c ?? 22,
        humidity_pct: payload.humidity_pct ?? 65,
        season: 'summer',
        soil_moisture_pct: payload.soil_moisture_1 ?? 45,
        is_cloudburst_flag: (payload.rainfall_intensity ?? 0) >= 50,
      })
    }

    const isRealHardware = node.device_uid.toUpperCase() === 'JR-NODE-01' || this.operatingMode === 'REAL'
    if (isRealHardware) {
      const wDepthM = payload.water_level_cm !== undefined && payload.water_level_cm !== null
        ? Number((payload.water_level_cm / 100).toFixed(2))
        : 1.85
      const riseVelocity = payload.water_rise_rate ?? 0
      const rainMm = payload.rainfall_mm ?? 0
      const rainRate = payload.rainfall_intensity ?? 0
      const soilMoist = payload.soil_moisture_1 ?? payload.soil_moisture_2 ?? 45.0
      const tempC = payload.temperature_c ?? 22.0
      const humidity = payload.humidity_pct ?? 65.0

      const wsRes = computeWaterStress({
        rainfall_mm: rainMm,
        temperature_c: tempC,
        humidity_pct: humidity,
        water_level_m: wDepthM,
        flow_rate_lpm: 32.0,
        population: village?.population || 850,
        storage_capacity_L: village?.storage_capacity_L || 120000,
        season: 'summer',
      })

      const ffRes = computeFloodRisk({
        rainfall_mm: rainMm,
        peak_intensity_mm_hr: rainRate,
        water_level_m: wDepthM,
        water_level_rise_rate: riseVelocity,
        forecast_rainfall: rainMm * 1.2,
        soil_moisture_pct: soilMoist,
        distance_to_river_m: village?.distance_to_river_m || 180,
        catchment_area_sqkm: village?.catchment_area_sqkm || 4.8,
        soil_type: village?.soil_type || 'clay_loam',
        slope_deg: village?.slope_deg || 22,
      })

      const lsRes = computeLandslideRisk({
        slope_deg: village?.slope_deg || 22,
        rainfall_72h_mm: rainMm * 1.5,
        soil_moisture_pct: soilMoist,
        soil_type: village?.soil_type || 'clay_loam',
        vegetation_cover_pct: village?.vegetation_cover_pct || 55,
      })

      const mhRes = computeMultiHazard(wsRes, ffRes, lsRes)

      const sensorValues: AlertSensorValues = {
        water_level_m: wDepthM,
        water_rise_rate: riseVelocity,
        rainfall_mm: rainMm,
        peak_intensity_mm_hr: rainRate,
        soil_moisture_pct: Math.round(soilMoist),
        temperature_c: tempC,
        humidity_pct: Math.round(humidity),
        flow_rate_lpm: 32.0,
        battery_pct: payload.battery_level ?? 100,
      }

      const channelRes = evaluateDisasterAlertChannels({
        village_id: node.village_id,
        village_name: village?.name || 'Katra',
        node_id: node.device_uid,
        node_uid: node.device_uid,
        waterStress: wsRes,
        flood: ffRes,
        landslide: lsRes,
        multiHazard: mhRes,
        sensor_values: sensorValues,
        data_source: 'REAL HARDWARE (JR-NODE-01)',
        data_quality: 'REAL SENSOR TELEMETRY',
        timestamp: recorded_at,
      })

      // Replace old active alerts for this real node
      this.alerts = this.alerts.filter((a) => a.node_id !== node.device_uid && a.node !== node.device_uid)
      this.alerts.unshift(...channelRes.generated_alerts)

      this.realHardware = {
        ...this.realHardware,
        node_id: node.device_uid,
        status: 'CONNECTED',
        is_connected: true,
        last_heartbeat_at: recorded_at,
        packets_received_count: (this.realHardware.packets_received_count || 0) + 1,
        latest_telemetry: {
          node_id: node.device_uid,
          timestamp: recorded_at,
          recorded_at: recorded_at,
          data_quality: 'REAL',
          water_level_cm: Number(payload.water_level_cm ?? 0),
          water_rise_rate: Number(payload.water_rise_rate ?? 0),
          rainfall_mm: Number(payload.rainfall_mm ?? 0),
          rainfall_intensity: Number(payload.rainfall_intensity ?? 0),
          soil_moisture_1: Number(payload.soil_moisture_1 ?? 0),
          soil_moisture_2: Number(payload.soil_moisture_2 ?? 0),
          temperature_c: Number(payload.temperature_c ?? 0),
          humidity_pct: Number(payload.humidity_pct ?? 0),
          pressure_hpa: Number(payload.pressure_hpa ?? 0),
          battery_level: Number(payload.battery_level ?? 100),
        },
        data_quality: 'REAL',
        is_synthetic: 0,
        computed_risks: {
          water_stress: { score: wsRes.score, level: wsRes.level, factors: wsRes.factors },
          flood: { score: ffRes.score, level: ffRes.level, factors: ffRes.factors },
          landslide: { score: lsRes.score, level: lsRes.level, factors: lsRes.factors },
          multi_hazard: {
            composite_score: mhRes.compositeScore,
            category: mhRes.overall_multi_hazard_category,
            dominant_hazard: mhRes.dominant_hazard,
            secondary_hazard: mhRes.secondary_hazard,
            cascade_triggered: mhRes.cascadeTriggered,
            factors: mhRes.allTopFactors,
          },
          channels: channelRes,
        },
      }
    }

    this.save()
    this.notify()

    return {
      status: 'success',
      message: isRealHardware
        ? 'Real ESP32 telemetry packet accepted and verified.'
        : 'Telemetry reading successfully accepted and recorded.',
      data: {
        node_id: node.id,
        node_uid: node.device_uid,
        village_id: node.village_id,
        village_name: village?.name || 'SMVDU Catchment',
        recorded_at,
        measurements_received: measurementsReceived,
        cloudburst_flag: (payload.rainfall_intensity ?? 0) >= 50,
        data_quality: isRealHardware ? 'REAL' : 'SYNTHETIC',
        is_synthetic: isRealHardware ? 0 : 1,
        operating_mode: this.operatingMode,
        disclaimer: isRealHardware
          ? 'Live telemetry packet recorded from physical ESP32 node.'
          : 'Prototype demonstration telemetry stored for educational risk modeling.',
      },
    }
  }

  getNodes(villageId?: number) {
    this.init()
    let list = this.sensorDevices
    if (villageId) {
      list = list.filter((d) => d.village_id === Number(villageId))
    }
    return list.map((d) => {
      const v = this.villages.find((vil) => vil.id === d.village_id)
      return {
        ...d,
        village_name: v?.name || '',
        district: v?.district || 'Reasi',
        elevation_m: v?.elevation_m || 0,
        data_quality: 'SYNTHETIC',
        is_synthetic: 1,
      }
    })
  }

  getNode(idOrUid: string | number) {
    this.init()
    const str = String(idOrUid).trim()
    const node = this.sensorDevices.find(
      (d) =>
        String(d.id) === str ||
        d.device_uid.toLowerCase() === str.toLowerCase() ||
        `esp32-smvdu-${String(d.id).padStart(2, '0')}` === str.toLowerCase()
    )
    if (!node) {
      throw new Error(`Sensor node '${idOrUid}' not found in registry.`)
    }
    const v = this.villages.find((vil) => vil.id === node.village_id)
    return {
      ...node,
      village_name: v?.name || '',
      district: v?.district || 'Reasi',
      elevation_m: v?.elevation_m || 0,
      data_quality: 'SYNTHETIC',
      is_synthetic: 1,
    }
  }

  getNodeHistory(idOrUid: string | number, limit: number = 20) {
    this.init()
    const node = this.getNode(idOrUid)
    const readings = this.climateReadings
      .filter((r) => r.village_id === node.village_id)
      .slice(-limit)
      .reverse()
    return readings.map((r) => ({
      recorded_at: r.recorded_date,
      water_level_m: 1.85,
      water_level_cm: 185.0,
      rainfall_mm: r.rainfall_mm,
      rainfall_intensity: r.peak_intensity_mm_hr,
      temperature_c: r.temperature_c,
      humidity_pct: r.humidity_pct,
      is_cloudburst: r.is_cloudburst_flag || false,
      data_quality: 'SYNTHETIC',
    }))
  }
}

export const store = new JalRakshakStore()
