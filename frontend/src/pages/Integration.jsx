import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Plus,
  Music,
  Volume2,
  GripVertical,
  Trash2,
  Download,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Layers
} from 'lucide-react'

// 模拟整合数据
const mockItems = [
  { id: 1, type: 'intro', title: '开场白 - 科技双响炮', duration: '0:15', enabled: true },
  { id: 2, type: 'news', title: 'Anthropic 推出智能体 AI 工具', duration: '3:24', enabled: true, newsId: 1 },
  { id: 3, type: 'news', title: 'OpenAI GPT-5 即将发布', duration: '2:15', enabled: true, newsId: 2 },
  { id: 4, type: 'news', title: '苹果 Vision Pro 2 配备 RGB LCOS', duration: '2:45', enabled: true, newsId: 3 },
  { id: 5, type: 'news', title: '英伟达发布新一代数据中心 GPU', duration: '3:10', enabled: true, newsId: 4 },
  { id: 6, type: 'outro', title: '结束语 - 下期预告', duration: '0:20', enabled: true },
]

const mockIntros = [
  { id: 1, name: '科技双响炮 - 标准版', file: 'intro_standard.mp3', duration: '0:15' },
  { id: 2, name: '科技双响炮 - 春节特别版', file: 'intro_spring.mp3', duration: '0:18' },
  { id: 3, name: '科技双响炮 - 年度总结版', file: 'intro_yearly.mp3', duration: '0:20' },
]

const mockOutros = [
  { id: 1, name: '标准结束语', file: 'outro_standard.mp3', duration: '0:20' },
  { id: 2, name: '春节祝福版', file: 'outro_spring.mp3', duration: '0:25' },
  { id: 3, name: '下期预告版', file: 'outro_preview.mp3', duration: '0:18' },
]

const mockBgMusics = [
  { id: 1, name: '无', file: null, duration: null },
  { id: 2, name: '轻快背景音乐', file: 'bgm_light.mp3', duration: '5:00' },
  { id: 3, name: '舒缓钢琴曲', file: 'bgm_piano.mp3', duration: '5:00' },
  { id: 4, name: '科技感配乐', file: 'bgm_tech.mp3', duration: '5:00' },
]

