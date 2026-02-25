import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewsPool from './pages/NewsPool'
import ScriptEditor from './pages/ScriptEditor'
import AudioStudio from './pages/AudioStudio'
import Integration from './pages/Integration'
import Settings from './pages/Settings'
import EpisodeList from './pages/EpisodeList'
import EpisodeDetail from './pages/EpisodeDetail'

function App() {
  const [currentMode, setCurrentMode] = useState('refine')
  const [currentEpisode, setCurrentEpisode] = useState(null)

  return (
    <div className="flex min-h-screen bg-cream-100">
      <Sidebar currentMode={currentMode} setCurrentMode={setCurrentMode} />
      <main className="flex-1 ml-64">
        <Routes>
          <Route path="/" element={<EpisodeList />} />
          <Route path="/episode/:id" element={<EpisodeDetail currentMode={currentMode} />} />
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
