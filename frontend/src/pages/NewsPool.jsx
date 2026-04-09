import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Circle,
  MoreVertical,
  Rss,
  Loader2,
  X,
  ExternalLink,
  Send,
  FileText,
  Volume2,
  Play,
  FolderPlus,
  AlertCircle,
  Star,
  ArrowUpDown,
  Filter,
  Eye,
  Calendar
} from 'lucide-react'
import { sourcesApi, newsApi, episodesApi } from '../services/api'

// 星级评分组件
function StarRating({ score, size = 'sm' }) {
  const stars = Math.round(score / 20) // 100分 = 5星
  
  const starSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  const starClass = starSizes[size] || starSizes.sm
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star 
          key={i} 
          className={`${starClass} ${i <= stars ? 'text-accent-gold fill-accent-gold' : 'text-cream-300'}`} 
        />
      ))}
    </div>
  )
}

export default function NewsPool() {
  const [sources, setSources] = useState([])
  const [newsBySource, setNewsBySource] = useState({})
  const [allNews, setAllNews] = useState([])  // 扁平化的所有新闻
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [selectedNews, setSelectedNews] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState([]) // array of source names
  const [showEpisodeModal, setShowEpisodeModal] = useState(false)
  const [episodes, setEpisodes] = useState([])
  const [error, setError] = useState(null)
  
  // 排序和筛选状态
  const [sortBy, setSortBy] = useState('date_score') // date_score, score, created_at
  const [minScore, setMinScore] = useState(0) // 最低评分筛选

  // 新闻详情弹窗状态
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [selectedNewsDetail, setSelectedNewsDetail] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 获取 RSS 源
      const sourcesData = await sourcesApi.list()
      setSources(sourcesData.filter(s => s.enabled))
      
      // 获取新闻 (按时间排序，最新在前)
      const newsData = await newsApi.list({ sortBy: 'created_at', order: 'desc', limit: 200 })
      setAllNews(newsData)
      
      // 按来源分组
      const grouped = {}
      newsData.forEach(news => {
        const sourceName = news.source || '未知来源'
        if (!grouped[sourceName]) {
          grouped[sourceName] = []
        }
        grouped[sourceName].push(news)
      })
      
      // 每个来源只取前20条
      Object.keys(grouped).forEach(key => {
        grouped[key] = grouped[key].slice(0, 20)
      })
      
      setNewsBySource(grouped)
      
      // 获取节目列表（用于添加到节目）
      const episodesData = await episodesApi.list()
      setEpisodes(episodesData)
      
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setError('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFetchNews = async () => {
    try {
      setFetching(true)
      
      // 获取要抓取的源（选中的或全部启用的）
      const sourcesToFetch = selectedSource.length > 0 
        ? sources.filter(s => selectedSource.includes(s.name))
        : sources
      
      if (sourcesToFetch.length === 0) {
        alert('请先选择要抓取的 RSS 源')
        setFetching(false)
        return
      }
      
      // 逐个抓取
      for (const source of sourcesToFetch) {
        try {
          await newsApi.fetch(source.id)
        } catch (err) {
          console.error(`Failed to fetch from ${source.name}:`, err)
        }
      }
      
      // 刷新数据
      await fetchData()
      
    } catch (err) {
      console.error('Failed to fetch news:', err)
      setError('抓取新闻失败')
    } finally {
      setFetching(false)
    }
  }

  const toggleNewsSelection = (newsId) => {
    if (selectedNews.includes(newsId)) {
      setSelectedNews(selectedNews.filter(id => id !== newsId))
    } else {
      setSelectedNews([...selectedNews, newsId])
    }
  }

  // 查看新闻详情（不选中）
  const viewNewsDetail = (news, e) => {
    e?.stopPropagation()
    setSelectedNewsDetail(news)
    setShowNewsModal(true)
  }

  const filteredNewsBySource = (() => {
    // 获取要显示的来源列表
    const sourcesToShow = selectedSource.length > 0 ? selectedSource : Object.keys(newsBySource)
    
    // 应用评分筛选和搜索
    let filteredAll = allNews.filter(news => {
      // 评分筛选
      if ((news.score || 0) < minScore) return false
      // 来源筛选
      if (selectedSource.length > 0 && !selectedSource.includes(news.source)) return false
      // 搜索筛选
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          news.title.toLowerCase().includes(query) ||
          (news.summary && news.summary.toLowerCase().includes(query))
        )
      }
      return true
    })
    
    // 排序: 先按日期倒排（只看日期，不看时间），再按评分倒排
    filteredAll.sort((a, b) => {
      // 提取日期部分（只取 YYYY-MM-DD）
      const dateA = (a.created_at || '').split('T')[0]
      const dateB = (b.created_at || '').split('T')[0]
      
      // 按日期倒排
      if (dateB !== dateA) return dateB.localeCompare(dateA)
      
      // 同一天内，按评分倒排
      return (b.score || 0) - (a.score || 0)
    })
    
    // 按来源分组
    const grouped = {}
    filteredAll.forEach(news => {
      const sourceName = news.source || '未知来源'
      if (!grouped[sourceName]) {
        grouped[sourceName] = []
      }
      grouped[sourceName].push(news)
    })
    
    return grouped
  })()

  const handleAddToEpisode = async (episodeId) => {
    try {
      await episodesApi.addNews(episodeId, selectedNews)
      setSelectedNews([])
      setShowEpisodeModal(false)
      alert('已添加到节目！')
    } catch (err) {
      console.error('Failed to add news to episode:', err)
      alert('添加失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent-coral" />
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">新闻池</h1>
          <p className="text-sm text-ink-50">从 RSS 源筛选新闻，添加到播客节目</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleFetchNews}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 bg-cream-200 text-ink-300 rounded-xl font-medium hover:bg-cream-300 transition-colors disabled:opacity-50"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            抓取新闻
          </button>
          <button
            onClick={() => setShowEpisodeModal(true)}
            disabled={selectedNews.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
          >
            <FolderPlus className="w-4 h-4" />
            添加到节目 ({selectedNews.length})
          </button>
        </div>
      </div>

      {/* 搜索栏 + 排序/筛选 */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索新闻..."
            className="w-full pl-10 pr-4 py-3 bg-cream-100 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
          />
        </div>
        
        {/* 排序选择 */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-ink-50" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-cream-100 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
          >
            <option value="date_score">推荐 (日期+评分)</option>
            <option value="score">只看评分</option>
            <option value="created_at">只看时间</option>
          </select>
        </div>
        
        {/* 评分筛选 */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ink-50" />
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="px-3 py-2 bg-cream-100 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
          >
            <option value={0}>全部评分</option>
            <option value={60}>⭐⭐⭐及以上</option>
            <option value={75}>⭐⭐⭐⭐及以上</option>
            <option value={90}>⭐⭐⭐⭐⭐及以上</option>
          </select>
        </div>
      </div>

      {/* RSS 源标签 - 可点击筛选 (多选) */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {/* 全部/全不选 切换按钮 */}
        <button
          onClick={() => {
            if (selectedSource.length === sources.length) {
              setSelectedSource([]) // 全不选
            } else {
              setSelectedSource(sources.map(s => s.name)) // 全选
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            selectedSource.length === sources.length && sources.length > 0
              ? 'bg-accent-sage text-white'
              : 'bg-cream-200 text-ink-300 hover:bg-cream-300'
          }`}
        >
          <Rss className="w-4 h-4" />
          <span>{selectedSource.length === sources.length && sources.length > 0 ? '全不选' : '全部'}</span>
        </button>
        
        {sources.map(source => {
          const isSelected = selectedSource.includes(source.name)
          const count = newsBySource[source.name]?.length || 0
          return (
            <button
              key={source.id}
              onClick={() => {
                if (isSelected) {
                  setSelectedSource(selectedSource.filter(s => s !== source.name))
                } else {
                  setSelectedSource([...selectedSource, source.name])
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-accent-coral text-cream-100'
                  : 'bg-cream-200 text-ink-300 hover:bg-cream-300'
              }`}
            >
              <Rss className="w-4 h-4" />
              <span>{source.name}</span>
              <span className="text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-600 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">×</button>
        </div>
      )}

      {/* 按来源分组的新闻 */}
      <div className="space-y-8">
        {Object.keys(filteredNewsBySource).length === 0 ? (
          <div className="text-center py-12 text-ink-50 bg-cream-100 rounded-2xl">
            暂无新闻，请先配置 RSS 源并抓取新闻
          </div>
        ) : (
          Object.entries(filteredNewsBySource).map(([sourceName, newsList]) => (
            <div key={sourceName}>
              <div className="flex items-center gap-2 mb-4">
                <Rss className="w-5 h-5 text-accent-coral" />
                <h2 className="font-display text-lg font-semibold text-ink-300">{sourceName}</h2>
                <span className="text-sm text-ink-50">({newsList.length} 条)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newsList.map(news => {
                  const isSelected = selectedNews.includes(news.id)
                  
                  return (
                    <motion.div
                      key={news.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-cream-100 rounded-xl p-4 border-2 transition-colors ${
                        isSelected 
                          ? 'border-accent-coral bg-accent-coral/5' 
                          : 'border-transparent hover:border-cream-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 选择框 */}
                        <div 
                          className={`mt-0.5 cursor-pointer ${
                            isSelected ? 'text-accent-coral' : 'text-ink-50'
                          }`}
                          onClick={() => toggleNewsSelection(news.id)}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* 评分和查看按钮行 */}
                          <div className="flex items-center justify-between mb-2">
                            <StarRating score={news.score || 0} size="md" />
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-accent-gold">
                                {Math.round(news.score || 0)}
                              </span>
                              {/* 查看全文按钮 */}
                              <button
                                onClick={(e) => viewNewsDetail(news, e)}
                                className="p-1 hover:bg-cream-200 rounded text-ink-50 hover:text-ink-300"
                                title="查看全文"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          {/* 标题 - 显示更多行 */}
                          <h3 className="font-medium text-sm text-ink-300 line-clamp-3 mb-2">
                            {news.title}
                          </h3>
                          
                          {/* 摘要 - 显示完整内容 */}
                          {(news.summary || news.content) && (
                            <p className="text-xs text-ink-50 line-clamp-5 mb-2">
                              {(news.content || news.summary)}
                            </p>
                          )}
                          
                          {/* 关键词和日期 */}
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2 flex-wrap">
                              {news.keywords && news.keywords.slice(0, 3).map((keyword, i) => (
                                <span 
                                  key={i} 
                                  className="text-xs px-2 py-0.5 bg-cream-200 rounded text-ink-50"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-ink-50">
                              <Calendar className="w-3 h-3" />
                              {new Date(news.created_at).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新闻详情弹窗 */}
      <AnimatePresence>
        {showNewsModal && selectedNewsDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300 bg-cream-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-coral/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-accent-coral" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-300">新闻详情</h3>
                    <p className="text-xs text-ink-50">{selectedNewsDetail.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedNewsDetail.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-cream-300 rounded-xl text-ink-50 hover:text-ink-300 transition-colors"
                    title="打开原文"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => setShowNewsModal(false)}
                    className="p-2 hover:bg-cream-300 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-ink-50" />
                  </button>
                </div>
              </div>

              {/* 内容 */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* 标题 */}
                <h2 className="font-display text-xl font-semibold text-ink-300 mb-4">
                  {selectedNewsDetail.title}
                </h2>

                {/* 元信息 */}
                <div className="flex items-center gap-4 mb-6 text-sm text-ink-50">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedNewsDetail.created_at).toLocaleString('zh-CN')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                    {Math.round(selectedNewsDetail.score || 0)} 分
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedNewsDetail.keywords?.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-cream-200 rounded text-xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 摘要 */}
                {selectedNewsDetail.summary && (
                  <div className="mb-6 p-4 bg-accent-coral/5 border border-accent-coral/20 rounded-xl">
                    <p className="text-sm font-medium text-accent-coral mb-1">摘要</p>
                    <p className="text-sm text-ink-300">{selectedNewsDetail.summary}</p>
                  </div>
                )}

                {/* 正文（完整版本） */}
                {selectedNewsDetail.content ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm text-ink-300 whitespace-pre-wrap leading-relaxed">
                      {selectedNewsDetail.content}
                    </p>
                  </div>
                ) : selectedNewsDetail.description ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm text-ink-300 whitespace-pre-wrap leading-relaxed">
                      {selectedNewsDetail.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-50 italic">暂无正文内容</p>
                )}
              </div>

              {/* 底部操作 */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-cream-300 bg-cream-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-50">
                    正文 {selectedNewsDetail.content?.length || 0} 字 | 摘要 {selectedNewsDetail.summary?.length || 0} 字
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const isSelected = selectedNews.includes(selectedNewsDetail.id)
                      if (isSelected) {
                        setSelectedNews(selectedNews.filter(id => id !== selectedNewsDetail.id))
                      } else {
                        setSelectedNews([...selectedNews, selectedNewsDetail.id])
                      }
                      setShowNewsModal(false)
                    }}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                      selectedNews.includes(selectedNewsDetail.id)
                        ? 'bg-accent-coral text-white'
                        : 'bg-cream-300 text-ink-300 hover:bg-cream-400'
                    }`}
                  >
                    {selectedNews.includes(selectedNewsDetail.id) ? '已选中 ✓' : '添加到选择'}
                  </button>
                  <button
                    onClick={() => setShowNewsModal(false)}
                    className="px-4 py-2 bg-accent-coral text-white rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 添加到节目弹窗 */}
      <AnimatePresence>
        {showEpisodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowEpisodeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">添加到节目</h2>
                <button
                  onClick={() => setShowEpisodeModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <div className="space-y-3">
                {episodes.length === 0 ? (
                  <div className="text-center py-8 text-ink-50">
                    暂无节目，请先创建节目
                  </div>
                ) : (
                  episodes.map(episode => (
                    <button
                      key={episode.id}
                      onClick={() => handleAddToEpisode(episode.id)}
                      className="w-full text-left p-4 bg-cream-200 rounded-xl hover:bg-cream-300 transition-colors"
                    >
                      <h3 className="font-medium text-ink-300">{episode.title}</h3>
                      <p className="text-xs text-ink-50 mt-1">
                        状态: {episode.status}
                      </p>
                    </button>
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
