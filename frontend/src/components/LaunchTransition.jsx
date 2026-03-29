import { useEffect, useRef } from 'react'

// Single color: cyan (94,170,187) — only intensity & opacity change
const C = '94,170,187'

export default function LaunchTransition({ onComplete }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width = window.innerWidth
    const h = canvas.height = window.innerHeight
    const cx = w / 2, cy = h / 2

    // Star field — streaking from center outward (hyperspace jump)
    const stars = Array.from({ length: 300 }, () => ({
      angle: Math.random() * Math.PI * 2,
      r: Math.random() * 5,
      speed: 2 + Math.random() * 6,
      len: 0,
      alpha: 0.2 + Math.random() * 0.8,
      width: 0.5 + Math.random() * 1.5,
    }))

    const start = performance.now()
    const DURATION = 2000
    let done = false

    const draw = (now) => {
      if (done) return
      const elapsed = now - start
      const t = Math.min(elapsed / DURATION, 1)

      ctx.clearRect(0, 0, w, h)

      // Background — fade to black then flash
      const bgAlpha = t < 0.1 ? t / 0.1 : 1
      ctx.fillStyle = `rgba(3,6,16,${bgAlpha})`
      ctx.fillRect(0, 0, w, h)

      // Acceleration curve: slow start, massive ramp
      const accel = t < 0.3
        ? t / 0.3
        : 1 + Math.pow((t - 0.3) / 0.7, 2) * 25

      // Star streaks
      stars.forEach(s => {
        s.r += s.speed * accel
        s.len = Math.min(s.speed * accel * 3, s.r * 0.6)

        const x = cx + Math.cos(s.angle) * s.r
        const y = cy + Math.sin(s.angle) * s.r

        // Fade: dim at center, bright as they streak, fade at edges
        const distRatio = Math.min(s.r / (Math.max(w, h) * 0.6), 1)
        const fadeAlpha = s.alpha * (t < 0.85
          ? Math.min(distRatio * 2, 1)
          : Math.max(0, 1 - (t - 0.85) / 0.15))

        if (fadeAlpha <= 0) return

        const x2 = cx + Math.cos(s.angle) * (s.r - s.len)
        const y2 = cy + Math.sin(s.angle) * (s.r - s.len)

        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x, y)
        ctx.strokeStyle = `rgba(${C},${fadeAlpha})`
        ctx.lineWidth = s.width * (0.5 + accel * 0.08)
        ctx.stroke()
      })

      // Center glow — pulse that intensifies with speed
      const glowSize = 80 + accel * 15
      const glowAlpha = t < 0.85
        ? 0.05 + accel * 0.008
        : Math.max(0, 0.15 * (1 - (t - 0.85) / 0.15))
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
      grd.addColorStop(0, `rgba(${C},${glowAlpha * 3})`)
      grd.addColorStop(0.4, `rgba(${C},${glowAlpha})`)
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2)

      // Final flash — white-cyan burst at ~85%
      if (t > 0.82 && t < 0.95) {
        const flashT = (t - 0.82) / 0.13
        const flashAlpha = Math.sin(flashT * Math.PI) * 0.6
        ctx.fillStyle = `rgba(${C},${flashAlpha})`
        ctx.fillRect(0, 0, w, h)
      }

      // Fade to transparent at the very end so dashboard shows through
      if (t > 0.9) {
        const fadeOut = (t - 0.9) / 0.1
        ctx.clearRect(0, 0, w, h)
        ctx.globalAlpha = 1 - fadeOut
        // Redraw with fading opacity
        ctx.fillStyle = `rgba(3,6,16,${1 - fadeOut})`
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1
      }

      if (t >= 1) {
        done = true
        onComplete()
        return
      }
      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
    return () => { done = true }
  }, [onComplete])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
