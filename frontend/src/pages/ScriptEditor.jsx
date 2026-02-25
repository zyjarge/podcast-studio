import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Save,
  FileText,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  Loader2
} from 'lucide-react'

// 模拟逐字稿数据
const mockScripts = [
  {
    id: 1,
    newsTitle: 'Anthropic 推出智能体 AI 工具，针对投资银行和人力资源自动化',
    prompt: '请从AI工具对人力资源的影响以及整体社会发展方向进行讨论',
    content: `彪悍罗：各位听众朋友们大家好，欢迎来到科技双响炮！我是彪悍罗。
OK王：我是OK王，今天我们继续来聊聊科技圈的那些事儿。
彪悍罗：哎，OK王，你听说了吗？Anthropic最近推出了新的智能体AI工具，据说是专门针对投资银行和人力资源自动化的。
OK王：没错，这个确实很有意思。Anthropic这次的动作挺大的，他们不仅仅是做对话AI，而是直接切入了企业级应用场景。
彪悍罗：我觉得这对人力资源领域可能会有很大的影响。你想啊，以前提到HR的工作，大家想到的是什么？招聘、面试、绩效评估，这些都是需要大量人工处理的工作。
OK王：没错，但是现在AI可以帮你筛选简历、分析面试表现，甚至还能预测员工的离职风险。这确实会让很多HR的工作方式发生改变。
彪悍罗：不过我觉得最关键的还不是这些表面工作，而是更深层次的问题。如果AI可以完成大部分HR的工作，那人力资源这个岗位本身的价值在哪里？
OK王：这确实是个值得思考的问题。不过我觉得，AI更多是作为一个工具来辅助HR，而不是完全取代人类。人类的情感、创造力、还有对人性的理解，这些是AI短期内无法复制的。`,
    status: 'completed',
    speaker: 'luo',
    duration: '3:24',
    createdAt: '2026-02-25 10:30'
  },
  {
    id: 2,
    newsTitle: 'OpenAI GPT-5 即将发布，性能提升显著',
    prompt: '请分析GPT-5的技术进步和对行业的影响',
    content: `彪悍罗：说到AI，怎么能不提OpenAI呢？据说明年他们就要发布GPT-5了。
OK王：是的，据知情人士透露，GPT-5在性能上会有显著提升，特别是在推理能力和多模态方面。
彪悍罗：我觉得最让人期待的还是它的推理能力。你知道现在GPT-4虽然很强，但在一些复杂推理任务上还是会出错。
OK王：没错，如果GPT-5能在推理能力上有质的飞跃，那对整个AI行业来说都是一个大事件。`,
    status: 'completed',
    speaker: 'wang',
    duration: '2:15',
    createdAt: '2026-02-25 10:45'
  },
  {
    id: 3,
    newsTitle: '苹果 Vision Pro 2 配备 RGB LCOS 硅基液晶技术',
    prompt: '请讨论苹果在AR/VR领域的布局',
    content: null,
    status: 'pending',
    speaker: null,
    duration: null,
    createdAt: null
  },
  {
    id: 4,
    newsTitle: '英伟达发布新一代数据中心 GPU，AI 算力提升 3 倍',
    prompt: '请分析英伟达的技术优势和对AI发展的影响',
    content: null,
    status: 'generating',
    speaker: null,
    duration: null,
    createdAt: null
  },
  {
    id: 5,
    newsTitle: '马斯克 xAI 获得 60 亿美元融资，估值达 180 亿美元',
    prompt: '请讨论马斯克的AI野心和市场格局',
    content: null,
    status: 'pending',
    speaker: null,
    duration: null,
    createdAt: null
  },
]

const statusConfig = {
  pending: { label: '待生成', icon: Clock, color: 'ink-50', bgColor: 'bg-cream-300' },
  generating: { label: '生成中', icon: Loader2, color: 'accent-gold', bgColor: 'bg-accent-gold/20' },
  completed: { label: '已完成', icon: CheckCircle2, color: 'accent-sage', bgColor: 'bg-accent-sage/20' },
  error: { label: '生成失败', icon: AlertCircle, color: 'accent-coral', bgColor: 'bg-accent-coral/20' },
}

