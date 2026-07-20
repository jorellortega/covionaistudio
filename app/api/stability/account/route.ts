import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = String(body.apiKey || "").trim()

    if (!apiKey) {
      return NextResponse.json({ error: "Stability API key is required" }, { status: 400 })
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "stability-client-id": "cinema-platform",
      "stability-client-version": "1.0.0",
    }

    const [accountRes, balanceRes] = await Promise.all([
      fetch("https://api.stability.ai/v1/user/account", { headers }),
      fetch("https://api.stability.ai/v1/user/balance", { headers }),
    ])

    const account = accountRes.ok
      ? await accountRes.json()
      : { error: await accountRes.text().catch(() => `HTTP ${accountRes.status}`) }

    const balance = balanceRes.ok
      ? await balanceRes.json()
      : { error: await balanceRes.text().catch(() => `HTTP ${balanceRes.status}`) }

    if (!accountRes.ok && !balanceRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Stability account", account, balance },
        { status: 401 }
      )
    }

    return NextResponse.json({
      ok: accountRes.ok || balanceRes.ok,
      account: accountRes.ok ? account : null,
      balance: balanceRes.ok ? balance : null,
      accountError: accountRes.ok ? null : account,
      balanceError: balanceRes.ok ? null : balance,
    })
  } catch (error: any) {
    console.error("[stability/account]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Stability account" },
      { status: 500 }
    )
  }
}
