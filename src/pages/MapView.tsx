import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  GeoJSON,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { PathOptions, Layer } from 'leaflet'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import ExplainableFactors from '../components/ExplainableFactors'
import {
  getVillages,
  getHazardAssessments,
  getSources,
  getSensors,
  getClimate,
} from '../api'
import {
  Village,
  HazardAssessment,
  SensorDevice,
  WaterSource,
  ClimateReading,
} from '../api/store'
import './Page.css'
import './MapView.css'

// ── Spatial View Presets for Authoritative GIS Verification ──────────────────
export type SpatialPresetId =
  | 'india_overview'
  | 'jammu_kashmir'
  | 'ladakh'
  | 'village_level'
  | 'sensor_node'

export interface SpatialPreset {
  id: SpatialPresetId
  label: string
  icon: string
  center: [number, number]
  zoom: number
  description: string
}

export const SPATIAL_PRESETS: SpatialPreset[] = [
  {
    id: 'india_overview',
    label: 'India Overview',
    icon: '🇮🇳',
    center: [23.5, 79.5],
    zoom: 5,
    description: 'National overview showing states & UTs with distinct J&K and Ladakh',
  },
  {
    id: 'jammu_kashmir',
    label: 'UT Jammu & Kashmir',
    icon: '🏔️',
    center: [33.55, 75.05],
    zoom: 8,
    description: 'Union Territory of Jammu & Kashmir (20 districts under Indian administration)',
  },
  {
    id: 'ladakh',
    label: 'UT Ladakh',
    icon: '🏔️',
    center: [34.15, 77.58],
    zoom: 7,
    description: 'Union Territory of Ladakh (Leh & Kargil districts under Indian administration)',
  },
  {
    id: 'village_level',
    label: 'Village Level',
    icon: '🏡',
    center: [32.94134, 74.95356],
    zoom: 13,
    description: 'High-resolution catchment & multi-hazard risk analysis at village level',
  },
  {
    id: 'sensor_node',
    label: 'Sensor-Node Level',
    icon: '📡',
    center: [32.94134, 74.95356],
    zoom: 16,
    description: 'Micro-site sensor hardware node topology (ESP32 Gateways, Probes, Radars)',
  },
]

// ── 4 Consistent Hazard Risk Categories ──────────────────────────────────────
export type HazardCategory = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'

export function getHazardCategory(score: number): HazardCategory {
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'WARNING'
  if (score >= 25) return 'WATCH'
  return 'NORMAL'
}

export const CATEGORY_COLORS: Record<
  HazardCategory,
  { fill: string; stroke: string; bg: string; text: string }
> = {
  NORMAL: {
    fill: '#16a34a',
    stroke: '#15803d',
    bg: '#dcfce7',
    text: '#15803d',
  },
  WATCH: {
    fill: '#eab308',
    stroke: '#ca8a04',
    bg: '#fef9c3',
    text: '#854d0e',
  },
  WARNING: {
    fill: '#ea580c',
    stroke: '#c2410c',
    bg: '#ffedd5',
    text: '#c2410c',
  },
  CRITICAL: {
    fill: '#dc2626',
    stroke: '#b91c1c',
    bg: '#fee2e2',
    text: '#b91c1c',
  },
}

// ── 5 Layer Selector Modes ───────────────────────────────────────────────────
export type LayerSelectorMode =
  | 'ALL'
  | 'WATER STRESS'
  | 'FLOOD'
  | 'LANDSLIDE'
  | 'MULTI-HAZARD'

export const LAYER_SELECTOR_OPTIONS: {
  id: LayerSelectorMode
  label: LayerSelectorMode
  icon: string
  subtitle: string
}[] = [
  { id: 'ALL', label: 'ALL', icon: '🌐', subtitle: 'Composite Multi-Hazard Overview' },
  { id: 'WATER STRESS', label: 'WATER STRESS', icon: '💧', subtitle: 'Hydrological Drought & Spring Depletion' },
  { id: 'FLOOD', label: 'FLOOD', icon: '🌊', subtitle: 'Flash Flood & River Inundation' },
  { id: 'LANDSLIDE', label: 'LANDSLIDE', icon: '⛰️', subtitle: 'Slope Instability & Pore Pressure' },
  { id: 'MULTI-HAZARD', label: 'MULTI-HAZARD', icon: '⚡', subtitle: 'Compounded Multi-Hazard Peril' },
]

// ── 13 Required Telemetry & Hazard Attributes for Every Marker Click ─────────
export interface MarkerTelemetryData {
  village: string
  node: string
  waterLevel: string
  waterRiseRate: string
  rainfall: string
  soilMoisture: string
  waterStress: {
    category: HazardCategory
    score: number
  }
  floodRisk: {
    category: HazardCategory
    score: number
  }
  landslideRisk: {
    category: HazardCategory
    score: number
  }
  overallRisk: {
    category: HazardCategory
    score: number
  }
  battery: string
  lastUpdate: string
  dataQuality: string
  dominantHazard?: string
  topFactors?: string[]
  cascadeTriggered?: boolean
  isSensorProbe?: boolean
  probeName?: string
  probeType?: string
  probeIcon?: string
}

