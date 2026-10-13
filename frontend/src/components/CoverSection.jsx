import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, RefreshCw, Download, Maximize2, Check, Loader2, X } from 'lucide-react'
import { updateEpisode } from '../mock/store'
import { mockGenerateCovers } from '../mock/api'
import { COVER_RATIOS, buildCoverSvg, coverDataUri, downloadCoverPng } from '../mock/cover'
import { useToast } from './Toast'

/**
 * 题图区块：根据本期素材生成公众号题图（mock：前端 SVG 拼装）
 * props: episode, episodeNews
 */
export default function CoverSection({ episode, episodeNews }) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const keywords = useMemo(
    () => [...new Set(episodeNews.flatMap((n) => n.keywords || []))].slice(0, 4),
    [episodeNews]
  )
  const variants = episode.coverVariants || []
  const cover = episode.cover || null
  const ratioKey = episode.coverRatio || 'mp'
  const ratio = COVER_RATIOS.find((r) => r.key === ratioKey) || COVER_RATIOS[0]

  const svgOf = (params) =>
    buildCoverSvg({ title: episode.title, keywords, ...params, ratioKey })

  const runGenerate = async () => {
    setGenerating(true)
    try {
      const list = await mockGenerateCovers()
      updateEpisode(episode.id, { coverVariants: list })
      toast.success('题图已生成，挑一版喜欢的')
    } finally {
      setGenerating(false)
    }
  }

  const selectCover = (v) => {
    updateEpisode(episode.id, { cover: { paletteIdx: v.paletteIdx, layout: v.layout } })
    toast.success('已选为本期题图')
  }

  const download = () => {
    if (!cover) return
    downloadCoverPng(svgOf(cover), ratioKey, `题图-${episode.title}.png`)
    toast.success('已开始下载（2x PNG）')
  }

  const selectedKey = cover ? `${cover.paletteIdx}-${cover.layout}` : null

  return (
    <section className="bg-cream-100 rounded-2xl border border-cream-300 shadow-[0_1px_3px_rgba(45,42,36,0.06)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-accent-sage" />
          <h2 className="text-base font-semibold text-ink-300">题图</h2>
          <span className="text-xs text-ink-50">发布公众号等社交平台时使用</span>
        </div>
        {(variants.length > 0 || cover) && !generating && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {COVER_RATIOS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => updateEpisode(episode.id, { coverRatio: r.key })}
                  className={`px-2.5 h-7 rounded-lg text-xs font-medium transition-colors ${
                    ratioKey === r.key
                      ? 'bg-ink-300 text-cream-100'
                      : 'bg-cream-200 text-ink-50 hover:bg-cream-300 border border-cream-300'
                  }`}
                >
                  {r.label.split(' · ')[1]}
                </button>
              ))}
            </div>
            <button
              onClick={runGenerate}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              换一批
            </button>
          </div>
        )}
      </div>

      {generating ? (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm text-accent-sky">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 正在构思画面…（约 5 秒）</span>
          </div>
          <div className="rounded-xl progress-shimmer" style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }} />
        </div>
      ) : variants.length === 0 ? (
        <div className="flex flex-col items-center py-10">
          <ImageIcon className={`w-12 h-12 mb-3 ${episodeNews.length > 0 ? 'text-cream-500' : 'text-cream-400'}`} />
          <p className="text-sm text-ink-50 mb-1">还没有题图</p>
          <p className="text-xs text-ink-50 mb-4">
            {episodeNews.length === 0 ? '先在左侧添加新闻' : '根据本期素材生成适配公众号的题图'}
          </p>
          <button
            onClick={runGenerate}
            disabled={episodeNews.length === 0}
            className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
          >
            生成题图
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 大图预览（未选定时用第一版占位） */}
          {(() => {
            const shown = cover || variants[0]
            return (
              <div className="relative group">
                <button
                  onClick={() => setLightbox(true)}
                  className="w-full rounded-xl overflow-hidden border border-cream-300 relative"
                  title="点击查看大图"
                >
                  <img
                    src={coverDataUri(svgOf(shown))}
                    alt="本期题图"
                    className="w-full block"
                    style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }}
                  />
                  <span className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/20 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-cream-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </button>
                {!cover && (
                  <span className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-ink-900/60 text-cream-100 text-xs">
                    预览 · 点下方选一版
                  </span>
                )}
              </div>
            )
          })()}

          {/* 变体选择 */}
          <div className="grid grid-cols-3 gap-3">
            {variants.map((v) => {
              const key = `${v.paletteIdx}-${v.layout}`
              const active = selectedKey === key
              return (
                <button
                  key={key}
                  onClick={() => selectCover(v)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    active ? 'border-accent-coral shadow-md' : 'border-cream-300 hover:border-cream-400'
                  }`}
                  title={v.label}
                >
                  <img
                    src={coverDataUri(svgOf(v))}
                    alt={v.label}
                    className="w-full block"
                    style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }}
                  />
                  {active && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-coral flex items-center justify-center">
                      <Check className="w-3 h-3 text-cream-100" />
                    </span>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-ink-900/55 text-cream-100 text-[10px]">
                    {v.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 操作行 */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-ink-50">
              {cover ? `已选定「${variants.find((v) => `${v.paletteIdx}-${v.layout}` === selectedKey)?.label || '当前版本'}」，可下载后上传到公众号` : '点选一版作为本期题图'}
            </p>
            <button
              onClick={download}
              disabled={!cover}
              className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              下载 PNG
            </button>
          </div>
        </div>
      )}

      {/* 大图灯箱 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(45,42,36,0.6)] p-8"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={coverDataUri(svgOf(cover || variants[0]))}
                alt="题图大图"
                className="w-full rounded-2xl shadow-2xl"
              />
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
                  disabled={!cover}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载 PNG
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
