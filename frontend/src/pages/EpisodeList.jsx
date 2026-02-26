import { useState, useEffect } from 'react'
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
  Volume2,
  Loader2,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { episodesApi } from '../services/api'

const statusConfig = {
  draft: { label: '草稿', color: 'accent-gold', icon: FileText },
  editing: { label: '编辑中', color: 'accent-sky', icon: Edit3 },
  published: { label: '已发布', color: 'accent-sage', icon: CheckCircle2 },
}

export default function EpisodeList() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ show: false, episode: null })
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchEpisodes()
  }, [])

  const fetchEpisodes = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await episodesApi.list()
      setEpisodes(data)
    } catch (err) {
      console.error('Failed to fetch episodes:', err)
      setError('加载节目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEpisode = async () => {
    const title = newEpisodeTitle.trim() || `${new Date().toLocaleDateString('zh-CN')} - 科技播客`
    
    try {
      setCreating(true)
      const title = newEpisodeTitle || `${new Date().toLocaleDateString('zh-CN')} - 科技播客`
      const newEpisode = await episodesApi.create({ title })
      setEpisodes([newEpisode, ...episodes])
      setNewEpisodeTitle('')
      setShowCreateModal(false)
      navigate(`/episode/${newEpisode.id}`)
    } catch (err) {
      console.error('Failed to create episode:', err)
      setError('创建节目失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteEpisode = async () => {
    if (!deleteModal.episode) return

    try {
      setDeleting(true)
      await episodesApi.delete(deleteModal.episode.id)
      setEpisodes(episodes.filter(e => e.id !== deleteModal.episode.id))
      setDeleteModal({ show: false, episode: null })
    } catch (err) {
      console.error('Failed to delete episode:', err)
      setError('删除节目失败')
    } finally {
      setDeleting(false)
    }
  }

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const getProgress = (episode) => {
    // 暂时返回 0，因为 EpisodeNews 关联还没查
    return 0
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-coral" />
      </div>
    )
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
          onClick={() => {
            setNewEpisodeTitle(`${new Date().toLocaleDateString('zh-CN')} - 科技播客`)
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-5 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          新建节目
        </motion.button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-600 rounded-xl">
          {error}
        </div>
      )}

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
        {episodes.length === 0 ? (
          <div className="text-center py-12 text-ink-50">
            暂无节目，点击"新建节目"开始创建
          </div>
        ) : (
          <AnimatePresence>
            {episodes.map((episode, index) => {
              const status = statusConfig[episode.status] || statusConfig.draft
              const progress = getProgress(episode)

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
                          创建于 {formatDate(episode.created_at)}
                        </span>
                        {episode.published_at && (
                          <span className="flex items-center gap-1 text-accent-sage">
                            <CheckCircle2 className="w-4 h-4" />
                            发布于 {formatDate(episode.published_at)}
                          </span>
                        )}
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
                      <button
                        className="p-3 bg-cream-100 rounded-full text-red-500 hover:bg-red-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteModal({ show: true, episode })
                        }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
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
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                  disabled={creating}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateEpisode}
                  disabled={creating}
                  className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建并编辑'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {deleteModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setDeleteModal({ show: false, episode: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[400px] shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="font-display text-xl font-semibold text-ink-300">确认删除</h2>
              </div>

              <p className="text-ink-50 mb-6">
                确定要删除节目 <strong className="text-ink-300">"{deleteModal.episode?.title}"</strong> 吗？此操作不可恢复。
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModal({ show: false, episode: null })}
                  disabled={deleting}
                  className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteEpisode}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
