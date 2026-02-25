# Podcast Studio - 播客管理工作台

一个精美、现代的 AI 播客管理后台界面。

## 预览

![Podcast Studio](./preview.png)

## 特性

- **精编模式** vs **自动模式** 切换
- **新闻池管理**：多 RSS 源配置、人工挑选新闻、设置提示词
- **逐字稿编辑**：逐条生成、编辑、预览
- **音频工作室**：逐条生成音频、单独播放、重生成
- **整合配置**：拖拽排序、intro/outro 选择、BGM 配置
- **设置页面**：主播配置、音色设置、API 配置、定时任务

## 设计风格

- 明亮的奶油色主题（非暗色）
- 独特的字体搭配（Playfair Display + Source Sans 3）
- 丰富的交互动画（Framer Motion）
- 报纸/编辑工作室美学风格

## 快速开始

### 安装依赖

```bash
cd V1/frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

## 技术栈

- React 18
- Vite
- Tailwind CSS
- Framer Motion
- React Router DOM
- @dnd-kit (拖拽排序)
- Lucide React (图标)

## 项目结构

```
src/
├── components/
│   └── Sidebar.jsx       # 侧边栏导航
├── pages/
│   ├── Dashboard.jsx     # 控制台首页
│   ├── NewsPool.jsx     # 新闻池管理
│   ├── ScriptEditor.jsx # 逐字稿编辑
│   ├── AudioStudio.jsx  # 音频工作室
│   ├── Integration.jsx  # 整合配置
│   └── Settings.jsx     # 设置页面
├── App.jsx
├── main.jsx
└── index.css
```

## 许可证

MIT
