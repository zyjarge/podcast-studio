import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Settings,
  Mic,
  User,
  SkipBack,
  SkipForward,
  Download,
  Trash2,
  Edit3,
  Music
} from 'lucide-react'

// 模拟音频数据
const mockAudios = [
  {
    id: 1,
    newsTitle: 'Anthropic 推出智能体 AI 工具',
    speaker: 'luo',
    scriptContent: '彪悍罗：各位听众朋友们大家好，欢迎来到科技双响炮！我是彪悍罗。',
    audioUrl: null,
    status: 'completed',
    duration: '3:24',
    voiceId: 'luoyonghao2',
    createdAt: '2026-02-25 10:35'
  },
  {
    id: 2,
    newsTitle: 'OpenAI GPT-5 即将发布',
    speaker: 'wang',
    scriptContent: 'OK王：我是OK王，今天我们继续来聊聊科技圈的那些事儿。',
    audioUrl: null,
    status: 'completed',
    duration: '2:15',
    voiceId: 'wangziru_test',
    createdAt: '2026-02-25 10:40'
  },
  {
    id: 3,
    newsTitle: '苹果 Vision Pro 2 配备 RGB LCOS',
    speaker: 'luo',
    scriptContent: null,
    audioUrl: null,
    status: 'pending',
    duration: null,
    voiceId: 'luoyonghao2',
    createdAt: null
  },
  {
    id: 4,
    newsTitle: '英伟达发布新一代数据中心 GPU',
    speaker: 'wang',
    scriptContent: null,
    audioUrl: null,
    status: 'generating',
    duration: null,
    voiceId: 'wangziru_test',
    createdAt: null
  },
  {
    id: 5,
    newsTitle: '马斯克 xAI 获得 60 亿美元融资',
    speaker: 'luo',
    scriptContent: null,
    audioUrl: null,
    status: 'error',
    errorMsg: 'API 调用超时',
    duration: null,
    voiceId: 'luoyonghao2',
    createdAt: null
  },
]

const statusConfig = {
  pending: { label: '待生成', icon: Clock, color: 'text-ink-50', bgColor: 'bg-cream-300' },
  generating: { label: '生成中', icon: Loader2, color: 'text-accent-gold', bgColor: 'bg-accent-gold/20' },
  completed: { label: '已完成', icon: CheckCircle2, color: 'text-accent-sage', bgColor: 'bg-accent-sage/20' },
  error: { label: '生成失败', icon: AlertCircle, color: 'text-accent-coral', bgColor: 'bg-accent-coral/20' },
}

const speakerConfig = {
  luo: { name: '彪悍罗', voice: 'luoyonghao2', color: 'accent-coral' },
  wang: { name: 'OK王', voice: 'wangziru_test', color: 'accent-sage' },
}

