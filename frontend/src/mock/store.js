// 内存状态 + localStorage 持久化的 mock store（useSyncExternalStore 订阅）
import { useSyncExternalStore } from 'react'
import { buildSeedState } from './data'

const STORAGE_KEY = 'podcast-studio-mock-v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.version === 1) return parsed
    }
  } catch {
    // 损坏的缓存直接重建
  }
  return buildSeedState()
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage 不可用时静默降级为纯内存
  }
}

function notify() {
  listeners.forEach((fn) => fn())
}

function commit(next) {
  state = typeof next === 'function' ? next(state) : { ...state, ...next }
  persist()
  notify()
}

export function getState() {
  return state
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 订阅整个 store：任何 commit 都会触发重渲染（原型规模下足够） */
export function useStore() {
  return useSyncExternalStore(subscribe, () => state)
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  state = buildSeedState()
  notify()
}

// ── 工具 ──
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const nowIso = () => new Date().toISOString()

function patchEpisode(state, id, patch) {
  return {
    ...state,
    episodes: state.episodes.map((ep) => (ep.id === id ? { ...ep, ...patch } : ep)),
  }
}

// ── 节目 ──
export function createEpisode({ title, scheduled_date }) {
  const episode = {
    id: uid('ep'),
    title,
    status: 'editing',
    scheduled_date: scheduled_date || nowIso(),
    created_at: nowIso(),
    notes: '',
    script: null,
    audio: null,
    titleCustom: false,
    titleSuggestions: [],
    coverVariants: [],
    cover: null,
    coverRatio: 'mp',
    article: null,
    articleTemplate: 'magazine',
    newsIds: [],
    newsNotes: {},
    published_at: null,
  }
  commit((s) => ({ ...s, episodes: [episode, ...s.episodes] }))
  return episode
}

export function updateEpisode(id, patch) {
  commit((s) => patchEpisode(s, id, patch))
}

export function getEpisode(id) {
  return state.episodes.find((ep) => ep.id === id)
}

export function publishEpisode(id) {
  commit((s) => patchEpisode(s, id, { status: 'published', published_at: nowIso() }))
}

// ── 节目内新闻 ──
export function addNewsToEpisode(episodeId, newsIds) {
  commit((s) => {
    const ep = s.episodes.find((e) => e.id === episodeId)
    if (!ep) return s
    const merged = [...ep.newsIds]
    newsIds.forEach((nid) => {
      if (!merged.includes(nid)) merged.push(nid)
    })
    return patchEpisode(s, episodeId, { newsIds: merged })
  })
}

/** 移除并返回快照，供撤销恢复 */
export function removeNewsFromEpisode(episodeId, newsId) {
  const ep = state.episodes.find((e) => e.id === episodeId)
  if (!ep) return null
  const index = ep.newsIds.indexOf(newsId)
  if (index < 0) return null
  const snapshot = { newsId, index, note: ep.newsNotes[newsId] }
  commit((s) => {
    const cur = s.episodes.find((e) => e.id === episodeId)
    const newsIds = cur.newsIds.filter((nid) => nid !== newsId)
    const newsNotes = { ...cur.newsNotes }
    delete newsNotes[newsId]
    return patchEpisode(s, episodeId, { newsIds, newsNotes })
  })
  return snapshot
}

export function restoreNewsToEpisode(episodeId, snapshot) {
  if (!snapshot) return
  commit((s) => {
    const ep = s.episodes.find((e) => e.id === episodeId)
    if (!ep || ep.newsIds.includes(snapshot.newsId)) return s
    const newsIds = [...ep.newsIds]
    newsIds.splice(Math.min(snapshot.index, newsIds.length), 0, snapshot.newsId)
    const newsNotes = { ...ep.newsNotes }
    if (snapshot.note) newsNotes[snapshot.newsId] = snapshot.note
    return patchEpisode(s, episodeId, { newsIds, newsNotes })
  })
}

export function reorderEpisodeNews(episodeId, newsIds) {
  commit((s) => patchEpisode(s, episodeId, { newsIds }))
}

export function setNewsNote(episodeId, newsId, note) {
  commit((s) => {
    const ep = s.episodes.find((e) => e.id === episodeId)
    return patchEpisode(s, episodeId, { newsNotes: { ...ep.newsNotes, [newsId]: note } })
  })
}

// ── 逐字稿 / 音频 ──
export function setEpisodeScript(episodeId, script) {
  commit((s) => patchEpisode(s, episodeId, { script }))
}

export function setEpisodeAudio(episodeId, audio) {
  commit((s) => patchEpisode(s, episodeId, { audio }))
}

export function setTitleSuggestions(episodeId, titleSuggestions) {
  commit((s) => patchEpisode(s, episodeId, { titleSuggestions }))
}

// ── 新闻池 ──
export function addNewsItems(items) {
  const fresh = items
    .filter((n) => !state.news.some((x) => x.id === n.id))
    .map((n) => ({ ...n, created_at: n.created_at || nowIso() }))
  if (fresh.length === 0) return 0
  commit((s) => ({ ...s, news: [...fresh, ...s.news], topicsDirty: true }))
  return fresh.length
}

export function markFetched() {
  commit({ lastFetchAt: nowIso() })
}

// ── 话题聚类 ──
export function setTopics(topics) {
  commit({ topics, topicsDirty: false })
}

// ── 设置 ──
export function updateSettings(patch) {
  commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
}

// ── RSS 源 ──
export function addSource({ name, url }) {
  const source = { id: uid('src'), name, url, enabled: true }
  commit((s) => ({ ...s, sources: [...s.sources, source] }))
  return source
}

export function updateSource(id, patch) {
  commit((s) => ({
    ...s,
    sources: s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)),
  }))
}

export function removeSource(id) {
  commit((s) => ({ ...s, sources: s.sources.filter((src) => src.id !== id) }))
}

export function dismissOnboarding() {
  commit({ onboardingDismissed: true })
}
