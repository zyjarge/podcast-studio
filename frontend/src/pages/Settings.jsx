import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Mic,
  Bell,
  Palette,
  Key,
  Globe,
  Clock,
  Save,
  Upload,
  Volume2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Rss,
  X,
  Edit3,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { sourcesApi, newsApi, rssParserApi, settingsApi } from '../services/api'

const tabs = [
  { id: 'profile', label: '主播配置', icon: User },
  { id: 'voice', label: '音色设置', icon: Mic },
  { id: 'rss', label: 'RSS 源', icon: Rss },
  { id: 'api', label: 'API 配置', icon: Key },
  { id: 'schedule', label: '定时任务', icon: Clock },
  { id: 'notifications', label: '通知设置', icon: Bell },
]

const voiceSettings = [
  {
    id: 'luo',
    name: '彪悍罗',
    description: '犀利、直接、幽默风格',
    provider: 'MiniMax',
    voiceId: 'luoyonghao2',
    speed: 1.0,
    pitch: 0,
  },
  {
    id: 'wang',
    name: 'OK王',
    description: '专业、客观、理性风格',
    provider: 'MiniMax',
    voiceId: 'wangziru_test',
    speed: 1.0,
    pitch: 0,
  },
]

const apiSettings = [
  { id: 'deepseek', name: 'DeepSeek API', key: 'DEEPSEEK_API_KEY', value: 'sk-***...abc12', status: 'connected' },
  { id: 'minimax', name: 'MiniMax API', key: 'MINIMAX_API_KEY', value: 'sk-***...xyz78', status: 'connected' },
  { id: 'elevenlabs', name: 'ElevenLabs API', key: 'ELEVENLABS_API_KEY', value: '', status: 'disconnected' },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('rss')
  const [voices, setVoices] = useState(voiceSettings)
  const [apis, setApis] = useState(apiSettings)
  const [rssSources, setRssSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showRssModal, setShowRssModal] = useState(false)
  const [editingRss, setEditingRss] = useState(null)
  const [error, setError] = useState(null)

  // RSS 表单状态
  const [rssForm, setRssForm] = useState({ name: '', url: '', enabled: true, auto_mode: false })
  const [parsing, setParsing] = useState(false)
  
  // API 状态
  const [apiStatus, setApiStatus] = useState({})
  const [testingApi, setTestingApi] = useState(false)

  useEffect(() => {
    if (activeTab === 'rss') {
      fetchRssSources()
    } else if (activeTab === 'api') {
      fetchApiStatus()
    }
  }, [activeTab])

  const fetchRssSources = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await sourcesApi.list()
      setRssSources(data)
    } catch (err) {
      console.error('Failed to fetch RSS sources:', err)
      setError('加载 RSS 源失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchApiStatus = async () => {
    try {
      const data = await settingsApi.getApiStatus()
      setApiStatus(data)
    } catch (err) {
      console.error('Failed to fetch API status:', err)
    }
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // RSS 源操作
  const toggleRssEnabled = async (id) => {
    const source = rssSources.find(s => s.id === id)
    if (!source) return
    
    try {
      await sourcesApi.update(id, { enabled: !source.enabled })
      setRssSources(rssSources.map(s =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ))
    } catch (err) {
      console.error('Failed to toggle RSS enabled:', err)
      setError('更新失败')
    }
  }

  const toggleRssAutoMode = async (id) => {
    const source = rssSources.find(s => s.id === id)
    if (!source) return
    
    try {
      await sourcesApi.update(id, { auto_mode: !source.auto_mode })
      setRssSources(rssSources.map(s =>
        s.id === id ? { ...s, auto_mode: !s.auto_mode } : s
      ))
    } catch (err) {
      console.error('Failed to toggle RSS auto mode:', err)
      setError('更新失败')
    }
  }

  const deleteRss = async (id) => {
    if (!confirm('确定要删除这个 RSS 源吗？')) return
    
    try {
      await sourcesApi.delete(id)
      setRssSources(rssSources.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete RSS source:', err)
      setError('删除失败')
    }
  }

  const handleRssSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      if (editingRss) {
        // 更新
        await sourcesApi.update(editingRss.id, rssForm)
      } else {
        // 创建
        await sourcesApi.create(rssForm)
      }
      
      await fetchRssSources()
      setShowRssModal(false)
      setEditingRss(null)
      setRssForm({ name: '', url: '', enabled: true, auto_mode: false })
    } catch (err) {
      console.error('Failed to save RSS source:', err)
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleFetchNews = async (sourceId) => {
    setFetching(true)
    try {
      const result = await newsApi.fetch(sourceId)
      alert(result.message || '抓取完成')
      await fetchRssSources()
    } catch (err) {
      console.error('Failed to fetch news:', err)
      setError('抓取新闻失败')
    } finally {
      setFetching(false)
    }
  }

  const openEditModal = (source) => {
    setEditingRss(source)
    setRssForm({
      name: source.name,
      url: source.url,
      enabled: source.enabled,
      auto_mode: source.auto_mode
    })
    setShowRssModal(true)
  }

  // 从 RSS URL 解析标题
  const parseRssTitle = async () => {
    if (!rssForm.url) return
    
    setParsing(true)
    try {
      const result = await rssParserApi.parseUrl(rssForm.url)
      if (result.title) {
        setRssForm({ ...rssForm, name: result.title })
      }
    } catch (err) {
      console.error('Parse error:', err)
      alert(err.message || '解析失败，请检查 URL 是否正确')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="p-8 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">设置</h1>
          <p className="text-sm text-ink-50">配置主播信息，音色、API 和定时任务</p>
        </div>
      </div>

      <div className="flex gap-8">
        {/* 左侧导航 */}
        <div className="w-48">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-cream-200 text-ink-300'
                      : 'text-ink-50 hover:bg-cream-200 hover:text-ink-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1">
          {/* RSS 源管理 */}
          {activeTab === 'rss' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* 错误提示 */}
              {error && (
                <div className="p-4 bg-red-100 text-red-600 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                  <button onClick={() => setError(null)} className="ml-auto">×</button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink-300">RSS 源管理</h2>
                  <p className="text-sm text-ink-50">配置新闻来源，用于自动抓取和精编模式</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFetchNews()}
                    disabled={fetching}
                    className="flex items-center gap-2 px-4 py-2 bg-cream-200 text-ink-300 rounded-xl font-medium hover:bg-cream-300 transition-colors disabled:opacity-50"
                  >
                    {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    抓取全部
                  </button>
                  <button
                    onClick={() => { setEditingRss(null); setRssForm({ name: '', url: '', enabled: true, auto_mode: false }); setShowRssModal(true) }}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    添加 RSS 源
                  </button>
                </div>
              </div>

              {/* RSS 源列表 */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent-coral" />
                </div>
              ) : rssSources.length === 0 ? (
                <div className="text-center py-12 text-ink-50 bg-cream-100 rounded-2xl">
                  暂无 RSS 源，点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-3">
                  {rssSources.map(source => (
                    <div
                      key={source.id}
                      className={`bg-cream-100 rounded-2xl p-5 border transition-colors ${
                        source.enabled ? 'border-cream-300' : 'border-cream-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            source.enabled ? 'bg-accent-sage/20' : 'bg-cream-200'
                          }`}>
                            <Rss className={`w-5 h-5 ${source.enabled ? 'text-accent-sage' : 'text-ink-50'}`} />
                          </div>
                          <div>
                            <h3 className="font-medium text-ink-300">{source.name}</h3>
                            <p className="text-sm text-ink-50 truncate max-w-md">{source.url}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* 抓取按钮 */}
                          <button
                            onClick={() => handleFetchNews(source.id)}
                            disabled={fetching || !source.enabled}
                            className="p-2 hover:bg-cream-200 rounded-xl text-ink-50 hover:text-ink-300 disabled:opacity-50"
                            title="抓取新闻"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* 启用开关 */}
                          <button
                            onClick={() => toggleRssEnabled(source.id)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${
                              source.enabled ? 'bg-accent-sage' : 'bg-cream-400'
                            }`}
                          >
                            <motion.div
                              animate={{ x: source.enabled ? 24 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="w-5 h-5 bg-white rounded-full shadow-sm"
                            />
                          </button>

                          {/* 自动模式 */}
                          <button
                            onClick={() => toggleRssAutoMode(source.id)}
                            disabled={!source.enabled}
                            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                              source.auto_mode && source.enabled
                                ? 'bg-accent-sage/20 text-accent-sage'
                                : 'bg-cream-200 text-ink-50'
                            }`}
                          >
                            ☑自动
                          </button>

                          {/* 编辑 */}
                          <button
                            onClick={() => openEditModal(source)}
                            className="p-2 hover:bg-cream-200 rounded-xl text-ink-50 hover:text-ink-300"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* 删除 */}
                          <button
                            onClick={() => deleteRss(source.id)}
                            className="p-2 hover:bg-red-100 rounded-xl text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* API 配置 */}
          {activeTab === 'api' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {[
                { id: 'deepseek', name: 'DeepSeek API', key: 'DEEPSEEK_API_KEY', desc: '用于生成播客脚本' },
                { id: 'minimax', name: 'MiniMax API', key: 'MINIMAX_API_KEY', desc: '用于语音合成（TTS）' },
                { id: 'elevenlabs', name: 'ElevenLabs API', key: 'ELEVENLABS_API_KEY', desc: '备用语音合成' },
              ].map(api => (
                <div key={api.id} className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        apiStatus[api.id]?.connected ? 'bg-accent-sage/20' : 'bg-cream-300'
                      }`}>
                        {apiStatus[api.id]?.connected ? (
                          <CheckCircle2 className="w-5 h-5 text-accent-sage" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-ink-50" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-ink-300">{api.name}</h3>
                        <p className="text-sm text-ink-50">{api.key}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      apiStatus[api.id]?.connected
                        ? 'bg-accent-sage/20 text-accent-sage'
                        : 'bg-accent-coral/20 text-accent-coral'
                    }`}>
                      {apiStatus[api.id]?.connected ? '已连接' : '未连接'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-ink-50 mb-2">API Key</label>
                    <input
                      type="password"
                      placeholder="请输入 API Key"
                      className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                    />
                  </div>
                  <p className="text-xs text-ink-50 mt-2">{api.desc}</p>
                </div>
              ))}

              {/* 说明 */}
              <div className="bg-cream-200 rounded-xl p-4">
                <p className="text-sm text-ink-50">
                  <strong>注意：</strong> 修改 API Key 后需要重启后端服务才能生效。
                  <br />
                  当前状态从服务器环境变量读取。
                </p>
              </div>
            </motion.div>
          )}

          {/* 其他 Tab 占位 */}
          {activeTab !== 'rss' && (
            <div className="text-center py-12 text-ink-50">
              该功能正在开发中...
            </div>
          )}
        </div>
      </div>

      {/* RSS 源弹窗 */}
      <AnimatePresence>
        {showRssModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50"
            onClick={() => setShowRssModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-cream-100 rounded-3xl p-6 w-[500px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-ink-300">
                  {editingRss ? '编辑 RSS 源' : '添加 RSS 源'}
                </h2>
                <button
                  onClick={() => setShowRssModal(false)}
                  className="p-2 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-ink-50" />
                </button>
              </div>

              <form onSubmit={handleRssSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">RSS URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={rssForm.url}
                      onChange={(e) => setRssForm({ ...rssForm, url: e.target.value })}
                      placeholder="https://example.com/rss 或 https://tg.i-c-a.su/rss/频道名"
                      className="flex-1 px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      required
                    />
                    <button
                      type="button"
                      onClick={parseRssTitle}
                      disabled={parsing || !rssForm.url}
                      className="px-4 py-2 bg-cream-200 border border-cream-400 rounded-xl hover:bg-cream-300 transition-colors disabled:opacity-50"
                      title="从 URL 解析标题"
                    >
                      {parsing ? (
                        <Loader2 className="w-5 h-5 animate-spin text-accent-coral" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-ink-300" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">名称</label>
                  <input
                    type="text"
                    value={rssForm.name}
                    onChange={(e) => setRssForm({ ...rssForm, name: e.target.value })}
                    placeholder="自动解析或手动输入"
                    className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                    required
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rssForm.enabled}
                      onChange={(e) => setRssForm({ ...rssForm, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-cream-400 text-accent-coral focus:ring-accent-coral"
                    />
                    <span className="text-sm text-ink-300">启用</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rssForm.auto_mode}
                      onChange={(e) => setRssForm({ ...rssForm, auto_mode: e.target.checked })}
                      className="w-4 h-4 rounded border-cream-400 text-accent-coral focus:ring-accent-coral"
                    />
                    <span className="text-sm text-ink-300">用于自动模式</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowRssModal(false)}
                    className="px-4 py-2 text-ink-50 hover:bg-cream-200 rounded-xl transition-colors"
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingRss ? '保存' : '添加')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
