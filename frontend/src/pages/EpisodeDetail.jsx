import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Settings,
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
  ShoppingCart
} from 'lucide-react'
import { episodesApi, newsApi } from '../services/api'

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
      await episodesApi.softDelete(parseInt(id), episodeNews.news_id)
      // 从列表中移除
      setEpisodeNews(prev => prev.filter(en => en.id !== episodeNews.id))
      // 如果删除的是当前选中的，清空选择
      if (selectedNews?.id === episodeNews.id) {
        setSelectedNews(null)
      }
      setDeleteMode(null)
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
          
          <input
            type="text"
            value={episode.title}
            onChange={(e) => setEpisode({ ...episode, title: e.target.value })}
            onBlur={() => updateEpisode({ title: episode.title })}
            className="w-full text-xl font-display font-semibold bg-transparent border-none focus:outline-none text-ink-300"
          />
          
          <div className="flex items-center gap-4 mt-3">
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
        <div className="p-4 border-b border-cream-300">
          <button
            onClick={() => setShowAddNews(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            添加新闻
          </button>
        </div>

        {/* 新闻列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {episodeNews.length === 0 ? (
            <div className="text-center py-8 text-ink-50">
              暂无新闻，点击上方按钮添加
            </div>
          ) : (
            episodeNews.map((en, index) => {
              const status = statusConfig[en.status] || statusConfig.pending
              const Icon = status.icon
              
              return (
                <motion.div
                  key={en.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 bg-cream-100 rounded-xl border-2 cursor-pointer transition-colors ${
                    selectedNews?.id === en.id ? 'border-accent-coral' : 'border-transparent hover:border-cream-400'
                  }`}
                  onClick={() => setSelectedNews(en)}
                >
                  <div className="flex items-start gap-3">
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
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); generateScript(en.news_id) }}
                      disabled={generating || en.status === 'generating'}
                      className="flex-1 text-xs px-2 py-1 bg-accent-coral text-white rounded-lg hover:bg-accent-coral/80 disabled:opacity-50"
                    >
                      {en.script ? '重新生成' : '生成脚本'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); generateAudio(en.id) }}
                      disabled={generating || !en.script || en.status === 'audio_done'}
                      className="flex-1 text-xs px-2 py-1 bg-accent-sage text-white rounded-lg hover:bg-accent-sage/80 disabled:opacity-50"
                    >
                      {en.audio_url ? '重新生成' : '生成音频'}
                    </button>
                    
                    {/* 删除/确认按钮组 - 防止误触 */}
                    {deleteMode === en.id ? (
                      <>
                        {/* ✓ 确认 - 在左边 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNews(en) }}
                          className="text-xs px-2 py-1 bg-accent-coral text-white rounded-lg hover:bg-accent-coral/90"
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
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* 右侧：新闻精编 */}
      <div className="flex-1 p-8 overflow-y-auto">
        {selectedNews ? (
          <div>
            <h2 className="text-2xl font-display font-semibold text-ink-300 mb-2">
              {selectedNews.news?.title || `新闻 #${selectedNews.news_id}`}
            </h2>
            
            <p className="text-sm text-ink-50 mb-6">
              来源：{selectedNews.news?.source || '-'}
            </p>

            {/* 新闻摘要 */}
            <div className="bg-cream-200 rounded-xl p-6 mb-6">
              <h3 className="font-medium text-ink-300 mb-3">新闻摘要</h3>
              <p className="text-sm text-ink-50 whitespace-pre-wrap">
                {selectedNews.news?.summary || '暂无摘要'}
              </p>
              
              {selectedNews.news?.content && (
                <>
                  <h3 className="font-medium text-ink-300 mt-6 mb-3">新闻正文</h3>
                  <pre className="text-sm text-ink-50 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedNews.news.content}
                  </pre>
                </>
              )}
            </div>
            
            {/* 操作按钮 -->
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => generateScript(selectedNews.news_id)}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                生成脚本
              </button>
              <button
                onClick={() => generateAudio(selectedNews.id)}
                disabled={generating || selectedNews.status !== 'script_done'}
                className="flex items-center gap-2 px-4 py-2 bg-accent-sage text-white rounded-xl font-medium hover:bg-accent-sage/90 disabled:opacity-50"
              >
                <Volume2 className="w-4 h-4" />
                生成音频
              </button>
            </div>

            {/* 脚本区域 */}
            <div className="bg-cream-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-ink-300">逐字稿</h3>
                {!editingScript ? (
                  <button
                    onClick={startEditScript}
                    className="flex items-center gap-1 text-sm text-accent-coral hover:text-accent-coral/80"
                  >
                    <Edit3 className="w-4 h-4" />
                    编辑
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEditScript}
                      className="flex items-center gap-1 text-sm text-ink-50 hover:text-ink-300"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveScript}
                      disabled={savingScript}
                      className="flex items-center gap-1 text-sm text-accent-sage hover:text-accent-sage/80 disabled:opacity-50"
                    >
                      {savingScript ? '保存中...' : '保存'}
                    </button>
                  </div>
                )}
              </div>
              
              {editingScript ? (
                <textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="w-full h-96 p-4 bg-cream-200 border border-cream-300 rounded-xl text-sm text-ink-300 focus:outline-none focus:border-accent-coral resize-none"
                  placeholder="在此编辑逐字稿..."
                />
              ) : selectedNews.script ? (
                <pre className="whitespace-pre-wrap text-sm text-ink-50 max-h-96 overflow-y-auto">
                  {selectedNews.script}
                </pre>
              ) : (
                <div className="text-center py-8 text-ink-50">
                  暂无逐字稿，请先点击"生成脚本"按钮
                </div>
              )}
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
              className="bg-cream-100 rounded-2xl w-full max-w-6xl h-[85vh] shadow-2xl flex overflow-hidden"
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
                    <div className="space-y-2">
                      {filteredAvailableNews.map((news) => (
                        <motion.div
                          key={news.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`p-3 bg-white rounded-xl border-2 cursor-pointer transition-all ${
                            selectedNewsIds.includes(news.id) 
                              ? 'border-accent-coral bg-accent-coral/5' 
                              : 'border-cream-200 hover:border-cream-400'
                          }`}
                          onClick={() => toggleNewsSelection(news.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                              selectedNewsIds.includes(news.id) 
                                ? 'border-accent-coral bg-accent-coral' 
                                : 'border-cream-400'
                            }`}>
                              {selectedNewsIds.includes(news.id) && (
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <h4 className="font-medium text-sm text-ink-300 line-clamp-2">{news.title}</h4>
                              <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-50">
                                <span className="bg-cream-100 px-2 py-0.5 rounded">{news.source?.slice(0,6) || '未知'}</span>
                                <span className={news.score >= 60 ? 'text-accent-gold font-medium' : ''}>{Math.round(news.score || 0)}⭐</span>
                                <span>{new Date(news.created_at).toLocaleDateString('zh-CN')}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
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
                    selectedStats.items.map((news, idx) => (
                      <div
                        key={news.id}
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
                      </div>
                    ))
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
