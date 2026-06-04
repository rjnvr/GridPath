"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

interface TypingAnimationProps {
  phrases: readonly string[]
  className?: string
  typingSpeed?: number
  deletingSpeed?: number
  pauseMs?: number
}

export function TypingAnimation({
  phrases,
  className,
  typingSpeed = 42,
  deletingSpeed = 24,
  pauseMs = 1400
}: TypingAnimationProps) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [characterIndex, setCharacterIndex] = useState(() => phrases[0]?.length ?? 0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  const currentPhrase = phrases[phraseIndex] ?? ""
  const fallbackPhrase = phrases[0] ?? ""
  const visibleText = prefersReducedMotion
    ? fallbackPhrase
    : currentPhrase.slice(0, characterIndex)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")

    function handleChange() {
      setPrefersReducedMotion(media.matches)
    }

    handleChange()
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || phrases.length === 0) return undefined

    const currentLength = currentPhrase.length
    let delay = isDeleting ? deletingSpeed : typingSpeed

    if (!isDeleting && characterIndex === currentLength) {
      delay = pauseMs
    }

    const timeout = window.setTimeout(() => {
      if (!isDeleting && characterIndex === currentLength) {
        setIsDeleting(true)
        return
      }

      if (isDeleting && characterIndex === 0) {
        setIsDeleting(false)
        setPhraseIndex((index) => (index + 1) % phrases.length)
        return
      }

      setCharacterIndex((index) => index + (isDeleting ? -1 : 1))
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [
    characterIndex,
    currentPhrase,
    deletingSpeed,
    isDeleting,
    pauseMs,
    phrases.length,
    prefersReducedMotion,
    typingSpeed
  ])

  return (
    <span className={cn("inline-flex min-h-[1.5em] items-center", className)}>
      <span className="sr-only">{fallbackPhrase}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        <span>{visibleText}</span>
        <span className="ml-1 inline-block h-[1.1em] w-px animate-pulse bg-primary" />
      </span>
    </span>
  )
}