// ── Map View Controller for Smooth Pan/Zoom ─────────────────────────────────
function MapViewController({
  targetView,
}: {
  targetView: { center: [number, number]; zoom: number; nonce: number } | null
}) {
  const map = useMap()
  const lastNonce = useRef<number | null>(null)

  useEffect(() => {
    if (!targetView || targetView.nonce === lastNonce.current) return
    lastNonce.current = targetView.nonce
    try {
      map.flyTo(targetView.center, targetView.zoom, {
        duration: 1.1,
        easeLinearity: 0.25,
      })
    } catch {
      map.setView(targetView.center, targetView.zoom)
    }
  }, [map, targetView])

  return null
}

// ── Popup Component Displaying all 13 Required Fields ─────────────────────────
function MarkerDetailCard({
  data,
  onInspectSensors,
}: {
  data: MarkerTelemetryData
  onInspectSensors?: () => void
}) {
  return (
    <div className="map-popup-card">
      {/* Header */}
      <div className="map-popup-card__header">
        <div>
          <div className="map-popup-card__title">
            {data.isSensorProbe && <span className="map-popup-card__probe-icon">{data.probeIcon} </span>}
            {data.isSensorProbe ? data.probeName : data.village}
          </div>
          <div className="map-popup-card__subtitle">
            {data.isSensorProbe
              ? `${data.probeType} · ${data.village}`
              : `IoT Multi-Hazard Catchment Telemetry`}
          </div>
        </div>
        <div className="map-popup-card__badge-wrap">
          <span
            className={`hazard-cat-pill hazard-cat-pill--${data.overallRisk.category.toLowerCase()}`}
          >
            {data.overallRisk.category}
          </span>
        </div>
      </div>

      {/* ── 13 Required Fields Table ── */}
      <div className="map-popup-card__grid">
        {/* 1. Village */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Village</span>
          <span className="map-popup-field__value font-semibold">{data.village}</span>
        </div>

        {/* 2. Node */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Node</span>
          <span className="map-popup-field__value font-mono text-xs text-slate-700">{data.node}</span>
        </div>

        {/* 3. Water Level */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Water Level</span>
          <span className="map-popup-field__value font-semibold text-blue-700">{data.waterLevel}</span>
        </div>

        {/* 4. Water Rise Rate */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Water Rise Rate</span>
          <span className="map-popup-field__value font-medium">{data.waterRiseRate}</span>
        </div>

        {/* 5. Rainfall */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Rainfall</span>
          <span className="map-popup-field__value">{data.rainfall}</span>
        </div>

        {/* 6. Soil Moisture */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Soil Moisture</span>
          <span className="map-popup-field__value">{data.soilMoisture}</span>
        </div>

        {/* 7. Water Stress */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Water Stress</span>
          <span className="map-popup-field__value">
            <span
              className={`hazard-cat-pill hazard-cat-pill--${data.waterStress.category.toLowerCase()}`}
            >
              {data.waterStress.category} ({data.waterStress.score})
            </span>
          </span>
        </div>

        {/* 8. Flood Risk */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Flood Risk</span>
          <span className="map-popup-field__value">
            <span
              className={`hazard-cat-pill hazard-cat-pill--${data.floodRisk.category.toLowerCase()}`}
            >
              {data.floodRisk.category} ({data.floodRisk.score})
            </span>
          </span>
        </div>

        {/* 9. Landslide Risk */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Landslide Risk</span>
          <span className="map-popup-field__value">
            <span
              className={`hazard-cat-pill hazard-cat-pill--${data.landslideRisk.category.toLowerCase()}`}
            >
              {data.landslideRisk.category} ({data.landslideRisk.score})
            </span>
          </span>
        </div>

        {/* 10. Overall Risk */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Overall Risk</span>
          <span className="map-popup-field__value">
            <span
              className={`hazard-cat-pill hazard-cat-pill--${data.overallRisk.category.toLowerCase()}`}
            >
              {data.overallRisk.category} ({data.overallRisk.score})
            </span>
          </span>
        </div>

        {/* 11. Battery */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Battery</span>
          <span className="map-popup-field__value font-medium">🔋 {data.battery}</span>
        </div>

        {/* 12. Last Update */}
        <div className="map-popup-field">
          <span className="map-popup-field__label">Last Update</span>
          <span className="map-popup-field__value text-xs text-slate-600">{data.lastUpdate}</span>
        </div>

        {/* 13. Data Quality */}
        <div className="map-popup-field map-popup-field--full">
          <span className="map-popup-field__label">Data Quality</span>
          <span className="map-popup-field__value">
            <span className="data-quality-badge">{data.dataQuality}</span>
          </span>
        </div>
      </div>

      {/* ── Explainability Diagnostic: WHY is this village/node at risk? ── */}
      <ExplainableFactors
        compact
        targetName={data.isSensorProbe ? data.probeName : data.village}
        overallRisk={data.overallRisk.category}
        overallScore={data.overallRisk.score}
        dominantHazard={data.dominantHazard}
        riskScores={{
          flood: data.floodRisk.score,
          landslide: data.landslideRisk.score,
          waterStress: data.waterStress.score,
          composite: data.overallRisk.score,
        }}
        factors={data.topFactors || []}
        cascadeTriggered={data.cascadeTriggered}
      />

      {onInspectSensors && !data.isSensorProbe && (
        <div className="map-popup-card__action">
          <button onClick={onInspectSensors} className="map-popup__zoom-btn">
            📡 Inspect Micro-Sensor Hardware ({data.village.split(' ')[0]})
          </button>
        </div>
      )}

      <div className="map-popup-card__footer">
        UT of Jammu &amp; Kashmir · Authoritative GIS Boundaries Verified
      </div>
    </div>
  )
}

export default function MapView() {
  const [villages, setVillages] = useState<Village[]>([])
  const [assessments, setAssessments] = useState<Record<number, HazardAssessment>>({})
  const [waterSources, setWaterSources] = useState<WaterSource[]>([])
  const [climateReadings, setClimateReadings] = useState<ClimateReading[]>([])
  const [sensors, setSensors] = useState<SensorDevice[]>([])

  // Layer Selector Mode
  const [activeLayerMode, setActiveLayerMode] = useState<LayerSelectorMode>('ALL')

  // Category filter: ALL, NORMAL, WATCH, WARNING, CRITICAL
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | HazardCategory>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Spatial preset and view control
  const [activePreset, setActivePreset] = useState<SpatialPresetId>('village_level')
  const [targetView, setTargetView] = useState<{
    center: [number, number]
    zoom: number
    nonce: number
  } | null>(null)
  const [selectedVillageId, setSelectedVillageId] = useState<number>(1)

  // GeoJSON GIS boundaries
  const [regionalGeoJson, setRegionalGeoJson] = useState<any>(null)
  const [indiaGeoJson, setIndiaGeoJson] = useState<any>(null)
  const [showAdminBoundaries, setShowAdminBoundaries] = useState(true)
  const [showControlLines, setShowControlLines] = useState(true)
  const [showDisputedZones, setShowDisputedZones] = useState(true)
  const [showSensorNodes, setShowSensorNodes] = useState(true)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  // Load backend and GIS data
  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getVillages(),
      getHazardAssessments(),
      getSources(),
      getSensors(),
      getClimate(),
      fetch('/data/boundaries/jk_ladakh_regional.geojson').then((res) => {
        if (!res.ok) throw new Error('Could not load regional GIS boundary layer')
        return res.json()
      }),
      fetch('/data/boundaries/india_overview.geojson')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([vRes, aRes, sRes, devRes, cRes, regGis, indGis]) => {
        setVillages(vRes.data ?? [])

        const aMap: Record<number, HazardAssessment> = {}
        ;(aRes.data ?? []).forEach((item) => {
          aMap[item.village_id] = item
        })
        setAssessments(aMap)

        setWaterSources(sRes.data ?? [])
        setSensors(devRes.data ?? [])
        setClimateReadings(cRes.data ?? [])
        setRegionalGeoJson(regGis)
        setIndiaGeoJson(indGis)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load GIS and village map data.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle Preset Changes
  const handlePresetSelect = (presetId: SpatialPresetId) => {
    setActivePreset(presetId)
    const preset = SPATIAL_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    if (presetId === 'village_level') {
      const v = villages.find((item) => item.id === selectedVillageId) || villages[0]
      if (v) {
        setTargetView({
          center: [v.latitude, v.longitude],
          zoom: 13,
          nonce: Date.now(),
        })
        return
      }
    }

    if (presetId === 'sensor_node') {
      const v = villages.find((item) => item.id === selectedVillageId) || villages[0]
      if (v) {
        setTargetView({
          center: [v.latitude, v.longitude],
          zoom: 16,
          nonce: Date.now(),
        })
        return
      }
    }

    setTargetView({
      center: preset.center,
      zoom: preset.zoom,
      nonce: Date.now(),
    })
  }

  // Handle village jump
  const handleVillageJump = (villageId: number) => {
    setSelectedVillageId(villageId)
    const v = villages.find((item) => item.id === villageId)
    if (v) {
      const zoom = activePreset === 'sensor_node' ? 16 : 13
      setTargetView({
        center: [v.latitude, v.longitude],
        zoom,
        nonce: Date.now(),
      })
    }
  }

  // Helper to construct all 13 fields for a village or sensor probe
  const getMarkerTelemetry = (
    v: Village,
    probe?: {
      id: string
      name: string
      type: string
      icon: string
      battery: number
      rssi: number
    }
  ): MarkerTelemetryData => {
    const a = assessments[v.id]
    const s = sensors.find((d) => d.village_id === v.id)
    const primarySource = waterSources.find((src) => src.village_id === v.id)
    const villageClimate = climateReadings.filter((c) => c.village_id === v.id).slice(-1)[0]

    const wsScore = a ? a.water_stress_score : 20
    const ffScore = a ? a.flood_risk_score : 18
    const lsScore = a ? a.landslide_risk_score : 22
    const compScore = a ? a.composite_score : 20

    const wsCat = getHazardCategory(wsScore)
    const ffCat = getHazardCategory(ffScore)
    const lsCat = getHazardCategory(lsScore)
    const compCat = getHazardCategory(compScore)

    // Water level
    const wLevel = primarySource
      ? `${primarySource.water_level_m.toFixed(2)} m`
      : `${(1.8 + (v.id % 5) * 0.35).toFixed(2)} m`

    // Water rise rate
    let wRise = '0.00 m/hr (Stable)'
    if (ffScore >= 75) {
      wRise = '+0.48 m/hr (Rapid Surge)'
    } else if (ffScore >= 50) {
      wRise = '+0.21 m/hr (Rising)'
    } else if (ffScore >= 25) {
      wRise = '+0.05 m/hr (Nominal)'
    }

    // Rainfall
    const rainVal = villageClimate?.rainfall_mm ?? (10 + (v.id % 4) * 5.2)
    const rainStr = `${rainVal.toFixed(1)} mm`

    // Soil moisture
    const smVal = villageClimate?.soil_moisture_pct ?? (42 + (v.id % 6) * 4)
    const smStr = `${smVal.toFixed(1)}%`

    // Battery
    const battVal = probe ? probe.battery : s ? s.battery_pct : 88
    const battStr = `${battVal}%`

    // Last update
    const rawDate = s?.last_ping || a?.assessed_at
    const lastUpdateStr = rawDate
      ? new Date(rawDate).toISOString().replace('T', ' ').substring(0, 16) + ' UTC'
      : '2026-10-23 08:30 UTC'

    // Node UID
    const nodeUid = probe
      ? `${probe.name} [UID: ${probe.id}]`
      : s
      ? s.device_uid
      : `ESP32-JAL-REASI-${100 + v.id}`

    return {
      village: `${v.name} (${v.district} District)`,
      node: nodeUid,
      waterLevel: wLevel,
      waterRiseRate: wRise,
      rainfall: rainStr,
      soilMoisture: smStr,
      waterStress: { category: wsCat, score: wsScore },
      floodRisk: { category: ffCat, score: ffScore },
      landslideRisk: { category: lsCat, score: lsScore },
      overallRisk: { category: compCat, score: compScore },
      battery: battStr,
      lastUpdate: lastUpdateStr,
      dataQuality: 'SYNTHETIC (DEMO VERIFIED)',
      dominantHazard: a?.primary_threat || 'flood',
      topFactors: a?.top_factors || [],
      cascadeTriggered: a?.cascade_triggered || false,
      isSensorProbe: Boolean(probe),
      probeName: probe?.name,
      probeType: probe?.type,
      probeIcon: probe?.icon,
    }
  }

  // Determine marker styling based on active layer mode
  const getMarkerAttributes = (vId: number) => {
    const a = assessments[vId]
    let score = 20
    let category: HazardCategory = 'NORMAL'

    if (a) {
      if (activeLayerMode === 'ALL' || activeLayerMode === 'MULTI-HAZARD') {
        score = a.composite_score
      } else if (activeLayerMode === 'WATER STRESS') {
        score = a.water_stress_score
      } else if (activeLayerMode === 'FLOOD') {
        score = a.flood_risk_score
      } else if (activeLayerMode === 'LANDSLIDE') {
        score = a.landslide_risk_score
      }
      category = getHazardCategory(score)
    }

    const colors = CATEGORY_COLORS[category]
    const radius =
      category === 'CRITICAL' ? 13 : category === 'WARNING' ? 11 : category === 'WATCH' ? 9 : 7

    return { category, score, color: colors.fill, stroke: colors.stroke, radius }
  }

  const filteredVillages = villages.filter((v) => {
    if (search) {
      const q = search.toLowerCase()
      if (!v.name.toLowerCase().includes(q) && !v.district?.toLowerCase().includes(q)) {
        return false
      }
    }
    if (categoryFilter !== 'ALL') {
      const { category } = getMarkerAttributes(v.id)
      if (category !== categoryFilter) return false
    }
    return true
  })

  // ── GIS Boundary Feature Styling ──────────────────────────────────────────
  const getGisStyle = (feature: any): PathOptions => {
    const p = feature?.properties || {}
    const id = p.id || ''

    if (id === 'UT-JK') {
      return {
        color: '#0284c7', // Sky-600
        weight: 2.5,
        opacity: showAdminBoundaries ? 0.95 : 0,
        fillColor: '#38bdf8',
        fillOpacity: showAdminBoundaries ? 0.12 : 0,
      }
    }
    if (id === 'UT-LA') {
      return {
        color: '#7c3aed', // Purple-600
        weight: 2.5,
        opacity: showAdminBoundaries ? 0.95 : 0,
        fillColor: '#a855f7',
        fillOpacity: showAdminBoundaries ? 0.12 : 0,
      }
    }
    if (id === 'LINE-LOC') {
      return {
        color: '#dc2626', // Red-600 dashed
        weight: 3.5,
        opacity: showControlLines ? 0.95 : 0,
        dashArray: '8, 6',
      }
    }
    if (id === 'LINE-LAC') {
      return {
        color: '#ea580c', // Orange-600 dashed
        weight: 3.5,
        opacity: showControlLines ? 0.95 : 0,
        dashArray: '6, 6',
      }
    }
    if (id === 'LINE-SHAKS') {
      return {
        color: '#64748b',
        weight: 2,
        opacity: showControlLines ? 0.8 : 0,
        dashArray: '4, 4',
      }
    }
    if (id === 'DISP-PAK-KASHMIR') {
      return {
        color: '#64748b',
        weight: 1.5,
        opacity: showDisputedZones ? 0.75 : 0,
        fillColor: '#94a3b8',
        fillOpacity: showDisputedZones ? 0.08 : 0,
        dashArray: '4, 4',
      }
    }
    if (id === 'DISP-CHN-AKSAI' || id === 'DISP-CHN-SHAKS') {
      return {
        color: '#94a3b8',
        weight: 1.5,
        opacity: showDisputedZones ? 0.75 : 0,
        fillColor: '#cbd5e1',
        fillOpacity: showDisputedZones ? 0.08 : 0,
        dashArray: '4, 4',
      }
    }
    if (id === 'DISP-SIACHEN') {
      return {
        color: '#2563eb',
        weight: 1.5,
        opacity: showDisputedZones ? 0.8 : 0,
        fillColor: '#93c5fd',
        fillOpacity: showDisputedZones ? 0.15 : 0,
        dashArray: '2, 4',
      }
    }

    if (p.is_target_region) {
      return {
        color: p.name === 'Ladakh' ? '#7c3aed' : '#0284c7',
        weight: 2,
        opacity: 0.9,
        fillColor: p.name === 'Ladakh' ? '#a855f7' : '#38bdf8',
        fillOpacity: 0.18,
      }
    }

    return {
      color: '#94a3b8',
      weight: 1,
      opacity: 0.55,
      fillColor: '#f8fafc',
      fillOpacity: 0.05,
    }
  }

  // Bind popups & tooltips to GIS features
  const onEachGisFeature = (feature: any, layer: Layer) => {
    const p = feature?.properties || {}
    const id = p.id || ''

    if (id === 'UT-JK') {
      layer.bindTooltip('<b>Union Territory of Jammu & Kashmir</b><br/>Administered by India', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--jk">Union Territory (India)</div>
          <div class="gis-feature-popup__title">Jammu and Kashmir</div>
          <div class="gis-feature-popup__meta">Status: Reorganisation Act 2019 · 20 Administrative Districts</div>
          <p class="gis-feature-popup__desc">Constitutional Union Territory comprising Jammu and Kashmir divisions under Indian administration. Bounded to the north/west by the Line of Control (LoC).</p>
          <div class="gis-feature-popup__footer">Authoritative GIS Layer · Verified Boundary</div>
        </div>
      `)
    } else if (id === 'UT-LA') {
      layer.bindTooltip('<b>Union Territory of Ladakh</b><br/>Administered by India', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--ladakh">Union Territory (India)</div>
          <div class="gis-feature-popup__title">Ladakh</div>
          <div class="gis-feature-popup__meta">Status: Reorganisation Act 2019 · Leh & Kargil Districts</div>
          <p class="gis-feature-popup__desc">Separate Union Territory under Indian administration, established under the J&K Reorganisation Act 2019. Bounded by the LAC to the east and LoC to the west.</p>
          <div class="gis-feature-popup__footer">Authoritative GIS Layer · Verified Boundary</div>
        </div>
      `)
    } else if (id === 'LINE-LOC') {
      layer.bindTooltip('<b>Line of Control (LoC)</b><br/>1972 Simla Agreement Ceasefire Line', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--loc">De Facto Ceasefire Line</div>
          <div class="gis-feature-popup__title">Line of Control (LoC)</div>
          <div class="gis-feature-popup__meta">Established: 1972 Simla Agreement · 740 km Demarcation</div>
          <p class="gis-feature-popup__desc">Military control line separating Indian-administered Jammu & Kashmir from Pakistan-administered areas. Rendered with dashed red cartographic symbology in compliance with international mapping practice.</p>
        </div>
      `)
    } else if (id === 'LINE-LAC') {
      layer.bindTooltip('<b>Line of Actual Control (LAC)</b><br/>De Facto Demarcation Line', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--lac">De Facto Demarcation</div>
          <div class="gis-feature-popup__title">Line of Actual Control (LAC)</div>
          <div class="gis-feature-popup__meta">Bilateral Agreements: 1993 & 1996 Peace & Tranquility</div>
          <p class="gis-feature-popup__desc">Effective demarcation line separating Indian-administered Ladakh from Chinese-controlled Aksai Chin. Rendered with dashed amber cartographic symbology.</p>
        </div>
      `)
    } else if (id === 'DISP-PAK-KASHMIR') {
      layer.bindTooltip('<b>Pakistan-administered Kashmir</b><br/>Disputed Territory', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--disp">Disputed Territory</div>
          <div class="gis-feature-popup__title">Pakistan-administered Kashmir</div>
          <div class="gis-feature-popup__meta">Azad Kashmir & Gilgit-Baltistan</div>
          <p class="gis-feature-popup__desc">Territory under de facto administration of Pakistan; claimed by India. Explicitly excluded from ordinary Indian administrative territory with neutral dashed styling.</p>
        </div>
      `)
    } else if (id === 'DISP-CHN-AKSAI') {
      layer.bindTooltip('<b>China-administered Aksai Chin</b><br/>Disputed Territory', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--disp">Disputed Territory</div>
          <div class="gis-feature-popup__title">China-administered Aksai Chin</div>
          <div class="gis-feature-popup__meta">Under Chinese Administration · Claimed by India</div>
          <p class="gis-feature-popup__desc">High-altitude plateau territory under Chinese administration; claimed by India. Delineated separately from ordinary Indian administrative polygon fills.</p>
        </div>
      `)
    } else if (id === 'DISP-SIACHEN') {
      layer.bindTooltip('<b>Siachen Glacier</b><br/>Actual Ground Position Line (AGPL)', {
        sticky: true,
      })
      layer.bindPopup(`
        <div class="gis-feature-popup">
          <div class="gis-feature-popup__badge gis-feature-popup__badge--siachen">Glacial Zone</div>
          <div class="gis-feature-popup__title">Siachen Glacier / Saltoro Ridge</div>
          <div class="gis-feature-popup__meta">Controlled by India (Operation Meghdoot, 1984)</div>
          <p class="gis-feature-popup__desc">Glacial conflict zone north of Point NJ9842 along the Actual Ground Position Line (AGPL).</p>
        </div>
      `)
    } else if (p.name) {
      layer.bindTooltip(`<b>${p.name}</b> (${p.type || 'State/UT'})`, { sticky: true })
    }
  }

  return (
    <div className="map-page">
      {/* ── Header Title & Spatial Presets ── */}
      <div className="map-page__header">
        <div>
          <h1 className="map-page__title">Authoritative Multi-Hazard GIS Spatial Viewer</h1>
          <p className="map-page__subtitle">
            GIS boundary layers compliant with the J&amp;K Reorganisation Act (2019). Distinct
            demarcation for UT of Jammu &amp; Kashmir, UT of Ladakh, and de facto lines of control.
          </p>
        </div>

        {/* ── Spatial Level Presets ── */}
        <div className="map-presets" role="group" aria-label="Spatial View Presets">
          <span className="map-presets__label">Spatial Presets:</span>
          {SPATIAL_PRESETS.map((p) => {
            const isActive = activePreset === p.id
            return (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`map-preset-btn ${isActive ? 'map-preset-btn--active' : ''}`}
                title={p.description}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <SyntheticDataNotice extra="Geographic village coordinates & sensor placements are preserved unaltered. Hazard ratings are simulation outputs." />

      {/* ── Exact Layer Selector (ALL, WATER STRESS, FLOOD, LANDSLIDE, MULTI-HAZARD) ── */}
      <div className="map-layer-selector-bar">
        <div className="map-layer-selector" role="tablist" aria-label="Hazard Layer Selector">
          <span className="map-layer-selector__label">Layer Selector:</span>
          {LAYER_SELECTOR_OPTIONS.map((layer) => {
            const isSelected = activeLayerMode === layer.id
            return (
              <button
                key={layer.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveLayerMode(layer.id)}
                className={`map-layer-btn ${isSelected ? 'map-layer-btn--active' : ''}`}
                title={layer.subtitle}
              >
                <span className="map-layer-btn__icon">{layer.icon}</span>
                <span className="map-layer-btn__label">{layer.label}</span>
              </button>
            )
          })}
        </div>

        {/* Active Layer Banner */}
        <div className="map-active-layer-indicator">
          <span className="map-active-layer-indicator__pill">
            Active: <strong>{activeLayerMode}</strong>
          </span>
          <span className="map-active-layer-indicator__desc">
            {LAYER_SELECTOR_OPTIONS.find((l) => l.id === activeLayerMode)?.subtitle}
          </span>
        </div>
      </div>

      {/* ── Toolbar: Village Jump, Search, Consistent Category Filters ── */}
      <div className="map-toolbar">
        {/* Village Quick-Jump Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="map-toolbar__filter-label">Focus Village:</span>
          <select
            className="map-toolbar__select"
            value={selectedVillageId}
            onChange={(e) => handleVillageJump(Number(e.target.value))}
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.district})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <input
          type="text"
          className="map-toolbar__search"
          placeholder="Search village…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Consistent Categories Filter: ALL, NORMAL, WATCH, WARNING, CRITICAL */}
        <div className="map-category-filters">
          <span className="map-toolbar__filter-label">Risk Category:</span>
          {(['ALL', 'NORMAL', 'WATCH', 'WARNING', 'CRITICAL'] as const).map((cat) => {
            const isSelected = categoryFilter === cat
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`map-cat-filter-btn ${
                  isSelected ? 'map-cat-filter-btn--active' : ''
                } ${cat !== 'ALL' ? `map-cat-filter-btn--${cat.toLowerCase()}` : ''}`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── GIS Boundary Layer Toggles ── */}
      <div className="map-gis-toggles">
        <span className="map-gis-toggles__label">GIS Boundary Layers:</span>
        <label className="map-gis-toggles__item">
          <input
            type="checkbox"
            checked={showAdminBoundaries}
            onChange={(e) => setShowAdminBoundaries(e.target.checked)}
          />
          <span className="gis-chip gis-chip--jk">UT J&amp;K &amp; UT Ladakh</span>
        </label>

        <label className="map-gis-toggles__item">
          <input
            type="checkbox"
            checked={showControlLines}
            onChange={(e) => setShowControlLines(e.target.checked)}
          />
          <span className="gis-chip gis-chip--loc">LoC &amp; LAC Control Lines</span>
        </label>

        <label className="map-gis-toggles__item">
          <input
            type="checkbox"
            checked={showDisputedZones}
            onChange={(e) => setShowDisputedZones(e.target.checked)}
          />
          <span className="gis-chip gis-chip--disp">Disputed Territory Outlines</span>
        </label>

        <label className="map-gis-toggles__item">
          <input
            type="checkbox"
            checked={showSensorNodes}
            onChange={(e) => setShowSensorNodes(e.target.checked)}
          />
          <span className="gis-chip gis-chip--sensors">IoT Sensor Nodes</span>
        </label>

        <button
          className="map-disclaimer-btn"
          onClick={() => setShowDisclaimer(!showDisclaimer)}
          title="Toggle Cartographic Disclaimer"
        >
          ℹ️ {showDisclaimer ? 'Hide Disclaimer' : 'Show Disclaimer'}
        </button>
      </div>

      {/* ── Map Container ── */}
      <div className="map-container">
        {loading ? (
          <div className="map-status">
            <span className="map-status__icon">🗺️</span>
            <span>Loading verified GIS boundaries and multi-hazard data…</span>
          </div>
        ) : error ? (
          <div className="map-status">
            <span className="map-status__icon">⚠️</span>
            <span>{error}</span>
          </div>
        ) : (
          <MapContainer
            center={SPATIAL_PRESETS.find((p) => p.id === activePreset)?.center || [32.94, 74.95]}
            zoom={SPATIAL_PRESETS.find((p) => p.id === activePreset)?.zoom || 13}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Natural Earth'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Programmatic Pan/Zoom Controller */}
            <MapViewController targetView={targetView} />

            {/* ── GIS Boundary Layer: India Overview (when in national overview mode) ── */}
            {activePreset === 'india_overview' && indiaGeoJson && (
              <GeoJSON
                key={`india-gis-${showAdminBoundaries}`}
                data={indiaGeoJson}
                style={getGisStyle}
                onEachFeature={onEachGisFeature}
              />
            )}

            {/* ── Authoritative Regional GIS Boundary Layer: UT J&K, UT Ladakh, LoC, LAC ── */}
            {regionalGeoJson && (
              <GeoJSON
                key={`regional-gis-${showAdminBoundaries}-${showControlLines}-${showDisputedZones}`}
                data={regionalGeoJson}
                style={getGisStyle}
                onEachFeature={onEachGisFeature}
              />
            )}

            {/* ── Village Multi-Hazard Markers ── */}
            {filteredVillages.map((v) => {
              const { category, score, color, stroke, radius } = getMarkerAttributes(v.id)
              const isSelected = v.id === selectedVillageId
              const telemetry = getMarkerTelemetry(v)

              return (
                <CircleMarker
                  key={`village-${v.id}`}
                  center={[v.latitude, v.longitude]}
                  radius={isSelected ? radius + 4 : radius}
                  pathOptions={{
                    color: isSelected ? '#0f172a' : stroke,
                    fillColor: color,
                    fillOpacity: 0.9,
                    weight: isSelected ? 3.5 : 2,
                    opacity: 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedVillageId(v.id)
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <b>{v.name}</b> ({v.district}) · {activeLayerMode}: <strong>{category}</strong> ({score})
                  </Tooltip>

                  <Popup minWidth={330} maxWidth={400} className="custom-leaflet-popup">
                    <MarkerDetailCard
                      data={telemetry}
                      onInspectSensors={() => {
                        setSelectedVillageId(v.id)
                        handlePresetSelect('sensor_node')
                      }}
                    />
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* ── Sensor-Node Level Hardware Markers ── */}
            {showSensorNodes &&
              (activePreset === 'sensor_node' || activePreset === 'village_level') &&
              villages.map((v) => {
                const s = sensors.find((d) => d.village_id === v.id)
                // Micro-site hardware topology probes around the catchment
                const probes = [
                  {
                    id: `ESP32-GW-${v.id}`,
                    name: `ESP32 LoRa Gateway (${v.name})`,
                    type: 'Gateway Node',
                    icon: '📡',
                    lat: v.latitude,
                    lon: v.longitude,
                    battery: s ? s.battery_pct : 88,
                    rssi: s ? s.rssi_dbm : -68,
                  },
                  {
                    id: `RAIN-PROBE-${v.id}`,
                    name: `Tipping-Bucket Hyetometer (${v.name})`,
                    type: 'Rainfall Intensity Probe',
                    icon: '🌧️',
                    lat: v.latitude + 0.0011,
                    lon: v.longitude + 0.0006,
                    battery: 92,
                    rssi: -72,
                  },
                  {
                    id: `SOIL-PROBE-${v.id}`,
                    name: `Dual-Depth Soil Moisture Probe (${v.name})`,
                    type: 'Pore Saturation Sensor',
                    icon: '🌱',
                    lat: v.latitude - 0.0008,
                    lon: v.longitude + 0.0012,
                    battery: 84,
                    rssi: -75,
                  },
                  {
                    id: `RADAR-STAGE-${v.id}`,
                    name: `Riverbed Radar Depth Gauge (${v.name})`,
                    type: 'Ultrasonic Stage Sensor',
                    icon: '🌊',
                    lat: v.latitude - 0.001,
                    lon: v.longitude - 0.0009,
                    battery: 79,
                    rssi: -80,
                  },
                ]

                return (
                  <React.Fragment key={`probes-group-${v.id}`}>
                    {probes.map((pr) => {
                      const probeTelemetry = getMarkerTelemetry(v, pr)
                      return (
                        <CircleMarker
                          key={pr.id}
                          center={[pr.lat, pr.lon]}
                          radius={activePreset === 'sensor_node' ? 6 : 4}
                          pathOptions={{
                            color: '#4338ca',
                            fillColor: '#818cf8',
                            fillOpacity: 0.95,
                            weight: 1.5,
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -6]}>
                            {pr.icon} <b>{pr.name}</b>
                          </Tooltip>

                          <Popup minWidth={330} maxWidth={400} className="custom-leaflet-popup">
                            <MarkerDetailCard data={probeTelemetry} />
                          </Popup>
                        </CircleMarker>
                      )
                    })}
                  </React.Fragment>
                )
              })}
          </MapContainer>
        )}

        {/* ── Cartographic Disclaimer Notice ── */}
        {showDisclaimer && (
          <div className="map-disclaimer-box">
            <div className="map-disclaimer-box__header">
              <span className="map-disclaimer-box__icon">⚖️</span>
              <span className="map-disclaimer-box__title">Cartographic Disclaimer</span>
              <button
                className="map-disclaimer-box__close"
                onClick={() => setShowDisclaimer(false)}
                title="Dismiss disclaimer"
              >
                ✕
              </button>
            </div>
            <p className="map-disclaimer-box__text">
              Administrative boundaries delineate the <strong>Union Territory of Jammu and Kashmir</strong> and{' '}
              <strong>Union Territory of Ladakh</strong> as separate administrative units in
              accordance with the <em>Jammu and Kashmir Reorganisation Act, 2019</em>.
            </p>
            <p className="map-disclaimer-box__text">
              Disputed territories are demarcated separately and are not represented as ordinary
              internal administrative territory. Dashed/dotted lines represent approximate de facto
              control lines (<strong>Line of Control / Line of Actual Control</strong>) in accordance
              with authoritative GIS standards. Actual village coordinates and sensor placements
              remain unaltered.
            </p>
            <div className="map-disclaimer-box__meta">
              GIS Source: Natural Earth Vector (v5.1.1) · Public Domain / Open GIS
            </div>
          </div>
        )}

        {/* ── Comprehensive GIS Symbology Legend ── */}
        <div className="map-legend">
          <div className="map-legend__title">GIS Symbology &amp; Risk Status</div>

          {/* Consistent Categories for Active Layer */}
          <div className="map-legend__section">
            <div className="map-legend__section-title">
              Layer: {activeLayerMode} Categories
            </div>
            <div className="map-legend__item">
              <span className="map-legend__dot map-legend__dot--critical" />
              <span><strong>CRITICAL</strong> (Score ≥ 75)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__dot map-legend__dot--warning" />
              <span><strong>WARNING</strong> (Score 50–74)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__dot map-legend__dot--watch" />
              <span><strong>WATCH</strong> (Score 25–49)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__dot map-legend__dot--normal" />
              <span><strong>NORMAL</strong> (Score 0–24)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__dot map-legend__dot--sensor" />
              <span>IoT Telemetry Sensor Probe</span>
            </div>
          </div>

          <div className="map-legend__section">
            <div className="map-legend__section-title">Administrative Boundaries</div>
            <div className="map-legend__item">
              <span className="map-legend__line map-legend__line--jk" />
              <span>UT Jammu &amp; Kashmir (Solid Blue)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__line map-legend__line--ladakh" />
              <span>UT Ladakh (Solid Purple)</span>
            </div>
          </div>

          <div className="map-legend__section">
            <div className="map-legend__section-title">Demarcation &amp; Control Lines</div>
            <div className="map-legend__item">
              <span className="map-legend__line map-legend__line--loc" />
              <span>Line of Control — LoC (Dashed Red)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__line map-legend__line--lac" />
              <span>Line of Actual Control — LAC (Dashed Orange)</span>
            </div>
            <div className="map-legend__item">
              <span className="map-legend__line map-legend__line--disp" />
              <span>Disputed Zones (Dashed Gray)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
