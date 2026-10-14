// 图文正文长图渲染器：把结构化正文按模板排版成 SVG 长图，再经 canvas 转 PNG 下载
// 程序化排版（非 AI 生图）——正文的价值在文字本身，必须 100% 无乱码、版式可控
import { coverDataUri, downloadSvgPng } from './cover.js'

const W = 880
const PAD = 64
const FONT = 'PingFang SC, Microsoft YaHei, sans-serif'

export const ARTICLE_TEMPLATES = [
  { key: 'magazine', label: '杂志风' },
  { key: 'cards', label: '卡片风' },
]

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 解析受控 Markdown（生成器输出的固定结构）为排版块 */
export function parseArticle(md) {
  const lines = String(md || '').split('\n')
  const blocks = []
  let title = ''
  let leadUsed = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line === '---') continue
    if (line.startsWith('### ')) {
      blocks.push({ type: 'heading', text: line.slice(4).trim() })
    } else if (line.startsWith('# ')) {
      title = line.slice(2).trim()
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', text: line.slice(2).trim() })
    } else if (line.startsWith('*') && line.endsWith('*')) {
      blocks.push({ type: 'footer', text: line.slice(1, -1).trim() })
    } else {
      blocks.push({ type: leadUsed ? 'para' : 'lead', text: line })
      leadUsed = true
    }
  }
  return { title, blocks }
}

// CJK 感知的宽度测量与贪心折行
const FULL_WIDTH = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\u2014\u2018\u2019\u201c\u201d\u2026]/
const charW = (ch, size) => (FULL_WIDTH.test(ch) ? size : size * 0.56)

