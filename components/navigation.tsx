"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Film, Sparkles, FolderOpen, Bot, Video, Settings, FileText, Image as ImageIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

const fullNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: Film },
  { name: "Movies", href: "/movies", icon: Film },
  { name: "Treatments", href: "/treatments", icon: FileText },
  { name: "Storyboards", href: "/storyboards", icon: ImageIcon },
  { name: "Videos", href: "/videos", icon: Video },
  { name: "Assets", href: "/assets", icon: FolderOpen },
  { name: "AI Studio", href: "/ai-studio", icon: Bot },
  { name: "AI Setup", href: "/setup-ai", icon: Settings },
]

const mobileNavigation = [
  { name: "Movies", href: "/movies", icon: Film },
  { name: "AI Studio", href: "/ai-studio", icon: Bot },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  
  const navigation = isMobile ? mobileNavigation : fullNavigation

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive ? "gradient-button neon-glow text-white" : "hover:bg-muted hover:text-accent",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden md:inline">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
