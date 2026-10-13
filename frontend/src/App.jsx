import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewsPool from './pages/NewsPool'
import Settings from './pages/Settings'
import EpisodeDetail from './pages/EpisodeDetail'

function App() {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-cream-100">
        <Sidebar />
        <main className="flex-1 ml-64">
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
