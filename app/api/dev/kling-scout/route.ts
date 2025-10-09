// app/api/dev/kling-scout/route.ts (DEV ONLY)
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const BASES = [
  "https://api-singapore.klingai.com",
  "https://api.klingai.com",
];

// Candidate resource roots taken from your docs sidebar (UNVERSIONED)
const CANDIDATES = [
  "/text-to-video",
  "/text-to-video/create-task",
  "/image-to-video", 
  "/multi-image-to-video",
  "/multi-elements",
  "/video-extension",
  "/lip-sync",
  "/video-effects",
  "/text-to-audio",
  "/video-to-audio",
  "/tts",
  "/image-generation",
  "/multi-image-to-image",
  "/image-expansion",
  "/virtual-try-on",
];

function makeBearer(ak: string, sk: string) {
  return "Bearer " + jwt.sign({}, sk, {
    algorithm: "HS256",
    issuer: ak,
    notBefore: -5,
    expiresIn: 1800,
    header: { alg: "HS256" },
  });
}

export async function GET() {
  // load per-user keys from DB (like your working setup)
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("kling_api_key,kling_secret_key")
    .eq("id", user.id)
    .single();

  if (error || !data?.kling_api_key || !data?.kling_secret_key) {
    return NextResponse.json({ error: "No Kling keys in DB" }, { status: 400 });
  }

  const ak = data.kling_api_key.trim();
  const sk = data.kling_secret_key.trim();
  const auth = makeBearer(ak, sk);

  const findings: any[] = [];

  for (const base of BASES) {
    for (const path of CANDIDATES) {
      const url = base + path;

      // 1) Probe OPTIONS to see if resource exists and what verbs are allowed
      let allow = null;
      let optStatus = 0;
      try {
        const opt = await fetch(url, {
          method: "OPTIONS",
          headers: { Authorization: auth }
        });
        optStatus = opt.status;
        allow = opt.headers.get("Allow") || opt.headers.get("allow");
      } catch (e) {}

      const record: any = { base, path, optionsStatus: optStatus, allow };

      // 2) If OPTIONS hints it's real (204 or 200) or just to be thorough, try a tiny POST and see if we get 400 (good!)
      if (optStatus !== 404) {
        try {
          const payload = {
            prompt: "hello world",
            // many of these APIs are async task-based per your docs:
            callback_url: "/api/kling/callback",
            // include a couple neutral knobs that many video gens accept; server will tell us if wrong
            duration: 3,
            model: "kling-v1",
          };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const text = await res.text();
          record.postStatus = res.status;
          record.postPreview = text.slice(0, 400);
        } catch (e: any) {
          record.postError = String(e);
        }
      }

      findings.push(record);
    }
  }

  // Bubble up anything that looks alive (OPTIONS not 404, or POST returns 400/200/202)
  const interesting = findings.filter(f =>
    (f.optionsStatus && f.optionsStatus !== 404) ||
    (typeof f.postStatus === "number" && f.postStatus !== 404)
  );

  return NextResponse.json({
    basesTried: BASES.length,
    candidatesTried: CANDIDATES.length,
    interestingCount: interesting.length,
    interesting,
    all: findings,
  });
}
