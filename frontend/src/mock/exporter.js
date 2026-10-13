// 音频导出（原型专用）：把逐字稿"编译"成 WAV 样片——每个发言回合一段提示音，
// 彪悍罗低频、OK王高频，总时长与 mock 音频一致，可真实下载试听节奏。
// 正式版由后端直接返回合成好的 MP3（/audio/{id}/episode_{id}.mp3），此文件不再需要。

const SAMPLE_RATE = 8000
const MAX_DURATION_SEC = 20 * 60

function encodeWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true))
  return buffer
}

const parseTurns = (script) => {
  const re = /\*\*(彪悍罗|OK王)：\*\*\s*/g
  const parts = []
  let m
  let last = null
  while ((m = re.exec(script)) !== null) {
    if (last) parts.push({ speaker: last.speaker, text: script.slice(last.end, m.index).trim() })
    last = { speaker: m[1], end: re.lastIndex }
  }
  if (last) parts.push({ speaker: last.speaker, text: script.slice(last.end).trim() })
  return parts.filter((p) => p.text)
}

/** 生成与逐字稿节奏对应的 WAV Blob */
export function buildEpisodeWav(scriptText, durationSec) {
  const total = Math.min(Math.max(durationSec || 600, 30), MAX_DURATION_SEC)
  const turns = parseTurns(scriptText || '')
  const pauseSec = 0.25
  const totalSamples = Math.floor(total * SAMPLE_RATE)
  const samples = new Int16Array(totalSamples)

  if (turns.length === 0) {
    return new Blob([encodeWav(samples)], { type: 'audio/wav' })
  }

  const weightSum = turns.reduce((s, t) => s + Math.max(t.text.length, 8), 0)
  const talkSec = total - pauseSec * (turns.length - 1)
  let cursor = 0

  turns.forEach((turn, idx) => {
    const sec = Math.max(0.8, (talkSec * Math.max(turn.text.length, 8)) / weightSum)
    const n = Math.min(Math.floor(sec * SAMPLE_RATE), totalSamples - cursor)
    const freq = turn.speaker === '彪悍罗' ? 196 : 294
    const fade = Math.floor(SAMPLE_RATE * 0.02)
    for (let i = 0; i < n; i++) {
      const envelope = Math.min(1, i / fade, (n - i) / fade)
      const wobble = 1 + 0.06 * Math.sin((2 * Math.PI * 3 * i) / SAMPLE_RATE)
      samples[cursor + i] = Math.round(
        32767 * 0.22 * envelope * Math.sin((2 * Math.PI * freq * wobble * i) / SAMPLE_RATE)
      )
    }
    cursor += n
    if (idx < turns.length - 1) cursor += Math.floor(pauseSec * SAMPLE_RATE)
    if (cursor >= totalSamples) return
  })

  return new Blob([encodeWav(samples)], { type: 'audio/wav' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const safeFilename = (title) =>
  String(title || 'podcast').replace(/\s*·\s*/g, '-').replace(/[\\/:*?"<>|]/g, '').slice(0, 60)
