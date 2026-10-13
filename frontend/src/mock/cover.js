// 题图生成器：纯前端 SVG 拼装，原型阶段无需任何图片生成服务
// 真实后端落地时替换为图片生成 API，组件接口不变

export const COVER_RATIOS = [
  { key: 'mp', label: '公众号头图 · 2.35:1', w: 900, h: 383 },
  { key: 'wide', label: '视频封面 · 16:9', w: 900, h: 506 },
  { key: 'square', label: '次图 · 1:1', w: 900, h: 900 },
]

export const COVER_PALETTES = [
  { name: '珊瑚橙', from: '#E07A5F', to: '#C4574E', accent: '#F2CC8F', text: '#FDFBF7', sub: 'rgba(253,251,247,0.78)' },
  { name: '夜幕蓝', from: '#3D5A80', to: '#232D3F', accent: '#E07A5F', text: '#FDFBF7', sub: 'rgba(253,251,247,0.78)' },
  { name: '鼠尾草', from: '#81B29A', to: '#3D5A80', accent: '#F2CC8F', text: '#FDFBF7', sub: 'rgba(253,251,247,0.82)' },
  { name: '奶油金', from: '#F2CC8F', to: '#E07A5F', accent: '#2D2A24', text: '#2D2A24', sub: 'rgba(45,42,36,0.68)' },
]

const LAYOUTS = ['左对齐', '居中', '水印']

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** CJK 友好的标题折行：按字符数硬切 */
function wrapTitle(title, perLine, maxLines = 2) {
  const chars = [...String(title)]
  const lines = []
  while (chars.length && lines.length < maxLines) {
    lines.push(chars.splice(0, perLine).join(''))
  }
  if (chars.length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  return lines
}

/**
 * 拼装题图 SVG
 * @param title 节目标题
 * @param keywords 素材关键词（最多取 4 个做角标 chips）
 * @param paletteIdx 配色索引
 * @param layout 0 左对齐 / 1 居中 / 2 水印
 * @param ratioKey COVER_RATIOS 的 key
 */
export function buildCoverSvg({ title, keywords = [], paletteIdx = 0, layout = 0, ratioKey = 'mp' }) {
  const ratio = COVER_RATIOS.find((r) => r.key === ratioKey) || COVER_RATIOS[0]
  const p = COVER_PALETTES[paletteIdx % COVER_PALETTES.length]
  const { w: W, h: H } = ratio
  const pad = 56
  const fontSize = Math.min(52, Math.round(W / 20))
  const perLine = Math.floor((W - pad * 2) / fontSize)
  const lines = wrapTitle(title, perLine)
  const gid = `g${paletteIdx}${layout}${ratioKey}`

  // 装饰层
  const circles = `
    <circle cx="${W - 140}" cy="${H * 0.22}" r="150" fill="${p.accent}" opacity="0.22"/>
    <circle cx="${W - 60}" cy="${H * 0.7}" r="90" fill="#ffffff" opacity="0.10"/>
    <circle cx="${W - 260}" cy="${H * 0.85}" r="46" fill="${p.accent}" opacity="0.30"/>`
  const band = `
    <rect x="0" y="${H * 0.30}" width="${W}" height="${H * 0.40}" fill="#ffffff" opacity="0.08"/>
    <rect x="0" y="${H * 0.30}" width="${W}" height="3" fill="${p.accent}" opacity="0.8"/>
    <rect x="0" y="${H * 0.70}" width="${W}" height="3" fill="${p.accent}" opacity="0.8"/>`
  const watermarkKw = keywords[0] || '科技'
  // 水印字号按字数收敛，防止拉丁词溢出画布
  const wmSize = Math.min(Math.round(H * 0.42), Math.round((W - pad * 2) / ([...watermarkKw].length * 0.75)))
  const watermark = `
    <text x="${W - pad}" y="${H * 0.52}" text-anchor="end" font-size="${wmSize}"
      font-weight="700" fill="#ffffff" opacity="0.12"
      font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(watermarkKw)}</text>
    <circle cx="${W - 110}" cy="${H * 0.2}" r="70" fill="${p.accent}" opacity="0.25"/>`
  const deco = [circles, band, watermark][layout % 3]

  // 角标
  const badge = `
    <rect x="${pad}" y="44" rx="17" width="${pad === 56 ? 128 : 128}" height="34" fill="rgba(0,0,0,0.18)"/>
    <text x="${pad + 64}" y="67" text-anchor="middle" font-size="16" letter-spacing="4"
      fill="${p.text}" font-family="PingFang SC, Microsoft YaHei, sans-serif">科技双响炮</text>`

  // 关键词 chips
  const chipY = H - 40
  let chipX = layout === 1 ? null : pad
  const chips = keywords.slice(0, 4).map((kw) => {
    const w = [...kw].length * 15 + 24
    const chip = `
      <rect x="${chipX}" y="${chipY - 24}" rx="12" width="${w}" height="28" fill="rgba(255,255,255,0.16)"/>
      <text x="${chipX + w / 2}" y="${chipY - 5}" text-anchor="middle" font-size="14"
        fill="${p.sub}" font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(kw)}</text>`
    chipX += w + 12
    return chip
  }).join('')

  // 标题文本
  const titleLines = lines.map((ln, i) => {
    if (layout === 1) {
      const totalH = lines.length * (fontSize + 14)
      const y0 = H / 2 - totalH / 2 + fontSize
      return `<text x="${W / 2}" y="${y0 + i * (fontSize + 14)}" text-anchor="middle" font-size="${fontSize}"
        font-weight="700" fill="${p.text}" font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(ln)}</text>`
    }
    const y0 = H - 96 - (lines.length - 1) * (fontSize + 14)
    return `<text x="${pad}" y="${y0 + i * (fontSize + 14)}" font-size="${fontSize}"
      font-weight="700" fill="${p.text}" font-family="PingFang SC, Microsoft YaHei, sans-serif">${escapeXml(ln)}</text>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.from}"/>
      <stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${gid})"/>
  ${deco}
  ${badge}
  ${titleLines}
  ${layout === 1 ? '' : chips}
</svg>`
  return svg
}

export const coverDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** 生成 3 个风格变体的参数（配色 + 版式两两不同） */
export function pickCoverVariants() {
  const palettes = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 3)
  const layouts = [0, 1, 2].sort(() => Math.random() - 0.5)
  return palettes.map((paletteIdx, i) => ({
    paletteIdx,
    layout: layouts[i % layouts.length],
    label: `${COVER_PALETTES[paletteIdx].name} · ${LAYOUTS[layouts[i % layouts.length]]}`,
  }))
}

/** SVG → PNG 下载（2x 清晰度） */
export function downloadCoverPng(svg, ratioKey, filename = 'cover.png') {
  const ratio = COVER_RATIOS.find((r) => r.key === ratioKey) || COVER_RATIOS[0]
  const img = new Image()
  img.onload = () => {
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = ratio.w * scale
    canvas.height = ratio.h * scale
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  img.src = coverDataUri(svg)
}
