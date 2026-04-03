import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Volume2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  MoreHorizontal,
  X,
  Loader2
} from 'lucide-react'
import { episodesApi } from '../services/api'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const STATUS_COLORS = {
  draft: { bg: 'bg-cream-300', text: 'text-ink-50', border: 'border-cream-400' },
  editing: { bg: 'bg-accent-gold/20', text: 'text-accent-gold', border: 'border-accent-gold' },
  published: { bg: 'bg-accent-sage/20', text: 'text-accent-sage', border: 'border-accent-sage' },
}

export default function Dashboard({ currentMode }) {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    editing: 0,
    published: 0,
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('')
  const [newEpisodeDate, setNewEpisodeDate] = useState(new Date().toISOString().split('T')[0])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchEpisodes()
  }, [])

  const fetchEpisodes = async () => {
    try {
      setLoading(true)
      const data = await episodesApi.list()
      setEpisodes(data || [])

      // 计算统计数据
      const counts = {
        total: data?.length || 0,
        draft: data?.filter(e => e.status === 'draft').length || 0,
        editing: data?.filter(e => e.status === 'editing').length || 0,
        published: data?.filter(e => e.status === 'published').length || 0,
      }
      setStats(counts)
    } catch (err) {
      console.error('Failed to fetch episodes:', err)
    } finally {
      setLoading(false)
    }
  }

  // 创建节目
  const handleCreateEpisode = async () => {
    const title = newEpisodeTitle.trim() || '科技播客'
    // 使用选择的日期，设置时间为中午12:00避免时区偏移
    const scheduledDate = new Date(`${newEpisodeDate}T12:00:00`)
    try {
      setCreating(true)
      const newEpisode = await episodesApi.create({ 
        title,
        scheduled_date: scheduledDate.toISOString()
      })
      setEpisodes([newEpisode, ...episodes])
      setNewEpisodeTitle('')
      setShowCreateModal(false)
      navigate(`/episode/${newEpisode.id}`)
    } catch (err) {
      console.error('Failed to create episode:', err)
    } finally {
      setCreating(false)
    }
  }

  // 获取日历数据
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 获取当月第一天
    const firstDay = new Date(year, month, 1)
    const startDay = firstDay.getDay()

    // 获取当月最后一天
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()

    // 获取上月的最后几天
    const prevMonthLastDay = new Date(year, month, 0).getDate()

    const days = []

    // 上月的日期
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      })
    }

    // 当月的日期
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      })
    }

    // 下月的日期
    const remainingDays = 42 - days.length // 6行 x 7列 = 42
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      })
    }

    return days
  }

  // 获取某天的节目（优先使用 scheduled_date，否则用 created_at）
  // 使用本地日期比较，避免时区问题
  const getLocalDateStr = (date) => {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getEpisodesForDate = (date) => {
    const targetDateStr = getLocalDateStr(date)
    return episodes.filter(ep => {
      const dateToUse = ep.scheduled_date || ep.created_at
      const epDateStr = getLocalDateStr(new Date(dateToUse))
      return epDateStr === targetDateStr
    })
  }

  // 判断是否是今天
  const isToday = (date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // 上一个月
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  // 下一个月
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // 回到今天
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthYear = currentDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long'
  })

  const calendarDays = getCalendarDays()

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-300">节目管理</h1>
          </div>
          <button
            onClick={() => {
              setNewEpisodeTitle('科技播客')
              setNewEpisodeDate(new Date().toISOString().split('T')[0])
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建节目
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-cream-100 rounded-xl p-4 border border-cream-300">
            <p className="text-sm text-ink-50 mb-1">全部节目</p>
            <p className="text-2xl font-display font-semibold text-ink-300">{stats.total}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-4 border border-cream-300">
            <p className="text-sm text-ink-50 mb-1">草稿</p>
            <p className="text-2xl font-display font-semibold text-accent-gold">{stats.draft}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-4 border border-cream-300">
            <p className="text-sm text-ink-50 mb-1">编辑中</p>
            <p className="text-2xl font-display font-semibold text-accent-coral">{stats.editing}</p>
          </div>
          <div className="bg-cream-100 rounded-xl p-4 border border-cream-300">
            <p className="text-sm text-ink-50 mb-1">已发布</p>
            <p className="text-2xl font-display font-semibold text-accent-sage">{stats.published}</p>
          </div>
        </div>
      </div>

      {/* 日历视图 */}
      <div className="bg-cream-100 rounded-2xl border border-cream-300 overflow-hidden">
        {/* 日历头部 */}
        <div className="flex items-center justify-center px-4 py-3 border-b border-cream-300 bg-cream-200 gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-ink-300" />
          </button>
          <h2 className="font-display text-lg font-semibold text-ink-300 min-w-[140px] text-center">
            {monthYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-ink-300" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm text-ink-50 hover:text-ink-300 hover:bg-cream-300 rounded-lg transition-colors"
          >
            今天
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 border-b border-cream-300">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`py-2 text-center text-sm font-medium ${
                index === 0 || index === 6
                  ? 'text-accent-coral/70'
                  : 'text-ink-50'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7">
          {calendarDays.map((dayInfo, index) => {
            const dayEpisodes = getEpisodesForDate(dayInfo.date)
            const isWeekend = dayInfo.date.getDay() === 0 || dayInfo.date.getDay() === 6

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border-b border-r border-cream-300 ${
                  !dayInfo.isCurrentMonth ? 'bg-cream-200/50' : ''
                } ${isWeekend && dayInfo.isCurrentMonth ? 'bg-cream-200/30' : ''}`}
              >
                {/* 日期 */}
                <div className={`mb-1 ${
                  isToday(dayInfo.date)
                    ? 'w-7 h-7 rounded-full bg-accent-coral text-cream-100 flex items-center justify-center'
                    : `text-sm ${isWeekend && dayInfo.isCurrentMonth ? 'text-accent-coral/70' : 'text-ink-50'}`
                }`}>
                  {dayInfo.day}
                </div>

                {/* 节目列表 */}
                <div className="space-y-1">
                  {dayEpisodes.slice(0, 2).map((ep) => {
                    const colors = STATUS_COLORS[ep.status] || STATUS_COLORS.draft
                    return (
                      <div
                        key={ep.id}
                        onClick={() => navigate(`/episode/${ep.id}`)}
                        className={`px-2 py-1 rounded text-xs cursor-pointer truncate ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}
                        title={ep.title}
                      >
                        {ep.title || '未命名节目'}
                      </div>
                    )
                  })}
                  {dayEpisodes.length > 2 && (
                    <div className="text-xs text-ink-50 pl-1">
                      +{dayEpisodes.length - 2} 更多
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 bg-cream-100/80 flex items-center justify-center">
          <div className="text-ink-50">加载中...</div>
        </div>
      )}

      {/* 新建节目弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">新建节目</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-2">预计播出日期</label>
                    <input
                      type="date"
                      value={newEpisodeDate}
                      onChange={(e) => {
                        setNewEpisodeDate(e.target.value)
                      }}
                      className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-300 mb-2">节目标题</label>
                    <input
                      type="text"
                      value={newEpisodeTitle}
                      onChange={(e) => setNewEpisodeTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateEpisode()}
                      className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      placeholder="输入节目标题"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateEpisode}
                  disabled={creating}
                  className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建并编辑'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
