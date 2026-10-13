import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, Newspaper, Settings, Radio } from 'lucide-react'

const navItems = [
  { path: '/', icon: CalendarDays, label: '节目' },
  { path: '/news-pool', icon: Newspaper, label: '新闻池' },
]

export default function Sidebar() {
  const location = useLocation()

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

      {/* 导航 */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/' || location.pathname.startsWith('/episode/')
                : location.pathname === item.path
            const Icon = item.icon

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`block relative px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive ? 'bg-cream-100 shadow-sm' : 'hover:bg-cream-300'
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

      {/* 底部：设置 */}
      <div className="p-4 border-t border-cream-400">
        <NavLink
          to="/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
            location.pathname === '/settings'
              ? 'bg-cream-100 shadow-sm'
              : 'hover:bg-cream-300'
          }`}
        >
          <Settings
            className={`w-5 h-5 ${
              location.pathname === '/settings' ? 'text-accent-coral' : 'text-ink-50'
            }`}
          />
          <span
            className={`font-medium ${
              location.pathname === '/settings' ? 'text-ink-300' : 'text-ink-50'
            }`}
          >
            设置
          </span>
        </NavLink>
      </div>
    </aside>
  )
}
