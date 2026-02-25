import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Circle,
  MoreVertical,
  Trash2,
  Edit,
  ExternalLink,
  Filter,
  Grid3X3,
  List,
  Rss,
  Loader2,
  Sparkles,
  X
} from 'lucide-react'

// 模拟 RSS 源数据
const mockRssSources = [
  { id: 1, name: '科技快讯', url: 'https://kejikuaixun.blogspot.com/feeds/posts/default?alt=rss', count: 12, enabled: true, autoMode: true },
  { id: 2, name: '36氪', url: 'https://36kr.com/feed', count: 8, enabled: true, autoMode: false },
  { id: 3, name: '极客公园', url: 'https://www.geekpark.com/feed', count: 6, enabled: true, autoMode: false },
  { id: 4, name: '爱范儿', url: 'https://www.ifanr.com/feed', count: 5, enabled: false, autoMode: false },
]

// 模拟新闻数据
const mockNews = [
  {
    id: 1,
    title: 'Anthropic 推出智能体 AI 工具，针对投资银行和人力资源自动化',
    summary: 'Anthropic 发布了新的 AI 智能体工具，旨在帮助投资银行和人力资源部门实现自动化...',
    source: '科技快讯',
    publishedAt: '2小时前',
    selected: true,
    keywords: ['AI', 'Anthropic', '自动化']
  },
  {
    id: 2,
    title: 'OpenAI GPT-5 即将发布，性能提升显著',
    summary: '据知情人士透露，OpenAI 计划在未来几个月内发布 GPT-5 模型...',
    source: '36氪',
    publishedAt: '3小时前',
    selected: true,
    keywords: ['OpenAI', 'GPT-5', '大模型']
  },
  {
    id: 3,
    title: '苹果 Vision Pro 2 配备 RGB LCOS 硅基液晶技术',
    summary: '供应链消息显示，苹果下一代 Vision Pro 将采用更先进的显示技术...',
    source: '爱范儿',
    publishedAt: '4小时前',
    selected: false,
    keywords: ['苹果', 'Vision Pro', 'AR/VR']
  },
  {
    id: 4,
    title: '英伟达发布新一代数据中心 GPU，AI 算力提升 3 倍',
    summary: '英伟达在 GTC 大会上发布了基于 Blackwell 架构的新一代 GPU...',
    source: '科技快讯',
    publishedAt: '5小时前',
    selected: false,
    keywords: ['英伟达', 'GPU', 'AI算力']
  },
  {
    id: 5,
    title: '马斯克 xAI 获得 60 亿美元融资，估值达 180 亿美元',
    summary: 'xAI 完成 B 轮融资，将用于扩大其 AI 基础设施和训练更大规模的模型...',
    source: '极客公园',
    publishedAt: '6小时前',
    selected: true,
    keywords: ['马斯克', 'xAI', '融资']
  },
  {
    id: 6,
    title: 'Google 发布 Gemini 1.5 Pro，支持 100 万 token 上下文',
    summary: 'Google DeepMind 宣布 Gemini 1.5 Pro 能够处理超过 100 万 token 的上下文...',
    source: '36氪',
    publishedAt: '7小时前',
    selected: false,
    keywords: ['Google', 'Gemini', '大模型']
  },
  {
    id: 7,
    title: 'Meta 开源 Llama 3，声称性能超越 GPT-4',
    summary: 'Meta 正式发布 Llama 3 系列模型，声称在多项基准测试中超越 GPT-4...',
    source: '科技快讯',
    publishedAt: '8小时前',
    selected: false,
    keywords: ['Meta', 'Llama', '开源']
  },
  {
    id: 8,
    title: '微软 Copilot 全面接入 Windows 11',
    summary: '微软宣布 Copilot 将深度集成到 Windows 11 系统中，成为系统级 AI 助手...',
    source: '极客公园',
    publishedAt: '9小时前',
    selected: false,
    keywords: ['微软', 'Copilot', 'Windows']
  },
  {
    id: 9,
    title: '腾讯发布混元大模型更新，数学推理能力大幅提升',
    summary: '腾讯发布混元大模型新版本，在数学推理和代码生成方面有显著提升...',
    source: '36氪',
    publishedAt: '10小时前',
    selected: false,
    keywords: ['腾讯', '混元', '大模型']
  },
  {
    id: 10,
    title: 'AI 创业公司掀起垂直领域应用热潮',
    summary: '越来越多的 AI 创业公司开始专注于医疗、法律、教育等垂直领域...',
    source: '爱范儿',
    publishedAt: '11小时前',
    selected: false,
    keywords: ['AI创业', '垂直领域', '应用']
  },
]

