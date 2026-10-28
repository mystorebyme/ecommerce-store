// Purpose: Vercel serverless function — saare /api/* requests (nested bhi) Express app ko jaate hain
//
// Catch-all root par hai (api/[...path].ts), `api/v1/[...path].ts` par nahi — Vercel us
// nested catch-all ko sirf ek segment ke liye match karta hai, isliye `/api/v1/payments/xyz`
// 404 ho jaata tha.
//
// `bodyParser: false` zaroori hai: observer webhook ka HMAC raw body par banta hai.
// Agar Vercel pehle JSON parse kar de to signature kabhi verify nahi hoti.
//
// App ek pre-built CJS bundle se aata hai (`api/_lib/serverless.js`, install step me
// esbuild se banti hai). Kyun bundle: Vercel ka TS compilation har transitive import
// (workspace package `@youpi/validation`, symlinked deps) ko reliably trace nahi karta —
// module load par crash hone se Vercel generic "FUNCTION_INVOCATION_FAILED" deta hai
// aur asli error kahin nahi dikhta. Bundle + `require` se error pakad kar JSON me
// lauta sakte hain.

import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { api: { bodyParser: false } };

type ServerlessModule = { getApp: () => Promise<(req: unknown, res: unknown) => void> };

function loadServerless(): ServerlessModule {
  // require (na ki import) — bundle CJS hai aur error synchronous/catchable rehta hai.
  // Static path hi rakho — @vercel/nft isi se file ko lambda me include karta hai.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./_lib/serverless.js") as ServerlessModule;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await loadServerless().getApp();
    app(req, res);
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
