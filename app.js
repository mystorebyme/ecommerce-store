// Purpose: Vercel Express entrypoint — pura API ek hi serverless function me
//
// Vercel `api/` folder ke catch-all (`api/[...path].ts`) ko nested paths ke liye match
// nahi karta tha (`/api/v1/payments/abc` → platform 404). Express preset `app.js` entry
// leta hai aur saari requests isi ek function par bhej deta hai, to routing poora Express
// ke haath me rehta hai — koi path shape ki guzarish nahi.
//
// `app` pre-built CJS bundle se aata hai (`api/_lib/serverless.js`, install step me esbuild
// se banti hai). Error aaye to crash ke bajaye JSON me asli wajah lauta dete hain.

async function handler(req, res) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getApp } = require("./api/_lib/serverless.js");
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

// Observer webhook ka HMAC raw body par banta hai — Vercel body ko pehle parse na kare.
handler.config = { api: { bodyParser: false } };

module.exports = handler;
