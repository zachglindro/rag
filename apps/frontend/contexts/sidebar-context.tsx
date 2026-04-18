"use client"

import * as React from "react"

interface SidebarContextType {
  sidebarOrder: { title: string; enabled: boolean }[]
  setSidebarOrder: (order: { title: string; enabled: boolean }[]) => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOrder, setSidebarOrder] = React.useState<{ title: string; enabled: boolean }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarOrder")
      return saved ? JSON.parse(saved) : [
        { title: "Home", enabled: true },
        { title: "Add", enabled: true },
        { title: "Data", enabled: true },
        { title: "Compare", enabled: true },
      ]
    }
    return []
  })

  const updateSidebarOrder = (order: { title: string; enabled: boolean }[]) => {
    setSidebarOrder(order)
    localStorage.setItem("sidebarOrder", JSON.stringify(order))
  }

  return (
    <SidebarContext.Provider value={{ sidebarOrder, setSidebarOrder: updateSidebarOrder }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebarSettings = () => {
  const context = React.useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebarSettings must be used within a SidebarProvider")
  }
  return context
}
