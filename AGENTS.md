
### 🏁 目标：构建“Podcast Factory”——基于 LangGraph 的 AI 对谈播客自动生成系统

**1. 项目背景与技术栈**

* **核心功能**：自动抓取热点新闻，生成罗永浩（Luo）与王自如（Wang）风格的 20 分钟对谈脚本，并调用 MiniMax TTS 生成音频。
* **技术栈**：Python 3.10+, LangGraph, LangChain, FastAPI, HTTPX, Pydantic, FFmpeg, Docker。
* **AI 模型**：使用 Gemini 2.5 Flash 或 Pro 进行逻辑调度与长文本生成。

**2. 数据流设计 (Workflow)**
请按照以下 **Map-Reduce** 拓扑结构实现 LangGraph 状态机：

* **Fetch Node**：调用 `https://newsnow.busiyi.world/api/hot?type=wallstreetcn-news` 抓取新闻。
* **Filter Node**：使用正则表达式剔除包含 `/member/` 的付费墙 URL。
* **Crawl & Summarize Node (Map)**：并发使用 `r.jina.ai` 获取正文 JSON，并调用 LLM 提取 3-5 条硬核对谈素材。
* **Planner Node**：将所有摘要汇总，规划出 3-4 个深度对谈板块的大纲。
* **Writer Node (Reduce/Stateful)**：分段生成罗永浩（犀利吐槽、解构、情怀）与王自如（专业参数、平衡、底层逻辑）的对谈脚本。单次生成约 1500 字，循环直至达到 5000+ 字。
* **TTS Node**：解析脚本中的 `speaker` 标签，并发调用 MiniMax TTS 接口（我已备好基本接口），根据角色分配音色 ID。

**3. 核心代码结构要求**
请按照我之前制定的路径生成代码：

* `app/graph/state.py`：定义 `PodcastState`，包含 `news_list`, `summaries`, `script_segments` 等。
* `app/graph/nodes.py`：实现上述所有节点逻辑，要求具备重试机制和错误处理。
* `app/agents/prompts.py`：存储两个角色的“风格指纹”Prompt，老罗要爱说“漂亮得不像实力派”、“我不在乎输赢”，王自如要爱说“底层逻辑”、“平衡点”。
* `app/services/tts.py`：封装 MiniMax 异步调用逻辑。

**4. 额外工程约束**

* **并发控制**：在 Map 阶段使用 `asyncio.gather` 并限制并发数，防止触发 Gemini 的 429 限流。
* **长文本一致性**：利用 LangGraph 的 `State` 保持对话的上下文连贯性，确保后半段能引用前半段的梗。
* **容器化**：生成一个标准的 `Dockerfile` 和 `docker-compose.yml`，以便我在现有服务器上部署。