function wrapText(text, size, maxWidth) {
  const lines = []
  let cur = ''
  let curW = 0
  for (const ch of String(text)) {
    const w = charW(ch, size)
    if (curW + w > maxWidth && cur) {
      lines.push(cur)
      cur = ch
      curW = w
    } else {
      cur += ch
      curW += w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

const t = (x, y, content, size, fill, weight = 400, anchor = 'start', ls = 0) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''} font-family="${FONT}">${escapeXml(content)}</text>`

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 杂志风：奶油底 + 珊瑚 accent，大标题、分节、金句面板 ──
function renderMagazine(title, blocks) {
  const ink = '#2D2A24'
  const sub = '#6B6659'
  const coral = '#E07A5F'
  const gold = '#D4A373'
  const panel = '#FAF3E8'
  const line = '#E8DFD0'
  const body = []
  let y = 0

  body.push(`<rect width="${W}" height="6" fill="${coral}"/><rect x="${W * 0.4}" width="${W * 0.6}" height="6" fill="${gold}"/>`)
  y = 78
  body.push(t(PAD, y, '科技双响炮', 15, coral, 600, 'start', 6))
  body.push(t(W - PAD, y, todayStr(), 13, sub, 400, 'end'))
  y += 28
  body.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="1" fill="${line}"/>`)
  y += 52

  for (const ln of wrapText(title, 38, W - PAD * 2)) {
    body.push(t(PAD, y, ln, 38, ink, 700))
    y += 56
  }
  y += 8

  for (const b of blocks) {
    if (b.type === 'lead') {
      y += 12
      for (const ln of wrapText(b.text, 19, W - PAD * 2)) {
        body.push(t(PAD, y, ln, 19, sub))
        y += 36
      }
      y += 22
    } else if (b.type === 'heading') {
      y += 26
      body.push(`<rect x="${PAD}" y="${y - 20}" width="5" height="24" rx="2.5" fill="${coral}"/>`)
      body.push(t(PAD + 18, y, b.text, 23, ink, 700))
      y += 42
    } else if (b.type === 'para') {
      for (const ln of wrapText(b.text, 17, W - PAD * 2)) {
        body.push(t(PAD, y, ln, 17, ink))
        y += 33
      }
      y += 14
    } else if (b.type === 'quote') {
      const lines = wrapText(`「 ${b.text} 」`, 18, W - PAD * 2 - 72)
      const boxH = lines.length * 32 + 36
      y += 12
      body.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${boxH}" rx="14" fill="${panel}"/>`)
      body.push(`<rect x="${PAD}" y="${y}" width="4" height="${boxH}" rx="2" fill="${coral}"/>`)
      let qy = y + 44
      for (const ln of lines) {
        body.push(t(PAD + 40, qy, ln, 18, ink, 500))
        qy += 32
      }
      y += boxH + 26
    } else if (b.type === 'footer') {
      y += 26
      body.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="1" fill="${line}"/>`)
      y += 42
      body.push(t(W / 2, y, b.text, 13, sub, 400, 'middle'))
      y += 20
    }
  }

  y += PAD - 20
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">
  <rect width="${W}" height="${y}" fill="#FDFBF7"/>
  ${body.join('\n  ')}
</svg>`
  return { svg, w: W, h: y }
}

// ── 卡片风：深色渐变底 + 每条新闻一张白色卡片，数字编号 ──
function renderCards(title, blocks) {
  const ink = '#2D2A24'
  const sub = '#6B6659'
  const coral = '#E07A5F'
  const body = []

  // 先把流式块按 heading 分组成卡片
  const cards = []
  let leadBlock = null
  let footerBlock = null
  let cur = null
  for (const b of blocks) {
    if (b.type === 'lead') leadBlock = b
    else if (b.type === 'footer') footerBlock = b
    else if (b.type === 'heading') {
      cur = { heading: b.text, items: [] }
      cards.push(cur)
    } else if (cur) cur.items.push(b)
  }

  const titleLines = wrapText(title, 34, W - PAD * 2)
  const leadLines = leadBlock ? wrapText(leadBlock.text, 16, W - PAD * 2) : []
  const headerH = 150 + titleLines.length * 50 + (leadLines.length ? leadLines.length * 28 + 30 : 0)

  let y = 70
  body.push(`<rect x="${PAD}" y="${y - 22}" rx="16" width="128" height="32" fill="rgba(255,255,255,0.14)"/>`)
  body.push(t(PAD + 64, y, '科技双响炮', 14, '#FDFBF7', 600, 'middle', 5))
  body.push(t(W - PAD, y, todayStr(), 13, 'rgba(253,251,247,0.65)', 400, 'end'))
  y += 42
  for (const ln of titleLines) {
    body.push(t(PAD, y, ln, 34, '#FDFBF7', 700))
    y += 50
  }
  y += 2
  for (const ln of leadLines) {
    body.push(t(PAD, y, ln, 16, 'rgba(253,251,247,0.75)'))
    y += 28
  }
  y = headerH

  cards.forEach((card, ci) => {
    // 第一遍：量高度（88 = 卡片顶部到正文的固定偏移，20 = 底部留白）
    let cardH = 88
    const paras = []
    for (const item of card.items) {
      if (item.type === 'quote') {
        const lines = wrapText(`「 ${item.text} 」`, 16, W - PAD * 2 - 56 - 48)
        paras.push({ ...item, lines })
        cardH += lines.length * 28 + 40
      } else {
        const lines = wrapText(item.text, 16, W - PAD * 2 - 56)
        paras.push({ ...item, lines })
        cardH += lines.length * 30 + 14
      }
    }
    cardH += 20
    // 第二遍：绘制
    body.push(`<rect x="${PAD - 16}" y="${y}" width="${W - (PAD - 16) * 2}" height="${cardH}" rx="18" fill="#FDFBF7"/>`)
    body.push(`<circle cx="${PAD + 22}" cy="${y + 42}" r="17" fill="${coral}"/>`)
    body.push(t(PAD + 22, y + 48, String(ci + 1).padStart(2, '0'), 15, '#FDFBF7', 700, 'middle'))
    let cy = y + 50
    for (const ln of wrapText(card.heading, 21, W - (PAD - 16) * 2 - 56 - 70)) {
      body.push(t(PAD + 56, cy, ln, 21, ink, 700))
      cy += 30
    }
    cy = y + 88
    for (const p of paras) {
      if (p.type === 'quote') {
        const boxH = p.lines.length * 28 + 24
        body.push(`<rect x="${PAD + 12}" y="${cy}" width="${W - (PAD - 16) * 2 - 56}" height="${boxH}" rx="12" fill="#F2CC8F" opacity="0.28"/>`)
        let qy = cy + 36
        for (const ln of p.lines) {
          body.push(t(PAD + 36, qy, ln, 16, ink, 500))
          qy += 28
        }
        cy += boxH + 16
      } else {
        for (const ln of p.lines) {
          body.push(t(PAD + 12, cy, ln, 16, sub))
          cy += 30
        }
        cy += 14
      }
    }
    y += cardH + 22
  })

  if (footerBlock) {
    y += 18
    body.push(t(W / 2, y, footerBlock.text, 13, 'rgba(253,251,247,0.6)', 400, 'middle'))
    y += 24
  }
  y += PAD - 20

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">
  <defs>
    <linearGradient id="cardbg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#3D5A80"/>
      <stop offset="1" stop-color="#232D3F"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${y}" fill="url(#cardbg)"/>
  ${body.join('\n  ')}
</svg>`
  return { svg, w: W, h: y }
}

/** 正文 Markdown + 模板 key → { svg, w, h } */
export function buildArticleImage(md, templateKey) {
  const { title, blocks } = parseArticle(md)
  return templateKey === 'cards'
    ? renderCards(title || '今日焦点', blocks)
    : renderMagazine(title || '今日焦点', blocks)
}

export function downloadArticlePng(md, templateKey, filename) {
  const { svg, w, h } = buildArticleImage(md, templateKey)
  // 长图用 1.5x，避免超高 canvas 触碰浏览器上限
  downloadSvgPng(svg, w, h, filename, 1.5)
}

export { coverDataUri }
