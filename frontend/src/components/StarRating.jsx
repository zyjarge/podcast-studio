import { Star } from 'lucide-react'

/** 5 星金色评分 + 具体分数（如 ★★★★☆ 82） */
export default function StarRating({ score, size = 'sm' }) {
  const full = Math.round(score / 20)
  const starCls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <span className="inline-flex items-center gap-1" title={`${score} 分`}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${starCls} ${i <= full ? 'text-accent-gold fill-accent-gold' : 'text-cream-400 fill-cream-400'}`}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-accent-gold">{score}</span>
    </span>
  )
}
