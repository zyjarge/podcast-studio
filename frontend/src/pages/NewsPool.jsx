import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  Eye,
  X,
  Newspaper,
  Check,
  Inbox,
  Filter,
} from 'lucide-react'
import { useStore, getState, addNewsToEpisode } from '../mock/store'
import { mockFetchNews } from '../mock/api'
import { useToast } from '../components/Toast'
import StarRating from '../components/StarRating'

const SCORE_FILTERS = [
  { label: '全部', value: 0 },
  { label: '60+', value: 60 },
  { label: '75+', value: 75 },
  { label: '90+', value: 90 },
]

const fmtNewsTime = (iso) => {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function NewsPool() {
  const toast = useToast()
  const { news, sources, episodes, lastFetchAt } = useStore()

  const [fetching, setFetching] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [activeSources, setActiveSources] = useState(null) // null = 全选
  const [selected, setSelected] = useState([])
  const [detailNews, setDetailNews] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const enabledSources = sources.filter((s) => s.enabled)
  const checkedSources = activeSources === null ? enabledSources.map((s) => s.name) : activeSources

  const toggleSource = (name) => {
    setActiveSources((cur) => {
      const base = cur === null ? enabledSources.map((s) => s.name) : cur
      const next = base.includes(name) ? base.filter((x) => x !== name) : [...base, name]
      return next.length === enabledSources.length ? null : next
    })
  }

  const filtered = useMemo(() => {
    return news
      .filter((n) => checkedSources.includes(n.source))
      .filter((n) => n.score >= minScore)
      .filter((n) => {
        if (!keyword.trim()) return true
        const k = keyword.trim().toLowerCase()
        return (
          n.title.toLowerCase().includes(k) ||
          n.summary.toLowerCase().includes(k) ||
          n.keywords.some((kw) => kw.toLowerCase().includes(k))
        )
      })
      .sort((a, b) => b.score - a.score)
  }, [news, checkedSources, minScore, keyword])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((n) => {
      if (!map.has(n.source)) map.set(n.source, [])
      map.get(n.source).push(n)
    })
    return [...map.entries()]
  }, [filtered])

  const handleFetch = async () => {
    if (fetching) return
    setFetching(true)
    try {
      const { added, total } = await mockFetchNews()
      toast.success(added > 0 ? `已抓取 ${total} 条新闻，已自动评分` : `新闻池已是最新（${total} 条）`)
    } finally {
      setFetching(false)
    }
  }

  const toggleSelect = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  const handleAddToEpisode = (episodeId) => {
    const ep = getState().episodes.find((e) => e.id === episodeId)
    addNewsToEpisode(episodeId, selected)
    toast.success(`已加入「${ep?.title}」（${selected.length} 条）`)
    setSelected([])
    setPickerOpen(false)
  }

  const lastFetchText = lastFetchAt ? fmtNewsTime(lastFetchAt).replace('今天 ', '') : '从未'

  return (
    <div className="p-8 min-h-screen pb-28">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">新闻池</h1>
        <p className="text-sm text-ink-50">抓取热点，自动评分，挑好料再做节目</p>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-2 px-4 h-10 bg-accent-coral text-cream-100 rounded-xl text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
        >
          {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {fetching ? '抓取中…' : '抓取新闻'}
        </button>
        <span className="text-xs text-ink-50">上次抓取 {lastFetchText}</span>

        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-50" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题、摘要或关键词"
            className="w-full h-10 pl-9 pr-3 bg-cream-200 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
          />
        </div>

        <div className="flex gap-1.5">
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setMinScore(f.value)}
              className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors ${
                minScore === f.value
                  ? 'bg-ink-300 text-cream-100'
                  : 'bg-cream-200 text-ink-50 hover:bg-cream-300 border border-cream-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 来源芯片多选 */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-ink-50" />
        {enabledSources.map((s) => {
          const active = checkedSources.includes(s.name)
          return (
            <button
              key={s.id}
              onClick={() => toggleSource(s.name)}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-accent-coral/15 text-accent-coral border border-accent-coral/50'
                  : 'bg-cream-200 text-ink-50 border border-cream-300 hover:bg-cream-300'
              }`}
            >
              {active && <Check className="w-3 h-3" />}
              {s.name}
            </button>
          )
        })}
      </div>

      {/* 内容区 */}
      {news.length === 0 ? (
        <div className="flex flex-col items-center py-20 bg-cream-200 rounded-2xl border border-cream-300">
          <Inbox className="w-12 h-12 text-cream-500 mb-3" />
          <p className="text-ink-50 mb-4">新闻池还是空的，先抓一批看看</p>
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="flex items-center gap-2 px-5 h-10 bg-accent-coral text-cream-100 rounded-xl text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {fetching ? '抓取中…' : '抓取新闻'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 bg-cream-200 rounded-2xl border border-cream-300">
          <Search className="w-12 h-12 text-cream-500 mb-3" />
          <p className="text-ink-50 mb-4">没有符合条件的新闻，试试降低评分门槛</p>
          <button
            onClick={() => {
              setMinScore(0)
              setKeyword('')
              setActiveSources(null)
            }}
            className="px-5 h-10 rounded-xl bg-cream-100 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
          >
            清除筛选
          </button>
        </div>
      ) : (
        grouped.map(([source, items]) => (
          <section key={source} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-semibold text-ink-300">{source}</h2>
              <span className="text-xs text-ink-50 bg-cream-200 border border-cream-300 rounded-full px-2 py-0.5">
                {items.length} 条
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((n) => {
                const checked = selected.includes(n.id)
                return (
                  <div
                    key={n.id}
                    className={`relative bg-cream-200 rounded-2xl border p-4 transition-all card-hover ${
                      checked ? 'border-l-[3px] border-l-accent-coral border-cream-300' : 'border-cream-300'
                    }`}
                  >
                    <button
                      onClick={() => toggleSelect(n.id)}
                      title={checked ? '取消选择' : '选择'}
                      className={`absolute top-3 right-3 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        checked ? 'bg-accent-coral border-accent-coral' : 'border-cream-400 bg-cream-100 hover:border-accent-coral'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5 text-cream-100" />}
                    </button>
                    <h3 className="text-base font-medium text-ink-300 leading-snug pr-7 mb-2 line-clamp-2">
                      {n.title}
                    </h3>
                    <p className="text-xs text-ink-50 leading-relaxed mb-3 line-clamp-2">{n.summary}</p>
                    <div className="flex items-center gap-2 text-xs text-ink-50 mb-3">
                      <StarRating score={n.score} />
                      <span className="text-cream-400">·</span>
                      <span>{fmtNewsTime(n.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {n.keywords.slice(0, 3).map((kw) => (
                          <span key={kw} className="px-2 py-0.5 bg-cream-300 rounded-full text-xs text-ink-50">
                            {kw}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => setDetailNews(n)}
                        title="查看详情"
                        className="p-1.5 rounded-lg text-ink-50 hover:text-ink-300 hover:bg-cream-300 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      {/* 批量添加浮条 */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-6 left-[calc(50%+8rem)] -translate-x-1/2 z-[70] flex items-center gap-4 bg-ink-300 text-cream-100 rounded-2xl pl-5 pr-3 py-3 shadow-[0_8px_30px_rgba(31,31,31,0.3)]"
          >
            <span className="text-sm">已选 {selected.length} 条</span>
            <button
              onClick={() => setSelected([])}
              className="text-xs text-cream-100/60 hover:text-cream-100"
            >
              清空
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
            >
              添加到节目
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {detailNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(45,42,36,0.4)]"
            onClick={() => setDetailNews(null)}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[640px] max-h-[80vh] overflow-y-auto bg-cream-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(45,42,36,0.12)] border border-cream-300"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-lg font-semibold text-ink-300 leading-snug">{detailNews.title}</h2>
                <button
                  onClick={() => setDetailNews(null)}
                  className="p-1.5 rounded-lg hover:bg-cream-200 text-ink-50 hover:text-ink-300 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-50 mb-4">
                <span className="px-2 py-0.5 bg-cream-200 border border-cream-300 rounded-full">{detailNews.source}</span>
                <StarRating score={detailNews.score} />
                <span>{fmtNewsTime(detailNews.created_at)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  ['时效性', detailNews.scores.timeliness],
                  ['话题性', detailNews.scores.topic],
                  ['深度', detailNews.scores.depth],
                ].map(([label, val]) => (
                  <div key={label} className="bg-cream-200 rounded-xl border border-cream-300 p-3 text-center">
                    <p className="text-xs text-ink-50 mb-1">{label}</p>
                    <p className="text-lg font-display font-semibold text-ink-300">{val}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-ink-300 leading-relaxed mb-4">{detailNews.content}</p>
              <div className="flex flex-wrap gap-1.5">
                {detailNews.keywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-cream-300 rounded-full text-xs text-ink-50">
                    {kw}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 节目选择器 */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(45,42,36,0.4)]"
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md bg-cream-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(45,42,36,0.12)] border border-cream-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-ink-300">添加到节目</h3>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-cream-200 text-ink-50 hover:text-ink-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {episodes.filter((e) => e.status !== 'published').length === 0 ? (
                <p className="text-sm text-ink-50 py-6 text-center">
                  没有编辑中的节目，先去 Dashboard 点「开始今日节目」
                </p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                  {episodes
                    .filter((e) => e.status !== 'published')
                    .map((ep) => (
                      <li key={ep.id}>
                        <button
                          onClick={() => handleAddToEpisode(ep.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-cream-200 border border-cream-300 hover:border-accent-coral hover:bg-cream-300/60 transition-colors text-left"
                        >
                          <Newspaper className="w-4 h-4 text-ink-50 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-300 truncate">{ep.title}</p>
                            <p className="text-xs text-ink-50">
                              已有素材 {ep.newsIds.length} 条
                              {ep.status === 'draft' ? ' · 未开始' : ' · 编辑中'}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
