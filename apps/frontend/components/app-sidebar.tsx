"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Home,
  BarChart2,
  Database,
  PlusCircle,
  Settings,
  User,
} from "lucide-react"
import { useSidebarSettings } from "@/contexts/sidebar-context"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import icon from "@/app/icon.png"

const navItems = [
  { title: "Home", icon: Home, href: "/" },
  { title: "Add", icon: PlusCircle, href: "/add" },
  { title: "Data", icon: Database, href: "/data" },
  { title: "Compare", icon: BarChart2, href: "/compare" },
  { title: "Settings", icon: Settings, href: "/settings" },
]

function SidebarHeaderContent() {
  return (
    <div className="flex items-center gap-2 px-2 py-2 group-data-[state=collapsed]:justify-center">
      <Image
        src={icon}
        alt="Institute of Plant Breeding"
        className="h-5 w-5 shrink-0 group-data-[state=collapsed]:hidden"
        priority
      />
      <span className="truncate text-sm font-semibold group-data-[state=collapsed]:hidden">
        Cereals Inventory
      </span>
      <SidebarTrigger className="ml-auto shrink-0 group-data-[state=collapsed]:ml-0" />
    </div>
  )
}

function UserNameSettings() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [name, setName] = React.useState("")

  React.useEffect(() => {
    setName(localStorage.getItem("userName") || "")
  }, [])

  const handleSave = () => {
    if (name.trim()) {
      localStorage.setItem("userName", name.trim())
      setIsOpen(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="User Settings">
              <User className="h-4 w-4" />
              <span className="truncate">{name || "Set Name"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
          <DialogDescription>
            Update your name used for tracking records.
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
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AppSidebar() {
  const { sidebarOrder } = useSidebarSettings()
  const [sidebarItems, setSidebarItems] = React.useState(navItems)

  React.useEffect(() => {
    const enabledTitles = sidebarOrder
      .filter((s) => s.enabled)
      .map((s) => s.title)

    const newOrder = [
      ...sidebarOrder
        .map((s) => navItems.find((n) => n.title === s.title))
        .filter(
          (n): n is (typeof navItems)[0] =>
            !!n && enabledTitles.includes(n.title)
        ),
      navItems.find((n) => n.title === "Settings")!,
    ]
    setSidebarItems(newOrder)
  }, [sidebarOrder])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {sidebarItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNameSettings />
      </SidebarFooter>
    </Sidebar>
  )
}
