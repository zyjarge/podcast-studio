import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  Check,
  Inbox,
  Filter,
  WifiOff,
  Flame,
} from 'lucide-react'
import { newsApi, sourcesApi, normalizeNews, humanizeError } from '../services/api'
import { DOMAINS, SCORE_SEGMENTS, classifyNews, domainStats } from '../lib/domains'
import { useToast } from './Toast'
import StarRating from './StarRating'

const DOMAIN_MAP = Object.fromEntries(DOMAINS.map((d) => [d.id, d]))

const SCORE_FILTERS = [
  { label: '全部', value: 0 },
  { label: '60+', value: 60 },
  { label: '75+', value: 75 },
  { label: '90+', value: 90 },
]

// 后端 created_at 是无时区的 UTC 时间（datetime.utcnow），补 Z 按 UTC 解析后再转本地时区显示
const parseUtc = (iso) => {
  const s = typeof iso === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? `${iso}Z` : iso
  return new Date(s)
}

const fmtNewsTime = (iso) => {
  const d = parseUtc(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 完整时间：2026年10月15日 14:26:03（本地时区） */
const fmtFullTime = (iso) => {
  const d = parseUtc(iso)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 新闻池浏览组件：今日热点全景 + 工具栏 + 来源筛选 + 列表视图。
 * 新闻池页（mode="page"）与节目页内嵌选料（mode="embed"）共用。
 * 卡片交互（两种模式一致）：单击 = 展开/收起全文；加入/移出待选点右上角勾选框。
 * - page：勾选进购物车（由 NewsPool 的浮条批量加入节目）
 * - embed：勾选后父组件立即加入/移出节目；pickedIds 内的卡片显示左侧红条
 *
 * props: mode, pickedIds, pendingIds（请求中的 news id，卡片置灰）, onTogglePick(newsItem)
 */
export default function PoolBrowser({ mode = 'page', pickedIds = [], pendingIds = [], onTogglePick }) {
  const toast = useToast()
  const [news, setNews] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fetching, setFetching] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [activeSources, setActiveSources] = useState(null) // null = 全选
  const [activeDomain, setActiveDomain] = useState(null) // null = 全部领域
  const [expandedIds, setExpandedIds] = useState(() => new Set()) // 单击展开全文的卡片
  const clickTimerRef = useRef(null) // 单击延迟执行，给"连点勾选"留窗口（两次单击不触发展开）

  useEffect(() => () => clearTimeout(clickTimerRef.current), [])

  const load = async () => {
    setLoadError('')
    try {
      const [newsList, sourceList] = await Promise.all([
        newsApi.list({ limit: 200 }),
        sourcesApi.list(),
      ])
      setNews(newsList.map(normalizeNews))
      setSources(sourceList)
    } catch (e) {
      setLoadError(humanizeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enabledSources = sources.filter((s) => s.enabled)
  const checkedSources = activeSources === null ? enabledSources.map((s) => s.name) : activeSources

  const toggleSource = (name) => {
    setActiveSources((cur) => {
      const base = cur === null ? enabledSources.map((s) => s.name) : cur
      const next = base.includes(name) ? base.filter((x) => x !== name) : [...base, name]
      return next.length === enabledSources.length ? null : next
    })
  }

  // 领域归类：每条新闻算一次，供筛选 / 徽章 / 总览卡片复用
  const domainById = useMemo(() => new Map(news.map((n) => [n.id, classifyNews(n)])), [news])
  const overview = useMemo(() => domainStats(news), [news])
  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds])

  const matchesKeyword = (n, k) =>
    n.title.toLowerCase().includes(k) ||
    n.summary.toLowerCase().includes(k) ||
    n.keywords.some((kw) => kw.toLowerCase().includes(k))

  // 列表视图：来源 ∩ 评分 ∩ 领域 ∩ 关键词，按评分倒序
  const filtered = useMemo(() => {
    return news
      .filter((n) => checkedSources.includes(n.source))
      .filter((n) => n.score >= minScore)
      .filter((n) => !activeDomain || domainById.get(n.id) === activeDomain)
      .filter((n) => {
        if (!keyword.trim()) return true
        return matchesKeyword(n, keyword.trim().toLowerCase())
      })
      .sort((a, b) => b.score - a.score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, checkedSources, minScore, activeDomain, domainById, keyword])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((n) => {
      if (!map.has(n.source)) map.set(n.source, [])
      map.get(n.source).push(n)
    })
    return [...map.entries()]
  }, [filtered])

  const handleFetch = async () => {
    if (fetching) return
    setFetching(true)
    try {
      const res = await newsApi.fetch()
      const added = res?.added ?? 0
      const failed = res?.failed_sources || []
      if (failed.length > 0) {
        toast.error(`抓取完成，但这些源失败了：${failed.join('、')}`)
      } else {
        toast.success(added > 0 ? `已抓取 ${added} 条新闻，已自动评分` : '新闻池已是最新')
      }
      await load()
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setFetching(false)
    }
  }

  const clearFilters = () => {
    setMinScore(0)
    setKeyword('')
    setActiveSources(null)
    setActiveDomain(null)
  }

  // 没有独立的"上次抓取"接口：用最新一条新闻的入库时间近似
  const lastFetchText = news.length > 0 ? fmtFullTime(news[0].created_at) : '从未'

  /** 新闻卡片：单击展开/收起全文，右上角勾选框加入/移出待选 */
  const renderCard = (n) => {
    const picked = pickedIds.includes(n.id)
    const pending = pendingSet.has(n.id)
    const expanded = expandedIds.has(n.id)
    const dm = DOMAIN_MAP[domainById.get(n.id)]

    const toggleExpand = () =>
      setExpandedIds((cur) => {
        const next = new Set(cur)
        if (next.has(n.id)) next.delete(n.id)
        else next.add(n.id)
        return next
      })

    // 单击延迟 250ms 再展开：用户连点右上角勾选框时，第一次点击挂起的计时器
    // 会被第二次点击挡掉（clickTimerRef 非空直接返回），不会触发展开/收起
    const handleCardClick = () => {
      if (pending || clickTimerRef.current) return
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        toggleExpand()
      }, 250)
    }

    // 勾选框是独立的添加入口，两种模式共用；点击不冒泡到卡片
    const pickButton = (
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (!pending) onTogglePick?.(n)
        }}
        disabled={pending}
        title={picked ? '移出待选' : '加入待选'}
        className={`absolute top-3 right-3 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
          picked
            ? 'bg-accent-coral border-accent-coral'
            : 'border-cream-400 bg-cream-100 hover:border-accent-coral'
        } ${pending ? 'opacity-60 cursor-wait' : ''}`}
      >
        {pending ? (
          <Loader2 className="w-3 h-3 animate-spin text-accent-coral" />
        ) : (
          picked && <Check className="w-3.5 h-3.5 text-cream-100" />
        )}
      </button>
    )

    const meta = (
      <>
      {dm && (
        <span className={`inline-block px-2 py-0.5 mb-2 rounded-full text-xs ${dm.badge}`}>
          {dm.name}
        </span>
      )}
      <h3 className={`text-base font-medium text-ink-300 leading-snug pr-7 mb-2 ${expanded ? '' : 'line-clamp-2'}`}>
        {n.title}
      </h3>
      {expanded ? (
        <p className="text-xs text-ink-300 leading-relaxed mb-3 whitespace-pre-wrap max-h-72 overflow-y-auto">
          {n.content || n.summary}
        </p>
      ) : (
        <p className="text-xs text-ink-50 leading-relaxed mb-3 line-clamp-2">{n.summary}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-ink-50 mb-3">
        <span className="shrink-0">{n.source}</span>
        <span className="text-cream-400">·</span>
        <StarRating score={n.score} />
        <span className="text-cream-400">·</span>
        <span>{fmtNewsTime(n.created_at)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {n.keywords.slice(0, 3).map((kw) => (
          <span key={kw} className="px-2 py-0.5 bg-cream-300 rounded-full text-xs text-ink-50">
            {kw}
          </span>
        ))}
      </div>
      </>
    )

    if (mode === 'embed') {
      return (
        <div
          key={n.id}
          role="button"
          tabIndex={pending ? -1 : 0}
          data-news-id={n.id}
          data-picked={picked ? 'true' : undefined}
          onClick={handleCardClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !pending) {
              e.preventDefault()
              toggleExpand()
            }
          }}
          title="单击看全文，点右上角勾选框加入/移出节目"
          className={`relative bg-cream-200 rounded-2xl border p-4 transition-all cursor-pointer select-none ${
            picked
              ? 'border-accent-coral shadow-[0_0_0_1px_rgba(224,122,95,0.35)]'
              : 'border-cream-300 card-hover'
          } ${pending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {pickButton}
          {meta}
        </div>
      )
    }

    return (
      <div
        key={n.id}
        data-news-id={n.id}
        data-picked={picked ? 'true' : undefined}
        onClick={handleCardClick}
        title="单击看全文，点右上角勾选框加入/移出待选"
        className={`relative bg-cream-200 rounded-2xl border p-4 transition-all card-hover cursor-pointer select-none ${
          picked ? 'border-l-[3px] border-l-accent-coral border-cream-300' : 'border-cream-300'
        }`}
      >
        {pickButton}
        {meta}
      </div>
    )
  }

  const emptyBox = (icon, text, action) => (
    <div className="flex flex-col items-center py-20 bg-cream-200 rounded-2xl border border-cream-300">
      {icon}
      <p className="text-sm text-ink-50 mb-4">{text}</p>
      {action}
    </div>
  )

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex items-center gap-2 px-4 h-10 bg-accent-coral text-cream-100 rounded-xl text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
        >
          {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {fetching ? '抓取中…' : '抓取新闻'}
        </button>
        <span className="text-xs text-ink-50">上次抓取 {lastFetchText}</span>

        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-50" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题、摘要或关键词"
            className="w-full h-10 pl-9 pr-3 bg-cream-200 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
          />
        </div>

        <div className="flex gap-1.5">
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setMinScore(f.value)}
              className={`px-3 h-9 rounded-xl text-xs font-medium transition-colors ${
                minScore === f.value
                  ? 'bg-ink-300 text-cream-100'
                  : 'bg-cream-200 text-ink-50 hover:bg-cream-300 border border-cream-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 今日热点总览：领域卡片墙，点击下钻 */}
      {!loading && !loadError && news.length > 0 && (
        <div className="mb-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-300">
                <Flame className="w-4 h-4 text-accent-coral" />
                今日热点全景
              </h2>
              <p className="text-xs text-ink-50 mt-0.5">各领域热点一览，点击卡片下钻</p>
            </div>
            <span className="text-xs text-ink-50">共 {news.length} 条</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onClick={() => setActiveDomain(null)}
              className={`w-[110px] shrink-0 rounded-2xl border p-4 flex flex-col items-center justify-center gap-1 transition-all ${
                activeDomain === null
                  ? 'border-accent-coral bg-cream-200 shadow-[0_0_0_1px_rgba(224,122,95,0.35)]'
                  : 'border-cream-300 bg-cream-200 card-hover'
              }`}
            >
              <span className="text-sm font-semibold text-ink-300">全部</span>
              <span className="text-xs text-ink-50">{news.length} 条</span>
            </motion.button>
            {overview.map((d, i) => {
              const active = activeDomain === d.id
              return (
                <motion.button
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.06 * (i + 1), ease: 'easeOut' }}
                  onClick={() => setActiveDomain(active ? null : d.id)}
                  disabled={d.count === 0}
                  className={`w-[230px] shrink-0 text-left bg-cream-200 rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-accent-coral shadow-[0_0_0_1px_rgba(224,122,95,0.35)]'
                      : 'border-cream-300 card-hover'
                  } ${d.count === 0 ? 'opacity-50 cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-sm font-semibold text-ink-300">{d.name}</span>
                    <span className="text-xs text-ink-50 bg-cream-100 border border-cream-300 rounded-full px-2 py-0.5 shrink-0">
                      {d.count} 条
                    </span>
                  </div>
                  <div
                    className="flex h-1.5 rounded-full overflow-hidden bg-cream-300 mb-3"
                    title={SCORE_SEGMENTS.map((s) => `${s.label} ${d.dist[s.key]}`).join(' · ')}
                  >
                    {SCORE_SEGMENTS.map((s) =>
                      d.dist[s.key] > 0 ? (
                        <span
                          key={s.key}
                          className={s.barClass}
                          style={{ width: `${(d.dist[s.key] / d.count) * 100}%` }}
                        />
                      ) : null
                    )}
                  </div>
                  <ul className="space-y-1">
                    {d.top3.length > 0 ? (
                      d.top3.map((n) => (
                        <li key={n.id} className="text-xs text-ink-50 truncate" title={n.title}>
                          · {n.title}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-cream-500">暂无相关新闻</li>
                    )}
                  </ul>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* 来源芯片多选 */}
      {!loading && !loadError && enabledSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-ink-50" />
          {enabledSources.map((s) => {
            const active = checkedSources.includes(s.name)
            return (
              <button
                key={s.id}
                onClick={() => toggleSource(s.name)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-accent-coral/15 text-accent-coral border border-accent-coral/50'
                    : 'bg-cream-200 text-ink-50 border border-cream-300 hover:bg-cream-300'
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                {s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* 内容区 */}
      {loading ? (
        <div className="flex flex-col items-center py-20 bg-cream-200 rounded-2xl border border-cream-300">
          <Loader2 className="w-8 h-8 animate-spin text-accent-coral mb-3" />
          <p className="text-sm text-ink-50">正在读取新闻池…</p>
        </div>
      ) : loadError ? (
        emptyBox(
          <WifiOff className="w-12 h-12 text-cream-500 mb-3" />,
          loadError,
          <button
            onClick={load}
            className="px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors"
          >
            重试
          </button>
        )
      ) : news.length === 0 ? (
        emptyBox(
          <Inbox className="w-12 h-12 text-cream-500 mb-3" />,
          '新闻池还是空的，先抓一批看看',
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="flex items-center gap-2 px-5 h-10 bg-accent-coral text-cream-100 rounded-xl text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {fetching ? '抓取中…' : '抓取新闻'}
          </button>
        )
      ) : filtered.length === 0 ? (
        emptyBox(
          <Search className="w-12 h-12 text-cream-500 mb-3" />,
          '没有符合条件的新闻，试试降低评分门槛',
          <button
            onClick={clearFilters}
            className="px-5 h-10 rounded-xl bg-cream-100 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors"
          >
            清除筛选
          </button>
        )
      ) : (
        <>
          {activeDomain && (
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-ink-300">
                {DOMAIN_MAP[activeDomain]?.name} · {filtered.length} 条
              </h2>
              <button
                onClick={() => setActiveDomain(null)}
                className="text-xs text-ink-50 hover:text-accent-coral transition-colors"
              >
                查看全部 ×
              </button>
            </div>
          )}
          {grouped.map(([source, items]) => (
            <section key={source} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-ink-300">{source}</h2>
                <span className="text-xs text-ink-50 bg-cream-200 border border-cream-300 rounded-full px-2 py-0.5">
                  {items.length} 条
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((n) => renderCard(n))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
