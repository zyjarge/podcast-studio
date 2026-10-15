import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Newspaper, ListChecks } from 'lucide-react'
import { episodesApi, newsApi, humanizeError } from '../services/api'
import { useToast } from '../components/Toast'
import PoolBrowser from '../components/PoolBrowser'

export default function NewsPool() {
  const toast = useToast()
  const [episodes, setEpisodes] = useState([])
  const [selected, setSelected] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [poolNews, setPoolNews] = useState([]) // 待选清单里展示标题用
  const [epNewsCounts, setEpNewsCounts] = useState({}) // 节目选择器里"已有素材 N 条"

  useEffect(() => {
    episodesApi
      .list()
      .then(setEpisodes)
      .catch((e) => toast.error(humanizeError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 首次打开待选清单时拉一次新闻池，把 id 映射回标题
  useEffect(() => {
    if (!cartOpen || poolNews.length > 0) return
    newsApi
      .list({ limit: 200 })
      .then(setPoolNews)
      .catch((e) => toast.error(humanizeError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartOpen])

  // 打开节目选择器时，并行拉取各候选节目的素材数
  useEffect(() => {
    if (!pickerOpen) return
    const candidates = episodes.filter((e) => e.status !== 'published')
    Promise.all(
      candidates.map((ep) =>
        episodesApi
          .listNews(ep.id)
          .then((list) => [ep.id, list.length])
          .catch(() => [ep.id, 0])
      )
    ).then((entries) => setEpNewsCounts(Object.fromEntries(entries)))
  }, [pickerOpen, episodes])

  const toggleSelect = (id) => {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  const handleAddToEpisode = async (episodeId) => {
    const ep = episodes.find((e) => e.id === episodeId)
    try {
      await episodesApi.addNews(episodeId, selected)
      toast.success(`已加入「${ep?.title}」（${selected.length} 条）`)
      setSelected([])
      setPickerOpen(false)
    } catch (e) {
      toast.error(humanizeError(e))
    }
  }

  return (
    <div className="p-8 min-h-screen pb-28">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">新闻池</h1>
        <p className="text-sm text-ink-50">抓取热点，自动评分，挑好料再做节目</p>
      </div>

      {/* 浏览能力（全景/工具栏/列表/详情）与节目页内嵌选料共用 */}
      <PoolBrowser mode="page" pickedIds={selected} onTogglePick={(n) => toggleSelect(n.id)} />

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
            <button
              onClick={() => setCartOpen((v) => !v)}
              title="查看待选清单"
              className="flex items-center gap-1.5 text-sm hover:text-accent-coral transition-colors"
            >
              <ListChecks className="w-4 h-4" />
              已选 {selected.length} 条
            </button>
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

      {/* 待选清单弹层：逐条查看 / 移除 */}
      <AnimatePresence>
        {cartOpen && selected.length > 0 && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-24 left-[calc(50%+8rem)] -translate-x-1/2 z-[70] w-96 bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_8px_30px_rgba(45,42,36,0.15)] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink-300">待选清单（{selected.length} 条）</h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 rounded-lg hover:bg-cream-200 text-ink-50 hover:text-ink-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-0.5">
              {selected.map((id) => {
                const item = poolNews.find((n) => n.id === id)
                return (
                  <li key={id} className="group flex items-center gap-2 py-1.5">
                    <span className="flex-1 min-w-0 text-xs text-ink-300 truncate" title={item?.title}>
                      {item?.title || `新闻 #${id}`}
                    </span>
                    <button
                      onClick={() => toggleSelect(id)}
                      title="移出待选"
                      className="shrink-0 p-1 rounded-md text-ink-50 opacity-0 group-hover:opacity-100 hover:text-accent-coral hover:bg-cream-200 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
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
                              已有素材 {epNewsCounts[ep.id] ?? '…'} 条
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
