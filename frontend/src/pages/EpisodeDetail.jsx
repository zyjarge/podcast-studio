import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Plus,
  GripVertical,
  ChevronDown,
  Trash2,
  FileText,
  Volume2,
  Pencil,
  RefreshCw,
  Play,
  Pause,
  StickyNote,
  Check,
  Minus,
  Loader2,
  Newspaper,
  BadgeCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useStore,
  updateEpisode,
  addNewsToEpisode,
  removeNewsFromEpisode,
  restoreNewsToEpisode,
  reorderEpisodeNews,
  setNewsNote,
  setEpisodeScript,
  setEpisodeAudio,
  publishEpisode,
  setTitleSuggestions,
} from '../mock/store'
import { mockGenerateScript, mockGenerateAudio, mockGenerateTitles } from '../mock/api'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import CoverSection from '../components/CoverSection'
import MaterialDrawer from '../components/MaterialDrawer'

const countChars = (text) => (text || '').replace(/\s/g, '').length

function parseScript(text) {
  const parts = (text || '').split(/\*\*(彪悍罗|OK王)：\*\*/g)
  const turns = []
  for (let i = 1; i < parts.length; i += 2) {
    turns.push({ speaker: parts[i], text: (parts[i + 1] || '').trim() })
  }
  return turns
}

