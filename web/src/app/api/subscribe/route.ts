export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// The Express subscribe service (oyscat/server) owns validation, rate limiting and mail delivery; this only forwards.
const SUBSCRIBE_API_URL = `${(process.env.OYSCAT_API_URL || "http://127.0.0.1:4000").replace(/\/+$/, "")}/api/subscribe`

export async function POST(request: Request) {
  const headers: Record<string, string> = {
    "content-type": request.headers.get("content-type") ?? "application/json",
    "x-request-id": request.headers.get("x-request-id") ?? crypto.randomUUID(),
  }
  // The service rate-limits per client IP; without this every visitor would share the Next server's address.
  // Next fills x-forwarded-for with the socket address when the request arrives without one.
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    headers["x-forwarded-for"] = forwardedFor
  }

  try {
    const upstream = await fetch(SUBSCRIBE_API_URL, {
      method: "POST",
      headers,
      body: await request.text(),
      cache: "no-store",
    })
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        "cache-control": "no-store",
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        ...(upstream.headers.get("retry-after") ? { "retry-after": upstream.headers.get("retry-after")! } : {}),
      },
    })
  } catch {
    return Response.json(
      { error: { code: "SUBSCRIBE_UNAVAILABLE", message: "订阅暂时不可用，请稍后重试" } },
      { status: 503, headers: { "cache-control": "no-store" } },
    )
  }
}
