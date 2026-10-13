import { useRef, useState, type ReactNode, type CSSProperties, type MouseEvent } from 'react'

const MAX_TILT = 8

type TiltStyle = CSSProperties & { '--mx'?: string; '--my'?: string }

export default function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<TiltStyle>({ transform: 'rotateX(0deg) rotateY(0deg)' })

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const ry = (px - 0.5) * 2 * MAX_TILT
    const rx = -(py - 0.5) * 2 * MAX_TILT
    setStyle({
      transform: `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
      transition: 'transform 0.1s ease-out',
      '--mx': `${(px * 100).toFixed(1)}%`,
      '--my': `${(py * 100).toFixed(1)}%`,
    })
  }

  const onLeave = () =>
    setStyle({ transform: 'rotateX(0deg) rotateY(0deg)', transition: 'transform 0.4s ease-out' })

  return (
    <div className="[perspective:1200px]">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ transformStyle: 'preserve-3d', ...style }}
        className="relative"
      >
        {children}
      </div>
    </div>
  )
}
