"use client"

import Link from "next/link"
import { Home, BarChart2, Database, PlusCircle, Sprout } from "lucide-react"

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

const navItems = [
  { title: "Home", icon: Home, href: "/" },
  { title: "Add", icon: PlusCircle, href: "/add" },
  { title: "Data", icon: Database, href: "/data" },
  { title: "Compare", icon: BarChart2, href: "/compare" },
]

function SidebarHeaderContent() {
  return (
    <div className="flex items-center gap-2 px-2 py-2 group-data-[state=collapsed]:justify-center">
      <Sprout className="h-5 w-5 shrink-0 text-primary group-data-[state=collapsed]:hidden" />
      <span className="truncate text-sm font-semibold group-data-[state=collapsed]:hidden">
        Cereals Inventory
      </span>
      <SidebarTrigger className="ml-auto shrink-0 group-data-[state=collapsed]:ml-0" />
    </div>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarHeaderContent />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
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
      <SidebarFooter />
    </Sidebar>
  )
}
