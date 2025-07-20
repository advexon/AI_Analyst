import React, { useState } from 'react'
import './App.css'

function Dashboard() {
  return (
    <div className="dashboard-section">
      <h2>📊 Dashboard</h2>
      <p>Key-performance indicators and charts will appear here.</p>
    </div>
  )
}

function Files() {
  return <h2>📁 File Management (coming soon)</h2>
}

function Analysis() {
  return <h2>📈 Analysis Center (coming soon)</h2>
}

function Reports() {
  return <h2>📋 Reports (coming soon)</h2>
}

function Visualizations() {
  return <h2>📊 Visualizations (coming soon)</h2>
}

function Settings() {
  return <h2>⚙️ Settings (coming soon)</h2>
}

const sections: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  files: <Files />,
  analysis: <Analysis />,
  reports: <Reports />,
  visualizations: <Visualizations />,
  settings: <Settings />,
}

function App() {
  const [active, setActive] = useState<'dashboard'|'files'|'analysis'|'reports'|'visualizations'|'settings'>(
    'dashboard',
  )

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">🏛️ Enhanced Economic Analytics Platform</h1>
      </header>

      <aside className="sidebar">
        <button className={active==='dashboard'?'nav-item active':'nav-item'} onClick={()=>setActive('dashboard')}>Dashboard</button>
        <button className={active==='files'?'nav-item active':'nav-item'} onClick={()=>setActive('files')}>Files</button>
        <button className={active==='analysis'?'nav-item active':'nav-item'} onClick={()=>setActive('analysis')}>Analysis</button>
        <button className={active==='reports'?'nav-item active':'nav-item'} onClick={()=>setActive('reports')}>Reports</button>
        <button className={active==='visualizations'?'nav-item active':'nav-item'} onClick={()=>setActive('visualizations')}>Visualizations</button>
        <button className={active==='settings'?'nav-item active':'nav-item'} onClick={()=>setActive('settings')}>Settings</button>
      </aside>

      <main className="content">
        {sections[active]}
      </main>
    </div>
  )
}

export default App 