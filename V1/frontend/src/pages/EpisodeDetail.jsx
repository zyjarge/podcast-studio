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
  ChevronDown
} from 'lucide-react'

// 模拟新闻数据
const allNews = [
  {
    id: 1,
    title: 'Anthropic 推出智能体 AI 工具，针对投资银行和人力资源自动化',
    summary: 'Anthropic 发布了新的 AI 智能体工具，旨在帮助投资银行和人力资源部门实现自动化...',
    source: '科技快讯',
    publishedAt: '2小时前',
    selected: false,
    keywords: ['AI', 'Anthropic', '自动化'],
    prompt: '请从AI工具对人力资源的影响以及整体社会发展方向进行讨论',
    rawContent: `请根据以下新闻撰写一期播客对话：\n\n新闻标题：Anthropic 推出智能体 AI 工具\n\n新闻摘要：Anthropic 发布了新的 AI 智能体工具...\n\n请从AI工具对人力资源的影响以及整体社会发展方向进行讨论`,
    status: 'audio_done',
    script: `彪悍罗：各位听众朋友们大家好，欢迎来到科技双响炮！我是彪悍罗。\nOK王：我是OK王，今天我们继续来聊聊科技圈的那些事儿。`,
    audioDuration: '3:24'
  },
  {
    id: 2,
    title: 'OpenAI GPT-5 即将发布，性能提升显著',
    summary: '据知情人士透露，OpenAI 计划在未来几个月内发布 GPT-5 模型...',
    source: '36氪',
    publishedAt: '3小时前',
    selected: false,
    keywords: ['OpenAI', 'GPT-5', '大模型'],
    prompt: '请分析GPT-5的技术进步和对行业的影响',
    rawContent: '',
    status: 'script_done',
    script: `彪悍罗：说到AI，怎么能不提OpenAI呢？据说明年他们就要发布GPT-5了。\nOK王：是的，据知情人士透露，GPT-5在性能上会有显著提升...`,
    audioDuration: null
  },
  {
    id: 3,
    title: '苹果 Vision Pro 2 配备 RGB LCOS 硅基液晶技术',
    summary: '供应链消息显示，苹果下一代 Vision Pro 将采用更先进的显示技术...',
    source: '爱范儿',
    publishedAt: '4小时前',
    selected: false,
    keywords: ['苹果', 'Vision Pro', 'AR/VR'],
    prompt: '',
    rawContent: '',
    status: 'pending',
    script: null,
    audioDuration: null
  },
  {
    id: 4,
    title: '英伟达发布新一代数据中心 GPU，AI 算力提升 3 倍',
    summary: '英伟达在 GTC 大会上发布了基于 Blackwell 架构的新一代 GPU...',
    source: '科技快讯',
    publishedAt: '5小时前',
    selected: false,
    keywords: ['英伟达', 'GPU', 'AI算力'],
    prompt: '',
    rawContent: '',
    status: 'generating',
    script: null,
    audioDuration: null
  },
  {
    id: 5,
    title: '马斯克 xAI 获得 60 亿美元融资，估值达 180 亿美元',
    summary: 'xAI 完成 B 轮融资，将用于扩大其 AI 基础设施...',
    source: '极客公园',
    publishedAt: '6小时前',
    selected: false,
    keywords: ['马斯克', 'xAI', '融资'],
    prompt: '',
    rawContent: '',
    status: 'error',
    script: null,
    audioDuration: null,
    errorMsg: 'API 调用超时'
  },
  {
    id: 6,
    title: 'Google 发布 Gemini 1.5 Pro，支持 100 万 token 上下文',
    summary: 'Google DeepMind 宣布 Gemini 1.5 Pro 能够处理超过 100 万 token 的上下文...',
    source: '36氪',
    publishedAt: '7小时前',
    selected: false,
    keywords: ['Google', 'Gemini', '大模型'],
    prompt: '',
    rawContent: '',
    status: 'pending',
    script: null,
    audioDuration: null
  },
]

const promptTemplates = [
  { id: 1, name: '技术深度分析', prompt: '请深入分析这项技术的原理、优势和应用场景' },
  { id: 2, name: '社会影响讨论', prompt: '请从社会影响角度讨论这项技术对人类的影响' },
  { id: 3, name: '行业趋势展望', prompt: '请分析这项技术在行业中的发展趋势' },
  { id: 4, name: '对比分析', prompt: '请将这项技术与同类产品进行对比分析' },
  { id: 5, name: '自定义', prompt: '' },
]

