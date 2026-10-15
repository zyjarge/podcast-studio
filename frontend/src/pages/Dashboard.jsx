import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  KeyRound,
  Rss,
  Download,
  X,
  Loader2,
  CalendarDays,
  WifiOff,
} from 'lucide-react'
import { episodesApi, newsApi, sourcesApi, settingsApi, humanizeError } from '../services/api'
import { useToast } from '../components/Toast'

const ONBOARDING_KEY = 'podcast-studio-onboarding-dismissed'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const STATUS_BAR = {
  editing: 'border-l-accent-gold',
  published: 'border-l-accent-sage',
  draft: 'border-l-cream-400',
}

const STATUS_DOT = {
  editing: 'bg-accent-gold',
  published: 'bg-accent-sage',
  draft: 'bg-cream-500',
}

const STATUS_LABEL = { editing: '编辑中', published: '已发布', draft: '草稿' }

const todayTitle = () => {
  const d = new Date()
  return `科技双响炮 · ${d.getMonth() + 1}月${d.getDate()}日`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [episodes, setEpisodes] = useState([])
  const [sources, setSources] = useState([])
  const [envKeys, setEnvKeys] = useState({})
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === '1'
    } catch {
      return false
    }
  })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [starting, setStarting] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [eps, srcs, keys] = await Promise.all([
        episodesApi.list(),
        sourcesApi.list(),
        settingsApi.getEnvKeys(),
      ])
      setEpisodes(eps)
      setSources(srcs)
      setEnvKeys(keys)
    } catch (e) {
      setLoadError(humanizeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismissOnboarding = () => {
    setOnboardingDismissed(true)
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      // localStorage 不可用时静默降级
    }
  }

  const stats = {
    total: episodes.length,
    editing: episodes.filter((e) => e.status === 'editing').length,
    published: episodes.filter((e) => e.status === 'published').length,
  }

  const hasKeys = Boolean(envKeys.DEEPSEEK_API_KEY && envKeys.MINIMAX_API_KEY)
  const hasSources = sources.some((s) => s.enabled)
  const showOnboarding = !onboardingDismissed && !loading && !loadError && (!hasKeys || !hasSources)

  // 开始今日节目：后台抓取 → 创建节目 → 进入详情并自动进入选料模式
  const handleStartToday = async () => {
    if (starting) return
    setStarting(true)
    toast.info('正在抓取最新新闻…')
    newsApi
      .fetch()
      .then((res) => {
        const added = res?.added ?? 0
        const failed = res?.failed_sources || []
        if (failed.length > 0) {
          toast.error(`抓取完成，但这些源失败了：${failed.join('、')}`)
        } else {
          toast.success(added > 0 ? `已抓取 ${added} 条新闻，已自动评分` : '新闻池已是最新')
        }
      })
      .catch((e) => toast.error(humanizeError(e)))
    try {
      const episode = await episodesApi.create({
        title: todayTitle(),
        scheduled_date: new Date().toISOString(),
      })
      // 新建节目直接进入"编辑中"状态
      episodesApi.update(episode.id, { status: 'editing' }).catch(() => {})
      navigate(`/episode/${episode.id}?picker=1`)
    } catch (e) {
      toast.error(humanizeError(e))
      setStarting(false)
    }
  }

  const getLocalDateStr = (date) => {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getEpisodesForDate = (date) => {
    const target = getLocalDateStr(date)
    return episodes.filter((ep) => getLocalDateStr(ep.scheduled_date || ep.created_at) === target)
  }

  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const startDay = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    const days = []
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) })
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) })
    }
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) })
    }
    return days
  }

  const isToday = (date) => date.toDateString() === new Date().toDateString()
  const monthYear = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
  const calendarDays = getCalendarDays()

  // 全部节目面板：默认聚焦"编辑中"（正在制作的节目），按播出日期倒序
  const [statusFilter, setStatusFilter] = useState('editing')
  const sortedEpisodes = useMemo(
    () =>
      [...episodes].sort(
        (a, b) => new Date(b.scheduled_date || b.created_at) - new Date(a.scheduled_date || a.created_at)
      ),
    [episodes]
  )
  const filteredEpisodes =
    statusFilter === 'all' ? sortedEpisodes : sortedEpisodes.filter((e) => e.status === statusFilter)

  const epDateLabel = (ep) => {
    const d = new Date(ep.scheduled_date || ep.created_at)
    return d.getFullYear() === new Date().getFullYear()
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300">节目</h1>
          <p className="text-sm text-ink-50 mt-1">选料 → 写稿 → 配音 → 发布，一条主线走完一期</p>
        </div>
        <button
          onClick={handleStartToday}
          disabled={starting}
          className="flex items-center gap-2 px-5 h-10 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60 shadow-sm"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          开始今日节目
        </button>
      </div>

      {/* 首次加载失败：错误态可重试，不留白屏 */}
      {loadError && (
        <div className="mb-6 flex flex-col items-center py-14 bg-cream-200 rounded-2xl border border-cream-300">
          <WifiOff className="w-12 h-12 text-cream-500 mb-3" />
          <p className="text-ink-50 mb-4">{loadError}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-5 h-10 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* 首次使用三步引导卡 */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mb-6 bg-cream-200 rounded-2xl border border-cream-300 p-6 shadow-[0_1px_3px_rgba(45,42,36,0.06)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-300">三步开始你的第一期节目</h2>
                <p className="text-sm text-ink-50 mt-1">配置 API → 添加新闻源 → 抓取新闻</p>
              </div>
              <button
                onClick={() => {
                  dismissOnboarding()
                  toast.success('已关闭引导')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-50 hover:text-ink-300 hover:bg-cream-300 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                知道了
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { icon: KeyRound, step: '① 配置 API Key', desc: '填入 DeepSeek 与 MiniMax 的 Key', done: hasKeys },
                { icon: Rss, step: '② 添加 RSS 源', desc: '启用至少一个新闻来源', done: hasSources },
                { icon: Download, step: '③ 抓取新闻', desc: '抓一批新闻，系统自动评分', done: false },
              ].map(({ icon: Icon, step, desc, done }) => (
                <div
                  key={step}
                  className="flex items-start gap-3 bg-cream-100 rounded-xl border border-cream-300 p-4"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      done ? 'bg-accent-sage/20 text-accent-sage' : 'bg-cream-300 text-ink-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-300">{step}</p>
                    <p className="text-xs text-ink-50 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="px-5 h-10 bg-accent-coral text-cream-100 rounded-xl text-sm font-medium hover:bg-accent-coral/90 transition-colors"
            >
              去配置
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 非首次但无节目 */}
      {!loading && !loadError && episodes.length === 0 && !showOnboarding && (
        <div className="mb-6 flex flex-col items-center py-14 bg-cream-200 rounded-2xl border border-cream-300">
          <CalendarDays className="w-12 h-12 text-cream-500 mb-3" />
          <p className="text-ink-50 mb-4">今天还没有节目，现在开始一期？</p>
          <button
            onClick={handleStartToday}
            className="flex items-center gap-2 px-5 h-10 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
          >
            <Mic className="w-4 h-4" />
            开始今日节目
          </button>
        </div>
      )}

      {/* 全部节目面板 + 日历（宽屏并排，面板在左） */}
      {!loadError && (
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
      {/* 全部节目面板：快速回看往期 */}
      <aside className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] overflow-hidden xl:sticky xl:top-8">
        <div className="px-4 py-3 border-b border-cream-300 bg-cream-200">
          <h2 className="text-sm font-semibold text-ink-300">全部节目</h2>
        </div>
        <div className="px-3 py-2 border-b border-cream-300 flex gap-1.5">
          {[
            ['editing', '编辑中', stats.editing],
            ['published', '已发布', stats.published],
            ['all', '全部', stats.total],
          ].map(([k, label, count]) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`px-2.5 h-7 rounded-lg text-xs font-medium transition-colors ${
                k === 'all' ? 'ml-auto ' : ''
              }${
                statusFilter === k
                  ? 'bg-ink-300 text-cream-100'
                  : 'bg-cream-200 text-ink-50 hover:bg-cream-300 border border-cream-300'
              }`}
            >
              {label} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
        <div className="max-h-[520px] overflow-y-auto p-2">
          {filteredEpisodes.length === 0 ? (
            <p className="text-xs text-ink-50 text-center py-8">没有符合条件的节目</p>
          ) : (
            filteredEpisodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => navigate(`/episode/${ep.id}`)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-cream-200 transition-colors text-left group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ep.status] || STATUS_DOT.draft}`}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-ink-300 truncate">{ep.title || '未命名节目'}</span>
                  <span className="block text-xs text-ink-50 mt-0.5">
                    {epDateLabel(ep)} · {STATUS_LABEL[ep.status] || '草稿'}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-cream-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 日历 */}
      <div className="bg-cream-100 rounded-2xl border border-cream-300 overflow-hidden shadow-[0_1px_3px_rgba(45,42,36,0.06)]">
        <div className="flex items-center justify-center px-4 py-3 border-b border-cream-300 bg-cream-200 gap-4">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-ink-300" />
          </button>
          <h2 className="font-display text-lg font-semibold text-ink-300 min-w-[140px] text-center">
            {monthYear}
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-ink-300" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm text-ink-50 hover:text-ink-300 hover:bg-cream-300 rounded-lg transition-colors"
          >
            今天
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-cream-300">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`py-2 text-center text-sm font-medium ${
                index === 0 || index === 6 ? 'text-accent-coral/70' : 'text-ink-50'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {loading
            ? Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[120px] p-2 border-b border-r border-cream-300">
                  <div className="w-6 h-6 rounded-full progress-shimmer mb-2" />
                  <div className="h-5 rounded progress-shimmer" />
                </div>
              ))
            : calendarDays.map((dayInfo, index) => {
                const dayEpisodes = getEpisodesForDate(dayInfo.date)
                const isWeekend = dayInfo.date.getDay() === 0 || dayInfo.date.getDay() === 6
                return (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border-b border-r border-cream-300 ${
                      !dayInfo.isCurrentMonth ? 'bg-cream-200/50' : ''
                    } ${isWeekend && dayInfo.isCurrentMonth ? 'bg-cream-200/30' : ''}`}
                  >
                    <div
                      className={`mb-1 text-sm ${
                        isToday(dayInfo.date)
                          ? 'w-7 h-7 rounded-full bg-accent-coral text-cream-100 flex items-center justify-center'
                          : isWeekend && dayInfo.isCurrentMonth
                            ? 'text-accent-coral/70'
                            : 'text-ink-50'
                      }`}
                    >
                      {dayInfo.day}
                    </div>
                    <div className="space-y-1">
                      {dayEpisodes.slice(0, 2).map((ep) => (
                        <div
                          key={ep.id}
                          onClick={() => navigate(`/episode/${ep.id}`)}
                          className={`px-2 py-1 rounded-md bg-cream-200 border border-cream-300 border-l-[3px] ${
                            STATUS_BAR[ep.status] || STATUS_BAR.draft
                          } text-xs text-ink-300 cursor-pointer truncate hover:bg-cream-300 transition-colors`}
                          title={ep.title}
                        >
                          {ep.title || '未命名节目'}
                        </div>
                      ))}
                      {dayEpisodes.length > 2 && (
                        <div className="text-xs text-ink-50 pl-1">+{dayEpisodes.length - 2} 更多</div>
                      )}
                    </div>
                  </div>
                )
              })}
        </div>
      </div>
      </div>
      )}
    </div>
  )
}
