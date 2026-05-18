"use client"

import { useEffect, useRef, useState } from "react"

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3)

export function useCountUp<T extends HTMLElement = HTMLElement>(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0)
  const ref = useRef<T | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!ref.current || startedRef.current) return
    const node = ref.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || startedRef.current) return
        startedRef.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs)
          setValue(Math.round(target * EASE_OUT(t)))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        observer.disconnect()
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, durationMs])

  return { value, ref }
}
