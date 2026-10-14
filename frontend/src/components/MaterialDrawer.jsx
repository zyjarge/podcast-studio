import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Star, Search, Layers, LayoutGrid, ChevronDown, Loader2 } from 'lucide-react'
import { useStore, setTopics } from '../mock/store'
import { mockClusterTopics } from '../mock/api'
import StarRating from './StarRating'

const SCORE_FILTERS = [
  { label: '全部', value: 0 },
  { label: '60+', value: 60 },
  { label: '75+', value: 75 },
  { label: '90+', value: 90 },
]

const countChars = (text) => (text || '').replace(/\s/g, '').length

/**
 * 选料抽屉（90vw 全屏弹窗）
 * 默认话题视图：AI 先把新闻池归纳成话题，用户按话题选料，免去逐条排重
 * props: open, onClose, episodeId, onAdd(newsIds)
 */
export default function MaterialDrawer({ open, onClose, episodeId, onAdd }) {
  const { news, episodes, topics, topicsDirty } = useStore()
  const [selected, setSelected] = useState([])
  const [minScore, setMinScore] = useState(75)
  const [keyword, setKeyword] = useState('')
  const [view, setView] = useState('topics') // 'topics' | 'list'
  const [clustering, setClustering] = useState(false)
  const [expandedTopic, setExpandedTopic] = useState(null)

  const newsById = useMemo(() => Object.fromEntries(news.map((n) => [n.id, n])), [news])
  const episode = episodes.find((e) => e.id === episodeId)
  const inEpisode = episode?.newsIds || []

  // 打开抽屉时自动归纳话题；新闻池有更新（topicsDirty）则重新归纳
  useEffect(() => {
    if (!open) return
    if (!topicsDirty && topics.length > 0) return
    let cancelled = false
    setClustering(true)
    mockClusterTopics().then((list) => {
      if (cancelled) return
      setTopics(list)
      setClustering(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topicsDirty])

  // 话题视图：按话题最高分过滤 + 关键词搜索（话题名/组内新闻）
  const visibleTopics = useMemo(() => {
    return topics
      .filter((t) => t.topScore >= minScore)
      .filter((t) => {
        if (!keyword.trim()) return true
        const k = keyword.trim().toLowerCase()
        if (t.title.toLowerCase().includes(k)) return true
        return t.newsIds.some((id) => {
          const n = newsById[id]
          return (
            n &&
            (n.title.toLowerCase().includes(k) ||
              n.keywords.some((kw) => kw.toLowerCase().includes(k)))
          )
        })
      })
  }, [topics, minScore, keyword, newsById])

  // 列表视图（平铺兜底）
  const candidates = useMemo(() => {
    return news
      .filter((n) => !inEpisode.includes(n.id))
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
  }, [news, inEpisode, minScore, keyword])

  const selectedNews = useMemo(
    () => news.filter((n) => selected.includes(n.id)),
    [news, selected]
  )
  const totalChars = selectedNews.reduce((sum, n) => sum + countChars(n.content), 0)
  const estMinutes = totalChars > 0 ? Math.max(5, Math.ceil((totalChars * 3) / 150)) : 0

  // 已选预览：按话题分组 + 不在任何话题里的散件
  const selectedGroups = useMemo(() => {
    const grouped = topics
      .map((t) => ({
        ...t,
        picked: t.newsIds.filter((id) => selected.includes(id)).map((id) => newsById[id]).filter(Boolean),
      }))
      .filter((t) => t.picked.length > 0)
    const orphans = selectedNews.filter((n) => !topics.some((t) => t.newsIds.includes(n.id)))
    return { grouped, orphans }
  }, [topics, selected, selectedNews, newsById])

  const toggle = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  // 话题级勾选 = 选中/取消该话题的"代表报道"（排重：同话题默认只带一条进节目）
  const toggleTopic = (topic) => {
    toggle(topic.representativeId)
  }

  const handleAdd = () => {
    if (selected.length === 0) return
    onAdd(selected)
    setSelected([])
    setKeyword('')
    onClose()
  }

  const handleClose = () => {
    setSelected([])
    setKeyword('')
    onClose()
  }

  const viewToggle = (
    <div className="flex gap-0.5 bg-cream-200 border border-cream-300 rounded-lg p-0.5 shrink-0">
      {[
        { key: 'topics', label: '话题', icon: Layers },
        { key: 'list', label: '列表', icon: LayoutGrid },
      ].map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setView(key)}
          className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-medium transition-colors ${
            view === key ? 'bg-cream-100 text-ink-300 shadow-sm' : 'text-ink-50 hover:text-ink-300'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(45,42,36,0.4)]"
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[90vw] h-[85vh] bg-cream-100 rounded-3xl border border-cream-300 shadow-[0_8px_30px_rgba(45,42,36,0.12)] flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300 bg-cream-200">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink-300">为本期节目选料</h2>
                <p className="text-xs text-ink-50 mt-0.5">
                  {view === 'topics' ? 'AI 已把同一件事的报道归成话题，按话题选即可' : '按评分倒序，默认展示 75 分以上的今日新闻'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-cream-300 text-ink-50 hover:text-ink-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* 左：话题 / 新闻列表 */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-cream-300">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-cream-300">
                  {viewToggle}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-50" />
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="搜索标题或关键词"
                      className="w-full h-9 pl-9 pr-3 bg-cream-200 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {SCORE_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setMinScore(f.value)}
                        className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
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

                <div className="flex-1 overflow-y-auto p-5">
                  {clustering ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-accent-coral mb-3" />
                      <p className="text-sm text-ink-300 mb-1">AI 正在归纳话题…</p>
                      <p className="text-xs text-ink-50">把同一件事的报道归到一起，省去你逐条排重</p>
                    </div>
                  ) : view === 'topics' ? (
                    visibleTopics.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <Star className="w-12 h-12 text-cream-500 mb-3" />
                        <p className="text-sm text-ink-50 mb-3">没有符合条件的话题，试试降低评分门槛</p>
                        <button
                          onClick={() => {
                            setMinScore(0)
                            setKeyword('')
                          }}
                          className="px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
                        >
                          清除筛选
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleTopics.map((t) => {
                          const rep = newsById[t.representativeId]
                          const repInEpisode = inEpisode.includes(t.representativeId)
                          const checked = selected.includes(t.representativeId)
                          const expanded = expandedTopic === t.id
                          const others = t.newsIds.filter((id) => id !== t.representativeId)
                          return (
                            <div
                              key={t.id}
                              className={`rounded-2xl border bg-cream-200 transition-all ${
                                checked
                                  ? 'border-l-[3px] border-l-accent-coral border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)]'
                                  : 'border-cream-300 hover:border-cream-400'
                              }`}
                            >
                              <div className="flex items-start gap-3 p-4">
                                <button
                                  onClick={() => !repInEpisode && toggleTopic(t)}
                                  disabled={repInEpisode}
                                  title={repInEpisode ? '代表报道已在节目中，可展开加选其他报道' : '选中本话题（默认带代表报道）'}
                                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                    checked
                                      ? 'bg-accent-coral border-accent-coral'
                                      : repInEpisode
                                        ? 'border-cream-400 bg-cream-300 opacity-50 cursor-not-allowed'
                                        : 'border-cream-400 bg-cream-100 hover:border-accent-coral'
                                  }`}
                                >
                                  {checked && <Check className="w-3.5 h-3.5 text-cream-100" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="text-sm font-semibold text-ink-300">{t.title}</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-cream-300 text-xs text-ink-50">
                                      {t.newsIds.length} 条报道
                                    </span>
                                    <StarRating score={t.topScore} />
                                  </div>
                                  <p className="text-xs text-ink-50 leading-relaxed line-clamp-2 mb-1.5">
                                    {t.summary}
                                  </p>
                                  <p className="text-xs text-ink-50">
                                    <span className="text-accent-coral font-medium">代表报道：</span>
                                    {rep?.title}
                                    {repInEpisode && (
                                      <span className="ml-2 text-accent-sage">已在节目中</span>
                                    )}
                                  </p>
                                  {others.length > 0 && (
                                    <button
                                      onClick={() => setExpandedTopic(expanded ? null : t.id)}
                                      className="mt-1.5 flex items-center gap-1 text-xs text-ink-50 hover:text-ink-300 transition-colors"
                                    >
                                      <ChevronDown
                                        className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                      />
                                      {expanded ? '收起相关报道' : `展开 ${others.length} 条相关报道`}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <AnimatePresence initial={false}>
                                {expanded && others.length > 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mx-4 mb-3 pt-2 border-t border-cream-300 space-y-0.5">
                                      {others.map((id) => {
                                        const n = newsById[id]
                                        if (!n) return null
                                        const inEp = inEpisode.includes(id)
                                        const rowChecked = selected.includes(id)
                                        return (
                                          <div key={id} className="flex items-center gap-2 py-1.5">
                                            <button
                                              onClick={() => !inEp && toggle(id)}
                                              disabled={inEp}
                                              className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                rowChecked
                                                  ? 'bg-accent-coral border-accent-coral'
                                                  : inEp
                                                    ? 'border-cream-400 opacity-40 cursor-not-allowed'
                                                    : 'border-cream-400 bg-cream-100 hover:border-accent-coral'
                                              }`}
                                            >
                                              {rowChecked && <Check className="w-3 h-3 text-cream-100" />}
                                            </button>
                                            <span className="text-xs text-ink-50 shrink-0 w-28 truncate">
                                              {n.source} · {n.score} 分
                                            </span>
                                            <span className="text-xs text-ink-300 truncate">{n.title}</span>
                                            {inEp && (
                                              <span className="text-[10px] text-accent-sage shrink-0">已加入</span>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : candidates.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <Star className="w-12 h-12 text-cream-500 mb-3" />
                      <p className="text-sm text-ink-50 mb-3">没有符合条件的新闻，试试降低评分门槛</p>
                      <button
                        onClick={() => {
                          setMinScore(0)
                          setKeyword('')
                        }}
                        className="px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
                      >
                        清除筛选
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {candidates.map((n) => {
                        const checked = selected.includes(n.id)
                        return (
                          <button
                            key={n.id}
                            onClick={() => toggle(n.id)}
                            className={`text-left p-4 rounded-2xl border bg-cream-200 transition-all ${
                              checked
                                ? 'border-l-[3px] border-l-accent-coral border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)]'
                                : 'border-cream-300 hover:border-cream-400'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="text-sm font-medium text-ink-300 leading-snug line-clamp-2">
                                {n.title}
                              </h3>
                              <span
                                className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                                  checked ? 'bg-accent-coral border-accent-coral' : 'border-cream-400 bg-cream-100'
                                }`}
                              >
                                {checked && <Check className="w-3.5 h-3.5 text-cream-100" />}
                              </span>
                            </div>
                            <p className="text-xs text-ink-50 leading-relaxed line-clamp-2 mb-2.5">
                              {n.summary}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-ink-50 mb-2">
                              <span>{n.source}</span>
                              <StarRating score={n.score} />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {n.keywords.slice(0, 3).map((kw) => (
                                <span key={kw} className="px-2 py-0.5 bg-cream-300 rounded-full text-xs text-ink-50">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 右：已选预览（按话题分组） */}
              <div className="w-64 shrink-0 flex flex-col bg-cream-200/60">
                <div className="p-5 flex-1 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-ink-300 mb-3">已选素材</h3>
                  {selectedNews.length === 0 ? (
                    <p className="text-xs text-ink-50 leading-relaxed">
                      点击左侧话题勾选新闻，建议选 3–6 个话题，聊起来节奏最好。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedGroups.grouped.map((g) => (
                        <div key={g.id}>
                          <p className="text-[10px] font-medium text-accent-coral mb-1">
                            {g.title} · {g.picked.length} 条
                          </p>
                          <ul className="space-y-1.5">
                            {g.picked.map((n) => (
                              <li
                                key={n.id}
                                className="text-xs text-ink-300 bg-cream-100 rounded-lg border border-cream-300 px-2.5 py-2 leading-relaxed flex items-start justify-between gap-1"
                              >
                                <span className="flex-1 min-w-0">{n.title}</span>
                                <button
                                  onClick={() => toggle(n.id)}
                                  className="shrink-0 text-ink-50 hover:text-[#C4574E] transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {selectedGroups.orphans.length > 0 && (
                        <ul className="space-y-1.5">
                          {selectedGroups.orphans.map((n) => (
                            <li
                              key={n.id}
                              className="text-xs text-ink-300 bg-cream-100 rounded-lg border border-cream-300 px-2.5 py-2 leading-relaxed flex items-start justify-between gap-1"
                            >
                              <span className="flex-1 min-w-0">{n.title}</span>
                              <button
                                onClick={() => toggle(n.id)}
                                className="shrink-0 text-ink-50 hover:text-[#C4574E] transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-5 border-t border-cream-300">
                  <p className="text-sm text-ink-300 mb-1">
                    {selected.length} 条 · 约 {totalChars.toLocaleString('zh-CN')} 字
                  </p>
                  <p className="text-xs text-ink-50 mb-4">
                    {selected.length > 0 ? `预计 ${estMinutes} 分钟` : '选好后即可加入节目'}
                  </p>
                  <button
                    onClick={handleAdd}
                    disabled={selected.length === 0}
                    className="w-full h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
                  >
                    加入节目（{selected.length}）
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
