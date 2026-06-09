import { useState, useEffect, useRef, useCallback } from 'react'
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
  Play,
  Sparkles,
  RefreshCw,
  X,
  Send,
  Zap,
  Layers,
  Download,
  AlertCircle,
  Eye,
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

  // 当前选中的新闻（用于精编）
  const [selectedNews, setSelectedNews] = useState(null)

  // 弹窗状态
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [showRawContentModal, setShowRawContentModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)

  // 生成整期逐字稿 modal 状态
  const [showGenerateEpisodeModal, setShowGenerateEpisodeModal] = useState(false)
  const [episodeNotes, setEpisodeNotes] = useState('')
  const [generatingEpisodeScript, setGeneratingEpisodeScript] = useState(false)
  const [generatedEpisodeScript, setGeneratedEpisodeScript] = useState('')
  const [editingEpisodeScript, setEditingEpisodeScript] = useState(false)
  const [editedEpisodeScript, setEditedEpisodeScript] = useState('')
  const [savingEpisodeScript, setSavingEpisodeScript] = useState(false)

  // 音频生成状态
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [ttsProgress, setTtsProgress] = useState(null)  // {stage, total, completed, message, percent, audio_url, error}

  // 预览弹窗状态
  const [showScriptPreview, setShowScriptPreview] = useState(false)
  const [showAudioPreview, setShowAudioPreview] = useState(false)
  const [editingLineIdx, setEditingLineIdx] = useState(null)

  // 备注编辑状态（内联编辑）
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [editingNotes, setEditingNotes] = useState('')

  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const audioDuration = 180

  // 模拟逐字稿数据
  const scriptLines = [
    { role: 'host', speaker: '主持人', content: '各位听众朋友，大家好！欢迎收听今天的新闻播报。' },
    { role: 'content', speaker: '内容', content: '今日要闻：苹果公司召开春季发布会，发布了全新iPhone 16系列。' },
    { role: 'comment', speaker: '评论', content: '这次发布会还是很有看点的，尤其是AI功能的加入让手机更加智能。' },
    { role: 'host', speaker: '主持人', content: '那第二条新闻呢？' },
    { role: 'content', speaker: '内容', content: 'Meta宣布开源新一代大语言模型，性能超越GPT-4。' },
    { role: 'comment', speaker: '评论', content: 'Meta这一招确实厉害，开源策略让整个AI社区都能受益。' },
    { role: 'host', speaker: '主持人', content: '好了，今天的新闻就是这些，感谢大家的收听！' },
  ]

  // 音频播放模拟
  useEffect(() => {
    let interval
    if (isPlaying && audioProgress < audioDuration) {
      interval = setInterval(() => setAudioProgress(p => Math.min(p + 1, audioDuration)), 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying, audioProgress])

  // 生成状态
  const [generating, setGenerating] = useState(false)
  
  // 脚本编辑状态
  const [editingScript, setEditingScript] = useState(false)
  const [editedScript, setEditedScript] = useState('')
  const [savingScript, setSavingScript] = useState(false)

  // 删除确认状态 (null = 正常模式, 数字 = 删除模式下的新闻ID)
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
      
      // 获取节目详情
      const episodeData = await episodesApi.get(parseInt(id))
      setEpisode(episodeData)
      
      // 获取节目关联的新闻
      const newsData = await episodesApi.listNews(parseInt(id))
      setEpisodeNews(newsData)
      
      // 获取可添加的新闻
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
      // 刷新新闻列表
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
    const totalDuration = Math.ceil(totalWords / 150 * 60) // 假设每分钟150字
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
    // TODO: 实现从节目移除新闻的 API
    console.log('Remove news:', newsId)
  }

  // 生成脚本
  const generateScript = async (newsId) => {
    try {
      setGenerating(true)
      const result = await episodesApi.generateScript(parseInt(id), newsId)
      // Refresh page data
      await fetchEpisode()
    } catch (err) {
      console.error('Failed to generate script:', err)
    } finally {
      setGenerating(false)
    }
  }

  // 生成音频
  const generateAudio = async (episodeNewsId) => {
    try {
      setGenerating(true)
      const result = await episodesApi.generateAudio(parseInt(id), episodeNewsId)
      
      // 更新本地状态
      setEpisodeNews(episodeNews.map(en => 
        en.id === episodeNewsId ? { ...en, status: 'audio_done', audio_url: result.audio_url } : en
      ))
      
      if (selectedNews?.id === episodeNewsId) {
        setSelectedNews({ ...selectedNews, status: 'audio_done', audio_url: result.audio_url })
      }
    } catch (err) {
      console.error('Failed to generate audio:', err)
    } finally {
      setGenerating(false)
    }
  }

  // 删除新闻
  const handleDeleteNews = async (episodeNews) => {
    try {
      // 先设置删除中状态，触发动画
      const element = document.getElementById(`news-item-${episodeNews.id}`)
      if (element) {
        element.style.transition = 'all 0.2s ease-out'
        element.style.opacity = '0'
        element.style.transform = 'translateX(-20px) scale(0.95)'
      }
      
      // 延迟删除，等待动画完成
      setTimeout(async () => {
        await episodesApi.softDelete(parseInt(id), episodeNews.news_id)
        setEpisodeNews(prev => prev.filter(en => en.id !== episodeNews.id))
        if (selectedNews?.id === episodeNews.id) {
          setSelectedNews(null)
        }
        setDeleteMode(null)
      }, 200)
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败')
    }
  }

  // 开始编辑脚本
  const startEditScript = () => {
    setEditedScript(selectedNews.script || '')
    setEditingScript(true)
  }

  // 取消编辑脚本
  const cancelEditScript = () => {
    setEditingScript(false)
    setEditedScript('')
  }

  // 保存脚本
  const saveScript = async () => {
    try {
      setSavingScript(true)
      await episodesApi.updateScript(parseInt(id), selectedNews.news_id, editedScript)
      
      // 更新本地状态
      setEpisodeNews(episodeNews.map(en => 
        en.id === selectedNews.id ? { ...en, script: editedScript } : en
      ))
      setSelectedNews({ ...selectedNews, script: editedScript })
      setEditingScript(false)
    } catch (err) {
      console.error('Failed to save script:', err)
    } finally {
      setSavingScript(false)
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
      // Update local state
      setEpisodeNews(episodeNews.map(en =>
        en.id === editingNotesId ? { ...en, notes: editingNotes } : en
      ))
      if (selectedNews?.id === editingNotesId) {
        setSelectedNews({ ...selectedNews, notes: editingNotes })
      }

      // Persist to backend
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

  // 生成整期逐字稿
  const handleGenerateEpisodeScript = async () => {
    try {
      setGeneratingEpisodeScript(true)
      setGeneratedEpisodeScript('')
      setEditingEpisodeScript(false)
      setEditedEpisodeScript('')

      const result = await episodesApi.generateEpisodeScript(parseInt(id), episodeNotes)
      setGeneratedEpisodeScript(result.script)

      // Update episode in local state
      setEpisode({ ...episode, script: result.script })
    } catch (err) {
      console.error('Failed to generate episode script:', err)
      alert('生成逐字稿失败: ' + (err.message || '未知错误'))
    } finally {
      setGeneratingEpisodeScript(false)
    }
  }

  // 打开生成逐字稿 modal
  const openGenerateEpisodeModal = () => {
    setEpisodeNotes(episode?.script_prompt || '')
    setGeneratedEpisodeScript(episode?.script || '')
    setEditingEpisodeScript(false)
    setEditedEpisodeScript('')
    setTtsProgress(null)
    setShowGenerateEpisodeModal(true)
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
        // 409 means already in progress - just start polling
        if (err.status === 409) {
          console.log('Audio generation already in progress, polling...')
        } else {
          throw err
        }
      }

      // Start polling
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

  // 轮询音频生成进度（用于 modal 重新打开时）
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

  // 当 modal 打开且正在生成音频时，启动轮询
  useEffect(() => {
    if (showGenerateEpisodeModal && generatingAudio) {
      const cleanup = pollAudioProgress()
      return cleanup
    }
  }, [showGenerateEpisodeModal, generatingAudio, pollAudioProgress])

  const filteredAvailableNews = availableNews.filter(n => {
    // Tab 来源筛选
    if (activeSourceTab !== 'all' && n.source !== activeSourceTab) {
      return false
    }
    // 搜索筛选
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    // 评分筛选
    if (newsFilter.minScore > 0 && (n.score || 0) < newsFilter.minScore) {
      return false
    }
    // 日期筛选
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

  // 按来源分组 (用于筛选显示)
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

        {/* 操作按钮组 */}
        <div className="p-3 border-b border-cream-300 flex items-center justify-center gap-4">
          <button
            onClick={() => setShowAddNews(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-cream-200 transition-colors group"
            title="添加新闻"
          >
            <div className="w-10 h-10 rounded-full bg-accent-coral/20 flex items-center justify-center group-hover:bg-accent-coral/30 transition-colors">
              <Plus className="w-5 h-5 text-accent-coral" />
            </div>
          </button>
          
          <button
            onClick={openGenerateEpisodeModal}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-cream-200 transition-colors group"
            title="生成逐字稿"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Zap className="w-5 h-5 text-purple-500" />
            </div>
          </button>
          
          <button
            onClick={() => {
              if (episode?.script) {
                setShowGenerateEpisodeModal(true)
                setGeneratedEpisodeScript(episode.script)
                // Auto-start audio generation
                setTimeout(() => handleGenerateEpisodeAudio(), 100)
              } else {
                alert('请先生成逐字稿')
              }
            }}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-cream-200 transition-colors group"
            title="生成音频"
          >
            <div className="w-10 h-10 rounded-full bg-accent-sage/20 flex items-center justify-center group-hover:bg-accent-sage/30 transition-colors">
              <Volume2 className="w-5 h-5 text-accent-sage" />
            </div>
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
              className="space-y-3"
            >
              {episodeNews.map((en, index) => {
                const status = statusConfig[en.status] || statusConfig.pending
                const Icon = status.icon
                
                return (
                  <div 
                    key={en.id}
                    id={`news-item-${en.id}`}
                    className={`p-4 bg-cream-100 rounded-xl border-2 cursor-pointer transition-colors ${
                      selectedNews?.id === en.id ? 'border-accent-coral' : 'border-transparent hover:border-cream-400'
                    }`}
                    onClick={() => setSelectedNews(en)}
                  >
                    <div className="flex items-start gap-3">
                      {/* 拖拽手柄 */}
                      <div className="drag-handle cursor-grab active:cursor-grabbing p-1 text-ink-50 hover:text-ink-300">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/>
                        </svg>
                      </div>
                      
                      {/* 序号 */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        status.bgColor
                      } ${status.textColor}`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-ink-300 truncate">
                          {en.news?.title || `新闻 #${en.news_id}`}
                        </h4>
                        <p className="text-xs text-ink-50 mt-1">
                          {status.label}
                        </p>
                      </div>
                    </div>
                    
                    {/* 快捷操作按钮 */}
                    <div className="flex gap-2 mt-3 ml-7">
                      <button
                        onClick={(e) => openNotesModal(en, e)}
                        className="flex-1 text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-1"
                      >
                        <StickyNote className="w-3 h-3" />
                        {en.notes ? '查看备注' : '写备注'}
                      </button>
                      
                      {/* 删除/确认按钮组 */}
                      {deleteMode === en.id ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteNews(en) }}
                            className="text-xs px-2 py-1 bg-accent-coral text-white rounded-lg hover:bg-accent-coral/90"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteMode(null) }}
                            className="text-xs px-2 py-1 bg-cream-300 text-ink-300 rounded-lg hover:bg-cream-400"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteMode(en.id) }}
                          className="text-xs px-2 py-1 bg-accent-coral/20 text-accent-coral rounded-lg hover:bg-accent-coral/40"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* 备注显示/编辑 */}
                    {en.notes && editingNotesId !== en.id ? (
                      // 有备注且不在编辑状态 → 显示备注内容
                      <div className="mt-3 ml-7">
                        <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
                          {en.notes}
                        </div>
                      </div>
                    ) : editingNotesId === en.id ? (
                      // 编辑状态 → 显示输入框
                      <div className="mt-3 ml-7">
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
                    ) : null}
                  </div>
                )
              })}
            </ReactSortable>
          )}
        </div>
      </div>

      {/* 右侧：新闻精编 */}
      <div className="flex-1 p-4 overflow-hidden">
        {selectedNews ? (
          <div>
            {/* 新闻正文和备注 - 左右布局 */}
            <div className="flex gap-3 h-full">
              {/* 左侧：新闻正文 */}
              <div className="flex-1 flex flex-col bg-cream-200 rounded-xl p-4 overflow-hidden">
                <h3 className="font-medium text-ink-300 mb-2 shrink-0">新闻正文</h3>
                <div className="flex-1 overflow-y-auto text-sm text-ink-50 leading-relaxed">
                  {selectedNews.news?.content || selectedNews.news?.summary || '暂无正文'}
                </div>
              </div>

              {/* 右侧：备注 */}
              <div className="w-64 shrink-0 bg-cream-200 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h3 className="font-medium text-ink-300">备注</h3>
                  {!editingNotesId && (
                    <button
                      onClick={() => {
                        setEditingNotesId(selectedNews.id)
                        setEditingNotes(selectedNews.notes || '')
                      }}
                      className="text-xs text-accent-coral hover:text-accent-coral/80"
                    >
                      {selectedNews.notes ? '编辑' : '添加备注'}
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {editingNotesId === selectedNews.id ? (
                    <div className="flex flex-col h-full">
                      <textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="为这条新闻写备注..."
                        className="flex-1 w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm text-ink-300 placeholder:text-ink-50 resize-none focus:outline-none focus:border-purple-400"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-2 shrink-0">
                        <button
                          onClick={() => { setEditingNotesId(null); setEditingNotes('') }}
                          className="text-xs px-3 py-1 text-ink-50 hover:text-ink-300"
                        >
                          取消
                        </button>
                        <button
                          onClick={saveNotes}
                          className="text-xs px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : selectedNews.notes ? (
                    <p className="text-sm text-purple-700 whitespace-pre-wrap">{selectedNews.notes}</p>
                  ) : (
                    <p className="text-sm text-ink-50 italic">点击"添加备注"为这条新闻添加备注</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-ink-50">
            选择左侧新闻进行编辑
          </div>
        )}
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

      {/* 生成整期逐字稿 Modal */}
      <AnimatePresence>
        {showGenerateEpisodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/60 flex items-center justify-center z-50 p-4"
            onClick={() => !generatingEpisodeScript && setShowGenerateEpisodeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-2xl w-full max-w-5xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300 bg-cream-200 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink-300">生成整期逐字稿</h2>
                    <p className="text-sm text-ink-50">基于 {episodeNews.length} 条新闻生成对谈脚本</p>
                  </div>
                </div>
                <button
                  onClick={() => !generatingEpisodeScript && setShowGenerateEpisodeModal(false)}
                  className="p-2 hover:bg-cream-300 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              {/* Body - Left/Right layout */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left: News + Notes */}
                <div className="w-[380px] shrink-0 border-r border-cream-300 flex flex-col overflow-hidden">
                  {/* News list */}
                  <div className="flex-1 overflow-y-auto p-5">
                    <h3 className="text-sm font-medium text-ink-300 mb-3 sticky top-0 bg-cream-100 pb-2">📰 本期新闻 ({episodeNews.length} 条)</h3>
                    <div className="space-y-2">
                      {episodeNews.map((en, idx) => (
                        <div key={en.id} className="flex items-start gap-2 text-sm">
                          <span className="w-6 h-6 rounded-full bg-cream-300 flex items-center justify-center text-xs text-ink-50 shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-ink-300 truncate">{en.news?.title || `新闻 #${en.news_id}`}</p>
                            {en.notes && (
                              <p className="text-xs text-purple-500 mt-0.5 truncate">📝 {en.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Episode notes */}
                  <div className="shrink-0 p-5 border-t border-cream-300">
                    <h3 className="text-sm font-medium text-ink-300 mb-2">📝 节目备注</h3>
                    <textarea
                      value={episodeNotes}
                      onChange={(e) => setEpisodeNotes(e.target.value)}
                      placeholder="例如：今天是高考日，增加对考生的祝福..."
                      className="w-full h-24 px-3 py-2 bg-white border border-cream-300 rounded-xl text-sm text-ink-300 placeholder:text-ink-50 resize-none focus:outline-none focus:border-purple-400 transition-colors"
                      disabled={generatingEpisodeScript}
                    />
                  </div>
                </div>

                {/* Right: Script preview / editor */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {generatedEpisodeScript ? (
                    <>
                      <div className="flex items-center justify-between px-5 py-3 border-b border-cream-300 shrink-0">
                        <h3 className="text-sm font-medium text-ink-300">📄 逐字稿{editingEpisodeScript ? '编辑' : '预览'}</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-ink-50">
                            {editingEpisodeScript ? editedEpisodeScript.length : generatedEpisodeScript.length} 字
                          </span>
                          {editingEpisodeScript ? (
                            <div className="flex items-center gap-2">
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
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={startEditEpisodeScript}
                                className="text-xs px-3 py-1 text-purple-500 hover:text-purple-700 transition-colors"
                              >
                                <Edit3 className="w-3 h-3 inline mr-1" />
                                编辑
                              </button>
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
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {editingEpisodeScript ? (
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
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-ink-50">
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-cream-400" />
                        <p className="text-sm">点击"生成逐字稿"后在此预览</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audio generation progress */}
              {ttsProgress && ttsProgress.stage !== 'idle' && (
                <div className="px-6 py-3 border-t border-cream-300 bg-cream-100 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
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
                    <div className="mt-3 p-3 bg-accent-sage/10 rounded-xl border border-accent-sage/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                        <span className="text-sm text-accent-sage font-medium">音频生成完成!</span>
                      </div>
                      <audio
                        controls
                        className="w-full h-10"
                        src={`${AUDIO_BASE}/audio/${id}/episode_${id}.mp3`}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-ink-50">音频路径: {ttsProgress.audio_url}</p>
                        <button
                          onClick={async () => {
                            if (confirm('确定要删除已生成的音频吗？')) {
                              try {
                                await episodesApi.deleteAudio(parseInt(id))
                                setEpisode({ ...episode, audio_url: '' })
                                setTtsProgress(null)
                              } catch (err) {
                                alert('删除失败: ' + err.message)
                              }
                            }
                          }}
                          className="text-xs px-2 py-1 text-accent-coral hover:text-accent-coral/80 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          删除音频
                        </button>
                      </div>
                    </div>
                  )}
                  {ttsProgress.stage === 'error' && (
                    <p className="text-xs text-accent-coral mt-1">❌ {ttsProgress.error}</p>
                  )}
                </div>
              )}

              {/* Persisted audio player (loaded from database) */}
              {!ttsProgress && episode?.audio_url && (
                <div className="px-6 py-3 border-t border-cream-300 bg-cream-100 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                    <span className="text-sm text-accent-sage font-medium">已有音频</span>
                  </div>
                  <audio
                    controls
                    className="w-full h-10"
                    src={`${AUDIO_BASE}/audio/${id}/episode_${id}.mp3`}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-ink-50">音频路径: {episode.audio_url}</p>
                    <button
                      onClick={async () => {
                        if (confirm('确定要删除已生成的音频吗？')) {
                          try {
                            await episodesApi.deleteAudio(parseInt(id))
                            setEpisode({ ...episode, audio_url: '' })
                          } catch (err) {
                            alert('删除失败: ' + err.message)
                          }
                        }
                      }}
                      className="text-xs px-2 py-1 text-accent-coral hover:text-accent-coral/80 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      删除音频
                    </button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-cream-300 bg-cream-200 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    setShowGenerateEpisodeModal(false)
                    setEditingEpisodeScript(false)
                    setEditedEpisodeScript('')
                  }}
                  className="px-4 py-2 text-sm text-ink-50 hover:text-ink-300 transition-colors"
                  disabled={generatingEpisodeScript || generatingAudio}
                >
                  {generatedEpisodeScript ? '关闭' : '取消'}
                </button>

                <div className="flex items-center gap-3">
                  {/* 生成音频按钮 */}
                  {generatedEpisodeScript && (
                    <button
                      onClick={handleGenerateEpisodeAudio}
                      disabled={generatingAudio || generatingEpisodeScript}
                      className="px-5 py-2.5 bg-accent-sage text-white text-sm font-medium rounded-xl hover:bg-accent-sage/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      {generatingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          生成中...
                        </>
                      ) : (ttsProgress?.stage === 'done' || episode?.audio_url) ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          重新生成音频
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          生成音频
                        </>
                      )}
                    </button>
                  )}

                  {/* 生成逐字稿按钮 */}
                  <button
                    onClick={handleGenerateEpisodeScript}
                    disabled={generatingEpisodeScript || generatingAudio || episodeNews.length === 0}
                    className="px-6 py-2.5 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {generatingEpisodeScript ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : generatedEpisodeScript ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        重新生成逐字稿
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        生成逐字稿
                      </>
                    )}
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

// 可排序的新闻项组件
function SortableNewsItem({ en, index, status, Icon, selectedNews, setSelectedNews, generating, deleteMode, setDeleteMode, openNotesModal, handleDeleteNews, editingNotesId, setEditingNotesId, editingNotes, setEditingNotes, saveNotes, cancelNotes }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: en.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 9999 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.2)' : 'none',
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
      className={`p-4 bg-cream-100 rounded-xl border-2 cursor-pointer transition-colors touch-manipulation ${
        selectedNews?.id === en.id ? 'border-accent-coral' : 'border-transparent hover:border-cream-400'
      }`}
      onClick={() => !isDragging && setSelectedNews(en)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-3">
        {/* 拖拽手柄 */}
        <div className="cursor-grab active:cursor-grabbing p-1 text-ink-50 hover:text-ink-300">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/>
          </svg>
        </div>
        
        <div className={`p-2 rounded-lg ${status.bgColor}`}>
          <Icon className={`w-4 h-4 ${status.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-ink-300 truncate">
            {en.news?.title || `新闻 #${en.news_id}`}
          </h4>
          <p className="text-xs text-ink-50 mt-1">
            {status.label}
          </p>
        </div>
        <span className="text-xs text-ink-50">{index + 1}</span>
      </div>
      
      {/* 快捷操作按钮 */}
      <div className="flex gap-2 mt-3 ml-7">
        <button
          onClick={(e) => openNotesModal(en, e)}
          className="flex-1 text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-1"
        >
          <StickyNote className="w-3 h-3" />
          {en.notes ? '查看备注' : '写备注'}
        </button>
        
        {/* 删除/确认按钮组 - 防止误触 */}
        {deleteMode === en.id ? (
          <>
            {/* ✓ 确认删除 - 在左边，需要左移确认 */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteNews(en) }}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              ✓
            </button>
            {/* ✕ 取消 - 在右边，需要右移取消 */}
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteMode(null) }}
              className="text-xs px-2 py-1 bg-cream-300 text-ink-300 rounded-lg hover:bg-cream-400"
            >
              ✕
            </button>
          </>
        ) : (
          /* 垃圾桶图标 */
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteMode(en.id) }}
            className="text-xs px-2 py-1 bg-accent-coral/20 text-accent-coral rounded-lg hover:bg-accent-coral/40"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 备注显示/编辑 */}
      {en.notes && editingNotesId !== en.id ? (
        // 有备注且不在编辑状态 → 显示备注内容
        <div className="mt-3 ml-7">
          <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
            {en.notes}
          </div>
        </div>
      ) : editingNotesId === en.id ? (
        // 编辑状态 → 显示输入框
        <div className="mt-3 ml-7">
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
      ) : null}
    </motion.div>
  )
}
