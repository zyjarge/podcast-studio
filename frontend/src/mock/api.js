// 模拟异步接口：全部本地定时器实现，绝不发起真实网络请求
import { getState, addNewsItems, markFetched } from './store'
import { pickCoverVariants } from './cover'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const rand = (min, max) => Math.floor(min + Math.random() * (max - min))

/** 常规操作延迟 300–800ms */
export const mockDelay = () => delay(rand(300, 800))

/** 抓取新闻：约 1.5s，把预留池里的新闻"抓"进新闻池 */
export async function mockFetchNews() {
  await delay(1500)
  const { fetchPool, news } = getState()
  const fresh = fetchPool.filter((n) => !news.some((x) => x.id === n.id))
  const picked = fresh.slice(0, rand(2, 4))
  const added = addNewsItems(picked)
  markFetched()
  return { added, total: getState().news.length }
}

/** 抓取单个源：约 1.2s */
export async function mockFetchSource() {
  await delay(rand(1000, 1400))
  markFetched()
  return { added: rand(2, 6) }
}

// ── 话题聚类（模拟 LLM 对新闻池的预处理） ──

/**
 * 把新闻池聚成话题：原型用关键词重叠聚类模拟，正式版由 LLM 输出话题名与概括
 * 返回 [{ id, title, summary, newsIds, representativeId, topScore, keywords }]，按最高分倒序
 */
export async function mockClusterTopics() {
  await delay(rand(1800, 2600))
  const { news } = getState()

  // 并查集：共享任一关键词的新闻归为一簇
  const parent = new Map(news.map((n) => [n.id, n.id]))
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  const byKw = new Map()
  news.forEach((n) =>
    (n.keywords || []).forEach((k) => {
      if (!byKw.has(k)) byKw.set(k, [])
      byKw.get(k).push(n.id)
    })
  )
  byKw.forEach((ids) => ids.forEach((id) => {
    const a = find(ids[0])
    const b = find(id)
    if (a !== b) parent.set(a, b)
  }))

  const groups = new Map()
  news.forEach((n) => {
    const root = find(n.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(n)
  })

  return [...groups.values()]
    .map((items) => {
      items.sort((a, b) => b.score - a.score)
      const kwCount = {}
      items.forEach((n) => (n.keywords || []).forEach((k) => { kwCount[k] = (kwCount[k] || 0) + 1 }))
      const topKws = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)
      return {
        id: `topic-${items[0].id}`,
        title: topKws.join(' · ') || items[0].source,
        summary: items[0].summary,
        newsIds: items.map((n) => n.id),
        representativeId: items[0].id,
        topScore: items[0].score,
        keywords: topKws,
      }
    })
    .sort((a, b) => b.topScore - a.topScore)
}

/** 验证 API Key：600–900ms，mock 永远成功 */
export async function mockVerifyKeys() {
  await delay(rand(600, 900))
  return { deepseek: 'ok', minimax: 'ok' }
}

// ── 逐字稿生成（板块化：同话题集中讨论 + 板块过渡 + 引申段 + 速览收尾） ──

const OPENERS = [
  '**彪悍罗：** 各位好，欢迎收听科技双响炮，我是彪悍罗。',
  '**OK王：** 我是 OK 王。今天我们聊点硬的。',
]

const CLOSERS = [
  '**彪悍罗：** 好，今天的双响炮就到这里。记住：看热闹更要看门道。我是彪悍罗。',
  '**OK王：** 我是 OK 王，明天见。',
]

const TRANSITIONS = [
  '好，这个话题先聊到这。咱们换个方向——',
  '行，这事捋清楚了。接下来这条线也很有意思——',
  '这个板块收个尾。下面这个话题，跟刚才的其实暗暗相关——',
]

// 引申段：明示"是我们的联想"，不编造素材之外的事实
const SEGMENT_EXT = [
  {
    luo: '插一句题外话。这事儿让我想到更大的盘子：技术的竞争从来不只是技术，背后是产业链、资本、甚至政策的全面较劲。',
    wang: '对，说明一下，这是我们基于公开信息的联想，不构成投资建议。但这个角度有价值——单点新闻要放进结构里看。',
  },
  {
    luo: '顺着这个思路往外走一层：当一个赛道的玩家扎堆在同一时间发声，说明窗口期在收窄，大家都急了。',
    wang: '补充一句，这只是我们的推演。不过从产业节奏看，密集发布通常预示商业化拐点临近，这个判断留给时间检验。',
  },
]

