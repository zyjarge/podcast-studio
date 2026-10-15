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
  StickyNote,
  Check,
  Minus,
  Loader2,
  Newspaper,
  BadgeCheck,
  Sparkles,
  X,
  Download,
  Music,
  PenLine,
} from 'lucide-react'
import {
  episodesApi,
  newsApi,
  humanizeError,
  joinEpisodeNews,
  parseJsonField,
  episodeAudioUrl,
  ApiError,
} from '../services/api'
import { safeFilename } from '../lib/download'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import CoverSection from '../components/CoverSection'
import ArticlePanel from '../components/ArticlePanel'
import PoolBrowser from '../components/PoolBrowser'

const countChars = (text) => (text || '').replace(/\s/g, '').length

function parseScript(text) {
  const parts = (text || '').split(/\*\*(彪悍罗|OK王)：\*\*/g)
  const turns = []
  for (let i = 1; i < parts.length; i += 2) {
    turns.push({ speaker: parts[i], text: (parts[i + 1] || '').trim() })
  }
  return turns
}

/** 音频生成阶段 → 进度条文案/百分比（措辞见 doc/UX_COPY.md 3.2） */
const AUDIO_STAGE_MAP = {
  starting: { label: '正在准备…', base: 3 },
  parsing: { label: '正在解析逐字稿…', base: 10 },
  submitting: { label: '正在提交配音任务', from: 10, to: 20, dynamic: true },
  processing: { label: '配音生成中…（这个步骤最久，可以离开页面）', from: 20, to: 78 },
  downloading: { label: '正在下载音频片段…', from: 78, to: 90 },
  merging: { label: '正在合并成完整节目…', base: 97 },
  done: { label: '搞定，可以试听了 🎧', base: 100 },
}

const AUDIO_IN_FLIGHT = ['starting', 'parsing', 'submitting', 'processing', 'downloading', 'merging']

function mapAudioProgress(p) {
  const conf = AUDIO_STAGE_MAP[p?.stage] || { label: p?.message || '正在准备…', base: 0 }
  let percent = conf.base ?? 0
  if (conf.from != null) {
    const frac = p?.total > 0 ? Math.min(1, (p.completed || 0) / p.total) : 0
    percent = Math.round(conf.from + (conf.to - conf.from) * frac)
  }
  let label = conf.label
  if (conf.dynamic) label = p?.total > 0 ? `${conf.label}（${p.total} 段）…` : `${conf.label}…`
  return { stage: p?.stage || '', label, percent }
}

/** 标题仍是默认的"科技双响炮 · M月D日"格式时，认为用户未自定义标题 */
const isDefaultTitle = (title) => /^科技双响炮 · \d{1,2}月\d{1,2}日$/.test(title || '')

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

// ── 真实播放器：<audio controls> 播放后端合成的 MP3，样式贴原型卡片 ──
function AudioPlayer({ src, onDuration }) {
  return (
    <div className="bg-cream-200 rounded-2xl border border-cream-300 p-4">
      <audio
        controls
        preload="metadata"
        src={src}
        className="w-full"
        onLoadedMetadata={(e) => onDuration?.(Math.round(e.currentTarget.duration) || 0)}
      />
    </div>
  )
}

