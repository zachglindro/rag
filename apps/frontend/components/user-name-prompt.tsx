"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function UserNamePrompt() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)
  const [name, setName] = React.useState("")

  const isMandatoryRoute =
    pathname.startsWith("/add") || pathname.startsWith("/data")

  React.useEffect(() => {
    const storedName = localStorage.getItem("userName")
    if (!storedName) {
      setIsOpen(true)
    }
  }, [pathname]) // Re-check on navigation

  const handleSave = () => {
    if (name.trim()) {
      localStorage.setItem("userName", name.trim())
      setIsOpen(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    // If it's a mandatory route and no name is stored, don't allow closing
    if (isMandatoryRoute && !localStorage.getItem("userName")) {
      setIsOpen(true)
      return
    }
    setIsOpen(open)
  }

  const isMandatory = isMandatoryRoute && !localStorage.getItem("userName")

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        showCloseButton={!isMandatory}
        onPointerDownOutside={(e) => {
          if (isMandatory) {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Welcome!</DialogTitle>
          <DialogDescription>
            Please enter your name to continue. This will be used to track who
            created and updated records.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Your Name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