/** 把节目素材按话题分组（保持话题原有排序，未入话题的各自成组） */
function groupByTopics(newsItems, topics) {
  const groups = []
  const assigned = new Set()
  ;(topics || []).forEach((t) => {
    const members = newsItems.filter((n) => t.newsIds.includes(n.id))
    if (members.length > 0) {
      groups.push({ title: t.title, members })
      members.forEach((m) => assigned.add(m.id))
    }
  })
  newsItems.filter((n) => !assigned.has(n.id)).forEach((n) => groups.push({ title: null, members: [n] }))
  return groups
}

function buildDialogueForNews(news, index) {
  const seg = rand(0, 1)
  const luoLines = [
    `先聊第${'一二三四五六'[index] || index + 1}条——${news.title}。我看到这条的第一反应是：漂亮得不像实力派。${news.summary.replace(/。$/, '')}，这事儿表面是新闻，里子是行业要变天。`,
    `再看这条，${news.title}。说实话我看完血压有点高——${news.summary.replace(/。$/, '')}。我不在乎输赢，但这种把用户当韭菜割的玩法，我必须说两句。`,
    `这条有意思了：${news.title}。${news.summary.replace(/。$/, '')}。做产品这么多年，我的直觉是：这事没那么简单，咱们得拆开揉碎聊。`,
  ]
  const wangLines = [
    `我补充下底层逻辑。${news.content.slice(0, 60)}……核心变量其实就两个：成本和效率。谁能在这两点上建立数量级优势，谁就能定义下一个周期，这跟当年智能手机替代功能机的路径高度一致。`,
    `从数据维度看，这件事要找一个平衡点。${news.content.slice(0, 50)}……短期看是情绪驱动，长期看是结构使然。我建议关注三个指标的变化：渗透率、单位成本、以及头部玩家的资本开支。`,
    `老罗说的情绪我认，但咱们落到参数上。${news.content.slice(0, 55)}……这背后的底层逻辑是供给端的结构性变化，需求端只是被点燃而已。判断接下来 6 个月，关键看供给能不能持续跟上。`,
  ]
  const luoFollow = [
    '漂亮。你这话翻译成人话就是：风口是真的，但风停之后摔死的也是真的。所以各位听友，看新闻别只看标题，标题是别人的生意，思考才是自己的。',
    '说得好像很理性，但我补充一句感性的：所有伟大的产品，起点都是有人不计成本地把体验做到极致。参数决定下限，理想决定上限。',
  ]
  const wangFollow = [
    '不完全同意，但这就是对谈的价值。我们把这条的要点收一下：事实层面看供给，预期层面看流动性，操作层面别追高。下一条。',
    '这里我们求同存异。对普通用户来说，平衡点在于：新技术的第一批产品可以买情怀，但别买太多。',
  ]
  return [
    `**彪悍罗：** ${luoLines[(index + seg) % luoLines.length]}`,
    `**OK王：** ${wangLines[(index + seg) % wangLines.length]}`,
    `**彪悍罗：** ${luoFollow[(index + seg) % luoFollow.length]}`,
    `**OK王：** ${wangFollow[(index + seg) % wangFollow.length]}`,
  ]
}

/** 多报道板块：同话题新闻合并讨论、互相印证 */
function buildSegmentDialogue(group, segIdx) {
  const { title, members } = group
  if (members.length === 1) return buildDialogueForNews(members[0], segIdx)
  return [
    `**彪悍罗：** ${segIdx === 0 ? '今天第一个板块' : '下一个板块'}，聊「${title}」。这事儿今天不止一家在动：${members.map((m) => m.title).join('；')}。放一起看，味道就不一样了。`,
    `**OK王：** 对，单条看是新闻，连起来看是趋势。${members[0].content.slice(0, 55)}……而另一边，${members[1].summary.replace(/。$/, '')}。两条报道互相印证，说明这不是偶然动作。`,
    `**彪悍罗：** 我就说嘛，${members[0].summary.replace(/。$/, '')}——一条是巧合，一天之内 ${members.length} 条撞在一起，那就是信号。`,
    `**OK王：** 收一下这个板块的要点：事实层面，${members.length} 条报道指向同一个方向；预期层面，市场已经开始定价；操作层面，看清底层逻辑再行动。`,
  ]
}

/**
 * 基于节目素材生成逐字稿（板块化，约 7–9 秒）
 * onStage(阶段文案, 本期大纲) —— 大纲 = [{ name, count }]
 */
