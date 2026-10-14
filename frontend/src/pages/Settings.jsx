import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rss,
  KeyRound,
  FileText,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react'
import {
  sourcesApi,
  newsApi,
  rssParserApi,
  settingsApi,
  humanizeError,
} from '../services/api'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const TABS = [
  { key: 'rss', label: 'RSS 源', icon: Rss },
  { key: 'api', label: 'API 配置', icon: KeyRound },
  { key: 'prompt', label: '提示词', icon: FileText },
]

function Switch({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-accent-sage' : 'bg-cream-400'}`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  )
}

// ── RSS 源 ──
function RssTab() {
  const toast = useToast()
  const [sources, setSources] = useState([])
  const [loadingSources, setLoadingSources] = useState(true)
  const [form, setForm] = useState({ name: '', url: '' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // {id, name, url}
  const [deleting, setDeleting] = useState(null)
  const [fetchingId, setFetchingId] = useState(null)
  const [fetchingAll, setFetchingAll] = useState(false)

  const loadSources = async () => {
    try {
      setSources(await sourcesApi.list())
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    loadSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // URL 失焦且名称为空时，解析 RSS 标题自动补上名称
  const handleUrlBlur = async () => {
    const url = form.url.trim()
    if (!url || form.name.trim()) return
    try {
      const { title } = await rssParserApi.parseUrl(url)
      if (title) setForm((f) => (f.name.trim() ? f : { ...f, name: title }))
    } catch {
      // 解析失败静默降级：名称仍由用户手填
    }
  }

  const handleAdd = async () => {
    if (!form.name.trim() || !form.url.trim()) return
    setAdding(true)
    try {
      await sourcesApi.create({ name: form.name.trim(), url: form.url.trim(), enabled: true })
      setForm({ name: '', url: '' })
      await loadSources()
      toast.success('已保存')
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setAdding(false)
    }
  }

  const handleFetchOne = async (source) => {
    setFetchingId(source.id)
    try {
      await newsApi.fetch(source.id)
      toast.success(`已抓取 ${source.name} 的新闻，已自动评分`)
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setFetchingId(null)
    }
  }

  const handleFetchAll = async () => {
    setFetchingAll(true)
    try {
      await newsApi.fetch()
      toast.success('已抓取全部启用源的新闻，已自动评分')
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setFetchingAll(false)
    }
  }

  const handleToggle = async (s) => {
    try {
      await sourcesApi.update(s.id, { enabled: !s.enabled })
      setSources((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: !s.enabled } : x)))
    } catch (e) {
      toast.error(humanizeError(e))
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-xl text-sm focus:outline-none focus:border-accent-coral'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-50">共 {sources.length} 个源，{sources.filter((s) => s.enabled).length} 个已启用</p>
        <button
          onClick={handleFetchAll}
          disabled={fetchingAll}
          className="flex items-center gap-2 px-4 h-9 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300 transition-colors disabled:opacity-60"
        >
          {fetchingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {fetchingAll ? '抓取中…' : '抓取全部'}
        </button>
      </div>

      {loadingSources ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-50">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在读取 RSS 源…
        </div>
      ) : (
      <ul className="space-y-3">
        {sources.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-4 bg-cream-200 rounded-2xl border border-cream-300 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-300">{s.name}</p>
              <p className="text-xs text-ink-50 truncate">{s.url}</p>
            </div>
            <button
              onClick={() => handleFetchOne(s)}
              disabled={fetchingId === s.id || !s.enabled}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-cream-100 border border-cream-300 text-xs text-ink-300 hover:bg-cream-300 transition-colors disabled:opacity-50"
            >
              {fetchingId === s.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              抓取
            </button>
            <button
              onClick={() => setEditing({ id: s.id, name: s.name, url: s.url })}
              className="p-1.5 rounded-lg text-ink-50 hover:text-ink-300 hover:bg-cream-300 transition-colors"
              title="编辑"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleting(s)}
              className="p-1.5 rounded-lg text-[#C4574E]/70 hover:text-white hover:bg-[#C4574E] transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Switch checked={s.enabled} onChange={() => handleToggle(s)} />
          </li>
        ))}
      </ul>
      )}

      {/* 新增源 */}
      <div className="bg-cream-200 rounded-2xl border border-cream-300 p-4">
        <p className="text-sm font-medium text-ink-300 mb-3">添加 RSS 源</p>
        <div className="grid grid-cols-[200px_1fr_auto] gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="名称，如：少数派"
            className={inputCls}
          />
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            onBlur={handleUrlBlur}
            placeholder="RSS / API 地址"
            className={inputCls}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !form.name.trim() || !form.url.trim()}
            className="flex items-center gap-1.5 px-4 h-[42px] rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            添加
          </button>
        </div>
      </div>

      {/* 编辑弹窗 */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(45,42,36,0.4)]"
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              className="w-full max-w-md bg-cream-100 rounded-3xl p-6 border border-cream-300 shadow-[0_8px_30px_rgba(45,42,36,0.12)]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-ink-300">编辑 RSS 源</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-cream-200 text-ink-50">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-50 mb-1">名称 *</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-50 mb-1">地址 *</label>
                  <input
                    value={editing.url}
                    onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 h-10 rounded-xl bg-cream-200 border border-cream-300 text-sm text-ink-300 hover:bg-cream-300"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    try {
                      await sourcesApi.update(editing.id, { name: editing.name.trim(), url: editing.url.trim() })
                      setEditing(null)
                      await loadSources()
                      toast.success('已保存')
                    } catch (e) {
                      toast.error(humanizeError(e))
                    }
                  }}
                  disabled={!editing.name.trim() || !editing.url.trim()}
                  className="px-4 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`删除 RSS 源「${deleting?.name}」？`}
        body="删除后不再从该来源抓取新闻，已入库的新闻会保留。"
        confirmText="删除"
        onConfirm={async () => {
          try {
            await sourcesApi.delete(deleting.id)
            setDeleting(null)
            await loadSources()
            toast.success('已删除')
          } catch (e) {
            toast.error(humanizeError(e))
          }
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

// ── API 配置 ──
function ApiTab() {
  const toast = useToast()
  const [deepseekKey, setDeepseekKey] = useState('')
  const [minimaxKey, setMinimaxKey] = useState('')
  const [initialKeys, setInitialKeys] = useState({})
  const [apiStatus, setApiStatus] = useState({})
  const [showDs, setShowDs] = useState(false)
  const [showMm, setShowMm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi
      .getEnvKeys()
      .then((keys) => {
        setInitialKeys(keys)
        setDeepseekKey(keys.DEEPSEEK_API_KEY || '')
        setMinimaxKey(keys.MINIMAX_API_KEY || '')
      })
      .catch((e) => toast.error(humanizeError(e)))
    // 连接状态检查会真实调用 DeepSeek / MiniMax，失败不打扰（徽章保持"未验证"）
    settingsApi
      .getApiStatus()
      .then(setApiStatus)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusBadge = (connected) =>
    connected ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-sage/15 text-accent-sage text-xs font-medium">
        <CheckCircle2 className="w-3 h-3" />
        连接正常
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cream-300 text-ink-50 text-xs">
        未验证
      </span>
    )

  const handleSave = async () => {
    setSaving(true)
    try {
      // 只回写用户真正改过的 Key（输入框里是掩码值，原样保存会覆盖真 Key）
      const jobs = []
      if (deepseekKey.trim() && deepseekKey.trim() !== (initialKeys.DEEPSEEK_API_KEY || '')) {
        jobs.push(settingsApi.updateEnv('DEEPSEEK_API_KEY', deepseekKey.trim()))
      }
      if (minimaxKey.trim() && minimaxKey.trim() !== (initialKeys.MINIMAX_API_KEY || '')) {
        jobs.push(settingsApi.updateEnv('MINIMAX_API_KEY', minimaxKey.trim()))
      }
      await Promise.all(jobs)
      const [status, keys] = await Promise.all([
        settingsApi.getApiStatus().catch(() => null),
        settingsApi.getEnvKeys().catch(() => null),
      ])
      if (status) setApiStatus(status)
      if (keys) setInitialKeys(keys)
      if (status) {
        const bad = []
        if (!status.deepseek?.connected) bad.push('DeepSeek')
        if (!status.minimax?.connected) bad.push('MiniMax')
        if (bad.length === 0) {
          toast.success('已保存，连接验证通过')
        } else {
          toast.error(`${bad.join('、')} 的 Key 无效或未配置，请到 设置 → API 配置 检查`)
        }
      } else {
        toast.success('已保存')
      }
    } catch (e) {
      toast.error(humanizeError(e))
    } finally {
      setSaving(false)
    }
  }

  const field = (label, value, setValue, show, setShow, connected, placeholder) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-ink-50">{label} *</label>
        {statusBadge(connected)}
      </div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 pr-10 bg-cream-100 border border-cream-300 rounded-xl text-sm font-mono focus:outline-none focus:border-accent-coral"
        />
        <button
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-50 hover:text-ink-300"
          title={show ? '隐藏' : '显示'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 max-w-lg">
      {field('DeepSeek API Key', deepseekKey, setDeepseekKey, showDs, setShowDs, apiStatus.deepseek?.connected, 'sk-…')}
      {field('MiniMax API Key', minimaxKey, setMinimaxKey, showMm, setShowMm, apiStatus.minimax?.connected, 'eyJ…')}
      <p className="text-xs text-ink-50 leading-relaxed bg-cream-200 rounded-xl border border-cream-300 px-3 py-2.5">
        DeepSeek 的 Key 已保存，重启后端后生效；MiniMax 的 Key 即时生效。
      </p>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? '保存中…' : '保存并验证'}
      </button>
    </div>
  )
}

// ── 提示词 ──
function PromptTab() {
  const toast = useToast()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi
      .getScriptPrompt()
      .then((res) => setPrompt(res.script_prompt || ''))
      .catch((e) => toast.error(humanizeError(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs text-ink-50 mb-1.5">逐字稿系统提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={14}
          disabled={loading}
          className="w-full px-4 py-3 bg-cream-100 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral resize-y"
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={async () => {
            setSaving(true)
            try {
              await settingsApi.updateScriptPrompt(prompt)
              toast.success('已保存')
            } catch (e) {
              toast.error(`保存失败：${humanizeError(e)}。你的内容还在编辑框里，不会丢失`)
            } finally {
              setSaving(false)
            }
          }}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? '保存中…' : '保存'}
        </button>
        <span className="text-xs text-ink-50">保存到后端 .env（SCRIPT_PROMPT 环境变量）</span>
      </div>
    </div>
  )
}

export default function Settings() {
  const [tab, setTab] = useState('rss')

  return (
    <div className="p-8 min-h-screen max-w-4xl">
      <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">设置</h1>
      <p className="text-sm text-ink-50 mb-6">每个分区独立保存，改动即时生效</p>

      {/* Tab 栏 */}
      <div className="flex gap-2 mb-6 bg-cream-200 rounded-2xl border border-cream-300 p-1.5 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? 'bg-cream-100 shadow-sm text-ink-300' : 'text-ink-50 hover:text-ink-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'rss' && <RssTab />}
      {tab === 'api' && <ApiTab />}
      {tab === 'prompt' && <PromptTab />}
    </div>
  )
}
