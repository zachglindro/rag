import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarProvider as CustomSidebarProvider } from "@/contexts/sidebar-context"
import { SiteTitleProvider } from "@/contexts/site-title-context"
import { Toaster } from "@/components/ui/sonner"
import { UserNamePrompt } from "@/components/user-name-prompt"
import { DEFAULT_SITE_TITLE } from "@/lib/site-title"
import { cn } from "@/lib/utils"

export const metadata = {
  title: DEFAULT_SITE_TITLE,
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SiteTitleProvider>
              <CustomSidebarProvider>
                <SidebarProvider>{children}</SidebarProvider>
              </CustomSidebarProvider>
            </SiteTitleProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Toaster />
        <UserNamePrompt />
      </body>
    </html>
  )
}
