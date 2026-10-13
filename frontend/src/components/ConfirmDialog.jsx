import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

/**
 * 破坏性操作确认弹窗
 * open / title / body / confirmText / danger / onConfirm / onCancel
 */
export default function ConfirmDialog({ open, title, body, confirmText = '删除', onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(45,42,36,0.4)]"
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-md bg-cream-100 rounded-3xl p-6 shadow-[0_8px_30px_rgba(45,42,36,0.12)] border border-cream-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4574E]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#C4574E]" />
                </div>
                <h3 className="text-lg font-semibold text-ink-300">{title}</h3>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg hover:bg-cream-200 text-ink-50 hover:text-ink-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-ink-50 leading-relaxed mb-6">{body}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="px-4 h-10 rounded-xl bg-cream-200 border border-cream-300 text-sm font-medium text-ink-300 hover:bg-cream-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className="px-4 h-10 rounded-xl bg-white border border-[#C4574E] text-sm font-medium text-[#C4574E] hover:bg-[#C4574E] hover:text-white transition-colors"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
