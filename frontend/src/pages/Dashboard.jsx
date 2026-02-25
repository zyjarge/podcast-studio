import { motion } from 'framer-motion'
import {
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Volume2,
  ArrowRight,
  Calendar,
  Sparkles,
  Zap
} from 'lucide-react'

const todayDate = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const mockStats = [
  { label: '新闻采集', value: '28', icon: FileText, color: 'accent-coral', trend: '+12%' },
  { label: '已选新闻', value: '8/10', icon: CheckCircle2, color: 'accent-sage', trend: '' },
  { label: '逐字稿', value: '5/8', icon: FileText, color: 'accent-gold', trend: '' },
  { label: '音频片段', value: '5/8', icon: Volume2, color: 'accent-sky', trend: '' },
]

const recentEpisodes = [
  {
    id: 1,
    date: '2026-02-24',
    title: 'AI 助手的进化之路',
    status: 'completed',
    duration: '18:32',
    newsCount: 8
  },
  {
    id: 2,
    date: '2026-02-23',
    title: '科技巨头的最新动态',
    status: 'completed',
    duration: '21:15',
    newsCount: 10
  },
  {
    id: 3,
    date: '2026-02-22',
    title: '智能硬件的未来',
    status: 'draft',
    duration: '--:--',
    newsCount: 6
  },
]

const quickActions = [
  {
    title: '抓取新闻',
    description: '从 RSS 源获取最新资讯',
    icon: Sparkles,
    action: 'fetch',
    color: 'accent-coral'
  },
  {
    title: '生成逐字稿',
    description: 'AI 撰写播客脚本',
    icon: FileText,
    action: 'generate-script',
    color: 'accent-gold'
  },
  {
    title: '合成音频',
    description: '文字转语音',
    icon: Volume2,
    action: 'generate-audio',
    color: 'accent-sage'
  },
  {
    title: '整合发布',
    description: '合并音频并导出',
    icon: Zap,
    action: 'integrate',
    color: 'accent-sky'
  },
]

export default function Dashboard({ currentMode }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 min-h-screen"
    >
      {/* 头部 */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-ink-50 text-sm mb-1">欢迎回来</p>
            <h1 className="font-display text-3xl font-semibold text-ink-300">
              {currentMode === 'refine' ? '精编工作台' : '自动生成'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-ink-50 bg-cream-200 px-4 py-2 rounded-xl">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{todayDate}</span>
          </div>
        </div>
      </motion.div>

      {/* 统计卡片 */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-4 mb-8">
        {mockStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-cream-100 rounded-2xl p-5 card-hover border border-cream-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${stat.color} bg-opacity-20 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${stat.color}`} />
                </div>
                {stat.trend && (
                  <span className="flex items-center gap-1 text-xs text-accent-sage">
                    <TrendingUp className="w-3 h-3" />
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="text-3xl font-display font-semibold text-ink-300 mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-ink-50">{stat.label}</p>
            </div>
          )
        })}
      </motion.div>

      {/* 快捷操作 */}
      <motion.div variants={itemVariants} className="mb-8">
        <h2 className="font-display text-xl font-semibold text-ink-300 mb-4">快捷操作</h2>
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <motion.button
                key={action.action}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="bg-cream-100 rounded-2xl p-5 text-left border border-cream-300 hover:border-accent-sage transition-colors group"
              >
                <div className={`w-12 h-12 rounded-xl bg-${action.color} bg-opacity-20 flex items-center justify-center mb-4 group-hover:bg-opacity-30 transition-colors`}>
                  <Icon className={`w-6 h-6 text-${action.color}`} />
                </div>
                <h3 className="font-medium text-ink-300 mb-1">{action.title}</h3>
                <p className="text-sm text-ink-50">{action.description}</p>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* 最近节目 */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-ink-300">最近节目</h2>
          <button className="flex items-center gap-1 text-sm text-accent-coral hover:text-accent-coral/80 transition-colors">
            查看全部 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-cream-100 rounded-2xl border border-cream-300 overflow-hidden">
          {recentEpisodes.map((episode, index) => (
            <div
              key={episode.id}
              className={`flex items-center justify-between p-4 ${
                index !== recentEpisodes.length - 1 ? 'border-b border-cream-300' : ''
              } hover:bg-cream-200 transition-colors cursor-pointer`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  episode.status === 'completed' ? 'bg-accent-sage/20' : 'bg-accent-gold/20'
                }`}>
                  {episode.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-accent-sage" />
                  ) : (
                    <Clock className="w-5 h-5 text-accent-gold" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-ink-300">{episode.title}</h3>
                  <p className="text-sm text-ink-50">{episode.date} · {episode.newsCount} 条新闻</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-ink-50">{episode.duration}</span>
                <button className="w-8 h-8 rounded-full bg-cream-300 hover:bg-accent-coral hover:text-cream-100 flex items-center justify-center transition-colors">
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 当前进度提示 */}
      {currentMode === 'refine' && (
        <motion.div
          variants={itemVariants}
          className="mt-8 bg-cream-200 rounded-2xl p-6 border border-cream-400"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-coral/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-accent-coral" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-ink-300 mb-1">当前进度</h3>
              <p className="text-sm text-ink-50 mb-3">
                已完成新闻筛选和逐字稿生成，还剩 3 条新闻的音频待生成
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-cream-400 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '62%' }}
                    transition={{ duration: 1 }}
                    className="h-full bg-accent-coral rounded-full"
                  />
                </div>
                <span className="text-sm text-ink-50">62%</span>
              </div>
            </div>
            <button className="px-4 py-2 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors">
              继续编辑
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
