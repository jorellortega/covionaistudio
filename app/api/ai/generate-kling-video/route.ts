import { NextResponse } from "next/server";
import { makeKlingBearer } from "@/lib/klingAuth";

// CORS headers for development
const headersCORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: headersCORS });
}

const KLING_BASE = process.env.KLING_BASE_URL?.trim() || "https://api-singapore.klingai.com";
const KLING_T2V_PATH = process.env.KLING_T2V_PATH?.trim() || "";

function clip(s: string, n = 1500) { 
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s; 
}

async function getUserKlingKeys() {
  try {
    // 1) try per-user keys from DB
    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    
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
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore setAll errors in server components
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!authError && user) {
      const { data } = await supabase
        .from('users')
        .select('kling_api_key, kling_secret_key')
        .eq('id', user.id)
        .single();

      const ak = data?.kling_api_key?.trim();
      const sk = data?.kling_secret_key?.trim();
      if (ak && sk) return { ak, sk, source: 'db' };
    }
  } catch (error) {
    console.log('Error loading user keys from DB:', error);
  }

  // 2) fallback to global .env keys
  const ak = process.env.KLING_ACCESS_KEY?.trim();
  const sk = process.env.KLING_SECRET_KEY?.trim();
  if (ak && sk) return { ak, sk, source: "env" };

  return { ak: "", sk: "", source: "none" };
}

export async function POST(req: Request) {
  const rid = Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();
  
  const { payload, prompt, duration, model, type } = await req.json().catch(() => ({}));
  
  // Check if Text-to-Video path is configured
  if (!KLING_T2V_PATH) {
    return NextResponse.json(
      {
        error: "Kling Text-to-Video path not configured",
        hint: "Open Kling API Reference → Text to Video, copy the Request URL (unversioned), set KLING_T2V_PATH in your .env file, and restart the server.",
        suggestion: "Add KLING_T2V_PATH=/text-to-video/create-task (or whatever the exact path is) to your .env file."
      },
      { status: 400, headers: headersCORS }
    );
  }
  
  // Load API keys from database or environment variables
  const { ak, sk, source } = await getUserKlingKeys();
  
  if (!ak || !sk) {
    return NextResponse.json(
      { 
        error: "Missing Kling credentials (accessKey and secretKey required)", 
        debug: { whereWeLooked: source },
        suggestion: "Please add your Kling AI API keys in the Setup AI page, or add KLING_ACCESS_KEY and KLING_SECRET_KEY to your .env file."
      },
      { status: 400, headers: headersCORS }
    );
  }

  const auth = makeKlingBearer(ak, sk);

  // Build minimal payload for async task model with callback
  const requestBody = {
    prompt: prompt || "a red fox running in a forest",
    duration: duration ? parseInt(duration) : 3,
    model: model || "kling-v1",
    callback_url: "/api/kling/callback"
  };

  const url = KLING_BASE + KLING_T2V_PATH;
  
  console.log(`[KLING][${rid}] → Keys loaded from: ${source}`);
  console.log(`[KLING][${rid}] → AccessKey: ${ak.substring(0, 10)}...`);
  console.log(`[KLING][${rid}] → SecretKey: ${sk.substring(0, 10)}...`);
  console.log(`[KLING][${rid}] → POST ${url}`);
  console.log(`[KLING][${rid}] → Body:`, requestBody);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(requestBody),
    });

    const text = await res.text();
    const ms = Date.now() - t0;

    if (!res.ok) {
      console.log(`[KLING][${rid}] ← ${res.status} ${res.statusText} in ${ms}ms`);
      console.log(`[KLING][${rid}] ← Body: ${clip(text)}`);
      
      return NextResponse.json(
        { 
          error: "Upstream HTTP error", 
          upstream: { status: res.status, statusText: res.statusText }, 
          bodyPreview: clip(text),
          hint: res.status === 404 
            ? "404 from Kling means the path is wrong. Paste the exact Request URL from Kling API Reference into KLING_T2V_PATH."
            : undefined,
          debug: { rid, url, ms, keySource: source }
        },
        { status: res.status, headers: headersCORS }
      );
    }

    // Success! Try to parse JSON, else return raw
    try {
      const data = JSON.parse(text);
      console.log(`[KLING][${rid}] ← Success! Got task_id: ${data.task_id || 'unknown'}`);
      return NextResponse.json({ data, debug: { rid, url, ms, keySource: source } }, { headers: headersCORS });
    } catch {
      console.log(`[KLING][${rid}] ← Success! Raw response: ${clip(text)}`);
      return NextResponse.json({ data: { raw: text }, debug: { rid, url, ms, keySource: source } }, { headers: headersCORS });
    }
  } catch (err: any) {
    const ms = Date.now() - t0;
    const isAbort = err?.name === "AbortError";
    console.error(`[KLING][${rid}] ✖ ${isAbort ? "Timeout" : "Network error"} in ${ms}ms`, err?.message);
    clearTimeout(timer);
    
    return NextResponse.json(
      { 
        error: isAbort ? "Upstream timeout" : "Network error", 
        details: String(err),
        debug: { rid, url, ms, isAbort, keySource: source }
      },
      { status: 504, headers: headersCORS }
    );
  }
}