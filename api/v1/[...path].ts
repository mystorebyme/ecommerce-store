// Purpose: Vercel serverless function — saare /api/v1/* requests Express app ko jaate hain
//
// `bodyParser: false` zaroori hai: observer webhook ka HMAC raw body par banta hai.
// Agar Vercel pehle JSON parse kar de to signature kabhi verify nahi hoti.
//
// App ko static import nahi karte: agar koi dependency lambda me bundle nahi hui
// (jaise Prisma engine), to static import par function boot se pehle hi crash ho
// jaata hai aur Vercel generic "FUNCTION_INVOCATION_FAILED" deta hai — asli error
// kahin nahi dikhta. Dynamic import se error pakad kar JSON me lautate hain.

import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { getApp } = await import("../../apps/api/src/serverless");
    const app = await getApp();
    app(req as never, res as never);
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(JSON.stringify({ level: "error", msg: "api_boot_failed", detail }));

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            code: "BOOT_FAILED",
            message: "API boot nahi hua — DATABASE_URL / Prisma client check karo.",
            detail: detail.slice(0, 500),
          },
        }),
      );
    }
  }
}
