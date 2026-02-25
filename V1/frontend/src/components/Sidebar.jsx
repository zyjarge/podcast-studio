import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Newspaper,
  FileText,
  Volume2,
  Layers,
  Settings,
  Mic,
  Zap,
  Sparkles,
  Radio,
  Plus,
  List
} from 'lucide-react'

const navItems = [
  { path: '/', icon: List, label: '节目列表' },
  { path: '/news-pool', icon: Newspaper, label: '新闻池' },
]

export default function Sidebar({ currentMode, setCurrentMode }) {
  const location = useLocation()
  const isEpisodePage = location.pathname.startsWith('/episode/')

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-cream-200 border-r border-cream-400 flex flex-col">
      {/* Logo 区域 */}
      <div className="p-6 border-b border-cream-400">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ink-300 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-cream-100" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-ink-300">
              Podcast Studio
            </h1>
            <p className="text-xs text-ink-50">播客创作工作站</p>
          </div>
        </div>
      </div>

      {/* 模式切换 */}
      {isEpisodePage && (
        <div className="p-4 border-b border-cream-400">
          <div className="bg-cream-300 rounded-xl p-1 flex">
            <button
              onClick={() => setCurrentMode('refine')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                currentMode === 'refine'
                  ? 'bg-cream-100 shadow-sm text-ink-300'
                  : 'text-ink-50 hover:text-ink-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              精编模式
            </button>
            <button
              onClick={() => setCurrentMode('auto')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                currentMode === 'auto'
                  ? 'bg-cream-100 shadow-sm text-ink-300'
                  : 'text-ink-50 hover:text-ink-300'
              }`}
            >
              <Zap className="w-4 h-4" />
              自动模式
            </button>
          </div>
        </div>
      )}

      {/* 导航 */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`block relative px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-cream-100 shadow-sm'
                      : 'hover:bg-cream-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-cream-100 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? 'text-accent-coral' : 'text-ink-50 group-hover:text-ink-300'
                      }`}
                    />
                    <span
                      className={`font-medium transition-colors ${
                        isActive ? 'text-ink-300' : 'text-ink-50 group-hover:text-ink-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t border-cream-400">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-cream-300 transition-colors"
        >
          <Settings className="w-5 h-5 text-ink-50" />
          <span className="font-medium text-ink-50">设置</span>
        </NavLink>
      </div>
    </aside>
  )
}
