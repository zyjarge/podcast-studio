# Podcast Factory 产品需求文档

## 1. 产品概述

**产品名称**: Podcast Factory (播客创作工作站)

**产品定位**: AI 播客生成系统 - 帮助用户从新闻 RSS 源自动采集内容，生成播客逐字稿，并合成音频节目。

**目标用户**: 内容创作者、媒体从业者、个人博主

---

## 2. 核心功能

### 2.1 RSS 源管理

- **多源支持**: 支持添加多个 RSS 源
- **启用/禁用**: 可单独启用或禁用每个 RSS 源
- **自动模式标记**: 可标记某些源用于自动模式
- **添加/编辑/删除**: 完整的 CRUD 操作

### 2.2 新闻池

- **多源展示**: 按 RSS 源以看板(Kanban)形式展示新闻
- **预览功能**: 查看新闻标题、摘要、关键词
- **外部链接**: 跳转到原文
- **选择新闻**: 勾选多条新闻添加到节目

### 2.3 节目管理

- **创建节目**: 新建播客节目
- **状态追踪**: 草稿(draft)、编辑中(editing)、已发布(published)
- **进度显示**: 已完成新闻数/总新闻数
- **发布时间**: 记录发布时间

### 2.4 节目编辑 (核心页面)

**左侧面板 - 新闻列表**
- 显示节目中所有新闻
- 拖拽排序
- 每条新闻状态颜色标识:
  - `pending` - 待处理 (灰色)
  - `generating` - 生成中 (蓝色)
  - `script_done` - 脚本已完成 (绿色)
  - `audio_done` - 音频已完成 (橙色)
  - `error` - 错误 (红色)
- 批量添加新闻按钮
- 批量生成按钮

**右侧面板 - 新闻精编**
- 显示选中的新闻内容
- **编辑提示词**: 自定义发送给 LLM 的提示词模板
- **LLM 预览**: 直接展示发送给 LLM 的正文内容 (非弹窗)
  - 提供"全屏查看"按钮
- **生成脚本**: 将内容转为播客逐字稿
- **生成音频**: 将逐字稿转为语音
- **单独重生成**: 支持单独重新生成脚本或音频

### 2.5 两种工作模式

| 模式 | 说明 |
|------|------|
| 精编模式 (Refine) | 手动处理：逐条选择新闻、手动编辑提示词、逐条生成脚本和音频 |
| 自动模式 (Auto) | 自动化处理：使用预设配置批量生成 |

### 2.6 开场/结尾预设

- 可配置开场白模板
- 可配置结束语模板
- 预设音频片段

---

## 3. 技术栈

- **前端**: React 18 + Vite
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **拖拽**: @dnd-kit
- **图标**: Lucide React
- **路由**: React Router

---

## 4. UI 设计规范

### 4.1 配色方案 (非深色主题)

```
主色调:
- cream-100: #FDFBF7 (最浅背景)
- cream-200: #F5F0E6 (侧边栏/卡片背景)
- cream-300: #E8E0D0 (边框/分割线)
- cream-400: #D4C9B5 (hover 背景)

文字色:
- ink-300: #2D2A24 (主要文字)
- ink-50: #6B6659 (次要文字)

强调色:
- accent-coral: #E07A5F (珊瑚红 - 主按钮/重要操作)
- accent-sage: #81B29A (鼠尾草绿 - 成功/完成状态)
- accent-gold: #D4A373 (金色 - 草稿状态)
- accent-sky: #6CA0DC (天空蓝 - 进行中状态)
```

### 4.2 页面结构

- **侧边栏**: 固定左侧，宽度 256px
- **主内容区**: 右侧自适应
- **圆角**: 大面积使用圆角 (rounded-2xl/rounded-3xl)
- **阴影**: 柔和阴影效果

### 4.3 页面路由

| 路由 | 页面 |
|------|------|
| `/` | 节目列表 (EpisodeList) |
| `/episode/:id` | 节目编辑 (EpisodeDetail) |
| `/news-pool` | 新闻池 (NewsPool) |
| `/settings` | 设置 (Settings) - 含 RSS 源管理 |

---

## 5. 工作流程

```
1. 创建节目
   └─ 设置节标题

2. 添加新闻
   └─ 从新闻池选择多条新闻
   └─ 批量添加到节目

3. 精编每条新闻
   └─ 选中新闻
   └─ 编辑提示词
   └─ 预览 LLM 内容
   └─ 生成脚本
   └─ 生成音频
   └─ (可单独重生成)

4. 整合发布
   └─ 合并所有音频
   └─ 添加开场/结尾
   └─ 发布节目
```

---

## 6. 数据模型

### 6.1 节目 (Episode)

```typescript
interface Episode {
  id: string
  title: string
  status: 'draft' | 'editing' | 'published'
  createdAt: string
  publishedAt: string | null
  newsCount: number
  completedNewsCount: number
  totalDuration: string
}
```

### 6.2 新闻 (News)

```typescript
interface News {
  id: string
  title: string
  source: string
  url: string
  summary: string
  keywords: string[]
  status: 'pending' | 'generating' | 'script_done' | 'audio_done' | 'error'
  prompt?: string
  script?: string
  audioUrl?: string
}
```

### 6.3 RSS 源 (RSSSource)

```typescript
interface RSSSource {
  id: string
  name: string
  url: string
  enabled: boolean
  autoMode: boolean
}
```

---

## 7. 状态说明

### 7.1 节目状态

| 状态 | 说明 |
|------|------|
| draft | 草稿 - 刚创建 |
| editing | 编辑中 - 正在处理新闻 |
| published | 已发布 - 节目已完成 |

### 7.2 新闻状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 - 未开始生成 |
| generating | 生成中 - 正在调用 LLM/音频服务 |
| script_done | 脚本完成 - 逐字稿已生成 |
| audio_done | 音频完成 - 语音已生成 |
| error | 错误 - 生成失败 |

---

## 8. 页面详细说明

### 8.1 节目列表页 (EpisodeList)

- 显示日期
- "新建节目" 按钮
- 统计卡片: 全部/草稿/编辑中/已发布
- 节目卡片列表:
  - 状态指示条 (颜色区分)
  - 状态标签
  - 标题
  - 元信息 (创建时间/新闻数/时长)
  - 进度条
  - 操作按钮 (播放/编辑)

### 8.2 节目编辑页 (EpisodeDetail)

- 左右分栏布局
- 左侧: 新闻列表 (可拖拽排序)
- 右侧: 选中新闻的精编面板
- 顶部: 节目信息 + 模式切换

### 8.3 新闻池页 (NewsPool)

- 按 RSS 源分类的看板视图
- 新闻预览卡片
- 批量选择添加到节目

### 8.4 设置页 (Settings)

- 多个标签页
- RSS 源管理标签:
  - 源列表
  - 添加新源
  - 启用/禁用开关
  - 自动模式标记

---

## 9. 后续开发计划

- [ ] 后端 API 集成
- [ ] LLM 服务集成 (生成逐字稿)
- [ ] 音频合成服务集成 (TTS)
- [ ] 数据库持久化
- [ ] 用户认证
- [ ] 导出功能 (MP3)
- [ ] 播放预览功能
