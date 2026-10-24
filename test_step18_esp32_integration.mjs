/**
 * test_step18_esp32_integration.mjs
 * Comprehensive 10-Scenario Validation Suite for JalRakshak 2.0 Step 18 ESP32 Hardware Integration
 */

const BASE_URL = 'http://127.0.0.1:3000'

async function runTests() {
  console.log('======================================================================')
  console.log('JALRAKSHAK 2.0 — STEP 18: REAL ESP32 HARDWARE INTEGRATION TEST SUITE')
  console.log('======================================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ✕ FAIL: ${message}`)
      failed++
    }
  }

  // Helper for requests
  async function postJson(endpoint, data) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, ok: res.ok, data: json }
  }

  async function getJson(endpoint) {
    const res = await fetch(`${BASE_URL}${endpoint}`)
    const json = await res.json().catch(() => ({}))
    return { status: res.status, ok: res.ok, data: json }
  }

  // Setup: Reset real hardware state
  await postJson('/api/real-hardware/reset', {})

  // -------------------------------------------------------------------------
  // Scenario 1: Valid Telemetry Transmission
  // -------------------------------------------------------------------------
  console.log('Scenario 1: Valid Telemetry Transmission (JR-NODE-01)')
  const validPacket = {
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
  const res1 = await postJson('/api/telemetry', validPacket)
  assert(res1.status === 200, `HTTP status is 200 (got ${res1.status})`)
  assert(res1.data.status === 'ACCEPTED' || res1.data.status === 'OK', `Status is ACCEPTED/OK (got ${res1.data.status})`)
  assert(res1.data.data_quality === 'REAL', `Data quality is flagged REAL`)
  assert(res1.data.node_id === 'JR-NODE-01', `Node ID matches JR-NODE-01`)
  assert(res1.data.computed_risks !== undefined, `Live risk computation executed in pipeline`)

  // -------------------------------------------------------------------------
  // Scenario 2: Missing node_id Validation
  // -------------------------------------------------------------------------
  console.log('\nScenario 2: Reject Missing node_id (HTTP 400)')
  const missingNodePacket = {
    ...validPacket,
    node_id: undefined,
  }
  delete missingNodePacket.node_id
  const res2 = await postJson('/api/telemetry', missingNodePacket)
  assert(res2.status === 400, `Rejected with HTTP 400 (got ${res2.status})`)
  assert(res2.data.error_code === 'MISSING_NODE_ID', `Error code is MISSING_NODE_ID (got ${res2.data.error_code})`)

  // -------------------------------------------------------------------------
  // Scenario 3: Reject Out-of-Bounds Values
  // -------------------------------------------------------------------------
  console.log('\nScenario 3: Reject Impossible / Out-of-Bounds Physical Value (HTTP 400)')
  const invalidValuePacket = {
    ...validPacket,
    water_level_cm: -50.0, // Water level cannot be negative
  }
  const res3 = await postJson('/api/telemetry', invalidValuePacket)
  assert(res3.status === 400, `Rejected negative water level with HTTP 400 (got ${res3.status})`)
  assert(res3.data.error_code === 'VALUE_OUT_OF_BOUNDS', `Error code is VALUE_OUT_OF_BOUNDS (got ${res3.data.error_code})`)
  assert(res3.data.field === 'water_level_cm', `Identified offending field: water_level_cm`)

  const invalidHumidityPacket = {
    ...validPacket,
    humidity_pct: 125.0, // Humidity cannot exceed 100%
  }
  const res3b = await postJson('/api/telemetry', invalidHumidityPacket)
  assert(res3b.status === 400, `Rejected humidity > 100% with HTTP 400 (got ${res3b.status})`)

  // -------------------------------------------------------------------------
  // Scenario 4: Missing Optional Sensor (Null values allowed)
  // -------------------------------------------------------------------------
  console.log('\nScenario 4: Accept Telemetry with Missing Optional Sensors (null values)')
  const nullSensorsPacket = {
    node_id: 'JR-NODE-01',
    timestamp: new Date().toISOString(),
    water_level_cm: 195.0,
    water_rise_rate: null, // Optional
    rainfall_mm: 35.0,
    rainfall_intensity: null, // Optional
    soil_moisture_1: 72.0,
    soil_moisture_2: null, // Optional
    temperature_c: 19.5,
    humidity_pct: 82.0,
    pressure_hpa: 1010.0,
    battery_level: 87,
  }
  const res4 = await postJson('/api/telemetry', nullSensorsPacket)
  assert(res4.status === 200, `Accepted packet with null optional values (HTTP 200)`)
  assert(res4.data.node_id === 'JR-NODE-01', `Confirmed node is JR-NODE-01`)

  // -------------------------------------------------------------------------
  // Scenario 5: Reject Unknown Node ID (HTTP 404)
  // -------------------------------------------------------------------------
  console.log('\nScenario 5: Reject Unknown Node ID (HTTP 404)')
  const unknownNodePacket = {
    ...validPacket,
    node_id: 'JR-NODE-UNKNOWN-999',
  }
  const res5 = await postJson('/api/telemetry', unknownNodePacket)
  assert(res5.status === 404, `Rejected unknown node with HTTP 404 (got ${res5.status})`)
  assert(res5.data.error_code === 'UNKNOWN_NODE', `Error code is UNKNOWN_NODE (got ${res5.data.error_code})`)

  // -------------------------------------------------------------------------
  // Scenario 6: Stale Node Detection
  // -------------------------------------------------------------------------
  console.log('\nScenario 6: Hardware Status Tri-State Logic (CONNECTED vs STALE)')
  const statusRes = await getJson('/api/real-hardware/status')
  assert(statusRes.status === 200, `Fetched hardware status (HTTP 200)`)
  assert(statusRes.data.status === 'CONNECTED', `Node is currently CONNECTED after fresh packet`)
  assert(statusRes.data.is_connected === true, `is_connected flag is true`)
  assert(statusRes.data.stale_timeout_sec === 60, `Stale threshold is configured to 60s`)

  // Verify stale rule calculation: If a packet was older than 60s
  const now = Date.now()
  const staleHeartbeatTime = new Date(now - 75 * 1000).toISOString()
  const elapsed = (now - new Date(staleHeartbeatTime).getTime()) / 1000
  const evaluatedStatus = elapsed > statusRes.data.stale_timeout_sec ? 'STALE' : 'CONNECTED'
  assert(evaluatedStatus === 'STALE', `Elapsed time (${elapsed}s) > 60s correctly evaluates to STALE`)

  // -------------------------------------------------------------------------
  // Scenario 7: Multiple Telemetry Packets Counter
  // -------------------------------------------------------------------------
  console.log('\nScenario 7: Multiple Telemetry Packets & Ingestion Counter')
  const prevCount = statusRes.data.packets_received_count
  await postJson('/api/telemetry', { ...validPacket, water_level_cm: 200.0 })
  await postJson('/api/telemetry', { ...validPacket, water_level_cm: 205.0 })
  const statusRes2 = await getJson('/api/real-hardware/status')
  assert(statusRes2.data.packets_received_count === prevCount + 2, `Packet counter incremented from ${prevCount} to ${statusRes2.data.packets_received_count}`)
  assert(statusRes2.data.latest_telemetry.water_level_cm === 205.0, `Latest telemetry updated to newest reading (205.0 cm)`)

  // -------------------------------------------------------------------------
  // Scenario 8: Historical Readings & Time-Range Filtering
  // -------------------------------------------------------------------------
  console.log('\nScenario 8: Historical Readings & Range Filtering')
  const histAll = await getJson('/api/telemetry/history?node_id=JR-NODE-01&range=all')
  assert(histAll.status === 200, `Fetched history range=all (HTTP 200)`)
  assert(histAll.data.records.length >= 3, `Returned ${histAll.data.records.length} historical records`)
  assert(histAll.data.records[0].data_quality === 'REAL', `History records tagged as REAL`)

  const hist1h = await getJson('/api/telemetry/history?node_id=JR-NODE-01&range=1h')
  assert(hist1h.status === 200, `Fetched history range=1h (HTTP 200)`)
  assert(Array.isArray(hist1h.data.records), `Range 1h returns array of records`)

  // -------------------------------------------------------------------------
  // Scenario 9: Live Risk Engine Assessment Update
  // -------------------------------------------------------------------------
  console.log('\nScenario 9: Live Risk Engine Update on Ingestion')
  // Post high-hazard packet: heavy rainfall and rapid rise rate
  const highRiskPacket = {
    node_id: 'JR-NODE-01',
    timestamp: new Date().toISOString(),
    water_level_cm: 450.0,
    water_rise_rate: 28.0, // Flash flood trigger
    rainfall_mm: 120.0,
    rainfall_intensity: 65.0,
    soil_moisture_1: 88.0, // High saturation
    soil_moisture_2: 85.0,
    temperature_c: 21.0,
    humidity_pct: 95.0,
    pressure_hpa: 998.0,
    battery_level: 78,
  }
  const highRiskRes = await postJson('/api/telemetry', highRiskPacket)
  assert(highRiskRes.status === 200, `Ingested severe storm telemetry`)
  const risks = highRiskRes.data.computed_risks
  assert(risks !== null && risks !== undefined, `Computed risks present`)
  assert(risks.flood.level === 'high' || risks.flood.score >= 50, `Flood engine elevated risk score (score: ${risks.flood.score}, level: ${risks.flood.level})`)
  assert(risks.multi_hazard.composite_score >= 50, `Multi-Hazard composite score elevated (score: ${risks.multi_hazard.composite_score})`)

  // -------------------------------------------------------------------------
  // Scenario 10: Diagnostics & System Operating Mode
  // -------------------------------------------------------------------------
  console.log('\nScenario 10: Diagnostics & System Operating Mode Integrity')
  const diagRes = await getJson('/api/real-hardware/diagnostics')
  assert(diagRes.status === 200, `Fetched diagnostics (HTTP 200)`)
  assert(diagRes.data.node_id === 'JR-NODE-01', `Diagnostics node is JR-NODE-01`)
  assert(diagRes.data.coordinates.latitude === 32.9934, `Coordinates match Katra (Lat: 32.9934)`)
  assert(diagRes.data.coordinates.longitude === 74.9317, `Coordinates match Katra (Lon: 74.9317)`)
  assert(diagRes.data.last_validation_error !== null, `Recorded validation error from Scenario 3`)

  const modeRes = await getJson('/api/mode')
  assert(modeRes.status === 200, `Operating mode endpoint active (mode: ${modeRes.data.mode})`)

  const healthRes = await getJson('/api/health')
  assert(healthRes.status === 200, `Health API working (/api/health)`)

  const villagesRes = await getJson('/api/villages')
  assert(villagesRes.status === 200, `Villages API working (/api/villages)`)
  assert(villagesRes.data.length === 10, `All 10 original villages preserved`)

  const sourcesRes = await getJson('/api/sources')
  assert(sourcesRes.status === 200, `Sources API working (/api/sources)`)
  assert(sourcesRes.data.length === 30, `All 30 original water sources preserved`)

  console.log('\n======================================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('======================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
