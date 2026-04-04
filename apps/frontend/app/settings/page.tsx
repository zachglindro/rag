"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default function Settings() {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh p-6">
          <h1>Settings</h1>
        </div>
      </SidebarInset>
    </>
  )
}
