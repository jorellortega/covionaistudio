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
  Play,
  Image as ImageIcon,
  UserCircle,
  MapPin,
  Zap,
  Users,
  Package,
  Sparkles,
  Box
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
import { useAuthReady } from "@/components/auth-hooks"
import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"

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
    name: "Production",
    icon: Play,
    items: [
      { name: "Movies", href: "/movies", icon: Film },
      { name: "Videos", href: "/videos", icon: Video },
      { name: "Timeline", href: "/timeline", icon: Play },
      { name: "Storyboards", href: "/storyboards", icon: ImageIcon },
      { name: "Lighting Plot", href: "/lighting-plot", icon: Zap },
      { name: "Call Sheet", href: "/call-sheet", icon: FileText },
      { name: "Crew Sheet", href: "/crew-sheet", icon: Users },
      { name: "Equipment List", href: "/equipment-list", icon: Package },
      { name: "Props List", href: "/props-list", icon: Box },
      { name: "Assets", href: "/assets", icon: FolderOpen },
    ],
  },
  {
    name: "Creative",
    icon: Palette,
    items: [
      { name: "Treatments", href: "/treatments", icon: FileText },
      { name: "Ideas", href: "/ideas", icon: Lightbulb },
      { name: "Visual Dev", href: "/visdev", icon: Palette },
      { name: "Mood Boards", href: "/mood-boards", icon: MoodPalette },
      { name: "Writers", href: "/writers-page", icon: PenTool },
      { name: "Characters", href: "/characters", icon: UserCircle },
      { name: "Locations", href: "/locations", icon: MapPin },
    ],
  },
  {
    name: "AI Tools",
    icon: Bot,
    items: [
      { name: "AI Studio", href: "/ai-studio", icon: Bot },
      { name: "Prompts List", href: "/prompts-list", icon: Sparkles },
    ],
  },
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
  const { user, userId, ready } = useAuthReady()
  const [userRole, setUserRole] = useState<string | null>(null)

  // Fetch user role from users table
  useEffect(() => {
    if (!ready || !userId) {
      setUserRole(null)
      return
    }

    const fetchUserRole = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()

        if (!error && data) {
          setUserRole(data.role || null)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      }
    }

    fetchUserRole()
  }, [ready, userId])
  
  // Desktop navigation only - mobile uses hamburger menu

  // Filter categories based on user role - AI Tools only for ceo and production
  const filteredCategories = userRole
    ? navigationCategories.filter(category => {
        if (category.name === "AI Tools") {
          return userRole === 'ceo' || userRole === 'production'
        }
        return true
      })
    : navigationCategories

  // Render Dashboard as standalone link
  const DashboardIcon = dashboardItem.icon
  const isDashboardActive = isPathActive(pathname, dashboardItem.href)

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2">
      {/* Show Movies link when on dashboard, Dashboard link otherwise */}
      {isDashboardActive ? (
        <Link
          href="/movies"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "hover:bg-muted hover:text-accent",
          )}
        >
          <Film className="h-4 w-4" />
          <span className="hidden md:inline">Movies</span>
        </Link>
      ) : (
        <Link
          href={dashboardItem.href}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "hover:bg-muted hover:text-accent",
          )}
        >
          <DashboardIcon className="h-4 w-4" />
          <span className="hidden md:inline">{dashboardItem.name}</span>
        </Link>
      )}

      {/* Category dropdowns */}
      {filteredCategories.map((category) => {
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
