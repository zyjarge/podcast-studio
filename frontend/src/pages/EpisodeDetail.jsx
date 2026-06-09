import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ReactSortable } from 'react-sortablejs'
import {
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  FileText,
  Volume2,
  Sparkles,
  RefreshCw,
  X,
  Zap,
  AlertCircle,
  Edit3,
  Trash2,
  ChevronDown,
  Loader2,
  ShoppingCart,
  StickyNote
} from 'lucide-react'
import { episodesApi, newsApi, AUDIO_BASE } from '../services/api'

const statusConfig = {
  pending: { label: '待处理', bgColor: 'bg-cream-300', textColor: 'text-ink-300', icon: Circle },
  generating: { label: '生成中', bgColor: 'bg-accent-sky/20', textColor: 'text-accent-sky', icon: Loader2 },
  script_done: { label: '脚本完成', bgColor: 'bg-accent-sage/20', textColor: 'text-accent-sage', icon: FileText },
  audio_done: { label: '音频完成', bgColor: 'bg-accent-coral/20', textColor: 'text-accent-coral', icon: Volume2 },
  error: { label: '失败', bgColor: 'bg-accent-coral/20', textColor: 'text-accent-coral', icon: AlertCircle },
}

export default function EpisodeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 节目数据
  const [episode, setEpisode] = useState(null)

  // 节目中的新闻
  const [episodeNews, setEpisodeNews] = useState([])

  // 可添加的新闻（从新闻池）
  const [availableNews, setAvailableNews] = useState([])
  const [showAddNews, setShowAddNews] = useState(false)

  // 添加新闻弹窗筛选状态
  const [newsFilter, setNewsFilter] = useState({
    sources: [],
    minScore: 0,
    dateRange: 'all'
  })

  // 添加新闻弹窗 - 当前选中的来源标签
  const [activeSourceTab, setActiveSourceTab] = useState('all')

  // 抓取新闻中
  const [fetchingNews, setFetchingNews] = useState(false)

  // 多选状态
  const [selectedNewsIds, setSelectedNewsIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingNews, setLoadingNews] = useState(false)

  // 手风琴展开状态
  const [expandedNewsId, setExpandedNewsId] = useState(null)

  // 生成整期逐字稿状态
  const [episodeNotes, setEpisodeNotes] = useState('')
  const [generatingEpisodeScript, setGeneratingEpisodeScript] = useState(false)
  const [generatedEpisodeScript, setGeneratedEpisodeScript] = useState('')
  const [editingEpisodeScript, setEditingEpisodeScript] = useState(false)
  const [editedEpisodeScript, setEditedEpisodeScript] = useState('')
  const [savingEpisodeScript, setSavingEpisodeScript] = useState(false)

  // 音频生成状态
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [ttsProgress, setTtsProgress] = useState(null)

  // 节目备注区域折叠状态
  const [notesExpanded, setNotesExpanded] = useState(true)

  // 备注编辑状态（内联编辑）
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [editingNotes, setEditingNotes] = useState('')

  // 删除确认状态
  const [deleteMode, setDeleteMode] = useState(null)

  useEffect(() => {
    fetchEpisode()
  }, [id])

  // SortableJS 拖拽结束
  const handleSortEnd = (evt) => {
    if (evt.oldIndex !== evt.newIndex) {
      const newOrder = [...episodeNews]
      const [movedItem] = newOrder.splice(evt.oldIndex, 1)
      newOrder.splice(evt.newIndex, 0, movedItem)
      setEpisodeNews(newOrder)
      // TODO: 调用 API 保存新顺序
    }
  }

  const fetchEpisode = async () => {
    try {
      setLoading(true)
      setError(null)

      const episodeData = await episodesApi.get(parseInt(id))
      setEpisode(episodeData)

      const newsData = await episodesApi.listNews(parseInt(id))
      setEpisodeNews(newsData)

      const allNews = await newsApi.list()
      setAvailableNews(allNews)

    } catch (err) {
      console.error('Failed to fetch episode:', err)
      setError('加载节目失败')
    } finally {
      setLoading(false)
    }
  }

  // 更新节目
  const updateEpisode = async (updates) => {
    try {
      const updated = await episodesApi.update(parseInt(id), updates)
      setEpisode(updated)
    } catch (err) {
      console.error('Failed to update episode:', err)
    }
  }

  // 统计
  const totalNews = episodeNews.length
  const completedNews = episodeNews.filter(n => n.status === 'audio_done').length
  const progress = totalNews > 0 ? Math.round((completedNews / totalNews) * 100) : 0

  // 添加新闻到节目
  const addNewsToEpisode = async (newsId) => {
    try {
      await episodesApi.addNews(parseInt(id), [newsId])
      await fetchEpisode()
      setShowAddNews(false)
    } catch (err) {
      console.error('Failed to add news:', err)
    }
  }

  // 切换新闻选中状态
  const toggleNewsSelection = (newsId) => {
    setSelectedNewsIds(prev =>
      prev.includes(newsId) ? prev.filter(id => id !== newsId) : [...prev, newsId]
    )
  }

  // 批量添加选中的新闻
  const addSelectedNews = async () => {
    if (selectedNewsIds.length === 0) return
    try {
      await episodesApi.addNews(parseInt(id), selectedNewsIds)
      await fetchEpisode()
      setShowAddNews(false)
      setSelectedNewsIds([])
    } catch (err) {
      console.error('Failed to add news:', err)
    }
  }

  // 抓取最新新闻
  const handleFetchLatestNews = async () => {
    setFetchingNews(true)
    try {
      await newsApi.fetchAll()
      const allNews = await newsApi.list()
      setAvailableNews(allNews)
    } catch (err) {
      console.error('Failed to fetch news:', err)
    } finally {
      setFetchingNews(false)
    }
  }

  // 全选/取消全选
  const selectAllFiltered = () => {
    const ids = filteredAvailableNews.map(n => n.id)
    if (selectedNewsIds.length === ids.length) {
      setSelectedNewsIds([])
    } else {
      setSelectedNewsIds(ids)
    }
  }

  // 计算已选新闻的统计信息
  const selectedStats = (() => {
    const selected = availableNews.filter(n => selectedNewsIds.includes(n.id))
    const totalWords = selected.reduce((sum, n) => sum + (n.summary?.length || n.title?.length || 0), 0)
    const totalDuration = Math.ceil(totalWords / 150 * 60)
    return {
      count: selected.length,
      words: totalWords,
      duration: totalDuration,
      items: selected
    }
  })()

  // 从购物车移除
  const removeFromCart = (newsId) => {
    setSelectedNewsIds(prev => prev.filter(id => id !== newsId))
  }

  // 从节目移除新闻
  const removeNewsFromEpisode = async (newsId) => {
    console.log('Remove news:', newsId)
  }

  // 删除新闻
  const handleDeleteNews = async (episodeNewsItem) => {
    try {
      const element = document.getElementById(`news-item-${episodeNewsItem.id}`)
      if (element) {
        element.style.transition = 'all 0.2s ease-out'
        element.style.opacity = '0'
        element.style.transform = 'translateX(-20px) scale(0.95)'
      }

      setTimeout(async () => {
        await episodesApi.softDelete(parseInt(id), episodeNewsItem.news_id)
        setEpisodeNews(prev => prev.filter(en => en.id !== episodeNewsItem.id))
        if (expandedNewsId === episodeNewsItem.id) {
          setExpandedNewsId(null)
        }
        setDeleteMode(null)
      }, 200)
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败')
    }
  }

  // 打开备注编辑（内联）
  const openNotesModal = (en, e) => {
    e?.stopPropagation()
    setEditingNotesId(en.id)
    setEditingNotes(en.notes || '')
  }

  // 保存备注
  const saveNotes = async () => {
    try {
      setEpisodeNews(episodeNews.map(en =>
        en.id === editingNotesId ? { ...en, notes: editingNotes } : en
      ))

      const targetEn = episodeNews.find(en => en.id === editingNotesId)
      if (targetEn) {
        await episodesApi.updateNotes(parseInt(id), targetEn.news_id, editingNotes)
      }

      setEditingNotesId(null)
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

  // 取消编辑备注
  const cancelNotes = () => {
    setEditingNotesId(null)
    setEditingNotes('')
  }

  // 手风琴切换
  const toggleAccordion = (newsId) => {
    setExpandedNewsId(prev => prev === newsId ? null : newsId)
  }

  // 生成整期逐字稿
  const handleGenerateEpisodeScript = async () => {
    try {
      setGeneratingEpisodeScript(true)
      setGeneratedEpisodeScript('')
      setEditingEpisodeScript(false)
      setEditedEpisodeScript('')

      const result = await episodesApi.generateEpisodeScript(parseInt(id), episodeNotes)
      setGeneratedEpisodeScript(result.script)

      setEpisode({ ...episode, script: result.script })
    } catch (err) {
      console.error('Failed to generate episode script:', err)
      alert('生成逐字稿失败: ' + (err.message || '未知错误'))
    } finally {
      setGeneratingEpisodeScript(false)
    }
  }

  // 开始编辑逐字稿
  const startEditEpisodeScript = () => {
    setEditedEpisodeScript(generatedEpisodeScript)
    setEditingEpisodeScript(true)
  }

  // 取消编辑逐字稿
  const cancelEditEpisodeScript = () => {
    setEditingEpisodeScript(false)
    setEditedEpisodeScript('')
  }

  // 保存编辑后的逐字稿
  const saveEditedEpisodeScript = async () => {
    try {
      setSavingEpisodeScript(true)
      await episodesApi.update(parseInt(id), { script: editedEpisodeScript })
      setGeneratedEpisodeScript(editedEpisodeScript)
      setEpisode({ ...episode, script: editedEpisodeScript })
      setEditingEpisodeScript(false)
    } catch (err) {
      console.error('Failed to save episode script:', err)
      alert('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setSavingEpisodeScript(false)
    }
  }

  // 生成整期音频
  const handleGenerateEpisodeAudio = async () => {
    try {
      setGeneratingAudio(true)
      setTtsProgress({ stage: 'starting', message: '启动中...', percent: 0 })

      try {
        await episodesApi.generateEpisodeAudio(parseInt(id))
      } catch (err) {
        if (err.status === 409) {
          console.log('Audio generation already in progress, polling...')
        } else {
          throw err
        }
      }

      const interval = setInterval(async () => {
        try {
          const progress = await episodesApi.getAudioProgress(parseInt(id))
          setTtsProgress(progress)

          if (progress.stage === 'done' || progress.stage === 'error') {
            clearInterval(interval)
            setGeneratingAudio(false)

            if (progress.stage === 'done') {
              setEpisode(prev => ({ ...prev, audio_url: progress.audio_url }))
            }
          }
        } catch (err) {
          console.error('Failed to poll audio progress:', err)
        }
      }, 2000)
    } catch (err) {
      console.error('Failed to start audio generation:', err)
      alert('启动音频生成失败: ' + (err.message || '未知错误'))
      setGeneratingAudio(false)
    }
  }

  // 删除音频
  const handleDeleteAudio = async () => {
    if (confirm('确定要删除已生成的音频吗？')) {
      try {
        await episodesApi.deleteAudio(parseInt(id))
        setEpisode({ ...episode, audio_url: '' })
        setTtsProgress(null)
      } catch (err) {
        alert('删除失败: ' + err.message)
      }
    }
  }

  // 轮询音频生成进度
  const pollAudioProgress = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const progress = await episodesApi.getAudioProgress(parseInt(id))
        setTtsProgress(progress)

        if (progress.stage === 'done' || progress.stage === 'error') {
          clearInterval(interval)
          setGeneratingAudio(false)

          if (progress.stage === 'done') {
            setEpisode(prev => ({ ...prev, audio_url: progress.audio_url }))
          }
        }
      } catch (err) {
        console.error('Failed to poll audio progress:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [id])

  // 当正在生成音频时，启动轮询
  useEffect(() => {
    if (generatingAudio) {
      const cleanup = pollAudioProgress()
      return cleanup
    }
  }, [generatingAudio, pollAudioProgress])

  const filteredAvailableNews = availableNews.filter(n => {
    if (activeSourceTab !== 'all' && n.source !== activeSourceTab) {
      return false
    }
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (newsFilter.minScore > 0 && (n.score || 0) < newsFilter.minScore) {
      return false
    }
    if (newsFilter.dateRange !== 'all') {
      const newsDate = new Date(n.created_at)
      const now = new Date()
      if (newsFilter.dateRange === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        if (newsDate < today) return false
      } else if (newsFilter.dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (newsDate < weekAgo) return false
      } else if (newsFilter.dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        if (newsDate < monthAgo) return false
      }
    }
    return true
  })

  // 按来源分组
  const newsBySource = availableNews.reduce((acc, news) => {
    const source = news.source || '未知来源'
    if (!acc[source]) acc[source] = []
    acc[source].push(news)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent-coral" />
      </div>
    )
  }

  if (error || !episode) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error || '节目不存在'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-accent-coral text-white rounded-xl"
        >
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* 左侧：新闻列表 */}
      <div className="w-[400px] bg-cream-200 border-r border-cream-300 flex flex-col">
        {/* 头部 */}
        <div className="p-5 border-b border-cream-300">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-ink-50 hover:text-ink-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>

          <div className="flex items-center gap-4 mb-2">
            <input
              type="date"
              value={episode.scheduled_date ? (() => {
                const d = new Date(episode.scheduled_date)
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                return `${year}-${month}-${day}`
              })() : ''}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-')
                const localDate = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0)
                setEpisode({ ...episode, scheduled_date: localDate.toISOString() })
              }}
              onBlur={() => updateEpisode({ scheduled_date: episode.scheduled_date })}
              className="px-3 py-1.5 bg-cream-200 border border-cream-400 rounded-lg text-sm text-ink-300 focus:outline-none focus:border-accent-coral cursor-pointer"
            />
            <input
              type="text"
              value={episode.title}
              onChange={(e) => setEpisode({ ...episode, title: e.target.value })}
              onBlur={() => updateEpisode({ title: episode.title })}
              className="flex-1 text-xl font-display font-semibold bg-transparent border-none focus:outline-none text-ink-300"
            />
          </div>

          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-ink-50">
              {totalNews} 条新闻 · {completedNews} 完成
            </span>
            <div className="flex-1 h-2 bg-cream-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-coral rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 添加新闻按钮 */}
        <div className="p-3 border-b border-cream-300">
          <button
            onClick={() => setShowAddNews(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-coral text-white text-sm font-medium rounded-xl hover:bg-accent-coral/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加新闻
          </button>
        </div>

        {/* 新闻列表 - 可拖拽排序 */}
        <div className="flex-1 overflow-y-auto p-4">
          {episodeNews.length === 0 ? (
            <div className="text-center py-8 text-ink-50">
              暂无新闻，点击上方按钮添加
            </div>
          ) : (
            <ReactSortable
              list={episodeNews}
              setList={(newList) => setEpisodeNews(newList)}
              handle=".drag-handle"
              animation={150}
              ghostClass="sortable-ghost"
              dragClass="sortable-drag"
              onEnd={handleSortEnd}
              className="space-y-2"
            >
              {episodeNews.map((en, index) => {
                const status = statusConfig[en.status] || statusConfig.pending
                const Icon = status.icon
                const isExpanded = expandedNewsId === en.id

                return (
                  <div
                    key={en.id}
                    id={`news-item-${en.id}`}
                    className="bg-cream-100 rounded-xl border border-cream-300 overflow-hidden transition-colors"
                  >
                    {/* 手风琴标题行 */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-cream-50 transition-colors"
                      onClick={() => toggleAccordion(en.id)}
                    >
                      {/* 拖拽手柄 */}
                      <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-ink-50 hover:text-ink-300" onClick={(e) => e.stopPropagation()}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/>
                        </svg>
                      </div>

                      {/* 序号 */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${status.bgColor} ${status.textColor}`}>
                        {index + 1}
                      </div>

                      {/* 标题 */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-ink-300 truncate">
                          {en.news?.title || `新闻 #${en.news_id}`}
                        </h4>
                        <p className="text-xs text-ink-50 mt-0.5">
                          {status.label}
                        </p>
                      </div>

                      {/* 展开/折叠图标 */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0"
                      >
                        <ChevronDown className="w-4 h-4 text-ink-50" />
                      </motion.div>
                    </div>

                    {/* 展开内容 */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3">
                            {/* 新闻正文 */}
                            <div className="px-3 py-2 bg-cream-50 border border-cream-200 rounded-lg">
                              <p className="text-xs text-ink-300 leading-relaxed whitespace-pre-wrap">
                                {en.news?.content || en.news?.summary || '暂无正文'}
                              </p>
                            </div>

                            {/* 备注显示/编辑 */}
                            {en.notes && editingNotesId !== en.id ? (
                              <div>
                                <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
                                  {en.notes}
                                </div>
                                <button
                                  onClick={(e) => openNotesModal(en, e)}
                                  className="mt-1 text-xs text-purple-500 hover:text-purple-700"
                                >
                                  编辑备注
                                </button>
                              </div>
                            ) : editingNotesId === en.id ? (
                              <div>
                                <textarea
                                  value={editingNotes}
                                  onChange={(e) => setEditingNotes(e.target.value)}
                                  placeholder="为这条新闻写备注，例如：从XX角度分析..."
                                  className="w-full h-20 px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs text-ink-300 placeholder:text-ink-50 resize-none focus:outline-none focus:border-purple-400"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cancelNotes() }}
                                    className="text-xs px-3 py-1 text-ink-50 hover:text-ink-300"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); saveNotes() }}
                                    className="text-xs px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                                  >
                                    保存
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => openNotesModal(en, e)}
                                className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700"
                              >
                                <StickyNote className="w-3 h-3" />
                                写备注
                              </button>
                            )}

                            {/* 删除按钮 */}
                            <div className="flex justify-end">
                              {deleteMode === en.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-ink-50">确认删除？</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteNews(en) }}
                                    className="text-xs px-3 py-1 bg-accent-coral text-white rounded-lg hover:bg-accent-coral/90"
                                  >
                                    确认
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteMode(null) }}
                                    className="text-xs px-3 py-1 bg-cream-300 text-ink-300 rounded-lg hover:bg-cream-400"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteMode(en.id) }}
                                  className="flex items-center gap-1 text-xs px-3 py-1 bg-accent-coral/20 text-accent-coral rounded-lg hover:bg-accent-coral/40"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  删除
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </ReactSortable>
          )}
        </div>
      </div>

      {/* 右侧：工作区 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Section 1: 节目备注（可折叠） */}
        <div className="shrink-0 border-b border-cream-300">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-cream-100 transition-colors"
          >
            <span className="text-sm font-medium text-ink-300">📝 节目备注</span>
            <motion.div
              animate={{ rotate: notesExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-ink-50" />
            </motion.div>
          </button>
          <AnimatePresence>
            {notesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  <textarea
                    value={episodeNotes}
                    onChange={(e) => setEpisodeNotes(e.target.value)}
                    placeholder="例如：今天是高考日，增加对考生的祝福..."
                    className="w-full h-24 px-3 py-2 bg-white border border-cream-300 rounded-xl text-sm text-ink-300 placeholder:text-ink-50 resize-none focus:outline-none focus:border-purple-400 transition-colors"
                    disabled={generatingEpisodeScript}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 2: 逐字稿工作区 */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-cream-200 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-ink-300">📄 逐字稿</h3>
              {generatedEpisodeScript && (
                <span className="text-xs text-ink-50">
                  {editingEpisodeScript ? editedEpisodeScript.length : generatedEpisodeScript.length} 字
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editingEpisodeScript ? (
                <>
                  <button
                    onClick={cancelEditEpisodeScript}
                    className="text-xs px-3 py-1 text-ink-50 hover:text-ink-300 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveEditedEpisodeScript}
                    disabled={savingEpisodeScript}
                    className="text-xs px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                  >
                    {savingEpisodeScript ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <>
                  {generatedEpisodeScript && (
                    <button
                      onClick={startEditEpisodeScript}
                      className="text-xs px-3 py-1 text-purple-500 hover:text-purple-700 transition-colors"
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" />
                      编辑
                    </button>
                  )}
                  {generatedEpisodeScript && (
                    <button
                      onClick={async () => {
                        const result = await episodesApi.injectTestScript(parseInt(id))
                        setGeneratedEpisodeScript(result.script)
                        setEpisode({ ...episode, script: result.script })
                      }}
                      className="text-xs px-3 py-1 text-accent-coral hover:text-accent-coral/80 transition-colors"
                      title="注入极简测试脚本（仅2段对话）"
                    >
                      测试脚本
                    </button>
                  )}
                  <button
                    onClick={handleGenerateEpisodeScript}
                    disabled={generatingEpisodeScript || generatingAudio || episodeNews.length === 0}
                    className="text-xs px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    {generatingEpisodeScript ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        生成中...
                      </>
                    ) : generatedEpisodeScript ? (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        重新生成
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        生成逐字稿
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {generatedEpisodeScript ? (
              editingEpisodeScript ? (
                <textarea
                  value={editedEpisodeScript}
                  onChange={(e) => setEditedEpisodeScript(e.target.value)}
                  className="w-full h-full p-5 text-sm text-ink-300 leading-relaxed resize-none focus:outline-none bg-white font-sans"
                  autoFocus
                />
              ) : (
                <div className="p-5">
                  <pre className="text-sm text-ink-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedEpisodeScript}
                  </pre>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center h-full text-ink-50 py-12">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-cream-400" />
                  <p className="text-sm">点击"生成逐字稿"后在此预览</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: 音频工作区 */}
        <div className="shrink-0 border-t border-cream-300" style={{ minHeight: '200px' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-cream-200">
            <h3 className="text-sm font-medium text-ink-300">🔊 音频</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateEpisodeAudio}
                disabled={generatingAudio || generatingEpisodeScript || !generatedEpisodeScript}
                className="text-xs px-3 py-1 bg-accent-sage text-white rounded-lg hover:bg-accent-sage/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                {generatingAudio ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    生成中...
                  </>
                ) : (ttsProgress?.stage === 'done' || episode?.audio_url) ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    生成音频
                  </>
                )}
              </button>
              {(ttsProgress?.stage === 'done' || episode?.audio_url) && (
                <button
                  onClick={handleDeleteAudio}
                  className="text-xs px-3 py-1 bg-accent-coral/20 text-accent-coral rounded-lg hover:bg-accent-coral/40 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  删除音频
                </button>
              )}
            </div>
          </div>

          <div className="p-5">
            {/* 音频生成进度 */}
            {ttsProgress && ttsProgress.stage !== 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Volume2 className={`w-4 h-4 ${ttsProgress.stage === 'done' ? 'text-accent-sage' : ttsProgress.stage === 'error' ? 'text-accent-coral' : 'text-accent-sky animate-pulse'}`} />
                  <span className="text-sm text-ink-300 flex-1">{ttsProgress.message}</span>
                  {ttsProgress.percent > 0 && (
                    <span className="text-xs text-ink-50">{ttsProgress.percent}%</span>
                  )}
                </div>
                {ttsProgress.total > 0 && ttsProgress.stage !== 'done' && ttsProgress.stage !== 'error' && (
                  <div className="h-2 bg-cream-300 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-sky rounded-full transition-all duration-300"
                      style={{ width: `${ttsProgress.percent}%` }}
                    />
                  </div>
                )}
                {ttsProgress.stage === 'done' && (
                  <div className="p-3 bg-accent-sage/10 rounded-xl border border-accent-sage/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                      <span className="text-sm text-accent-sage font-medium">音频生成完成!</span>
                    </div>
                    <audio
                      controls
                      className="w-full h-10"
                      src={`${AUDIO_BASE}/audio/${id}/episode_${id}.mp3`}
                    />
                    <p className="text-xs text-ink-50 mt-2">音频路径: {ttsProgress.audio_url}</p>
                  </div>
                )}
                {ttsProgress.stage === 'error' && (
                  <p className="text-xs text-accent-coral">❌ {ttsProgress.error}</p>
                )}
              </div>
            )}

            {/* 已有音频（从数据库加载） */}
            {!ttsProgress && episode?.audio_url && (
              <div className="p-3 bg-accent-sage/10 rounded-xl border border-accent-sage/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                  <span className="text-sm text-accent-sage font-medium">已有音频</span>
                </div>
                <audio
                  controls
                  className="w-full h-10"
                  src={`${AUDIO_BASE}/audio/${id}/episode_${id}.mp3`}
                />
                <p className="text-xs text-ink-50 mt-2">音频路径: {episode.audio_url}</p>
              </div>
            )}

            {/* 空状态 */}
            {!ttsProgress && !episode?.audio_url && !generatingAudio && (
              <div className="text-center py-6 text-ink-50">
                <Volume2 className="w-10 h-10 mx-auto mb-2 text-cream-400" />
                <p className="text-sm">点击"生成音频"开始</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 添加新闻弹窗 - 新设计：Tab导航 + 左右布局 */}
      <AnimatePresence>
        {showAddNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddNews(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-2xl w-full max-w-[1600px] h-[85vh] shadow-2xl flex overflow-hidden"
            >
              {/* 左侧：新闻列表区域 */}
              <div className="flex-1 flex flex-col border-r border-cream-300 min-w-0">
                {/* 头部 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300 bg-cream-200">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-lg font-semibold text-ink-300">📰 添加新闻</h2>
                    <button
                      onClick={handleFetchLatestNews}
                      disabled={fetchingNews}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-coral text-white text-xs rounded-lg hover:bg-accent-coral/90 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingNews ? 'animate-spin' : ''}`} />
                      {fetchingNews ? '抓取中...' : '抓取最新'}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAddNews(false)}
                    className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-ink-50" />
                  </button>
                </div>

                {/* Tab 导航 */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-cream-200 bg-cream-100 overflow-x-auto">
                  <button
                    onClick={() => setActiveSourceTab('all')}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                      activeSourceTab === 'all'
                        ? 'bg-accent-coral text-white'
                        : 'text-ink-50 hover:bg-cream-200'
                    }`}
                  >
                    全部
                  </button>
                  {Object.keys(newsBySource).map(source => (
                    <button
                      key={source}
                      onClick={() => setActiveSourceTab(source)}
                      className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                        activeSourceTab === source
                          ? 'bg-accent-coral text-white'
                          : 'text-ink-50 hover:bg-cream-200'
                      }`}
                    >
                      {source}
                    </button>
                  ))}
                </div>

                {/* 搜索框 */}
                <div className="px-4 py-3 border-b border-cream-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索新闻标题..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-cream-300 rounded-lg text-sm focus:outline-none focus:border-accent-coral"
                    />
                  </div>
                </div>

                {/* 新闻列表 */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                  {filteredAvailableNews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-ink-50">
                      <Search className="w-12 h-12 mb-3 opacity-30" />
                      <p>暂无匹配的新闻</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredAvailableNews.map((news, idx) => {
                        const selectedIndex = selectedNewsIds.indexOf(news.id) + 1
                        return (
                        <motion.div
                          key={news.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`p-2 bg-white rounded-xl border-2 cursor-pointer transition-all ${
                            selectedNewsIds.includes(news.id)
                              ? 'border-accent-coral bg-accent-coral/5'
                              : 'border-cream-200 hover:border-cream-400'
                          }`}
                          onClick={() => toggleNewsSelection(news.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                              selectedNewsIds.includes(news.id)
                                ? 'bg-accent-coral text-white'
                                : 'bg-cream-300 text-ink-50'
                            }`}>
                              {selectedNewsIds.includes(news.id) ? selectedIndex : idx + 1}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <h4 className="font-medium text-xs text-ink-300 line-clamp-2 leading-tight">{news.title}</h4>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-50">
                                <span className="bg-cream-100 px-1.5 py-0.5 rounded text-[10px]">{news.source?.slice(0,4) || '未知'}</span>
                                <span className={news.score >= 60 ? 'text-accent-gold font-medium text-[10px]' : 'text-[10px]'}>{Math.round(news.score || 0)}⭐</span>
                                <span className="text-[10px]">{new Date(news.created_at).toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'})}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )})}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：购物车 */}
              <div className="w-80 flex-shrink-0 bg-cream-200 flex flex-col">
                {/* 购物车头部 */}
                <div className="px-4 py-4 border-b border-cream-300">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink-300">🛒 已选新闻</h3>
                    {selectedStats.count > 0 && (
                      <button
                        onClick={() => setSelectedNewsIds([])}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        清空
                      </button>
                    )}
                  </div>
                </div>

                {/* 购物车统计 */}
                {selectedStats.count > 0 && (
                  <div className="px-4 py-3 bg-gradient-to-r from-accent-coral/10 to-accent-sage/10 border-b border-cream-300">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <div className="text-lg font-semibold text-accent-coral">{selectedStats.count}</div>
                        <div className="text-xs text-ink-50">条新闻</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-accent-coral">{selectedStats.words}</div>
                        <div className="text-xs text-ink-50">总字数</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-lg font-semibold text-accent-sage">
                          ⏱️ {Math.floor(selectedStats.duration / 60)}:{String(selectedStats.duration % 60).padStart(2, '0')}
                        </div>
                        <div className="text-xs text-ink-50">预估时长</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 已选新闻列表 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {selectedStats.count === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-ink-50 text-sm">
                      <div className="w-16 h-16 mb-3 rounded-full bg-cream-300 flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 opacity-30" />
                      </div>
                      <p>点击左侧新闻添加</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {selectedStats.items.map((news, idx) => (
                        <motion.div
                          key={news.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                          className="p-3 bg-white rounded-lg border border-cream-200"
                        >
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-accent-coral text-white text-xs rounded-full">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-medium text-ink-300 line-clamp-2">{news.title}</h4>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-ink-50">
                                  {news.summary?.length || news.title?.length || 0} 字
                                </span>
                                <button
                                  onClick={() => removeFromCart(news.id)}
                                  className="text-xs text-red-400 hover:text-red-500"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {/* 底部操作栏 */}
                <div className="p-4 border-t border-cream-300 bg-cream-100">
                  <button
                    onClick={addSelectedNews}
                    disabled={selectedStats.count === 0}
                    className="w-full py-3 bg-accent-coral text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-coral/90 transition-colors"
                  >
                    {selectedStats.count > 0
                      ? `+ 添加到节目 (${selectedStats.count})`
                      : '请选择新闻'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
