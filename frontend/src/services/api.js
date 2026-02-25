// API service for Podcast Studio frontend
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8002/api/v1'

class ApiError extends Error {
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

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new ApiError(error.detail || 'Request failed', response.status)
    }
    
    return response.json()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error.message, 0)
  }
}

// RSS Sources API
export const sourcesApi = {
  list: () => request('/sources/'),
  get: (id) => request(`/sources/${id}`),
  create: (data) => request('/sources/', { method: 'POST', body: data }),
  update: (id, data) => request(`/sources/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/sources/${id}`, { method: 'DELETE' }),
}

// News API
export const newsApi = {
  list: (sourceId) => {
    const params = sourceId ? `?source_id=${sourceId}` : ''
    return request(`/news/${params}`)
  },
  fetch: () => request('/news/fetch', { method: 'POST' }),
}

// Episodes API
export const episodesApi = {
  list: () => request('/episodes/'),
  get: (id) => request(`/episodes/${id}`),
  create: (data) => request('/episodes/', { method: 'POST', body: data }),
  update: (id, data) => request(`/episodes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/episodes/${id}`, { method: 'DELETE' }),
  
  // Episode News
  listNews: (episodeId) => request(`/episodes/${episodeId}/news`),
  addNews: (episodeId, newsIds) => request(`/episodes/${episodeId}/news`, { method: 'POST', body: newsIds }),
  reorderNews: (episodeId, orders) => request(`/episodes/${episodeId}/news/reorder`, { method: 'PUT', body: orders }),
  
  // Generation
  generateScript: (episodeId, newsId) => request(`/episodes/${episodeId}/news/${newsId}/generate-script`, { method: 'POST' }),
  generateAudio: (episodeId, newsId, voiceId = 'luoyonghao') => 
    request(`/episodes/${episodeId}/news/${newsId}/generate-audio?voice_id=${voiceId}`, { method: 'POST' }),
  generateAll: (episodeId) => request(`/episodes/${episodeId}/generate-all`, { method: 'POST' }),
}

export { API_BASE }