const fmtTime = (sec) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── 可拖拽的新闻手风琴卡片 ──
function SortableNewsCard({ id, index, news, note, expanded, onToggle, onSaveNote, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [confirming, setConfirming] = useState(false)
  const [draftNote, setDraftNote] = useState(note || '')

  useEffect(() => setDraftNote(note || ''), [note])

  useEffect(() => {
    if (!expanded) setConfirming(false)
  }, [expanded])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-cream-500 hover:text-ink-50 touch-none"
          title="拖拽排序"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="w-5 h-5 rounded-full bg-cream-300 text-ink-50 text-xs flex items-center justify-center shrink-0 font-medium">
          {index + 1}
        </span>
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-ink-300 leading-snug line-clamp-2">{news.title}</p>
          <p className="text-xs text-ink-50 mt-0.5">
            {news.source} · {news.score} 分
          </p>
        </button>
        <ChevronDown
          className={`w-4 h-4 text-ink-50 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-cream-300/70 space-y-3">
              <p className="text-xs text-ink-50 leading-relaxed">{news.content}</p>
              <div>
                <label className="block text-xs text-ink-50 mb-1">素材备注（会随素材一起发给 AI）</label>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onBlur={() => {
                    if (draftNote.trim() !== (note || '')) onSaveNote(draftNote.trim())
                  }}
                  rows={2}
                  placeholder="这条素材想强调的角度…"
                  className="w-full px-3 py-2 bg-cream-200 border border-cream-300 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-accent-coral resize-none"
                />
              </div>
              <div className="flex justify-end">
                {confirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-50">从本期节目移除？</span>
                    <button
                      onClick={onRemove}
                      className="px-3 h-8 rounded-lg bg-[#C4574E] text-white text-xs font-medium hover:bg-[#C4574E]/90"
                    >
                      移除
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="px-3 h-8 rounded-lg bg-cream-200 border border-cream-300 text-xs text-ink-300 hover:bg-cream-300"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[#C4574E]/60 text-[#C4574E] text-xs font-medium hover:bg-[#C4574E] hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    移除
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 假播放器：定时器走进度 ──
function FakePlayer({ duration }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setProgress((p) => {
          if (p + 1 >= duration) {
            setPlaying(false)
            return duration
          }
          return p + 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, duration])

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="bg-cream-200 rounded-2xl border border-cream-300 p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            if (progress >= duration) setProgress(0)
            setPlaying(!playing)
          }}
          className="w-12 h-12 rounded-full bg-accent-coral text-cream-100 flex items-center justify-center hover:bg-accent-coral/90 transition-colors shadow-sm shrink-0"
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div
            className="h-1.5 rounded-full bg-cream-300 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
              setProgress(Math.round(ratio * duration))
            }}
          >
            <div
              className="h-full rounded-full bg-accent-coral transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-ink-50 font-mono">
            <span>{fmtTime(progress)}</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>
        {playing && (
          <div className="flex items-end gap-0.5 h-4 shrink-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="waveform-bar w-1 bg-accent-coral rounded-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function EpisodeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const { episodes, news } = useStore()

  const episode = episodes.find((e) => e.id === id)
  const episodeNews = useMemo(() => {
    if (!episode) return []
    return episode.newsIds.map((nid) => news.find((n) => n.id === nid)).filter(Boolean)
  }, [episode, news])

  // 内联编辑
  const [titleDraft, setTitleDraft] = useState('')
  const [dateDraft, setDateDraft] = useState('')
  useEffect(() => {
    if (episode) {
      setTitleDraft(episode.title)
      setDateDraft((episode.scheduled_date || '').slice(0, 10))
    }
  }, [episode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI 标题建议
  const [titlePanelOpen, setTitlePanelOpen] = useState(false)
  const [titleLoading, setTitleLoading] = useState(false)
  const [titleUnread, setTitleUnread] = useState(false)
  const [appliedTitle, setAppliedTitle] = useState('')
  useEffect(() => {
    setTitlePanelOpen(false)
    setTitleUnread(false)
    setAppliedTitle('')
  }, [episode?.id])

  // 备注
  const [notesOpen, setNotesOpen] = useState(true)
  const [notesDraft, setNotesDraft] = useState('')
  useEffect(() => {
    if (episode) setNotesDraft(episode.notes || '')
  }, [episode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 手风琴展开
  const [expandedId, setExpandedId] = useState(null)

  // 选料抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    if (searchParams.get('picker') === '1' && episode) {
      setDrawerOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, episode, setSearchParams])

  // 逐字稿
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [scriptStage, setScriptStage] = useState('')
  const [scriptEditing, setScriptEditing] = useState(false)
  const [scriptDraft, setScriptDraft] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)

  // 音频
  const [audioGenerating, setAudioGenerating] = useState(false)
  const [audioProgress, setAudioProgress] = useState({ stage: '', label: '', percent: 0 })
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  if (!episode) {
    return (
      <div className="p-8 min-h-screen flex flex-col items-center justify-center">
        <Newspaper className="w-12 h-12 text-cream-500 mb-3" />
        <p className="text-ink-50 mb-4">这期节目不存在，可能已被删除</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90"
        >
          返回节目列表
        </button>
      </div>
    )
  }

  const chars = countChars(episode.script)
  const estMinutes = Math.ceil(chars / 150)
  const published = episode.status === 'published'

  const saveTitle = () => {
    const v = titleDraft.trim()
    if (v && v !== episode.title) {
      updateEpisode(id, { title: v, titleCustom: true })
      toast.success('已保存')
    } else {
      setTitleDraft(episode.title)
    }
  }

  // AI 标题建议：随逐字稿产出；标题还没被确认过时自动展开面板
  const loadTitles = async (autoOpen = false) => {
    if (episodeNews.length === 0) return
    if (autoOpen) setTitlePanelOpen(true)
    setTitleLoading(true)
    try {
      const list = await mockGenerateTitles(episodeNews)
      setTitleSuggestions(id, list)
      setTitleUnread(!autoOpen)
    } finally {
      setTitleLoading(false)
    }
  }

  const applyTitleSuggestion = (s) => {
    updateEpisode(id, { title: s.text, titleCustom: true })
    setTitleDraft(s.text)
    setAppliedTitle(s.text)
    setTitleUnread(false)
    toast.success('已更新标题')
  }

  const saveDate = () => {
    if (dateDraft && dateDraft !== (episode.scheduled_date || '').slice(0, 10)) {
      updateEpisode(id, { scheduled_date: new Date(`${dateDraft}T12:00:00`).toISOString() })
      toast.success('已保存')
    }
  }

  const saveNotes = () => {
    if (notesDraft !== (episode.notes || '')) {
      updateEpisode(id, { notes: notesDraft })
      toast.success('已保存')
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = episode.newsIds.indexOf(active.id)
    const newIndex = episode.newsIds.indexOf(over.id)
    reorderEpisodeNews(id, arrayMove(episode.newsIds, oldIndex, newIndex))
  }

  const handleRemoveNews = (newsId) => {
    const snapshot = removeNewsFromEpisode(id, newsId)
    toast.undo('已移除该新闻', () => {
      restoreNewsToEpisode(id, snapshot)
    })
  }

  const handleAddNews = (newsIds) => {
    addNewsToEpisode(id, newsIds)
    toast.success(`已加入「${episode.title}」（${newsIds.length} 条）`)
  }

  const runGenerateScript = async () => {
    setConfirmRegen(false)
    setScriptGenerating(true)
    setScriptStage('正在阅读素材…')
    setScriptEditing(false)
    try {
      const script = await mockGenerateScript(episodeNews, setScriptStage)
      setEpisodeScript(id, script)
      toast.success(`逐字稿已生成，共 ${countChars(script).toLocaleString('zh-CN')} 字`)
      // 标题建议随稿产出（不阻塞主流程）
      loadTitles(!episode.titleCustom)
    } finally {
      setScriptGenerating(false)
      setScriptStage('')
    }
  }

  const runGenerateAudio = async () => {
    setAudioGenerating(true)
    setAudioProgress({ stage: 'starting', label: '正在准备…', percent: 0 })
    try {
      const audio = await mockGenerateAudio(episode.script, setAudioProgress)
      setEpisodeAudio(id, audio)
      toast.success('音频已生成，可以试听了')
    } finally {
      setAudioGenerating(false)
    }
  }

  const handlePublish = () => {
    publishEpisode(id)
    toast.success('已发布 🎉')
  }

  const stagePill = (done, label) => (
    <span className="inline-flex items-center gap-1">
      {done ? (
        <Check className="w-3.5 h-3.5 text-accent-sage" />
      ) : (
        <Minus className="w-3.5 h-3.5 text-cream-500" />
      )}
      {label}
    </span>
  )

  return (
    <div className="flex min-h-screen">
      {/* ── 左栏：素材管理 ── */}
      <div className="w-[400px] shrink-0 border-r border-cream-300 bg-cream-200/50 flex flex-col h-screen sticky top-0">
        <div className="p-5 border-b border-cream-300">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-ink-50 hover:text-ink-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回节目列表
          </button>
          <div className="flex items-center gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              className="flex-1 min-w-0 text-lg font-semibold text-ink-300 bg-transparent border border-transparent hover:border-cream-300 focus:border-accent-coral focus:bg-cream-100 rounded-lg px-2 py-1 -ml-2 focus:outline-none transition-colors"
            />
            <button
              onClick={() => {
                const next = !titlePanelOpen
                setTitlePanelOpen(next)
                setTitleUnread(false)
                if (next && (episode.titleSuggestions || []).length === 0) loadTitles(false)
              }}
              disabled={!episode.script}
              title={episode.script ? 'AI 标题建议' : '生成逐字稿后，AI 可以推荐标题'}
              className="relative shrink-0 p-2 rounded-lg text-ink-50 hover:text-accent-coral hover:bg-cream-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {titleUnread && !titlePanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-sky" />
              )}
            </button>
            {published && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-sage/15 text-accent-sage text-xs font-medium">
                <BadgeCheck className="w-3.5 h-3.5" />
                已发布
              </span>
            )}
          </div>

          {/* AI 标题建议面板 */}
          <AnimatePresence>
            {titlePanelOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-xl border border-cream-300 bg-cream-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-300">
                      <Sparkles className="w-3.5 h-3.5 text-accent-coral" />
                      AI 标题建议 · 基于本期内容
                    </span>
                    <button
                      onClick={() => setTitlePanelOpen(false)}
                      className="p-1 rounded-md hover:bg-cream-200 text-ink-50 hover:text-ink-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {titleLoading ? (
                    <div className="py-4 flex items-center justify-center gap-2 text-xs text-ink-50">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      AI 正在构思标题…
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {(episode.titleSuggestions || []).map((s) => {
                          const applied = appliedTitle === s.text && episode.title === s.text
                          return (
                            <button
                              key={s.text}
                              onClick={() => applyTitleSuggestion(s)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                                applied
                                  ? 'border-accent-sage bg-accent-sage/10'
                                  : 'border-cream-300 bg-cream-200 hover:border-accent-coral'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-cream-300 text-[10px] text-ink-50">
                                  {s.style}
                                </span>
                                {applied && <Check className="w-3.5 h-3.5 text-accent-sage" />}
                              </span>
                              <span className="block mt-1 text-xs text-ink-300 leading-relaxed">{s.text}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <button
                          onClick={() => loadTitles(false)}
                          className="inline-flex items-center gap-1 text-xs text-ink-50 hover:text-accent-coral transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          换一批
                        </button>
                        <button
                          onClick={() => setTitlePanelOpen(false)}
                          className="text-xs text-ink-50 hover:text-ink-300 transition-colors"
                        >
                          忽略
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-50">
            <span className="text-xs">播出日期</span>
            <input
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              onBlur={saveDate}
              className="bg-transparent border border-transparent hover:border-cream-300 focus:border-accent-coral focus:bg-cream-100 rounded-lg px-2 py-1 focus:outline-none text-sm text-ink-300 transition-colors"
            />
          </div>
          {/* 三阶段进度 */}
          <div className="mt-4 flex items-center gap-3 text-xs text-ink-50 bg-cream-200 rounded-xl border border-cream-300 px-3 py-2">
            <span className="inline-flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${episodeNews.length > 0 ? 'bg-accent-sage' : 'bg-cream-400'}`} />
              素材 {episodeNews.length} 条
            </span>
            <span className="text-cream-400">·</span>
            {stagePill(Boolean(episode.script), '逐字稿')}
            <span className="text-cream-400">·</span>
            {stagePill(Boolean(episode.audio), '音频')}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {episodeNews.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <Newspaper className="w-12 h-12 text-cream-500 mb-3" />
              <p className="text-sm text-ink-50 mb-4">先在左侧添加新闻，AI 才能开始写稿</p>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新闻
              </button>
            </div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={episode.newsIds} strategy={verticalListSortingStrategy}>
                  {episodeNews.map((n, i) => (
                    <SortableNewsCard
                      key={n.id}
                      id={n.id}
                      index={i}
                      news={n}
                      note={episode.newsNotes[n.id]}
                      expanded={expandedId === n.id}
                      onToggle={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      onSaveNote={(note) => {
                        setNewsNote(id, n.id, note)
                        toast.success('已保存')
                      }}
                      onRemove={() => handleRemoveNews(n.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed border-cream-400 text-sm text-ink-50 hover:text-ink-300 hover:border-cream-500 hover:bg-cream-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新闻
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 右栏：工作区 ── */}
      <div className="flex-1 min-w-0 p-8 space-y-5 max-w-4xl">
        {/* 节目备注 */}
        <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] overflow-hidden">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-accent-gold" />
              <h2 className="text-base font-semibold text-ink-300">节目备注</h2>
              {episode.notes && !notesOpen && (
                <span className="text-xs text-ink-50 truncate max-w-[300px]">— {episode.notes}</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-ink-50 transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {notesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={saveNotes}
                    rows={3}
                    placeholder="本期想强调的角度，会随素材一起发给 AI"
                    className="w-full px-4 py-3 bg-cream-200 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral resize-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 逐字稿 */}
        <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-sky" />
              <h2 className="text-base font-semibold text-ink-300">逐字稿</h2>
              {episode.script && !scriptGenerating && (
                <span className="text-xs text-ink-50">
                  约 {chars.toLocaleString('zh-CN')} 字 · 预计 {estMinutes} 分钟
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {episode.script && !scriptGenerating && (
                <>
                  <button
                    onClick={() => {
                      setScriptDraft(episode.script)
                      setScriptEditing(true)
                    }}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => setConfirmRegen(true)}
                    disabled={episodeNews.length === 0}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新生成
                  </button>
                </>
              )}
            </div>
          </div>

          {scriptGenerating ? (
            <div>
              <div className="flex items-center gap-2 mb-4 text-sm text-accent-sky">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{scriptStage}</span>
                <span className="text-xs text-ink-50">生成中…（约 30 秒）</span>
              </div>
              <div className="space-y-3">
                {[92, 100, 78, 96, 60, 88].map((w, i) => (
                  <div key={i} className="h-4 rounded-lg progress-shimmer" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ) : scriptEditing ? (
            <div>
              <textarea
                value={scriptDraft}
                onChange={(e) => setScriptDraft(e.target.value)}
                rows={16}
                className="w-full px-4 py-3 bg-cream-200 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral font-body"
              />
              <div className="flex justify-end gap-3 mt-3">
                <button
                  onClick={() => setScriptEditing(false)}
                  className="px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setEpisodeScript(id, scriptDraft)
                    setScriptEditing(false)
                    toast.success('已保存')
                  }}
                  className="px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          ) : episode.script ? (
            <div className="space-y-3">
              {parseScript(episode.script).map((turn, i) => (
                <div key={i} className={`flex ${turn.speaker === 'OK王' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 border ${
                      turn.speaker === '彪悍罗'
                        ? 'bg-cream-200 border-cream-300 rounded-tl-md'
                        : 'bg-white border-cream-300 rounded-tr-md'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold mb-1 ${
                        turn.speaker === '彪悍罗' ? 'text-accent-coral' : 'text-accent-sky'
                      }`}
                    >
                      {turn.speaker}
                    </p>
                    <p className="text-sm text-ink-300 leading-relaxed">{turn.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10">
              <FileText className="w-12 h-12 text-cream-500 mb-3" />
              <p className="text-sm text-ink-50 mb-1">还没有逐字稿</p>
              <p className="text-xs text-ink-50 mb-4">
                {episodeNews.length === 0 ? '先在左侧添加新闻' : '素材就绪，可以开始写稿了'}
              </p>
              <button
                onClick={runGenerateScript}
                disabled={episodeNews.length === 0}
                className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
              >
                生成逐字稿
              </button>
            </div>
          )}
        </section>

        {/* 音频 */}
        <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-accent-coral" />
              <h2 className="text-base font-semibold text-ink-300">音频</h2>
            </div>
            {episode.audio && !audioGenerating && (
              <button
                onClick={runGenerateAudio}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重新生成
              </button>
            )}
          </div>

          {audioGenerating ? (
            <div className="py-2">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ink-300">{audioProgress.label}</span>
                <span className="text-ink-50 font-mono">{audioProgress.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-cream-300 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    audioProgress.stage === 'done' ? 'bg-accent-sage' : 'bg-accent-sky'
                  }`}
                  style={{ width: `${audioProgress.percent}%` }}
                />
              </div>
              <p className="text-xs text-ink-50 mt-2">合成中… 耗时操作会持续推进，你可以先整理左侧的新闻列表</p>
            </div>
          ) : episode.audio ? (
            <div className="space-y-4">
              <FakePlayer duration={episode.audio.duration} />
              <div className="flex items-center gap-3">
                {published ? (
                  <span className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-accent-sage/15 text-accent-sage text-sm font-medium">
                    <BadgeCheck className="w-4 h-4" />
                    已发布
                  </span>
                ) : (
                  <button
                    onClick={handlePublish}
                    className="flex items-center gap-2 px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
                  >
                    <BadgeCheck className="w-4 h-4" />
                    标记发布
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteAudio(true)}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-white border border-[#C4574E] text-sm font-medium text-[#C4574E] hover:bg-[#C4574E] hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除音频
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <Volume2 className={`w-12 h-12 mb-3 ${episode.script ? 'text-cream-500' : 'text-cream-400'}`} />
              <p className="text-sm text-ink-50 mb-4">
                {episode.script ? '逐字稿就绪，可以合成音频了' : '逐字稿就绪后，在这里合成音频'}
              </p>
              <button
                onClick={runGenerateAudio}
                disabled={!episode.script}
                className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
              >
                生成音频
              </button>
            </div>
          )}
        </section>

        {/* 题图 */}
        <CoverSection episode={episode} episodeNews={episodeNews} />
      </div>

      {/* 选料抽屉 */}
      <MaterialDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        episodeId={id}
        onAdd={handleAddNews}
      />

      {/* 覆盖逐字稿确认 */}
      <ConfirmDialog
        open={confirmRegen}
        title="重新生成会覆盖现有逐字稿"
        body="你对逐字稿的手动修改将丢失。建议先复制保存需要保留的段落。"
        confirmText="覆盖并生成"
        onConfirm={runGenerateScript}
        onCancel={() => setConfirmRegen(false)}
      />

      {/* 删除音频确认 */}
      <ConfirmDialog
        open={confirmDeleteAudio}
        title="删除已生成的音频？"
        body="逐字稿会保留，删除后可以重新合成。"
        confirmText="删除"
        onConfirm={() => {
          setEpisodeAudio(id, null)
          setConfirmDeleteAudio(false)
          toast.success('已删除音频')
        }}
        onCancel={() => setConfirmDeleteAudio(false)}
      />
    </div>
  )
}
