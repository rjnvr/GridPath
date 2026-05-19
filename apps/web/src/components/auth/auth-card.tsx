"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 rounded-md border border-border bg-card/80 p-7 shadow-[0_24px_80px_hsl(var(--primary)/0.04)] backdrop-blur"
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
      {footer ? (
        <div className="border-t border-border pt-4 text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </motion.div>
  )
}
