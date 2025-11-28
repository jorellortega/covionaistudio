"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  ChevronRight,
  LayoutDashboard,
  Play,
  Image as ImageIcon,
  UserCircle,
  MapPin,
  Zap,
  Users,
  Package,
  Sparkles,
  Box,
} from "lucide-react"
import { Palette as MoodPalette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthReady } from "@/components/auth-hooks"
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
      { name: "Lighting Plot", href: "/lighting-plot", icon: Zap },
      { name: "Call Sheet", href: "/call-sheet", icon: FileText },
      { name: "Crew Sheet", href: "/crew-sheet", icon: Users },
      { name: "Equipment List", href: "/equipment-list", icon: Package },
      { name: "Props List", href: "/props-list", icon: Box },
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
      { name: "Locations", href: "/locations", icon: MapPin },
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

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()
  const { user, userId, ready } = useAuthReady()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
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

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  // Filter categories based on user role - AI Tools only for ceo and production
  const filteredCategories = userRole
    ? navigationCategories.filter(category => {
        if (category.name === "AI Tools") {
          return userRole === 'ceo' || userRole === 'production'
        }
        return true
      })
    : navigationCategories

  const DashboardIcon = dashboardItem.icon
  const isDashboardActive = isPathActive(pathname, dashboardItem.href)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        
        <nav className="flex flex-col overflow-y-auto">
          {/* Dashboard */}
          <Link
            href={dashboardItem.href}
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
              isDashboardActive
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
          >
            <DashboardIcon className="h-5 w-5" />
            <span>{dashboardItem.name}</span>
          </Link>

          {/* Categories */}
          {filteredCategories.map((category) => {
            const CategoryIcon = category.icon
            const categoryActive = isCategoryActive(pathname, category)
            const isExpanded = expandedCategories.has(category.name)

            // If category has only one item, render as direct link
            if (category.items.length === 1) {
              const item = category.items[0]
              const isActive = isPathActive(pathname, item.href)
              const ItemIcon = item.icon

              return (
                <Link
                  key={category.name}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <ItemIcon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            }

            // Render as expandable category
            return (
              <div key={category.name}>
                <button
                  onClick={() => toggleCategory(category.name)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-6 py-3 text-sm font-medium transition-colors",
                    categoryActive
                      ? "bg-accent/50 text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className="h-5 w-5" />
                    <span>{category.name}</span>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="bg-muted/30">
                    {category.items.map((item) => {
                      const isActive = isPathActive(pathname, item.href)
                      const ItemIcon = item.icon
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "flex items-center gap-3 px-6 pl-14 py-2.5 text-sm transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <ItemIcon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className={cn(
              "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors mt-auto border-t",
              pathname === "/settings"
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

