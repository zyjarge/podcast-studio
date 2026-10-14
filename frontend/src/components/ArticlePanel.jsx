import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PenLine,
  RefreshCw,
  Copy,
  Download,
  Check,
  Loader2,
  Maximize2,
  X,
  Pencil,
} from 'lucide-react'
import { updateEpisode } from '../mock/store'
import { mockGenerateArticle } from '../mock/api'
import { ARTICLE_TEMPLATES, parseArticle, buildArticleImage, downloadArticlePng, coverDataUri } from '../mock/articleImage'
import { safeFilename } from '../mock/exporter'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'

/** 正文 Markdown 的轻量渲染（生成器输出是受控结构，无需完整 MD 解析器） */
function ArticlePreview({ md }) {
  const { title, blocks } = useMemo(() => parseArticle(md), [md])
  return (
    <div className="rounded-xl border border-cream-300 bg-white px-6 py-5">
      <h1 className="text-xl font-bold text-ink-300 leading-snug mb-4">{title}</h1>
      {blocks.map((b, i) => {
        if (b.type === 'lead')
          return <p key={i} className="text-sm text-ink-50 leading-relaxed mb-4">{b.text}</p>
        if (b.type === 'heading')
          return (
            <h3 key={i} className="flex items-center gap-2 text-base font-bold text-ink-300 mt-6 mb-3">
              <span className="w-1 h-5 rounded-full bg-accent-coral shrink-0" />
              {b.text}
            </h3>
          )
        if (b.type === 'quote')
          return (
            <blockquote key={i} className="my-4 px-4 py-3 rounded-xl bg-cream-200 border-l-4 border-accent-coral text-sm text-ink-300 font-medium leading-relaxed">
              「 {b.text} 」
            </blockquote>
          )
        if (b.type === 'footer')
          return <p key={i} className="text-xs text-ink-50 text-center mt-6 pt-4 border-t border-cream-300">{b.text}</p>
        return <p key={i} className="text-sm text-ink-300 leading-relaxed mb-3">{b.text}</p>
      })}
    </div>
  )
}

/**
 * 图文正文面板（逐字稿 tab 的并列内容）
 * props: episode, episodeNews, onGeneratingChange(bool)
 */
