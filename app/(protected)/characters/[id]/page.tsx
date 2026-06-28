"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"

export default function CharacterDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { ready, userId } = useAuthReady()

  useEffect(() => {
    const redirectToCharacter = async () => {
      if (!id || !ready || !userId) return

      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from("characters")
          .select("project_id")
          .eq("id", id)
          .eq("user_id", userId)
          .single()

        if (error || !data?.project_id) {
          toast({
            title: "Character Not Found",
            description:
              "The character you're looking for doesn't exist or you don't have access to it.",
            variant: "destructive",
          })
          router.replace("/characters")
          return
        }

        router.replace(
          `/characters?movie=${data.project_id}&character=${id}`,
        )
      } catch {
        toast({
          title: "Error",
          description: "Failed to load character. Please try again.",
          variant: "destructive",
        })
        router.replace("/characters")
      }
    }

    redirectToCharacter()
  }, [id, ready, userId, router, toast])

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading character...
        </div>
      </div>
    </>
  )
}
