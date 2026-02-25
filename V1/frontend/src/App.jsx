import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewsPool from './pages/NewsPool'
import ScriptEditor from './pages/ScriptEditor'
import AudioStudio from './pages/AudioStudio'
import Integration from './pages/Integration'
import Settings from './pages/Settings'

function App() {
  const [currentMode, setCurrentMode] = useState('refine') // 'refine' | 'auto'

  return (
    <div className="flex min-h-screen bg-cream-100">
      <Sidebar currentMode={currentMode} setCurrentMode={setCurrentMode} />
      <main className="flex-1 ml-64">
        <Routes>
          <Route path="/" element={<Dashboard currentMode={currentMode} />} />
          <Route path="/news-pool" element={<NewsPool />} />
          <Route path="/scripts" element={<ScriptEditor />} />
          <Route path="/audio" element={<AudioStudio />} />
          <Route path="/integration" element={<Integration />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
