import React from 'react'
import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/',                label: 'Dashboard',             icon: '⬡' },
  { to: '/map',             label: 'Multi-Hazard Map',      icon: '🗺' },
  { to: '/matrix',          label: 'Hazard Matrix',         icon: '📊' },
  { to: '/villages',        label: 'Study Locations',       icon: '🏔' },
  { to: '/sources',         label: 'Water Sources',         icon: '💧' },
  { to: '/climate',         label: 'Climate & Telemetry',   icon: '🌤' },
  { to: '/predictions',     label: 'Multi-Hazard Lab',      icon: '🤖' },
  { to: '/recommendations', label: 'Action Protocols',      icon: '📋' },
  { to: '/alerts',          label: 'Emergency Alerts',      icon: '🔔' },
  { to: '/methodology',     label: 'Methodology & Physics', icon: 'ℹ' },
]

export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
          }
        >
          <span className="sidebar__icon" aria-hidden="true">{icon}</span>
          <span className="sidebar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
