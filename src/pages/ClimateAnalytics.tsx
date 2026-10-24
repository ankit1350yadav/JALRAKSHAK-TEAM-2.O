import React, { useEffect, useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import SyntheticDataNotice from '../components/SyntheticDataNotice'
import { getClimate, getVillages } from '../api'
import { ClimateReading, Village } from '../api/store'
import './Page.css'
import './ClimateAnalytics.css'

const SEASONS: ('winter' | 'spring' | 'summer' | 'autumn')[] = ['winter', 'spring', 'summer', 'autumn']

const SEASON_COLOURS: Record<string, string> = {
  winter: '#3b82f6',
  spring: '#16a34a',
  summer: '#ea580c',
  autumn: '#b45309',
}

const CHART_COLOURS = {
  rainfall: '#0369a1',
  temperature: '#ea580c',
  humidity: '#7c3aed',
}

export default function ClimateAnalytics() {
  const [readings, setReadings] = useState<ClimateReading[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterVillage, setFilterVillage] = useState('')
  const [filterSeason, setFilterSeason] = useState('')
  const [activeTab, setActiveTab] = useState<'trends' | 'seasonal' | 'table'>('trends')

  useEffect(() => {
    getVillages()
      .then((r) => setVillages(r.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: any = { limit: 300 }
    if (filterVillage) params.village_id = filterVillage
    if (filterSeason) params.season = filterSeason

    getClimate(params)
      .then((r) => {
        setReadings(r.data ?? [])
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Could not load climate data.')
      })
      .finally(() => setLoading(false))
  }, [filterVillage, filterSeason])

  const villageNameById = useMemo(
    () => Object.fromEntries(villages.map((v) => [v.id, v.name])),
    [villages]
  )

  const trendData = useMemo(() => {
    if (!readings.length) return []
    const byDate: Record<string, { date: string; rainfall: number[]; temp: number[]; humidity: number[] }> = {}
    for (const r of readings) {
      if (!byDate[r.recorded_date]) {
        byDate[r.recorded_date] = { date: r.recorded_date, rainfall: [], temp: [], humidity: [] }
      }
      if (r.rainfall_mm != null) byDate[r.recorded_date].rainfall.push(r.rainfall_mm)
      if (r.temperature_c != null) byDate[r.recorded_date].temp.push(r.temperature_c)
      if (r.humidity_pct != null) byDate[r.recorded_date].humidity.push(r.humidity_pct)
    }

    const avg = (arr: number[]) =>
      arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : null

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        rainfall: avg(d.rainfall),
        temperature: avg(d.temp),
        humidity: avg(d.humidity),
      }))
      .filter((_, i, arr) => {
        if (arr.length <= 60) return true
        const step = Math.ceil(arr.length / 60)
        return i % step === 0 || i === arr.length - 1
      })
  }, [readings])

  const seasonStats = useMemo(
    () =>
      SEASONS.map((season) => {
        const rows = readings.filter((r) => r.season === season)
        if (!rows.length) return null
        const avg = (field: keyof ClimateReading) => {
          const vals = rows.map((r) => r[field] as number).filter((v) => v != null)
          return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null
        }
        return {
          season: season.charAt(0).toUpperCase() + season.slice(1),
          seasonKey: season,
          count: rows.length,
          rainfall: avg('rainfall_mm'),
          temperature: avg('temperature_c'),
          humidity: avg('humidity_pct'),
        }
      }).filter(Boolean) as any[],
    [readings]
  )

  const formatDate = (d: string) => {
    if (!d) return ''
    return d.slice(5)
  }

  const hasData = readings.length > 0

  return (
    <div className="page">
      <h1 className="page__title">Climate Analytics</h1>
      <SyntheticDataNotice extra="All climate readings (rainfall, temperature, humidity) are synthetic demonstration data generated with seasonal patterns. Not actual meteorological measurements." />

      {/* ── Filters ── */}
      <div className="climate-filters" role="search" aria-label="Filter climate data">
        <label className="climate-filter-label" htmlFor="village-filter">
          Location
        </label>
        <select
          id="village-filter"
          value={filterVillage}
          onChange={(e) => setFilterVillage(e.target.value)}
          className="climate-select"
        >
          <option value="">All Locations</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <label className="climate-filter-label" htmlFor="season-filter">
          Season
        </label>
        <select
          id="season-filter"
          value={filterSeason}
          onChange={(e) => setFilterSeason(e.target.value)}
          className="climate-select"
        >
          <option value="">All Seasons</option>
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {(filterVillage || filterSeason) && (
          <button
            onClick={() => {
              setFilterVillage('')
              setFilterSeason('')
            }}
            className="climate-clear-btn"
          >
            Clear filters
          </button>
        )}

        <span className="climate-count-badge">
          {loading ? 'Loading…' : `${readings.length} readings loaded`}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div className="climate-tabs" role="tablist">
        <button
          className={`climate-tab${activeTab === 'trends' ? ' climate-tab--active' : ''}`}
          onClick={() => setActiveTab('trends')}
          role="tab"
          aria-selected={activeTab === 'trends'}
        >
          📈 Time-Series Trends
        </button>
        <button
          className={`climate-tab${activeTab === 'seasonal' ? ' climate-tab--active' : ''}`}
          onClick={() => setActiveTab('seasonal')}
          role="tab"
          aria-selected={activeTab === 'seasonal'}
        >
          🌤 Seasonal Analysis
        </button>
        <button
          className={`climate-tab${activeTab === 'table' ? ' climate-tab--active' : ''}`}
          onClick={() => setActiveTab('table')}
          role="tab"
          aria-selected={activeTab === 'table'}
        >
          📋 Data Table
        </button>
      </div>

      {loading && <p className="loading-text">Loading climate analytics…</p>}

      {!loading && error && (
        <div className="error-banner" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="card" style={{ textAlign: 'center', padding: 36, color: 'var(--color-muted)' }}>
          No climate readings found for the selected filters.
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          {activeTab === 'trends' && (
            <div className="climate-charts-grid">
              <ChartCard
                title="Rainfall Trend (mm)"
                note="Daily readings / daily average across locations"
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={36} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [`${v != null ? v : '—'} mm`, 'Rainfall']}
                      labelFormatter={(l) => `Date: ${l}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rainfall"
                      stroke={CHART_COLOURS.rainfall}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Temperature Trend (°C)"
                note="Daily readings / daily average across locations"
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={36}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}°`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v != null ? v : '—'} °C`, 'Temp']}
                      labelFormatter={(l) => `Date: ${l}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke={CHART_COLOURS.temperature}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Humidity Trend (%)"
                note="Daily readings / daily average across locations"
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={36}
                      domain={[0, 100]}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v != null ? v : '—'}%`, 'Humidity']}
                      labelFormatter={(l) => `Date: ${l}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      stroke={CHART_COLOURS.humidity}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {activeTab === 'seasonal' && (
            <>
              {seasonStats.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--color-muted)' }}>
                  No seasonal data available for the current selection.
                </div>
              ) : (
                <div className="climate-charts-grid">
                  <ChartCard
                    title="Average Rainfall by Season (mm)"
                    note="Synthetic demonstration data"
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={seasonStats} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="season" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} width={36} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: any) => [`${v != null ? v : '—'} mm`, 'Avg Rainfall']}
                          contentStyle={{ fontSize: 12 }}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <Bar dataKey="rainfall" name="Avg Rainfall (mm)" radius={[4, 4, 0, 0]} maxBarSize={52}>
                          {seasonStats.map((s) => (
                            <Cell key={s.seasonKey} fill={SEASON_COLOURS[s.seasonKey] || '#64748b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Average Temperature by Season (°C)"
                    note="Synthetic demonstration data"
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={seasonStats} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="season" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          width={36}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}°`}
                        />
                        <Tooltip
                          formatter={(v: any) => [`${v != null ? v : '—'} °C`, 'Avg Temp']}
                          contentStyle={{ fontSize: 12 }}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <Bar
                          dataKey="temperature"
                          name="Avg Temp (°C)"
                          fill={CHART_COLOURS.temperature}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={52}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Average Humidity by Season (%)"
                    note="Synthetic demonstration data"
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={seasonStats} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="season" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          width={36}
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(v: any) => [`${v != null ? v : '—'}%`, 'Avg Humidity']}
                          contentStyle={{ fontSize: 12 }}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <Bar
                          dataKey="humidity"
                          name="Avg Humidity (%)"
                          fill={CHART_COLOURS.humidity}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={52}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}

              {seasonStats.length > 0 && (
                <section className="card" style={{ marginTop: 20 }}>
                  <h2 className="card__heading">Season Summary Table</h2>
                  <div className="table-wrapper" style={{ marginTop: 12 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Season</th>
                          <th>Readings</th>
                          <th>Avg Rainfall (mm)</th>
                          <th>Avg Temp (°C)</th>
                          <th>Avg Humidity (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasonStats.map((s) => (
                          <tr key={s.seasonKey}>
                            <td>
                              <span
                                className="season-dot"
                                style={{ background: SEASON_COLOURS[s.seasonKey] }}
                              />
                              {s.season}
                            </td>
                            <td>{s.count}</td>
                            <td>{s.rainfall != null ? s.rainfall : '—'}</td>
                            <td>{s.temperature != null ? s.temperature : '—'}</td>
                            <td>{s.humidity != null ? s.humidity : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'table' && (
            <section className="card">
              <h2 className="card__heading">
                Recent Readings{' '}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)' }}>
                  (showing {readings.length})
                </span>
              </h2>
              <div className="table-wrapper" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Village</th>
                      <th>Season</th>
                      <th>Rainfall (mm)</th>
                      <th>Temp (°C)</th>
                      <th>Humidity (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12 }}>{r.recorded_date}</td>
                        <td>{villageNameById[r.village_id] || `#${r.village_id}`}</td>
                        <td>
                          {r.season ? (
                            <>
                              <span
                                className="season-dot"
                                style={{ background: SEASON_COLOURS[r.season] ?? '#64748b' }}
                              />
                              {r.season.charAt(0).toUpperCase() + r.season.slice(1)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{r.rainfall_mm != null ? r.rainfall_mm.toFixed(1) : '—'}</td>
                        <td>{r.temperature_c != null ? r.temperature_c.toFixed(1) : '—'}</td>
                        <td>{r.humidity_pct != null ? r.humidity_pct.toFixed(1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
            Prototype • Demonstration Data — synthetic seasonal patterns, not real meteorological
            records.
          </p>
        </>
      )}
    </div>
  )
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="card chart-card" aria-label={title}>
      <h2 className="card__heading">{title}</h2>
      {note && <p className="chart-card__note">{note}</p>}
      <div className="chart-card__body">{children}</div>
    </section>
  )
}