// 可排序项组件
function SortableItem({ item, onToggle, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.9 : 1,
  }

  const isIntro = item.type === 'intro'
  const isOutro = item.type === 'outro'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-cream-100 rounded-2xl border transition-all ${
        isDragging ? 'shadow-xl border-accent-coral scale-[1.02]' :
        item.enabled ? 'border-cream-300 hover:border-cream-400' : 'border-cream-400 opacity-60'
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        {/* 拖拽手柄 - 整行可拖 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-cream-200 rounded-xl transition-colors touch-none"
        >
          <GripVertical className="w-5 h-5 text-ink-50" />
        </div>

        {/* 类型图标 */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isIntro ? 'bg-accent-gold/20' : isOutro ? 'bg-accent-sky/20' : 'bg-accent-coral/20'
        }`}>
          {isIntro ? (
            <Sparkles className="w-5 h-5 text-accent-gold" />
          ) : isOutro ? (
            <Layers className="w-5 h-5 text-accent-sky" />
          ) : (
            <Volume2 className="w-5 h-5 text-accent-coral" />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1">
          <h3 className={`font-medium ${item.enabled ? 'text-ink-300' : 'text-ink-50'}`}>
            {item.title}
          </h3>
          <p className="text-xs text-ink-50">{item.duration}</p>
        </div>

        {/* 开关 */}
        <button
          onClick={() => onToggle(item.id)}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            item.enabled ? 'bg-accent-sage' : 'bg-cream-400'
          }`}
        >
          <motion.div
            animate={{ x: item.enabled ? 24 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-5 h-5 bg-white rounded-full shadow-sm"
          />
        </button>

        {/* 删除 */}
        <button
          onClick={() => onRemove(item.id)}
          className="p-2 hover:bg-cream-200 rounded-xl transition-colors text-ink-50 hover:text-accent-coral"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// 拖拽覆盖层 - 拖拽时显示的样式
function DragOverlayItem({ item }) {
  const isIntro = item.type === 'intro'
  const isOutro = item.type === 'outro'

  return (
    <div className="bg-cream-100 rounded-2xl border-2 border-accent-coral shadow-2xl scale-[1.02]">
      <div className="flex items-center gap-4 p-4">
        <div className="p-2 bg-cream-200 rounded-xl">
          <GripVertical className="w-5 h-5 text-accent-coral" />
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isIntro ? 'bg-accent-gold/20' : isOutro ? 'bg-accent-sky/20' : 'bg-accent-coral/20'
        }`}>
          {isIntro ? (
            <Sparkles className="w-5 h-5 text-accent-gold" />
          ) : isOutro ? (
            <Layers className="w-5 h-5 text-accent-sky" />
          ) : (
            <Volume2 className="w-5 h-5 text-accent-coral" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-ink-300">{item.title}</h3>
          <p className="text-xs text-ink-50">{item.duration}</p>
        </div>
      </div>
    </div>
  )
}

export default function Integration() {
  const [items, setItems] = useState(mockItems)
  const [selectedIntro, setSelectedIntro] = useState(mockIntros[0])
  const [selectedOutro, setSelectedOutro] = useState(mockOutros[0])
  const [selectedBgm, setSelectedBgm] = useState(mockBgMusics[0])
  const [bgmVolume, setBgmVolume] = useState(30)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showIntroPicker, setShowIntroPicker] = useState(false)
  const [showOutroPicker, setShowOutroPicker] = useState(false)
  const [showBgmPicker, setShowBgmPicker] = useState(false)
  const [activeId, setActiveId] = useState(null)

  // 配置传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 计算总时长
  const totalDuration = items
    .filter(item => item.enabled)
    .reduce((acc, item) => {
      const [min, sec] = item.duration.split(':').map(Number)
      return acc + min * 60 + sec
    }, 0)

  const formatDuration = (seconds) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      setItems(arrayMove(items, oldIndex, newIndex))
    }

    setActiveId(null)
  }

  const toggleItem = (id) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    ))
  }

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id))
  }

  const activeItem = activeId ? items.find(item => item.id === activeId) : null

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 左侧：项目列表 */}
      <div className="w-2/3 flex flex-col border-r border-cream-400">
        <div className="p-6 border-b border-cream-400">
          <h1 className="font-display text-2xl font-semibold text-ink-300 mb-1">整合配置</h1>
          <p className="text-sm text-ink-50">拖拽排序新闻片段，选择 intro/outro，添加背景音乐</p>
        </div>

        {/* 拖拽排序区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onToggle={toggleItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeItem ? <DragOverlayItem item={activeItem} /> : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* 底部统计 */}
        <div className="p-4 border-t border-cream-400 bg-cream-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-50">
                共 <span className="font-medium text-ink-300">{items.filter(i => i.enabled).length}</span> 个片段
              </span>
              <span className="text-sm text-ink-50">
                总时长 <span className="font-medium text-accent-coral">{formatDuration(totalDuration)}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-cream-300 text-ink-300 rounded-lg text-sm hover:bg-cream-400 transition-colors">
                <Plus className="w-4 h-4" />
                添加片段
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：配置面板 */}
      <div className="w-1/3 bg-cream-50 flex flex-col">
        <div className="p-6 border-b border-cream-400">
          <h2 className="font-display text-lg font-semibold text-ink-300 mb-2">全局配置</h2>
          <p className="text-sm text-ink-50">设置开场、结束和背景音乐</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 开场白选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
              <Sparkles className="w-4 h-4 text-accent-gold" />
              开场白 (Intro)
            </label>
            <div className="relative">
              <button
                onClick={() => setShowIntroPicker(!showIntroPicker)}
                className="w-full flex items-center justify-between px-4 py-3 bg-cream-100 border border-cream-400 rounded-xl hover:border-accent-gold transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent-gold/20 rounded-lg flex items-center justify-center">
                    <Play className="w-4 h-4 text-accent-gold" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-ink-300">{selectedIntro.name}</p>
                    <p className="text-xs text-ink-50">{selectedIntro.duration}</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-ink-50 transition-transform ${showIntroPicker ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showIntroPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-cream-100 border border-cream-400 rounded-xl shadow-lg z-10 overflow-hidden"
                  >
                    {mockIntros.map(intro => (
                      <button
                        key={intro.id}
                        onClick={() => {
                          setSelectedIntro(intro)
                          setShowIntroPicker(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-200 transition-colors ${
                          selectedIntro.id === intro.id ? 'bg-cream-200' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-accent-gold/20 rounded-lg flex items-center justify-center">
                          <Play className="w-4 h-4 text-accent-gold" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-ink-300">{intro.name}</p>
                          <p className="text-xs text-ink-50">{intro.duration}</p>
                        </div>
                        {selectedIntro.id === intro.id && (
                          <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 结束语选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
              <Layers className="w-4 h-4 text-accent-sky" />
              结束语 (Outro)
            </label>
            <div className="relative">
              <button
                onClick={() => setShowOutroPicker(!showOutroPicker)}
                className="w-full flex items-center justify-between px-4 py-3 bg-cream-100 border border-cream-400 rounded-xl hover:border-accent-sky transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent-sky/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-4 h-4 text-accent-sky" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-ink-300">{selectedOutro.name}</p>
                    <p className="text-xs text-ink-50">{selectedOutro.duration}</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-ink-50 transition-transform ${showOutroPicker ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showOutroPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-cream-100 border border-cream-400 rounded-xl shadow-lg z-10 overflow-hidden"
                  >
                    {mockOutros.map(outro => (
                      <button
                        key={outro.id}
                        onClick={() => {
                          setSelectedOutro(outro)
                          setShowOutroPicker(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-200 transition-colors ${
                          selectedOutro.id === outro.id ? 'bg-cream-200' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-accent-sky/20 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4 text-accent-sky" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-ink-300">{outro.name}</p>
                          <p className="text-xs text-ink-50">{outro.duration}</p>
                        </div>
                        {selectedOutro.id === outro.id && (
                          <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 背景音乐选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-300 mb-3">
              <Music className="w-4 h-4 text-accent-coral" />
              背景音乐 (BGM)
            </label>
            <div className="relative">
              <button
                onClick={() => setShowBgmPicker(!showBgmPicker)}
                className="w-full flex items-center justify-between px-4 py-3 bg-cream-100 border border-cream-400 rounded-xl hover:border-accent-coral transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent-coral/20 rounded-lg flex items-center justify-center">
                    {selectedBgm.file ? (
                      <Music className="w-4 h-4 text-accent-coral" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-ink-50" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-ink-300">{selectedBgm.name}</p>
                    {selectedBgm.duration && (
                      <p className="text-xs text-ink-50">{selectedBgm.duration}</p>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-ink-50 transition-transform ${showBgmPicker ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showBgmPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-cream-100 border border-cream-400 rounded-xl shadow-lg z-10 overflow-hidden"
                  >
                    {mockBgMusics.map(bgm => (
                      <button
                        key={bgm.id}
                        onClick={() => {
                          setSelectedBgm(bgm)
                          setShowBgmPicker(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-200 transition-colors ${
                          selectedBgm.id === bgm.id ? 'bg-cream-200' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-accent-coral/20 rounded-lg flex items-center justify-center">
                          {bgm.file ? (
                            <Music className="w-4 h-4 text-accent-coral" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-ink-50" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-ink-300">{bgm.name}</p>
                          {bgm.duration && <p className="text-xs text-ink-50">{bgm.duration}</p>}
                        </div>
                        {selectedBgm.id === bgm.id && (
                          <CheckCircle2 className="w-4 h-4 text-accent-sage" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* BGM 音量控制 */}
          {selectedBgm.file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pt-2"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ink-50">BGM 音量</span>
                <span className="text-sm text-ink-300">{bgmVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={bgmVolume}
                onChange={(e) => setBgmVolume(Number(e.target.value))}
                className="w-full h-2 bg-cream-400 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent-coral [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm"
              />
            </motion.div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="p-6 border-t border-cream-400 bg-cream-200">
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-coral text-cream-100 rounded-xl font-medium hover:bg-accent-coral/90 transition-colors">
              <Layers className="w-4 h-4" />
              合并生成最终音频
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cream-100 text-ink-300 rounded-xl font-medium hover:bg-cream-300 transition-colors">
              <Download className="w-4 h-4" />
              导出全部素材
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