export default function AudioStudio() {
  const [audios, setAudios] = useState(mockAudios)
  const [playingId, setPlayingId] = useState(null)
  const [showSettings, setShowSettings] = useState(null)
  const audioRef = useRef(null)

  // 模拟播放功能
  useEffect(() => {
    if (playingId) {
      // 这里应该是真实音频播放
      const timer = setTimeout(() => {
        setPlayingId(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [playingId])

  const handlePlay = (id) => {
    if (playingId === id) {
      setPlayingId(null)
    } else {
      setPlayingId(id)
    }
  }

  const generateAudio = (id) => {
    setAudios(audios.map(a =>
      a.id === id ? { ...a, status: 'generating' } : a
    ))
    // 模拟生成过程
    setTimeout(() => {
      const randomDuration = Math.floor(Math.random() * 180) + 60
      const minutes = Math.floor(randomDuration / 60)
      const seconds = randomDuration % 60
      setAudios(audios.map(a =>
        a.id === id ? {
          ...a,
          status: 'completed',
          duration: `${minutes}:${seconds.toString().padStart(2, '0')}`
        } : a
      ))
    }, 4000)
  }

  const regenerateAudio = (id) => {
    setAudios(audios.map(a =>
      a.id === id ? { ...a, status: 'generating', duration: null } : a
    ))
    setTimeout(() => {
      setAudios(audios.map(a =>
        a.id === id ? {
          ...a,
          status: 'completed',
          duration: '2:45'
        } : a
      ))
    }, 4000)
  }

  const completedCount = audios.filter(a => a.status === 'completed').length

  return (
    <div className="p-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">音频工作室</h1>
          <p className="text-sm text-ink-50">生成和管理每条新闻的语音片段</p>
        </div>
        <div className="flex items-center gap-4">
          {/* 音量预览 */}
          <div className="flex items-center gap-2 px-4 py-2 bg-cream-200 rounded-xl">
            <Volume2 className="w-4 h-4 text-ink-50" />
            <span className="text-sm text-ink-300">预览音量</span>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="80"
              className="w-24 h-1 bg-cream-400 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-coral [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent-sage text-cream-100 rounded-xl font-medium hover:bg-accent-sage/90 transition-colors">
            <Music className="w-4 h-4" />
            添加背景音乐
          </button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-cream-100 rounded-2xl p-4 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">总片段</p>
          <p className="text-2xl font-display font-semibold text-ink-300">{audios.length}</p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-4 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">已完成</p>
          <p className="text-2xl font-display font-semibold text-accent-sage">{completedCount}</p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-4 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">生成中</p>
          <p className="text-2xl font-display font-semibold text-accent-gold">
            {audios.filter(a => a.status === 'generating').length}
          </p>
        </div>
        <div className="bg-cream-100 rounded-2xl p-4 border border-cream-300">
          <p className="text-sm text-ink-50 mb-1">失败</p>
          <p className="text-2xl font-display font-semibold text-accent-coral">
            {audios.filter(a => a.status === 'error').length}
          </p>
        </div>
      </div>

      {/* 音频列表 */}
      <div className="space-y-4">
        <AnimatePresence>
          {audios.map((audio, index) => {
            const status = statusConfig[audio.status]
            const speaker = speakerConfig[audio.speaker]
            const StatusIcon = status.icon
            const isPlaying = playingId === audio.id

            return (
              <motion.div
                key={audio.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className="bg-cream-100 rounded-2xl border border-cream-300 overflow-hidden"
              >
                <div className="flex items-stretch">
                  {/* 左侧：播放控制 */}
                  <div className="w-20 bg-cream-200 flex flex-col items-center justify-center p-4">
                    {audio.status === 'completed' ? (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handlePlay(audio.id)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          isPlaying
                            ? 'bg-accent-coral text-cream-100'
                            : 'bg-accent-sage text-cream-100 hover:bg-accent-sage/90'
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </motion.button>
                    ) : audio.status === 'generating' ? (
                      <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
                      </div>
                    ) : audio.status === 'error' ? (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => regenerateAudio(audio.id)}
                        className="w-12 h-12 rounded-full bg-accent-coral/20 flex items-center justify-center"
                      >
                        <RefreshCw className="w-5 h-5 text-accent-coral" />
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => generateAudio(audio.id)}
                        className="w-12 h-12 rounded-full bg-cream-300 flex items-center justify-center hover:bg-accent-coral hover:text-cream-100 transition-colors group"
                      >
                        <Play className="w-5 h-5 text-ink-50 group-hover:text-cream-100" />
                      </motion.button>
                    )}
                  </div>

                  {/* 中间：内容 */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-ink-50 bg-cream-200 px-2 py-0.5 rounded-lg">
                            #{index + 1}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color} flex items-center gap-1`}>
                            <StatusIcon className={`w-3 h-3 ${audio.status === 'generating' ? 'animate-spin' : ''}`} />
                            {status.label}
                          </span>
                          {audio.duration && (
                            <span className="text-xs text-ink-50">{audio.duration}</span>
                          )}
                        </div>
                        <h3 className="font-medium text-ink-300 mb-1">{audio.newsTitle}</h3>
                        {audio.scriptContent && (
                          <p className="text-sm text-ink-50 line-clamp-1">{audio.scriptContent}</p>
                        )}
                      </div>
                    </div>

                    {/* 播放进度条（正在播放时显示） */}
                    {isPlaying && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className="w-1 bg-accent-sage rounded-full waveform-bar"
                                style={{ animationDelay: `${i * 0.1}s` }}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-ink-50">正在播放...</span>
                          <div className="flex-1 h-1 bg-cream-300 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: '60%' }}
                              transition={{ duration: 3, ease: 'linear' }}
                              className="h-full bg-accent-sage rounded-full"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* 错误信息 */}
                    {audio.status === 'error' && audio.errorMsg && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-accent-coral">
                        <AlertCircle className="w-3 h-3" />
                        {audio.errorMsg}
                      </div>
                    )}
                  </div>

                  {/* 右侧：音色和操作 */}
                  <div className="w-48 bg-cream-200 p-4 flex flex-col justify-between">
                    {/* 音色选择 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {audio.speaker === 'luo' ? (
                          <Mic className="w-4 h-4 text-accent-coral" />
                        ) : (
                          <User className="w-4 h-4 text-accent-sage" />
                        )}
                        <span className="text-xs font-medium text-ink-300">音色</span>
                      </div>
                      <select
                        value={audio.speaker}
                        onChange={() => {}}
                        className="w-full px-3 py-2 bg-cream-100 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-accent-coral"
                      >
                        <option value="luo">彪悍罗</option>
                        <option value="wang">OK王</option>
                      </select>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-3">
                      {audio.status === 'completed' && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-2 bg-cream-100 rounded-xl text-sm text-ink-300 hover:bg-cream-300 transition-colors flex items-center justify-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            下载
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => regenerateAudio(audio.id)}
                            className="p-2 bg-cream-100 rounded-xl text-ink-50 hover:text-accent-coral hover:bg-cream-300 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-6 right-8 flex items-center gap-4">
        <div className="bg-ink-300 text-cream-100 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          已生成 {completedCount} / {audios.length} 个片段
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={completedCount < audios.length}
          className="px-6 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium shadow-lg hover:bg-accent-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          合并音频 →
        </motion.button>
      </div>
    </div>
  )
}
