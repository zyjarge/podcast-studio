import { useState } from 'react'
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
  RotateCcw,
} from 'lucide-react'
import {
  useStore,
  addSource,
  updateSource,
  removeSource,
  updateSettings,
  resetDemo,
} from '../mock/store'
import { mockFetchSource, mockVerifyKeys, mockDelay } from '../mock/api'
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
  const { sources } = useStore()
  const [form, setForm] = useState({ name: '', url: '' })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // {id, name, url}
  const [deleting, setDeleting] = useState(null)
  const [fetchingId, setFetchingId] = useState(null)
  const [fetchingAll, setFetchingAll] = useState(false)

  const handleAdd = async () => {
    if (!form.name.trim() || !form.url.trim()) return
    setAdding(true)
    await mockDelay()
    addSource({ name: form.name.trim(), url: form.url.trim() })
    setForm({ name: '', url: '' })
    setAdding(false)
    toast.success('已保存')
  }

  const handleFetchOne = async (source) => {
    setFetchingId(source.id)
    await mockFetchSource()
    setFetchingId(null)
    toast.success(`已抓取 ${source.name} 的新闻，已自动评分`)
  }

  const handleFetchAll = async () => {
    setFetchingAll(true)
    await mockFetchSource()
    setFetchingAll(false)
    toast.success('已抓取全部启用源的新闻，已自动评分')
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
            <Switch checked={s.enabled} onChange={() => updateSource(s.id, { enabled: !s.enabled })} />
          </li>
        ))}
      </ul>

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
                    await mockDelay()
                    updateSource(editing.id, { name: editing.name.trim(), url: editing.url.trim() })
                    setEditing(null)
                    toast.success('已保存')
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
        onConfirm={() => {
          removeSource(deleting.id)
          setDeleting(null)
          toast.success('已删除')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

// ── API 配置 ──
function ApiTab() {
  const toast = useToast()
  const { settings } = useStore()
  const [deepseekKey, setDeepseekKey] = useState(settings.deepseekKey)
  const [minimaxKey, setMinimaxKey] = useState(settings.minimaxKey)
  const [showDs, setShowDs] = useState(false)
  const [showMm, setShowMm] = useState(false)
  const [saving, setSaving] = useState(false)

  const statusBadge = (status) =>
    status === 'ok' ? (
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
    await mockVerifyKeys()
    updateSettings({
      deepseekKey: deepseekKey.trim(),
      minimaxKey: minimaxKey.trim(),
      apiStatus: { deepseek: 'ok', minimax: 'ok' },
    })
    setSaving(false)
    toast.success('已保存，连接验证通过')
  }

  const field = (label, value, setValue, show, setShow, status, placeholder) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-ink-50">{label} *</label>
        {statusBadge(status)}
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
      {field('DeepSeek API Key', deepseekKey, setDeepseekKey, showDs, setShowDs, settings.apiStatus.deepseek, 'sk-…')}
      {field('MiniMax API Key', minimaxKey, setMinimaxKey, showMm, setShowMm, settings.apiStatus.minimax, 'eyJ…')}
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
  const { settings } = useStore()
  const [prompt, setPrompt] = useState(settings.prompt)
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs text-ink-50 mb-1.5">逐字稿系统提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={14}
          className="w-full px-4 py-3 bg-cream-100 border border-cream-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-accent-coral resize-y"
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={async () => {
            setSaving(true)
            await mockDelay()
            updateSettings({ prompt })
            setSaving(false)
            toast.success('已保存')
          }}
          disabled={saving}
          className="flex items-center gap-2 px-5 h-10 rounded-xl bg-accent-coral text-cream-100 text-sm font-medium hover:bg-accent-coral/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? '保存中…' : '保存'}
        </button>
        <span className="text-xs text-ink-50">演示原型说明：mock 生成器不消费此提示词，仅验证交互流程</span>
      </div>
    </div>
  )
}

export default function Settings() {
  const toast = useToast()
  const [tab, setTab] = useState('rss')
  const [confirmReset, setConfirmReset] = useState(false)

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

      {/* 演示数据重置 */}
      <div className="mt-12 pt-6 border-t border-cream-300">
        <button
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-2 px-4 h-9 rounded-xl bg-white border border-[#C4574E]/60 text-xs font-medium text-[#C4574E] hover:bg-[#C4574E] hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置演示数据
        </button>
        <p className="text-xs text-ink-50 mt-2">恢复初始 mock 数据（新闻、节目、设置全部还原），用于重新演示</p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="重置演示数据？"
        body="新闻池、节目、设置将全部恢复为初始状态，你在原型里的所有改动都会丢失。"
        confirmText="重置"
        onConfirm={() => {
          resetDemo()
          setConfirmReset(false)
          toast.success('已恢复初始演示数据')
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
