import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Star, Search } from 'lucide-react'
import { useStore } from '../mock/store'
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
 * props: open, onClose, episodeId, onAdd(newsIds)
 */
export default function MaterialDrawer({ open, onClose, episodeId, onAdd }) {
  const { news, episodes } = useStore()
  const [selected, setSelected] = useState([])
  const [minScore, setMinScore] = useState(75)
  const [keyword, setKeyword] = useState('')

  const episode = episodes.find((e) => e.id === episodeId)
  const inEpisode = episode?.newsIds || []

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

  const toggle = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
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
                <p className="text-xs text-ink-50 mt-0.5">按评分倒序，默认展示 75 分以上的今日新闻</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-cream-300 text-ink-50 hover:text-ink-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* 左：新闻列表 */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-cream-300">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-cream-300">
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
                  {candidates.length === 0 ? (
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
                            <div className="flex items-start justify-between gap-2 mb-2">
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

              {/* 右：实时预览 */}
              <div className="w-64 shrink-0 flex flex-col bg-cream-200/60">
                <div className="p-5 flex-1 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-ink-300 mb-3">已选素材</h3>
                  {selectedNews.length === 0 ? (
                    <p className="text-xs text-ink-50 leading-relaxed">
                      点击左侧卡片勾选新闻，建议选 3–6 条，聊起来节奏最好。
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedNews
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((n) => (
                          <li
                            key={n.id}
                            className="text-xs text-ink-300 bg-cream-100 rounded-lg border border-cream-300 px-2.5 py-2 leading-relaxed"
                          >
                            {n.title}
                          </li>
                        ))}
                    </ul>
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