const promptTemplates = [
  { id: 1, name: '技术深度分析', prompt: '请深入分析这项技术的原理、优势和应用场景' },
  { id: 2, name: '社会影响讨论', prompt: '请从社会影响角度讨论这项技术对人类的影响' },
  { id: 3, name: '行业趋势展望', prompt: '请分析这项技术在行业中的发展趋势' },
  { id: 4, name: '对比分析', prompt: '请将这项技术与同类产品进行对比分析' },
  { id: 5, name: '自定义', prompt: '' },
]

export default function NewsPool() {
  const [news, setNews] = useState(mockNews)
  const [rssSources, setRssSources] = useState(mockRssSources)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showRssModal, setShowRssModal] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(null)
  const [filterSource, setFilterSource] = useState('all')

  const selectedCount = news.filter(n => n.selected).length

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  const toggleSelect = (id) => {
    setNews(news.map(n =>
      n.id === id ? { ...n, selected: !n.selected } : n
    ))
  }

  const selectAll = () => {
    const filteredNews = filterSource === 'all'
      ? news
      : news.filter(n => n.source === filterSource)
    const unselected = filteredNews.filter(n => !n.selected)
    if (unselected.length > 0) {
      setNews(news.map(n =>
        filteredNews.find(fn => fn.id === n.id) ? { ...n, selected: true } : n
      ))
    }
  }

  const deselectAll = () => {
    setNews(news.map(n => ({ ...n, selected: false })))
  }

  const filteredNews = news.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.summary.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSource = filterSource === 'all' || n.source === filterSource
    return matchesSearch && matchesSource
  })

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">新闻池</h1>
          <p className="text-sm text-ink-50">从 RSS 源收集新闻，人工筛选本期节目内容</p>
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRssModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加 RSS 源
          </motion.button>
        </div>
      </div>

      {/* RSS 源展示 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Rss className="w-4 h-4 text-accent-coral" />
          <span className="text-sm font-medium text-ink-300">RSS 源</span>
          <span className="text-xs text-ink-50 ml-2">
            (自动模式将使用标记为 ☑自动 的源)
          </span>
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
            {/* 搜索 */}
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

            {/* 筛选 */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-ink-50" />
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

            {/* 视图切换 */}
            <div className="flex items-center bg-cream-200 rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-cream-100 shadow-sm' : 'hover:bg-cream-300'}`}
              >
                <List className="w-4 h-4 text-ink-300" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-cream-100 shadow-sm' : 'hover:bg-cream-300'}`}
              >
                <Grid3X3 className="w-4 h-4 text-ink-300" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-50">
              已选择 <span className="font-medium text-accent-coral">{selectedCount}</span> / 10 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 text-sm text-ink-300 hover:bg-cream-200 rounded-lg transition-colors"
              >
                全选
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

      {/* 新闻列表 */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNews.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-cream-100 rounded-2xl p-5 border transition-all cursor-pointer ${
                  item.selected
                    ? 'border-accent-sage shadow-sm'
                    : 'border-cream-300 hover:border-cream-400'
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className="flex items-start gap-4">
                  {/* 复选框 */}
                  <div className="pt-1">
                    {item.selected ? (
                      <CheckCircle2 className="w-6 h-6 text-accent-sage" />
                    ) : (
                      <Circle className="w-6 h-6 text-ink-50" />
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-medium text-ink-300 line-clamp-2">{item.title}</h3>
                      {item.selected && (
                        <motion.button
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-3 py-1 bg-accent-sage/20 text-accent-sage text-xs rounded-full flex-shrink-0"
                        >
                          已选择
                        </motion.button>
                      )}
                    </div>
                    <p className="text-sm text-ink-50 line-clamp-2 mb-3">{item.summary}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 bg-cream-200 rounded-lg text-ink-50">
                        {item.source}
                      </span>
                      <span className="text-xs text-ink-50">{item.publishedAt}</span>
                      <div className="flex gap-1">
                        {item.keywords.map(keyword => (
                          <span
                            key={keyword}
                            className="text-xs px-2 py-0.5 bg-accent-coral/10 text-accent-coral rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowPromptModal(item.id)
                      }}
                      className={`p-2 rounded-xl transition-colors ${
                        item.selected
                          ? 'bg-accent-sage/20 text-accent-sage'
                          : 'bg-cream-200 text-ink-50 hover:bg-cream-300'
                      }`}
                      title="设置提示词"
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-cream-200 text-ink-50 hover:bg-cream-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredNews.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-cream-100 rounded-2xl p-5 border transition-all cursor-pointer card-hover ${
                  item.selected
                    ? 'border-accent-sage shadow-sm'
                    : 'border-cream-300 hover:border-cream-400'
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.selected ? 'bg-accent-sage' : 'border-2 border-ink-50'
                  }`}>
                    {item.selected && <CheckCircle2 className="w-3 h-3 text-cream-100" />}
                  </div>
                  <span className="text-xs px-2 py-1 bg-cream-200 rounded-lg text-ink-50">
                    {item.source}
                  </span>
                </div>
                <h3 className="font-medium text-ink-300 mb-2 line-clamp-2">{item.title}</h3>
                <p className="text-sm text-ink-50 line-clamp-3 mb-3">{item.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {item.keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="text-xs px-2 py-0.5 bg-accent-coral/10 text-accent-coral rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="fixed bottom-6 right-8 flex items-center gap-4">
        <div className="bg-ink-300 text-cream-100 px-4 py-2 rounded-xl shadow-lg">
          已选择 {selectedCount} 条新闻
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium shadow-lg hover:bg-accent-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          生成逐字稿 →
        </motion.button>
      </div>

      {/* 添加 RSS 源弹窗 */}
      <AnimatePresence>
        {showRssModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowRssModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">添加 RSS 源</h2>
                <button
                  onClick={() => setShowRssModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">源名称</label>
                  <input
                    type="text"
                    placeholder="例如：科技快讯"
                    className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">RSS URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="enabled" className="w-4 h-4 accent-accent-coral" />
                  <label htmlFor="enabled" className="text-sm text-ink-300">启用此源</label>
                </div>
                <div className="flex items-center gap-2 pt-2 pb-2">
                  <input type="checkbox" id="autoMode" className="w-4 h-4 accent-accent-sage" />
                  <label htmlFor="autoMode" className="text-sm text-ink-300">用于自动模式</label>
                  <span className="text-xs text-ink-50 ml-1">(自动模式将抓取此源)</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowRssModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors">
                  添加
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提示词设置弹窗 */}
      <AnimatePresence>
        {showPromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowPromptModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[600px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">设置提示词</h2>
                <button
                  onClick={() => setShowPromptModal(null)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>
              <p className="text-sm text-ink-50 mb-4">
                为这条新闻的逐字稿生成设置讨论方向
              </p>
              <div className="space-y-3 mb-6">
                {promptTemplates.map(template => (
                  <label
                    key={template.id}
                    className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors"
                  >
                    <input type="radio" name="prompt" className="w-4 h-4 accent-accent-coral" />
                    <div>
                      <p className="text-sm font-medium text-ink-300">{template.name}</p>
                      {template.prompt && (
                        <p className="text-xs text-ink-50">{template.prompt}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">自定义提示词</label>
                <textarea
                  placeholder="输入自定义的提示词，引导 AI 生成特定方向的讨论内容..."
                  rows={3}
                  className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPromptModal(null)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors">
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
