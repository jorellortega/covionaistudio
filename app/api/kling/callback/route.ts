import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Minimal shape guard based on Kling AI callback protocol
    const { task_id, task_status, task_result } = body || {};
    
    console.log("[Kling callback]", { 
      task_id, 
      task_status,
      hasResult: !!task_result,
      resultKeys: task_result ? Object.keys(task_result) : []
    });

    // Log the full callback for debugging
    console.log("[Kling callback] Full body:", JSON.stringify(body, null, 2));

    // You can verify origin/signature if Kling provides one; their doc doesn't show it.
    // Save task status/result to your DB here.
    // For now, just log the callback

    return NextResponse.json({ ok: true, received: { task_id, task_status } });
  } catch (error) {
    console.error("[Kling callback] Error:", error);
    return NextResponse.json({ 
      error: "Callback processing failed", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