export async function mockGenerateScript(newsItems, onStage, topics = []) {
  // 第一阶段：规划板块（大纲通过回调同步给 UI 预览）
  const groups = groupByTopics(newsItems, topics)
  const outline = groups.map((g, i) => ({
    name: g.title || g.members[0].keywords?.[0] || `话题 ${i + 1}`,
    count: g.members.length,
  }))
  onStage?.('正在规划本期板块…', outline)
  await delay(rand(1800, 2400))
  onStage?.('正在撰写对话…', outline)
  await delay(rand(3600, 4600))

  const MAX_SEGMENTS = 4
  const main = groups.slice(0, MAX_SEGMENTS)
  const quick = groups.slice(MAX_SEGMENTS)

  const parts = [OPENERS[0], OPENERS[1]]
  main.forEach((g, i) => {
    parts.push(...buildSegmentDialogue(g, i))
    // 第二个板块后插一段引申（明示联想、不编事实）
    if (i === 1 && main.length > 2) {
      const ext = SEGMENT_EXT[rand(0, SEGMENT_EXT.length)]
      parts.push(`**彪悍罗：** ${ext.luo}`, `**OK王：** ${ext.wang}`)
    }
    if (i < main.length - 1) parts.push(`**彪悍罗：** ${TRANSITIONS[rand(0, TRANSITIONS.length)]}`)
  })
  // 超出 4 个主板块的话题并入"快讯速览"
  if (quick.length > 0) {
    parts.push(
      `**彪悍罗：** 最后再快速过几条今天也值得关注的：${quick.map((g) => g.members[0].title).join('；')}。时间关系不展开，感兴趣的听友可以自己搜一下。`
    )
    parts.push('**OK王：** 补充一句，速览不等于不重要——今天放不下的话题，明天可能就是头条。')
  }
  parts.push(CLOSERS[0], CLOSERS[1])
  return parts.join('\n\n')
}

// ── 标题生成 ──

/** 标题风格模板：用素材关键词拼装，让候选"看起来懂内容" */
const TITLE_STYLES = [
  { style: '观点型', make: (a, b) => `别再只盯着${a}了，真正变天的是${b}` },
  { style: '悬念型', make: (a, b) => `${a}狂飙背后，谁在为${b}买单？` },
  { style: '盘点型', make: (a, b) => `本期焦点：${a}、${b}，和一条被低估的新闻` },
  { style: '热点型', make: (a) => `${a}刷屏，这次真的不一样？` },
  { style: '对撞型', make: (a, b) => `${a}对决${b}：风口还是泡沫？` },
]

/** 基于节目素材生成 3 条标题候选（约 1.5–2.5 秒），返回 [{ text, style }] */
export async function mockGenerateTitles(newsItems) {
  await delay(rand(1500, 2500))
  const keywords = [...new Set(newsItems.flatMap((n) => n.keywords || []))]
  const pick = () => keywords.splice(rand(0, keywords.length), 1)[0]
  const fallback = ['本周科技圈最值得聊的三件事', '风口之上，先别急着下单', '这些新闻里藏着明年的走向']
  if (keywords.length < 2) {
    return fallback.slice(0, 3).map((text, i) => ({ text, style: TITLE_STYLES[i].style }))
  }
  const styles = [...TITLE_STYLES].sort(() => Math.random() - 0.5).slice(0, 3)
  return styles.map(({ style, make }) => {
    const a = pick() || 'AI'
    const b = pick() || '大模型'
    return { text: make(a, b), style }
  })
}

// ── 题图生成 ──

/** 生成题图：约 4–6 秒，返回 3 个风格变体参数 [{ paletteIdx, layout, label }] */
export async function mockGenerateCovers() {
  await delay(rand(4000, 6000))
  return pickCoverVariants()
}

// ── 图文正文生成 ──

const ARTICLE_QUOTES = [
  '技术的进步从不等待犹豫者，但盲目追风的人也走不远。',
  '看懂趋势的人，已经在悄悄布局；看懂泡沫的人，懂得什么时候下车。',
  '所有喧嚣的热点，最终都要接受价值的检验。',
  '风口年年有，能落地的才叫产业。',
]

const ARTICLE_COMMENTS = [
  '一句话总结：这件事的看点不在表面数字，而在它背后的产业节奏。',
  '值得留意的是，这不是孤立事件，而是一条清晰的演进路线的最新一站。',
  '表面是新闻，里子是格局——接下来半年，这条线的连锁反应值得持续跟踪。',
  '热闹之外，真正决定走向的是供给端的结构性变化。',
]

