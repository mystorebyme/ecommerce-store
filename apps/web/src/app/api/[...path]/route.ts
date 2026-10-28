// Purpose: Server-side proxy — browser se API tak (CORS aur URL exposure dono se bachne ke liye)
//
// Storefront ka browser sirf apne hi origin (`/api/...`) ko chhoota hai; ye route handler
// request ko API par forward karta hai. `API_URL` server par hi rehta hai.

import { NextResponse, type NextRequest } from "next/server";

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  const target = `${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers: Record<string, string> = { "content-type": request.headers.get("content-type") ?? "application/json" };
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  try {
    const upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "API_UNREACHABLE", message: "Payment API se connection nahi bana. Server chal raha hai?" } },
      { status: 502 },
    );
  }
}

type Context = { params: { path: string[] } };

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  return forward(request, context.params.path);
}

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  return forward(request, context.params.path);
}

export const dynamic = "force-dynamic";
