// Purpose: Vercel serverless function — saare /api/v1/* requests Express app ko jaate hain
//
// `bodyParser: false` zaroori hai: observer webhook ka HMAC raw body par banta hai.
// Agar Vercel pehle JSON parse kar de to signature kabhi verify nahi hoti.

import type { IncomingMessage, ServerResponse } from "node:http";
import { getApp } from "../../apps/api/src/serverless";

export const config = { api: { bodyParser: false } };

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    app(req as never, res as never);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: {
          code: "BOOT_FAILED",
          message: "API boot nahi hua — environment variables (DATABASE_URL) check karo.",
          detail: String(error).slice(0, 300),
        },
      }),
    );
  }
}
