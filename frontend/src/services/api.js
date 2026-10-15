// API service for Podcast Studio frontend
// 使用相对路径，通过 Vite dev server 的 proxy 转发到后端（/api、/audio → 8002）
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body)
  }

  let response
  try {
    response = await fetch(url, config)
  } catch (error) {
    // 网络层失败（后端没起 / 断网）：status 0，由 humanizeError 统一措辞
    throw new ApiError(error.message, 0)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)
    throw new ApiError(detail || 'Request failed', response.status)
  }

  return response.json()
}

/** 把 ApiError 翻译成用户能看懂的措辞（doc/UX_COPY.md） */
export function humanizeError(e) {
  if (!(e instanceof ApiError)) return String(e)
  if (e.status === 0) return '网络异常——请确认后端服务正在运行，然后重试'
  if (/MINIMAX_API_KEY|LLM service not initialized/i.test(e.message)) {
    return 'MiniMax 的 Key 无效或未配置，请到 设置 → API 配置 检查'
  }
  return e.message
}

// ── 数据形状适配：后端 snake_case/分字段 → 组件使用的形状 ──

/** News：评分取整，三维分合成 scores 对象，keywords 容错 */
export function normalizeNews(n) {
  return {
    ...n,
    score: Math.round(n.score || 0),
    keywords: Array.isArray(n.keywords) ? n.keywords : [],
    scores: {
      timeliness: Math.round(n.score_timeliness || 0),
      topic: Math.round(n.score_authority || 0),
      depth: Math.round(n.score_depth || 0),
    },
  }
}

/** EpisodeNews + 全量新闻 join：卡片要显示正文/评分，EpisodeNews 内嵌的 news 只有摘要 */
export function joinEpisodeNews(episodeNewsList, newsById) {
  return episodeNewsList
    .map((en) => {
      const full = newsById[en.news_id]
      const base = full || en.news || {}
      return {
        ...base,
        id: en.news_id, // 组件内统一用 news_id 作为条目 id（拖拽/展开/备注的 key）
        episodeNewsId: en.id,
        note: en.notes || '',
        title: base.title || '',
        source: base.source || '',
        summary: base.summary || '',
        content: base.content || '',
        score: Math.round(base.score || 0),
        keywords: Array.isArray(base.keywords) ? base.keywords : [],
      }
    })
    .filter((n) => n.id != null)
}

/** title_suggestions / cover_choice 是 JSON 字符串，解析失败返回兜底值 */
export function parseJsonField(raw, fallback) {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

// Episodes API
export const episodesApi = {
  list: () => request('/episodes/'),
  get: (id) => request(`/episodes/${id}`),
  create: (data) => request('/episodes/', { method: 'POST', body: data }),
  update: (id, data) => request(`/episodes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/episodes/${id}`, { method: 'DELETE' }),

  // 节目内新闻
  listNews: (episodeId) => request(`/episodes/${episodeId}/news`),
  // 注意：后端收裸 JSON 数组（body 即 [news_id, ...]）
  addNews: (episodeId, newsIds) =>
    request(`/episodes/${episodeId}/news`, { method: 'POST', body: newsIds }),
  softDeleteNews: (episodeId, newsId) =>
    request(`/episodes/${episodeId}/news/${newsId}/soft-delete`, { method: 'POST' }),
  restoreNews: (episodeId, newsId) =>
    request(`/episodes/${episodeId}/news/${newsId}/restore`, { method: 'POST' }),
  updateNewsNotes: (episodeId, newsId, notes) =>
    request(`/episodes/${episodeId}/news/${newsId}/notes`, { method: 'PUT', body: { notes } }),
  // orders: [{ id: EpisodeNews 的 id, order }]
  reorderNews: (episodeId, orders) =>
    request(`/episodes/${episodeId}/news/reorder`, { method: 'PUT', body: orders }),

  // 生成
  generateScript: (episodeId, episodeNotes = '') =>
    request(`/episodes/${episodeId}/generate-episode-script`, {
      method: 'POST',
      body: { episode_notes: episodeNotes },
    }),
  generateTitles: (episodeId) =>
    request(`/episodes/${episodeId}/generate-titles`, { method: 'POST' }),
  generateArticle: (episodeId) =>
    request(`/episodes/${episodeId}/generate-article`, { method: 'POST' }),

  // 音频（后台任务 + 轮询）
  generateAudio: (episodeId, { force = false } = {}) =>
    request(`/episodes/${episodeId}/generate-episode-audio${force ? '?force=true' : ''}`, {
      method: 'POST',
    }),
  getAudioProgress: (episodeId) => request(`/episodes/${episodeId}/audio-progress`),
  deleteAudio: (episodeId) => request(`/episodes/${episodeId}/audio`, { method: 'DELETE' }),
}

// News API
export const newsApi = {
  list: ({ sortBy = 'created_at', order = 'desc', limit = 200 } = {}) =>
    request(`/news/?sort_by=${sortBy}&order=${order}&limit=${limit}`),
  fetch: (sourceId) =>
    request(`/news/fetch${sourceId ? `?source_id=${sourceId}` : ''}`, { method: 'POST' }),
  clusterTopics: () => request('/news/cluster-topics', { method: 'POST' }),
}

// RSS Sources API
export const sourcesApi = {
  list: () => request('/sources/'),
  create: (data) => request('/sources/', { method: 'POST', body: data }),
  update: (id, data) => request(`/sources/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/sources/${id}`, { method: 'DELETE' }),
}

// RSS Parser API
export const rssParserApi = {
  parseUrl: (url) => request(`/rss/parse-rss?url=${encodeURIComponent(url)}`),
}

// Settings API
export const settingsApi = {
  getApiStatus: () => request('/settings/status'),
  getEnvKeys: () => request('/settings/env-keys'),
  updateEnv: (key, value) =>
    request(`/settings/update-env?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`, {
      method: 'POST',
    }),
  getScriptPrompt: () => request('/settings/script-prompt'),
  updateScriptPrompt: (prompt) =>
    request('/settings/script-prompt', { method: 'PUT', body: { script_prompt: prompt } }),
}

/** 音频文件地址（相对路径，走 vite 代理） */
export const episodeAudioUrl = (episodeId) => `/audio/${episodeId}/episode_${episodeId}.mp3`
