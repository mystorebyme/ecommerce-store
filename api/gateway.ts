// Purpose: Vercel ka ekmatra API function — saari /api/v1/* requests express app ko
//
// Kyun rewrite + ek function: Vercel ke filesystem routing me nested catch-all
// (`api/v1/[...path].ts`) sirf ek segment match karta tha, aur root catch-all bilkul
// match nahi hua — `/api/v1/payments/abc` par platform 404 aa jaata tha. Isliye
// `vercel.json` me rewrite hai:
//
//   /api/v1/(.*)  →  /api/gateway?__rest=$1
//
// Handler original path wapas jodta hai (`req.url`), phir Express ko de deta hai —
// routing, middlewares, raw body: sab Express ke hisaab se chalta hai.
//
// App pre-built CJS bundle se aata hai (`api/_lib/serverless.js`, postinstall me esbuild
// se banti hai). Boot fail ho to platform ke generic 500 ki jagah asli wajah JSON me aati hai.

import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { api: { bodyParser: false } };

type ServerlessModule = { getApp: () => Promise<(req: unknown, res: unknown) => void> };

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

/** Rewrite se aaya `__rest` + baaki query params nikaalo. */
function readParams(req: VercelRequest): { rest: string; extra: URLSearchParams } {
  const extra = new URLSearchParams();

  // Pehle URL se (rewrite destination query yahan milti hai), phir req.query se merge.
  const fromUrl = new URL(req.url ?? "/", "http://localhost").searchParams;
  const merged = new Map<string, string[]>();
  for (const [key, value] of [...fromUrl.entries(), ...Object.entries(req.query ?? {})]) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      const list = merged.get(key) ?? [];
      if (!list.includes(item)) list.push(item);
      merged.set(key, list);
    }
  }

  const rest = (merged.get("__rest") ?? []).join("/");
  for (const [key, values] of merged) {
    if (key === "__rest") continue;
    for (const value of values) extra.append(key, value);
  }
  return { rest, extra };
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  const { rest, extra } = readParams(req);
  const search = extra.toString();
  req.url = `/api/v1${rest ? `/${rest.replace(/^\/+/, "")}` : ""}${search ? `?${search}` : ""}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getApp } = require("./_lib/serverless.js") as ServerlessModule;
    const app = await getApp();
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