export default function ScriptEditor() {
  const [scripts, setScripts] = useState(mockScripts)
  const [expandedId, setExpandedId] = useState(1)
  const [editingContent, setEditingContent] = useState(null)
  const [copied, setCopied] = useState(null)

  const expandedScript = scripts.find(s => s.id === expandedId)

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
    setCopied(content.slice(0, 50))
    setTimeout(() => setCopied(null), 2000)
  }

  const handleEdit = (script) => {
    setEditingContent({ id: script.id, content: script.content })
  }

  const handleSaveEdit = (id) => {
    setScripts(scripts.map(s =>
      s.id === id ? { ...s, content: editingContent.content } : s
    ))
    setEditingContent(null)
  }

  const generateScript = (id) => {
    setScripts(scripts.map(s =>
      s.id === id ? { ...s, status: 'generating' } : s
    ))
    // 模拟生成过程
    setTimeout(() => {
      setScripts(scripts.map(s =>
        s.id === id ? { ...s, status: 'completed', content: '生成的逐字稿内容...' } : s
      ))
    }, 3000)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 左侧：逐字稿列表 */}
      <div className="w-1/2 border-r border-cream-400 flex flex-col">
        <div className="p-6 border-b border-cream-400">
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">逐字稿</h1>
          <p className="text-sm text-ink-50">编辑和管理每条新闻的逐字稿</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {scripts.map((script, index) => {
            const status = statusConfig[script.status]
            const StatusIcon = status.icon
            const isExpanded = expandedId === script.id

            return (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-cream-100 rounded-2xl border transition-all cursor-pointer ${
                  isExpanded ? 'border-accent-coral shadow-md' : 'border-cream-300 hover:border-cream-400'
                }`}
                onClick={() => setExpandedId(script.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-ink-50 bg-cream-200 px-2 py-0.5 rounded-lg">
                          #{index + 1}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                          <StatusIcon className={`w-3 h-3 inline mr-1 ${script.status === 'generating' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </span>
                      </div>
                      <h3 className="font-medium text-ink-300 line-clamp-2">{script.newsTitle}</h3>
                    </div>
                    {script.duration && (
                      <span className="text-sm text-ink-50 flex-shrink-0">{script.duration}</span>
                    )}
                  </div>

                  {script.prompt && (
                    <div className="mt-2 flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-accent-gold" />
                      <span className="text-xs text-ink-50 line-clamp-1">{script.prompt}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* 批量操作 */}
        <div className="p-4 border-t border-cream-400 bg-cream-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-50">
              已完成 <span className="font-medium text-accent-sage">2</span> / {scripts.length} 条
            </span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm bg-cream-300 text-ink-300 rounded-lg hover:bg-cream-400 transition-colors">
                全部生成
              </button>
              <button className="px-3 py-1.5 text-sm bg-accent-sage text-cream-100 rounded-lg hover:bg-accent-sage/90 transition-colors">
                生成全部
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：逐字稿详情 */}
      <div className="w-1/2 flex flex-col bg-cream-50">
        {expandedScript ? (
          <>
            <div className="p-6 border-b border-cream-400">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-sm text-ink-50">新闻来源</span>
                  <h2 className="font-display text-lg font-semibold text-ink-300">
                    {expandedScript.newsTitle}
                  </h2>
                </div>
                <div className="flex gap-2">
                  {expandedScript.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleCopy(expandedScript.content)}
                        className="p-2 bg-cream-200 rounded-xl hover:bg-cream-300 transition-colors"
                        title="复制"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-accent-sage" />
                        ) : (
                          <Copy className="w-4 h-4 text-ink-50" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(expandedScript)}
                        className="p-2 bg-cream-200 rounded-xl hover:bg-cream-300 transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4 text-ink-50" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 提示词展示 */}
              {expandedScript.prompt && (
                <div className="bg-cream-200 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-accent-gold" />
                    <span className="text-xs font-medium text-ink-300">预设提示词</span>
                  </div>
                  <p className="text-sm text-ink-50">{expandedScript.prompt}</p>
                </div>
              )}

              {/* 状态和操作 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {expandedScript.status === 'completed' && (
                    <>
                      <span className="text-xs text-ink-50">{expandedScript.createdAt}</span>
                      <span className="text-xs text-ink-50">{expandedScript.duration}</span>
                    </>
                  )}
                  {expandedScript.status === 'generating' && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className="w-1 bg-accent-gold rounded-full waveform-bar"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-accent-gold">AI 正在生成中...</span>
                    </div>
                  )}
                </div>

                {expandedScript.status === 'pending' && (
                  <button
                    onClick={() => generateScript(expandedScript.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    生成逐字稿
                  </button>
                )}

                {expandedScript.status === 'generating' && (
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-2 bg-cream-300 text-ink-50 rounded-xl font-medium cursor-not-allowed"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    生成中...
                  </button>
                )}

                {expandedScript.status === 'completed' && (
                  <button
                    onClick={() => generateScript(expandedScript.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-cream-200 text-ink-300 rounded-xl font-medium hover:bg-cream-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新生成
                  </button>
                )}
              </div>
            </div>

            {/* 逐字稿内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {expandedScript.status === 'completed' ? (
                editingContent ? (
                  <div className="space-y-4">
                    <textarea
                      value={editingContent.content}
                      onChange={(e) => setEditingContent({ ...editingContent, content: e.target.value })}
                      className="w-full h-[400px] px-4 py-3 bg-cream-100 border border-cream-400 rounded-xl text-sm text-ink-300 focus:outline-none focus:border-accent-coral resize-none font-mono leading-relaxed"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditingContent(null)}
                        className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleSaveEdit(expandedScript.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-sage text-cream-100 rounded-xl font-medium hover:bg-accent-sage/90 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        保存修改
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                    <pre className="whitespace-pre-wrap text-sm text-ink-300 font-body leading-relaxed">
                      {expandedScript.content}
                    </pre>
                  </div>
                )
              ) : expandedScript.status === 'generating' ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 mb-4 relative">
                    <div className="absolute inset-0 border-4 border-cream-300 rounded-full" />
                    <div className="absolute inset-0 border-4 border-accent-gold rounded-full border-t-transparent animate-spin" />
                  </div>
                  <p className="text-lg text-ink-300 mb-2">AI 正在撰写逐字稿</p>
                  <p className="text-sm text-ink-50">请稍候...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="w-16 h-16 text-cream-400 mb-4" />
                  <p className="text-lg text-ink-300 mb-2">等待生成</p>
                  <p className="text-sm text-ink-50">点击上方按钮生成逐字稿</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <FileText className="w-16 h-16 text-cream-400 mb-4" />
            <p className="text-lg text-ink-300">选择一个新闻查看逐字稿</p>
          </div>
        )}
      </div>
    </div>
  )
}