export default function EpisodeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  // 服务端数据
  const [episode, setEpisode] = useState(null)
  const [epNewsList, setEpNewsList] = useState([]) // EpisodeNews[]（含 EpisodeNews.id / order / notes）
  const [newsById, setNewsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [ep, epNews, allNews] = await Promise.all([
        episodesApi.get(id),
        episodesApi.listNews(id),
        newsApi.list({ limit: 200 }),
      ])
      setEpisode(ep)
      setEpNewsList(epNews)
      setNewsById(Object.fromEntries(allNews.map((n) => [n.id, n])))
      // 进入选料模式：URL 带了 picker=1（新建节目跳转），或节目还没有素材
      // （从闭包读 searchParams：StrictMode 下 load 会跑两次，两次读到的都是导航时的快照，不会互相覆盖）
      setPicking(searchParams.get('picker') === '1' || epNews.length === 0)
    } catch (e) {
      setLoadError(humanizeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 节目新闻（按 order 排序，join 全量新闻得到正文/评分）
  const episodeNews = useMemo(() => {
    const sorted = [...epNewsList].sort((a, b) => a.order - b.order)
    return joinEpisodeNews(sorted, newsById)
  }, [epNewsList, newsById])
  const newsIds = useMemo(() => episodeNews.map((n) => n.id), [episodeNews])

  /** 局部更新节目字段（PUT 成功后同步本地状态） */
  const patchEpisode = async (patch, { silent = false } = {}) => {
    try {
      const updated = await episodesApi.update(id, patch)
      setEpisode(updated)
      if (!silent) toast.success('已保存')
      return updated
    } catch (e) {
      toast.error(`保存失败：${humanizeError(e)}。你的内容还在编辑框里，不会丢失`)
      return null
    }
  }

  /** 重新拉取节目内新闻列表（增删/排序/撤销后同步） */
  const refreshEpisodeNews = async () => {
    try {
      setEpNewsList(await episodesApi.listNews(id))
    } catch (e) {
      toast.error(humanizeError(e))
    }
  }

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

  // 选料模式：右栏整个区域变为新闻池浏览，点选即加入/移出
  const [picking, setPicking] = useState(false)
  const [pendingPicks, setPendingPicks] = useState(() => new Set())
  // picker=1 是一次性入口参数： load() 据此进入选料模式，这里负责进模式 + 清掉参数
  useEffect(() => {
    if (searchParams.get('picker') === '1') {
      setPicking(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // 逐字稿
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [scriptStage, setScriptStage] = useState('')
  const [scriptEditing, setScriptEditing] = useState(false)
  const [scriptDraft, setScriptDraft] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)

  // 内容 tab：逐字稿 | 图文正文
  const [contentTab, setContentTab] = useState('script')
  const [articleGenerating, setArticleGenerating] = useState(false)

  // 音频
  const [audioGenerating, setAudioGenerating] = useState(false)
  const [audioProgress, setAudioProgress] = useState({ stage: '', label: '', percent: 0 })
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioVersion, setAudioVersion] = useState(0) // 重新生成后 bump，避免浏览器缓存旧 MP3
  const pollRef = useRef(null)
  // 只在本次页面生命周期内见过"进行中"时，done/error 才弹 toast 并刷新——
  // 避免打开一期早就生成完的节目时误报"音频已生成"
  const sawInFlightRef = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // 轮询一次音频进度；进行中会刷新进度条，done/error 且本次见过进行中时才收尾提示
  const tickAudio = async () => {
    try {
      const raw = await episodesApi.getAudioProgress(id)
      if (AUDIO_IN_FLIGHT.includes(raw.stage)) {
        sawInFlightRef.current = true
        setAudioGenerating(true)
        setAudioProgress(mapAudioProgress(raw))
        return
      }
      if (raw.stage === 'done') {
        stopPolling()
        if (sawInFlightRef.current) {
          sawInFlightRef.current = false
          setAudioProgress(mapAudioProgress(raw))
          setAudioGenerating(false)
          setAudioVersion((v) => v + 1)
          // 音频落库后刷新 episode（拿到 audio_url）
          const ep = await episodesApi.get(id).catch(() => null)
          if (ep) setEpisode(ep)
          toast.success('音频已生成，可以试听了')
        }
      } else if (raw.stage === 'error') {
        stopPolling()
        if (sawInFlightRef.current) {
          sawInFlightRef.current = false
          setAudioGenerating(false)
          toast.error(`合成失败：${raw.error || '未知原因'}，请重试`)
        }
      } else {
        // idle：无事发生，停轮询
        stopPolling()
      }
    } catch {
      // 轮询失败（后端短暂不可达）不打断，下个 tick 再试
    }
  }

  const startAudioPolling = () => {
    stopPolling()
    pollRef.current = setInterval(tickAudio, 2000)
  }

  // 进入页面先查一次：进行中则恢复进度条并持续轮询
  useEffect(() => {
    if (!episode) return
    sawInFlightRef.current = false
    tickAudio()
    startAudioPolling()
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episode?.id])

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-coral mb-3" />
        <p className="text-sm text-ink-50">正在读取节目…</p>
      </div>
    )
  }

  if (loadError || !episode) {
    return (
      <div className="p-8 min-h-screen flex flex-col items-center justify-center">
        <Newspaper className="w-12 h-12 text-cream-500 mb-3" />
        <p className="text-ink-50 mb-4">{loadError || '这期节目不存在，可能已被删除'}</p>
        <div className="flex items-center gap-3">
          {loadError && (
            <button
              onClick={load}
              className="px-5 h-10 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
            >
              重试
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90"
          >
            返回节目列表
          </button>
        </div>
      </div>
    )
  }

  const chars = countChars(episode.script)
  const estMinutes = Math.ceil(chars / 150)
  const published = episode.status === 'published'
  const hasAudio = Boolean(episode.audio_url)
  const audioUrl = `${episodeAudioUrl(id)}${audioVersion ? `?v=${audioVersion}` : ''}`
  const titleSuggestions = parseJsonField(episode.title_suggestions, [])

  // 选料任务栏的体量估计：素材正文字数 ×3 ≈ 逐字稿体量，150 字/分钟（沿用原抽屉的估计口径）
  const pickedChars = episodeNews.reduce((sum, n) => sum + countChars(n.content), 0)
  const pickedMinutes = pickedChars > 0 ? Math.max(5, Math.ceil((pickedChars * 3) / 150)) : 0

  const saveTitle = () => {
    const v = titleDraft.trim()
    if (v && v !== episode.title) {
      patchEpisode({ title: v })
    } else {
      setTitleDraft(episode.title)
    }
  }

  // AI 标题建议：随逐字稿产出；标题还是默认格式时自动展开面板
  const loadTitles = async (autoOpen = false) => {
    if (episodeNews.length === 0) return
    if (autoOpen) setTitlePanelOpen(true)
    setTitleLoading(true)
    try {
      const { titles } = await episodesApi.generateTitles(id)
      setEpisode((ep) => ({ ...ep, title_suggestions: JSON.stringify(titles || []) }))
      setTitleUnread(!autoOpen)
    } catch (e) {
      toast.error(`生成失败：${humanizeError(e)}`)
      if (autoOpen) setTitlePanelOpen(false)
    } finally {
      setTitleLoading(false)
    }
  }

  const applyTitleSuggestion = (s) => {
    patchEpisode({ title: s.text })
    setTitleDraft(s.text)
    setAppliedTitle(s.text)
    setTitleUnread(false)
    toast.success('已更新标题')
  }

  const saveDate = () => {
    if (dateDraft && dateDraft !== (episode.scheduled_date || '').slice(0, 10)) {
      patchEpisode({ scheduled_date: new Date(`${dateDraft}T12:00:00`).toISOString() })
    }
  }

  const saveNotes = () => {
    if (notesDraft !== (episode.notes || '')) {
      patchEpisode({ notes: notesDraft })
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = newsIds.indexOf(active.id)
    const newIndex = newsIds.indexOf(over.id)
    const nextIds = arrayMove(newsIds, oldIndex, newIndex)
    // 乐观更新本地顺序，再持久化（reorder 的 id 是 EpisodeNews 的 id）
    setEpNewsList((list) => {
      const byNewsId = Object.fromEntries(list.map((en) => [en.news_id, en]))
      return nextIds.map((nid, i) => ({ ...byNewsId[nid], order: i }))
    })
    const orders = nextIds.map((nid, i) => {
      const en = epNewsList.find((x) => x.news_id === nid)
      return { id: en.id, order: i }
    })
    episodesApi.reorderNews(id, orders).catch(async (e) => {
      toast.error(humanizeError(e))
      await refreshEpisodeNews()
    })
  }

  const handleRemoveNews = async (newsId) => {
    const snapshot = epNewsList.find((en) => en.news_id === newsId)
    setEpNewsList((list) => list.filter((en) => en.news_id !== newsId))
    try {
      await episodesApi.softDeleteNews(id, newsId)
      toast.undo('已移除该新闻', async () => {
        try {
          await episodesApi.restoreNews(id, newsId)
          await refreshEpisodeNews()
        } catch (e) {
          toast.error(humanizeError(e))
        }
      })
    } catch (e) {
      // 失败则还原
      if (snapshot) setEpNewsList((list) => [...list, snapshot].sort((a, b) => a.order - b.order))
      toast.error(humanizeError(e))
    }
  }

  /** 选料模式点选：未加入 → 立即加入节目；已加入 → 移出（复用软删除 + 撤销） */
  const handleTogglePick = async (newsItem) => {
    const newsId = newsItem.id
    if (pendingPicks.has(newsId)) return
    if (epNewsList.some((en) => en.news_id === newsId)) {
      handleRemoveNews(newsId)
      return
    }
    setPendingPicks((s) => new Set(s).add(newsId))
    try {
      await episodesApi.addNews(id, [newsId])
      await refreshEpisodeNews()
      toast.success('已加入')
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setPendingPicks((s) => {
        const next = new Set(s)
        next.delete(newsId)
        return next
      })
    }
  }

  const runGenerateScript = async () => {
    setConfirmRegen(false)
    setScriptGenerating(true)
    setScriptStage('正在阅读素材…')
    setScriptEditing(false)
    // 真实生成是单个长请求（约 30-60 秒），阶段文案按节奏切换
    const stageTimer = setTimeout(() => setScriptStage('正在撰写对话…'), 5000)
    try {
      const { script } = await episodesApi.generateScript(id, episode.notes || '')
      setEpisode((ep) => ({ ...ep, script }))
      toast.success(`逐字稿已生成，共 ${countChars(script).toLocaleString('zh-CN')} 字`)
      // 标题建议随稿产出（不阻塞主流程）
      loadTitles(isDefaultTitle(episode.title))
    } catch (e) {
      toast.error(`生成失败：${humanizeError(e)}。素材和备注都还在，点击重试。`)
    } finally {
      clearTimeout(stageTimer)
      setScriptGenerating(false)
      setScriptStage('')
    }
  }

  const runGenerateAudio = async () => {
    setAudioGenerating(true)
    setAudioProgress({ stage: 'starting', label: '正在准备…', percent: 0 })
    sawInFlightRef.current = true
    // 重启轮询（之前的轮询可能已在 done/error/idle 时停掉）
    startAudioPolling()
    try {
      await episodesApi.generateAudio(id)
      // 立即查一次进度，不等下一个 tick
      tickAudio()
    } catch (e) {
      // 409 = 后端已有任务在跑：视为进行中，继续轮询即可
      if (!(e instanceof ApiError && e.status === 409)) {
        sawInFlightRef.current = false
        setAudioGenerating(false)
        toast.error(`合成失败：${humanizeError(e)}`)
      }
    }
  }

  const handlePublish = () => {
    patchEpisode({ status: 'published' }, { silent: true }).then((updated) => {
      if (updated) toast.success('已发布 🎉')
    })
  }

  const formatDuration = (sec) => {
    const m = Math.floor((sec || 0) / 60)
    const s = Math.round((sec || 0) % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // MP3 128kbps ≈ 0.96 MB/分钟，用于导出卡片的大小预估
  const estSizeMB = audioDuration ? Math.max(1, Math.round(audioDuration * 0.016)) : 0

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
                if (next && titleSuggestions.length === 0) loadTitles(false)
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
                        {titleSuggestions.map((s) => {
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

          {/* 节目备注（会随素材一起发给 AI） */}
          <div className="mt-3">
            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className="w-full flex items-center justify-between group"
            >
              <span className="flex items-center gap-1.5 text-xs text-ink-50 group-hover:text-ink-300 transition-colors">
                <StickyNote className="w-3.5 h-3.5 text-accent-gold" />
                节目备注
                {episode.notes && !notesOpen && (
                  <span className="truncate max-w-[200px] text-ink-50/70">— {episode.notes}</span>
                )}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-ink-50 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
              />
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
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={saveNotes}
                    rows={3}
                    placeholder="本期想强调的角度，会随素材一起发给 AI"
                    className="mt-2 w-full px-3 py-2 bg-cream-100 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral resize-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
            {stagePill(hasAudio, '音频')}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {episodeNews.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <Newspaper className="w-12 h-12 text-cream-500 mb-3" />
              <p className="text-sm text-ink-50 mb-4">先在右侧点选新闻，AI 才能开始写稿</p>
              <button
                onClick={() => setPicking(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新闻
              </button>
            </div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={newsIds} strategy={verticalListSortingStrategy}>
                  {episodeNews.map((n, i) => (
                    <SortableNewsCard
                      key={n.id}
                      id={n.id}
                      index={i}
                      news={n}
                      note={n.note}
                      expanded={expandedId === n.id}
                      onToggle={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      onSaveNote={async (note) => {
                        // 先本地生效，再持久化
                        setEpNewsList((list) =>
                          list.map((en) => (en.news_id === n.id ? { ...en, notes: note } : en))
                        )
                        try {
                          await episodesApi.updateNewsNotes(id, n.id, note)
                          toast.success('已保存')
                        } catch (e) {
                          toast.error(`保存失败：${humanizeError(e)}。你的内容还在编辑框里，不会丢失`)
                        }
                      }}
                      onRemove={() => handleRemoveNews(n.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <button
                onClick={() => setPicking(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed border-cream-400 text-sm text-ink-50 hover:text-ink-300 hover:border-cream-500 hover:bg-cream-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新闻
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 右栏：选料模式 = 新闻池浏览；否则 = 工作区（宽屏时分为 内容列 | 产出列 两列） ── */}
      {picking ? (
        <div className="flex-1 min-w-0 px-6 pb-6">
          {/* 选料任务栏：吸顶，随时可收尾回工作区 */}
          <div className="sticky top-0 z-20 -mx-6 px-6 pt-5 pb-3 bg-cream-100">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-cream-300 bg-cream-200 px-4 py-3 shadow-[0_1px_3px_rgba(45,42,36,0.06)]">
              <Newspaper className="w-4 h-4 text-accent-coral shrink-0" />
              <p className="flex-1 min-w-0 text-sm text-ink-300 truncate">
                正在为「<span className="font-medium">{episode.title}</span>」选料
                <span className="text-ink-50">
                  {' '}· 已选 {episodeNews.length} 条
                  {pickedChars > 0 &&
                    ` · 约 ${pickedChars.toLocaleString('zh-CN')} 字 · 预计 ${pickedMinutes} 分钟`}
                </span>
              </p>
              <button
                onClick={() => setPicking(false)}
                disabled={episodeNews.length === 0}
                title={episodeNews.length === 0 ? '先点选几条新闻' : '回到工作区'}
                className="shrink-0 px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                完成选料
              </button>
            </div>
          </div>
          <PoolBrowser
            mode="embed"
            pickedIds={newsIds}
            pendingIds={[...pendingPicks]}
            onTogglePick={handleTogglePick}
          />
        </div>
      ) : (
      <div className="flex-1 min-w-0 p-6">
        <div className="mx-auto w-full max-w-[1440px] grid grid-cols-1 min-[1600px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 items-start">
          <div className="space-y-5 min-w-0">
        {/* 内容区：逐字稿 / 图文正文 */}
        <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-cream-200 border border-cream-300 rounded-xl p-1">
                <button
                  onClick={() => setContentTab('script')}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
                    contentTab === 'script'
                      ? 'bg-cream-100 text-ink-300 shadow-sm'
                      : 'text-ink-50 hover:text-ink-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  逐字稿
                </button>
                <button
                  onClick={() => setContentTab('article')}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
                    contentTab === 'article'
                      ? 'bg-cream-100 text-ink-300 shadow-sm'
                      : 'text-ink-50 hover:text-ink-300'
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" />
                  图文正文
                  {articleGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-sky" />}
                </button>
              </div>
              {contentTab === 'script' && episode.script && !scriptGenerating && (
                <span className="text-xs text-ink-50">
                  约 {chars.toLocaleString('zh-CN')} 字 · 预计 {estMinutes} 分钟
                </span>
              )}
            </div>
            {contentTab === 'script' && (
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
            )}
          </div>

          {contentTab === 'article' ? (
            <ArticlePanel
              episode={episode}
              episodeNews={episodeNews}
              onGeneratingChange={setArticleGenerating}
              onEpisodeChange={setEpisode}
            />
          ) : scriptGenerating ? (
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
                  onClick={async () => {
                    const updated = await patchEpisode({ script: scriptDraft })
                    if (updated) setScriptEditing(false)
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
                {episodeNews.length === 0 ? '先点「添加新闻」挑好素材' : '素材就绪，可以开始写稿了'}
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
          </div>

          {/* 产出列：音频 + 题图（≥1600px 宽屏时固定右栏 sticky） */}
          <div className="space-y-5 min-w-0 self-start w-full min-[1600px]:sticky min-[1600px]:top-6">
        {/* 音频 */}
        <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-accent-coral" />
              <h2 className="text-base font-semibold text-ink-300">音频</h2>
            </div>
            {hasAudio && !audioGenerating && (
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
          ) : hasAudio ? (
            <div className="space-y-4">
              <AudioPlayer src={audioUrl} onDuration={setAudioDuration} />
              {/* 导出卡片 */}
              <div className="rounded-xl border border-cream-300 bg-cream-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent-coral/15 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-accent-coral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-300 truncate">{safeFilename(episode.title)}.mp3</p>
                    <p className="text-xs text-ink-50">
                      {audioDuration ? `${formatDuration(audioDuration)} · 约 ${estSizeMB} MB · MP3` : 'MP3'}
                    </p>
                  </div>
                  <a
                    href={audioUrl}
                    download={`${safeFilename(episode.title)}.mp3`}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-ink-300 text-cream-100 text-sm font-medium hover:bg-ink-200 transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出音频
                  </a>
                </div>
                <p className="text-xs text-ink-50 mt-2">可直接上传到公众号、小宇宙、喜马拉雅等平台</p>
              </div>
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
        <CoverSection episode={episode} episodeNews={episodeNews} onEpisodeChange={setEpisode} />
          </div>
        </div>
      </div>
      )}

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
        onConfirm={async () => {
          setConfirmDeleteAudio(false)
          try {
            await episodesApi.deleteAudio(id)
            setEpisode((ep) => ({ ...ep, audio_url: '' }))
            setAudioDuration(0)
            toast.success('已删除音频')
          } catch (e) {
            toast.error(humanizeError(e))
          }
        }}
        onCancel={() => setConfirmDeleteAudio(false)}
      />
    </div>
  )
}
