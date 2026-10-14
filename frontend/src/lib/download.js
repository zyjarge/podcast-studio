// 文件名工具：把节目标题转成安全的下载文件名
export const safeFilename = (title) =>
  String(title || 'podcast').replace(/\s*·\s*/g, '-').replace(/[\\/:*?"<>|]/g, '').slice(0, 60)