/** 基于节目素材生成公众号图文正文（Markdown，约 6–8 秒，分阶段回调） */
export async function mockGenerateArticle(newsItems, onStage) {
  onStage?.('正在提炼素材要点…')
  await delay(rand(2200, 3000))
  onStage?.('正在撰写正文…')
  await delay(rand(3200, 4200))

  const items = newsItems.slice(0, 5)
  const kws = [...new Set(items.flatMap((n) => n.keywords || []))]
  const headline = `今日焦点：${kws.slice(0, 2).join('、') || '科技前沿'}，与一条被低估的新闻`
  const lead = `今天的新闻池信息量不小。我们从 ${items.length} 条最值得关注的动态里，理出热闹背后的门道——看点不只是"发生了什么"，更是"接下来会怎样"。`

  const parts = [`# ${headline}`, '', lead, '']
  items.forEach((n, i) => {
    parts.push(`### ${n.title}`)
    parts.push('')
    parts.push(`${n.summary.replace(/。$/, '')}。${n.content.slice(0, 110)}……`)
    parts.push('')
    parts.push(ARTICLE_COMMENTS[i % ARTICLE_COMMENTS.length])
    parts.push('')
    if (i === 1 && items.length > 2) {
      parts.push(`> ${ARTICLE_QUOTES[rand(0, ARTICLE_QUOTES.length)]}`)
      parts.push('')
    }
  })
  parts.push('### 写在最后')
  parts.push('')
  parts.push(`以上就是今天的焦点梳理。新闻每天都在刷新，但判断力的积累需要时间——希望今天的解读，能帮你把信息变成自己的判断。`)
  parts.push('')
  parts.push('---')
  parts.push('*科技双响炮 · 焦点早知道 | 本文由 AI 辅助生成，发布前请人工复核*')
  return parts.join('\n')
}

// ── 音频生成 ──

/** 八阶段定义：key、文案、耗时区间、目标百分比（与 doc/UX_COPY.md 一致） */
const AUDIO_STAGES = [
  { key: 'starting', label: '正在准备…', ms: [800, 1100], pct: 3 },
  { key: 'parsing', label: '正在解析逐字稿…', ms: [1000, 1400], pct: 10 },
  { key: 'submitting', label: '正在提交配音任务', ms: [1100, 1400], pct: 20, dynamic: true },
  { key: 'processing', label: '配音生成中…（这个步骤最久，可以离开页面）', ms: [6000, 7000], pct: 78, ramp: true },
  { key: 'downloading', label: '正在下载音频片段…', ms: [1700, 2200], pct: 90 },
  { key: 'merging', label: '正在合并成完整节目…', ms: [1500, 1900], pct: 97 },
  { key: 'done', label: '搞定，可以试听了 🎧', ms: [0, 0], pct: 100 },
]

/**
 * 生成音频：总耗时约 12–15 秒，按阶段回调 { stage, label, percent }
 */
export async function mockGenerateAudio(scriptText, onProgress) {
  const segments = Math.max(
    2,
    (scriptText.match(/\*\*(彪悍罗|OK王)：\*\*/g) || []).length
  )
  let percent = 0
  for (const stage of AUDIO_STAGES) {
    const label = stage.dynamic
      ? `${stage.label}（${segments} 段）…`
      : stage.label
    const duration = rand(stage.ms[0], stage.ms[1])
    if (stage.ramp) {
      // processing 阶段分多个 tick，让百分比平滑爬升
      const ticks = 8
      const step = (stage.pct - percent) / ticks
      for (let i = 0; i < ticks; i++) {
        await delay(Math.round(duration / ticks))
        percent += step
        onProgress?.({ stage: stage.key, label, percent: Math.round(percent) })
      }
    } else {
      onProgress?.({ stage: stage.key, label, percent: Math.max(percent, stage.pct) })
      if (duration > 0) await delay(duration)
      percent = stage.pct
    }
  }
  // 假音频时长：按字数粗估（150 字/分钟），落在 10–18 分钟
  const chars = (scriptText || '').replace(/\s/g, '').length
  const minutes = Math.min(18, Math.max(10, Math.ceil(chars / 150)))
  const durationSec = minutes * 60 + rand(0, 59)
  return { duration: durationSec }
}
