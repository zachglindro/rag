"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ThemeSettings } from "./components/theme-settings"
import { SiteTitleSettings } from "./components/site-title-settings"
import { BackupSettingsPanel } from "./components/backup-settings"
import { SearchSettings } from "./components/search-settings"
import { SidebarSettings } from "./components/sidebar-settings"
import { DatabaseMaintenance } from "./components/database-maintenance"
import { DeveloperOptions } from "./components/developer-options"

export default function Settings() {
  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh p-6">
          <div className="w-full max-w-3xl space-y-6">
            <div>
              <h1>Settings</h1>
            </div>

            <ThemeSettings />
            <div className="h-px bg-border" />

            <SiteTitleSettings />
            <div className="h-px bg-border" />

            <BackupSettingsPanel />
            <div className="h-px bg-border" />

            <SearchSettings />
            <div className="h-px bg-border" />

            <SidebarSettings />
            <div className="h-px bg-border" />

            <DatabaseMaintenance />
            <div className="h-px bg-border" />

            <DeveloperOptions />
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