const statusConfig = {
  pending: { label: '待生成', bgColor: 'bg-cream-200', textColor: 'text-ink-50', icon: Circle },
  generating: { label: '生成中', bgColor: 'bg-accent-gold/20', textColor: 'text-accent-gold', icon: RefreshCw },
  script_done: { label: '逐字稿完成', bgColor: 'bg-accent-sage/20', textColor: 'text-accent-sage', icon: FileText },
  audio_done: { label: '已完成', bgColor: 'bg-accent-coral/20', textColor: 'text-accent-coral', icon: CheckCircle2 },
  error: { label: '失败', bgColor: 'bg-accent-coral/20', textColor: 'text-accent-coral', icon: AlertCircle },
}

export default function EpisodeDetail({ currentMode }) {
  const { id } = useParams()
  const navigate = useNavigate()

  // 模拟节目数据
  const [episode, setEpisode] = useState({
    id: parseInt(id),
    title: `${new Date().toLocaleDateString('zh-CN')} - 科技播客`,
    status: 'draft',
    createdAt: new Date().toLocaleString('zh-CN')
  })

  // 节目中的新闻
  const [episodeNews, setEpisodeNews] = useState([
    allNews[0], allNews[1], allNews[2]
  ])

  // 可添加的新闻（从新闻池）
  const [availableNews, setAvailableNews] = useState(allNews.filter(n => !episodeNews.find(en => en.id === n.id)))
  const [showAddNews, setShowAddNews] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 当前选中的新闻（用于精编）
  const [selectedNews, setSelectedNews] = useState(null)

  // 弹窗状态
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [showRawContentModal, setShowRawContentModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)

  // 统计
  const totalNews = episodeNews.length
  const completedNews = episodeNews.filter(n => n.status === 'audio_done').length
  const progress = totalNews > 0 ? Math.round((completedNews / totalNews) * 100) : 0

  // 添加新闻到节目
  const addNewsToEpisode = (news) => {
    setEpisodeNews([...episodeNews, { ...news, status: 'pending', prompt: '', script: null, audioDuration: null }])
    setAvailableNews(availableNews.filter(n => n.id !== news.id))
    setShowAddNews(false)
  }

  // 从节目移除新闻
  const removeNewsFromEpisode = (newsId) => {
    const news = episodeNews.find(n => n.id === newsId)
    setEpisodeNews(episodeNews.filter(n => n.id !== newsId))
    setAvailableNews([...availableNews, news])
    if (selectedNews?.id === newsId) setSelectedNews(null)
  }

  // 更新新闻提示词
  const updateNewsPrompt = (newsId, prompt) => {
    setEpisodeNews(episodeNews.map(n =>
      n.id === newsId ? { ...n, prompt } : n
    ))
  }

  // 生成逐字稿
  const generateScript = (newsId) => {
    setEpisodeNews(episodeNews.map(n =>
      n.id === newsId ? { ...n, status: 'generating' } : n
    ))

    setTimeout(() => {
      setEpisodeNews(episodeNews.map(n => {
        if (n.id === newsId) {
          return {
            ...n,
            status: 'script_done',
            script: `彪悍罗：各位听众朋友们大家好，欢迎来到科技双响炮！我是彪悍罗。\nOK王：我是OK王，今天我们继续来聊聊科技圈的那些事儿。\n\n关于 ${n.title}，我们来深入讨论一下...`
          }
        }
        return n
      }))
    }, 2000)
  }

  // 生成音频
  const generateAudio = (newsId) => {
    setEpisodeNews(episodeNews.map(n =>
      n.id === newsId ? { ...n, status: 'generating' } : n
    ))

    setTimeout(() => {
      setEpisodeNews(episodeNews.map(n => {
        if (n.id === newsId) {
          return {
            ...n,
            status: 'audio_done',
            audioDuration: '3:24'
          }
        }
        return n
      }))
    }, 2000)
  }

  // 批量生成
  const generateAll = () => {
    const pendingNews = episodeNews.filter(n => n.status === 'pending' || n.status === 'script_done')
    pendingNews.forEach((news, index) => {
      setTimeout(() => {
        if (news.status === 'pending') {
          generateScript(news.id)
        }
        setTimeout(() => {
          generateAudio(news.id)
        }, 2500)
      }, index * 3000)
    })
  }

  const filteredAvailableNews = availableNews.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <div className="bg-cream-200 border-b border-cream-400 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-cream-300 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-ink-50" />
            </button>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink-300">
                {episode.title}
              </h1>
              <p className="text-sm text-ink-50">创建于 {episode.createdAt}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 进度显示 */}
            <div className="flex items-center gap-3 px-4 py-2 bg-cream-100 rounded-xl">
              <div className="flex-1 w-32 h-2 bg-cream-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-sage rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-ink-50">{completedNews}/{totalNews}</span>
            </div>

            {/* 操作按钮 */}
            {completedNews === totalNews && totalNews > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90"
              >
                <Layers className="w-4 h-4" />
                整合发布
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* 左侧：新闻列表 */}
        <div className="w-1/2 border-r border-cream-400 flex flex-col">
          {/* 工具栏 */}
          <div className="p-4 border-b border-cream-400">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-ink-300">节目新闻 ({episodeNews.length})</h2>
              <button
                onClick={() => setShowAddNews(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent-coral text-cream-100 rounded-lg hover:bg-accent-coral/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新闻
              </button>
            </div>

            {/* 进度条 */}
            <div className="h-1.5 bg-cream-300 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-accent-sage rounded-full"
              />
            </div>
          </div>

          {/* 新闻列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {episodeNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="w-12 h-12 text-cream-400 mb-3" />
                <p className="text-ink-50 mb-2">暂无新闻</p>
                <button
                  onClick={() => setShowAddNews(true)}
                  className="text-accent-coral text-sm hover:underline"
                >
                  点击添加新闻
                </button>
              </div>
            ) : (
              episodeNews.map((news, index) => {
                const status = statusConfig[news.status]
                const StatusIcon = status.icon

                return (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      selectedNews?.id === news.id
                        ? 'border-accent-coral bg-cream-100'
                        : 'border-cream-300 hover:border-cream-400 bg-cream-100'
                    }`}
                    onClick={() => setSelectedNews(news)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-medium text-ink-50 bg-cream-200 px-2 py-0.5 rounded-lg">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${status.bgColor} ${status.textColor}`}>
                            <StatusIcon className={`w-3 h-3 ${news.status === 'generating' ? 'animate-spin' : ''}`} />
                            {status.label}
                          </span>
                          {news.audioDuration && (
                            <span className="text-xs text-ink-50">{news.audioDuration}</span>
                          )}
                        </div>
                        <h3 className="font-medium text-ink-300 line-clamp-2 text-sm">{news.title}</h3>
                        {news.prompt && (
                          <p className="text-xs text-accent-gold mt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {news.prompt}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNewsFromEpisode(news.id)
                        }}
                        className="p-1 hover:bg-cream-200 rounded-lg text-ink-50 hover:text-accent-coral"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* 底部操作 */}
          {episodeNews.length > 0 && (
            <div className="p-4 border-t border-cream-400 bg-cream-200">
              <button
                onClick={generateAll}
                disabled={completedNews === totalNews}
                className="w-full py-3 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {completedNews === totalNews ? '全部完成' : '生成全部'}
              </button>
            </div>
          )}
        </div>

        {/* 右侧：精编面板 */}
        <div className="w-1/2 bg-cream-50 flex flex-col">
          {selectedNews ? (
            <>
              {/* 新闻信息 */}
              <div className="p-6 border-b border-cream-400">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-semibold text-ink-300">精编新闻</h2>
                  <span className="text-xs text-ink-50">{selectedNews.source}</span>
                </div>
                <h3 className="font-medium text-ink-300 mb-2">{selectedNews.title}</h3>
                <p className="text-sm text-ink-50">{selectedNews.summary}</p>
              </div>

              {/* 操作区域 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. 提示词设置 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
                    <Sparkles className="w-4 h-4 text-accent-gold" />
                    1. 设置提示词
                  </h3>
                  <div className="bg-cream-100 rounded-xl p-4 border border-cream-300">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {promptTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => updateNewsPrompt(selectedNews.id, template.prompt)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            selectedNews.prompt === template.prompt
                              ? 'bg-accent-gold text-cream-100'
                              : 'bg-cream-200 text-ink-50 hover:bg-cream-300'
                          }`}
                        >
                          {template.name}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={selectedNews.prompt || ''}
                      onChange={(e) => updateNewsPrompt(selectedNews.id, e.target.value)}
                      placeholder="自定义提示词，引导生成方向..."
                      rows={2}
                      className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-lg text-sm focus:outline-none focus:border-accent-gold resize-none"
                    />
                  </div>
                </div>

                {/* 2. 发送给 LLM 的正文 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
                    <Send className="w-4 h-4 text-accent-coral" />
                    2. 发送给 LLM 的正文
                  </h3>
                  <div className="bg-cream-100 rounded-xl border border-cream-300 overflow-hidden">
                    <div className="p-3 bg-cream-200 flex items-center justify-between">
                      <span className="text-xs text-ink-50">以下内容将作为 prompt 发送给 DeepSeek</span>
                      <button
                        onClick={() => setShowRawContentModal(true)}
                        className="text-xs text-accent-coral hover:underline"
                      >
                        全屏查看
                      </button>
                    </div>
                    <div className="p-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-ink-300 whitespace-pre-wrap font-mono">
                        {selectedNews.prompt
                          ? `请根据以下新闻撰写一期播客对话：\n\n新闻标题：${selectedNews.title}\n\n新闻摘要：${selectedNews.summary}\n\n${selectedNews.prompt}`
                          : `请根据以下新闻撰写一期播客对话：\n\n新闻标题：${selectedNews.title}\n\n新闻摘要：${selectedNews.summary}`
                        }
                      </pre>
                    </div>
                  </div>
                </div>

                {/* 3. 逐字稿 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
                    <FileText className="w-4 h-4 text-accent-sage" />
                    3. 逐字稿
                  </h3>
                  <div className="bg-cream-100 rounded-xl border border-cream-300 overflow-hidden">
                    {selectedNews.script ? (
                      <div>
                        <div className="p-3 bg-cream-200 flex items-center justify-between">
                          <span className="text-sm text-accent-sage">已生成</span>
                          <button
                            onClick={() => setShowScriptModal(true)}
                            className="text-xs text-ink-50 hover:text-ink-300"
                          >
                            查看/编辑
                          </button>
                        </div>
                        <div className="p-3 max-h-32 overflow-y-auto">
                          <pre className="text-xs text-ink-300 whitespace-pre-wrap line-clamp-6">
                            {selectedNews.script}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <FileText className="w-8 h-8 text-cream-400 mx-auto mb-2" />
                        <p className="text-sm text-ink-50 mb-3">尚未生成逐字稿</p>
                        <button
                          onClick={() => generateScript(selectedNews.id)}
                          disabled={selectedNews.status === 'generating'}
                          className="px-4 py-2 bg-accent-sage text-cream-100 rounded-lg text-sm hover:bg-accent-sage/90 disabled:opacity-50"
                        >
                          {selectedNews.status === 'generating' ? '生成中...' : '生成逐字稿'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. 音频 */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
                    <Volume2 className="w-4 h-4 text-accent-coral" />
                    4. 音频
                  </h3>
                  <div className="bg-cream-100 rounded-xl border border-cream-300 p-4">
                    {selectedNews.status === 'audio_done' ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button className="w-10 h-10 bg-accent-coral/20 rounded-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-accent-coral ml-0.5" />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-ink-300">音频已就绪</p>
                            <p className="text-xs text-ink-50">时长 {selectedNews.audioDuration}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => generateAudio(selectedNews.id)}
                          className="px-3 py-1.5 text-sm bg-cream-200 text-ink-50 rounded-lg hover:bg-cream-300"
                        >
                          重新生成
                        </button>
                      </div>
                    ) : selectedNews.script ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cream-200 rounded-full flex items-center justify-center">
                            <Volume2 className="w-5 h-5 text-ink-50" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink-300">等待生成音频</p>
                            <p className="text-xs text-ink-50">生成后将显示播放按钮</p>
                          </div>
                        </div>
                        <button
                          onClick={() => generateAudio(selectedNews.id)}
                          disabled={selectedNews.status === 'generating'}
                          className="px-4 py-2 bg-accent-coral text-cream-100 rounded-lg text-sm hover:bg-accent-coral/90 disabled:opacity-50"
                        >
                          {selectedNews.status === 'generating' ? '生成中...' : '生成音频'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-sm text-ink-50">请先完成逐字稿生成</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Settings className="w-16 h-16 text-cream-400 mb-4" />
              <p className="text-lg text-ink-300 mb-2">选择一个新闻进行精编</p>
              <p className="text-sm text-ink-50">点击左侧新闻条目，查看详情并操作</p>
            </div>
          )}
        </div>
      </div>

      {/* 添加新闻弹窗 - 支持批量选择 */}
      <AnimatePresence>
        {showAddNews && (() => {
          const [selectedToAdd, setSelectedToAdd] = useState([])

          const toggleSelectToAdd = (id) => {
            setSelectedToAdd(prev =>
              prev.includes(id)
                ? prev.filter(n => n !== id)
                : [...prev, id]
            )
          }

          const handleBatchAdd = () => {
            selectedToAdd.forEach(id => {
              const news = availableNews.find(n => n.id === id)
              if (news) {
                addNewsToEpisode(news)
              }
            })
            setSelectedToAdd([])
            setShowAddNews(false)
          }

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => { setShowAddNews(false); setSelectedToAdd([]) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[700px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-300">添加新闻到节目</h2>
                <button
                  onClick={() => { setShowAddNews(false); setSelectedToAdd([]) }}
                  className="p-2 hover:bg-cream-200 rounded-xl"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              {/* 搜索和批量操作 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-50" />
                  <input
                    type="text"
                    placeholder="搜索新闻..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                  />
                </div>
                <button
                  onClick={() => {
                    const ids = filteredAvailableNews.map(n => n.id)
                    setSelectedToAdd([...new Set([...selectedToAdd, ...ids])])
                  }}
                  className="px-3 py-2 text-sm bg-cream-200 text-ink-300 rounded-xl hover:bg-cream-300"
                >
                  全选
                </button>
                <button
                  onClick={() => setSelectedToAdd([])}
                  className="px-3 py-2 text-sm text-ink-50 hover:bg-cream-200 rounded-xl"
                >
                  取消
                </button>
              </div>

              {/* 已选数量提示 */}
              {selectedToAdd.length > 0 && (
                <div className="mb-3 px-3 py-2 bg-accent-coral/10 border border-accent-coral rounded-xl flex items-center justify-between">
                  <span className="text-sm text-accent-coral">已选择 {selectedToAdd.length} 条新闻</span>
                  <button
                    onClick={handleBatchAdd}
                    className="px-3 py-1 text-sm bg-accent-coral text-cream-100 rounded-lg hover:bg-accent-coral/90"
                  >
                    批量添加
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
                {filteredAvailableNews.map(news => {
                  const isSelected = selectedToAdd.includes(news.id)
                  const isInEpisode = episodeNews.find(n => n.id === news.id)

                  return (
                  <div
                    key={news.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isInEpisode
                        ? 'bg-cream-300 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-accent-coral/10 border border-accent-coral'
                          : 'bg-cream-200 hover:bg-cream-300 cursor-pointer'
                    }`}
                    onClick={() => !isInEpisode && toggleSelectToAdd(news.id)}
                  >
                    {isInEpisode ? (
                      <CheckCircle2 className="w-5 h-5 text-ink-50" />
                    ) : isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-accent-coral" />
                    ) : (
                      <Circle className="w-5 h-5 text-ink-50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-ink-300 line-clamp-1">{news.title}</h4>
                      <p className="text-xs text-ink-50">{news.source} · {news.publishedAt}</p>
                    </div>
                    {isInEpisode && (
                      <span className="text-xs text-ink-50">已在节目中</span>
                    )}
                  </div>
                  )})}
              </div>
            </motion.div>
          </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* 预览正文弹窗 */}
      <AnimatePresence>
        {showRawContentModal && selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowRawContentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[700px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-300 flex items-center gap-2">
                  <Send className="w-5 h-5 text-accent-coral" />
                  发送给 DeepSeek 的正文
                </h2>
                <button onClick={() => setShowRawContentModal(false)} className="p-2 hover:bg-cream-200 rounded-xl">
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-cream-200 rounded-xl p-4">
                <pre className="text-sm text-ink-300 whitespace-pre-wrap font-mono">
                  {selectedNews.prompt ? `请根据以下新闻撰写一期播客对话：\n\n新闻标题：${selectedNews.title}\n\n新闻摘要：${selectedNews.summary}\n\n${selectedNews.prompt}` : '请先设置提示词'}
                </pre>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowRawContentModal(false)}
                  className="px-4 py-2 bg-cream-200 text-ink-300 rounded-xl hover:bg-cream-300"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 预览逐字稿弹窗 */}
      <AnimatePresence>
        {showScriptModal && selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowScriptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[700px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-ink-300 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-sage" />
                  逐字稿预览
                </h2>
                <button onClick={() => setShowScriptModal(false)} className="p-2 hover:bg-cream-200 rounded-xl">
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-cream-200 rounded-xl p-4">
                <pre className="text-sm text-ink-300 whitespace-pre-wrap">
                  {selectedNews.script}
                </pre>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl"
                >
                  关闭
                </button>
                <button className="px-4 py-2 bg-accent-sage text-cream-100 rounded-xl hover:bg-accent-sage/90 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  编辑
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
