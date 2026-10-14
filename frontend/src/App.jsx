import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewsPool from './pages/NewsPool'
import Settings from './pages/Settings'
import EpisodeDetail from './pages/EpisodeDetail'

const SIDEBAR_KEY = 'podcast-studio-sidebar-collapsed'

function App() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      // localStorage 不可用时静默降级
    }
  }, [collapsed])

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-cream-100">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <main className={`flex-1 transition-[margin] duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/episode/:id" element={<EpisodeDetail />} />
            <Route path="/news-pool" element={<NewsPool />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}

export default App
