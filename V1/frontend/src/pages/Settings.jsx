import { useState } from 'react'
import { motion } from 'framer-motion'
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
  AlertCircle
} from 'lucide-react'

const tabs = [
  { id: 'profile', label: '主播配置', icon: User },
  { id: 'voice', label: '音色设置', icon: Mic },
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
  const [activeTab, setActiveTab] = useState('profile')
  const [voices, setVoices] = useState(voiceSettings)
  const [apis, setApis] = useState(apiSettings)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">设置</h1>
          <p className="text-sm text-ink-50">配置主播信息、音色、API 和定时任务</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors"
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? '已保存' : '保存设置'}
        </motion.button>
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
          {/* 主播配置 */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                <h2 className="font-display text-lg font-semibold text-ink-300 mb-4">主播信息</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-2">主播名称</label>
                      <input
                        type="text"
                        defaultValue="彪悍罗"
                        className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-2">风格描述</label>
                      <textarea
                        rows={3}
                        defaultValue="犀利、直接、幽默风格，喜欢用生动的例子和比喻来解释技术概念"
                        className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-2">主播名称</label>
                      <input
                        type="text"
                        defaultValue="OK王"
                        className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-sage"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-2">风格描述</label>
                      <textarea
                        rows={3}
                        defaultValue="专业、客观、理性风格，擅长分析技术趋势和行业影响"
                        className="w-full px-4 py-3 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-sage resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 音色设置 */}
          {activeTab === 'voice' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {voices.map(voice => (
                <div key={voice.id} className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        voice.id === 'luo' ? 'bg-accent-coral/20' : 'bg-accent-sage/20'
                      }`}>
                        <Mic className={`w-5 h-5 ${voice.id === 'luo' ? 'text-accent-coral' : 'text-accent-sage'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-ink-300">{voice.name}</h3>
                        <p className="text-sm text-ink-50">{voice.description}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-cream-200 rounded-lg text-ink-50">{voice.provider}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-ink-50 mb-2">Voice ID</label>
                      <input
                        type="text"
                        defaultValue={voice.voiceId}
                        className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-50 mb-2">语速 (0.5-2.0)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        defaultValue={voice.speed}
                        className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-50 mb-2">音调 (-12~12)</label>
                      <input
                        type="number"
                        step="1"
                        min="-12"
                        max="12"
                        defaultValue={voice.pitch}
                        className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cream-200 rounded-lg text-ink-300 hover:bg-cream-300 transition-colors">
                      <Upload className="w-4 h-4" />
                      上传音频克隆音色
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* API 配置 */}
          {activeTab === 'api' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {apis.map(api => (
                <div key={api.id} className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        api.status === 'connected' ? 'bg-accent-sage/20' : 'bg-cream-300'
                      }`}>
                        {api.status === 'connected' ? (
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
                      api.status === 'connected'
                        ? 'bg-accent-sage/20 text-accent-sage'
                        : 'bg-accent-coral/20 text-accent-coral'
                    }`}>
                      {api.status === 'connected' ? '已连接' : '未连接'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-ink-50 mb-2">API Key</label>
                    <input
                      type="password"
                      defaultValue={api.value}
                      placeholder="请输入 API Key"
                      className="w-full px-3 py-2 bg-cream-200 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* 定时任务 */}
          {activeTab === 'schedule' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-semibold text-ink-300">定时生成任务</h2>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent-coral text-cream-100 rounded-lg hover:bg-accent-coral/90 transition-colors">
                    <Plus className="w-4 h-4" />
                    添加任务
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-cream-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent-sage/20 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-accent-sage" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-300">每日科技播客</p>
                        <p className="text-xs text-ink-50">每天 08:00 自动生成</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-cream-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-cream-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent-gold/20 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-accent-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-300">周末特别节目</p>
                        <p className="text-xs text-ink-50">每周六 10:00 自动生成</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-cream-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 通知设置 */}
          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                <h2 className="font-display text-lg font-semibold text-ink-300 mb-4">通知渠道</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-cream-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-ink-50" />
                      <span className="text-sm font-medium text-ink-300">邮件通知</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-cream-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-cream-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-ink-50" />
                      <span className="text-sm font-medium text-ink-300">Telegram 通知</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-cream-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="bg-cream-100 rounded-2xl p-6 border border-cream-300">
                <h2 className="font-display text-lg font-semibold text-ink-300 mb-4">通知事件</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-coral" />
                    <span className="text-sm text-ink-300">新闻抓取完成</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-coral" />
                    <span className="text-sm text-ink-300">逐字稿生成完成</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent-coral" />
                    <span className="text-sm text-ink-300">音频生成完成</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-cream-200 rounded-xl cursor-pointer hover:bg-cream-300 transition-colors">
                    <input type="checkbox" className="w-4 h-4 accent-accent-coral" />
                    <span className="text-sm text-ink-300">生成失败时通知</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
