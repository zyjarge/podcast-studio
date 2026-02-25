import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Play,
  Clock,
  CheckCircle2,
  Edit3,
  Calendar,
  ChevronRight,
  X,
  FileText,
  Volume2
} from 'lucide-react'

// 模拟节目数据
const mockEpisodes = [
  {
    id: 1,
    title: '2026年2月25日 - AI 助手的进化之路',
    status: 'draft',
    createdAt: '2026-02-25 10:00',
    publishedAt: null,
    newsCount: 5,
    completedNewsCount: 3,
    totalDuration: '15:30'
  },
  {
    id: 2,
    title: '2026年2月24日 - 科技巨头最新动态',
    status: 'published',
    createdAt: '2026-02-24 09:00',
    publishedAt: '2026-02-24 20:00',
    newsCount: 8,
    completedNewsCount: 8,
    totalDuration: '22:15'
  },
  {
    id: 3,
    title: '2026年2月23日 - 智能硬件的未来',
    status: 'editing',
    createdAt: '2026-02-23 14:00',
    publishedAt: null,
    newsCount: 6,
    completedNewsCount: 0,
    totalDuration: '--:--'
  },
]

const statusConfig = {
  draft: { label: '草稿', color: 'accent-gold', icon: FileText },
  editing: { label: '编辑中', color: 'accent-sky', icon: Edit3 },
  published: { label: '已发布', color: 'accent-sage', icon: CheckCircle2 },
}

export default function EpisodeList() {
  const [episodes, setEpisodes] = useState(mockEpisodes)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('')
  const navigate = useNavigate()

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const handleCreateEpisode = () => {
    if (!newEpisodeTitle.trim()) return

    const newEpisode = {
      id: Date.now(),
      title: newEpisodeTitle,
      status: 'draft',
      createdAt: new Date().toLocaleString('zh-CN'),
      publishedAt: null,
      newsCount: 0,
      completedNewsCount: 0,
      totalDuration: '--:--'
    }

    setEpisodes([newEpisode, ...episodes])
    setNewEpisodeTitle('')
    setShowCreateModal(false)

    // 跳转到新创建的节目
    navigate(`/episode/${newEpisode.id}`)
  }

  const getProgress = (episode) => {
    if (episode.newsCount === 0) return 0
    return Math.round((episode.completedNewsCount / episode.newsCount) * 100)
  }

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-ink-50 text-sm mb-1">{today}</p>
          <h1 className="font-display text-3xl font-semibold text-ink-300">
            节目管理
          </h1>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          新建节目
        </motion.button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">全部节目</p>
          <p className="text-3xl font-display font-semibold text-ink-300">{episodes.length}</p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">草稿</p>
          <p className="text-3xl font-display font-semibold text-accent-gold">
            {episodes.filter(e => e.status === 'draft').length}
          </p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">编辑中</p>
          <p className="text-3xl font-display font-semibold text-accent-sky">
            {episodes.filter(e => e.status === 'editing').length}
          </p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-5 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">已发布</p>
          <p className="text-3xl font-display font-semibold text-accent-sage">
            {episodes.filter(e => e.status === 'published').length}
          </p>
        </div>
      </div>

      {/* 节目列表 */}
      <div className="space-y-4">
        <AnimatePresence>
          {episodes.map((episode, index) => {
            const status = statusConfig[episode.status]
            const progress = getProgress(episode)
            const isComplete = episode.completedNewsCount === episode.newsCount && episode.newsCount > 0

            return (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className="bg-cream-100 rounded-2xl border border-cream-300 overflow-hidden hover:border-cream-400 transition-colors cursor-pointer"
                onClick={() => navigate(`/episode/${episode.id}`)}
              >
                <div className="flex items-stretch">
                  {/* 左侧：状态指示条 */}
                  <div className={`w-2 bg-${status.color}`} />

                  {/* 中间：内容 */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full bg-${status.color}/20 text-${status.color}`}>
                            {status.label}
                          </span>
                          {isComplete && (
                            <span className="text-xs px-2 py-1 rounded-full bg-accent-sage/20 text-accent-sage">
                              就绪
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-lg font-semibold text-ink-300">
                          {episode.title}
                        </h3>
                      </div>
                      <ChevronRight className="w-5 h-5 text-ink-50" />
                    </div>

                    {/* 元信息 */}
                    <div className="flex items-center gap-6 text-sm text-ink-50 mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        创建于 {episode.createdAt}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {episode.newsCount} 条新闻
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4" />
                        {episode.totalDuration}
                      </span>
                      {episode.publishedAt && (
                        <span className="flex items-center gap-1 text-accent-sage">
                          <CheckCircle2 className="w-4 h-4" />
                          发布于 {episode.publishedAt}
                        </span>
                      )}
                    </div>

                    {/* 进度条 */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-cream-300 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className={`h-full rounded-full ${
                            isComplete ? 'bg-accent-sage' : 'bg-accent-coral'
                          }`}
                        />
                      </div>
                      <span className="text-sm text-ink-50">
                        {episode.completedNewsCount} / {episode.newsCount} 条完成
                      </span>
                    </div>
                  </div>

                  {/* 右侧：操作 */}
                  <div className="w-32 bg-cream-200 flex flex-col items-center justify-center gap-2">
                    {episode.status === 'published' ? (
                      <button className="p-3 bg-accent-sage/20 rounded-full text-accent-sage hover:bg-accent-sage/30 transition-colors">
                        <Play className="w-5 h-5" />
                      </button>
                    ) : (
                      <button className="p-3 bg-cream-100 rounded-full text-ink-50 hover:bg-cream-300 transition-colors">
                        <Edit3 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* 新建节目弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">新建节目</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">节目标题</label>
                  <input
                    type="text"
                    value={newEpisodeTitle}
                    onChange={(e) => setNewEpisodeTitle(e.target.value)}
                    placeholder={`${new Date().toLocaleDateString('zh-CN')} - 科技播客`}
                    className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                  />
                </div>
                <div className="bg-cream-200 rounded-xl p-4">
                  <p className="text-sm text-ink-50">
                    创建后将进入节目编辑页面，你可以：
                  </p>
                  <ul className="mt-2 text-sm text-ink-50 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="text-accent-coral">1.</span> 从新闻池添加新闻
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent-coral">2.</span> 设置提示词并生成逐字稿
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent-coral">3.</span> 生成音频片段
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent-coral">4.</span> 整合并发布
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateEpisode}
                  className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
                >
                  创建并编辑
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
