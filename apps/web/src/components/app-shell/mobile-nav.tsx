"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { Sidebar } from "./sidebar"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none border-r border-border p-0 sm:rounded-none">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div onClick={() => setOpen(false)}>
          <Sidebar collapsible={false} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
