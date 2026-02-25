import { useState } from 'react'
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
  FolderPlus
} from 'lucide-react'

// 模拟 RSS 源数据
const mockRssSources = [
  { id: 1, name: '科技快讯', url: 'https://kejikuaixun.blogspot.com/feeds/posts/default?alt=rss', count: 12, enabled: true, autoMode: true },
  { id: 2, name: '36氪', url: 'https://36kr.com/feed', count: 8, enabled: true, autoMode: false },
  { id: 3, name: '极客公园', url: 'https://www.geekpark.com/feed', count: 6, enabled: true, autoMode: false },
  { id: 4, name: '爱范儿', url: 'https://www.ifanr.com/feed', count: 5, enabled: false, autoMode: false },
]

// 模拟新闻数据 - 仅用于预览
const mockNews = [
  {
    id: 1,
    title: 'Anthropic 推出智能体 AI 工具，针对投资银行和人力资源自动化',
    summary: 'Anthropic 发布了新的 AI 智能体工具，旨在帮助投资银行和人力资源部门实现自动化...',
    source: '科技快讯',
    url: 'https://example.com/news/1',
    publishedAt: '2小时前',
    keywords: ['AI', 'Anthropic', '自动化']
  },
  {
    id: 2,
    title: 'OpenAI GPT-5 即将发布，性能提升显著',
    summary: '据知情人士透露，OpenAI 计划在未来几个月内发布 GPT-5 模型...',
    source: '36氪',
    url: 'https://example.com/news/2',
    publishedAt: '3小时前',
    keywords: ['OpenAI', 'GPT-5', '大模型']
  },
  {
    id: 3,
    title: '苹果 Vision Pro 2 配备 RGB LCOS 硅基液晶技术',
    summary: '供应链消息显示，苹果下一代 Vision Pro 将采用更先进的显示技术...',
    source: '爱范儿',
    url: 'https://example.com/news/3',
    publishedAt: '4小时前',
    keywords: ['苹果', 'Vision Pro', 'AR/VR']
  },
  {
    id: 4,
    title: '英伟达发布新一代数据中心 GPU，AI 算力提升 3 倍',
    summary: '英伟达在 GTC 大会上发布了基于 Blackwell 架构的新一代 GPU...',
    source: '科技快讯',
    url: 'https://example.com/news/4',
    publishedAt: '5小时前',
    keywords: ['英伟达', 'GPU', 'AI算力']
  },
  {
    id: 5,
    title: '马斯克 xAI 获得 60 亿美元融资，估值达 180 亿美元',
    summary: 'xAI 完成 B 轮融资，将用于扩大其 AI 基础设施和训练更大规模的模型...',
    source: '极客公园',
    url: 'https://example.com/news/5',
    publishedAt: '6小时前',
    keywords: ['马斯克', 'xAI', '融资']
  },
  {
    id: 6,
    title: 'Google 发布 Gemini 1.5 Pro，支持 100 万 token 上下文',
    summary: 'Google DeepMind 宣布 Gemini 1.5 Pro 能够处理超过 100 万 token 的上下文...',
    source: '36氪',
    url: 'https://example.com/news/6',
    publishedAt: '7小时前',
    keywords: ['Google', 'Gemini', '大模型']
  },
  {
    id: 7,
    title: 'Meta 开源 Llama 3，声称性能超越 GPT-4',
    summary: 'Meta 正式发布 Llama 3 系列模型，声称在多项基准测试中超越 GPT-4...',
    source: '科技快讯',
    url: 'https://example.com/news/7',
    publishedAt: '8小时前',
    keywords: ['Meta', 'Llama', '开源']
  },
  {
    id: 8,
    title: '微软 Copilot 全面接入 Windows 11',
    summary: '微软宣布 Copilot 将深度集成到 Windows 11 系统中，成为系统级 AI 助手...',
    source: '极客公园',
    url: 'https://example.com/news/8',
    publishedAt: '9小时前',
    keywords: ['微软', 'Copilot', 'Windows']
  },
  {
    id: 9,
    title: '腾讯发布混元大模型更新，数学推理能力大幅提升',
    summary: '腾讯发布混元大模型新版本，在数学推理和代码生成方面有显著提升...',
    source: '36氪',
    url: 'https://example.com/news/9',
    publishedAt: '10小时前',
    keywords: ['腾讯', '混元', '大模型']
  },
  {
    id: 10,
    title: 'AI 创业公司掀起垂直领域应用热潮',
    summary: '越来越多的 AI 创业公司开始专注于医疗、法律、教育等垂直领域...',
    source: '爱范儿',
    url: 'https://example.com/news/10',
    publishedAt: '11小时前',
    keywords: ['AI创业', '垂直领域', '应用']
  },
]

