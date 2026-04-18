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
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import { useTheme } from "next-themes"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Theme">
            <Sun className="h-4 w-4" />
            <span>Theme</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Theme" className="relative">
              <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span>Theme</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
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
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
