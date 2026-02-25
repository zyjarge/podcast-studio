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
  Loader2
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

  // 从节目移除新闻
  const removeNewsFromEpisode = async (newsId) => {
    // TODO: 实现从节目移除新闻的 API
    console.log('Remove news:', newsId)
  }

  // 生成脚本
  const generateScript = async (episodeNewsId) => {
    try {
      setGenerating(true)
      const result = await episodesApi.generateScript(parseInt(id), episodeNewsId)
      
      // 更新本地状态
      setEpisodeNews(episodeNews.map(en => 
        en.id === episodeNewsId ? { ...en, status: 'script_done', script: result.script } : en
      ))
      
      if (selectedNews?.id === episodeNewsId) {
        setSelectedNews({ ...selectedNews, status: 'script_done', script: result.script })
      }
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

  const filteredAvailableNews = availableNews.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                onClick={() => generateScript(selectedNews.id)}
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

            {/* 脚本预览 */}
            {selectedNews.script && (
              <div className="bg-cream-100 rounded-xl p-6">
                <h3 className="font-medium text-ink-300 mb-3">生成的脚本</h3>
                <pre className="whitespace-pre-wrap text-sm text-ink-50 max-h-96 overflow-y-auto">
                  {selectedNews.script}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-ink-50">
            选择左侧新闻进行编辑
          </div>
        )}
      </div>

      {/* 添加新闻弹窗 */}
      <AnimatePresence>
        {showAddNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowAddNews(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[600px] max-h-[80vh] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-300">添加新闻</h2>
                <button
                  onClick={() => setShowAddNews(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索新闻..."
                  className="w-full pl-10 pr-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {filteredAvailableNews.length === 0 ? (
                  <div className="text-center py-8 text-ink-50">
                    暂无新闻可添加
                  </div>
                ) : (
                  filteredAvailableNews.map((news) => (
                    <div
                      key={news.id}
                      className="p-4 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors"
                      onClick={() => addNewsToEpisode(news.id)}
                    >
                      <h4 className="font-medium text-sm text-ink-300">{news.title}</h4>
                      <p className="text-xs text-ink-50 mt-1 line-clamp-2">{news.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
