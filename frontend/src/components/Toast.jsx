import { createContext, useContext, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const TYPE_STYLES = {
  success: { edge: 'border-l-accent-sage', Icon: CheckCircle2, iconColor: 'text-accent-sage', ttl: 3000 },
  error: { edge: 'border-l-[#C4574E]', Icon: AlertCircle, iconColor: 'text-[#E8837A]', ttl: 4200 },
  info: { edge: 'border-l-accent-sky', Icon: Info, iconColor: 'text-accent-sky', ttl: 3000 },
  undo: { edge: 'border-l-accent-sage', Icon: CheckCircle2, iconColor: 'text-accent-sage', ttl: 5000 },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type, message, options = {}) => {
    const id = ++idRef.current
    const { ttl = TYPE_STYLES[type].ttl, onUndo } = options
    setToasts((list) => [...list.slice(-3), { id, type, message, onUndo }])
    setTimeout(() => dismiss(id), ttl)
    return id
  }, [dismiss])

  const toast = {
    success: (msg) => push('success', msg),
    error: (msg) => push('error', msg),
    info: (msg) => push('info', msg),
    undo: (msg, onUndo) => push('undo', msg, { onUndo }),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const { edge, Icon, iconColor } = TYPE_STYLES[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ x: 96, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 96, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`pointer-events-auto flex items-start gap-3 bg-ink-300 text-cream-100 rounded-xl px-4 py-3 shadow-[0_8px_30px_rgba(31,31,31,0.25)] border-l-4 ${edge}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 text-sm leading-relaxed">{t.message}</div>
                {t.type === 'undo' && (
                  <button
                    onClick={() => {
                      t.onUndo?.()
                      dismiss(t.id)
                    }}
                    className="shrink-0 text-sm font-medium text-accent-gold hover:text-cream-100 underline underline-offset-2"
                  >
                    撤销
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 p-0.5 -mr-1 rounded hover:bg-white/10 text-cream-100/60 hover:text-cream-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
