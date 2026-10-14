import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, Newspaper, Settings, Radio, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const navItems = [
  { path: '/', icon: CalendarDays, label: '节目' },
  { path: '/news-pool', icon: Newspaper, label: '新闻池' },
]

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation()

  // 双击空白区域收起/展开；落在链接/按钮上的双击不触发
  const handleDoubleClick = (e) => {
    if (e.target.closest('a, button')) return
    onToggle()
  }

  return (
    <aside
      onDoubleClick={handleDoubleClick}
      className={`fixed left-0 top-0 h-screen bg-cream-200 border-r border-cream-400 flex flex-col transition-all duration-200 z-40 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo 区域 */}
      <div className={`border-b border-cream-400 ${collapsed ? 'p-3' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 shrink-0 bg-ink-300 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-cream-100" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-ink-300 whitespace-nowrap">
                Podcast Studio
              </h1>
              <p className="text-xs text-ink-50 whitespace-nowrap">播客创作工作站</p>
            </div>
          )}
        </div>
      </div>

      {/* 导航 */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-4'}`}>
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
                  title={collapsed ? item.label : undefined}
                  className={`block relative rounded-xl transition-all duration-200 group ${
                    collapsed ? 'px-0 py-3' : 'px-4 py-3'
                  } ${isActive ? 'bg-cream-100 shadow-sm' : 'hover:bg-cream-300'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-cream-100 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <div className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? 'text-accent-coral' : 'text-ink-50 group-hover:text-ink-300'
                      }`}
                    />
                    {!collapsed && (
                      <span
                        className={`font-medium whitespace-nowrap transition-colors ${
                          isActive ? 'text-ink-300' : 'text-ink-50 group-hover:text-ink-300'
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </div>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 底部：收起/展开 + 设置 */}
      <div className={`border-t border-cream-400 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={onToggle}
          title={collapsed ? '展开导航（也可双击侧栏空白处）' : '收起导航（也可双击侧栏空白处）'}
          className={`w-full flex items-center rounded-xl text-ink-50 hover:bg-cream-300 hover:text-ink-300 transition-colors ${
            collapsed ? 'justify-center py-3' : 'gap-3 px-4 py-3'
          }`}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          {!collapsed && <span className="font-medium whitespace-nowrap">收起导航</span>}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? '设置' : undefined}
          className={`flex items-center rounded-xl transition-colors ${
            collapsed ? 'justify-center py-3' : 'gap-3 px-4 py-3'
          } ${location.pathname === '/settings' ? 'bg-cream-100 shadow-sm' : 'hover:bg-cream-300'}`}
        >
          <Settings
            className={`w-5 h-5 shrink-0 ${
              location.pathname === '/settings' ? 'text-accent-coral' : 'text-ink-50'
            }`}
          />
          {!collapsed && (
            <span
              className={`font-medium whitespace-nowrap ${
                location.pathname === '/settings' ? 'text-ink-300' : 'text-ink-50'
              }`}
            >
              设置
            </span>
          )}
        </NavLink>
      </div>
    </aside>
  )
}