export default function NewsPool() {
  const [news, setNews] = useState(mockNews)
  const [rssSources, setRssSources] = useState(mockRssSources)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterSource, setFilterSource] = useState('all')
  const [selectedNews, setSelectedNews] = useState([]) // 勾选的新闻
  const [showAddToEpisodeModal, setShowAddToEpisodeModal] = useState(false)
  const [previewNews, setPreviewNews] = useState(null) // 预览的新闻

  // 模拟节目列表
  const [episodes] = useState([
    { id: 1, title: '2026年2月25日 - AI 助手的进化之路', status: 'draft' },
    { id: 2, title: '2026年2月24日 - 科技巨头最新动态', status: 'editing' },
    { id: 3, title: '2026年2月23日 - 智能硬件的未来', status: 'draft' },
  ])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  // 勾选/取消勾选新闻
  const toggleSelect = (id) => {
    setSelectedNews(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    )
  }

  // 全选当前筛选结果
  const selectAllFiltered = () => {
    const filteredIds = filteredNews.map(n => n.id)
    setSelectedNews([...new Set([...selectedNews, ...filteredIds])])
  }

  // 取消全选
  const deselectAll = () => {
    setSelectedNews([])
  }

  const filteredNews = news.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.summary.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSource = filterSource === 'all' || n.source === filterSource
    return matchesSearch && matchesSource
  })

  // 按来源分组
  const groupedNews = filteredNews.reduce((acc, item) => {
    if (!acc[item.source]) acc[item.source] = []
    acc[item.source].push(item)
    return acc
  }, {})

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">新闻池</h1>
          <p className="text-sm text-ink-50">浏览新闻、添加到节目</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-cream-200 rounded-xl text-ink-300 hover:bg-cream-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新新闻
          </motion.button>
          <a
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 bg-cream-200 text-ink-300 rounded-xl hover:bg-cream-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            管理 RSS 源
          </a>
        </div>
      </div>

      {/* RSS 源展示 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Rss className="w-4 h-4 text-accent-coral" />
          <span className="text-sm font-medium text-ink-300">RSS 源</span>
          <span className="text-xs text-ink-50 ml-2">(自动模式将使用标记为 ☑自动 的源)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {rssSources.map(source => (
            <div
              key={source.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                source.enabled
                  ? 'bg-cream-100 border-cream-300'
                  : 'bg-cream-200 border-cream-400 opacity-60'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-accent-sage' : 'bg-ink-50'}`} />
              <span className="text-sm text-ink-300">{source.name}</span>
              <span className="text-xs text-ink-50">({source.count})</span>
              {source.autoMode && source.enabled && (
                <span className="text-xs px-1.5 py-0.5 bg-accent-sage/20 text-accent-sage rounded-full">
                  ☑自动
                </span>
              )}
              <button className="p-1 hover:bg-cream-300 rounded-lg transition-colors">
                <MoreVertical className="w-3 h-3 text-ink-50" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-cream-100 rounded-2xl p-4 mb-6 border border-cream-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-50" />
              <input
                type="text"
                placeholder="搜索新闻..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
              >
                <option value="all">全部来源</option>
                {rssSources.filter(s => s.enabled).map(source => (
                  <option key={source.id} value={source.name}>{source.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-50">
              已选择 <span className="font-medium text-accent-coral">{selectedNews.length}</span> 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllFiltered}
                className="px-3 py-1.5 text-sm text-ink-300 hover:bg-cream-200 rounded-lg transition-colors"
              >
                全选当前
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1.5 text-sm text-ink-50 hover:bg-cream-200 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部添加按钮 */}
      {selectedNews.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-ink-300 text-cream-100 px-6 py-3 rounded-xl shadow-lg"
        >
          <span className="text-sm">已选择 {selectedNews.length} 条新闻</span>
          <button
            onClick={() => setShowAddToEpisodeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-lg font-medium hover:bg-accent-coral/90 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            添加到节目
          </button>
        </motion.div>
      )}

      {/* 按来源分组展示 - 泳道模式 */}
      <div className="space-y-6 pb-20">
        {Object.entries(groupedNews).map(([source, items]) => {
          const sourceInfo = rssSources.find(s => s.name === source)
          return (
            <div key={source} className="bg-cream-200 rounded-2xl p-4">
              {/* 泳道标题 */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${sourceInfo?.enabled ? 'bg-accent-sage' : 'bg-ink-50'}`} />
                <h3 className="font-medium text-ink-300">{source}</h3>
                <span className="text-xs text-ink-50">({items.length} 条)</span>
                {sourceInfo?.autoMode && (
                  <span className="text-xs px-1.5 py-0.5 bg-accent-sage/20 text-accent-sage rounded-full">自动</span>
                )}
              </div>

              {/* 泳道内容 */}
              <div className="grid grid-cols-2 gap-4">
                {items.map((item, index) => {
                  const isSelected = selectedNews.includes(item.id)

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`bg-cream-100 rounded-xl overflow-hidden transition-all ${
                        isSelected
                          ? 'ring-2 ring-accent-coral'
                          : 'hover:border-cream-400'
                      } border-2 border-transparent`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* 复选框 */}
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className="mt-1"
                          >
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-accent-coral" />
                            ) : (
                              <Circle className="w-5 h-5 text-ink-50" />
                            )}
                          </button>

                          {/* 内容 */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-ink-300 line-clamp-2 mb-2">{item.title}</h4>
                            <p className="text-sm text-ink-50 line-clamp-2 mb-3">{item.summary}</p>

                            {/* 关键词和操作 */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex gap-1 flex-1">
                                {item.keywords.slice(0, 2).map(keyword => (
                                  <span
                                    key={keyword}
                                    className="text-xs px-2 py-0.5 bg-cream-200 text-ink-50 rounded-full"
                                  >
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                {/* 预览按钮 */}
                                <button
                                  onClick={() => setPreviewNews(item)}
                                  className="p-1.5 text-ink-50 hover:text-ink-300 hover:bg-cream-200 rounded-lg transition-colors"
                                  title="预览"
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                                {/* 打开原链接 */}
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-ink-50 hover:text-ink-300 hover:bg-cream-200 rounded-lg transition-colors"
                                  title="查看原网页"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 添加到节目弹窗 */}
      <AnimatePresence>
        {showAddToEpisodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowAddToEpisodeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">添加到节目</h2>
                <button
                  onClick={() => setShowAddToEpisodeModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <p className="text-sm text-ink-50 mb-4">
                将 {selectedNews.length} 条新闻添加到以下节目：
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {episodes.map(episode => (
                  <button
                    key={episode.id}
                    onClick={() => {
                      alert(`已添加到: ${episode.title}`)
                      setShowAddToEpisodeModal(false)
                      setSelectedNews([])
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-cream-200 rounded-xl hover:bg-cream-300 transition-colors text-left"
                  >
                    <FolderPlus className="w-5 h-5 text-accent-coral" />
                    <div>
                      <p className="text-sm font-medium text-ink-300">{episode.title}</p>
                      <p className="text-xs text-ink-50">{episode.status === 'draft' ? '草稿' : '编辑中'}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddToEpisodeModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 新闻预览弹窗 */}
      <AnimatePresence>
        {previewNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setPreviewNews(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[600px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-300">新闻预览</h2>
                <button
                  onClick={() => setPreviewNews(null)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                <div>
                  <span className="text-xs px-2 py-1 bg-cream-200 text-ink-50 rounded-lg">
                    {previewNews.source}
                  </span>
                  <span className="text-xs text-ink-50 ml-2">{previewNews.publishedAt}</span>
                </div>

                <h3 className="font-medium text-ink-300 text-lg">{previewNews.title}</h3>

                <p className="text-sm text-ink-50">{previewNews.summary}</p>

                <div className="flex flex-wrap gap-2">
                  {previewNews.keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="text-xs px-2 py-1 bg-accent-coral/10 text-accent-coral rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>

                <a
                  href={previewNews.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent-coral hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看原网页
                </a>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-cream-300">
                <button
                  onClick={() => setPreviewNews(null)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
