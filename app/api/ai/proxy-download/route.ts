import { NextRequest, NextResponse } from "next/server"

function isAllowedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null
    if (supabaseHost && parsed.host === supabaseHost) return true
    if (parsed.host.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/")) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-() ]/g, "_").slice(0, 180) || "download.mp4"
}

export async function GET(request: NextRequest) {
  try {
    const { createServerClient } = await import("@supabase/ssr")
    const { cookies } = await import("next/headers")

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch {
              /* ignore */
            }
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fileUrl = request.nextUrl.searchParams.get("url")
    const filename = sanitizeFilename(
      request.nextUrl.searchParams.get("filename") || "download.mp4",
    )

    if (!fileUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }

    if (!isAllowedDownloadUrl(fileUrl)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 })
    }

    const upstream = await fetch(fileUrl)
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file (${upstream.status})` },
        { status: 502 },
      )
    }

    const buffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get("content-type") || "application/octet-stream"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("proxy-download error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 },
    )
  }
}
