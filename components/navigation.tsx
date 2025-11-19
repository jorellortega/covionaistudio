"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Film, 
  FolderOpen, 
  Bot, 
  Video, 
  Settings, 
  FileText, 
  Home, 
  Lightbulb, 
  Palette, 
  PenTool, 
  ChevronDown,
  LayoutDashboard,
  Play,
  Image as ImageIcon,
  UserCircle
} from "lucide-react"
import { Palette as MoodPalette } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavCategory {
  name: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

const dashboardItem: NavItem = { name: "Dashboard", href: "/dashboard", icon: Home }

const navigationCategories: NavCategory[] = [
  {
    name: "Projects",
    icon: LayoutDashboard,
    items: [
      { name: "Movies", href: "/movies", icon: Film },
      { name: "Treatments", href: "/treatments", icon: FileText },
      { name: "Videos", href: "/videos", icon: Video },
    ],
  },
  {
    name: "Production",
    icon: Play,
    items: [
      { name: "Timeline", href: "/timeline", icon: Play },
      { name: "Storyboards", href: "/storyboards", icon: ImageIcon },
    ],
  },
  {
    name: "Creative",
    icon: Palette,
    items: [
      { name: "Ideas", href: "/ideas", icon: Lightbulb },
      { name: "Visual Dev", href: "/visdev", icon: Palette },
      { name: "Mood Boards", href: "/mood-boards", icon: MoodPalette },
      { name: "Writers", href: "/writers-page", icon: PenTool },
      { name: "Characters", href: "/characters", icon: UserCircle },
    ],
  },
  {
    name: "Assets",
    icon: FolderOpen,
    items: [
      { name: "Assets", href: "/assets", icon: FolderOpen },
    ],
  },
  {
    name: "AI Tools",
    icon: Bot,
    items: [
      { name: "AI Studio", href: "/ai-studio", icon: Bot },
    ],
  },
]

const mobileNavigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Movies", href: "/movies", icon: Film },
  { name: "Ideas", href: "/ideas", icon: Lightbulb },
  { name: "Writers", href: "/writers-page", icon: PenTool },
  { name: "Visual Dev", href: "/visdev", icon: Palette },
  { name: "Mood Boards", href: "/mood-boards", icon: MoodPalette },
  { name: "Settings", href: "/settings", icon: Settings },
]

function isPathActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href
  }
  return pathname.startsWith(href)
}

function isCategoryActive(pathname: string, category: NavCategory): boolean {
  return category.items.some(item => isPathActive(pathname, item.href))
}

export function Navigation() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  
  if (isMobile) {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto pb-2">
        {mobileNavigation.map((item) => {
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
              <span className={cn(
                "hidden md:inline",
                item.name === "Home" ? "hidden" : "hidden md:inline"
              )}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  // Render Dashboard as standalone link
  const DashboardIcon = dashboardItem.icon
  const isDashboardActive = isPathActive(pathname, dashboardItem.href)

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2">
      {/* Dashboard link */}
      <Link
        href={dashboardItem.href}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isDashboardActive ? "gradient-button neon-glow text-white" : "hover:bg-muted hover:text-accent",
        )}
      >
        <DashboardIcon className="h-4 w-4" />
        <span className="hidden md:inline">{dashboardItem.name}</span>
      </Link>

      {/* Category dropdowns */}
      {navigationCategories.map((category) => {
        const CategoryIcon = category.icon
        const categoryActive = isCategoryActive(pathname, category)
        
        // If category has only one item, render as a direct link
        if (category.items.length === 1) {
          const item = category.items[0]
          const isActive = isPathActive(pathname, item.href)
          const ItemIcon = item.icon
          
          return (
            <Link
              key={category.name}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive ? "gradient-button neon-glow text-white" : "hover:bg-muted hover:text-accent",
              )}
            >
              <ItemIcon className="h-4 w-4" />
              <span className="hidden md:inline">{item.name}</span>
            </Link>
          )
        }
        
        // Render as dropdown for categories with multiple items
        return (
          <DropdownMenu key={category.name}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  categoryActive ? "gradient-button neon-glow text-white" : "hover:bg-muted hover:text-accent",
                )}
              >
                <CategoryIcon className="h-4 w-4" />
                <span className="hidden md:inline">{category.name}</span>
                <ChevronDown className="h-3 w-3 ml-1 hidden md:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {category.items.map((item) => {
                const isActive = isPathActive(pathname, item.href)
                const ItemIcon = item.icon
                return (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 w-full cursor-pointer",
                        isActive && "bg-accent"
                      )}
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </nav>
  )
}