export default function ArticlePanel({ episode, episodeNews, onGeneratingChange }) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState('')
  const [view, setView] = useState('md') // 'md' | 'image'
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const article = episode.article
  const templateKey = episode.articleTemplate || 'magazine'
  const image = useMemo(
    () => (article ? buildArticleImage(article, templateKey) : null),
    [article, templateKey]
  )

  const setGen = (v) => {
    setGenerating(v)
    onGeneratingChange?.(v)
  }

  const runGenerate = async () => {
    setConfirmRegen(false)
    setEditing(false)
    setGen(true)
    setStage('正在提炼素材要点…')
    try {
      const md = await mockGenerateArticle(episodeNews, setStage)
      updateEpisode(episode.id, { article: md })
      toast.success(`图文正文已生成，共 ${md.replace(/\s/g, '').length.toLocaleString('zh-CN')} 字`)
    } finally {
      setGen(false)
      setStage('')
    }
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(article)
      toast.success('已复制 Markdown')
    } catch {
      toast.error('复制失败，请手动全选复制')
    }
  }

  const download = () => {
    downloadArticlePng(article, templateKey, `${safeFilename(episode.title)}-正文.png`)
    toast.success('已开始下载（1.5x PNG 长图）')
  }

  // ── 空态 / 生成中 ──
  if (generating) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-accent-sky">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{stage}</span>
          <span className="text-xs text-ink-50">生成中…（约 25 秒）</span>
        </div>
        <div className="space-y-3">
          {[70, 100, 88, 96, 60, 84].map((w, i) => (
            <div key={i} className="h-4 rounded-lg progress-shimmer" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center py-10">
        <PenLine className={`w-12 h-12 mb-3 ${episodeNews.length > 0 ? 'text-cream-500' : 'text-cream-400'}`} />
        <p className="text-sm text-ink-50 mb-1">还没有图文正文</p>
        <p className="text-xs text-ink-50 mb-4">
          {episodeNews.length === 0 ? '先在左侧添加新闻' : '基于左侧素材直接撰写，与逐字稿相互独立'}
        </p>
        <button
          onClick={runGenerate}
          disabled={episodeNews.length === 0}
          className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
        >
          生成图文正文
        </button>
      </div>
    )
  }

  // ── 已有正文 ──
  return (
    <div>
      {/* 工具行：视图切换 + 操作 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-cream-200 border border-cream-300 rounded-xl p-1">
          {[
            { key: 'md', label: 'Markdown' },
            { key: 'image', label: '图片' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
                view === v.key ? 'bg-cream-100 text-ink-300 shadow-sm' : 'text-ink-50 hover:text-ink-300'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'md' && !editing && (
            <>
              <button
                onClick={() => {
                  setEditDraft(article)
                  setEditing(true)
                }}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                编辑
              </button>
              <button
                onClick={copyMarkdown}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-ink-300 text-cream-100 text-sm font-medium hover:bg-ink-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                复制 Markdown
              </button>
            </>
          )}
          {view === 'image' && (
            <button
              onClick={download}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              下载 PNG
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setConfirmRegen(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新生成
            </button>
          )}
        </div>
      </div>

      {/* Markdown 视图 */}
      {view === 'md' &&
        (editing ? (
          <div>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 bg-cream-200 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral font-mono"
            />
            <div className="flex justify-end gap-3 mt-3">
              <button
                onClick={() => setEditing(false)}
                className="px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  updateEpisode(episode.id, { article: editDraft })
                  setEditing(false)
                  toast.success('已保存')
                }}
                className="px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <ArticlePreview md={article} />
        ))}

      {/* 图片视图 */}
      {view === 'image' && image && (
        <div className="space-y-4">
          {/* 模板选择 */}
          <div className="grid grid-cols-2 gap-3">
            {ARTICLE_TEMPLATES.map((tpl) => {
              const active = templateKey === tpl.key
              const thumb = buildArticleImage(article, tpl.key)
              return (
                <button
                  key={tpl.key}
                  onClick={() => updateEpisode(episode.id, { articleTemplate: tpl.key })}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                    active ? 'border-accent-coral shadow-md' : 'border-cream-300 hover:border-cream-400'
                  }`}
                >
                  <div className="h-28 overflow-hidden">
                    <img
                      src={coverDataUri(thumb.svg)}
                      alt={tpl.label}
                      className="w-full block"
                      style={{ objectFit: 'cover', objectPosition: 'top' }}
                    />
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-ink-900/55 text-cream-100 text-[10px]">
                    {tpl.label}
                  </span>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-coral flex items-center justify-center">
                      <Check className="w-3 h-3 text-cream-100" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 长图预览 */}
          <button
            onClick={() => setLightbox(true)}
            className="w-full rounded-xl overflow-hidden border border-cream-300 relative group"
            title="点击查看全尺寸"
          >
            <img src={coverDataUri(image.svg)} alt="正文长图" className="w-full block" />
            <span className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/15 transition-colors flex items-center justify-center">
              <Maximize2 className="w-6 h-6 text-cream-100 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </span>
          </button>
          <p className="text-xs text-ink-50">
            图片格式正文，版式所见即所得，可直接上传到公众号（约 {Math.round(image.h / 100) / 10}k px 高）
          </p>
        </div>
      )}

      {/* 全尺寸灯箱 */}
      <AnimatePresence>
        {lightbox && image && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(45,42,36,0.6)] p-8"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[78vh] overflow-y-auto rounded-2xl shadow-2xl">
                <img src={coverDataUri(image.svg)} alt="正文长图全尺寸" className="w-full block" />
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setLightbox(false)}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  关闭
                </button>
                <button
                  onClick={download}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载 PNG
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 覆盖正文确认 */}
      <ConfirmDialog
        open={confirmRegen}
        title="重新生成会覆盖现有正文"
        body="你对正文的手动修改将丢失。建议先复制保存需要保留的段落。"
        confirmText="覆盖并生成"
        onConfirm={runGenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  )
}
