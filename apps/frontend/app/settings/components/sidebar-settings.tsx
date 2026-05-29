"use client"

import { useState } from "react"
import { Grip, ChevronDown } from "lucide-react"
import { Reorder } from "framer-motion"
import { useSidebarSettings } from "@/contexts/sidebar-context"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"

export function SidebarSettings() {
  const { sidebarOrder: sidebarItems, setSidebarOrder: setSidebarItems } =
    useSidebarSettings()
  const [isOpen, setIsOpen] = useState(true)

  const toggleSidebarItem = (title: string) => {
    setSidebarItems(
      sidebarItems.map((item) =>
        item.title === title ? { ...item, enabled: !item.enabled } : item
      )
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="group flex w-full items-center justify-between py-2 text-left">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Sidebar Navigation
            </h2>
            <p className="text-sm text-muted-foreground">
              Reorder or hide items in the sidebar.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
        <div className="space-y-2 pl-1">
          <Reorder.Group
            axis="y"
            values={sidebarItems}
            onReorder={setSidebarItems}
            className="w-full max-w-sm space-y-2"
          >
            {sidebarItems.map((item) => (
              <Reorder.Item
                key={item.title}
                value={item}
                className="flex cursor-grab items-center gap-2 rounded-md border bg-background p-2 active:cursor-grabbing"
              >
                <Switch
                  checked={item.enabled}
                  onCheckedChange={() => toggleSidebarItem(item.title)}
                />
                <span
                  className={`text-sm ${!item.enabled ? "text-muted-foreground" : ""}`}
                >
                  {item.title}
                </span>
                <Grip className="ml-auto h-4 w-4 text-muted-foreground" />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
