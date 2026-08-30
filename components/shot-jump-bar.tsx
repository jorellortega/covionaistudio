"use client"

export type ShotJumpItem = {
  id: string
  label: string
  status?: string | null
}

export function getStatusJumperStyle(status?: string | null) {
  switch (status) {
    case "in-progress":
    case "scheduled":
      return "text-yellow-500 border-yellow-500/50"
    case "review":
      return "text-orange-500 border-orange-500/50"
    case "approved":
      return "text-green-500 border-green-500/50"
    case "rejected":
      return "text-red-500 border-red-500/50"
    case "completed":
    case "shot":
      return "text-blue-500 border-blue-500/50"
    default:
      return "text-muted-foreground border-border"
  }
}

export function scrollWindowToShot(elementId: string, headerOffset = 96) {
  const el = document.getElementById(elementId)
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" })
  el.scrollIntoView({ block: "nearest", inline: "center" })
  return true
}

type ShotJumpBarProps = {
  shots: ShotJumpItem[]
  jumpedShotId: string | null
  onJump: (id: string) => void
}

export function ShotJumpBar({ shots, jumpedShotId, onJump }: ShotJumpBarProps) {
  if (shots.length === 0) return null

  return (
    <nav
      aria-label="Jump to shot"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur-md"
    >
      <div
        className="flex items-stretch gap-px overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-1.5 touch-pan-x"
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
          event.currentTarget.scrollLeft += event.deltaY
          event.preventDefault()
        }}
      >
        {shots.map((shot) => (
          <button
            key={shot.id}
            type="button"
            title={`Jump to shot ${shot.label}`}
            onClick={() => onJump(shot.id)}
            className={`h-8 min-w-fit flex-1 shrink-0 whitespace-nowrap rounded border px-1.5 font-mono text-[11px] leading-none tabular-nums hover:bg-muted ${getStatusJumperStyle(shot.status)} ${
              jumpedShotId === shot.id ? "bg-muted text-foreground" : ""
            }`}
          >
            {shot.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function jumpedShotHighlightClass(isActive: boolean) {
  return isActive
    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
    : ""
}
