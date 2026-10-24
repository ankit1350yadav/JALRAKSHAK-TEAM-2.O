import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Villages from './pages/Villages'
import WaterSources from './pages/WaterSources'
import ClimateAnalytics from './pages/ClimateAnalytics'
import Predictions from './pages/Predictions'
import Recommendations from './pages/Recommendations'
import Alerts from './pages/Alerts'
import Methodology from './pages/Methodology'
import MultiHazardMatrix from './pages/MultiHazardMatrix'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <div className="app__body">
          <Sidebar />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/matrix" element={<MultiHazardMatrix />} />
              <Route path="/villages" element={<Villages />} />
              <Route path="/sources" element={<WaterSources />} />
              <Route path="/climate" element={<ClimateAnalytics />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/methodology" element={<Methodology />} />
            </Routes>
            <footer className="app__footer">
              <p>
                JalRakshak — Educational Prototype &nbsp;|&nbsp;
                <strong>Prototype • Demonstration Data</strong> &nbsp;|&nbsp;
                AI predictions are based on synthetic data and are not certified
                hydrological forecasts.
              </p>
            </footer>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
