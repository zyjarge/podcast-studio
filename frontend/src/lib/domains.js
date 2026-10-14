// 领域归类：关键词规则（mock 智能分类）。
// 按 DOMAINS 顺序命中即归，匹配 title + keywords + summary；
// 纯 ASCII 词用整词匹配（避免 AI 误中 said/email），含中文的词用子串匹配。

const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toTester = (kw) => {
  if (hasCJK(kw)) {
    const needle = kw.toLowerCase()
    return (text) => text.includes(needle)
  }
  const re = new RegExp(`\\b${escapeRe(kw)}\\b`, 'i')
  return (text) => re.test(text)
}

export const DOMAINS = [
  {
    id: 'ai',
    name: 'AI·大模型',
    badge: 'bg-accent-sky/10 text-accent-sky',
    keywords: [
      '大模型', '人工智能', '智能体', '多模态', 'AI', 'LLM', 'Agent',
      'DeepSeek', 'OpenAI', 'GPT', 'ChatGPT', 'Claude', 'Qwen', '通义',
      'Gemini', 'Gemma', 'Anthropic', 'Sora', 'Copilot', '豆包', 'Kimi',
      '文心', '智谱', 'GLM', 'Vibe Coding',
    ],
  },
  {
    id: 'hardware',
    name: '硬件·产品',
    badge: 'bg-accent-coral/10 text-accent-coral',
    keywords: [
      '芯片', '半导体', '英伟达', 'NVIDIA', '台积电', '手机', '折叠屏',
      'Vision Pro', '机器人', '飞行汽车', '无人机', 'iPhone', 'iPad', 'PC',
      '苹果', '华为', '小米', '三星', '鸿蒙', 'OPPO', 'vivo',
      '特斯拉', '电动车', '电动汽车', '无人驾驶', '自动驾驶',
    ],
  },
  {
    id: 'finance',
    name: '财经·宏观',
    badge: 'bg-accent-gold/20 text-accent-gold',
    keywords: [
      '美联储', '降息', '加息', '黄金', '纳指', '纳斯达克', '股市', '关税',
      '贸易', '央行', '原油', '美股', '道指', '道琼斯', '标普', 'ETF',
      '利率', '美元', '期货', '天然气', '通胀', '港股', 'A股', '国债', '汇率',
    ],
  },
  {
    id: 'company',
    name: '公司·融资',
    badge: 'bg-accent-sage/15 text-accent-sage',
    keywords: ['融资', '估值', 'IPO', '收购', '财报', '营收', '市值', '裁员', '合并', '上市'],
  },
  {
    id: 'policy',
    name: '政策·监管',
    badge: 'bg-cream-300 text-ink-50',
    keywords: [
      '监管', '政策', '许可', '牌照', '法案', '合规', '调查', '起诉',
      '裁决', '法院', '政府', '制裁', '备案', '新规', '证监会', '打击', '审理',
    ],
  },
  {
    id: 'other',
    name: '其他',
    badge: 'bg-cream-300 text-ink-50',
    keywords: [],
  },
]

// 热度条四段：90+ / 75+ / 60+ / 其他
export const SCORE_SEGMENTS = [
  { key: 'ge90', label: '90+', barClass: 'bg-accent-coral' },
  { key: 'ge75', label: '75+', barClass: 'bg-accent-gold' },
  { key: 'ge60', label: '60+', barClass: 'bg-accent-sage' },
  { key: 'rest', label: '<60', barClass: 'bg-accent-sky' },
]

const TESTERS = DOMAINS.filter((d) => d.id !== 'other').map((d) => ({
  id: d.id,
  tests: d.keywords.map(toTester),
}))

/** 单条新闻 → 领域 id */
export function classifyNews(item) {
  const text = `${item.title || ''} ${(item.keywords || []).join(' ')} ${item.summary || ''}`.toLowerCase()
  for (const { id, tests } of TESTERS) {
    if (tests.some((t) => t(text))) return id
  }
  return 'other'
}

/** 全量新闻 → 每领域的条数、评分分布、Top 3（按 DOMAINS 顺序返回） */
export function domainStats(newsList) {
  const grouped = new Map()
  for (const n of newsList) {
    const id = classifyNews(n)
    if (!grouped.has(id)) grouped.set(id, [])
    grouped.get(id).push(n)
  }
  return DOMAINS.map((d) => {
    const items = (grouped.get(d.id) || []).slice().sort((a, b) => b.score - a.score)
    const dist = { ge90: 0, ge75: 0, ge60: 0, rest: 0 }
    for (const n of items) {
      if (n.score >= 90) dist.ge90 += 1
      else if (n.score >= 75) dist.ge75 += 1
      else if (n.score >= 60) dist.ge60 += 1
      else dist.rest += 1
    }
    return { id: d.id, name: d.name, badge: d.badge, count: items.length, dist, top3: items.slice(0, 3) }
  })
}
